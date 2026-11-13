import Link from 'next/link'
import { asc, sql } from 'drizzle-orm'
import { Badge } from '@/components/ui/badge'
import { PageBody, PageHeader } from '@/components/page-header'
import { HrTabs } from '@/components/hr/hr-tabs'
import { RoleControl } from '@/components/team/role-control'
import { PasswordDialog } from '@/components/team/password-dialog'
import { SalespersonToggle } from '@/components/team/salesperson-toggle'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/session'
import { formatTimestamp } from '@/lib/time'

export const metadata = { title: 'Team access' }

const ACCESS_LEVELS = [
  { role: 'Owner', detail: 'Everything, plus reset passwords and manage other owners.' },
  { role: 'Admin', detail: 'Jobs, customers, estimates, sales, payments, marketing, HR, logistics, and timesheets.' },
  { role: 'Manager', detail: 'Same as Admin — schedules jobs and sees sales.' },
  { role: 'Installer', detail: 'Schedule and job details only. Updates job status, adds crew notes and photos, uses the time clock. No sales or prices.' },
  { role: 'Driver', detail: 'Same as Installer — schedule and job details only. No sales or prices.' },
]

export default async function TeamAccessPage() {
  const me = await requireAdmin()
  const viewerIsOwner = me.role === 'owner'
  const members = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isSalesperson: user.isSalesperson,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(
      sql`case ${user.role} when 'pending' then 0 when 'owner' then 1 when 'admin' then 2 when 'manager' then 3 when 'installer' then 4 when 'driver' then 5 else 6 end`,
      asc(user.name),
    )

  const pending = members.filter((m) => m.role === 'pending')
  const active = members.filter((m) => m.role !== 'pending')

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Human Resources"
        description="Team members create an account on the sign-up page, then you approve them here and choose their access."
      />
      <PageBody className="max-w-4xl">
        <HrTabs current="team" pendingCount={pending.length} />

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
                  <RoleControl userId={m.id} role={m.role} isSelf={false} viewerIsOwner={viewerIsOwner} />
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
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {m.name}
                    {m.id === me.id && <span className="text-muted-foreground">(you)</span>}
                    {m.isSalesperson && (
                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                        Sales
                      </Badge>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">{m.email}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <SalespersonToggle userId={m.id} name={m.name} checked={m.isSalesperson} />
                  {viewerIsOwner && <PasswordDialog userId={m.id} name={m.name} isSelf={m.id === me.id} />}
                  <RoleControl userId={m.id} role={m.role} isSelf={m.id === me.id} viewerIsOwner={viewerIsOwner} />
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">What each access level can do</h2>
          <dl className="flex flex-col gap-2 text-sm">
            {ACCESS_LEVELS.map((a) => (
              <div key={a.role} className="grid gap-1 sm:grid-cols-[100px_1fr]">
                <dt className="font-medium">{a.role}</dt>
                <dd className="leading-relaxed text-muted-foreground">{a.detail}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Tick <span className="font-medium text-foreground">Salesperson</span> for anyone who sells. They can then be
            credited on estimates and jobs, and their totals show on the{' '}
            <Link href="/sales" className="font-medium text-foreground underline underline-offset-4">
              Sales
            </Link>{' '}
            page.
          </p>
        </section>
      </PageBody>
    </>
  )
}
