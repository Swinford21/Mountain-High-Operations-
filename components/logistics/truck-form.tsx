'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FormError, useActionToast } from '@/components/action-feedback'
import { saveTruck } from '@/app/actions/logistics'
import type { Truck } from '@/lib/db/schema'

function Field({ id, label, children, className }: { id: string; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

export function TruckForm({ truck }: { truck?: Truck }) {
  const [state, formAction, pending] = useActionState(saveTruck.bind(null, truck?.id ?? null), null)
  const [color, setColor] = useState(truck?.color ?? '#3c567c')
  useActionToast(state)

  return (
    <form action={formAction} className="flex flex-col gap-6 rounded-xl border bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="t-name" label="Truck name" className="lg:col-span-2">
          <Input id="t-name" name="name" required maxLength={60} defaultValue={truck?.name} placeholder="e.g. Angel" />
        </Field>
        <Field id="t-color" label="Calendar color">
          <div className="flex items-center gap-3">
            <input
              id="t-color"
              type="color"
              name="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-14 cursor-pointer rounded-md border bg-background p-1"
            />
            <span className="font-mono text-xs text-muted-foreground uppercase">{color}</span>
          </div>
        </Field>
        <Field id="t-mileage" label="Current mileage">
          <Input id="t-mileage" name="mileage" type="number" min={0} defaultValue={truck?.mileage ?? ''} className="tabular-nums" />
        </Field>
        <Field id="t-year" label="Year">
          <Input id="t-year" name="year" type="number" min={1950} max={2100} defaultValue={truck?.year ?? ''} />
        </Field>
        <Field id="t-make" label="Make">
          <Input id="t-make" name="make" maxLength={60} defaultValue={truck?.make ?? ''} placeholder="e.g. Ford" />
        </Field>
        <Field id="t-model" label="Model">
          <Input id="t-model" name="model" maxLength={60} defaultValue={truck?.model ?? ''} placeholder="e.g. F-550" />
        </Field>
        <Field id="t-plate" label="License plate">
          <Input id="t-plate" name="plate" maxLength={20} defaultValue={truck?.plate ?? ''} className="uppercase" />
        </Field>
        <Field id="t-vin" label="VIN" className="lg:col-span-2">
          <Input id="t-vin" name="vin" maxLength={40} defaultValue={truck?.vin ?? ''} className="font-mono uppercase" />
        </Field>
        <Field id="t-reg" label="Registration expires">
          <Input id="t-reg" name="registrationExpires" type="date" defaultValue={truck?.registrationExpires ?? ''} />
        </Field>
        <Field id="t-ins" label="Insurance expires">
          <Input id="t-ins" name="insuranceExpires" type="date" defaultValue={truck?.insuranceExpires ?? ''} />
        </Field>
      </div>
      <Field id="t-notes" label="Notes">
        <Textarea
          id="t-notes"
          name="notes"
          rows={3}
          maxLength={4000}
          defaultValue={truck?.notes ?? ''}
          placeholder="Tire size, oil type, hitch, tow capacity…"
        />
      </Field>
      <div className="flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        {truck ? (
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="active" defaultChecked={truck.active} className="size-4 accent-[var(--primary)]" />
            In service (can be assigned to jobs)
          </label>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          <FormError state={state} />
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : truck ? 'Save truck' : 'Add truck'}
          </Button>
        </div>
      </div>
    </form>
  )
}
