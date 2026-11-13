import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageBody, PageHeader } from '@/components/page-header'
import { OperationFilter } from '@/components/calendar/operation-filter'
import { JobCard } from '@/components/jobs/job-card'
import { getOperations } from '@/lib/operations-server'
import { getJobsInRange, type JobListItem } from '@/lib/queries'
import { isAdminRole, requireUser } from '@/lib/session'
import { addDays, formatDateLong, todayLocal } from '@/lib/time'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Jobs' }

const VIEWS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past 60 days' },
] as const

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; ops?: string; mine?: string }>
}) {
  const me = await requireUser()
  const sp = await searchParams
  const view = sp.view === 'past' ? 'past' : 'upcoming'
  const mine = sp.mine === '1'
  const operations = await getOperations()
  const ops = (sp.ops ?? '').split(',').filter((o) => operations.some((op) => op.id === o))
  const today = todayLocal()

  const jobs = await getJobsInRange({
    start: view === 'past' ? addDays(today, -60) : today,
    end: view === 'past' ? addDays(today, -1) : addDays(today, 365),
    operations: ops,
    assignedTo: mine ? me.id : undefined,
    includeCanceled: true,
  })
  if (view === 'past') jobs.reverse()

  const groups = new Map<string, JobListItem[]>()
  for (const j of jobs) {
    const list = groups.get(j.scheduledDate) ?? []
    list.push(j)
    groups.set(j.scheduledDate, list)
  }

  const href = (o: Partial<{ view: string; ops: string[]; mine: boolean }>) => {
    const p = new URLSearchParams()
    const v = o.view ?? view
    const op = o.ops ?? ops
    const mi = o.mine ?? mine
    if (v !== 'upcoming') p.set('view', v)
    if (op.length) p.set('ops', op.join(','))
    if (mi) p.set('mine', '1')
    const qs = p.toString()
    return qs ? `/jobs?${qs}` : '/jobs'
  }

  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title="Jobs"
        description={`${jobs.length} ${view === 'past' ? 'past' : 'upcoming'} job${jobs.length === 1 ? '' : 's'}`}
        actions={
          isAdminRole(me.role) && (
            <Button render={<Link href="/jobs/new" />} nativeButton={false} className="h-9">
              <Plus aria-hidden="true" />
              Schedule job
            </Button>
          )
        }
      />
      <PageBody>
        <div className="flex flex-col gap-4">
          <div role="tablist" aria-label="Time range" className="flex gap-1 self-start rounded-lg bg-muted p-1">
            {VIEWS.map((v) => (
              <Link
                key={v.id}
                role="tab"
                aria-selected={view === v.id}
                href={href({ view: v.id })}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium',
                  view === v.id ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {v.label}
              </Link>
            ))}
          </div>
          <OperationFilter operations={operations} selected={ops} hrefFor={(o) => href({ ops: o })} mine={mine} mineHref={href({ mine: !mine })} />
        </div>

        {jobs.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">No jobs match these filters.</p>
        ) : (
          <div className="flex flex-col gap-8">
            {[...groups.entries()].map(([date, list]) => (
              <section key={date} className="flex flex-col gap-2">
                <h2 className="flex items-baseline gap-3 text-sm font-semibold">
                  {date === today ? 'Today' : formatDateLong(date)}
                  <span className="font-normal text-muted-foreground">{list.length}</span>
                </h2>
                <div className="grid gap-2 lg:grid-cols-2">
                  {list.map((j) => (
                    <JobCard key={j.id} job={j} showPayment={isAdminRole(me.role)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </PageBody>
    </>
  )
}
