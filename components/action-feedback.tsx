'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { ActionState } from '@/app/actions/jobs'

/** Toasts the result of a form action and runs `onSuccess` once per successful submit. */
export function useActionToast(state: ActionState, onSuccess?: () => void) {
  const callback = useRef(onSuccess)
  callback.current = onSuccess
  useEffect(() => {
    if (!state) return
    if (state.ok) {
      toast.success(state.message)
      callback.current?.()
    } else toast.error(state.message)
  }, [state])
}

export function FormError({ state }: { state: ActionState }) {
  if (!state || state.ok) return null
  return (
    <p role="alert" className="text-sm text-destructive">
      {state.message}
    </p>
  )
}

export function ConfirmDelete({
  action,
  title,
  description,
  label = 'Delete',
  iconOnly = false,
}: {
  action: () => Promise<ActionState | void>
  title: string
  description: string
  label?: string
  iconOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          iconOnly ? (
            <Button variant="ghost" size="icon-sm" aria-label={label} className="text-muted-foreground hover:text-destructive" />
          ) : (
            <Button variant="outline" className="text-destructive hover:text-destructive" />
          )
        }
      >
        <Trash2 aria-hidden="true" />
        {!iconOnly && label}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await action()
                if (r && !r.ok) {
                  toast.error(r.message)
                  return
                }
                if (r) toast.success(r.message)
                setOpen(false)
              })
            }
          >
            {pending ? 'Deleting…' : label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
