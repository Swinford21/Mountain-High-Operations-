'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { jobNotes, jobs } from '@/lib/db/schema'
import { requireUser } from '@/lib/session'
import type { ActionState } from '@/app/actions/jobs'

const noteSchema = z.object({
  jobId: z.coerce.number().int().positive(),
  body: z.string().trim().min(1, 'Write a note first').max(4000, 'Keep notes under 4,000 characters'),
})

export async function addJobNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireUser()
  const parsed = noteSchema.safeParse({ jobId: formData.get('jobId'), body: formData.get('body') })
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the note' }
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, parsed.data.jobId)).limit(1)
  if (!job) return { ok: false, message: 'Job not found' }
  await db.insert(jobNotes).values({ jobId: job.id, authorId: me.id, body: parsed.data.body })
  revalidatePath(`/jobs/${job.id}`)
  return { ok: true, message: 'Note added' }
}

export async function deleteJobNote(noteId: number): Promise<ActionState> {
  const me = await requireUser()
  if (!Number.isInteger(noteId)) return { ok: false, message: 'Invalid note' }
  const [note] = await db.select().from(jobNotes).where(eq(jobNotes.id, noteId)).limit(1)
  if (!note) return { ok: false, message: 'Note not found' }
  if (note.authorId !== me.id && me.role !== 'admin') return { ok: false, message: 'You can only delete your own notes' }
  await db.delete(jobNotes).where(eq(jobNotes.id, noteId))
  revalidatePath(`/jobs/${note.jobId}`)
  return { ok: true, message: 'Note deleted' }
}
