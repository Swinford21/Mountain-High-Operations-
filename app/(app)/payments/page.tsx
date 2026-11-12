import Link from 'next/link'
import { desc, eq, max, sql } from 'drizzle-orm'
import { PageBody, PageHeader } from '@/components/page-header'
import { SquareSyncButton } from '@/components/customers/square-sync-button'
import { db } from '@/lib/db'
import { customers, jobs, payments } from '@/lib/db/schema'
import { isSquareConfigured } from '@/lib/square'
import { requireAdmin } from '@/lib/session'
import { addDays, formatMoney, formatTimestamp, todayLocal, zonedToUtc } from '@/lib/time'

export const metadata = { title: 'Payments' }

export default async function PaymentsPage() {
  await requireAdmin()
  const thirtyDaysAgo = zonedToUtc(addDays(todayLocal(), -30), '00:00')

  const [rows, [summary], [unpaid]] = await Promise.all([
    db
      .select({
        id: payments.id,
        amountCents: payments.amountCents,
        status: payments.status,
        paidAt: payments.paidAt,
        note: payments.note,
        receiptUrl: payments.receiptUrl,
        customerId: payments.customerId,
        customerName: customers.name,
        jobId: payments.jobId,
        jobTitle: jobs.title,
      })
      .from(payments)
      .leftJoin(customers, eq(payments.customerId, customers.id))
      .leftJoin(jobs, eq(payments.jobId, jobs.id))
      .orderBy(desc(payments.paidAt))
      .limit(100),
    db
      .select({
        last30: sql<number>`coalesce(sum(${payments.amountCents}) filter (where ${payments.status} = 'COMPLETED' and ${payments.paidAt} >= ${thirtyDaysAgo}), 0)::int`,
        lastSync: max(payments.syncedAt),
      })
      .from(payments),
    db
      .select({
        count: sql<number>`count(*)::int`,
        cents: sql<number>`coalesce(sum(${jobs.priceCents}), 0)::int`,
      })
      .from(jobs)
      .where(sql`${jobs.status} = 'completed' and ${jobs.paymentStatus} = 'unpaid'`),
  ])

  const configured = isSquareConfigured()

  return (
    <>
      <PageHeader
        eyebrow="Square"
        title="Payments"
        description={summary.lastSync ? `Last synced ${formatTimestamp(summary.lastSync)}` : 'Not synced yet'}
        actions={<SquareSyncButton variant="default" />}
      />
      <PageBody>
        {!configured && (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            Square isn&apos;t connected. Add your SQUARE_ACCESS_TOKEN in the project&apos;s environment variables.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 rounded-xl border bg-card p-5">
            <span className="text-sm text-muted-foreground">Collected, last 30 days</span>
            <span className="font-display text-4xl font-extrabold tabular-nums">{formatMoney(summary.last30)}</span>
          </div>
          <Link href="/jobs?view=past" className="flex flex-col gap-1 rounded-xl border bg-card p-5 hover:border-foreground/30">
            <span className="text-sm text-muted-foreground">Completed jobs not marked paid</span>
            <span className="font-display text-4xl font-extrabold tabular-nums text-brand-red">
              {unpaid.count} <span className="text-2xl text-muted-foreground">· {formatMoney(unpaid.cents)}</span>
            </span>
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-muted-foreground">
            No payments yet. Charge customers in Square as usual, then press Sync with Square to pull them in.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Customer</th>
                  <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">Job</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatTimestamp(p.paidAt)}</td>
                    <td className="px-4 py-2.5">
                      {p.customerId ? (
                        <Link href={`/customers/${p.customerId}`} className="underline-offset-4 hover:underline">
                          {p.customerName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{p.note || 'Walk-in / no customer'}</span>
                      )}
                    </td>
                    <td className="hidden max-w-56 truncate px-4 py-2.5 md:table-cell">
                      {p.jobId ? (
                        <Link href={`/jobs/${p.jobId}`} className="underline underline-offset-4">
                          {p.jobTitle}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 capitalize">{p.status.toLowerCase()}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {p.receiptUrl ? (
                        <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                          {formatMoney(p.amountCents)}
                        </a>
                      ) : (
                        formatMoney(p.amountCents)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageBody>
    </>
  )
}
