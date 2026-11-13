import Link from 'next/link'
import { asc, desc, sql } from 'drizzle-orm'
import { AlertTriangle, Gauge, Plus, ShieldCheck, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageBody, PageHeader } from '@/components/page-header'
import { expiryStatus } from '@/components/logistics/expiry-badge'
import { db } from '@/lib/db'
import { truckRepairs, trucks, truckWarranties } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/session'
import { formatDateShort, formatMoney, todayLocal } from '@/lib/time'

export const metadata = { title: 'Logistics' }

type Alert = { truckId: number; truckName: string; text: string; expired: boolean }

export default async function LogisticsPage() {
  await requireAdmin()
  const today = todayLocal()
  const yearStart = `${today.slice(0, 4)}-01-01`

  const [fleet, repairStats, warranties] = await Promise.all([
    db.select().from(trucks).orderBy(desc(trucks.active), asc(trucks.sortOrder), asc(trucks.name)),
    db
      .select({
        truckId: truckRepairs.truckId,
        count: sql<number>`count(*)::int`,
        lastDate: sql<string | null>`max(${truckRepairs.repairDate})::text`,
        ytdCents: sql<number>`coalesce(sum(${truckRepairs.costCents}) filter (where ${truckRepairs.repairDate} >= ${yearStart} and not ${truckRepairs.coveredByWarranty}), 0)::int`,
      })
      .from(truckRepairs)
      .groupBy(truckRepairs.truckId),
    db.select().from(truckWarranties),
  ])

  const statsByTruck = new Map(repairStats.map((r) => [r.truckId, r]))
  const alerts: Alert[] = []
  for (const t of fleet.filter((t) => t.active)) {
    for (const [label, date] of [
      ['Registration', t.registrationExpires],
      ['Insurance', t.insuranceExpires],
    ] as const) {
      const s = expiryStatus(date, today)
      if ((s === 'expired' || s === 'soon') && date)
        alerts.push({
          truckId: t.id,
          truckName: t.name,
          text: `${label} ${s === 'expired' ? 'expired' : 'expires'} ${formatDateShort(date)}`,
          expired: s === 'expired',
        })
    }
  }
  for (const w of warranties) {
    const t = fleet.find((f) => f.id === w.truckId)
    const s = expiryStatus(w.endDate, today)
    if (t?.active && (s === 'soon' || (s === 'expired' && w.endDate && w.endDate >= yearStart)) && w.endDate)
      alerts.push({
        truckId: t.id,
        truckName: t.name,
        text: `${w.item} warranty ${s === 'expired' ? 'expired' : 'expires'} ${formatDateShort(w.endDate)}`,
        expired: s === 'expired',
      })
  }
  const ytdTotal = repairStats.reduce((sum, r) => sum + r.ytdCents, 0)

  return (
    <>
      <PageHeader
        eyebrow="Fleet"
        title="Logistics"
        description="Trucks, repair history, and warranty coverage."
        actions={
          <Button render={<Link href="/logistics/new" />} nativeButton={false} className="h-9">
            <Plus aria-hidden="true" />
            Add truck
          </Button>
        }
      />
      <PageBody>
        {alerts.length > 0 && (
          <section
            aria-labelledby="alerts-heading"
            className="flex flex-col gap-3 rounded-xl border border-accent bg-accent/20 p-5"
          >
            <h2 id="alerts-heading" className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4" aria-hidden="true" />
              Needs attention
            </h2>
            <ul className="flex flex-col gap-1.5 text-sm">
              {alerts.map((a, i) => (
                <li key={i}>
                  <Link href={`/logistics/${a.truckId}`} className="hover:underline">
                    <span className="font-medium">{a.truckName}</span>
                    {' · '}
                    <span className={a.expired ? 'font-medium text-destructive' : undefined}>{a.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-semibold">
            Fleet <span className="font-normal text-muted-foreground">({fleet.length})</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Repair spend this year (excluding warranty):{' '}
            <span className="font-mono font-semibold text-foreground tabular-nums">{formatMoney(ytdTotal)}</span>
          </p>
        </div>

        {fleet.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No trucks yet.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {fleet.map((t) => {
              const stats = statsByTruck.get(t.id)
              const activeWarranties = warranties.filter(
                (w) => w.truckId === t.id && (expiryStatus(w.endDate, today) === 'ok' || expiryStatus(w.endDate, today) === 'soon' || !w.endDate),
              ).length
              const vehicle = [t.year, t.make, t.model].filter(Boolean).join(' ')
              return (
                <li key={t.id}>
                  <Link
                    href={`/logistics/${t.id}`}
                    className="group flex h-full flex-col gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-foreground"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-1 size-4 shrink-0 rounded" style={{ backgroundColor: t.color }} aria-hidden="true" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center gap-2">
                          <span className="font-display text-xl font-extrabold tracking-wide uppercase group-hover:underline">
                            {t.name}
                          </span>
                          {!t.active && (
                            <Badge variant="outline" className="text-muted-foreground">
                              Out of service
                            </Badge>
                          )}
                        </span>
                        <span className="truncate text-sm text-muted-foreground">
                          {vehicle || 'Add year, make and model'}
                          {t.plate ? ` · ${t.plate.toUpperCase()}` : ''}
                        </span>
                      </span>
                    </div>
                    <dl className="grid grid-cols-3 gap-3 border-t pt-4 text-sm">
                      <div className="flex flex-col gap-1">
                        <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Gauge className="size-3.5" aria-hidden="true" />
                          Miles
                        </dt>
                        <dd className="font-mono font-semibold tabular-nums">{t.mileage?.toLocaleString('en-US') ?? '—'}</dd>
                      </div>
                      <div className="flex flex-col gap-1">
                        <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Wrench className="size-3.5" aria-hidden="true" />
                          Last repair
                        </dt>
                        <dd className="font-medium">{stats?.lastDate ? formatDateShort(stats.lastDate) : '—'}</dd>
                      </div>
                      <div className="flex flex-col gap-1">
                        <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                          <ShieldCheck className="size-3.5" aria-hidden="true" />
                          Warranties
                        </dt>
                        <dd className="font-medium">{activeWarranties} active</dd>
                      </div>
                    </dl>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </PageBody>
    </>
  )
}
