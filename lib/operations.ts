export const OPERATIONS = [
  { id: 'installation', label: 'Installations', singular: 'Installation', color: 'var(--op-installation)' },
  { id: 'delivery', label: 'Deliveries', singular: 'Delivery', color: 'var(--op-delivery)' },
  { id: 'hardscape', label: 'Hardscapes', singular: 'Hardscape', color: 'var(--op-hardscape)' },
  { id: 'lawn_maintenance', label: 'Lawn Maintenance', singular: 'Lawn Maintenance', color: 'var(--op-lawn)' },
  { id: 'pickup', label: 'Pick Ups', singular: 'Pick Up', color: 'var(--op-pickup)' },
  { id: 'estimate', label: 'Estimates', singular: 'Estimate', color: 'var(--op-estimate)' },
] as const

export type OperationId = (typeof OPERATIONS)[number]['id']

export const OPERATION_IDS = OPERATIONS.map((o) => o.id) as [OperationId, ...OperationId[]]

export function getOperation(id: string) {
  return OPERATIONS.find((o) => o.id === id) ?? OPERATIONS[0]
}

export const JOB_STATUSES = [
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'canceled', label: 'Canceled' },
] as const

export type JobStatus = (typeof JOB_STATUSES)[number]['id']

export function statusLabel(id: string) {
  return JOB_STATUSES.find((s) => s.id === id)?.label ?? id
}
