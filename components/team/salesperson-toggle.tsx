'use client'

import { useOptimistic, useTransition } from 'react'
import { toast } from 'sonner'
import { setSalesperson } from '@/app/actions/admin'

export function SalespersonToggle({ userId, name, checked }: { userId: string; name: string; checked: boolean }) {
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useOptimistic(checked)

  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium has-focus-visible:ring-3 has-focus-visible:ring-ring/30">
      <input
        type="checkbox"
        checked={value}
        disabled={pending}
        aria-label={`${name} is a salesperson`}
        className="size-4 accent-[var(--primary)]"
        onChange={(e) => {
          const next = e.target.checked
          startTransition(async () => {
            setValue(next)
            const r = await setSalesperson(userId, next)
            if (r) (r.ok ? toast.success : toast.error)(r.message)
          })
        }}
      />
      Salesperson
    </label>
  )
}
