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
    <div
      className="flex h-9 min-w-0 items-center gap-2 rounded-lg border bg-card px-2.5 text-xs"
      title={`${range} · ${count} job${count === 1 ? '' : 's'} · ${formatMoney(paid)} paid`}
    >
      <span className="font-medium">{label}</span>
      <span className="font-mono text-sm font-semibold tabular-nums">{formatMoney(total)}</span>
      <span className="hidden whitespace-nowrap text-muted-foreground xl:inline">
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
    <section aria-label="Sales totals" className="flex flex-wrap items-center gap-2">
      <Total label="Daily" range={formatDateShort(day)} jobs={jobs.filter((j) => j.scheduledDate === day)} />
      <Total label="Weekly" range={`${formatDateShort(weekStart)} – ${formatDateShort(weekEnd)}`} jobs={weekJobs} />
      <Total label="Monthly" range={monthLabel} jobs={monthJobs} />
      {year && <Total label="Yearly" range={year} jobs={jobs.filter((j) => j.scheduledDate.startsWith(year))} />}
    </section>
  )
}
