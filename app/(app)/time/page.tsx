import Link from 'next/link'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageBody, PageHeader } from '@/components/page-header'
import { ClockCard } from '@/components/time/clock-card'
import { EntryEditDialog } from '@/components/time/entry-edit-dialog'
import { findOperation } from '@/lib/operations'
import { getJobsInRange } from '@/lib/queries'
import { isAdminRole, requireUser } from '@/lib/session'
import {
  clockProps,
  entryDurationMs,
  getEntriesBetween,
  getOpenEntry,
  usesTimeClock,
  type EntryRow,
} from '@/lib/time-queries'
import {
  addDays,
  formatClock,
  formatDateShort,
  formatHours,
  localDateOf,
  localTimeOf,
  todayLocal,
} from '@/lib/time'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Time Clock' }

function weekStartOf(date: string) {
  const d = new Date(`${date}T12:00:00Z`)
  const offset = (d.getUTCDay() + 6) % 7 // Monday-start weeks
  return addDays(date, -offset)
}

export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; week?: string }>
}) {
  const me = await requireUser()
  const isAdmin = isAdminRole(me.role)
  const sp = await searchParams
  const view = isAdmin && sp.view === 'team' ? 'team' : 'mine'
  const today = todayLocal()
  const weekStart = weekStartOf(sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : today)
  const weekEnd = addDays(weekStart, 7)

  const [entries, openEntry, todayJobs, onTimeClock] = await Promise.all([
    getEntriesBetween(weekStart, weekEnd, view === 'team' ? undefined : me.id),
    getOpenEntry(me.id),
    getJobsInRange({ start: today, end: today }),
    usesTimeClock(me.id),
  ])

  const now = Date.now()
  const todayMs = entries
    .filter((e) => e.userId === me.id && localDateOf(e.clockIn) === today)
    .reduce((s, e) => s + entryDurationMs(e, now), 0)

  const href = (o: { view?: string; week?: string }) => {
    const p = new URLSearchParams()
    const v = o.view ?? view
    if (v === 'team') p.set('view', 'team')
    p.set('week', o.week ?? weekStart)
    return `/time?${p.toString()}`
  }

  const totalsByUser = new Map<string, { name: string; ms: number; open: boolean }>()
  for (const e of entries) {
    const t = totalsByUser.get(e.userId) ?? { name: e.userName, ms: 0, open: false }
    t.ms += entryDurationMs(e, now)
    if (!e.clockOut) t.open = true
    totalsByUser.set(e.userId, t)
  }

  return (
    <>
      <PageHeader
        eyebrow="Payroll"
        title="Time Clock"
        description="Clock in when you start, switch jobs as you go, clock out at the end of the day."
        actions={
          isAdmin && (
            <div role="tablist" aria-label="Timesheet view" className="flex gap-1 rounded-lg bg-muted p-1">
              {[
                { id: 'mine', label: 'My time' },
                { id: 'team', label: 'Team timesheets' },
              ].map((t) => (
                <Link
                  key={t.id}
                  role="tab"
                  aria-selected={view === t.id}
                  href={href({ view: t.id })}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium',
                    view === t.id ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </div>
          )
        }
      />
      <PageBody>
        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            {onTimeClock || openEntry ? (
              <ClockCard
                openEntry={clockProps(openEntry)}
                jobOptions={todayJobs.map((j) => ({
                  id: j.id,
                  label: `${j.startTime} · ${j.operationSingular ?? findOperation([], j.operation).singular} · ${j.customerName}`,
                }))}
                todayTotalLabel={formatHours(todayMs)}
              />
            ) : (
              <p className="rounded-xl border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
                Your account doesn&apos;t use the time clock. An admin can turn it on under HR → Team.
              </p>
            )}
            {view === 'team' && (
              <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
                <h2 className="font-semibold">Week totals</h2>
                {totalsByUser.size === 0 ? (
                  <p className="text-sm text-muted-foreground">No time logged this week.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {[...totalsByUser.entries()]
                      .sort((a, b) => b[1].ms - a[1].ms)
                      .map(([id, t]) => (
                        <li key={id} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            {t.open && <span className="size-2 rounded-full bg-accent" aria-label="Clocked in" />}
                            {t.name}
                          </span>
                          <span className="font-semibold tabular-nums">{formatHours(t.ms)}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </section>
            )}
          </div>

          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  render={<Link href={href({ week: addDays(weekStart, -7) })} aria-label="Previous week" />}
                  nativeButton={false}
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <h2 className="min-w-48 text-center font-semibold">
                  {formatDateShort(weekStart)} – {formatDateShort(addDays(weekStart, 6))}
                </h2>
                <Button
                  variant="outline"
                  size="icon"
                  render={<Link href={href({ week: weekEnd })} aria-label="Next week" />}
                  nativeButton={false}
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
              {view === 'team' && (
                <Button
                  variant="outline"
                  render={<a href={`/api/timesheets?week=${weekStart}`} download />}
                  nativeButton={false}
                >
                  <Download aria-hidden="true" />
                  Export CSV
                </Button>
              )}
            </div>

            <EntriesTable entries={entries} showName={view === 'team'} editable={view === 'team'} now={now} />
          </section>
        </div>
      </PageBody>
    </>
  )
}

function EntriesTable({
  entries,
  showName,
  editable,
  now,
}: {
  entries: EntryRow[]
  showName: boolean
  editable: boolean
  now: number
}) {
  if (entries.length === 0) {
    return <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">No time entries this week.</p>
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Day</th>
            {showName && <th scope="col" className="px-4 py-2.5 font-medium">Team member</th>}
            <th scope="col" className="px-4 py-2.5 font-medium">In</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Out</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Job</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Hours</th>
            {editable && <th scope="col" className="px-4 py-2.5"><span className="sr-only">Edit</span></th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {entries.map((e) => (
            <tr key={e.id}>
              <td className="px-4 py-2.5 whitespace-nowrap">{formatDateShort(localDateOf(e.clockIn))}</td>
              {showName && <td className="px-4 py-2.5 whitespace-nowrap">{e.userName}</td>}
              <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{formatClock(e.clockIn)}</td>
              <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                {e.clockOut ? formatClock(e.clockOut) : <span className="font-medium text-brand-red">On the clock</span>}
              </td>
              <td className="max-w-56 truncate px-4 py-2.5">
                {e.jobId ? (
                  <Link href={`/jobs/${e.jobId}`} className="underline underline-offset-4">
                    {e.jobTitle}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Yard / general</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatHours(entryDurationMs(e, now))}</td>
              {editable && (
                <td className="px-4 py-2.5 text-right">
                  <EntryEditDialog
                    entryId={e.id}
                    name={e.userName}
                    date={localDateOf(e.clockIn)}
                    clockIn={localTimeOf(e.clockIn)}
                    clockOutDate={e.clockOut ? localDateOf(e.clockOut) : ''}
                    clockOut={e.clockOut ? localTimeOf(e.clockOut) : ''}
                    notes={e.notes ?? ''}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
