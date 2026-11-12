'use client'

import { useActionState, useEffect, useId, useRef, useTransition } from 'react'
import { Lock, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { ActionState } from '@/app/actions/jobs'
import { cn } from '@/lib/utils'

export type InternalNote = {
  id: number
  body: string
  authorName: string | null
  createdAt: string
  canDelete: boolean
}

export function InternalNotes({
  targetId,
  notes,
  addAction,
  deleteAction,
  title = 'Internal notes',
  description = 'Admins only. Customers and crew never see these, and they are never included in emails or texts.',
  placeholder = 'Leave a note for the team…',
  variant = 'admin',
}: {
  targetId: number
  notes: InternalNote[]
  addAction: (prev: ActionState, formData: FormData) => Promise<ActionState>
  deleteAction: (noteId: number) => Promise<ActionState>
  title?: string
  description?: string
  placeholder?: string
  variant?: 'admin' | 'crew'
}) {
  const id = useId()
  const [state, formAction, pending] = useActionState(addAction, null)
  const formRef = useRef<HTMLFormElement>(null)
  const Icon = variant === 'admin' ? Lock : Users

  useEffect(() => {
    if (!state) return
    if (state.ok) formRef.current?.reset()
    else toast.error(state.message)
  }, [state])

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className={cn(
        'flex flex-col gap-4 rounded-xl border bg-card p-5',
        variant === 'crew' && notes.length > 0 && 'border-destructive/40',
      )}
    >
      <div className="flex flex-col gap-1">
        <h2
          id={`${id}-heading`}
          className={cn('flex items-center gap-2 font-semibold', variant === 'crew' && notes.length > 0 && 'text-destructive')}
        >
          <Icon className="size-4" aria-hidden="true" />
          {title}
          {notes.length > 0 && <span className="text-sm font-normal text-muted-foreground">({notes.length})</span>}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {notes.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border text-sm">
          {notes.map((n) => (
            <NoteItem key={n.id} note={n} deleteAction={deleteAction} />
          ))}
        </ul>
      )}

      <form ref={formRef} action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="targetId" value={targetId} />
        <label htmlFor={`${id}-body`} className="sr-only">
          Add to {title.toLowerCase()}
        </label>
        <Textarea
          id={`${id}-body`}
          name="body"
          rows={3}
          required
          maxLength={4000}
          placeholder={placeholder}
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

function NoteItem({ note, deleteAction }: { note: InternalNote; deleteAction: (noteId: number) => Promise<ActionState> }) {
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
                  const r = await deleteAction(note.id)
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
