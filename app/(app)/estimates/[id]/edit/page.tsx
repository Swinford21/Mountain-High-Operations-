import { notFound, redirect } from 'next/navigation'
import { PageBody, PageHeader } from '@/components/page-header'
import { EstimateForm } from '@/components/estimates/estimate-form'
import { updateEstimate } from '@/app/actions/estimates'
import { getEstimateDetail, getEstimateItems } from '@/lib/estimates'
import { getAllOperations } from '@/lib/operations-server'
import { getCustomerOptions, getProductOptions, getSalespeople } from '@/lib/queries'
import { requireAdmin } from '@/lib/session'

export const metadata = { title: 'Edit estimate' }

export default async function EditEstimatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const estimateId = Number(id)
  if (!Number.isInteger(estimateId)) notFound()
  const detail = await getEstimateDetail(estimateId)
  if (!detail) notFound()
  const { estimate } = detail
  if (estimate.status === 'scheduled') redirect(`/estimates/${estimate.id}`)

  const [customers, products, allOperations, salespeople, items] = await Promise.all([
    getCustomerOptions(estimate.customerId),
    getProductOptions(),
    getAllOperations(),
    getSalespeople(),
    getEstimateItems(estimate.id),
  ])
  const operations = allOperations.filter((o) => o.active || o.id === estimate.operation)

  return (
    <>
      <PageHeader eyebrow={`Estimate #${estimate.id}`} title="Edit estimate" />
      <PageBody className="max-w-5xl">
        <EstimateForm
          mode="edit"
          action={updateEstimate.bind(null, estimate.id)}
          customers={customers}
          operations={operations}
          products={products}
          salespeople={salespeople}
          initialItems={items.map((i) => ({
            productId: i.productId,
            name: i.name,
            unit: i.unit,
            quantity: Number(i.quantity),
            unitPriceCents: i.unitPriceCents,
          }))}
          defaults={{
            customerId: estimate.customerId,
            operation: estimate.operation,
            title: estimate.title,
            address: estimate.address,
            priceCents: estimate.priceCents,
            description: estimate.description,
            validUntil: estimate.validUntil,
            salespersonId: estimate.salespersonId,
          }}
        />
      </PageBody>
    </>
  )
}
