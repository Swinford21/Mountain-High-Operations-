'use client'

import { useActionState, useState } from 'react'
import { Pencil, ShieldPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FormError, useActionToast } from '@/components/action-feedback'
import { saveWarranty } from '@/app/actions/logistics'
import type { TruckWarranty } from '@/lib/db/schema'

export function WarrantyDialog({ truckId, warranty }: { truckId: number; warranty?: TruckWarranty }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(saveWarranty.bind(null, truckId, warranty?.id ?? null), null)
  useActionToast(state, () => setOpen(false))
  const p = warranty ? `w-${warranty.id}` : 'w-new'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          warranty ? (
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${warranty.item} warranty`} />
          ) : (
            <Button variant="outline" className="h-9" />
          )
        }
      >
        {warranty ? (
          <Pencil aria-hidden="true" />
        ) : (
          <>
            <ShieldPlus aria-hidden="true" />
            Add warranty
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{warranty ? 'Edit warranty' : 'Add a warranty'}</DialogTitle>
          <DialogDescription>Powertrain, battery, tires, body work, extended plans — anything with coverage.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${p}-item`}>Covers</Label>
            <Input id={`${p}-item`} name="item" required maxLength={200} defaultValue={warranty?.item} placeholder="e.g. Powertrain" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${p}-provider`}>Provider</Label>
              <Input id={`${p}-provider`} name="provider" maxLength={120} defaultValue={warranty?.provider ?? ''} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${p}-policy`}>Policy / claim #</Label>
              <Input id={`${p}-policy`} name="policyNumber" maxLength={80} defaultValue={warranty?.policyNumber ?? ''} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${p}-start`}>Starts</Label>
              <Input id={`${p}-start`} name="startDate" type="date" defaultValue={warranty?.startDate ?? ''} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${p}-end`}>Expires</Label>
              <Input id={`${p}-end`} name="endDate" type="date" defaultValue={warranty?.endDate ?? ''} />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor={`${p}-miles`}>Mileage limit</Label>
              <Input
                id={`${p}-miles`}
                name="mileageLimit"
                type="number"
                min={0}
                defaultValue={warranty?.mileageLimit ?? ''}
                placeholder="e.g. 100000"
                className="tabular-nums"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${p}-coverage`}>Coverage details</Label>
            <Textarea id={`${p}-coverage`} name="coverage" rows={3} maxLength={2000} defaultValue={warranty?.coverage ?? ''} />
          </div>
          <DialogFooter className="items-center">
            <FormError state={state} />
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : warranty ? 'Save' : 'Add warranty'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
