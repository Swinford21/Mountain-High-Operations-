'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SignOutButton({
  variant = 'ghost',
  className,
}: {
  variant?: 'ghost' | 'outline'
  className?: string
}) {
  const router = useRouter()
  return (
    <Button
      variant={variant}
      className={cn(className)}
      onClick={async () => {
        await authClient.signOut()
        router.push('/sign-in')
        router.refresh()
      }}
    >
      <LogOut aria-hidden="true" />
      Sign out
    </Button>
  )
}
