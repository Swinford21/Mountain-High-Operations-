import { PageBody, PageHeader } from '@/components/page-header'
import { JobForm } from '@/components/jobs/job-form'
import { createJob } from '@/app/actions/jobs'
import { getOperations } from '@/lib/operations-server'
import { getCrewOptions, getCustomerOptions, getProductOptions, getTeamMembers, getTrucks } from '@/lib/queries'
import { requireAdmin } from '@/lib/session'
import { todayLocal } from '@/lib/time'

export const metadata = { title: 'Schedule a job' }

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; customer?: string; op?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams
  const customerId = sp.customer ? Number(sp.customer) : undefined
  const [customers, team, products, trucks, crews, operations] = await Promise.all([
    getCustomerOptions(customerId),
    getTeamMembers(),
    getProductOptions(),
    getTrucks(),
    getCrewOptions(),
    getOperations(),
  ])
  const customer = customers[0]

  return (
    <>
      <PageHeader eyebrow="Jobs" title="Schedule a job" />
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
          defaults={{
            customerId: customer?.id,
            address: customer?.address ?? '',
            operation: operations.find((o) => o.id === sp.op)?.id ?? operations[0]?.id,
            scheduledDate: sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayLocal(),
          }}
        />
      </PageBody>
    </>
  )
}
