'use client'

import { useActionState, useState } from 'react'
import { Wrench } from 'lucide-react'
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
import { addRepair } from '@/app/actions/logistics'

export function RepairDialog({ truckId, truckName, today }: { truckId: number; truckName: string; today: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(addRepair.bind(null, truckId), null)
  useActionToast(state, () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="h-9" />}>
        <Wrench aria-hidden="true" />
        Log repair
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a repair</DialogTitle>
          <DialogDescription>{truckName}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="r-date">Date</Label>
              <Input id="r-date" name="repairDate" type="date" required defaultValue={today} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="r-mileage">Mileage</Label>
              <Input id="r-mileage" name="mileage" type="number" min={0} className="tabular-nums" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="r-desc">What was done</Label>
            <Textarea id="r-desc" name="description" rows={3} required maxLength={2000} placeholder="e.g. Replaced front brake pads and rotors" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="r-vendor">Shop / vendor</Label>
              <Input id="r-vendor" name="vendor" maxLength={120} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="r-cost">Cost (USD)</Label>
              <Input id="r-cost" name="cost" inputMode="decimal" placeholder="0.00" className="tabular-nums" />
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="coveredByWarranty" className="size-4 accent-[var(--primary)]" />
            Covered by warranty
          </label>
          <DialogFooter className="items-center">
            <FormError state={state} />
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Log repair'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
