import { notFound } from 'next/navigation'
import { PageBody, PageHeader } from '@/components/page-header'
import { JobForm } from '@/components/jobs/job-form'
import { updateJob } from '@/app/actions/jobs'
import { getCustomerOptions, getJobDetail, getJobItems, getProductOptions, getTeamMembers } from '@/lib/queries'
import { requireAdmin } from '@/lib/session'

export const metadata = { title: 'Edit job' }

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const jobId = Number(id)
  if (!Number.isInteger(jobId)) notFound()
  const [detail, customers, team, products, items] = await Promise.all([
    getJobDetail(jobId),
    getCustomerOptions(),
    getTeamMembers(),
    getProductOptions(),
    getJobItems(jobId),
  ])
  if (!detail) notFound()
  const { job } = detail

  return (
    <>
      <PageHeader eyebrow={`Job #${job.id}`} title="Edit job" />
      <PageBody className="max-w-5xl">
        <JobForm
          mode="edit"
          action={updateJob.bind(null, job.id)}
          customers={customers}
          team={team}
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
            priceCents: job.priceCents,
            description: job.description,
          }}
        />
      </PageBody>
    </>
  )
}
