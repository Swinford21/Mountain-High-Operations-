import Link from 'next/link'
import { PaidMark, StatusBadge } from '@/components/jobs/job-card'
import type { jobs } from '@/lib/db/schema'
import { getOperation } from '@/lib/operations'
import type { SquareOrderSummary } from '@/lib/square'
import { formatDateShort, formatMoney, formatTimestamp } from '@/lib/time'

type Job = typeof jobs.$inferSelect

export function JobList({ title, jobs, empty }: { title: string; jobs: Job[]; empty: string }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">
        {title} <span className="font-normal text-muted-foreground">({jobs.length})</span>
      </h2>
      {jobs.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {jobs.map((j) => {
            const op = getOperation(j.operation)
            return (
              <li key={j.id}>
                <Link href={`/jobs/${j.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: op.color }} aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{j.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {op.singular} · {formatDateShort(j.scheduledDate)}, {j.scheduledDate.slice(0, 4)}
                    </span>
                  </span>
                  {j.paymentStatus === 'paid' && <PaidMark />}
                  <StatusBadge status={j.status} />
                  <span className="hidden w-20 text-right font-mono text-sm tabular-nums sm:block">
                    {formatMoney(j.priceCents)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function SquareOrders({
  linked,
  orders,
  error,
}: {
  linked: boolean
  orders: SquareOrderSummary[]
  error: string | null
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">
        Square order history{' '}
        {linked && !error && <span className="font-normal text-muted-foreground">({orders.length})</span>}
      </h2>
      {!linked ? (
        <p className="rounded-lg border border-dashed p-6 text-sm leading-relaxed text-muted-foreground">
          This customer isn&apos;t linked to a Square customer yet. Use &quot;Sync from Square&quot; on the Customers page to match
          customers by email or phone and bring in their order history.
        </p>
      ) : error ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{error}.</p>
      ) : orders.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No Square orders for this customer.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card text-sm">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-col gap-1 px-4 py-3">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{o.date ? formatTimestamp(o.date) : 'Order'}</span>
                <span className="font-mono font-semibold tabular-nums">{formatMoney(o.totalCents)}</span>
              </span>
              {o.items.length > 0 && (
                <span className="text-muted-foreground">
                  {o.items.map((i) => `${Number(i.quantity)} × ${i.name}`).join(', ')}
                </span>
              )}
              {o.state !== 'COMPLETED' && <span className="text-xs text-muted-foreground lowercase">{o.state}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
