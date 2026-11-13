import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageBody, PageHeader } from '@/components/page-header'
import { EstimateStatusBadge } from '@/components/estimates/estimate-status-badge'
import { listEstimates } from '@/lib/estimates'
import { requireAdmin } from '@/lib/session'
import { formatDateShort, formatMoney } from '@/lib/time'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Estimates' }

const TABS = [
  { id: 'open', label: 'Awaiting approval', statuses: ['draft', 'sent'] },
  { id: 'approved', label: 'Approved', statuses: ['approved'] },
  { id: 'scheduled', label: 'Scheduled', statuses: ['scheduled'] },
  { id: 'declined', label: 'Declined', statuses: ['declined'] },
] as const

export default async function EstimatesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin()
  const sp = await searchParams
  const tab = TABS.find((t) => t.id === sp.tab) ?? TABS[0]
  const rows = await listEstimates([...tab.statuses])
  const total = rows.reduce((s, r) => s + (r.priceCents ?? 0), 0)

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Estimates"
        description="Quote a job, send it for approval, and approved estimates move to Unscheduled until they're booked."
        actions={
          <Button render={<Link href="/estimates/new" />} nativeButton={false}>
            <Plus aria-hidden="true" />
            New estimate
          </Button>
        }
      />
      <PageBody>
        <nav aria-label="Estimate status" className="flex flex-wrap gap-1 border-b">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={t.id === 'open' ? '/estimates' : `/estimates?tab=${t.id}`}
              aria-current={t.id === tab.id ? 'page' : undefined}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
                t.id === tab.id ? 'border-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {rows.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            <p>No estimates here yet.</p>
            {tab.id === 'open' && (
              <Button variant="outline" render={<Link href="/estimates/new" />} nativeButton={false}>
                Create your first estimate
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {rows.length} estimate{rows.length === 1 ? '' : 's'} ·{' '}
              <span className="font-mono text-foreground tabular-nums">{formatMoney(total)}</span>
            </p>
            <ul className="flex flex-col divide-y rounded-xl border bg-card">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/estimates/${r.id}`}
                    className="flex flex-col gap-2 px-4 py-3 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{r.title}</span>
                        <EstimateStatusBadge status={r.status} />
                      </span>
                      <span className="text-sm text-muted-foreground">
                        #{r.id} · {r.customerName}
                        {r.salespersonName ? ` · ${r.salespersonName}` : ''}
                        {' · '}
                        {r.approvedAt
                          ? `approved ${formatDateShort(r.approvedAt.toISOString().slice(0, 10))}`
                          : r.sentAt
                            ? `sent ${formatDateShort(r.sentAt.toISOString().slice(0, 10))}`
                            : `created ${formatDateShort(r.createdAt.toISOString().slice(0, 10))}`}
                      </span>
                    </span>
                    <span className="font-mono font-semibold tabular-nums">{formatMoney(r.priceCents)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </PageBody>
    </>
  )
}
