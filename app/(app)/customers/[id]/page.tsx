import Link from 'next/link'
import { notFound } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageBody, PageHeader } from '@/components/page-header'
import { CustomerForm } from '@/components/customers/customer-form'
import { DeleteCustomerButton } from '@/components/customers/delete-customer-button'
import { JobHistory, JobList, SquareOrders } from '@/components/customers/order-history'
import { updateCustomer } from '@/app/actions/customers'
import { db } from '@/lib/db'
import { customerHistory, customers, jobs, payments } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/session'
import { getSquareOrders } from '@/lib/square'
import { formatDateShort, formatMoney, formatTimestamp, todayLocal } from '@/lib/time'

export const metadata = { title: 'Customer' }

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const customerId = Number(id)
  if (!Number.isInteger(customerId)) notFound()

  const [[customer], customerJobs, customerPayments, historyRecords] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, customerId)).limit(1),
    db.select().from(jobs).where(eq(jobs.customerId, customerId)).orderBy(desc(jobs.scheduledDate), desc(jobs.startTime)).limit(200),
    db.select().from(payments).where(eq(payments.customerId, customerId)).orderBy(desc(payments.paidAt)).limit(25),
    db.select().from(customerHistory).where(eq(customerHistory.customerId, customerId)).orderBy(desc(customerHistory.serviceDate)).limit(200),
  ])
  if (!customer) notFound()

  const today = todayLocal()
  const upcomingJobs = customerJobs
    .filter((j) => j.scheduledDate >= today && j.status !== 'completed' && j.status !== 'canceled')
    .sort((a, b) => (a.scheduledDate + a.startTime).localeCompare(b.scheduledDate + b.startTime))
  const pastJobs = customerJobs.filter((j) => !upcomingJobs.includes(j))
  const completedCount = customerJobs.filter((j) => j.status === 'completed').length + historyRecords.length
  const lastServiceDate = [pastJobs[0]?.scheduledDate, historyRecords[0]?.serviceDate]
    .filter((d): d is string => !!d)
    .sort()
    .at(-1)
  const squareOrders = customer.squareCustomerId
    ? await getSquareOrders(customer.squareCustomerId)
    : { orders: [], error: null }
  const lifetimeCents =
    customerJobs.filter((j) => j.status === 'completed').reduce((s, j) => s + (j.priceCents ?? 0), 0) +
    squareOrders.orders.filter((o) => o.state === 'COMPLETED').reduce((s, o) => s + o.totalCents, 0)

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
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3">
                <dt className="text-sm text-muted-foreground">Lifetime orders</dt>
                <dd className="font-mono text-xl font-semibold tabular-nums">{formatMoney(lifetimeCents)}</dd>
              </div>
              <div className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3">
                <dt className="text-sm text-muted-foreground">Completed jobs</dt>
                <dd className="font-mono text-xl font-semibold tabular-nums">{completedCount}</dd>
              </div>
              <div className="col-span-2 flex flex-col gap-1 rounded-xl border bg-card px-4 py-3 sm:col-span-1">
                <dt className="text-sm text-muted-foreground">Last service</dt>
                <dd className="text-xl font-semibold">
                  {lastServiceDate ? `${formatDateShort(lastServiceDate)}, ${lastServiceDate.slice(0, 4)}` : '—'}
                </dd>
              </div>
            </dl>

            <JobList title="Upcoming jobs" jobs={upcomingJobs} empty="Nothing scheduled." />
            <JobHistory jobs={pastJobs} records={historyRecords} />
            <SquareOrders linked={!!customer.squareCustomerId} orders={squareOrders.orders} error={squareOrders.error} />

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
            {(customer.location || customer.defaultOperation || customer.company || customer.tags || customer.customerSince) && (
              <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
                <h2 className="font-semibold">Profile</h2>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  {customer.company && (
                    <>
                      <dt className="text-muted-foreground">Company</dt>
                      <dd>{customer.company}</dd>
                    </>
                  )}
                  {customer.defaultOperation && (
                    <>
                      <dt className="text-muted-foreground">Usual service</dt>
                      <dd className="capitalize">{customer.defaultOperation.toLowerCase()}</dd>
                    </>
                  )}
                  {customer.location && (
                    <>
                      <dt className="text-muted-foreground">Yard</dt>
                      <dd>{customer.location}</dd>
                    </>
                  )}
                  {customer.tags && (
                    <>
                      <dt className="text-muted-foreground">Tags</dt>
                      <dd>{customer.tags}</dd>
                    </>
                  )}
                  {customer.customerSince && (
                    <>
                      <dt className="text-muted-foreground">Customer since</dt>
                      <dd>{formatDateShort(customer.customerSince)}, {customer.customerSince.slice(0, 4)}</dd>
                    </>
                  )}
                </dl>
              </section>
            )}

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
