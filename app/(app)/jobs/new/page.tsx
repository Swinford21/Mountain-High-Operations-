import { PageBody, PageHeader } from '@/components/page-header'
import { JobForm } from '@/components/jobs/job-form'
import { createJob } from '@/app/actions/jobs'
import { OPERATION_IDS } from '@/lib/operations'
import { getCustomerOptions, getProductOptions, getTeamMembers, getTrucks } from '@/lib/queries'
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
  const [customers, team, products, trucks] = await Promise.all([
    getCustomerOptions(customerId),
    getTeamMembers(),
    getProductOptions(),
    getTrucks(),
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
          products={products}
          defaults={{
            customerId: customer?.id,
            address: customer?.address ?? '',
            operation: sp.op && (OPERATION_IDS as readonly string[]).includes(sp.op) ? sp.op : 'installation',
            scheduledDate: sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayLocal(),
          }}
        />
      </PageBody>
    </>
  )
}
