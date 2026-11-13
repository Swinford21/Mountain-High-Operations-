import Link from 'next/link'
import { asc, ne } from 'drizzle-orm'
import { Mail, Phone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PageBody, PageHeader } from '@/components/page-header'
import { ConfirmDelete } from '@/components/action-feedback'
import { EmployeeDialog } from '@/components/hr/employee-dialog'
import { MilestoneList } from '@/components/hr/milestone-list'
import { deleteEmployee } from '@/app/actions/hr'
import { db } from '@/lib/db'
import { employees, user } from '@/lib/db/schema'
import { tenureLabel, upcomingMilestones } from '@/lib/hr'
import { requireAdmin } from '@/lib/session'
import { formatDateShort, formatMoney } from '@/lib/time'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Human Resources' }

const REMINDER_WINDOW_DAYS = 30

function fullDate(d: string | null) {
  return d ? `${formatDateShort(d)}, ${d.slice(0, 4)}` : '—'
}

export default async function HrPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin()
  const sp = await searchParams
  const showInactive = sp.show === 'all'

  const [rows, logins] = await Promise.all([
    db.select().from(employees).orderBy(asc(employees.name)),
    db.select({ id: user.id, name: user.name, email: user.email }).from(user).where(ne(user.role, 'pending')).orderBy(asc(user.name)),
  ])
  const active = rows.filter((e) => e.status === 'active')
  const listed = showInactive ? rows : active
  const milestones = upcomingMilestones(active, REMINDER_WINDOW_DAYS)
  const birthdays = milestones.filter((m) => m.kind === 'birthday')
  const anniversaries = milestones.filter((m) => m.kind === 'anniversary')
  const linkedIds = new Set(rows.map((e) => e.userId).filter(Boolean))
  const unlinked = logins.filter((l) => !linkedIds.has(l.id))

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Human Resources"
        description="Employee hire records with birthday and work anniversary reminders."
        actions={<EmployeeDialog logins={logins} />}
      />
      <PageBody>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section aria-labelledby="emp-heading" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="emp-heading" className="font-semibold">
                Employees <span className="font-normal text-muted-foreground">({listed.length})</span>
              </h2>
              <div role="tablist" aria-label="Show employees" className="flex gap-1 rounded-lg bg-muted p-1">
                {[
                  { id: 'active', label: 'Active', href: '/hr' },
                  { id: 'all', label: 'All', href: '/hr?show=all' },
                ].map((t) => {
                  const selected = (t.id === 'all') === showInactive
                  return (
                    <Link
                      key={t.id}
                      href={t.href}
                      role="tab"
                      aria-selected={selected}
                      className={cn(
                        'rounded-md px-3 py-1 text-sm font-medium',
                        selected ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {t.label}
                    </Link>
                  )
                })}
              </div>
            </div>

            {listed.length === 0 ? (
              <div className="flex flex-col gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                <p>No employee records yet.</p>
                {unlinked.length > 0 && (
                  <p>
                    Tip: choose an app login when adding someone and their name and email fill in automatically.
                  </p>
                )}
              </div>
            ) : (
              <ul className="flex flex-col divide-y rounded-xl border bg-card">
                {listed.map((e) => (
                  <li key={e.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{e.name}</span>
                        {e.position && <span className="text-sm text-muted-foreground">{e.position}</span>}
                        {e.status !== 'active' && (
                          <Badge variant="outline" className="text-muted-foreground">
                            Former{e.terminationDate ? ` · left ${fullDate(e.terminationDate)}` : ''}
                          </Badge>
                        )}
                        {!e.userId && (
                          <Badge variant="outline" className="text-muted-foreground">
                            No app login
                          </Badge>
                        )}
                      </span>
                      <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {e.phone && (
                          <a href={`tel:${e.phone}`} className="flex items-center gap-1 hover:text-foreground">
                            <Phone className="size-3.5" aria-hidden="true" />
                            {e.phone}
                          </a>
                        )}
                        {e.email && (
                          <a href={`mailto:${e.email}`} className="flex min-w-0 items-center gap-1 hover:text-foreground">
                            <Mail className="size-3.5" aria-hidden="true" />
                            <span className="truncate">{e.email}</span>
                          </a>
                        )}
                      </span>
                      <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                        <div>
                          <dt className="text-xs text-muted-foreground">Hired</dt>
                          <dd>{fullDate(e.hireDate)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Tenure</dt>
                          <dd>{e.status === 'active' ? (tenureLabel(e.hireDate) ?? '—') : '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Birthday</dt>
                          <dd>{e.birthDate ? formatDateShort(e.birthDate) : '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Pay</dt>
                          <dd className="font-mono tabular-nums">
                            {e.payRateCents != null
                              ? `${formatMoney(e.payRateCents)}${e.payType === 'hourly' ? '/hr' : e.payType === 'salary' ? '/yr' : ''}`
                              : '—'}
                          </dd>
                        </div>
                      </dl>
                      {e.emergencyContactName && (
                        <p className="text-sm text-muted-foreground">
                          Emergency: {e.emergencyContactName}
                          {e.emergencyContactPhone ? ` · ${e.emergencyContactPhone}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
                      <EmployeeDialog employee={e} logins={logins} />
                      <ConfirmDelete
                        iconOnly
                        label={`Delete ${e.name}`}
                        title={`Delete ${e.name}'s record?`}
                        description="This permanently removes their HR record. To keep their history, mark them as no longer employed instead."
                        action={deleteEmployee.bind(null, e.id)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="flex flex-col gap-6">
            <section aria-labelledby="bday-heading" className="flex flex-col gap-4 rounded-xl border bg-card p-5">
              <div className="flex flex-col gap-1">
                <h2 id="bday-heading" className="font-semibold">
                  Upcoming birthdays
                </h2>
                <p className="text-sm text-muted-foreground">Next {REMINDER_WINDOW_DAYS} days</p>
              </div>
              <MilestoneList items={birthdays} empty="No birthdays coming up." />
            </section>
            <section aria-labelledby="anniv-heading" className="flex flex-col gap-4 rounded-xl border bg-card p-5">
              <div className="flex flex-col gap-1">
                <h2 id="anniv-heading" className="font-semibold">
                  Work anniversaries
                </h2>
                <p className="text-sm text-muted-foreground">Next {REMINDER_WINDOW_DAYS} days</p>
              </div>
              <MilestoneList items={anniversaries} empty="No anniversaries coming up." />
            </section>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Reminders also show on the Today page for admins during the week of each date.
            </p>
          </aside>
        </div>
      </PageBody>
    </>
  )
}
