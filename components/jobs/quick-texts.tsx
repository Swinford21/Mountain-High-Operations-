'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { MapPinCheck, Star, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { sendQuickText, type QuickTextKind } from '@/app/actions/quick-texts'

const BUTTONS: { kind: QuickTextKind; label: string; Icon: typeof Truck }[] = [
  { kind: 'on-our-way', label: 'On our way', Icon: Truck },
  { kind: 'arrived', label: 'We have arrived', Icon: MapPinCheck },
  { kind: 'google-review', label: 'Google review', Icon: Star },
]

export function QuickTexts({ jobId, hasPhone }: { jobId: number; hasPhone: boolean }) {
  const [pending, startTransition] = useTransition()

  return (
    <section aria-labelledby="quick-texts-heading" className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <div className="flex flex-col gap-0.5">
        <h2 id="quick-texts-heading" className="font-semibold">
          Quick texts
        </h2>
        <p className="text-xs text-muted-foreground">
          {hasPhone ? 'Sends the customer a text right away.' : 'Add a phone number to the customer to send texts.'}
        </p>
      </div>
      {BUTTONS.map(({ kind, label, Icon }) => (
        <Button
          key={kind}
          variant="outline"
          className="justify-start"
          disabled={pending || !hasPhone}
          onClick={() =>
            startTransition(async () => {
              const r = await sendQuickText(jobId, kind)
              if (r) (r.ok ? toast.success : toast.error)(r.message)
            })
          }
        >
          <Icon aria-hidden="true" />
          {label}
        </Button>
      ))}
    </section>
  )
}
