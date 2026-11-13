'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { jobNotes, jobs } from '@/lib/db/schema'
import { isAdminRole, requireAdmin, requireUser } from '@/lib/session'
import type { ActionState } from '@/app/actions/jobs'

const noteSchema = z.object({
  jobId: z.coerce.number().int().positive(),
  body: z.string().trim().min(1, 'Write a note first').max(4000, 'Keep notes under 4,000 characters'),
})

async function addNote(formData: FormData, authorId: string, visibility: 'crew' | 'admin'): Promise<ActionState> {
  const parsed = noteSchema.safeParse({ jobId: formData.get('targetId'), body: formData.get('body') })
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the note' }
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, parsed.data.jobId)).limit(1)
  if (!job) return { ok: false, message: 'Job not found' }
  await db.insert(jobNotes).values({ jobId: job.id, authorId, body: parsed.data.body, visibility })
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Note added' }
}

/** Crew notes: any team member can read and add them. */
export async function addCrewNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireUser()
  return addNote(formData, me.id, 'crew')
}

/** Admin notes: only admins can read or add them. */
export async function addAdminNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireAdmin()
  return addNote(formData, me.id, 'admin')
}

export async function deleteJobNote(noteId: number): Promise<ActionState> {
  const me = await requireUser()
  if (!Number.isInteger(noteId)) return { ok: false, message: 'Invalid note' }
  const [note] = await db.select().from(jobNotes).where(eq(jobNotes.id, noteId)).limit(1)
  if (!note) return { ok: false, message: 'Note not found' }
  const isAdmin = isAdminRole(me.role)
  if (note.visibility === 'admin' ? !isAdmin : !isAdmin && note.authorId !== me.id) {
    return { ok: false, message: 'You can only delete your own notes' }
  }
  await db.delete(jobNotes).where(eq(jobNotes.id, noteId))
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Note deleted' }
}
