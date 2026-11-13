'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { NativeSelect } from '@/components/ui/native-select'
import { setUserPosition } from '@/app/actions/admin'
import { POSITIONS } from '@/lib/positions'

export function PositionControl({ userId, name, position }: { userId: string; name: string; position: string | null }) {
  const [value, setValue] = useState(position ?? '')
  const [pending, startTransition] = useTransition()

  return (
    <div className="w-36">
      <label htmlFor={`position-${userId}`} className="sr-only">
        Position for {name}
      </label>
      <NativeSelect
        id={`position-${userId}`}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value
          const prev = value
          setValue(next)
          startTransition(async () => {
            const r = await setUserPosition(userId, next)
            if (r?.ok) toast.success(r.message)
            else {
              setValue(prev)
              toast.error(r?.message ?? 'Could not save position')
            }
          })
        }}
      >
        <option value="">No position</option>
        {POSITIONS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  )
}
