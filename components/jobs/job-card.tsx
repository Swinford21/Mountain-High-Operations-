import Link from 'next/link'
import { MapPin, Truck, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getOperation, jobColor, statusLabel } from '@/lib/operations'
import type { JobListItem } from '@/lib/queries'
import { formatDateShort, formatTime12 } from '@/lib/time'
import { cn } from '@/lib/utils'

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium',
        status === 'completed' && 'border-primary/30 bg-primary/10 text-primary',
        status === 'in_progress' && 'border-accent bg-accent/30 text-foreground',
        status === 'canceled' && 'text-muted-foreground line-through',
      )}
    >
      {statusLabel(status)}
    </Badge>
  )
}

export function JobCard({ job, showDate = false }: { job: JobListItem; showDate?: boolean }) {
  const op = getOperation(job.operation)
  const address = job.address || job.customerAddress
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group flex gap-4 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/30"
    >
      <div className="flex w-16 shrink-0 flex-col">
        {showDate && <span className="text-xs text-muted-foreground">{formatDateShort(job.scheduledDate)}</span>}
        <span className="font-mono text-sm font-semibold tabular-nums">{formatTime12(job.startTime)}</span>
      </div>
      <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: jobColor(job) }} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{op.singular}</span>
          {job.status !== 'scheduled' && <StatusBadge status={job.status} />}
        </div>
        <span className="font-semibold text-pretty group-hover:underline">{job.title}</span>
        <span className="text-sm text-muted-foreground">{job.customerName}</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {address && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{address}</span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <User className="size-3.5" aria-hidden="true" />
            {job.assigneeName ?? 'Unassigned'}
          </span>
          {job.truckName && (
            <span className="flex items-center gap-1">
              <Truck className="size-3.5" aria-hidden="true" />
              {job.truckName}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
