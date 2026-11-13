import { createHmac, timingSafeEqual } from 'node:crypto'
import { and, eq, gte, inArray, isNotNull, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { customers, jobs } from '@/lib/db/schema'
import { getOperations } from '@/lib/operations-server'
import { addDays, todayLocal } from '@/lib/time'

export const LOCATIONS = ['Marietta', 'Smyrna'] as const

export async function getAudiences(): Promise<{ id: string; label: string }[]> {
  const operations = await getOperations()
  return [
    { id: 'all', label: 'All customers' },
    { id: 'recent', label: 'Had a job in the last 12 months' },
    ...LOCATIONS.map((l) => ({ id: `loc:${l}`, label: `${l} yard customers` })),
    ...operations.map((o) => ({ id: `op:${o.id}`, label: `${o.label} customers` })),
  ]
}

export async function isValidAudience(id: string) {
  return (await getAudiences()).some((a) => a.id === id)
}

function audienceCondition(audience: string): SQL | undefined {
  if (audience === 'recent') {
    const since = addDays(todayLocal(), -365)
    return inArray(customers.id, db.select({ id: jobs.customerId }).from(jobs).where(gte(jobs.scheduledDate, since)))
  }
  if (audience.startsWith('loc:')) return eq(customers.location, audience.slice(4))
  if (audience.startsWith('op:')) {
    const op = audience.slice(3)
    // Imported customers carry their usual operation; scheduled jobs add to it.
    return or(
      eq(customers.primaryOperation, op),
      inArray(customers.id, db.select({ id: jobs.customerId }).from(jobs).where(eq(jobs.operation, op))),
    )
  }
  return undefined
}

function channelCondition(channel: 'email' | 'sms') {
  return channel === 'email'
    ? and(eq(customers.emailOptIn, true), isNotNull(customers.email), sql`${customers.email} <> ''`)
    : and(eq(customers.smsOptIn, true), isNotNull(customers.phone), sql`${customers.phone} <> ''`)
}

export async function getRecipients(audience: string, channel: 'email' | 'sms') {
  const base = audienceCondition(audience)
  const ch = channelCondition(channel)
  return db
    .select({ id: customers.id, name: customers.name, email: customers.email, phone: customers.phone })
    .from(customers)
    .where(base ? and(base, ch) : ch)
}

export async function getAudienceCounts(audiences: { id: string }[]) {
  const entries = await Promise.all(
    audiences.map(async (a) => {
      const base = audienceCondition(a.id)
      const [row] = await db
        .select({
          email: sql<number>`count(*) filter (where ${channelCondition('email')})::int`,
          sms: sql<number>`count(*) filter (where ${channelCondition('sms')})::int`,
        })
        .from(customers)
        .where(base)
      return [a.id, row] as const
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
