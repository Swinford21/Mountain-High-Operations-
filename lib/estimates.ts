import { asc, desc, eq, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/lib/db'
import { customers, estimateItems, estimates, user } from '@/lib/db/schema'
import { ESTIMATE_APPROVAL_RECIPIENTS } from '@/lib/estimate-status'
import { findOperation } from '@/lib/operations'
import { getAllOperations } from '@/lib/operations-server'
import {
  BUSINESS_NAME,
  BUSINESS_PHONE,
  PUBLIC_SITE_URL,
  emailLayout,
  isValidEmail,
  logMessage,
  sendEmail,
  sendSms,
} from '@/lib/notify'
import { formatDateLong, formatMoney } from '@/lib/time'

export function estimateApprovalUrl(token: string) {
  return `${PUBLIC_SITE_URL}/estimate/${token}`
}

const salespersonForDetail = alias(user, 'salesperson_detail')

export async function getEstimateDetail(id: number) {
  const [row] = await db
    .select({
      estimate: estimates,
      customer: customers,
      createdByName: user.name,
      salespersonName: salespersonForDetail.name,
    })
    .from(estimates)
    .innerJoin(customers, eq(estimates.customerId, customers.id))
    .leftJoin(user, eq(user.id, estimates.createdBy))
    .leftJoin(salespersonForDetail, eq(salespersonForDetail.id, estimates.salespersonId))
    .where(eq(estimates.id, id))
    .limit(1)
  return row ?? null
}

export async function getEstimateByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null
  const [row] = await db
    .select({ estimate: estimates, customer: customers })
    .from(estimates)
    .innerJoin(customers, eq(estimates.customerId, customers.id))
    .where(eq(estimates.approvalToken, token))
    .limit(1)
  return row ?? null
}

const salesperson = alias(user, 'salesperson')

export async function listEstimates(statuses: string[]) {
  return db
    .select({
      id: estimates.id,
      title: estimates.title,
      operation: estimates.operation,
      status: estimates.status,
      priceCents: estimates.priceCents,
      validUntil: estimates.validUntil,
      sentAt: estimates.sentAt,
      approvedAt: estimates.approvedAt,
      approvalMethod: estimates.approvalMethod,
      approvedByName: estimates.approvedByName,
      declinedAt: estimates.declinedAt,
      jobId: estimates.jobId,
      createdAt: estimates.createdAt,
      address: estimates.address,
      customerId: customers.id,
      customerName: customers.name,
      customerPhone: customers.phone,
      customerAddress: customers.address,
      salespersonName: salesperson.name,
    })
    .from(estimates)
    .innerJoin(customers, eq(estimates.customerId, customers.id))
    .leftJoin(salesperson, eq(salesperson.id, estimates.salespersonId))
    .where(inArray(estimates.status, statuses))
    .orderBy(desc(estimates.approvedAt), desc(estimates.createdAt))
    .limit(300)
}

export type EstimateListItem = Awaited<ReturnType<typeof listEstimates>>[number]

export async function countUnscheduledEstimates() {
  return db.$count(estimates, eq(estimates.status, 'approved'))
}

export function getEstimateItems(estimateId: number) {
  return db.select().from(estimateItems).where(eq(estimateItems.estimateId, estimateId)).orderBy(asc(estimateItems.id))
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name
}

/** Emails (and texts, when there's a phone) the customer a link to review and approve the estimate. */
export async function sendEstimateToCustomer(estimateId: number) {
  const row = await getEstimateDetail(estimateId)
  if (!row) return { sent: 0, failed: 0, errors: ['Estimate not found'] }
  const { estimate, customer } = row
  const op = findOperation(await getAllOperations(), estimate.operation)
  const url = estimateApprovalUrl(estimate.approvalToken)
  const name = firstName(customer.name)
  const total = estimate.priceCents != null ? formatMoney(estimate.priceCents) : null

  let sent = 0
  let failed = 0
  const errors: string[] = []

  if (isValidEmail(customer.email)) {
    const rows: [string, string][] = [
      ['Service', op.singular],
      ['Project', estimate.title],
      ...(estimate.address ? ([['Address', estimate.address]] as [string, string][]) : []),
      ...(total ? ([['Estimate total', total]] as [string, string][]) : []),
      ...(estimate.validUntil ? ([['Valid until', formatDateLong(estimate.validUntil)]] as [string, string][]) : []),
    ]
    const result = await sendEmail({
      to: customer.email,
      subject: `Your estimate from ${BUSINESS_NAME}${total ? ` — ${total}` : ''}`,
      html: emailLayout({
        heading: `Your estimate is ready, ${name}`,
        paragraphs: [
          `Thanks for considering ${BUSINESS_NAME}. Review the details below and approve the estimate online when you're ready — we'll reach out to get you on the schedule.`,
          ...(estimate.description ? [estimate.description] : []),
        ],
        rows,
        cta: { label: 'Review & approve estimate', href: url },
        footer: `Questions? Call us at ${BUSINESS_PHONE}.`,
      }),
      text: `Hi ${name}, your estimate from ${BUSINESS_NAME} is ready${total ? ` (${total})` : ''}. Review and approve it here: ${url}\nQuestions? Call ${BUSINESS_PHONE}.`,
    })
    await logMessage({
      customerId: customer.id,
      channel: 'email',
      kind: 'estimate',
      recipient: customer.email,
      result,
    })
    if (result.ok) sent++
    else {
      failed++
      errors.push(result.error)
    }
  }

  if (customer.phone) {
    const result = await sendSms({
      to: customer.phone,
      body: `Hi ${name}, your estimate from ${BUSINESS_NAME} is ready${total ? ` (${total})` : ''}. Review and approve it here: ${url}`,
      logo: false,
    })
    await logMessage({ customerId: customer.id, channel: 'sms', kind: 'estimate', recipient: customer.phone, result })
    if (result.ok) sent++
    else {
      failed++
      errors.push(result.error)
    }
  }

  return { sent, failed, errors }
}

/** Lets the office know an estimate was approved and needs to be put on the schedule. */
export async function notifyOfficeEstimateApproved(estimateId: number) {
  const row = await getEstimateDetail(estimateId)
  if (!row) return
  const { estimate, customer } = row
  const op = findOperation(await getAllOperations(), estimate.operation)
  const link = `${PUBLIC_SITE_URL}/estimates/${estimate.id}`
  const total = estimate.priceCents != null ? formatMoney(estimate.priceCents) : 'No price set'
  const how =
    estimate.approvalMethod === 'customer'
      ? `${estimate.approvedByName ?? customer.name} approved it online`
      : `Marked approved by ${estimate.approvedByName ?? 'the office'}`

  const result = await sendEmail({
    to: ESTIMATE_APPROVAL_RECIPIENTS,
    bcc: false,
    ...(isValidEmail(customer.email) ? { replyTo: customer.email } : {}),
    subject: `Estimate approved: ${customer.name} — ${estimate.title} (${total})`,
    html: emailLayout({
      heading: 'Estimate approved — needs scheduling',
      paragraphs: [`${how}. It's now in the Unscheduled list until a job is booked.`],
      rows: [
        ['Customer', customer.name],
        ...(customer.phone ? ([['Phone', customer.phone]] as [string, string][]) : []),
        ['Service', op.singular],
        ['Project', estimate.title],
        ...(estimate.address || customer.address
          ? ([['Address', estimate.address || customer.address || '']] as [string, string][])
          : []),
        ['Total', total],
      ],
      cta: { label: 'Open estimate', href: link },
    }),
    text: `Estimate approved: ${customer.name} — ${estimate.title} (${total}). ${how}. Schedule it: ${link}`,
  })
  await logMessage({
    customerId: customer.id,
    channel: 'email',
    kind: 'estimate-approved',
    recipient: ESTIMATE_APPROVAL_RECIPIENTS.join(', '),
    result,
  })
}
