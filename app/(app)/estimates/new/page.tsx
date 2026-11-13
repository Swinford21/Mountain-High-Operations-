import { PageBody, PageHeader } from '@/components/page-header'
import { EstimateForm } from '@/components/estimates/estimate-form'
import { createEstimate } from '@/app/actions/estimates'
import { getOperations } from '@/lib/operations-server'
import { getCustomerOptions, getProductOptions, getSalespeople } from '@/lib/queries'
import { requireAdmin } from '@/lib/session'
import { addDays, todayLocal } from '@/lib/time'

export const metadata = { title: 'New estimate' }

export default async function NewEstimatePage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const me = await requireAdmin()
  const sp = await searchParams
  const customerId = sp.customer ? Number(sp.customer) : undefined
  const [customers, products, operations, salespeople] = await Promise.all([
    getCustomerOptions(customerId),
    getProductOptions(),
    getOperations(),
    getSalespeople(),
  ])
  const customer = customers[0]

  return (
    <>
      <PageHeader eyebrow="Estimates" title="New estimate" />
      <PageBody className="max-w-5xl">
        <EstimateForm
          mode="create"
          action={createEstimate}
          customers={customers}
          operations={operations}
          products={products}
          salespeople={salespeople}
          defaults={{
            customerId: customer?.id,
            address: customer?.address ?? '',
            validUntil: addDays(todayLocal(), 30),
            salespersonId: salespeople.some((p) => p.id === me.id) ? me.id : null,
          }}
        />
      </PageBody>
    </>
  )
}
