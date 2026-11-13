'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { toast } from 'sonner'
import { Download, FileText, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { deleteJobFile, recordJobFiles, updateJobFileCaption } from '@/app/actions/job-files'
import { JOB_FILE_ACCEPT, JOB_FILE_MAX_BYTES, formatBytes, isPreviewableImage, jobFilePrefix } from '@/lib/job-files'
import { cn } from '@/lib/utils'

export type JobFileItem = {
  id: number
  filename: string
  contentType: string
  sizeBytes: number
  caption: string | null
  uploaderName: string | null
  createdAt: string
  canEdit: boolean
}

type Progress = { name: string; percent: number }

function fileUrl(id: number, download = false) {
  return `/api/job-files/${id}${download ? '?download=1' : ''}`
}

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, '_').slice(-120) || 'file'
}

export function JobFiles({ jobId, files }: { jobId: number; files: JobFileItem[] }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<Progress[]>([])
  const [dragging, setDragging] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const uploading = progress.length > 0

  const images = files.filter((f) => isPreviewableImage(f.contentType))
  const others = files.filter((f) => !isPreviewableImage(f.contentType))
  const open = files.find((f) => f.id === openId) ?? null

  async function handleFiles(list: FileList | File[]) {
    const picked = Array.from(list).slice(0, 20)
    const tooBig = picked.filter((f) => f.size > JOB_FILE_MAX_BYTES)
    if (tooBig.length) toast.error(`${tooBig.map((f) => f.name).join(', ')} is over ${formatBytes(JOB_FILE_MAX_BYTES)}`)
    const ok = picked.filter((f) => f.size <= JOB_FILE_MAX_BYTES)
    if (!ok.length) return

    setProgress(ok.map((f) => ({ name: f.name, percent: 0 })))
    const results = await Promise.allSettled(
      ok.map((file, i) =>
        upload(`${jobFilePrefix(jobId)}${safeName(file.name)}`, file, {
          access: 'private',
          handleUploadUrl: '/api/job-files/upload',
          clientPayload: String(jobId),
          multipart: file.size > 8 * 1024 * 1024,
          onUploadProgress: ({ percentage }) =>
            setProgress((p) => p.map((x, j) => (j === i ? { ...x, percent: Math.round(percentage) } : x))),
        }).then((blob) => ({ pathname: blob.pathname, filename: file.name })),
      ),
    )

    const done = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
    const failed = results.length - done.length
    if (done.length) {
      const r = await recordJobFiles(jobId, done)
      if (r?.ok) toast.success(r.message)
      else toast.error(r?.message ?? 'Could not save files')
      router.refresh()
    }
    if (failed) toast.error(`${failed} file${failed === 1 ? '' : 's'} failed to upload`)
    setProgress([])
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5" aria-labelledby="files-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="files-heading" className="font-semibold">
          Photos &amp; files <span className="font-normal text-muted-foreground">({files.length})</span>
        </h2>
        <Button type="button" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ImagePlus aria-hidden="true" />}
          {uploading ? 'Uploading…' : 'Add photos or files'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={JOB_FILE_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!uploading && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
        }}
        className={cn('flex flex-col gap-4 rounded-lg transition-colors', dragging && 'bg-muted ring-2 ring-ring/40')}
      >
        {progress.length > 0 && (
          <ul className="flex flex-col gap-2" aria-live="polite">
            {progress.map((p, i) => (
              <li key={i} className="flex flex-col gap-1 text-sm">
                <span className="flex justify-between gap-3">
                  <span className="truncate">{p.name}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">{p.percent}%</span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full bg-primary transition-all" style={{ width: `${p.percent}%` }} />
                </span>
              </li>
            ))}
          </ul>
        )}

        {files.length === 0 && !uploading ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground hover:bg-muted/50"
          >
            <ImagePlus className="size-6" aria-hidden="true" />
            <span>Drop photos here or tap to add before/after shots, receipts, or plans.</span>
            <span className="text-xs">Images, PDFs, videos and documents up to {formatBytes(JOB_FILE_MAX_BYTES)}</span>
          </button>
        ) : (
          <>
            {images.length > 0 && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {images.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(f.id)}
                      className="group relative block aspect-square w-full overflow-hidden rounded-lg border bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-gated stream */}
                      <img
                        src={fileUrl(f.id)}
                        alt={f.caption || f.filename}
                        loading="lazy"
                        className="size-full object-cover transition-transform group-hover:scale-105"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {others.length > 0 && (
              <ul className="flex flex-col divide-y rounded-lg border">
                {others.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => setOpenId(f.id)}
                      className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
                    >
                      {f.caption || f.filename}
                    </button>
                    <span className="shrink-0 text-muted-foreground">{formatBytes(f.sizeBytes)}</span>
                    <a
                      href={fileUrl(f.id, true)}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label={`Download ${f.filename}`}
                    >
                      <Download className="size-4" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <FileViewer file={open} onClose={() => setOpenId(null)} onChanged={() => router.refresh()} />
    </section>
  )
}

function FileViewer({
  file,
  onClose,
  onChanged,
}: {
  file: JobFileItem | null
  onClose: () => void
  onChanged: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  return (
    <Dialog
      open={!!file}
      onOpenChange={(o) => {
        if (!o) {
          setConfirming(false)
          onClose()
        }
      }}
    >
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
        {file && (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-8">{file.filename}</DialogTitle>
              <DialogDescription>
                {formatBytes(file.sizeBytes)} · added by {file.uploaderName ?? 'team member'} on{' '}
                {new Date(file.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </DialogDescription>
            </DialogHeader>
            {isPreviewableImage(file.contentType) ? (
              // eslint-disable-next-line @next/next/no-img-element -- private, auth-gated stream
              <img
                src={fileUrl(file.id)}
                alt={file.caption || file.filename}
                className="max-h-[60svh] w-full rounded-lg bg-muted object-contain"
              />
            ) : file.contentType.startsWith('video/') ? (
              <video src={fileUrl(file.id)} controls className="max-h-[60svh] w-full rounded-lg bg-muted" />
            ) : file.contentType === 'application/pdf' ? (
              <iframe src={fileUrl(file.id)} title={file.filename} className="h-[60svh] w-full rounded-lg border" />
            ) : (
              <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                This file type can&apos;t be previewed here. Download it to open.
              </p>
            )}

            {file.canEdit ? (
              <form
                key={file.id}
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const caption = String(new FormData(e.currentTarget).get('caption') ?? '')
                  startTransition(async () => {
                    const r = await updateJobFileCaption(file.id, caption)
                    if (r?.ok) {
                      toast.success(r.message)
                      onChanged()
                    } else toast.error(r?.message ?? 'Could not save caption')
                  })
                }}
              >
                <label htmlFor={`caption-${file.id}`} className="sr-only">
                  Caption
                </label>
                <Input
                  id={`caption-${file.id}`}
                  name="caption"
                  maxLength={300}
                  defaultValue={file.caption ?? ''}
                  placeholder="Add a caption, e.g. Before — front bed"
                />
                <Button type="submit" variant="outline" disabled={pending}>
                  Save
                </Button>
              </form>
            ) : (
              file.caption && <p className="text-sm">{file.caption}</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <Button variant="outline" render={<a href={fileUrl(file.id, true)} />} nativeButton={false}>
                <Download aria-hidden="true" />
                Download
              </Button>
              {file.canEdit &&
                (confirming ? (
                  <span className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Delete this file?</span>
                    <Button variant="outline" onClick={() => setConfirming(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const r = await deleteJobFile(file.id)
                          if (r?.ok) {
                            toast.success(r.message)
                            setConfirming(false)
                            onClose()
                            onChanged()
                          } else toast.error(r?.message ?? 'Could not delete file')
                        })
                      }
                    >
                      Delete
                    </Button>
                  </span>
                ) : (
                  <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirming(true)}>
                    <Trash2 aria-hidden="true" />
                    Delete
                  </Button>
                ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
