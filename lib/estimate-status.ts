export const ESTIMATE_STATUSES = [
  { id: 'draft', label: 'Draft' },
  { id: 'sent', label: 'Sent' },
  { id: 'approved', label: 'Approved — needs scheduling' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'declined', label: 'Declined' },
] as const

export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number]['id']

export function estimateStatusLabel(status: string) {
  return ESTIMATE_STATUSES.find((s) => s.id === status)?.label ?? status
}

/** Estimates still waiting on the customer. Only these can be approved or declined. */
export function isAwaitingApproval(status: string) {
  return status === 'draft' || status === 'sent'
}

/** Office staff who get an email the moment an estimate is approved. */
export const ESTIMATE_APPROVAL_RECIPIENTS = [
  'missael@mountainhighmulch.com',
  'eric@mountainhighmulch.com',
  'les@mountainhighmulch.com',
]
