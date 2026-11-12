import { redirect } from 'next/navigation'
import { Clock } from 'lucide-react'
import { SignOutButton } from '@/components/sign-out-button'
import { getCurrentUser } from '@/lib/session'

export const metadata = { title: 'Awaiting approval' }

export default async function PendingPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  if (user.role !== 'pending') redirect('/')

  return (
    <main className="flex min-h-svh items-center justify-center px-6">
      <div className="flex max-w-md flex-col items-start gap-4 rounded-xl border bg-card p-8">
        <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Clock className="size-5" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Waiting for approval</h1>
        <p className="leading-relaxed text-muted-foreground">
          Thanks, {user.name}. An admin at Mountain High needs to approve your account ({user.email}) before you can see the
          schedule and use the time clock. Check back after they let you know.
        </p>
        <SignOutButton variant="outline" />
      </div>
    </main>
  )
}
