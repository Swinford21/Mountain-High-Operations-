import { notFound } from 'next/navigation'
import { PageBody, PageHeader } from '@/components/page-header'
import { JobForm } from '@/components/jobs/job-form'
import { updateJob } from '@/app/actions/jobs'
import {
  getCrewOptions,
  getSalespeople,
  getCustomerOptions,
  getJobDetail,
  getJobItems,
  getProductOptions,
  getTeamMembers,
  getTrucks,
} from '@/lib/queries'
import { getAllOperations } from '@/lib/operations-server'
import { requireAdmin } from '@/lib/session'

export const metadata = { title: 'Edit job' }

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const jobId = Number(id)
  if (!Number.isInteger(jobId)) notFound()
  const [detail, team, products, items, trucks, crews, allOperations, salespeople] = await Promise.all([
    getJobDetail(jobId),
    getTeamMembers(),
    getProductOptions(),
    getJobItems(jobId),
    getTrucks(),
    getCrewOptions(),
    getAllOperations(),
    getSalespeople(),
  ])
  if (!detail) notFound()
  const { job } = detail
  const customers = await getCustomerOptions(job.customerId)
  // Keep an archived operation selectable on jobs that already use it.
  const operations = allOperations.filter((o) => o.active || o.id === job.operation)

  return (
    <>
      <PageHeader eyebrow={`Job #${job.id}`} title="Edit job" />
      <PageBody className="max-w-5xl">
        <JobForm
          mode="edit"
          action={updateJob.bind(null, job.id)}
          customers={customers}
          team={team}
          trucks={trucks}
          crews={crews}
          salespeople={salespeople}
          operations={operations}
          products={products}
          initialItems={items.map((i) => ({
            productId: i.productId,
            name: i.name,
            unit: i.unit,
            quantity: Number(i.quantity),
            unitPriceCents: i.unitPriceCents,
          }))}
          defaults={{
            customerId: job.customerId,
            operation: job.operation,
            title: job.title,
            scheduledDate: job.scheduledDate,
            startTime: job.startTime,
            durationMinutes: job.durationMinutes,
            address: job.address,
            assignedTo: job.assignedTo,
            truckId: job.truckId,
            crewId: job.crewId,
            salespersonId: job.salespersonId,
            priceCents: job.priceCents,
            description: job.description,
          }}
        />
      </PageBody>
    </>
  )
}
