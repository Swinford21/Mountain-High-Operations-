'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { timeEntries } from '@/lib/db/schema'
import { requireAdmin, requireUser } from '@/lib/session'
import { zonedToUtc } from '@/lib/time'
import type { ActionState } from '@/app/actions/jobs'

export async function clockIn(jobId: number | null, notes?: string): Promise<ActionState> {
  const user = await requireUser()
  const [open] = await db
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, user.id), isNull(timeEntries.clockOut)))
    .limit(1)
  if (open) return { ok: false, message: 'You are already clocked in' }

  await db.insert(timeEntries).values({
    userId: user.id,
    jobId: jobId ?? null,
    notes: notes?.trim().slice(0, 500) || null,
  })
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Clocked in' }
}

export async function clockOut(notes?: string): Promise<ActionState> {
  const user = await requireUser()
  const [open] = await db
    .select({ id: timeEntries.id, notes: timeEntries.notes })
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, user.id), isNull(timeEntries.clockOut)))
    .limit(1)
  if (!open) return { ok: false, message: 'You are not clocked in' }

  const extra = notes?.trim().slice(0, 500)
  await db
    .update(timeEntries)
    .set({
      clockOut: new Date(),
      ...(extra ? { notes: [open.notes, extra].filter(Boolean).join(' — ') } : {}),
    })
    .where(and(eq(timeEntries.id, open.id), eq(timeEntries.userId, user.id)))
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Clocked out' }
}

/** Switch the job you're on without clocking out for the day. */
export async function switchJob(jobId: number | null): Promise<ActionState> {
  const user = await requireUser()
  const [open] = await db
    .select({ id: timeEntries.id, jobId: timeEntries.jobId })
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, user.id), isNull(timeEntries.clockOut)))
    .limit(1)
  if (!open) return { ok: false, message: 'You are not clocked in' }
  if (open.jobId === jobId) return { ok: true, message: 'Already on that job' }

  const now = new Date()
  await db.update(timeEntries).set({ clockOut: now }).where(eq(timeEntries.id, open.id))
  await db.insert(timeEntries).values({ userId: user.id, jobId, clockIn: now })
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Switched jobs' }
}

const editSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clockIn: z.string().regex(/^\d{2}:\d{2}$/),
  clockOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  clockOut: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  notes: z.string().max(500).optional(),
})

export async function adminUpdateEntry(entryId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const parsed = editSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { ok: false, message: 'Check the times' }
  const d = parsed.data
  const inAt = zonedToUtc(d.date, d.clockIn)
  const outAt = d.clockOut ? zonedToUtc(d.clockOutDate || d.date, d.clockOut) : null
  if (outAt && outAt <= inAt) return { ok: false, message: 'Clock out must be after clock in' }

  await db
    .update(timeEntries)
    .set({ clockIn: inAt, clockOut: outAt, notes: d.notes?.trim() || null })
    .where(eq(timeEntries.id, entryId))
  revalidatePath('/time')
  return { ok: true, message: 'Entry updated' }
}

export async function adminDeleteEntry(entryId: number): Promise<ActionState> {
  await requireAdmin()
  await db.delete(timeEntries).where(eq(timeEntries.id, entryId))
  revalidatePath('/time')
  return { ok: true, message: 'Entry deleted' }
}
