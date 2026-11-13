/**
 * Access levels, most to least:
 * - owner: everything, plus reset passwords and manage other owners
 * - admin / manager: run the business — jobs, customers, sales, payments, HR, logistics
 * - installer / driver: field crew — schedule, job details, status updates, time clock; never sales or prices
 * - crew: legacy field role, treated like installer
 * - pending: signed up, waiting for approval
 */
export type Role = 'owner' | 'admin' | 'manager' | 'installer' | 'driver' | 'crew' | 'pending'

export const ASSIGNABLE_ROLES = [
  { id: 'owner', label: 'Owner' },
  { id: 'admin', label: 'Admin' },
  { id: 'manager', label: 'Manager' },
  { id: 'installer', label: 'Installer' },
  { id: 'driver', label: 'Driver' },
] as const

export function roleLabel(role: string | null | undefined) {
  if (role === 'crew') return 'Installer'
  return ASSIGNABLE_ROLES.find((r) => r.id === role)?.label ?? null
}

export function isAdminRole(role: string | null | undefined) {
  return role === 'admin' || role === 'owner' || role === 'manager'
}

/** Field crew: see the schedule and job details only. */
export function isFieldRole(role: string | null | undefined) {
  return role === 'installer' || role === 'driver' || role === 'crew'
}
