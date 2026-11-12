'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setTruckColor } from '@/app/actions/admin'

export function TruckColorControl({ truckId, name, color }: { truckId: number; name: string; color: string }) {
  const [value, setValue] = useState(color)
  const [pending, startTransition] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const saved = useRef(color.toLowerCase())

  function save(next: string) {
    if (next.toLowerCase() === saved.current) return
    startTransition(async () => {
      const result = await setTruckColor(truckId, next)
      if (result?.ok) {
        saved.current = next.toLowerCase()
        toast.success(result.message)
      } else {
        toast.error(result?.message ?? 'Could not save color')
        setValue(saved.current)
      }
    })
  }

  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="font-mono text-xs text-muted-foreground uppercase tabular-nums">{value}</span>
      <input
        type="color"
        value={value}
        aria-label={`Color for ${name}`}
        aria-busy={pending}
        onChange={(e) => {
          const next = e.target.value
          setValue(next)
          clearTimeout(timer.current)
          // The picker fires on every drag step; save once the user settles on a color.
          timer.current = setTimeout(() => save(next), 700)
        }}
        className="h-9 w-12 cursor-pointer rounded-md border bg-background p-1"
      />
    </label>
  )
}
