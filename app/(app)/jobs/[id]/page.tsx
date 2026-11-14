import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, asc, desc, eq, isNull, or } from 'drizzle-orm'
import { Mail, MapPin, MessageSquare, Pencil, Phone, Repeat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageBody, PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/jobs/job-card'
import { JobStatusControl } from '@/components/jobs/job-status-control'
import { JobAdminActions, PaymentApplyButton, PaymentToggle } from '@/components/jobs/job-admin-actions'
import { QuickTexts } from '@/components/jobs/quick-texts'
import { db } from '@/lib/db'
import { jobFiles, jobNotes, messageLog, payments, user } from '@/lib/db/schema'
import { JobFiles } from '@/components/jobs/job-files'
import { InternalNotes } from '@/components/jobs/internal-notes'
import { addAdminNote, addCrewNote, deleteJobNote } from '@/app/actions/job-notes'
import { findOperation } from '@/lib/operations'
import { getAllOperations } from '@/lib/operations-server'
import { getJobDetail, getJobItems } from '@/lib/queries'
import { repeatLabel } from '@/lib/recurrence'
import { isAdminRole, requireUser } from '@/lib/session'
import { formatDateLong, formatMoney, formatTime12, formatTimestamp } from '@/lib/time'
import { getSquareLocations, getSquareWebConfig, isSquareConfigured, jobCollectedCents } from '@/lib/square'
import { RefreshPaymentsButton, TakePayment } from '@/components/jobs/take-payment'

export const metadata = { title: 'Job' }

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string; updated?: string; sent?: string; pay?: string }>
}) {
  const me = await requireUser()
  const isAdmin = isAdminRole(me.role)
  const { id } = await params
  const sp = await searchParams
  const jobId = Number(id)
  if (!Number.isInteger(jobId)) notFound()
  const detail = await getJobDetail(jobId)
  if (!detail) notFound()
  const { job, customer, assigneeName, truckName, truckColor, crewName, salespersonName } = detail
  const op = findOperation(await getAllOperations(), job.operation)
  const address = job.address || customer.address
  const endMinutes = Number(job.startTime.slice(0, 2)) * 60 + Number(job.startTime.slice(3)) + job.durationMinutes
  const endTime = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`

  const [items, noteRows, fileRows] = await Promise.all([
    getJobItems(job.id),
    db
      .select({
        id: jobNotes.id,
        body: jobNotes.body,
        authorId: jobNotes.authorId,
        visibility: jobNotes.visibility,
        authorName: user.name,
        createdAt: jobNotes.createdAt,
      })
      .from(jobNotes)
      .leftJoin(user, eq(user.id, jobNotes.authorId))
      .where(isAdmin ? eq(jobNotes.jobId, job.id) : and(eq(jobNotes.jobId, job.id), eq(jobNotes.visibility, 'crew')))
      .orderBy(asc(jobNotes.createdAt)),
    db
      .select({ file: jobFiles, uploaderName: user.name })
      .from(jobFiles)
      .leftJoin(user, eq(user.id, jobFiles.uploadedBy))
      .where(eq(jobFiles.jobId, job.id))
      .orderBy(asc(jobFiles.createdAt)),
  ])
  const files = fileRows.map(({ file, uploaderName }) => ({
    id: file.id,
    filename: file.filename,
    contentType: file.contentType,
    sizeBytes: file.sizeBytes,
    caption: file.caption,
    uploaderName,
    createdAt: file.createdAt.toISOString(),
    canEdit: isAdmin || file.uploadedBy === me.id,
  }))
  const toNote = (n: (typeof noteRows)[number]) => ({
    id: n.id,
    body: n.body,
    authorName: n.authorName,
    createdAt: n.createdAt.toISOString(),
    canDelete: isAdmin || n.authorId === me.id,
  })
  const crewNotes = noteRows.filter((n) => n.visibility !== 'admin').map(toNote)
  const adminNotes = isAdmin ? noteRows.filter((n) => n.visibility === 'admin').map(toNote) : []
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

  const squareReady = isAdmin && isSquareConfigured()
  const squareWeb = getSquareWebConfig()
  const [collectedCents, squareLocations] = isAdmin
    ? await Promise.all([jobCollectedCents(job.id), squareReady ? getSquareLocations().catch(() => []) : []])
    : [0, []]
  const balanceCents = job.priceCents == null ? null : Math.max(job.priceCents - collectedCents, 0)

  const banner =
    sp.created || sp.updated
      ? `${sp.created ? (Number(sp.created) > 1 ? `Repeating job scheduled — ${sp.created} visits added to the calendar` : 'Job scheduled') : 'Job updated'}.${
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
        titleClassName={crewNotes.length > 0 ? 'text-destructive' : undefined}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {formatDateLong(job.scheduledDate)}, {formatTime12(job.startTime)}–{formatTime12(endTime)}
            <StatusBadge status={job.status} />
          </span>
        }
        actions={
          isAdmin && (
            <>
              <Button variant="outline" render={<Link href={`/jobs/new?from=${job.id}`} />} nativeButton={false}>
                <Repeat aria-hidden="true" />
                Repeat order
              </Button>
              <Button variant="outline" render={<Link href={`/jobs/${job.id}/edit`} />} nativeButton={false}>
                <Pencil aria-hidden="true" />
                Edit
              </Button>
            </>
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
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">Truck</dt>
                  <dd className="flex items-center gap-2 font-medium">
                    {truckColor && (
                      <span className="size-2.5 rounded-sm" style={{ backgroundColor: truckColor }} aria-hidden="true" />
                    )}
                    {truckName ?? 'No truck'}
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">Crew</dt>
                  <dd className="font-medium">{crewName ?? 'No crew'}</dd>
                </div>
                {isAdmin && (
                  <div className="flex flex-col gap-1">
                    <dt className="text-muted-foreground">Salesperson</dt>
                    <dd className="font-medium">{salespersonName ?? 'None'}</dd>
                  </div>
                )}
                {isAdmin && job.estimateId && (
                  <div className="flex flex-col gap-1">
                    <dt className="text-muted-foreground">From estimate</dt>
                    <dd className="font-medium">
                      <Link href={`/estimates/${job.estimateId}`} className="underline underline-offset-4">
                        #{job.estimateId}
                      </Link>
                    </dd>
                  </div>
                )}
                {job.repeatRule && (
                  <div className="flex flex-col gap-1">
                    <dt className="text-muted-foreground">Repeats</dt>
                    <dd className="flex items-center gap-1.5 font-medium">
                      <Repeat className="size-3.5" aria-hidden="true" />
                      {repeatLabel(job.repeatRule)}
                    </dd>
                  </div>
                )}
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
                    <dt className="text-muted-foreground">Notes (shared with customer)</dt>
                    <dd className="leading-relaxed whitespace-pre-wrap">{job.description}</dd>
                  </div>
                )}
              </dl>
            </section>

            <JobFiles jobId={job.id} files={files} />

            <InternalNotes
              variant="crew"
              title="Crew notes"
              description="Shared with the whole team. Customers never see these. Jobs with crew notes show their title in red."
              placeholder="Gate code, where to dump, anything the crew should know…"
              targetId={job.id}
              notes={crewNotes}
              addAction={addCrewNote}
              deleteAction={deleteJobNote}
            />
            {isAdmin && (
              <InternalNotes
                title="Admin notes"
                description="Admins only. Crew and customers never see these, and they are never included in emails or texts."
                placeholder="Private note for admins…"
                targetId={job.id}
                notes={adminNotes}
                addAction={addAdminNote}
                deleteAction={deleteJobNote}
              />
            )}

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
                <dl className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground">Price</dt>
                    <dd className="font-mono font-semibold">{formatMoney(job.priceCents)}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground">Collected</dt>
                    <dd className="font-mono font-semibold text-paid">{formatMoney(collectedCents)}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground">Balance</dt>
                    <dd className="font-mono font-semibold">{balanceCents == null ? '—' : formatMoney(balanceCents)}</dd>
                  </div>
                </dl>
                {squareReady && (balanceCents == null || balanceCents > 0) && (
                  <TakePayment
                    jobId={job.id}
                    balanceCents={balanceCents}
                    applicationId={squareWeb.applicationId}
                    sandbox={squareWeb.sandbox}
                    locations={squareLocations}
                    defaultOpen={sp.pay === '1'}
                    canMessageCustomer={!!(customer.phone || customer.email)}
                  />
                )}
                {job.paymentLinkUrl && (
                  <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">Pay link sent</span>
                      <a
                        href={job.paymentLinkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-mono text-xs text-muted-foreground underline underline-offset-4"
                      >
                        {job.paymentLinkUrl}
                      </a>
                    </span>
                    <RefreshPaymentsButton jobId={job.id} />
                  </div>
                )}
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
            <QuickTexts jobId={job.id} hasPhone={!!customer.phone} />
            {isAdmin && <JobAdminActions jobId={job.id} />}
          </aside>
        </div>
      </PageBody>
    </>
  )
}
