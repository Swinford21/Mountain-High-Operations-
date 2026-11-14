'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { jobs, payments } from '@/lib/db/schema'
import { BUSINESS_NAME, emailLayout, isValidEmail, logMessage, sendEmail, sendSms } from '@/lib/notify'
import { getJobDetail } from '@/lib/queries'
import { requireAdmin } from '@/lib/session'
import {
  chargeCard,
  createPaymentLink,
  getSquareLocations,
  isSquareConfigured,
  jobCollectedCents,
  squareErrorMessage,
  syncSquarePayments,
} from '@/lib/square'
import { formatMoney } from '@/lib/time'

type PaymentResult = { ok: boolean; message: string; receiptUrl?: string | null; url?: string }

const MAX_CENTS_WITHOUT_PRICE = 5_000_000

const baseSchema = z.object({
  jobId: z.number().int().positive(),
  amountCents: z.number().int('Enter a whole cent amount').min(100, 'Minimum charge is $1.00'),
  locationId: z.string().min(1).max(64),
  idempotencyKey: z.string().uuid(),
})

/** Loads the job and checks the amount against its unpaid balance. */
async function prepare(input: z.infer<typeof baseSchema>) {
  if (!isSquareConfigured()) return { error: 'Square is not connected' as const }
  const detail = await getJobDetail(input.jobId)
  if (!detail) return { error: 'Job not found' as const }
  const locations = await getSquareLocations()
  if (!locations.some((l) => l.id === input.locationId)) return { error: 'Pick a Square location' as const }

  const collected = await jobCollectedCents(input.jobId)
  const price = detail.job.priceCents
  if (price != null) {
    const balance = price - collected
    if (balance <= 0) return { error: 'This job is already paid in full' as const }
    if (input.amountCents > balance) return { error: `Amount is more than the ${formatMoney(balance)} balance` as const }
  } else if (input.amountCents > MAX_CENTS_WITHOUT_PRICE) {
    return { error: 'Amount is too large — set a job price first' as const }
  }
  return { error: null, detail, collected, price }
}

const cardSchema = baseSchema.extend({ sourceId: z.string().min(1).max(512) })

export async function chargeJobCard(raw: z.input<typeof cardSchema>): Promise<PaymentResult> {
  await requireAdmin()
  const parsed = cardSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the payment details' }
  const input = parsed.data
  const ready = await prepare(input)
  if (ready.error !== null) return { ok: false, message: ready.error }
  const { detail, collected, price } = ready

  let charged: Awaited<ReturnType<typeof chargeCard>>
  try {
    charged = await chargeCard({
      sourceId: input.sourceId,
      idempotencyKey: input.idempotencyKey,
      amountCents: input.amountCents,
      locationId: input.locationId,
      jobId: input.jobId,
      squareCustomerId: detail.customer.squareCustomerId,
      buyerEmail: isValidEmail(detail.customer.email) ? detail.customer.email : null,
      note: `${detail.job.title} · Job #${input.jobId} · ${detail.customer.name}`,
    })
  } catch (e) {
    return { ok: false, message: squareErrorMessage(e, 'Square could not process the card') }
  }

  await db
    .insert(payments)
    .values({
      squarePaymentId: charged.squarePaymentId,
      squareOrderId: charged.squareOrderId,
      squareCustomerId: detail.customer.squareCustomerId,
      customerId: detail.customer.id,
      jobId: input.jobId,
      amountCents: charged.amountCents,
      status: charged.status,
      note: `Job #${input.jobId}`,
      receiptUrl: charged.receiptUrl,
      paidAt: charged.paidAt,
    })
    .onConflictDoNothing({ target: payments.squarePaymentId })

  const completed = charged.status === 'COMPLETED'
  const paidInFull = completed && (price == null || collected + charged.amountCents >= price)
  if (paidInFull) {
    await db.update(jobs).set({ paymentStatus: 'paid', updatedAt: new Date() }).where(eq(jobs.id, input.jobId))
  }

  revalidatePath('/', 'layout')
  if (!completed) return { ok: false, message: `Square marked the payment ${charged.status.toLowerCase()}` }
  return {
    ok: true,
    message: `Charged ${formatMoney(charged.amountCents)}${paidInFull ? ' — job marked paid' : ''}`,
    receiptUrl: charged.receiptUrl,
  }
}

const linkSchema = baseSchema.extend({ send: z.boolean() })

export async function createJobPaymentLink(raw: z.input<typeof linkSchema>): Promise<PaymentResult> {
  await requireAdmin()
  const parsed = linkSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the payment details' }
  const input = parsed.data
  const ready = await prepare(input)
  if (ready.error !== null) return { ok: false, message: ready.error }
  const { detail } = ready
  const { customer, job } = detail

  let link: Awaited<ReturnType<typeof createPaymentLink>>
  try {
    link = await createPaymentLink({
      idempotencyKey: input.idempotencyKey,
      amountCents: input.amountCents,
      locationId: input.locationId,
      title: job.title,
      jobId: job.id,
      buyerEmail: isValidEmail(customer.email) ? customer.email : null,
      buyerPhone: customer.phone,
    })
  } catch (e) {
    return { ok: false, message: squareErrorMessage(e, 'Square could not create the payment link') }
  }

  await db
    .update(jobs)
    .set({ paymentLinkUrl: link.url, paymentLinkOrderId: link.orderId, updatedAt: new Date() })
    .where(eq(jobs.id, job.id))

  let sent = 0
  if (input.send) {
    const amount = formatMoney(input.amountCents)
    if (customer.phone && customer.smsOptIn) {
      const result = await sendSms({
        to: customer.phone,
        body: `${BUSINESS_NAME}: Here is your secure payment link for ${amount} (${job.title}): ${link.url}`,
        logo: false,
      })
      await logMessage({ customerId: customer.id, jobId: job.id, channel: 'sms', kind: 'payment link', recipient: customer.phone, result })
      if (result.ok) sent++
    }
    if (isValidEmail(customer.email)) {
      const paragraphs = [
        `Hi ${customer.name},`,
        `You can pay ${amount} for ${job.title} securely through Square using the button below.`,
      ]
      const result = await sendEmail({
        to: customer.email,
        subject: `Payment link for ${job.title} — ${amount}`,
        html: emailLayout({ heading: 'Your payment link', paragraphs, cta: { label: `Pay ${amount}`, href: link.url } }),
        text: `${paragraphs.join('\n\n')}\n\n${link.url}`,
      })
      await logMessage({ customerId: customer.id, jobId: job.id, channel: 'email', kind: 'payment link', recipient: customer.email, result })
      if (result.ok) sent++
    }
  }

  revalidatePath(`/jobs/${job.id}`)
  return {
    ok: true,
    url: link.url,
    message: !input.send
      ? 'Payment link created'
      : sent > 0
        ? `Payment link sent (${sent} message${sent === 1 ? '' : 's'})`
        : 'Link created, but nothing was sent — check the customer’s phone/email and opt-ins',
  }
}

/** Pulls the latest Square payments so pay-link payments land on their job. */
export async function refreshJobPayments(jobId: number): Promise<PaymentResult> {
  await requireAdmin()
  if (!isSquareConfigured()) return { ok: false, message: 'Square is not connected' }
  try {
    await syncSquarePayments()
  } catch (e) {
    return { ok: false, message: squareErrorMessage(e, 'Could not reach Square') }
  }
  revalidatePath('/', 'layout')
  const collected = await jobCollectedCents(jobId)
  return { ok: true, message: collected > 0 ? `${formatMoney(collected)} collected on this job` : 'No payment yet' }
}
