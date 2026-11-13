import Link from 'next/link'
import { and, eq, gte, isNotNull, lte, ne, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { estimates, jobs, user } from '@/lib/db/schema'
import { formatMoney, todayLocal } from '@/lib/time'
import { cn } from '@/lib/utils'

export const PERFORMANCE_PERIODS = [
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: 'This quarter' },
  { id: 'year', label: 'This year' },
] as const

export type PerformancePeriod = (typeof PERFORMANCE_PERIODS)[number]['id']

function periodRange(period: PerformancePeriod) {
  const today = todayLocal()
  const [y, m] = today.split('-').map(Number)
  const startMonth = period === 'month' ? m : period === 'quarter' ? Math.floor((m - 1) / 3) * 3 + 1 : 1
  return { start: `${y}-${String(startMonth).padStart(2, '0')}-01`, end: today }
}

export async function SalespersonPerformance({ period }: { period: PerformancePeriod }) {
  const { start, end } = periodRange(period)
  const startTs = new Date(`${start}T00:00:00Z`)
  const endTs = new Date(`${end}T23:59:59Z`)

  const [people, estimateStats, jobStats] = await Promise.all([
    db.select({ id: user.id, name: user.name }).from(user).where(eq(user.isSalesperson, true)),
    db
      .select({
        salespersonId: estimates.salespersonId,
        quoted: sql<number>`count(*)::int`,
        quotedCents: sql<number>`coalesce(sum(${estimates.priceCents}), 0)::int`,
        won: sql<number>`count(*) filter (where ${estimates.status} in ('approved', 'scheduled'))::int`,
        wonCents: sql<number>`coalesce(sum(${estimates.priceCents}) filter (where ${estimates.status} in ('approved', 'scheduled')), 0)::int`,
        lost: sql<number>`count(*) filter (where ${estimates.status} = 'declined')::int`,
      })
      .from(estimates)
      .where(
        and(isNotNull(estimates.salespersonId), gte(estimates.createdAt, startTs), lte(estimates.createdAt, endTs)),
      )
      .groupBy(estimates.salespersonId),
    db
      .select({
        salespersonId: jobs.salespersonId,
        jobs: sql<number>`count(*)::int`,
        soldCents: sql<number>`coalesce(sum(${jobs.priceCents}), 0)::int`,
        completedCents: sql<number>`coalesce(sum(${jobs.priceCents}) filter (where ${jobs.status} = 'completed'), 0)::int`,
      })
      .from(jobs)
      .where(
        and(
          isNotNull(jobs.salespersonId),
          ne(jobs.status, 'canceled'),
          gte(jobs.scheduledDate, start),
          lte(jobs.scheduledDate, end),
        ),
      )
      .groupBy(jobs.salespersonId),
  ])

  const ids = new Set([...people.map((p) => p.id), ...estimateStats.map((e) => e.salespersonId!), ...jobStats.map((j) => j.salespersonId!)])
  const names = new Map(people.map((p) => [p.id, p.name]))
  const missing = [...ids].filter((id) => !names.has(id))
  if (missing.length) {
    const former = await db.select({ id: user.id, name: user.name }).from(user)
    for (const f of former) if (missing.includes(f.id)) names.set(f.id, f.name)
  }

  const rows = [...ids]
    .map((id) => {
      const e = estimateStats.find((x) => x.salespersonId === id)
      const j = jobStats.find((x) => x.salespersonId === id)
      const decided = (e?.won ?? 0) + (e?.lost ?? 0)
      return {
        id,
        name: names.get(id) ?? 'Former team member',
        quoted: e?.quoted ?? 0,
        quotedCents: e?.quotedCents ?? 0,
        won: e?.won ?? 0,
        wonCents: e?.wonCents ?? 0,
        closeRate: decided ? Math.round(((e?.won ?? 0) / decided) * 100) : null,
        jobs: j?.jobs ?? 0,
        soldCents: j?.soldCents ?? 0,
        completedCents: j?.completedCents ?? 0,
      }
    })
    .sort((a, b) => b.soldCents + b.wonCents - (a.soldCents + a.wonCents))

  return (
    <section aria-labelledby="sp-heading" className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="sp-heading" className="font-semibold">
            Salesperson performance
          </h2>
          <p className="text-sm text-muted-foreground">
            Estimates created and jobs scheduled in the period, credited to the salesperson picked on each.
          </p>
        </div>
        <nav aria-label="Period" className="flex gap-1 rounded-lg bg-muted p-1">
          {PERFORMANCE_PERIODS.map((p) => (
            <Link
              key={p.id}
              href={p.id === 'month' ? '/sales' : `/sales?period=${p.id}`}
              scroll={false}
              aria-current={p.id === period ? 'true' : undefined}
              className={cn(
                'rounded-md px-3 py-1 text-sm font-medium',
                p.id === period ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {p.label}
            </Link>
          ))}
        </nav>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No salespeople yet. Tick <span className="font-medium text-foreground">Salesperson</span> next to someone on{' '}
          <Link href="/hr/team" className="font-medium text-foreground underline underline-offset-4">
            Human Resources → Team access
          </Link>
          , then pick them on estimates and jobs.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">Salesperson</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Estimates</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Won</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Close rate</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Jobs</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Jobs sold</th>
                <th scope="col" className="py-2 text-right font-medium">Completed</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <th scope="row" className="py-2.5 pr-4 text-left font-medium">{r.name}</th>
                  <td className="py-2.5 pr-4 text-right">
                    {r.quoted}
                    <span className="block text-xs text-muted-foreground">{formatMoney(r.quotedCents)}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    {r.won}
                    <span className="block text-xs text-muted-foreground">{formatMoney(r.wonCents)}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-right">{r.closeRate == null ? '—' : `${r.closeRate}%`}</td>
                  <td className="py-2.5 pr-4 text-right">{r.jobs}</td>
                  <td className="py-2.5 pr-4 text-right font-mono font-semibold">{formatMoney(r.soldCents)}</td>
                  <td className="py-2.5 text-right font-mono">{formatMoney(r.completedCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
