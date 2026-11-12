import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, desc, eq, isNull, or } from 'drizzle-orm'
import { Mail, MapPin, MessageSquare, Pencil, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageBody, PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/jobs/job-card'
import { JobStatusControl } from '@/components/jobs/job-status-control'
import { JobAdminActions, PaymentApplyButton, PaymentToggle } from '@/components/jobs/job-admin-actions'
import { db } from '@/lib/db'
import { messageLog, payments } from '@/lib/db/schema'
import { getOperation } from '@/lib/operations'
import { getJobDetail, getJobItems } from '@/lib/queries'
import { requireUser } from '@/lib/session'
import { formatDateLong, formatMoney, formatTime12, formatTimestamp } from '@/lib/time'

export const metadata = { title: 'Job' }

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string; updated?: string; sent?: string }>
}) {
  const me = await requireUser()
  const isAdmin = me.role === 'admin'
  const { id } = await params
  const sp = await searchParams
  const jobId = Number(id)
  if (!Number.isInteger(jobId)) notFound()
  const detail = await getJobDetail(jobId)
  if (!detail) notFound()
  const { job, customer, assigneeName } = detail
  const op = getOperation(job.operation)
  const address = job.address || customer.address
  const endMinutes = Number(job.startTime.slice(0, 2)) * 60 + Number(job.startTime.slice(3)) + job.durationMinutes
  const endTime = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`

  const items = await getJobItems(job.id)
  const [messages, customerPayments] = isAdmin
    ? await Promise.all([
        db.select().from(messageLog).where(eq(messageLog.jobId, job.id)).orderBy(desc(messageLog.createdAt)).limit(20),
        db
          .select()
          .from(payments)
          .where(and(eq(payments.customerId, customer.id), or(isNull(payments.jobId), eq(payments.jobId, job.id))))
          .orderBy(desc(payments.paidAt))
          .limit(10),
      ])
    : [[], []]

  const banner =
    sp.created || sp.updated
      ? `${sp.created ? 'Job scheduled' : 'Job updated'}.${
          sp.sent === undefined
            ? ''
            : sp.sent === '0'
              ? ' No confirmation was sent — check the customer has an email or phone and that messaging is configured.'
              : ` Confirmation sent (${sp.sent} message${sp.sent === '1' ? '' : 's'}).`
        }`
      : null

  return (
    <>
      <PageHeader
        eyebrow={`${op.singular} · Job #${job.id}`}
        title={job.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {formatDateLong(job.scheduledDate)}, {formatTime12(job.startTime)}–{formatTime12(endTime)}
            <StatusBadge status={job.status} />
          </span>
        }
        actions={
          isAdmin && (
            <Button variant="outline" render={<Link href={`/jobs/${job.id}/edit`} />} nativeButton={false}>
              <Pencil aria-hidden="true" />
              Edit
            </Button>
          )
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
              <h2 className="font-semibold">Status</h2>
              <JobStatusControl jobId={job.id} status={job.status} />
            </section>

            <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
              <h2 className="font-semibold">Details</h2>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">Operation</dt>
                  <dd className="flex items-center gap-2 font-medium">
                    <span className="size-2.5 rounded-sm" style={{ backgroundColor: op.color }} aria-hidden="true" />
                    {op.singular}
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">Assigned to</dt>
                  <dd className="font-medium">{assigneeName ?? 'Unassigned'}</dd>
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <dt className="text-muted-foreground">Address</dt>
                  <dd className="font-medium">
                    {address ? (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 underline underline-offset-4"
                      >
                        <MapPin className="size-4" aria-hidden="true" />
                        {address}
                      </a>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                {job.description && (
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <dt className="text-muted-foreground">Notes</dt>
                    <dd className="leading-relaxed whitespace-pre-wrap">{job.description}</dd>
                  </div>
                )}
              </dl>
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
                        {isAdmin && (
                          <span className="w-20 text-right text-muted-foreground">
                            {formatMoney(Math.round(Number(i.quantity) * i.unitPriceCents))}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {isAdmin && (
              <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold">Payment</h2>
                  <PaymentToggle jobId={job.id} paid={job.paymentStatus === 'paid'} />
                </div>
                <p className="text-sm text-muted-foreground">
                  Price: <span className="font-mono text-foreground">{formatMoney(job.priceCents)}</span>
                </p>
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Square payments from this customer</h3>
                  {customerPayments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      None synced yet. Run a sync on the{' '}
                      <Link href="/payments" className="underline underline-offset-4">
                        Payments
                      </Link>{' '}
                      page after charging in Square.
                    </p>
                  ) : (
                    <ul className="flex flex-col divide-y rounded-lg border">
                      {customerPayments.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                          <span className="flex flex-col">
                            <span className="font-mono font-medium">{formatMoney(p.amountCents)}</span>
                            <span className="text-muted-foreground">
                              {formatTimestamp(p.paidAt)} · {p.status.toLowerCase()}
                            </span>
                          </span>
                          <PaymentApplyButton paymentId={p.id} jobId={job.id} applied={p.jobId === job.id} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )}

            {isAdmin && (
              <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
                <h2 className="font-semibold">Messages</h2>
                <p className="text-sm text-muted-foreground">
                  Confirmation: {formatTimestamp(job.confirmationSentAt)} · Day-before reminder:{' '}
                  {formatTimestamp(job.reminderSentAt)}
                </p>
                {messages.length > 0 && (
                  <ul className="flex flex-col divide-y rounded-lg border text-sm">
                    {messages.map((m) => (
                      <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                        <span className="capitalize">
                          {m.kind} {m.channel === 'sms' ? 'text' : 'email'} to {m.recipient}
                        </span>
                        <span className={m.status === 'sent' ? 'text-muted-foreground' : 'text-destructive'}>
                          {m.status === 'sent' ? formatTimestamp(m.createdAt) : `Failed: ${m.error}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-6">
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
              <h2 className="font-semibold">Customer</h2>
              <div className="flex flex-col">
                {isAdmin ? (
                  <Link href={`/customers/${customer.id}`} className="font-medium underline underline-offset-4">
                    {customer.name}
                  </Link>
                ) : (
                  <span className="font-medium">{customer.name}</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {customer.phone && (
                  <>
                    <Button variant="outline" className="justify-start" render={<a href={`tel:${customer.phone}`} />} nativeButton={false}>
                      <Phone aria-hidden="true" />
                      Call {customer.phone}
                    </Button>
                    <Button variant="outline" className="justify-start" render={<a href={`sms:${customer.phone}`} />} nativeButton={false}>
                      <MessageSquare aria-hidden="true" />
                      Text customer
                    </Button>
                  </>
                )}
                {customer.email && (
                  <Button variant="outline" className="justify-start" render={<a href={`mailto:${customer.email}`} />} nativeButton={false}>
                    <Mail aria-hidden="true" />
                    <span className="truncate">{customer.email}</span>
                  </Button>
                )}
              </div>
            </section>
            {isAdmin && <JobAdminActions jobId={job.id} />}
          </aside>
        </div>
      </PageBody>
    </>
  )
}
