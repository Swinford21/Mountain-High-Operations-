import { asc, sql } from 'drizzle-orm'
import { PageBody, PageHeader } from '@/components/page-header'
import { RoleControl } from '@/components/team/role-control'
import { TruckColorControl } from '@/components/team/truck-color-control'
import { getTrucks } from '@/lib/queries'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/session'
import { formatTimestamp } from '@/lib/time'

export const metadata = { title: 'Team' }

export default async function TeamPage() {
  const me = await requireAdmin()
  const members = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt })
    .from(user)
    .orderBy(sql`case ${user.role} when 'pending' then 0 when 'admin' then 1 else 2 end`, asc(user.name))

  const fleet = await getTrucks()
  const pending = members.filter((m) => m.role === 'pending')
  const active = members.filter((m) => m.role !== 'pending')

  return (
    <>
      <PageHeader
        eyebrow="Access"
        title="Team"
        description="Crew members create an account on the sign-up page, then you approve them here."
      />
      <PageBody className="max-w-4xl">
        {pending.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">Waiting for approval</h2>
            <ul className="flex flex-col divide-y rounded-xl border border-accent bg-card">
              {pending.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span className="flex flex-col">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {m.email} · signed up {formatTimestamp(m.createdAt)}
                    </span>
                  </span>
                  <RoleControl userId={m.id} role={m.role} isSelf={false} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Team members</h2>
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {active.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="flex flex-col">
                  <span className="font-medium">
                    {m.name}
                    {m.id === me.id && <span className="text-muted-foreground"> (you)</span>}
                  </span>
                  <span className="text-sm text-muted-foreground">{m.email}</span>
                </span>
                <RoleControl userId={m.id} role={m.role} isSelf={m.id === me.id} />
              </li>
            ))}
          </ul>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Admins manage jobs, customers, payments, marketing, and timesheets. Crew can see the schedule, update job
            status, and use the time clock.
          </p>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="trucks-heading">
          <h2 id="trucks-heading" className="font-semibold">
            Trucks
          </h2>
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {fleet.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex items-center gap-3 font-medium">
                  <span className="size-3 rounded-sm" style={{ backgroundColor: t.color }} aria-hidden="true" />
                  {t.name}
                </span>
                <TruckColorControl truckId={t.id} name={t.name} color={t.color} />
              </li>
            ))}
          </ul>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Jobs assigned to a truck show in that truck&apos;s color on the calendar. Jobs with no truck keep their
            operation color.
          </p>
        </section>
      </PageBody>
    </>
  )
}
