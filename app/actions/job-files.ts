'use server'

import { del, head } from '@vercel/blob'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { jobFiles, jobs } from '@/lib/db/schema'
import { JOB_FILE_TYPES, jobFilePrefix } from '@/lib/job-files'
import { isAdminRole, requireUser } from '@/lib/session'
import type { ActionState } from '@/app/actions/jobs'

const uploadedSchema = z
  .array(
    z.object({
      pathname: z.string().min(1).max(500),
      filename: z.string().trim().min(1).max(255),
    }),
  )
  .min(1)
  .max(20)

/** Records files the browser just uploaded to Blob. Size and type come from Blob itself, not the client. */
export async function recordJobFiles(jobId: number, uploaded: { pathname: string; filename: string }[]): Promise<ActionState> {
  const me = await requireUser()
  const parsed = uploadedSchema.safeParse(uploaded)
  if (!parsed.success || !Number.isInteger(jobId)) return { ok: false, message: 'Nothing to save' }
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, jobId)).limit(1)
  if (!job) return { ok: false, message: 'Job not found' }

  const rows = []
  for (const f of parsed.data) {
    if (!f.pathname.startsWith(jobFilePrefix(jobId)) || f.pathname.includes('..')) continue
    try {
      const meta = await head(f.pathname)
      if (!JOB_FILE_TYPES.includes(meta.contentType)) continue
      rows.push({
        jobId,
        pathname: meta.pathname,
        filename: f.filename,
        contentType: meta.contentType,
        sizeBytes: meta.size,
        uploadedBy: me.id,
      })
    } catch {
      // Blob doesn't exist (upload failed or was tampered with); skip it.
    }
  }
  if (rows.length === 0) return { ok: false, message: 'Upload could not be verified' }
  await db.insert(jobFiles).values(rows).onConflictDoNothing({ target: jobFiles.pathname })
  revalidatePath(`/jobs/${jobId}`)
  return { ok: true, message: rows.length === 1 ? 'File added' : `${rows.length} files added` }
}

export async function updateJobFileCaption(fileId: number, caption: string): Promise<ActionState> {
  const me = await requireUser()
  const text = caption.trim().slice(0, 300) || null
  const [file] = await db.select().from(jobFiles).where(eq(jobFiles.id, fileId)).limit(1)
  if (!file) return { ok: false, message: 'File not found' }
  if (!isAdminRole(me.role) && file.uploadedBy !== me.id) return { ok: false, message: 'Only admins or the uploader can edit this' }
  await db.update(jobFiles).set({ caption: text }).where(eq(jobFiles.id, fileId))
  revalidatePath(`/jobs/${file.jobId}`)
  return { ok: true, message: 'Caption saved' }
}

export async function deleteJobFile(fileId: number): Promise<ActionState> {
  const me = await requireUser()
  const [file] = await db.select().from(jobFiles).where(eq(jobFiles.id, fileId)).limit(1)
  if (!file) return { ok: false, message: 'File not found' }
  if (!isAdminRole(me.role) && file.uploadedBy !== me.id) return { ok: false, message: 'Only admins or the uploader can delete this' }
  try {
    await del(file.pathname)
  } catch (e) {
    console.error('Blob delete failed:', e)
  }
  await db.delete(jobFiles).where(and(eq(jobFiles.id, fileId), eq(jobFiles.jobId, file.jobId)))
  revalidatePath(`/jobs/${file.jobId}`)
  return { ok: true, message: 'File deleted' }
}
