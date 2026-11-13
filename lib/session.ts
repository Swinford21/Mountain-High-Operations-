import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isAdminRole, type Role } from '@/lib/session-roles'

export { isAdminRole, type Role }

export type AppUser = {
  id: string
  name: string
  email: string
  role: Role
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const u = session.user as typeof session.user & { role?: string }
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: (u.role as Role) ?? 'pending',
  }
}

/** Any approved team member (owner, admin or crew). */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  if (user.role === 'pending') redirect('/pending')
  return user
}

export async function requireAdmin(): Promise<AppUser> {
  const user = await requireUser()
  if (!isAdminRole(user.role)) redirect('/')
  return user
}

export async function requireOwner(): Promise<AppUser> {
  const user = await requireUser()
  if (user.role !== 'owner') redirect('/')
  return user
}
