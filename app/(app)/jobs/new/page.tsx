import Link from 'next/link'
import { PageBody, PageHeader } from '@/components/page-header'
import { JobForm } from '@/components/jobs/job-form'
import { createJob } from '@/app/actions/jobs'
import { getEstimateDetail, getEstimateItems } from '@/lib/estimates'
import { getOperations } from '@/lib/operations-server'
import {
  getCrewOptions,
  getCustomerOptions,
  getJobDetail,
  getJobItems,
  getProductOptions,
  getSalespeople,
  getTeamMembers,
  getTrucks,
} from '@/lib/queries'
import { requireAdmin } from '@/lib/session'
import { formatDateLong, todayLocal } from '@/lib/time'

export const metadata = { title: 'Schedule a job' }

function positiveId(v?: string) {
  const n = v ? Number(v) : NaN
  return Number.isInteger(n) && n > 0 ? n : null
}

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; customer?: string; op?: string; from?: string; estimate?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams
  const fromId = positiveId(sp.from)
  const estimateParam = positiveId(sp.estimate)

  const [source, sourceItems, estimateRow, estimateLines] = await Promise.all([
    fromId ? getJobDetail(fromId) : null,
    fromId ? getJobItems(fromId) : [],
    estimateParam ? getEstimateDetail(estimateParam) : null,
    estimateParam ? getEstimateItems(estimateParam) : [],
  ])
  const from = source?.job ?? null
  const estimate = estimateRow?.estimate.status === 'approved' ? estimateRow.estimate : null

  const customerId = estimate?.customerId ?? from?.customerId ?? (sp.customer ? Number(sp.customer) : undefined)
  const [customers, team, products, trucks, crews, operations, salespeople] = await Promise.all([
    getCustomerOptions(customerId),
    getTeamMembers(),
    getProductOptions(),
    getTrucks(),
    getCrewOptions(),
    getOperations(),
    getSalespeople(),
  ])
  const customer = customers[0]
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayLocal()
  const opFor = (id?: string | null) => operations.find((o) => o.id === id)?.id ?? operations[0]?.id
  const lines = (estimate ? estimateLines : sourceItems).map((i) => ({
    productId: i.productId,
    name: i.name,
    unit: i.unit,
    quantity: Number(i.quantity),
    unitPriceCents: i.unitPriceCents,
  }))

  const defaults = estimate
    ? {
        customerId: estimate.customerId,
        operation: opFor(estimate.operation),
        title: estimate.title,
        scheduledDate: date,
        address: estimate.address ?? customer?.address ?? '',
        priceCents: estimate.priceCents,
        description: estimate.description,
        salespersonId: estimate.salespersonId,
      }
    : from
      ? {
          customerId: from.customerId,
          operation: opFor(from.operation),
          title: from.title,
          scheduledDate: date,
          startTime: from.startTime,
          durationMinutes: from.durationMinutes,
          address: from.address ?? customer?.address ?? '',
          assignedTo: from.assignedTo,
          truckId: trucks.some((t) => t.id === from.truckId) ? from.truckId : null,
          crewId: crews.some((c) => c.id === from.crewId) ? from.crewId : null,
          salespersonId: from.salespersonId,
          priceCents: from.priceCents,
          description: from.description,
        }
      : {
          customerId: customer?.id,
          address: customer?.address ?? '',
          operation: opFor(sp.op),
          scheduledDate: date,
        }

  return (
    <>
      <PageHeader
        eyebrow="Jobs"
        title={estimate ? 'Schedule approved estimate' : from ? 'Repeat an order' : 'Schedule a job'}
        description={
          estimate ? (
            <>
              From{' '}
              <Link href={`/estimates/${estimate.id}`} className="underline underline-offset-4">
                estimate #{estimate.id}
              </Link>
              . Pick a date and crew — the estimate leaves the Unscheduled list once this job is saved.
            </>
          ) : from ? (
            `Copied from job #${from.id} on ${formatDateLong(from.scheduledDate)}. Pick a new date and adjust anything that changed.`
          ) : undefined
        }
      />
      <PageBody className="max-w-5xl">
        {estimateParam && !estimate && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
            That estimate isn&apos;t waiting to be scheduled — it may already be booked or not yet approved.
          </p>
        )}
        <JobForm
          mode="create"
          action={createJob}
          customers={customers}
          team={team}
          trucks={trucks}
          crews={crews}
          operations={operations}
          products={products}
          salespeople={salespeople}
          estimateId={estimate?.id}
          initialItems={lines}
          defaults={defaults}
        />
      </PageBody>
    </>
  )
}
