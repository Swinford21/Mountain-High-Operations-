import { Resend } from 'resend'
import twilio from 'twilio'
import { db } from '@/lib/db'
import { messageLog } from '@/lib/db/schema'

export const BUSINESS_NAME = 'Mountain High Landscape Supply'
export const BUSINESS_PHONE = '678-335-2565'
export const BUSINESS_ADDRESS = '1389 Church Street Extension NW, Marietta, GA 30060'

/**
 * Email clients and Twilio fetch images by absolute URL, so the logo must point at the
 * public production domain rather than whatever host handled the request (cron jobs have none).
 */
export const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://www.mountainhighops.com').replace(/\/$/, '')
export const EMAIL_LOGO_URL = `${PUBLIC_SITE_URL}/images/logo-email.jpg`
export const SMS_LOGO_URL = `${PUBLIC_SITE_URL}/images/logo-mms.jpg`

type SendResult = { ok: true } | { ok: false; error: string }

let resendClient: Resend | null = null
function getResend() {
  if (!process.env.RESEND_API_KEY) return null
  resendClient ??= new Resend(process.env.RESEND_API_KEY)
  return resendClient
}

let twilioClient: ReturnType<typeof twilio> | null = null
function getTwilio() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null
  twilioClient ??= twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  return twilioClient
}

/** Normalizes US phone numbers to E.164 (+1XXXXXXXXXX). Returns null when unusable. */
export function toE164(phone: string | null | undefined) {
  if (!phone) return null
  const trimmed = phone.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (trimmed.startsWith('+') && digits.length >= 10) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

export function isValidEmail(email: string | null | undefined): email is string {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/** Every customer email is blind-copied here so the office has a record of what went out. */
export const EMAIL_BCC = 'eric@mountainhighmulch.com'

export async function sendEmail(input: {
  to: string | string[]
  subject: string
  html: string
  text: string
  /** Marketing sends pass false so the office copy only covers customer job emails. */
  bcc?: boolean
  replyTo?: string
}): Promise<SendResult> {
  const resend = getResend()
  if (!resend || !process.env.EMAIL_FROM) return { ok: false, error: 'Email is not configured' }
  const recipients = (Array.isArray(input.to) ? input.to : [input.to]).map((r) => r.trim().toLowerCase())
  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: input.to,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      ...(input.bcc === false || recipients.includes(EMAIL_BCC) ? {} : { bcc: EMAIL_BCC }),
      subject: input.subject,
      html: input.html,
      text: input.text,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Email failed' }
  }
}

/** Sends up to 100 emails in one Resend request. Returns a result per message, in order. */
export async function sendEmailBatch(
  messages: { to: string; subject: string; html: string; text: string; headers?: Record<string, string> }[],
): Promise<SendResult[]> {
  const resend = getResend()
  const from = process.env.EMAIL_FROM
  if (!resend || !from) return messages.map(() => ({ ok: false, error: 'Email is not configured' }))
  try {
    const { error } = await resend.batch.send(messages.map((m) => ({ from, ...m })))
    if (error) return messages.map(() => ({ ok: false, error: error.message }))
    return messages.map(() => ({ ok: true }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Email failed'
    return messages.map(() => ({ ok: false, error: message }))
  }
}

/** Texts go out as MMS with the logo attached. Pass `logo: false` to send a plain SMS. */
export async function sendSms(input: { to: string; body: string; logo?: boolean }): Promise<SendResult> {
  const client = getTwilio()
  const from = process.env.TWILIO_PHONE_NUMBER
  if (!client || !from) return { ok: false, error: 'Texting is not configured' }
  const to = toE164(input.to)
  if (!to) return { ok: false, error: 'Invalid phone number' }
  try {
    await client.messages.create({
      to,
      from: toE164(from) ?? from,
      body: input.body,
      ...(input.logo === false ? {} : { mediaUrl: [SMS_LOGO_URL] }),
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Text failed' }
  }
}

export async function logMessage(entry: {
  customerId?: number | null
  jobId?: number | null
  campaignId?: number | null
  channel: 'email' | 'sms'
  kind: 'confirmation' | 'reminder' | 'campaign' | 'estimate' | 'estimate-approved' | 'payment link'
  recipient: string
  result: SendResult
}) {
  await db.insert(messageLog).values({
    customerId: entry.customerId ?? null,
    jobId: entry.jobId ?? null,
    campaignId: entry.campaignId ?? null,
    channel: entry.channel,
    kind: entry.kind,
    recipient: entry.recipient,
    status: entry.result.ok ? 'sent' : 'failed',
    error: entry.result.ok ? null : entry.result.error,
  })
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Wraps plain text paragraphs in a simple branded email layout. */
export function emailLayout(opts: {
  heading: string
  paragraphs: string[]
  rows?: [string, string][]
  footer?: string
  cta?: { label: string; href: string }
}) {
  const cta = opts.cta
    ? `<p style="margin:8px 0 20px"><a href="${escapeHtml(opts.cta.href)}" style="display:inline-block;background:#0d2547;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:6px">${escapeHtml(opts.cta.label)}</a></p>`
    : ''
  const rows = (opts.rows ?? [])
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#4f5f7a;width:120px;vertical-align:top">${escapeHtml(k)}</td><td style="padding:6px 0;color:#0d2547;font-weight:600">${escapeHtml(v)}</td></tr>`,
    )
    .join('')
  const paragraphs = opts.paragraphs
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55;color:#0d2547">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('')
  return `<!doctype html><html><body style="margin:0;background:#fbf6e4;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #ece3c3">
<tr><td align="center" style="background:#0d2547;padding:20px 24px;border-bottom:4px solid #fca94c"><img src="${EMAIL_LOGO_URL}" width="96" height="128" alt="${BUSINESS_NAME}" style="display:block;width:96px;height:128px;border:0;outline:none;text-decoration:none;color:#fbbd1e;font-weight:700;font-size:14px" /></td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 16px;font-size:20px;color:#0d2547">${escapeHtml(opts.heading)}</h1>
${paragraphs}
${rows ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;font-size:14px">${rows}</table>` : ''}
${cta}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #efe7cc;color:#5d6a80;font-size:12px;line-height:1.5">${opts.footer ?? BUSINESS_NAME}<br/>${BUSINESS_ADDRESS} · ${BUSINESS_PHONE}</td></tr>
</table></td></tr></table></body></html>`
}
