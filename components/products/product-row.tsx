'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { updateProduct } from '@/app/actions/admin'
import { cn } from '@/lib/utils'

export function ProductRow({
  id,
  name,
  variation,
  unit,
  priceCents,
  active,
}: {
  id: number
  name: string
  variation?: string | null
  unit: string
  priceCents: number | null
  active: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [price, setPrice] = useState(priceCents != null ? (priceCents / 100).toFixed(2) : '')
  const [isActive, setIsActive] = useState(active)

  function savePrice() {
    const trimmed = price.trim()
    const cents = trimmed === '' ? null : Math.round(Number(trimmed.replace(/[$,]/g, '')) * 100)
    if (cents !== null && !Number.isFinite(cents)) return toast.error('Enter a valid price')
    if (cents === priceCents) return
    startTransition(async () => {
      const r = await updateProduct(id, { priceCents: cents })
      if (r && !r.ok) toast.error(r.message)
    })
  }

  return (
    <li className={cn('flex flex-wrap items-center gap-3 px-4 py-2.5', !isActive && 'opacity-60')}>
      <span className="min-w-48 flex-1 text-sm font-medium">
        {name}
        {variation && variation !== 'Regular' && <span className="font-normal text-muted-foreground"> · {variation}</span>}
      </span>
      <label className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">$</span>
        <span className="sr-only">Price for {name}</span>
        <Input
          value={price}
          inputMode="decimal"
          placeholder="Variable"
          disabled={pending}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={savePrice}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
              e.preventDefault()
              savePrice()
            }
          }}
          className="h-8 w-24 tabular-nums"
        />
        <span className="w-10 text-muted-foreground">/ {unit}</span>
      </label>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Switch
          checked={isActive}
          disabled={pending}
          onCheckedChange={(v) => {
            setIsActive(v)
            startTransition(async () => {
              const r = await updateProduct(id, { active: v })
              if (r && !r.ok) toast.error(r.message)
            })
          }}
        />
        <span className="sr-only">Show {name} when adding materials</span>
        <span aria-hidden="true">{isActive ? 'Active' : 'Hidden'}</span>
      </label>
    </li>
  )
}
