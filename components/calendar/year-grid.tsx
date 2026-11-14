import Link from 'next/link'
import { dayTotalCents, formatWholeDollars } from '@/components/calendar/month-grid'
import type { JobListItem } from '@/lib/queries'
import { addDays } from '@/lib/time'
import { cn } from '@/lib/utils'

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function intensityClass(count: number) {
  if (count === 0) return 'hover:bg-muted'
  if (count === 1) return 'bg-primary/20 hover:bg-primary/30'
  if (count <= 3) return 'bg-primary/45 hover:bg-primary/55'
  return 'bg-primary text-primary-foreground hover:bg-primary/90'
}

export function YearGrid({
  year,
  today,
  selectedDay,
  jobs,
  dayHref,
  monthHref,
  showTotals = false,
}: {
  year: number
  today: string
  selectedDay: string
  jobs: JobListItem[]
  dayHref: (day: string) => string
  monthHref: (month: string) => string
  showTotals?: boolean
}) {
  const countByDay = new Map<string, number>()
  for (const j of jobs) countByDay.set(j.scheduledDate, (countByDay.get(j.scheduledDate) ?? 0) + 1)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 12 }, (_, m) => {
          const month = `${year}-${String(m + 1).padStart(2, '0')}`
          const first = new Date(Date.UTC(year, m, 1))
          const daysInMonth = new Date(Date.UTC(year, m + 1, 0)).getUTCDate()
          const leading = first.getUTCDay()
          const monthJobs = jobs.filter((j) => j.scheduledDate.startsWith(month))
          const name = first.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
          return (
            <section key={month} aria-label={`${name} ${year}`} className="flex flex-col gap-2 rounded-xl border bg-card p-3">
              <Link
                href={monthHref(month)}
                className="flex items-baseline justify-between gap-2 rounded-md px-1 hover:underline hover:underline-offset-4"
              >
                <span className="font-semibold">{name}</span>
                <span className="text-xs text-muted-foreground">
                  {monthJobs.length} job{monthJobs.length === 1 ? '' : 's'}
                  {showTotals && monthJobs.length > 0 && (
                    <>
                      {' · '}
                      <span className="font-mono font-semibold text-foreground tabular-nums">
                        {formatWholeDollars(dayTotalCents(monthJobs))}
                      </span>
                    </>
                  )}
                </span>
              </Link>
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {WEEKDAY_INITIALS.map((w, i) => (
                  <span key={i} className="py-1 text-[11px] font-medium text-muted-foreground" aria-hidden="true">
                    {w}
                  </span>
                ))}
                {Array.from({ length: leading }, (_, i) => (
                  <span key={`pad-${i}`} aria-hidden="true" />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = addDays(`${month}-01`, i)
                  const count = countByDay.get(d) ?? 0
                  return (
                    <Link
                      key={d}
                      href={dayHref(d)}
                      aria-label={`${name} ${i + 1}, ${count} job${count === 1 ? '' : 's'}`}
                      aria-current={d === selectedDay ? 'date' : undefined}
                      className={cn(
                        'flex aspect-square items-center justify-center rounded-md font-mono text-xs tabular-nums transition-colors',
                        intensityClass(count),
                        d === today && 'ring-2 ring-foreground ring-inset font-semibold',
                      )}
                    >
                      {i + 1}
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
      <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
        Jobs per day:
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border" /> 0
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-primary/20" /> 1
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-primary/45" /> 2–3
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-primary" /> 4+
        </span>
      </p>
    </div>
  )
}
