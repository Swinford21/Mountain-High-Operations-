import Link from 'next/link'
import { notFound } from 'next/navigation'
import { desc, eq, and } from 'drizzle-orm'
import { CalendarPlus, ExternalLink, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageBody, PageHeader } from '@/components/page-header'
import { ConfirmDelete } from '@/components/action-feedback'
import { EstimateActions } from '@/components/estimates/estimate-actions'
import { EstimateStatusBadge } from '@/components/estimates/estimate-status-badge'
import { CopyLinkButton } from '@/components/estimates/copy-link-button'
import { deleteEstimate } from '@/app/actions/estimates'
import { db } from '@/lib/db'
import { messageLog } from '@/lib/db/schema'
import { estimateApprovalUrl, getEstimateDetail, getEstimateItems } from '@/lib/estimates'
import { findOperation } from '@/lib/operations'
import { getAllOperations } from '@/lib/operations-server'
import { requireAdmin } from '@/lib/session'
import { formatDateLong, formatMoney, formatTimestamp } from '@/lib/time'

export const metadata = { title: 'Estimate' }

export default async function EstimateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string; updated?: string; sent?: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const sp = await searchParams
  const estimateId = Number(id)
  if (!Number.isInteger(estimateId)) notFound()
  const detail = await getEstimateDetail(estimateId)
  if (!detail) notFound()
  const { estimate, customer, createdByName, salespersonName } = detail
  const [items, operations, messages] = await Promise.all([
    getEstimateItems(estimate.id),
    getAllOperations(),
    db
      .select()
      .from(messageLog)
      .where(and(eq(messageLog.customerId, customer.id), eq(messageLog.kind, 'estimate')))
      .orderBy(desc(messageLog.createdAt))
      .limit(10),
  ])
  const op = findOperation(operations, estimate.operation)
  const approvalUrl = estimateApprovalUrl(estimate.approvalToken)
  const address = estimate.address || customer.address

  const banner =
    sp.created || sp.updated
      ? `${sp.created ? 'Estimate created' : 'Estimate updated'}.${
          sp.sent === undefined
            ? ''
            : sp.sent === '0'
              ? ' Nothing was sent — check the customer has an email or phone number.'
              : ` Sent to the customer (${sp.sent} message${sp.sent === '1' ? '' : 's'}).`
        }`
      : null

  return (
    <>
      <PageHeader
        eyebrow={`${op.singular} · Estimate #${estimate.id}`}
        title={estimate.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {customer.name}
            <EstimateStatusBadge status={estimate.status} />
          </span>
        }
        actions={
          <>
            {estimate.status === 'approved' && (
              <Button render={<Link href={`/jobs/new?estimate=${estimate.id}`} />} nativeButton={false}>
                <CalendarPlus aria-hidden="true" />
                Schedule job
              </Button>
            )}
            {estimate.status === 'scheduled' && estimate.jobId && (
              <Button variant="outline" render={<Link href={`/jobs/${estimate.jobId}`} />} nativeButton={false}>
                Open job #{estimate.jobId}
              </Button>
            )}
            {estimate.status !== 'scheduled' && (
              <Button variant="outline" render={<Link href={`/estimates/${estimate.id}/edit`} />} nativeButton={false}>
                <Pencil aria-hidden="true" />
                Edit
              </Button>
            )}
          </>
        }
      />
      <PageBody>
        {banner && (
          <p role="status" className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
            {banner}
          </p>
        )}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">Approval</h2>
                <EstimateActions estimateId={estimate.id} status={estimate.status} />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {estimate.status === 'approved' || estimate.status === 'scheduled'
                  ? `${estimate.approvalMethod === 'customer' ? `Approved online by ${estimate.approvedByName}` : `Marked approved by ${estimate.approvedByName ?? 'the office'}`} on ${formatTimestamp(estimate.approvedAt)}.`
                  : estimate.status === 'declined'
                    ? `Declined ${formatTimestamp(estimate.declinedAt)}${estimate.declineReason ? ` — "${estimate.declineReason}"` : ''}.`
                    : estimate.sentAt
                      ? `Sent ${formatTimestamp(estimate.sentAt)}. Waiting for the customer to approve.`
                      : 'Not sent yet. Send it to the customer, or mark it approved if they said yes in person or by phone.'}
              </p>
              <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
                <span className="text-xs font-medium text-muted-foreground">Customer approval link</span>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 truncate font-mono text-xs">{approvalUrl}</code>
                  <CopyLinkButton url={approvalUrl} />
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<a href={`/estimate/${estimate.approvalToken}`} target="_blank" rel="noreferrer" />}
                    nativeButton={false}
                  >
                    <ExternalLink aria-hidden="true" />
                    Preview
                  </Button>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
              <h2 className="font-semibold">Details</h2>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">Total</dt>
                  <dd className="font-mono text-lg font-semibold tabular-nums">{formatMoney(estimate.priceCents)}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">Valid until</dt>
                  <dd className="font-medium">{estimate.validUntil ? formatDateLong(estimate.validUntil) : 'No expiry'}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">Address</dt>
                  <dd className="font-medium">{address || '—'}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">Salesperson</dt>
                  <dd className="font-medium">{salespersonName ?? 'None'}</dd>
                </div>
              </dl>
              {estimate.description && (
                <p className="whitespace-pre-line rounded-lg bg-muted/40 p-3 text-sm leading-relaxed">{estimate.description}</p>
              )}
            </section>

            {items.length > 0 && (
              <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
                <h2 className="font-semibold">Materials</h2>
                <ul className="flex flex-col divide-y rounded-lg border text-sm">
                  {items.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="font-medium">{i.name}</span>
                      <span className="flex items-center gap-4 tabular-nums">
                        <span>
                          {Number(i.quantity)} {i.unit}
                        </span>
                        <span className="w-20 text-right text-muted-foreground">
                          {formatMoney(Math.round(Number(i.quantity) * i.unitPriceCents))}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-6">
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
              <h2 className="font-semibold">Customer</h2>
              <Link href={`/customers/${customer.id}`} className="font-medium underline underline-offset-4">
                {customer.name}
              </Link>
              <div className="flex flex-col text-sm text-muted-foreground">
                {customer.phone && <a href={`tel:${customer.phone}`}>{customer.phone}</a>}
                {customer.email && <a href={`mailto:${customer.email}`}>{customer.email}</a>}
                {!customer.phone && !customer.email && <span>No email or phone — add one to send the estimate.</span>}
              </div>
            </section>
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
              <h2 className="font-semibold">Activity</h2>
              <ul className="flex flex-col gap-2 text-sm">
                <li className="text-muted-foreground">
                  Created {formatTimestamp(estimate.createdAt)}
                  {createdByName ? ` by ${createdByName}` : ''}
                </li>
                {messages.map((m) => (
                  <li key={m.id} className={m.status === 'sent' ? 'text-muted-foreground' : 'text-destructive'}>
                    {m.channel === 'sms' ? 'Text' : 'Email'} to {m.recipient} ·{' '}
                    {m.status === 'sent' ? formatTimestamp(m.createdAt) : `failed: ${m.error}`}
                  </li>
                ))}
              </ul>
            </section>
            {estimate.status !== 'scheduled' && (
              <ConfirmDelete
                label="Delete estimate"
                title="Delete this estimate?"
                description="The customer's approval link will stop working. This can't be undone."
                action={deleteEstimate.bind(null, estimate.id)}
              />
            )}
          </aside>
        </div>
      </PageBody>
    </>
  )
}
