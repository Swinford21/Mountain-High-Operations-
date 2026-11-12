import { redirect } from 'next/navigation'
import { sql } from 'drizzle-orm'
import { AuthForm } from '@/components/auth-form'
import { db } from '@/lib/db'
import { user as userTable } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/session'

export const metadata = { title: 'Create account' }

export default async function SignUpPage() {
  const user = await getCurrentUser()
  if (user) redirect('/')
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(userTable)
  return <AuthForm mode="sign-up" isFirstUser={count === 0} />
}
