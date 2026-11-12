import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { customers, jobItems, jobs } from '@/lib/db/schema'
import { getOperation } from '@/lib/operations'
import { BUSINESS_NAME, BUSINESS_PHONE, emailLayout, isValidEmail, logMessage, sendEmail, sendSms } from '@/lib/notify'
import { addDays, formatDateLong, formatTime12, zonedNow } from '@/lib/time'

type Kind = 'confirmation' | 'reminder'

async function loadJob(jobId: number) {
  const [row] = await db
    .select({ job: jobs, customer: customers })
    .from(jobs)
    .innerJoin(customers, eq(jobs.customerId, customers.id))
    .where(eq(jobs.id, jobId))
    .limit(1)
  return row ?? null
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name
}

function buildMessages(kind: Kind, job: typeof jobs.$inferSelect, customer: typeof customers.$inferSelect) {
  const op = getOperation(job.operation)
  const when = `${formatDateLong(job.scheduledDate)} at ${formatTime12(job.startTime)}`
  const name = firstName(customer.name)
  const address = job.address || customer.address || ''

  if (kind === 'confirmation') {
    return {
      subject: `Your ${op.singular.toLowerCase()} is scheduled for ${formatDateLong(job.scheduledDate)}`,
      sms: `Hi ${name}, this is ${BUSINESS_NAME}. Your ${op.singular.toLowerCase()} is confirmed for ${when}${address ? ` at ${address}` : ''}. Questions? Call ${BUSINESS_PHONE}.`,
      heading: `You're on the schedule, ${name}`,
      intro: `Thanks for choosing ${BUSINESS_NAME}. Here are the details for your upcoming ${op.singular.toLowerCase()}.`,
    }
  }
  return {
    subject: `Reminder: your ${op.singular.toLowerCase()} is tomorrow`,
    sms: `Reminder from ${BUSINESS_NAME}: your ${op.singular.toLowerCase()} is tomorrow, ${when}${address ? ` at ${address}` : ''}. Please make sure we have clear access. Need to reschedule? Call ${BUSINESS_PHONE}.`,
    heading: `See you tomorrow, ${name}`,
    intro: `Just a reminder that your ${op.singular.toLowerCase()} with ${BUSINESS_NAME} is scheduled for tomorrow. Please make sure gates are unlocked and the work area is accessible.`,
  }
}

/** Sends the confirmation or reminder email + text for a job. Returns how many messages went out. */
export async function sendJobMessage(jobId: number, kind: Kind) {
  const row = await loadJob(jobId)
  if (!row) return { sent: 0, failed: 0, errors: ['Job not found'] }
  const { job, customer } = row
  const msg = buildMessages(kind, job, customer)
  const op = getOperation(job.operation)

  let sent = 0
  let failed = 0
  const errors: string[] = []

  if (isValidEmail(customer.email)) {
    const rows: [string, string][] = [
      ['Service', op.singular],
      ['Date', formatDateLong(job.scheduledDate)],
      ['Time', formatTime12(job.startTime)],
    ]
    const address = job.address || customer.address
    if (address) rows.push(['Address', address])
    const items = await db.select().from(jobItems).where(eq(jobItems.jobId, jobId))
    if (items.length) {
      rows.push(['Materials', items.map((i) => `${Number(i.quantity)} ${i.unit} ${i.name}`).join(', ')])
    }
    const result = await sendEmail({
      to: customer.email.trim(),
      subject: msg.subject,
      html: emailLayout({
        heading: msg.heading,
        paragraphs: [msg.intro, ...(job.description ? [job.description] : [])],
        rows,
        footer: `${BUSINESS_NAME} — reply to this email if you need to make a change.`,
      }),
      text: `${msg.intro}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}`,
    })
    await logMessage({ customerId: customer.id, jobId, channel: 'email', kind, recipient: customer.email, result })
    if (result.ok) sent++
    else {
      failed++
      errors.push(`Email: ${result.error}`)
    }
  }

  if (customer.phone) {
    const result = await sendSms({ to: customer.phone, body: msg.sms })
    await logMessage({ customerId: customer.id, jobId, channel: 'sms', kind, recipient: customer.phone, result })
    if (result.ok) sent++
    else {
      failed++
      errors.push(`Text: ${result.error}`)
    }
  }

  if (sent > 0) {
    await db
      .update(jobs)
      .set(kind === 'confirmation' ? { confirmationSentAt: new Date() } : { reminderSentAt: new Date() })
      .where(eq(jobs.id, jobId))
  }

  return { sent, failed, errors }
}

/**
 * Sends day-before reminders for every scheduled job tomorrow that hasn't had one.
 * When `onlyAtReminderHour` is set, it does nothing unless it is 4pm in the business time zone.
 */
export async function sendTomorrowReminders({ onlyAtReminderHour }: { onlyAtReminderHour: boolean }) {
  const now = zonedNow()
  if (onlyAtReminderHour && now.hour !== 16) {
    return { skipped: true as const, localHour: now.hour, jobs: 0, sent: 0, failed: 0 }
  }
  const tomorrow = addDays(now.date, 1)
  const due = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.scheduledDate, tomorrow), eq(jobs.status, 'scheduled'), isNull(jobs.reminderSentAt)))

  let sent = 0
  let failed = 0
  for (const { id } of due) {
    const result = await sendJobMessage(id, 'reminder')
    sent += result.sent
    failed += result.failed
  }
  return { skipped: false as const, localHour: now.hour, date: tomorrow, jobs: due.length, sent, failed }
}
