import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jobs } from '@/lib/db/schema'
import { JOB_FILE_MAX_BYTES, JOB_FILE_TYPES, jobFilePrefix } from '@/lib/job-files'
import { getCurrentUser } from '@/lib/session'

/** Issues short-lived client upload tokens so large phone photos go straight to Blob storage. */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const me = await getCurrentUser()
        if (!me || me.role === 'pending') throw new Error('Not signed in')

        const jobId = Number(clientPayload)
        if (!Number.isInteger(jobId) || jobId <= 0) throw new Error('Missing job')
        const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, jobId)).limit(1)
        if (!job) throw new Error('Job not found')
        if (!pathname.startsWith(jobFilePrefix(jobId)) || pathname.includes('..')) throw new Error('Invalid file path')

        return {
          allowedContentTypes: JOB_FILE_TYPES,
          maximumSizeInBytes: JOB_FILE_MAX_BYTES,
          addRandomSuffix: true,
        }
      },
      // Rows are recorded by the recordJobFiles action after the browser upload finishes,
      // which also works in local preview where Blob can't reach this callback.
      onUploadCompleted: async () => {},
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 400 })
  }
}
