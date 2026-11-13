import { get } from '@vercel/blob'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jobFiles } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/session'

/** Streams a private job file to signed-in team members. Add ?download=1 to save instead of view. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser()
  if (!me || me.role === 'pending') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return new NextResponse('Not found', { status: 404 })
  const [file] = await db.select().from(jobFiles).where(eq(jobFiles.id, id)).limit(1)
  if (!file) return new NextResponse('Not found', { status: 404 })

  try {
    const result = await get(file.pathname, {
      access: 'private',
      ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
    })
    if (!result) return new NextResponse('Not found', { status: 404 })
    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' },
      })
    }
    const disposition = request.nextUrl.searchParams.get('download') ? 'attachment' : 'inline'
    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType || file.contentType,
        ETag: result.blob.etag,
        'Cache-Control': 'private, no-cache',
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Error serving job file:', error)
    return NextResponse.json({ error: 'Could not load file' }, { status: 500 })
  }
}
