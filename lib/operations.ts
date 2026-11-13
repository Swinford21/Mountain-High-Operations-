/**
 * Operations (job types) live in the `operations` table so admins can add and edit them in Settings.
 * This module holds the client-safe helpers; load the list with `getOperations()` from `@/lib/operations-server`.
 */
export type Operation = {
  id: string
  label: string
  singular: string
  color: string
  active: boolean
  sortOrder: number
}

export const FALLBACK_OPERATION_COLOR = '#8a8f98'

function humanize(id: string) {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Finds an operation by id, falling back to a neutral placeholder for ids that are no longer in the list. */
export function findOperation(ops: Operation[], id: string | null | undefined): Operation {
  const found = ops.find((o) => o.id === id)
  if (found) return found
  const name = id ? humanize(id) : 'Other'
  return { id: id ?? 'other', label: name, singular: name, color: FALLBACK_OPERATION_COLOR, active: false, sortOrder: 999 }
}

/** A job takes its truck's color once a truck is assigned; otherwise its operation color. */
export function jobColor(job: { operationColor?: string | null; truckColor?: string | null }) {
  return job.truckColor || job.operationColor || FALLBACK_OPERATION_COLOR
}

export function slugifyOperation(label: string) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
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
