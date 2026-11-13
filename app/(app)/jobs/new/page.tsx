import { PageBody, PageHeader } from '@/components/page-header'
import { JobForm } from '@/components/jobs/job-form'
import { createJob } from '@/app/actions/jobs'
import { getOperations } from '@/lib/operations-server'
import {
  getCrewOptions,
  getCustomerOptions,
  getJobDetail,
  getJobItems,
  getProductOptions,
  getTeamMembers,
  getTrucks,
} from '@/lib/queries'
import { requireAdmin } from '@/lib/session'
import { formatDateLong, todayLocal } from '@/lib/time'

export const metadata = { title: 'Schedule a job' }

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; customer?: string; op?: string; from?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams
  const fromId = sp.from ? Number(sp.from) : NaN
  const [source, sourceItems] = Number.isInteger(fromId) && fromId > 0
    ? await Promise.all([getJobDetail(fromId), getJobItems(fromId)])
    : [null, []]
  const from = source?.job ?? null

  const customerId = from?.customerId ?? (sp.customer ? Number(sp.customer) : undefined)
  const [customers, team, products, trucks, crews, operations] = await Promise.all([
    getCustomerOptions(customerId),
    getTeamMembers(),
    getProductOptions(),
    getTrucks(),
    getCrewOptions(),
    getOperations(),
  ])
  const customer = customers[0]
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayLocal()

  return (
    <>
      <PageHeader
        eyebrow="Jobs"
        title={from ? 'Repeat an order' : 'Schedule a job'}
        description={
          from
            ? `Copied from job #${from.id} on ${formatDateLong(from.scheduledDate)}. Pick a new date and adjust anything that changed.`
            : undefined
        }
      />
      <PageBody className="max-w-5xl">
        <JobForm
          mode="create"
          action={createJob}
          customers={customers}
          team={team}
          trucks={trucks}
          crews={crews}
          operations={operations}
          products={products}
          initialItems={sourceItems.map((i) => ({
            productId: i.productId,
            name: i.name,
            unit: i.unit,
            quantity: Number(i.quantity),
            unitPriceCents: i.unitPriceCents,
          }))}
          defaults={
            from
              ? {
                  customerId: from.customerId,
                  operation: operations.find((o) => o.id === from.operation)?.id ?? operations[0]?.id,
                  title: from.title,
                  scheduledDate: date,
                  startTime: from.startTime,
                  durationMinutes: from.durationMinutes,
                  address: from.address ?? customer?.address ?? '',
                  assignedTo: from.assignedTo,
                  truckId: trucks.some((t) => t.id === from.truckId) ? from.truckId : null,
                  crewId: crews.some((c) => c.id === from.crewId) ? from.crewId : null,
                  priceCents: from.priceCents,
                  description: from.description,
                }
              : {
                  customerId: customer?.id,
                  address: customer?.address ?? '',
                  operation: operations.find((o) => o.id === sp.op)?.id ?? operations[0]?.id,
                  scheduledDate: date,
                }
          }
        />
      </PageBody>
    </>
  )
}
