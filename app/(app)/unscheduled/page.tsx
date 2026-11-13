import Link from 'next/link'
import { CalendarPlus, MapPin, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageBody, PageHeader } from '@/components/page-header'
import { listEstimates } from '@/lib/estimates'
import { findOperation } from '@/lib/operations'
import { getAllOperations } from '@/lib/operations-server'
import { requireAdmin } from '@/lib/session'
import { formatMoney } from '@/lib/time'

export const metadata = { title: 'Unscheduled' }

function waitingLabel(approvedAt: Date | null) {
  if (!approvedAt) return null
  const days = Math.floor((Date.now() - approvedAt.getTime()) / 86_400_000)
  return days <= 0 ? 'Approved today' : days === 1 ? 'Waiting 1 day' : `Waiting ${days} days`
}

export default async function UnscheduledPage() {
  await requireAdmin()
  const [rows, operations] = await Promise.all([listEstimates(['approved']), getAllOperations()])
  // Oldest approvals first — they've waited longest.
  rows.sort((a, b) => (a.approvedAt?.getTime() ?? 0) - (b.approvedAt?.getTime() ?? 0))
  const total = rows.reduce((s, r) => s + (r.priceCents ?? 0), 0)

  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title="Unscheduled"
        description="Approved estimates that still need a date. Schedule one and it moves onto the calendar."
      />
      <PageBody className="max-w-5xl">
        {rows.length === 0 ? (
          <div className="flex flex-col gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            <p>Nothing waiting — every approved estimate is on the schedule.</p>
            <Link href="/estimates" className="font-medium text-foreground underline underline-offset-4">
              View estimates
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {rows.length} job{rows.length === 1 ? '' : 's'} waiting ·{' '}
              <span className="font-mono text-foreground tabular-nums">{formatMoney(total)}</span> approved
            </p>
            <ul className="flex flex-col gap-3">
              {rows.map((r) => {
                const op = findOperation(operations, r.operation)
                const address = r.address || r.customerAddress
                const waiting = waitingLabel(r.approvedAt)
                const stale = r.approvedAt && Date.now() - r.approvedAt.getTime() > 3 * 86_400_000
                return (
                  <li
                    key={r.id}
                    className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 gap-3">
                      <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: op.color }} aria-hidden="true" />
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                          {op.singular}
                          {waiting && (
                            <span className={stale ? 'text-destructive normal-case' : 'normal-case'}>· {waiting}</span>
                          )}
                        </span>
                        <Link href={`/estimates/${r.id}`} className="font-semibold text-pretty hover:underline">
                          {r.title}
                        </Link>
                        <span className="text-sm">
                          {r.customerName}
                          {r.salespersonName && <span className="text-muted-foreground"> · sold by {r.salespersonName}</span>}
                        </span>
                        <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {address && (
                            <span className="flex min-w-0 items-center gap-1">
                              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                              <span className="truncate">{address}</span>
                            </span>
                          )}
                          {r.customerPhone && (
                            <a href={`tel:${r.customerPhone}`} className="flex items-center gap-1 hover:text-foreground">
                              <Phone className="size-3.5" aria-hidden="true" />
                              {r.customerPhone}
                            </a>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 self-end sm:self-center">
                      <span className="font-mono font-semibold tabular-nums">{formatMoney(r.priceCents)}</span>
                      <Button render={<Link href={`/jobs/new?estimate=${r.id}`} />} nativeButton={false}>
                        <CalendarPlus aria-hidden="true" />
                        Schedule
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </PageBody>
    </>
  )
}
