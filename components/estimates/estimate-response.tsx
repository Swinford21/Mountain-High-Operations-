'use client'

import { useActionState, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { approveEstimateByToken, declineEstimateByToken } from '@/app/actions/estimates'

export function EstimateResponse({
  token,
  status,
  answered,
  expired,
  approvedByName,
  defaultName,
  phone,
}: {
  token: string
  status: string
  answered: boolean
  expired: boolean
  approvedByName: string | null
  defaultName: string
  phone: string
}) {
  const [approveState, approveAction, approving] = useActionState(approveEstimateByToken.bind(null, token), null)
  const [declineState, declineAction, declining] = useActionState(declineEstimateByToken.bind(null, token), null)
  const [showDecline, setShowDecline] = useState(false)

  const finalStatus = approveState?.ok ? 'approved' : declineState?.ok ? 'declined' : answered ? status : null

  if (finalStatus === 'approved' || finalStatus === 'scheduled') {
    return (
      <section role="status" className="flex flex-col items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-6">
        <CheckCircle2 className="size-6 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">
          {finalStatus === 'scheduled' ? "You're on the schedule" : 'Estimate approved — thank you!'}
        </h2>
        <p className="text-sm leading-relaxed">
          {finalStatus === 'scheduled'
            ? "We've booked your job. You'll get (or already got) a confirmation with the date."
            : `${approvedByName ? `Approved by ${approvedByName}. ` : ''}Our office has been notified and will reach out to get you on the schedule.`}{' '}
          Questions? Call{' '}
          <a href={`tel:${phone}`} className="font-medium underline underline-offset-4">
            {phone}
          </a>
          .
        </p>
      </section>
    )
  }

  if (finalStatus === 'declined') {
    return (
      <section role="status" className="flex flex-col gap-2 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Estimate declined</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Thanks for letting us know. If you&apos;d like changes or a new quote, call {phone}.
        </p>
      </section>
    )
  }

  if (expired) {
    return (
      <section className="flex flex-col gap-2 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">This estimate has expired</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Prices may have changed. Call {phone} and we&apos;ll send you an updated quote.
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-5 rounded-xl border bg-card p-6">
      <form action={approveAction} className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Approve this estimate</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="approve-name">Your name</Label>
          <Input id="approve-name" name="name" required autoComplete="name" defaultValue={defaultName} className="h-10" />
        </div>
        <label className="flex items-start gap-3 text-sm leading-relaxed">
          <input type="checkbox" name="agree" required className="mt-1 size-4 accent-[var(--primary)]" />
          <span>I approve this estimate and the scope of work above, and I&apos;d like to be scheduled.</span>
        </label>
        {approveState && !approveState.ok && (
          <p role="alert" className="text-sm text-destructive">
            {approveState.message}
          </p>
        )}
        <Button type="submit" disabled={approving} className="h-11 text-base">
          {approving ? 'Approving…' : 'Approve estimate'}
        </Button>
      </form>

      <div className="border-t pt-4">
        {showDecline ? (
          <form action={declineAction} className="flex flex-col gap-3">
            <Label htmlFor="decline-reason">Not moving forward? Tell us why (optional)</Label>
            <Textarea id="decline-reason" name="reason" rows={3} maxLength={1000} />
            {declineState && !declineState.ok && (
              <p role="alert" className="text-sm text-destructive">
                {declineState.message}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" variant="outline" disabled={declining}>
                {declining ? 'Sending…' : 'Decline estimate'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowDecline(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowDecline(true)}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Decline this estimate
          </button>
        )}
      </div>
    </section>
  )
}
