import Link from 'next/link'
import { asc, sql } from 'drizzle-orm'
import { Badge } from '@/components/ui/badge'
import { PageBody, PageHeader } from '@/components/page-header'
import { RoleControl } from '@/components/team/role-control'
import { PasswordDialog } from '@/components/team/password-dialog'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/session'
import { formatTimestamp } from '@/lib/time'

export const metadata = { title: 'Team' }

export default async function TeamPage() {
  const me = await requireAdmin()
  const viewerIsOwner = me.role === 'owner'
  const members = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt })
    .from(user)
    .orderBy(
      sql`case ${user.role} when 'pending' then 0 when 'owner' then 1 when 'admin' then 2 else 3 end`,
      asc(user.name),
    )

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
                  <span className="flex items-center gap-2 font-medium">
                    {m.name}
                    {m.id === me.id && <span className="text-muted-foreground">(you)</span>}
                    {m.role === 'owner' && (
                      <Badge variant="outline" className="border-brand-gold/50 text-foreground">
                        Owner
                      </Badge>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">{m.email}</span>
                </span>
                <span className="flex items-center gap-2">
                  {viewerIsOwner && <PasswordDialog userId={m.id} name={m.name} isSelf={m.id === me.id} />}
                  <RoleControl userId={m.id} role={m.role} isSelf={m.id === me.id} viewerIsOwner={viewerIsOwner} />
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Owners can do everything admins can, plus reset passwords and manage other owners. Admins manage jobs,
            customers, payments, marketing, HR, logistics, and timesheets. Crew can see the schedule, update job status,
            and use the time clock.
          </p>
        </section>

        <p className="text-sm leading-relaxed text-muted-foreground">
          Trucks and their colors are now managed in{' '}
          <Link href="/logistics" className="font-medium text-foreground underline underline-offset-4">
            Logistics
          </Link>
          , and crews in{' '}
          <Link href="/settings" className="font-medium text-foreground underline underline-offset-4">
            Settings
          </Link>
          .
        </p>
      </PageBody>
    </>
  )
}
