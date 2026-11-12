import { and, asc, desc, eq, gte, isNull, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { jobs, timeEntries, user } from '@/lib/db/schema'
import { addDays, formatClock, todayLocal, zonedToUtc } from '@/lib/time'

export async function getOpenEntry(userId: string) {
  const [open] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.clockOut)))
    .limit(1)
  return open ?? null
}

export async function getEntriesBetween(startDate: string, endDateExclusive: string, userId?: string) {
  const start = zonedToUtc(startDate, '00:00')
  const end = zonedToUtc(endDateExclusive, '00:00')
  const conditions = [gte(timeEntries.clockIn, start), lt(timeEntries.clockIn, end)]
  if (userId) conditions.push(eq(timeEntries.userId, userId))
  return db
    .select({
      id: timeEntries.id,
      userId: timeEntries.userId,
      userName: user.name,
      jobId: timeEntries.jobId,
      jobTitle: jobs.title,
      jobOperation: jobs.operation,
      clockIn: timeEntries.clockIn,
      clockOut: timeEntries.clockOut,
      notes: timeEntries.notes,
    })
    .from(timeEntries)
    .innerJoin(user, eq(timeEntries.userId, user.id))
    .leftJoin(jobs, eq(timeEntries.jobId, jobs.id))
    .where(and(...conditions))
    .orderBy(desc(timeEntries.clockIn))
}

export type EntryRow = Awaited<ReturnType<typeof getEntriesBetween>>[number]

export function entryDurationMs(e: { clockIn: Date; clockOut: Date | null }, now = Date.now()) {
  return (e.clockOut ? e.clockOut.getTime() : now) - e.clockIn.getTime()
}

export async function getTodayWorkedMs(userId: string) {
  const today = todayLocal()
  const entries = await getEntriesBetween(today, addDays(today, 1), userId)
  return entries.reduce((sum, e) => sum + entryDurationMs(e), 0)
}

export async function getClockedInNow() {
  return db
    .select({ userId: timeEntries.userId, name: user.name, clockIn: timeEntries.clockIn, jobTitle: jobs.title })
    .from(timeEntries)
    .innerJoin(user, eq(timeEntries.userId, user.id))
    .leftJoin(jobs, eq(timeEntries.jobId, jobs.id))
    .where(isNull(timeEntries.clockOut))
    .orderBy(asc(timeEntries.clockIn))
}

export function clockProps(open: Awaited<ReturnType<typeof getOpenEntry>>) {
  return open
    ? { clockInIso: open.clockIn.toISOString(), clockInLabel: formatClock(open.clockIn), jobId: open.jobId }
    : null
}
