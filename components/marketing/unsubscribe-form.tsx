'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { unsubscribe } from '@/app/actions/marketing'

export function UnsubscribeForm({ customerId, token }: { customerId: number; token: string }) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  if (result) {
    return (
      <p role="status" className={result.ok ? 'leading-relaxed' : 'leading-relaxed text-brand-red'}>
        {result.message}
      </p>
    )
  }

  const run = (channel: 'email' | 'all') =>
    startTransition(async () => {
      setResult(await unsubscribe(customerId, token, channel))
    })

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="leading-relaxed text-sidebar-foreground/80">
        You&apos;ll still get confirmations and reminders for jobs you schedule with us.
      </p>
      <Button
        disabled={pending}
        onClick={() => run('email')}
        className="h-11 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
      >
        Unsubscribe from marketing emails
      </Button>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => run('all')}
        className="h-11 border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        Stop all marketing emails and texts
      </Button>
    </div>
  )
}
