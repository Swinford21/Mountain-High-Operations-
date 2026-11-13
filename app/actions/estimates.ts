'use server'

import { randomBytes } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { customers, estimateItems, estimates } from '@/lib/db/schema'
import { getEstimateByToken, notifyOfficeEstimateApproved, sendEstimateToCustomer } from '@/lib/estimates'
import { getAllOperations } from '@/lib/operations-server'
import { isValidSalesperson } from '@/lib/queries'
import { requireAdmin } from '@/lib/session'
import type { ActionState } from '@/app/actions/jobs'

const optionalText = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .transform((v) => (v ? v : null))

const estimateSchema = z.object({
  customerId: z.coerce.number().int().positive().optional(),
  newCustomerName: optionalText,
  newCustomerEmail: optionalText,
  newCustomerPhone: optionalText,
  newCustomerBillingAddress: optionalText,
  operation: z.string().trim().min(1, 'Pick an operation').max(60),
  title: z.string().trim().min(1, 'Add a short title').max(200),
  address: optionalText,
  salespersonId: optionalText,
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .transform((v) => v ?? null),
  price: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null
      const n = Number(v.replace(/[$,]/g, ''))
      if (!Number.isFinite(n) || n < 0) {
        ctx.addIssue({ code: 'custom', message: 'Price must be a positive number' })
        return z.NEVER
      }
      return Math.round(n * 100)
    }),
  description: optionalText,
  sendNow: z.string().optional(),
})

const itemsSchema = z
  .array(
    z.object({
      productId: z.number().int().positive().nullable(),
      name: z.string().trim().min(1).max(300),
      unit: z.string().trim().max(20),
      quantity: z.number().min(0).max(100000),
      unitPriceCents: z.number().int().min(0).max(100_000_000),
    }),
  )
  .max(100)

function parseItems(formData: FormData) {
  const raw = formData.get('items')
  if (typeof raw !== 'string' || !raw) return []
  try {
    const parsed = itemsSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data.filter((i) => i.quantity > 0) : []
  } catch {
    return []
  }
}

function parseForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries())
  for (const key of Object.keys(raw)) if (raw[key] === '') delete raw[key]
  return estimateSchema.safeParse(raw)
}

async function saveItems(estimateId: number, items: ReturnType<typeof parseItems>) {
  await db.delete(estimateItems).where(eq(estimateItems.estimateId, estimateId))
  if (items.length) await db.insert(estimateItems).values(items.map((i) => ({ ...i, estimateId })))
}

export async function createEstimate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  const parsed = parseForm(formData)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the form' }
  const data = parsed.data
  if (!(await getAllOperations()).some((o) => o.id === data.operation && o.active)) {
    return { ok: false, message: 'Pick an operation' }
  }
  if (!(await isValidSalesperson(data.salespersonId))) return { ok: false, message: 'Pick a salesperson from the list' }

  let customerId = data.customerId
  if (!customerId) {
    if (!data.newCustomerName) return { ok: false, message: 'Pick a customer or add a new one' }
    const [created] = await db
      .insert(customers)
      .values({
        name: data.newCustomerName,
        email: data.newCustomerEmail,
        phone: data.newCustomerPhone,
        address: data.address,
        billingAddress: data.newCustomerBillingAddress,
      })
      .returning({ id: customers.id })
    customerId = created.id
  }

  const [estimate] = await db
    .insert(estimates)
    .values({
      customerId,
      operation: data.operation,
      title: data.title,
      address: data.address,
      priceCents: data.price,
      description: data.description,
      validUntil: data.validUntil,
      salespersonId: data.salespersonId,
      approvalToken: randomBytes(24).toString('base64url'),
      createdBy: admin.id,
    })
    .returning({ id: estimates.id })
  await saveItems(estimate.id, parseItems(formData))

  let sent = -1
  if (data.sendNow === 'on') {
    const result = await sendEstimateToCustomer(estimate.id)
    sent = result.sent
    if (sent > 0) await db.update(estimates).set({ status: 'sent', sentAt: new Date() }).where(eq(estimates.id, estimate.id))
  }

  revalidatePath('/estimates')
  redirect(`/estimates/${estimate.id}?created=1${sent >= 0 ? `&sent=${sent}` : ''}`)
}

export async function updateEstimate(estimateId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const parsed = parseForm(formData)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the form' }
  const data = parsed.data
  if (!data.customerId) return { ok: false, message: 'Pick a customer' }

  const [before] = await db.select().from(estimates).where(eq(estimates.id, estimateId)).limit(1)
  if (!before) return { ok: false, message: 'Estimate not found' }
  if (before.status === 'scheduled') return { ok: false, message: 'This estimate is already booked as a job — edit the job instead' }
  const opAllowed = (await getAllOperations()).some(
    (o) => o.id === data.operation && (o.active || o.id === before.operation),
  )
  if (!opAllowed) return { ok: false, message: 'Pick an operation' }
  if (data.salespersonId !== before.salespersonId && !(await isValidSalesperson(data.salespersonId))) {
    return { ok: false, message: 'Pick a salesperson from the list' }
  }

  await db
    .update(estimates)
    .set({
      customerId: data.customerId,
      operation: data.operation,
      title: data.title,
      address: data.address,
      priceCents: data.price,
      description: data.description,
      validUntil: data.validUntil,
      salespersonId: data.salespersonId,
      updatedAt: new Date(),
    })
    .where(eq(estimates.id, estimateId))
  await saveItems(estimateId, parseItems(formData))

  let sent = -1
  if (data.sendNow === 'on') {
    const result = await sendEstimateToCustomer(estimateId)
    sent = result.sent
    if (sent > 0 && before.status === 'draft') {
      await db.update(estimates).set({ status: 'sent', sentAt: new Date() }).where(eq(estimates.id, estimateId))
    }
  }

  revalidatePath('/estimates')
  revalidatePath('/unscheduled')
  redirect(`/estimates/${estimateId}?updated=1${sent >= 0 ? `&sent=${sent}` : ''}`)
}

export async function sendEstimate(estimateId: number): Promise<ActionState> {
  await requireAdmin()
  const [est] = await db.select({ status: estimates.status }).from(estimates).where(eq(estimates.id, estimateId)).limit(1)
  if (!est) return { ok: false, message: 'Estimate not found' }
  const result = await sendEstimateToCustomer(estimateId)
  if (result.sent === 0) {
    return {
      ok: false,
      message: result.errors[0] ?? 'Nothing was sent — add an email or phone number to the customer first',
    }
  }
  await db
    .update(estimates)
    .set({ sentAt: new Date(), ...(est.status === 'draft' ? { status: 'sent' } : {}), updatedAt: new Date() })
    .where(eq(estimates.id, estimateId))
  revalidatePath(`/estimates/${estimateId}`)
  revalidatePath('/estimates')
  return { ok: true, message: `Estimate sent (${result.sent} message${result.sent === 1 ? '' : 's'})` }
}

/** Office approval, e.g. the customer said yes over the phone. */
export async function approveEstimateAsOffice(estimateId: number): Promise<ActionState> {
  const me = await requireAdmin()
  const [updated] = await db
    .update(estimates)
    .set({
      status: 'approved',
      approvedAt: new Date(),
      approvedByName: me.name,
      approvalMethod: 'office',
      declinedAt: null,
      declineReason: null,
      updatedAt: new Date(),
    })
    .where(and(eq(estimates.id, estimateId), inArray(estimates.status, ['draft', 'sent', 'declined'])))
    .returning({ id: estimates.id })
  if (!updated) return { ok: false, message: 'Only draft, sent, or declined estimates can be approved' }
  await notifyOfficeEstimateApproved(estimateId)
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Approved — added to Unscheduled' }
}

export async function declineEstimateAsOffice(estimateId: number): Promise<ActionState> {
  await requireAdmin()
  const [updated] = await db
    .update(estimates)
    .set({ status: 'declined', declinedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(estimates.id, estimateId), inArray(estimates.status, ['draft', 'sent', 'approved'])))
    .returning({ id: estimates.id })
  if (!updated) return { ok: false, message: 'This estimate can no longer be declined' }
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Marked as declined' }
}

export async function deleteEstimate(estimateId: number): Promise<ActionState> {
  await requireAdmin()
  const [est] = await db.select({ status: estimates.status }).from(estimates).where(eq(estimates.id, estimateId)).limit(1)
  if (!est) return { ok: false, message: 'Estimate not found' }
  if (est.status === 'scheduled') return { ok: false, message: 'Booked estimates are kept with their job' }
  await db.delete(estimateItems).where(eq(estimateItems.estimateId, estimateId))
  await db.delete(estimates).where(eq(estimates.id, estimateId))
  revalidatePath('/', 'layout')
  redirect('/estimates')
}

const customerApprovalSchema = z.object({
  name: z.string().trim().min(2, 'Type your name to approve').max(120),
  agree: z.literal('on', { message: 'Check the box to approve' }),
})

/** Public: the customer approves from the emailed link. The token is the only credential. */
export async function approveEstimateByToken(token: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = customerApprovalSchema.safeParse({ name: formData.get('name'), agree: formData.get('agree') })
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the form' }
  const row = await getEstimateByToken(token)
  if (!row) return { ok: false, message: 'This estimate link is no longer valid' }
  const { estimate } = row
  if (estimate.validUntil && estimate.validUntil < new Date().toISOString().slice(0, 10)) {
    return { ok: false, message: 'This estimate has expired — please call us for an updated quote' }
  }

  const [updated] = await db
    .update(estimates)
    .set({
      status: 'approved',
      approvedAt: new Date(),
      approvedByName: parsed.data.name,
      approvalMethod: 'customer',
      updatedAt: new Date(),
    })
    .where(and(eq(estimates.id, estimate.id), inArray(estimates.status, ['draft', 'sent'])))
    .returning({ id: estimates.id })
  if (!updated) return { ok: false, message: 'This estimate has already been answered' }

  await notifyOfficeEstimateApproved(estimate.id)
  revalidatePath(`/estimate/${token}`)
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Approved' }
}

export async function declineEstimateByToken(token: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 1000) || null
  const row = await getEstimateByToken(token)
  if (!row) return { ok: false, message: 'This estimate link is no longer valid' }
  const [updated] = await db
    .update(estimates)
    .set({ status: 'declined', declinedAt: new Date(), declineReason: reason, updatedAt: new Date() })
    .where(and(eq(estimates.id, row.estimate.id), inArray(estimates.status, ['draft', 'sent'])))
    .returning({ id: estimates.id })
  if (!updated) return { ok: false, message: 'This estimate has already been answered' }
  revalidatePath(`/estimate/${token}`)
  revalidatePath('/estimates')
  return { ok: true, message: 'Declined' }
}
