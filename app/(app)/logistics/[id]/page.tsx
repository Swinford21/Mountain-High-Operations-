import Link from 'next/link'
import { notFound } from 'next/navigation'
import { asc, desc, eq } from 'drizzle-orm'
import { ChevronLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PageBody, PageHeader } from '@/components/page-header'
import { ConfirmDelete } from '@/components/action-feedback'
import { TruckForm } from '@/components/logistics/truck-form'
import { RepairDialog } from '@/components/logistics/repair-dialog'
import { WarrantyDialog } from '@/components/logistics/warranty-dialog'
import { ExpiryBadge } from '@/components/logistics/expiry-badge'
import { deleteRepair, deleteTruck, deleteWarranty } from '@/app/actions/logistics'
import { db } from '@/lib/db'
import { truckRepairs, trucks, truckWarranties, user } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/session'
import { formatDateShort, formatMoney, todayLocal } from '@/lib/time'

export const metadata = { title: 'Truck' }

function fullDate(d: string) {
  return `${formatDateShort(d)}, ${d.slice(0, 4)}`
}

export default async function TruckPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const truckId = Number(id)
  if (!Number.isInteger(truckId) || truckId <= 0) notFound()
  const today = todayLocal()

  const [[truck], repairs, warranties] = await Promise.all([
    db.select().from(trucks).where(eq(trucks.id, truckId)).limit(1),
    db
      .select({ repair: truckRepairs, loggedBy: user.name })
      .from(truckRepairs)
      .leftJoin(user, eq(user.id, truckRepairs.createdBy))
      .where(eq(truckRepairs.truckId, truckId))
      .orderBy(desc(truckRepairs.repairDate), desc(truckRepairs.id)),
    db
      .select()
      .from(truckWarranties)
      .where(eq(truckWarranties.truckId, truckId))
      .orderBy(asc(truckWarranties.endDate)),
  ])
  if (!truck) notFound()

  const totalCents = repairs.reduce((s, r) => s + (r.repair.coveredByWarranty ? 0 : (r.repair.costCents ?? 0)), 0)
  const vehicle = [truck.year, truck.make, truck.model].filter(Boolean).join(' ')

  return (
    <>
      <PageHeader
        eyebrow={vehicle || 'Truck'}
        title={truck.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ExpiryBadge date={truck.registrationExpires} today={today} label="Registration" />
            <ExpiryBadge date={truck.insuranceExpires} today={today} label="Insurance" />
          </span>
        }
        actions={
          <>
            <Link href="/logistics" className="flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
              <ChevronLeft className="size-4" aria-hidden="true" />
              All trucks
            </Link>
            <ConfirmDelete
              label="Delete truck"
              title={`Delete ${truck.name}?`}
              description="This removes the truck with its repair log and warranties. Jobs and crews using it will have no truck. To keep the history, mark it out of service instead."
              action={deleteTruck.bind(null, truck.id)}
            />
          </>
        }
      />
      <PageBody className="max-w-5xl">
        <section aria-labelledby="details-heading" className="flex flex-col gap-3">
          <h2 id="details-heading" className="font-semibold">
            Details
          </h2>
          <TruckForm truck={truck} />
        </section>

        <section aria-labelledby="repairs-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="repairs-heading" className="font-semibold">
                Repair log <span className="font-normal text-muted-foreground">({repairs.length})</span>
              </h2>
              <p className="text-sm text-muted-foreground">
                Out-of-pocket total:{' '}
                <span className="font-mono font-semibold text-foreground tabular-nums">{formatMoney(totalCents)}</span>
              </p>
            </div>
            <RepairDialog truckId={truck.id} truckName={truck.name} today={today} />
          </div>
          {repairs.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No repairs logged yet.</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-xl border bg-card">
              {repairs.map(({ repair: r, loggedBy }) => (
                <li key={r.id} className="flex items-start gap-4 px-4 py-3">
                  <span className="w-24 shrink-0 text-sm font-medium tabular-nums">{fullDate(r.repairDate)}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-pretty">{r.description}</span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      {r.vendor && <span>{r.vendor}</span>}
                      {r.mileage != null && <span className="tabular-nums">{r.mileage.toLocaleString('en-US')} mi</span>}
                      {loggedBy && <span>Logged by {loggedBy}</span>}
                      {r.coveredByWarranty && (
                        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                          Warranty
                        </Badge>
                      )}
                    </span>
                  </span>
                  <span
                    className={`w-20 shrink-0 text-right font-mono text-sm tabular-nums ${r.coveredByWarranty ? 'text-muted-foreground line-through' : 'font-semibold'}`}
                  >
                    {r.costCents != null ? formatMoney(r.costCents) : '—'}
                  </span>
                  <ConfirmDelete
                    iconOnly
                    label="Delete repair"
                    title="Delete this repair entry?"
                    description={r.description}
                    action={deleteRepair.bind(null, truck.id, r.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="warranty-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="warranty-heading" className="font-semibold">
              Warranties <span className="font-normal text-muted-foreground">({warranties.length})</span>
            </h2>
            <WarrantyDialog truckId={truck.id} />
          </div>
          {warranties.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No warranties on file.</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {warranties.map((w) => (
                <li key={w.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex flex-col">
                      <span className="font-semibold">{w.item}</span>
                      <span className="text-sm text-muted-foreground">
                        {[w.provider, w.policyNumber && `#${w.policyNumber}`].filter(Boolean).join(' · ') || 'No provider listed'}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <WarrantyDialog truckId={truck.id} warranty={w} />
                      <ConfirmDelete
                        iconOnly
                        label={`Delete ${w.item} warranty`}
                        title={`Delete the ${w.item} warranty?`}
                        description="This removes it from the truck's records."
                        action={deleteWarranty.bind(null, truck.id, w.id)}
                      />
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {w.endDate ? <ExpiryBadge date={w.endDate} today={today} /> : <Badge variant="outline">No end date</Badge>}
                    {w.mileageLimit != null && (
                      <span className="text-muted-foreground tabular-nums">
                        up to {w.mileageLimit.toLocaleString('en-US')} mi
                        {truck.mileage != null && w.mileageLimit > truck.mileage
                          ? ` (${(w.mileageLimit - truck.mileage).toLocaleString('en-US')} left)`
                          : truck.mileage != null
                            ? ' (over limit)'
                            : ''}
                      </span>
                    )}
                    {w.startDate && <span className="text-muted-foreground">from {fullDate(w.startDate)}</span>}
                  </div>
                  {w.coverage && <p className="text-sm leading-relaxed text-muted-foreground">{w.coverage}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </PageBody>
    </>
  )
}
