import Link from 'next/link'
import { PaidMark } from '@/components/jobs/job-card'
import { dayTotalCents, formatWholeDollars } from '@/components/calendar/month-grid'
import { jobColor } from '@/lib/operations'
import type { JobListItem } from '@/lib/queries'
import { addDays, formatTime12 } from '@/lib/time'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function WeekGrid({
  weekStart,
  today,
  selectedDay,
  jobs,
  dayHref,
  showTotals = false,
}: {
  weekStart: string
  today: string
  selectedDay: string
  jobs: JobListItem[]
  dayHref: (day: string) => string
  showTotals?: boolean
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div className="grid overflow-hidden rounded-xl border bg-card lg:grid-cols-7">
      {days.map((d, i) => {
        const dayJobs = jobs
          .filter((j) => j.scheduledDate === d)
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
        const isToday = d === today
        const isSelected = d === selectedDay
        return (
          <section
            key={d}
            aria-label={`${WEEKDAYS[i]} ${d}`}
            className={cn('flex min-h-24 flex-col border-b lg:min-h-96 lg:border-b-0', i < 6 && 'lg:border-r')}
          >
            <Link
              href={dayHref(d)}
              aria-current={isSelected ? 'date' : undefined}
              className={cn(
                'flex items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2 transition-colors hover:bg-muted',
                isSelected && 'bg-accent/20',
              )}
            >
              <span className="flex items-center gap-2">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{WEEKDAYS[i]}</span>
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full font-mono text-sm tabular-nums',
                    isToday && 'bg-primary font-semibold text-primary-foreground',
                  )}
                >
                  {Number(d.slice(8))}
                </span>
              </span>
              {showTotals && dayJobs.length > 0 && (
                <span className="font-mono text-xs font-semibold tabular-nums">
                  <span className="sr-only">Sales total </span>
                  {formatWholeDollars(dayTotalCents(dayJobs))}
                </span>
              )}
            </Link>
            <ul className="flex flex-1 flex-col gap-1.5 p-2">
              {dayJobs.length === 0 && <li className="px-1 py-1 text-xs text-muted-foreground">No jobs</li>}
              {dayJobs.map((j) => {
                const color = jobColor(j)
                return (
                  <li key={j.id}>
                    <Link
                      href={`/jobs/${j.id}`}
                      className={cn(
                        'flex flex-col gap-0.5 rounded-md border border-foreground/70 px-2 py-1.5 text-xs transition-colors hover:border-foreground',
                        j.status === 'completed' && 'opacity-60',
                      )}
                      style={{ backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)` }}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                        <span className="font-mono tabular-nums">{formatTime12(j.startTime)}</span>
                        {j.paymentStatus === 'paid' && <PaidMark />}
                      </span>
                      <span className={cn('truncate font-medium', j.hasCrewNotes && 'text-destructive')}>
                        {j.title}
                        {j.hasCrewNotes && <span className="sr-only"> (has crew notes)</span>}
                      </span>
                      <span className="truncate text-muted-foreground">{j.customerName}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
