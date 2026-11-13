import Link from 'next/link'
import { asc, sql } from 'drizzle-orm'
import { Truck, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PageBody, PageHeader } from '@/components/page-header'
import { ConfirmDelete } from '@/components/action-feedback'
import { OperationDialog } from '@/components/settings/operation-dialog'
import { CrewDialog } from '@/components/settings/crew-dialog'
import { deleteCrew, deleteOperation } from '@/app/actions/settings'
import { db } from '@/lib/db'
import { crewMembers, crews, jobs } from '@/lib/db/schema'
import { getAllOperations } from '@/lib/operations-server'
import { getTeamMembers, getTrucks } from '@/lib/queries'
import { requireAdmin } from '@/lib/session'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  await requireAdmin()
  const [operations, jobCounts, crewRows, memberRows, team, trucks] = await Promise.all([
    getAllOperations(),
    db.select({ operation: jobs.operation, count: sql<number>`count(*)::int` }).from(jobs).groupBy(jobs.operation),
    db.select().from(crews).orderBy(asc(crews.name)),
    db.select().from(crewMembers),
    getTeamMembers(),
    getTrucks(),
  ])

  const countByOp = new Map(jobCounts.map((r) => [r.operation, r.count]))
  const teamName = new Map(team.map((m) => [m.id, m.name]))
  const truckById = new Map(trucks.map((t) => [t.id, t]))
  const crewList = crewRows.map((c) => ({
    ...c,
    memberIds: memberRows.filter((m) => m.crewId === c.id).map((m) => m.userId),
  }))

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Settings"
        description="Set up the kinds of work you schedule and the crews that do it."
      />
      <PageBody className="max-w-4xl">
        <section aria-labelledby="ops-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="ops-heading" className="font-semibold">
                Operations
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Each job belongs to one operation. Its color is used on the calendar when no truck is assigned.
              </p>
            </div>
            <OperationDialog />
          </div>
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {operations.map((op) => {
              const count = countByOp.get(op.id) ?? 0
              return (
                <li key={op.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="size-4 shrink-0 rounded" style={{ backgroundColor: op.color }} aria-hidden="true" />
                    <span className="flex flex-col">
                      <span className="flex items-center gap-2 font-medium">
                        {op.label}
                        {!op.active && (
                          <Badge variant="outline" className="text-muted-foreground">
                            Off
                          </Badge>
                        )}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {op.singular} · {count} job{count === 1 ? '' : 's'}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <OperationDialog operation={op} />
                    {count === 0 && (
                      <ConfirmDelete
                        iconOnly
                        label={`Delete ${op.label}`}
                        title={`Delete ${op.label}?`}
                        description="No jobs use this operation, so it can be removed completely."
                        action={deleteOperation.bind(null, op.id)}
                      />
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <section aria-labelledby="crews-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="crews-heading" className="font-semibold">
                Crews
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Pick a crew on a job and its usual truck and lead fill in automatically.
              </p>
            </div>
            <CrewDialog team={team} trucks={trucks} />
          </div>
          {crewList.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              No crews yet. Create one to group your team for scheduling.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {crewList.map((c) => {
                const truck = c.truckId ? truckById.get(c.truckId) : undefined
                const members = c.memberIds.map((id) => teamName.get(id)).filter(Boolean)
                return (
                  <li key={c.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex flex-col">
                        <span className="flex items-center gap-2 font-semibold">
                          {c.name}
                          {!c.active && (
                            <Badge variant="outline" className="text-muted-foreground">
                              Inactive
                            </Badge>
                          )}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Lead: {(c.leadUserId && teamName.get(c.leadUserId)) || 'None'}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <CrewDialog crew={c} team={team} trucks={trucks} />
                        <ConfirmDelete
                          iconOnly
                          label={`Delete ${c.name}`}
                          title={`Delete ${c.name}?`}
                          description="Jobs assigned to this crew keep their people and truck but lose the crew label."
                          action={deleteCrew.bind(null, c.id)}
                        />
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5 text-sm">
                      <span className="flex items-start gap-2">
                        <Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="text-pretty">{members.length ? members.join(', ') : 'No members yet'}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Truck className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        {truck ? (
                          <span className="flex items-center gap-2">
                            <span className="size-2.5 rounded-sm" style={{ backgroundColor: truck.color }} aria-hidden="true" />
                            {truck.name}
                          </span>
                        ) : (
                          'No usual truck'
                        )}
                      </span>
                    </div>
                    {c.notes && <p className="text-sm leading-relaxed text-muted-foreground">{c.notes}</p>}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <p className="text-sm leading-relaxed text-muted-foreground">
          Manage trucks, repairs, and warranties in{' '}
          <Link href="/logistics" className="font-medium text-foreground underline underline-offset-4">
            Logistics
          </Link>
          . Approve new sign-ups on the{' '}
          <Link href="/hr/team" className="font-medium text-foreground underline underline-offset-4">
            Team
          </Link>{' '}
          page.
        </p>
      </PageBody>
    </>
  )
}
