import { SquareClient, SquareEnvironment, type Square } from 'square'
import { eq, isNull, max, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { customers, payments, products } from '@/lib/db/schema'
import { toE164 } from '@/lib/notify'

const DEFAULT_APPLICATION_ID = 'sq0idp-ZkzJ1GRYIkXM2rOiwKnWFw'

function squareToken() {
  return process.env.SQUARE_ACCESS_TOKEN_2 || process.env.SQUARE_ACCESS_TOKEN
}

function squareApplicationId() {
  return process.env.SQUARE_APPLICATION_ID || DEFAULT_APPLICATION_ID
}

function isSandbox() {
  return process.env.SQUARE_ENVIRONMENT?.toLowerCase() === 'sandbox' || squareApplicationId().startsWith('sandbox-')
}

export function isSquareConfigured() {
  return !!squareToken()
}

function getSquare() {
  return new SquareClient({
    token: squareToken(),
    environment: isSandbox() ? SquareEnvironment.Sandbox : SquareEnvironment.Production,
  })
}

/** Public values the browser needs to load Square's card form. */
export function getSquareWebConfig() {
  return { applicationId: squareApplicationId(), sandbox: isSandbox() }
}

export type SquareLocation = { id: string; name: string }

let locationCache: { at: number; locations: SquareLocation[] } | null = null

/** Active locations that can take card payments. Cached briefly since they rarely change. */
export async function getSquareLocations(): Promise<SquareLocation[]> {
  if (!isSquareConfigured()) return []
  if (locationCache && Date.now() - locationCache.at < 10 * 60 * 1000) return locationCache.locations
  const { locations } = await getSquare().locations.list()
  const usable = (locations ?? [])
    .filter((l) => l.id && l.status === 'ACTIVE' && (l.capabilities ?? []).includes('CREDIT_CARD_PROCESSING'))
    .map((l) => ({ id: l.id!, name: l.name ?? l.id! }))
  locationCache = { at: Date.now(), locations: usable }
  return usable
}

/** Turns a Square API error into a message staff can act on. */
export function squareErrorMessage(e: unknown, fallback: string) {
  const err = e as { statusCode?: number; errors?: { code?: string; detail?: string }[] }
  if (err.statusCode === 401) return 'Square rejected the access token'
  const first = err.errors?.[0]
  const byCode: Record<string, string> = {
    CARD_DECLINED: 'Card was declined',
    GENERIC_DECLINE: 'Card was declined',
    CVV_FAILURE: 'Security code (CVV) did not match',
    ADDRESS_VERIFICATION_FAILURE: 'ZIP code did not match the card',
    INVALID_EXPIRATION: 'Card expiration date is invalid',
    INSUFFICIENT_FUNDS: 'Card has insufficient funds',
    CARD_EXPIRED: 'Card is expired',
    INVALID_CARD: 'Card number is invalid',
    TRANSACTION_LIMIT: 'Amount is over the card limit',
  }
  if (first?.code && byCode[first.code]) return byCode[first.code]
  return first?.detail || fallback
}

export async function chargeCard(input: {
  sourceId: string
  idempotencyKey: string
  amountCents: number
  locationId: string
  jobId: number
  squareCustomerId: string | null
  buyerEmail: string | null
  note: string
}) {
  const { payment } = await getSquare().payments.create({
    sourceId: input.sourceId,
    idempotencyKey: input.idempotencyKey,
    amountMoney: { amount: BigInt(input.amountCents), currency: 'USD' },
    locationId: input.locationId,
    autocomplete: true,
    referenceId: `job-${input.jobId}`,
    note: input.note.slice(0, 500),
    ...(input.squareCustomerId ? { customerId: input.squareCustomerId } : {}),
    ...(input.buyerEmail ? { buyerEmailAddress: input.buyerEmail } : {}),
  })
  if (!payment?.id) throw new Error('Square did not return a payment')
  return {
    squarePaymentId: payment.id,
    squareOrderId: payment.orderId ?? null,
    status: payment.status ?? 'UNKNOWN',
    receiptUrl: payment.receiptUrl ?? null,
    amountCents: Number(payment.totalMoney?.amount ?? payment.amountMoney?.amount ?? input.amountCents),
    paidAt: payment.createdAt ? new Date(payment.createdAt) : new Date(),
  }
}

export async function createPaymentLink(input: {
  idempotencyKey: string
  amountCents: number
  locationId: string
  title: string
  jobId: number
  buyerEmail: string | null
  buyerPhone: string | null
}) {
  const { paymentLink } = await getSquare().checkout.paymentLinks.create({
    idempotencyKey: input.idempotencyKey,
    quickPay: {
      name: `${input.title} (Job #${input.jobId})`.slice(0, 255),
      priceMoney: { amount: BigInt(input.amountCents), currency: 'USD' },
      locationId: input.locationId,
    },
    paymentNote: `Job #${input.jobId}`,
    prePopulatedData: {
      ...(input.buyerEmail ? { buyerEmail: input.buyerEmail } : {}),
      ...(toE164(input.buyerPhone) ? { buyerPhoneNumber: toE164(input.buyerPhone)! } : {}),
    },
  })
  if (!paymentLink?.url || !paymentLink.orderId) throw new Error('Square did not return a payment link')
  return { url: paymentLink.url, orderId: paymentLink.orderId }
}

/** Completed payments recorded against a job, in cents. */
export async function jobCollectedCents(jobId: number) {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` })
    .from(payments)
    .where(sql`${payments.jobId} = ${jobId} and ${payments.status} = 'COMPLETED'`)
  return row?.total ?? 0
}

type SquareAddress = {
  addressLine1?: string | null
  addressLine2?: string | null
  locality?: string | null
  administrativeDistrict1?: string | null
  postalCode?: string | null
}

function formatAddress(a?: SquareAddress | null) {
  if (!a) return null
  const street = [a.addressLine1, a.addressLine2].filter(Boolean).join(' ')
  const cityLine = [a.locality, [a.administrativeDistrict1, a.postalCode].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')
  const full = [street, cityLine].filter(Boolean).join(', ')
  return full || null
}

/**
 * Pulls every Square customer. Existing local customers are matched by Square ID,
 * then by email or phone, so imported spreadsheet customers get linked instead of duplicated.
 */
export async function syncSquareCustomers() {
  const square = getSquare()
  const local = await db
    .select({ id: customers.id, email: customers.email, phone: customers.phone, squareCustomerId: customers.squareCustomerId })
    .from(customers)

  const bySquareId = new Map<string, number>()
  const unlinkedByEmail = new Map<string, number>()
  const unlinkedByPhone = new Map<string, number>()
  for (const c of local) {
    if (c.squareCustomerId) bySquareId.set(c.squareCustomerId, c.id)
    else {
      if (c.email) unlinkedByEmail.set(c.email.trim().toLowerCase(), c.id)
      const p = toE164(c.phone)
      if (p) unlinkedByPhone.set(p, c.id)
    }
  }

  let created = 0
  let updated = 0
  const pager = await square.customers.list({ limit: 100 })
  for await (const sc of pager) {
    if (!sc.id) continue
    const name =
      [sc.givenName, sc.familyName].filter(Boolean).join(' ').trim() || sc.companyName || sc.emailAddress || 'Square customer'
    const email = sc.emailAddress?.trim() || null
    const phone = sc.phoneNumber?.trim() || null
    const address = formatAddress(sc.address as SquareAddress | undefined)

    const existingId =
      bySquareId.get(sc.id) ??
      (email ? unlinkedByEmail.get(email.toLowerCase()) : undefined) ??
      (toE164(phone) ? unlinkedByPhone.get(toE164(phone)!) : undefined)

    if (existingId) {
      await db
        .update(customers)
        .set({
          squareCustomerId: sc.id,
          name,
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
          ...(address ? { address } : {}),
          updatedAt: new Date(),
        })
        .where(eq(customers.id, existingId))
      updated++
    } else {
      await db.insert(customers).values({ name, email, phone, address, squareCustomerId: sc.id })
      created++
    }
  }
  return { created, updated }
}

/**
 * Adds new Square catalog items (one product per variation) and refreshes names and categories.
 * Prices and Active/Hidden on existing products are left alone so edits made here are kept.
 */
export async function syncSquareCatalog() {
  const categoryNames = new Map<string, string>()
  const items: Square.CatalogObject[] = []
  for await (const obj of await getSquare().catalog.list({ types: 'ITEM,CATEGORY' })) {
    if (obj.isDeleted) continue
    if (obj.type === 'CATEGORY' && obj.id) categoryNames.set(obj.id, obj.categoryData?.name ?? 'Other')
    else if (obj.type === 'ITEM') items.push(obj)
  }

  const existing = new Map(
    (await db.select({ id: products.id, squareToken: products.squareToken }).from(products))
      .filter((p) => p.squareToken)
      .map((p) => [p.squareToken!, p.id]),
  )

  let added = 0
  let updated = 0
  for (const item of items) {
    if (item.type !== 'ITEM' || !item.itemData) continue
    const data = item.itemData
    const categoryId = data.reportingCategory?.id ?? data.categories?.[0]?.id ?? data.categoryId
    const category = (categoryId && categoryNames.get(categoryId)) || 'Other'
    const name = (data.name ?? '').trim()
    if (!name) continue

    for (const v of data.variations ?? []) {
      if (v.type !== 'ITEM_VARIATION' || !v.id || v.isDeleted) continue
      const vd = v.itemVariationData
      const fields = { name, variation: vd?.name?.trim() || null, category, sku: vd?.sku?.trim() || null }
      const id = existing.get(v.id)
      if (id) {
        await db.update(products).set(fields).where(eq(products.id, id))
        updated++
      } else if (!data.isArchived) {
        const price = vd?.pricingType === 'FIXED_PRICING' && vd.priceMoney?.amount != null ? Number(vd.priceMoney.amount) : null
        await db
          .insert(products)
          .values({ ...fields, squareToken: v.id, priceCents: price })
          .onConflictDoNothing({ target: products.squareToken })
        added++
      }
    }
  }
  return { added, updated }
}

/** Pulls payments since the last sync (or the past year on first run). */
export async function syncSquarePayments() {
  const square = getSquare()
  const [{ latest }] = await db.select({ latest: max(payments.paidAt) }).from(payments)
  const begin = latest ? new Date(new Date(latest).getTime() - 2 * 86400000) : new Date(Date.now() - 365 * 86400000)

  const customerRows = await db
    .select({ id: customers.id, squareCustomerId: customers.squareCustomerId })
    .from(customers)
  const customerBySquareId = new Map(
    customerRows.filter((c) => c.squareCustomerId).map((c) => [c.squareCustomerId as string, c.id]),
  )

  let upserted = 0
  const pager = await square.payments.list({ beginTime: begin.toISOString(), sortOrder: 'ASC', limit: 100 })
  for await (const p of pager) {
    if (!p.id) continue
    const amount = Number(p.totalMoney?.amount ?? p.amountMoney?.amount ?? 0)
    const values = {
      squarePaymentId: p.id,
      squareCustomerId: p.customerId ?? null,
      squareOrderId: p.orderId ?? null,
      customerId: p.customerId ? (customerBySquareId.get(p.customerId) ?? null) : null,
      amountCents: amount,
      currency: p.totalMoney?.currency ?? p.amountMoney?.currency ?? 'USD',
      status: p.status ?? 'UNKNOWN',
      note: p.note ?? null,
      receiptUrl: p.receiptUrl ?? null,
      paidAt: p.createdAt ? new Date(p.createdAt) : new Date(),
    }
    await db
      .insert(payments)
      .values(values)
      .onConflictDoUpdate({
        target: payments.squarePaymentId,
        set: {
          status: values.status,
          amountCents: values.amountCents,
          customerId: sql`coalesce(${payments.customerId}, ${values.customerId})`,
          receiptUrl: values.receiptUrl,
          note: values.note,
          squareOrderId: values.squareOrderId,
          syncedAt: new Date(),
        },
      })
    upserted++
  }

  // Link earlier payments whose customer was synced after the payment.
  await db.execute(sql`
    update payments p set customer_id = c.id
    from customers c
    where p.customer_id is null and p.square_customer_id is not null and c.square_customer_id = p.square_customer_id
  `)

  // Payments made through a job's pay link belong to that job and its customer.
  await db.execute(sql`
    update payments p set job_id = j.id, customer_id = coalesce(p.customer_id, j.customer_id)
    from jobs j
    where p.job_id is null and p.square_order_id is not null and j.payment_link_order_id = p.square_order_id
  `)
  await db.execute(sql`
    update jobs j set payment_status = 'paid', updated_at = now()
    from (
      select job_id, sum(amount_cents) as total from payments
      where status = 'COMPLETED' and job_id is not null group by job_id
    ) s
    where s.job_id = j.id and j.payment_status = 'unpaid' and j.payment_link_order_id is not null
      and s.total >= coalesce(j.price_cents, 0)
  `)

  return { upserted }
}

export type SquareOrderSummary = {
  id: string
  date: string
  state: string
  totalCents: number
  items: { name: string; quantity: string; totalCents: number }[]
}

/** A customer's Square order history, newest first. Never throws: Square problems come back as `error`. */
export async function getSquareOrders(
  squareCustomerId: string,
): Promise<{ orders: SquareOrderSummary[]; error: string | null }> {
  if (!isSquareConfigured()) return { orders: [], error: 'Square is not connected' }
  try {
    const square = getSquare()
    const { locations } = await square.locations.list()
    const locationIds = (locations ?? []).map((l) => l.id).filter((id): id is string => !!id)
    if (!locationIds.length) return { orders: [], error: null }
    const res = await square.orders.search({
      locationIds,
      query: {
        filter: { customerFilter: { customerIds: [squareCustomerId] } },
        sort: { sortField: 'CREATED_AT', sortOrder: 'DESC' },
      },
      limit: 100,
    })
    const orders = (res.orders ?? [])
      .filter((o) => o.id && o.state !== 'CANCELED')
      .map((o) => ({
        id: o.id!,
        date: o.closedAt ?? o.createdAt ?? '',
        state: o.state ?? 'UNKNOWN',
        totalCents: Number(o.totalMoney?.amount ?? 0),
        items: (o.lineItems ?? []).map((i) => ({
          name: [i.name, i.variationName && i.variationName !== 'Regular' ? i.variationName : null].filter(Boolean).join(' – ') || 'Item',
          quantity: i.quantity,
          totalCents: Number(i.totalMoney?.amount ?? 0),
        })),
      }))
    return { orders, error: null }
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode
    return {
      orders: [],
      error: status === 401 ? 'Square rejected the access token' : 'Could not load orders from Square',
    }
  }
}

export async function unlinkedPaymentsCount() {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(isNull(payments.customerId))
  return row?.count ?? 0
}
