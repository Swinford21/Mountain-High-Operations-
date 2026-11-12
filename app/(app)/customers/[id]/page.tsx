import Link from 'next/link'
import { notFound } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageBody, PageHeader } from '@/components/page-header'
import { CustomerForm } from '@/components/customers/customer-form'
import { DeleteCustomerButton } from '@/components/customers/delete-customer-button'
import { StatusBadge } from '@/components/jobs/job-card'
import { updateCustomer } from '@/app/actions/customers'
import { db } from '@/lib/db'
import { customers, jobs, payments } from '@/lib/db/schema'
import { getOperation } from '@/lib/operations'
import { requireAdmin } from '@/lib/session'
import { formatDateShort, formatMoney, formatTimestamp } from '@/lib/time'

export const metadata = { title: 'Customer' }

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const customerId = Number(id)
  if (!Number.isInteger(customerId)) notFound()

  const [[customer], customerJobs, customerPayments] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, customerId)).limit(1),
    db.select().from(jobs).where(eq(jobs.customerId, customerId)).orderBy(desc(jobs.scheduledDate)).limit(50),
    db.select().from(payments).where(eq(payments.customerId, customerId)).orderBy(desc(payments.paidAt)).limit(25),
  ])
  if (!customer) notFound()

  const paidTotal = customerPayments
    .filter((p) => p.status === 'COMPLETED')
    .reduce((s, p) => s + p.amountCents, 0)

  return (
    <>
      <PageHeader
        eyebrow={customer.squareCustomerId ? 'Customer · linked to Square' : 'Customer'}
        title={customer.name}
        description={`${customerJobs.length} job${customerJobs.length === 1 ? '' : 's'} · ${formatMoney(paidTotal)} paid through Square`}
        actions={
          <Button render={<Link href={`/jobs/new?customer=${customer.id}`} />} nativeButton={false}>
            <Plus aria-hidden="true" />
            Schedule job
          </Button>
        }
      />
      <PageBody>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
              <h2 className="font-semibold">Jobs</h2>
              {customerJobs.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No jobs yet.</p>
              ) : (
                <ul className="flex flex-col divide-y rounded-xl border bg-card">
                  {customerJobs.map((j) => {
                    const op = getOperation(j.operation)
                    return (
                      <li key={j.id}>
                        <Link href={`/jobs/${j.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40">
                          <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: op.color }} aria-hidden="true" />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-medium">{j.title}</span>
                            <span className="text-sm text-muted-foreground">
                              {op.singular} · {formatDateShort(j.scheduledDate)}
                            </span>
                          </span>
                          <StatusBadge status={j.status} />
                          <span className="hidden w-20 text-right text-sm tabular-nums sm:block">{formatMoney(j.priceCents)}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="font-semibold">Square payments</h2>
              {customerPayments.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No payments synced for this customer.
                </p>
              ) : (
                <ul className="flex flex-col divide-y rounded-xl border bg-card text-sm">
                  {customerPayments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="flex flex-col">
                        <span className="font-semibold tabular-nums">{formatMoney(p.amountCents)}</span>
                        <span className="text-muted-foreground">
                          {formatTimestamp(p.paidAt)} · {p.status.toLowerCase()}
                          {p.jobId ? ' · applied to job' : ''}
                        </span>
                      </span>
                      {p.receiptUrl && (
                        <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                          Receipt
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
              <h2 className="font-semibold">Contact details</h2>
              <CustomerForm
                mode="edit"
                action={updateCustomer.bind(null, customer.id)}
                defaults={customer}
              />
            </section>
            <DeleteCustomerButton customerId={customer.id} />
          </aside>
        </div>
      </PageBody>
    </>
  )
}
