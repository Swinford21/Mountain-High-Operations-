'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { adminDeleteEntry, adminUpdateEntry } from '@/app/actions/time'

export function EntryEditDialog(props: {
  entryId: number
  name: string
  date: string
  clockIn: string
  clockOutDate: string
  clockOut: string
  notes: string
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(adminUpdateEntry.bind(null, props.entryId), null)
  const [deleting, startDelete] = useTransition()

  useEffect(() => {
    if (!state) return
    if (state.ok) {
      toast.success(state.message)
      setOpen(false)
    } else toast.error(state.message)
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Edit entry for ${props.name}`} />}>
        <Pencil aria-hidden="true" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit time entry</DialogTitle>
          <DialogDescription>{props.name}. Times are in the yard&apos;s local time.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="e-date">Clock-in date</Label>
              <Input id="e-date" name="date" type="date" defaultValue={props.date} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="e-in">Clock in</Label>
              <Input id="e-in" name="clockIn" type="time" defaultValue={props.clockIn} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="e-outdate">Clock-out date</Label>
              <Input id="e-outdate" name="clockOutDate" type="date" defaultValue={props.clockOutDate || props.date} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="e-out">Clock out</Label>
              <Input id="e-out" name="clockOut" type="time" defaultValue={props.clockOut} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="e-notes">Notes</Label>
            <Textarea id="e-notes" name="notes" rows={2} defaultValue={props.notes} />
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() =>
                startDelete(async () => {
                  const r = await adminDeleteEntry(props.entryId)
                  if (r?.ok) {
                    toast.success(r.message)
                    setOpen(false)
                  }
                })
              }
            >
              Delete entry
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
