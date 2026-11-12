import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth-form'
import { getCurrentUser } from '@/lib/session'

export const metadata = { title: 'Sign in' }

export default async function SignInPage() {
  const user = await getCurrentUser()
  if (user) redirect('/')
  return <AuthForm mode="sign-in" />
}
