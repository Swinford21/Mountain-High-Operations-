'use client'

import { useOptimistic, useTransition } from 'react'
import { toast } from 'sonner'
import { JOB_STATUSES } from '@/lib/operations'
import { updateJobStatus } from '@/app/actions/jobs'
import { cn } from '@/lib/utils'

export function JobStatusControl({ jobId, status }: { jobId: number; status: string }) {
  const [pending, startTransition] = useTransition()
  const [current, setCurrent] = useOptimistic(status)

  return (
    <div role="radiogroup" aria-label="Job status" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {JOB_STATUSES.map((s) => {
        const active = current === s.id
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setCurrent(s.id)
                const r = await updateJobStatus(jobId, s.id)
                if (r && !r.ok) toast.error(r.message)
              })
            }
            className={cn(
              'h-11 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
              active
                ? s.id === 'canceled'
                  ? 'border-destructive bg-destructive/10 text-destructive'
                  : 'border-primary bg-primary text-primary-foreground'
                : 'bg-card hover:bg-muted',
            )}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
