'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Check, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { approveEstimateAsOffice, declineEstimateAsOffice, sendEstimate } from '@/app/actions/estimates'
import type { ActionState } from '@/app/actions/jobs'

export function EstimateActions({ estimateId, status }: { estimateId: number; status: string }) {
  const [pending, startTransition] = useTransition()
  const run = (fn: (id: number) => Promise<ActionState>) =>
    startTransition(async () => {
      const r = await fn(estimateId)
      if (r) (r.ok ? toast.success : toast.error)(r.message)
    })

  const awaiting = status === 'draft' || status === 'sent'

  return (
    <div className="flex flex-wrap gap-2">
      {awaiting && (
        <Button variant="outline" disabled={pending} onClick={() => run(sendEstimate)}>
          <Send aria-hidden="true" />
          {status === 'draft' ? 'Send to customer' : 'Resend'}
        </Button>
      )}
      {(awaiting || status === 'declined') && (
        <Button disabled={pending} onClick={() => run(approveEstimateAsOffice)}>
          <Check aria-hidden="true" />
          Mark approved
        </Button>
      )}
      {(awaiting || status === 'approved') && (
        <Button variant="ghost" disabled={pending} onClick={() => run(declineEstimateAsOffice)}>
          <X aria-hidden="true" />
          Mark declined
        </Button>
      )}
    </div>
  )
}
