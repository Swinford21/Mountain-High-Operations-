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
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border bg-card px-3 py-2">
      <span className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium">{label}</span>
        <span className="truncate text-muted-foreground">{range}</span>
      </span>
      <span className="font-mono text-lg font-semibold tabular-nums">{formatMoney(total)}</span>
      <span className="text-xs text-muted-foreground">
        {count} job{count === 1 ? '' : 's'} · <span className="font-mono tabular-nums">{formatMoney(paid)}</span> paid
      </span>
    </div>
  )
}

export function SalesTotals({
  jobs,
  day,
  month,
  monthLabel,
  weekStart,
  weekEnd,
  year,
}: {
  jobs: JobListItem[]
  day: string
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
    <section aria-label="Sales totals" className={`grid grid-cols-2 gap-2 ${year ? 'md:grid-cols-4 lg:grid-cols-5 lg:max-w-5xl' : 'md:grid-cols-4 lg:max-w-4xl'}`}>
      <Total label="Daily sales" range={formatDateShort(day)} jobs={jobs.filter((j) => j.scheduledDate === day)} />
      <Total label="Weekly sales" range={`${formatDateShort(weekStart)} – ${formatDateShort(weekEnd)}`} jobs={weekJobs} />
      <Total label="Monthly sales" range={monthLabel} jobs={monthJobs} />
      {year && <Total label="Yearly sales" range={year} jobs={jobs.filter((j) => j.scheduledDate.startsWith(year))} />}
    </section>
  )
}
