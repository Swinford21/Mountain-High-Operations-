import { PageBody, PageHeader } from '@/components/page-header'
import { TruckForm } from '@/components/logistics/truck-form'
import { requireAdmin } from '@/lib/session'

export const metadata = { title: 'Add truck' }

export default async function NewTruckPage() {
  await requireAdmin()
  return (
    <>
      <PageHeader eyebrow="Logistics" title="Add a truck" />
      <PageBody className="max-w-4xl">
        <TruckForm />
      </PageBody>
    </>
  )
}
