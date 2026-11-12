import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export type Role = 'admin' | 'crew' | 'pending'

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

/** Any approved team member (admin or crew). */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  if (user.role === 'pending') redirect('/pending')
  return user
}

export async function requireAdmin(): Promise<AppUser> {
  const user = await requireUser()
  if (user.role !== 'admin') redirect('/')
  return user
}
