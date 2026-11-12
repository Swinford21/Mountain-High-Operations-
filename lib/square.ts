import { SquareClient, SquareEnvironment } from 'square'
import { eq, isNull, max, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { customers, payments } from '@/lib/db/schema'
import { toE164 } from '@/lib/notify'

export function isSquareConfigured() {
  return !!process.env.SQUARE_ACCESS_TOKEN
}

function getSquare() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN,
    environment:
      process.env.SQUARE_ENVIRONMENT?.toLowerCase() === 'sandbox'
        ? SquareEnvironment.Sandbox
        : SquareEnvironment.Production,
  })
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

  return { upserted }
}

export async function unlinkedPaymentsCount() {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(isNull(payments.customerId))
  return row?.count ?? 0
}
