import Link from 'next/link'
import { and, eq, sql } from 'drizzle-orm'
import { CalendarClock, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageBody, PageHeader } from '@/components/page-header'
import { JobCard } from '@/components/jobs/job-card'
import { ClockCard } from '@/components/time/clock-card'
import { SendRemindersButton } from '@/components/jobs/send-reminders-button'
import { MilestoneList } from '@/components/hr/milestone-list'
import { getUpcomingMilestones } from '@/lib/hr'
import { countUnscheduledEstimates } from '@/lib/estimates'
import { db } from '@/lib/db'
import { jobs, user as userTable } from '@/lib/db/schema'
import { findOperation } from '@/lib/operations'
import { getOperations } from '@/lib/operations-server'
import { getJobsInRange } from '@/lib/queries'
import { isAdminRole, requireUser } from '@/lib/session'
import { clockProps, getClockedInNow, getOpenEntry, getTodayWorkedMs } from '@/lib/time-queries'
import { addDays, formatClock, formatDateLong, formatHours, todayLocal, zonedNow } from '@/lib/time'

export const metadata = { title: 'Today' }

export default async function TodayPage() {
  const me = await requireUser()
  const isAdmin = isAdminRole(me.role)
  const today = todayLocal()
  const tomorrow = addDays(today, 1)

  const [todayJobs, openEntry, workedMs] = await Promise.all([
    getJobsInRange({ start: today, end: today }),
    getOpenEntry(me.id),
    getTodayWorkedMs(me.id),
  ])

  const myJobs = todayJobs.filter((j) => j.assignedTo === me.id)
  const otherJobs = todayJobs.filter((j) => j.assignedTo !== me.id)
  const jobOptions = todayJobs.map((j) => ({
    id: j.id,
    label: `${j.startTime} · ${j.operationSingular ?? findOperation([], j.operation).singular} · ${j.customerName}`,
  }))

  const firstName = me.name.split(' ')[0]
  const hour = zonedNow().hour
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <PageHeader
        eyebrow={formatDateLong(today)}
        title={`${greeting}, ${firstName}`}
        description={
          todayJobs.length === 0
            ? 'No jobs on the schedule today.'
            : `${todayJobs.length} job${todayJobs.length === 1 ? '' : 's'} on the schedule today${myJobs.length ? `, ${myJobs.length} assigned to you` : ''}.`
        }
        actions={
          isAdmin && (
            <Button render={<Link href="/jobs/new" />} nativeButton={false} className="h-9">
              <Plus aria-hidden="true" />
              Schedule job
            </Button>
          )
        }
      />
      <PageBody>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-8">
            {myJobs.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="font-semibold">Your jobs</h2>
                <div className="flex flex-col gap-2">
                  {myJobs.map((j) => (
                    <JobCard key={j.id} job={j} showPayment={isAdmin} />
                  ))}
                </div>
              </section>
            )}
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{myJobs.length ? 'Rest of the crew' : "Today's schedule"}</h2>
                <Link href="/calendar" className="text-sm font-medium underline underline-offset-4">
                  Full calendar
                </Link>
              </div>
              {otherJobs.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  {myJobs.length ? 'Nothing else scheduled today.' : 'Nothing scheduled today.'}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {otherJobs.map((j) => (
                    <JobCard key={j.id} job={j} showPayment={isAdmin} />
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            <ClockCard openEntry={clockProps(openEntry)} jobOptions={jobOptions} todayTotalLabel={formatHours(workedMs)} />
            {isAdmin && <AdminPanel tomorrow={tomorrow} todayCounts={todayJobs} />}
          </aside>
        </div>
      </PageBody>
    </>
  )
}

async function AdminPanel({
  tomorrow,
  todayCounts,
}: {
  tomorrow: string
  todayCounts: { operation: string }[]
}) {
  const [clockedIn, [reminders], [pendingUsers], operations, milestones, unscheduled] = await Promise.all([
    getClockedInNow(),
    db
      .select({
        total: sql<number>`count(*)::int`,
        remaining: sql<number>`count(*) filter (where ${jobs.reminderSentAt} is null)::int`,
      })
      .from(jobs)
      .where(and(eq(jobs.scheduledDate, tomorrow), eq(jobs.status, 'scheduled'))),
    db.select({ count: sql<number>`count(*)::int` }).from(userTable).where(eq(userTable.role, 'pending')),
    getOperations(),
    getUpcomingMilestones(7),
    countUnscheduledEstimates(),
  ])

  const byOp = operations.map((op) => ({ ...op, count: todayCounts.filter((j) => j.operation === op.id).length }))

  return (
    <>
      {unscheduled > 0 && (
        <Link
          href="/unscheduled"
          className="flex items-center justify-between gap-3 rounded-xl border border-accent bg-accent/20 p-5 hover:bg-accent/30"
        >
          <span className="flex flex-col">
            <span className="font-semibold">
              {unscheduled} approved estimate{unscheduled === 1 ? '' : 's'} to schedule
            </span>
            <span className="text-sm text-muted-foreground">Open the Unscheduled list to book them.</span>
          </span>
          <CalendarClock className="size-5 shrink-0" aria-hidden="true" />
        </Link>
      )}

      {milestones.length > 0 && (
        <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Birthdays &amp; anniversaries</h2>
            <Link href="/hr" className="text-sm font-medium underline underline-offset-4">
              HR
            </Link>
          </div>
          <MilestoneList items={milestones} empty="" />
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Today by operation</h2>
        <ul className="flex flex-col gap-2">
          {byOp.map((op) => (
            <li key={op.id} className="flex items-center justify-between text-sm">
              <Link href={`/calendar?ops=${op.id}`} className="flex items-center gap-2 hover:underline">
                <span className="size-2.5 rounded-sm" style={{ backgroundColor: op.color }} aria-hidden="true" />
                {op.label}
              </Link>
              <span className="font-mono tabular-nums">{op.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">On the clock now</h2>
        {clockedIn.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody is clocked in.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {clockedIn.map((c) => (
              <li key={c.userId} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{c.name}</span>
                  <span className="truncate text-muted-foreground">{c.jobTitle ?? 'Yard / general'}</span>
                </span>
                <span className="font-mono text-muted-foreground tabular-nums">{formatClock(c.clockIn)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/time" className="text-sm font-medium underline underline-offset-4">
          Timesheets
        </Link>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Tomorrow&apos;s reminders</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {reminders.total === 0
            ? 'No jobs scheduled tomorrow.'
            : `${reminders.total - reminders.remaining} of ${reminders.total} customers reminded. The rest go out automatically at 4pm.`}
        </p>
        {reminders.remaining > 0 && <SendRemindersButton />}
      </section>

      {pendingUsers.count > 0 && (
        <Link
          href="/hr/team"
          className="flex items-center justify-between rounded-xl border border-accent bg-accent/25 p-5 text-sm font-medium"
        >
          {pendingUsers.count} team member{pendingUsers.count === 1 ? '' : 's'} waiting for approval
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </>
  )
}
