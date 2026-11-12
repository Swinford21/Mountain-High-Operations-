'use server'

import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { campaigns, customers, messageLog } from '@/lib/db/schema'
import {
  getRecipients,
  isValidAudience,
  personalize,
  unsubscribeToken,
  verifyUnsubscribeToken,
} from '@/lib/marketing'
import { BUSINESS_NAME, emailLayout, isValidEmail, sendEmail, sendEmailBatch, sendSms } from '@/lib/notify'
import { requireAdmin } from '@/lib/session'
import type { ActionState } from '@/app/actions/jobs'

const SMS_FOOTER = ' Reply STOP to opt out.'

const campaignSchema = z
  .object({
    name: z.string().trim().min(1, 'Give the campaign a name').max(120),
    channel: z.enum(['email', 'sms', 'both']),
    audience: z.string().refine(isValidAudience, 'Pick an audience'),
    subject: z.string().trim().max(200).optional(),
    body: z.string().trim().min(1, 'Write a message').max(5000),
  })
  .refine((d) => d.channel === 'sms' || !!d.subject, { message: 'Emails need a subject line', path: ['subject'] })
  .refine((d) => d.channel === 'email' || d.body.length + SMS_FOOTER.length + 20 <= 480, {
    message: 'Text messages must be under about 460 characters',
    path: ['body'],
  })

async function siteOrigin() {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return host ? `${proto}://${host}` : ''
}

function buildEmail(body: string, subject: string, name: string, unsubscribeUrl: string) {
  const text = personalize(body, name)
  return {
    subject: personalize(subject, name),
    html: emailLayout({
      heading: personalize(subject, name),
      paragraphs: text.split(/\n{2,}/),
      footer: `You're receiving this because you're a ${BUSINESS_NAME} customer. <a href="${unsubscribeUrl}" style="color:#5d6a80">Unsubscribe</a>`,
    }),
    text: `${text}\n\nUnsubscribe: ${unsubscribeUrl}`,
  }
}

export async function sendTestCampaign(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireAdmin()
  const parsed = campaignSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the form' }
  const d = parsed.data
  if (d.channel === 'sms') return { ok: false, message: 'Test sends go to your email. Switch to Email or Both to test.' }
  const origin = await siteOrigin()
  const msg = buildEmail(d.body, `[Test] ${d.subject}`, me.name, `${origin}/unsubscribe`)
  const r = await sendEmail({ to: me.email, ...msg, bcc: false })
  return r.ok ? { ok: true, message: `Test email sent to ${me.email}` } : { ok: false, message: r.error }
}

export async function sendCampaign(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireAdmin()
  const parsed = campaignSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the form' }
  const d = parsed.data
  const origin = await siteOrigin()

  const [campaign] = await db
    .insert(campaigns)
    .values({
      name: d.name,
      channel: d.channel,
      subject: d.subject ?? null,
      body: d.body,
      audience: d.audience,
      status: 'sending',
      createdBy: me.id,
    })
    .returning({ id: campaigns.id })

  let sent = 0
  let failed = 0
  const logs: (typeof messageLog.$inferInsert)[] = []

  if (d.channel !== 'sms') {
    const recipients = (await getRecipients(d.audience, 'email')).filter((r) => isValidEmail(r.email))
    for (let i = 0; i < recipients.length; i += 100) {
      const chunk = recipients.slice(i, i + 100)
      const messages = chunk.map((r) => {
        const url = `${origin}/unsubscribe?c=${r.id}&t=${unsubscribeToken(r.id)}`
        return {
          to: r.email!.trim(),
          ...buildEmail(d.body, d.subject!, r.name, url),
          headers: { 'List-Unsubscribe': `<${url}>` },
        }
      })
      const results = await sendEmailBatch(messages)
      results.forEach((res, j) => {
        if (res.ok) sent++
        else failed++
        logs.push({
          customerId: chunk[j].id,
          campaignId: campaign.id,
          channel: 'email',
          kind: 'campaign',
          recipient: chunk[j].email!,
          status: res.ok ? 'sent' : 'failed',
          error: res.ok ? null : res.error,
        })
      })
      // Stay under Resend's default rate limit between batches.
      if (i + 100 < recipients.length) await new Promise((r) => setTimeout(r, 600))
    }
  }

  if (d.channel !== 'email') {
    const recipients = await getRecipients(d.audience, 'sms')
    const CONCURRENCY = 5
    for (let i = 0; i < recipients.length; i += CONCURRENCY) {
      const chunk = recipients.slice(i, i + CONCURRENCY)
      const results = await Promise.all(
        chunk.map((r) => sendSms({ to: r.phone!, body: `${BUSINESS_NAME}: ${personalize(d.body, r.name)}${SMS_FOOTER}` })),
      )
      results.forEach((res, j) => {
        if (res.ok) sent++
        else failed++
        logs.push({
          customerId: chunk[j].id,
          campaignId: campaign.id,
          channel: 'sms',
          kind: 'campaign',
          recipient: chunk[j].phone!,
          status: res.ok ? 'sent' : 'failed',
          error: res.ok ? null : res.error,
        })
      })
    }
  }

  for (let i = 0; i < logs.length; i += 500) await db.insert(messageLog).values(logs.slice(i, i + 500))
  await db
    .update(campaigns)
    .set({ status: 'sent', recipientsCount: sent, failedCount: failed, sentAt: new Date() })
    .where(eq(campaigns.id, campaign.id))

  revalidatePath('/marketing')
  if (sent + failed === 0) return { ok: false, message: 'No opted-in customers in that audience' }
  return {
    ok: failed === 0,
    message: `Campaign sent to ${sent} recipient${sent === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}`,
  }
}

export async function unsubscribe(customerId: number, token: string, channel: 'email' | 'all'): Promise<ActionState> {
  if (!Number.isInteger(customerId) || !verifyUnsubscribeToken(customerId, token)) {
    return { ok: false, message: 'This unsubscribe link is invalid.' }
  }
  await db
    .update(customers)
    .set(channel === 'all' ? { emailOptIn: false, smsOptIn: false } : { emailOptIn: false })
    .where(eq(customers.id, customerId))
  return {
    ok: true,
    message:
      channel === 'all'
        ? "You won't receive any more marketing emails or texts from us."
        : "You won't receive any more marketing emails from us.",
  }
}
