'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { customers, jobItems, jobs, payments } from '@/lib/db/schema'
import { sendJobMessage, sendTomorrowReminders } from '@/lib/job-notifications'
import { JOB_STATUSES, OPERATION_IDS } from '@/lib/operations'
import { requireAdmin, requireUser } from '@/lib/session'

export type ActionState = { ok: boolean; message: string } | null

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v ? v : null))

const jobSchema = z.object({
  customerId: z.coerce.number().int().positive().optional(),
  newCustomerName: optionalText,
  newCustomerEmail: optionalText,
  newCustomerPhone: optionalText,
  operation: z.enum(OPERATION_IDS),
  title: z.string().trim().min(1, 'Add a short job title').max(200),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Pick a start time'),
  durationMinutes: z.coerce.number().int().min(15).max(24 * 60),
  address: optionalText,
  assignedTo: optionalText,
  truckId: z.coerce.number().int().positive().optional(),
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
  notifyCustomer: z.string().optional(),
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

async function saveItems(jobId: number, items: ReturnType<typeof parseItems>) {
  await db.delete(jobItems).where(eq(jobItems.jobId, jobId))
  if (items.length) await db.insert(jobItems).values(items.map((i) => ({ ...i, jobId })))
}

function parseJobForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries())
  for (const key of Object.keys(raw)) if (raw[key] === '') delete raw[key]
  return jobSchema.safeParse(raw)
}

export async function createJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  const parsed = parseJobForm(formData)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the form' }
  const data = parsed.data

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
      })
      .returning({ id: customers.id })
    customerId = created.id
  }

  const [job] = await db
    .insert(jobs)
    .values({
      customerId,
      operation: data.operation,
      title: data.title,
      scheduledDate: data.scheduledDate,
      startTime: data.startTime,
      durationMinutes: data.durationMinutes,
      address: data.address,
      assignedTo: data.assignedTo,
      truckId: data.truckId ?? null,
      priceCents: data.price,
      description: data.description,
      createdBy: admin.id,
    })
    .returning({ id: jobs.id })
  await saveItems(job.id, parseItems(formData))

  let sent = -1
  if (data.notifyCustomer === 'on') {
    const result = await sendJobMessage(job.id, 'confirmation')
    sent = result.sent
  }

  revalidatePath('/', 'layout')
  redirect(`/jobs/${job.id}?created=1${sent >= 0 ? `&sent=${sent}` : ''}`)
}

export async function updateJob(jobId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const parsed = parseJobForm(formData)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the form' }
  const data = parsed.data
  if (!data.customerId) return { ok: false, message: 'Pick a customer' }

  const [before] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1)
  if (!before) return { ok: false, message: 'Job not found' }
  const rescheduled = before.scheduledDate !== data.scheduledDate || before.startTime !== data.startTime

  await db
    .update(jobs)
    .set({
      customerId: data.customerId,
      operation: data.operation,
      title: data.title,
      scheduledDate: data.scheduledDate,
      startTime: data.startTime,
      durationMinutes: data.durationMinutes,
      address: data.address,
      assignedTo: data.assignedTo,
      truckId: data.truckId ?? null,
      priceCents: data.price,
      description: data.description,
      // A new date needs a new day-before reminder.
      ...(rescheduled ? { reminderSentAt: null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId))
  await saveItems(jobId, parseItems(formData))

  let sent = -1
  if (data.notifyCustomer === 'on') {
    const result = await sendJobMessage(jobId, 'confirmation')
    sent = result.sent
  }

  revalidatePath('/', 'layout')
  redirect(`/jobs/${jobId}?updated=1${sent >= 0 ? `&sent=${sent}` : ''}`)
}

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

export async function rescheduleJobTime(jobId: number, startTime: string, notifyCustomer: boolean): Promise<ActionState> {
  await requireAdmin()
  if (!Number.isInteger(jobId) || jobId <= 0) return { ok: false, message: 'Job not found' }
  const parsed = timeSchema.safeParse(startTime)
  if (!parsed.success) return { ok: false, message: 'Pick a valid time' }

  const [updated] = await db
    .update(jobs)
    // A new time needs a fresh day-before reminder.
    .set({ startTime: parsed.data, reminderSentAt: null, updatedAt: new Date() })
    .where(eq(jobs.id, jobId))
    .returning({ id: jobs.id })
  if (!updated) return { ok: false, message: 'Job not found' }

  let note = ''
  if (notifyCustomer === true) {
    const result = await sendJobMessage(jobId, 'confirmation')
    note = result.sent > 0 ? ' and customer notified' : ' (customer could not be notified)'
  }

  revalidatePath('/', 'layout')
  return { ok: true, message: `Time changed${note}` }
}

const statusSchema = z.enum(JOB_STATUSES.map((s) => s.id) as [string, ...string[]])

export async function updateJobStatus(jobId: number, status: string): Promise<ActionState> {
  await requireUser()
  const parsed = statusSchema.safeParse(status)
  if (!parsed.success) return { ok: false, message: 'Unknown status' }
  await db.update(jobs).set({ status: parsed.data, updatedAt: new Date() }).where(eq(jobs.id, jobId))
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Status updated' }
}

export async function setJobPaymentStatus(jobId: number, paid: boolean): Promise<ActionState> {
  await requireAdmin()
  await db
    .update(jobs)
    .set({ paymentStatus: paid ? 'paid' : 'unpaid', updatedAt: new Date() })
    .where(eq(jobs.id, jobId))
  revalidatePath('/', 'layout')
  return { ok: true, message: paid ? 'Marked as paid' : 'Marked as unpaid' }
}

export async function applyPaymentToJob(paymentId: number, jobId: number): Promise<ActionState> {
  await requireAdmin()
  await db.update(payments).set({ jobId }).where(eq(payments.id, paymentId))
  await db.update(jobs).set({ paymentStatus: 'paid', updatedAt: new Date() }).where(eq(jobs.id, jobId))
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Payment applied and job marked paid' }
}

export async function unlinkPayment(paymentId: number, jobId: number): Promise<ActionState> {
  await requireAdmin()
  await db.update(payments).set({ jobId: null }).where(and(eq(payments.id, paymentId), eq(payments.jobId, jobId)))
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Payment unlinked' }
}

export async function resendConfirmation(jobId: number): Promise<ActionState> {
  await requireAdmin()
  const result = await sendJobMessage(jobId, 'confirmation')
  revalidatePath(`/jobs/${jobId}`)
  if (result.sent === 0) {
    return { ok: false, message: result.errors[0] ?? 'Customer has no email or phone on file' }
  }
  return {
    ok: true,
    message: `Sent ${result.sent} message${result.sent === 1 ? '' : 's'}${result.failed ? `, ${result.failed} failed` : ''}`,
  }
}

export async function sendReminderNow(jobId: number): Promise<ActionState> {
  await requireAdmin()
  const result = await sendJobMessage(jobId, 'reminder')
  revalidatePath(`/jobs/${jobId}`)
  if (result.sent === 0) return { ok: false, message: result.errors[0] ?? 'Nothing was sent' }
  return { ok: true, message: `Reminder sent (${result.sent} message${result.sent === 1 ? '' : 's'})` }
}

export async function sendTomorrowRemindersNow(): Promise<ActionState> {
  await requireAdmin()
  const result = await sendTomorrowReminders({ onlyAtReminderHour: false })
  revalidatePath('/', 'layout')
  if (result.jobs === 0) return { ok: true, message: 'No jobs tomorrow still need a reminder' }
  return {
    ok: result.failed === 0,
    message: `Reminded ${result.jobs} job${result.jobs === 1 ? '' : 's'}: ${result.sent} sent, ${result.failed} failed`,
  }
}

export async function deleteJob(jobId: number) {
  await requireAdmin()
  await db.update(payments).set({ jobId: null }).where(eq(payments.jobId, jobId))
  await db.delete(jobItems).where(eq(jobItems.jobId, jobId))
  await db.delete(jobs).where(eq(jobs.id, jobId))
  revalidatePath('/', 'layout')
  redirect('/jobs')
}
