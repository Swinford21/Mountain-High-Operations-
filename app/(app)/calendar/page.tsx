import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageBody, PageHeader } from '@/components/page-header'
import { OperationFilter } from '@/components/calendar/operation-filter'
import { MonthGrid } from '@/components/calendar/month-grid'
import { JobCard } from '@/components/jobs/job-card'
import { OPERATION_IDS } from '@/lib/operations'
import { getJobsInRange } from '@/lib/queries'
import { requireUser } from '@/lib/session'
import { addDays, formatDateLong, todayLocal } from '@/lib/time'

export const metadata = { title: 'Calendar' }

function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1, 1))
  const last = new Date(Date.UTC(y, m, 0))
  const gridStart = addDays(first.toISOString().slice(0, 10), -first.getUTCDay())
  const gridEnd = addDays(last.toISOString().slice(0, 10), 6 - last.getUTCDay())
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7)
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7)
  const label = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return { gridStart, gridEnd, prev, next, label }
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; ops?: string; day?: string; mine?: string }>
}) {
  const me = await requireUser()
  const sp = await searchParams
  const today = todayLocal()
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7)
  const selectedOps = (sp.ops ?? '')
    .split(',')
    .filter((o): o is (typeof OPERATION_IDS)[number] => (OPERATION_IDS as readonly string[]).includes(o))
  const mine = sp.mine === '1'
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : month === today.slice(0, 7) ? today : `${month}-01`

  const { gridStart, gridEnd, prev, next, label } = monthBounds(month)
  const jobs = await getJobsInRange({
    start: gridStart,
    end: gridEnd,
    operations: selectedOps,
    assignedTo: mine ? me.id : undefined,
  })
  const dayJobs = jobs.filter((j) => j.scheduledDate === day)

  const buildHref = (overrides: Partial<{ month: string; ops: string[]; day: string; mine: boolean }>) => {
    const params = new URLSearchParams()
    const m = overrides.month ?? month
    const o = overrides.ops ?? selectedOps
    const d = overrides.day ?? (overrides.month ? undefined : day)
    const mi = overrides.mine ?? mine
    params.set('month', m)
    if (o.length) params.set('ops', o.join(','))
    if (d) params.set('day', d)
    if (mi) params.set('mine', '1')
    return `/calendar?${params.toString()}`
  }

  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title="Calendar"
        description="Every operation on one calendar. Filter to one or several operations."
        actions={
          me.role === 'admin' && (
            <Button render={<Link href={`/jobs/new?date=${day}`} />} nativeButton={false} className="h-9">
              <Plus aria-hidden="true" />
              Schedule job
            </Button>
          )
        }
      />
      <PageBody>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <OperationFilter
            selected={selectedOps}
            hrefFor={(ops) => buildHref({ ops })}
            mine={mine}
            mineHref={buildHref({ mine: !mine })}
          />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              render={<Link href={buildHref({ month: prev })} aria-label="Previous month" />}
              nativeButton={false}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <h2 className="min-w-40 text-center font-semibold">{label}</h2>
            <Button
              variant="outline"
              size="icon"
              render={<Link href={buildHref({ month: next })} aria-label="Next month" />}
              nativeButton={false}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              render={<Link href={buildHref({ month: today.slice(0, 7), day: today })} />}
              nativeButton={false}
            >
              Today
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <MonthGrid
            gridStart={gridStart}
            gridEnd={gridEnd}
            month={month}
            today={today}
            selectedDay={day}
            jobs={jobs}
            dayHref={(d) => buildHref({ day: d })}
          />
          <section aria-labelledby="day-heading" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 id="day-heading" className="font-semibold">
                {formatDateLong(day)}
              </h2>
              <span className="text-sm text-muted-foreground">
                {dayJobs.length} job{dayJobs.length === 1 ? '' : 's'}
              </span>
            </div>
            {dayJobs.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Nothing scheduled.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {dayJobs.map((j) => (
                  <JobCard key={j.id} job={j} />
                ))}
              </div>
            )}
          </section>
        </div>
      </PageBody>
    </>
  )
}
