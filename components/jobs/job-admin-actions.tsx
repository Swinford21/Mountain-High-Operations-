'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { BellRing, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
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
import {
  applyPaymentToJob,
  deleteJob,
  resendConfirmation,
  sendReminderNow,
  setJobPaymentStatus,
  unlinkPayment,
  type ActionState,
} from '@/app/actions/jobs'

function useAction() {
  const [pending, startTransition] = useTransition()
  const run = (fn: () => Promise<ActionState | void>) =>
    startTransition(async () => {
      const r = await fn()
      if (r) (r.ok ? toast.success : toast.error)(r.message)
    })
  return { pending, run }
}

export function JobAdminActions({ jobId }: { jobId: number }) {
  const { pending, run } = useAction()
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Customer messages</h2>
      <Button variant="outline" className="justify-start" disabled={pending} onClick={() => run(() => resendConfirmation(jobId))}>
        <Send aria-hidden="true" />
        Resend confirmation
      </Button>
      <Button variant="outline" className="justify-start" disabled={pending} onClick={() => run(() => sendReminderNow(jobId))}>
        <BellRing aria-hidden="true" />
        Send reminder now
      </Button>

      <Dialog>
        <DialogTrigger render={<Button variant="destructive" className="mt-2 justify-start" />}>
          <Trash2 aria-hidden="true" />
          Delete job
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this job?</DialogTitle>
            <DialogDescription>
              This removes it from the calendar. The customer is not notified. This can&apos;t be undone — to keep a
              record, set the status to Canceled instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Keep job</DialogClose>
            <Button variant="destructive" disabled={pending} onClick={() => run(() => deleteJob(jobId))}>
              Delete job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export function PaymentToggle({ jobId, paid }: { jobId: number; paid: boolean }) {
  const { pending, run } = useAction()
  const [checked, setChecked] = useState(paid)
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <Switch
        checked={checked}
        disabled={pending}
        onCheckedChange={(v) => {
          setChecked(v)
          run(() => setJobPaymentStatus(jobId, v))
        }}
      />
      {checked ? <span className="text-paid">Paid</span> : 'Unpaid'}
    </label>
  )
}

export function PaymentApplyButton({ paymentId, jobId, applied }: { paymentId: number; jobId: number; applied: boolean }) {
  const { pending, run } = useAction()
  return applied ? (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => unlinkPayment(paymentId, jobId))}>
      Applied · undo
    </Button>
  ) : (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => applyPaymentToJob(paymentId, jobId))}>
      Apply to job
    </Button>
  )
}
