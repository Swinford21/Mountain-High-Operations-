/** Owners can do everything admins can, plus manage owners and reset passwords. */
export type Role = 'owner' | 'admin' | 'crew' | 'pending'

export function isAdminRole(role: string | null | undefined) {
  return role === 'admin' || role === 'owner'
}
