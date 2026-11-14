import type { JobListItem } from '@/lib/queries'
import { formatDateShort, formatMoney } from '@/lib/time'

function summarize(jobs: JobListItem[]) {
  let total = 0
  let paid = 0
  for (const j of jobs) {
    const cents = j.priceCents ?? 0
    total += cents
    if (j.paymentStatus === 'paid') paid += cents
  }
  return { total, paid, count: jobs.length }
}

function Total({ label, range, jobs }: { label: string; range: string; jobs: JobListItem[] }) {
  const { total, paid, count } = summarize(jobs)
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-xl border bg-card px-4 py-3">
      <span className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{range}</span>
      </span>
      <span className="font-mono text-2xl font-semibold tabular-nums">{formatMoney(total)}</span>
      <span className="text-xs text-muted-foreground">
        {count} job{count === 1 ? '' : 's'} · <span className="font-mono tabular-nums">{formatMoney(paid)}</span> paid
      </span>
    </div>
  )
}

export function SalesTotals({
  jobs,
  month,
  monthLabel,
  weekStart,
  weekEnd,
  year,
}: {
  jobs: JobListItem[]
  month: string
  monthLabel: string
  weekStart: string
  weekEnd: string
  /** Pass when the page loaded the whole year, to add a yearly total. */
  year?: string
}) {
  const weekJobs = jobs.filter((j) => j.scheduledDate >= weekStart && j.scheduledDate <= weekEnd)
  const monthJobs = jobs.filter((j) => j.scheduledDate.startsWith(month))
  return (
    <section aria-label="Sales totals" className="flex flex-col gap-3 sm:flex-row">
      <Total label="Weekly sales" range={`${formatDateShort(weekStart)} – ${formatDateShort(weekEnd)}`} jobs={weekJobs} />
      <Total label="Monthly sales" range={monthLabel} jobs={monthJobs} />
      {year && <Total label="Yearly sales" range={year} jobs={jobs.filter((j) => j.scheduledDate.startsWith(year))} />}
    </section>
  )
}
