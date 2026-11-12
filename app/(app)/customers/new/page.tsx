import { PageBody, PageHeader } from '@/components/page-header'
import { CustomerForm } from '@/components/customers/customer-form'
import { createCustomer } from '@/app/actions/customers'
import { requireAdmin } from '@/lib/session'

export const metadata = { title: 'Add customer' }

export default async function NewCustomerPage() {
  await requireAdmin()
  return (
    <>
      <PageHeader eyebrow="Customers" title="Add customer" />
      <PageBody className="max-w-2xl">
        <CustomerForm mode="create" action={createCustomer} />
      </PageBody>
    </>
  )
}
