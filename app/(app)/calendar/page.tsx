import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageBody, PageHeader } from '@/components/page-header'
import { OperationFilter } from '@/components/calendar/operation-filter'
import { DaySchedule } from '@/components/calendar/day-schedule'
import { SalesTotals } from '@/components/calendar/sales-totals'
import { MonthGrid, dayTotalCents } from '@/components/calendar/month-grid'
import { WeekGrid } from '@/components/calendar/week-grid'
import { YearGrid } from '@/components/calendar/year-grid'
import { ViewToggle, type CalendarView } from '@/components/calendar/view-toggle'
import { getOperations } from '@/lib/operations-server'
import { getJobsInRange } from '@/lib/queries'
import { isAdminRole, requireUser } from '@/lib/session'
import { addDays, formatDateLong, formatMoney, todayLocal } from '@/lib/time'

export const metadata = { title: 'Calendar' }

const VIEWS: CalendarView[] = ['day', 'week', 'month', 'year']

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

function shortDate(day: string, withYear = false) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  })
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string; ops?: string; day?: string; mine?: string }>
}) {
  const me = await requireUser()
  const isAdmin = isAdminRole(me.role)
  const sp = await searchParams
  const today = todayLocal()
  const view: CalendarView = VIEWS.includes(sp.view as CalendarView) ? (sp.view as CalendarView) : 'month'
  const operations = await getOperations()
  const selectedOps = (sp.ops ?? '').split(',').filter((o) => operations.some((op) => op.id === o))
  const mine = sp.mine === '1'

  /** Picks today when it falls inside the target period, otherwise the period's first day. */
  const anchorFor = (period: string) => (today.startsWith(period) ? today : period.length === 4 ? `${period}-01-01` : `${period}-01`)
  const legacyMonth = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : null
  const day =
    sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) && (!legacyMonth || sp.day.startsWith(legacyMonth))
      ? sp.day
      : legacyMonth
        ? anchorFor(legacyMonth)
        : today
  const month = day.slice(0, 7)
  const year = day.slice(0, 4)
  const weekStart = addDays(day, -new Date(`${day}T12:00:00Z`).getUTCDay())
  const weekEnd = addDays(weekStart, 6)
  const { gridStart, gridEnd, prev: prevMonth, next: nextMonth, label: monthLabel } = monthBounds(month)

  // Always cover the month grid so the weekly and monthly sales totals stay correct in every view.
  const rangeStart = view === 'year' && `${year}-01-01` < gridStart ? `${year}-01-01` : gridStart
  const rangeEnd = view === 'year' && `${year}-12-31` > gridEnd ? `${year}-12-31` : gridEnd
  const rangeJobs = await getJobsInRange({
    start: rangeStart,
    end: rangeEnd,
    operations: selectedOps,
    assignedTo: mine ? me.id : undefined,
  })
  // Field crew never receive prices or payment status, not even in the page data.
  const jobs = isAdmin ? rangeJobs : rangeJobs.map((j) => ({ ...j, priceCents: null, paymentStatus: 'unpaid' }))
  const dayJobs = jobs.filter((j) => j.scheduledDate === day)

  const buildHref = (overrides: Partial<{ view: CalendarView; ops: string[]; day: string; mine: boolean }>) => {
    const params = new URLSearchParams()
    const v = overrides.view ?? view
    const o = overrides.ops ?? selectedOps
    const mi = overrides.mine ?? mine
    if (v !== 'month') params.set('view', v)
    params.set('day', overrides.day ?? day)
    if (o.length) params.set('ops', o.join(','))
    if (mi) params.set('mine', '1')
    return `/calendar?${params.toString()}`
  }

  const nav = {
    day: { prev: addDays(day, -1), next: addDays(day, 1), label: formatDateLong(day), unit: 'day' },
    week: {
      prev: addDays(day, -7),
      next: addDays(day, 7),
      label: `${shortDate(weekStart)} – ${shortDate(weekEnd, true)}`,
      unit: 'week',
    },
    month: { prev: anchorFor(prevMonth), next: anchorFor(nextMonth), label: monthLabel, unit: 'month' },
    year: { prev: anchorFor(String(Number(year) - 1)), next: anchorFor(String(Number(year) + 1)), label: year, unit: 'year' },
  }[view]

  const daySummary = (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id="day-heading" className="font-semibold">
        {formatDateLong(day)}
      </h2>
      <span className="text-sm text-muted-foreground">
        {dayJobs.length} job{dayJobs.length === 1 ? '' : 's'}
        {isAdmin && dayJobs.length > 0 && (
          <>
            {' · '}
            <span className="font-mono font-semibold text-foreground tabular-nums">{formatMoney(dayTotalCents(dayJobs))}</span>
          </>
        )}
      </span>
    </div>
  )

  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title="Calendar"
        description="Every operation on one calendar. Filter to one or several operations."
      />
      <PageBody>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <OperationFilter
            operations={operations}
            selected={selectedOps}
            hrefFor={(ops) => buildHref({ ops })}
            mine={mine}
            mineHref={buildHref({ mine: !mine })}
          />
          <div className="flex flex-wrap items-center gap-2">
            <ViewToggle current={view} hrefFor={(v) => buildHref({ view: v })} />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                render={<Link href={buildHref({ day: nav.prev })} aria-label={`Previous ${nav.unit}`} />}
                nativeButton={false}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <h2 className="min-w-40 text-center font-semibold" aria-live="polite">
                {nav.label}
              </h2>
              <Button
                variant="outline"
                size="icon"
                render={<Link href={buildHref({ day: nav.next })} aria-label={`Next ${nav.unit}`} />}
                nativeButton={false}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
              <Button variant="ghost" render={<Link href={buildHref({ day: today })} />} nativeButton={false}>
                Today
              </Button>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="-mb-3 flex">
            <Button render={<Link href={`/jobs/new?date=${day}`} />} nativeButton={false} className="h-9">
              <Plus aria-hidden="true" />
              Schedule job
            </Button>
          </div>
        )}

        {view === 'day' && (
          <section aria-labelledby="day-heading" className="flex flex-col gap-3">
            {daySummary}
            <DaySchedule key={day} day={day} jobs={dayJobs} isAdmin={isAdmin} />
          </section>
        )}

        {view === 'week' && (
          <WeekGrid
            weekStart={weekStart}
            today={today}
            selectedDay={day}
            jobs={jobs}
            dayHref={(d) => buildHref({ view: 'day', day: d })}
            showTotals={isAdmin}
          />
        )}

        {view === 'month' && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <MonthGrid
              gridStart={gridStart}
              gridEnd={gridEnd}
              month={month}
              today={today}
              selectedDay={day}
              jobs={jobs}
              dayHref={(d) => buildHref({ day: d })}
              showTotals={isAdmin}
            />
            <section aria-labelledby="day-heading" className="flex flex-col gap-3">
              {daySummary}
              <DaySchedule key={day} day={day} jobs={dayJobs} isAdmin={isAdmin} />
            </section>
          </div>
        )}

        {view === 'year' && (
          <YearGrid
            year={Number(year)}
            today={today}
            selectedDay={day}
            jobs={jobs}
            dayHref={(d) => buildHref({ view: 'day', day: d })}
            monthHref={(m) => buildHref({ view: 'month', day: anchorFor(m) })}
            showTotals={isAdmin}
          />
        )}

        {isAdmin && (
          <SalesTotals
            jobs={jobs}
            day={day}
            month={month}
            monthLabel={monthLabel}
            weekStart={weekStart}
            weekEnd={weekEnd}
            year={view === 'year' ? year : undefined}
          />
        )}
      </PageBody>
    </>
  )
}
