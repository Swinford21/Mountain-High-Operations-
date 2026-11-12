import { createHmac, timingSafeEqual } from 'node:crypto'
import { and, eq, gte, inArray, isNotNull, sql, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { customers, jobs } from '@/lib/db/schema'
import { OPERATIONS } from '@/lib/operations'
import { addDays, todayLocal } from '@/lib/time'

export const AUDIENCES = [
  { id: 'all', label: 'All customers' },
  { id: 'recent', label: 'Had a job in the last 12 months' },
  ...OPERATIONS.map((o) => ({ id: `op:${o.id}`, label: `Past ${o.label.toLowerCase()} customers` })),
] as const

export function isValidAudience(id: string) {
  return AUDIENCES.some((a) => a.id === id)
}

function audienceCondition(audience: string): SQL | undefined {
  if (audience === 'recent') {
    const since = addDays(todayLocal(), -365)
    return inArray(
      customers.id,
      db.select({ id: jobs.customerId }).from(jobs).where(gte(jobs.scheduledDate, since)),
    )
  }
  if (audience.startsWith('op:')) {
    return inArray(
      customers.id,
      db.select({ id: jobs.customerId }).from(jobs).where(eq(jobs.operation, audience.slice(3))),
    )
  }
  return undefined
}

export async function getRecipients(audience: string, channel: 'email' | 'sms') {
  const base = audienceCondition(audience)
  const channelCondition =
    channel === 'email'
      ? and(eq(customers.emailOptIn, true), isNotNull(customers.email), sql`${customers.email} <> ''`)
      : and(eq(customers.smsOptIn, true), isNotNull(customers.phone), sql`${customers.phone} <> ''`)
  return db
    .select({ id: customers.id, name: customers.name, email: customers.email, phone: customers.phone })
    .from(customers)
    .where(base ? and(base, channelCondition) : channelCondition)
}

export async function getAudienceCounts() {
  const entries = await Promise.all(
    AUDIENCES.map(async (a) => {
      const [email, sms] = await Promise.all([getRecipients(a.id, 'email'), getRecipients(a.id, 'sms')])
      return [a.id, { email: email.length, sms: sms.length }] as const
    }),
  )
  return Object.fromEntries(entries) as Record<string, { email: number; sms: number }>
}

export function personalize(template: string, name: string) {
  const first = name.trim().split(/\s+/)[0] || 'there'
  return template.replace(/\{\{\s*first_name\s*\}\}/gi, first).replace(/\{\{\s*name\s*\}\}/gi, name)
}

function secret() {
  const s = process.env.BETTER_AUTH_SECRET
  if (!s) throw new Error('BETTER_AUTH_SECRET is required for unsubscribe links')
  return s
}

export function unsubscribeToken(customerId: number) {
  return createHmac('sha256', secret()).update(`unsubscribe:${customerId}`).digest('base64url').slice(0, 32)
}

export function verifyUnsubscribeToken(customerId: number, token: string) {
  const expected = Buffer.from(unsubscribeToken(customerId))
  const given = Buffer.from(token)
  return expected.length === given.length && timingSafeEqual(expected, given)
}
