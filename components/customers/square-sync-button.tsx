'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { syncSquare } from '@/app/actions/customers'
import { cn } from '@/lib/utils'

export function SquareSyncButton({ variant = 'outline' }: { variant?: 'outline' | 'default' }) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant={variant}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await syncSquare()
          if (r) (r.ok ? toast.success : toast.error)(r.message)
        })
      }
    >
      <RefreshCw className={cn(pending && 'animate-spin')} aria-hidden="true" />
      {pending ? 'Syncing with Square…' : 'Sync with Square'}
    </Button>
  )
}
