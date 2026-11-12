import Link from 'next/link'
import { PaidMark } from '@/components/jobs/job-card'
import { jobColor } from '@/lib/operations'
import type { JobListItem } from '@/lib/queries'
import { addDays, formatTime12 } from '@/lib/time'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_CHIPS = 3

export function dayTotalCents(jobs: JobListItem[]) {
  return jobs.reduce((sum, j) => sum + (j.priceCents ?? 0), 0)
}

export function formatWholeDollars(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function MonthGrid({
  gridStart,
  gridEnd,
  month,
  today,
  selectedDay,
  jobs,
  dayHref,
  showTotals = false,
}: {
  gridStart: string
  gridEnd: string
  month: string
  today: string
  selectedDay: string
  jobs: JobListItem[]
  dayHref: (day: string) => string
  showTotals?: boolean
}) {
  const days: string[] = []
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d)

  const byDay = new Map<string, JobListItem[]>()
  for (const j of jobs) {
    const list = byDay.get(j.scheduledDate) ?? []
    list.push(j)
    byDay.set(j.scheduledDate, list)
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-2 text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const dayJobs = byDay.get(d) ?? []
          const inMonth = d.startsWith(month)
          const isToday = d === today
          const isSelected = d === selectedDay
          return (
            <Link
              key={d}
              href={dayHref(d)}
              scroll={false}
              aria-label={`${d}, ${dayJobs.length} job${dayJobs.length === 1 ? '' : 's'}`}
              aria-current={isSelected ? 'date' : undefined}
              className={cn(
                'flex min-h-16 flex-col gap-1 border-b p-1.5 transition-colors hover:bg-muted/60 sm:min-h-28 sm:p-2',
                i % 7 !== 6 && 'border-r',
                !inMonth && 'bg-muted/30 text-muted-foreground',
                isSelected && 'bg-accent/20 ring-2 ring-foreground ring-inset',
              )}
            >
              <span className="flex items-center justify-between gap-1">
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs tabular-nums',
                    isToday && 'bg-primary font-semibold text-primary-foreground',
                  )}
                >
                  {Number(d.slice(8))}
                </span>
                {showTotals && dayJobs.length > 0 && (
                  <span className="hidden truncate font-mono text-xs font-semibold tabular-nums sm:inline">
                    <span className="sr-only">Sales total </span>
                    {formatWholeDollars(dayTotalCents(dayJobs))}
                  </span>
                )}
              </span>

              {/* Compact dots on phones, labeled chips on larger screens */}
              {dayJobs.length > 0 && (
                <div className="flex flex-wrap gap-1 sm:hidden" aria-hidden="true">
                  {dayJobs.slice(0, 6).map((j) => (
                    <span key={j.id} className="size-1.5 rounded-full" style={{ backgroundColor: jobColor(j) }} />
                  ))}
                </div>
              )}
              <div className="hidden flex-col gap-1 sm:flex">
                {dayJobs.slice(0, MAX_CHIPS).map((j) => {
                  const color = jobColor(j)
                  return (
                    <span
                      key={j.id}
                      title={`${j.title} · ${j.customerName}${j.truckName ? ` · ${j.truckName}` : ''}${j.paymentStatus === 'paid' ? ' · Paid' : ''}`}
                      className={cn(
                        'flex items-center gap-1.5 truncate rounded border border-foreground/70 px-1.5 py-0.5 text-xs',
                        j.status === 'completed' && 'opacity-60',
                      )}
                      style={{ backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)` }}
                    >
                      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      <span className="font-mono tabular-nums">{formatTime12(j.startTime).replace(':00', '')}</span>
                      <span className={`min-w-0 flex-1 truncate ${j.hasCrewNotes ? 'font-semibold text-destructive' : ''}`}>
                        {j.title}
                        {j.hasCrewNotes && <span className="sr-only"> (has crew notes)</span>}
                      </span>
                      {j.paymentStatus === 'paid' && <PaidMark />}
                    </span>
                  )
                })}
                {dayJobs.length > MAX_CHIPS && (
                  <span className="px-1.5 text-xs font-medium text-muted-foreground">+{dayJobs.length - MAX_CHIPS} more</span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
