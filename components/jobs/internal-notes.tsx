'use client'

import { useActionState, useEffect, useRef, useTransition } from 'react'
import { Lock, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { addJobNote, deleteJobNote } from '@/app/actions/job-notes'

export type InternalNote = {
  id: number
  body: string
  authorName: string | null
  createdAt: string
  canDelete: boolean
}

export function InternalNotes({ jobId, notes }: { jobId: number; notes: InternalNote[] }) {
  const [state, formAction, pending] = useActionState(addJobNote, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!state) return
    if (state.ok) formRef.current?.reset()
    else toast.error(state.message)
  }, [state])

  return (
    <section aria-labelledby="internal-notes-heading" className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 id="internal-notes-heading" className="flex items-center gap-2 font-semibold">
          <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
          Internal notes
        </h2>
        <p className="text-sm text-muted-foreground">
          Team only. These are never included in customer emails or texts.
        </p>
      </div>

      {notes.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border text-sm">
          {notes.map((n) => (
            <NoteItem key={n.id} note={n} />
          ))}
        </ul>
      )}

      <form ref={formRef} action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="jobId" value={jobId} />
        <label htmlFor="internal-note" className="sr-only">
          Add an internal note
        </label>
        <Textarea
          id="internal-note"
          name="body"
          rows={3}
          required
          maxLength={4000}
          placeholder="Leave a note for the team…"
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return
            if (e.nativeEvent.isComposing || e.keyCode === 229) return
            e.preventDefault()
            e.currentTarget.form?.requestSubmit()
          }}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Add note'}
          </Button>
        </div>
      </form>
    </section>
  )
}

function NoteItem({ note }: { note: InternalNote }) {
  const [pending, startTransition] = useTransition()
  return (
    <li className="flex flex-col gap-1 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{note.authorName ?? 'Team member'}</span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <time dateTime={note.createdAt}>
            {new Date(note.createdAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              timeZone: 'America/New_York',
            })}
          </time>
          {note.canDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              aria-label="Delete note"
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteJobNote(note.id)
                  if (r && !r.ok) toast.error(r.message)
                })
              }
            >
              <Trash2 aria-hidden="true" />
            </Button>
          )}
        </span>
      </div>
      <p className="leading-relaxed whitespace-pre-wrap">{note.body}</p>
    </li>
  )
}
