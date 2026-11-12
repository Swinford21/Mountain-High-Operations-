'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { sendTomorrowRemindersNow } from '@/app/actions/jobs'

export function SendRemindersButton() {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="outline"
      disabled={pending}
      className="self-start"
      onClick={() =>
        startTransition(async () => {
          const r = await sendTomorrowRemindersNow()
          if (r) (r.ok ? toast.success : toast.error)(r.message)
        })
      }
    >
      <BellRing aria-hidden="true" />
      {pending ? 'Sending…' : 'Send reminders now'}
    </Button>
  )
}
