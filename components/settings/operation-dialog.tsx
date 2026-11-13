'use client'

import { useActionState, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { createOperation, updateOperation } from '@/app/actions/settings'
import type { Operation } from '@/lib/operations'

export function OperationDialog({ operation }: { operation?: Operation }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(
    operation ? updateOperation.bind(null, operation.id) : createOperation,
    null,
  )
  const [color, setColor] = useState(operation?.color ?? '#3c7d5a')
  useActionToast(state, () => setOpen(false))
  const idp = operation ? `op-${operation.id}` : 'op-new'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          operation ? (
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${operation.label}`} />
          ) : (
            <Button className="h-9" />
          )
        }
      >
        {operation ? (
          <Pencil aria-hidden="true" />
        ) : (
          <>
            <Plus aria-hidden="true" />
            Add operation
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{operation ? `Edit ${operation.label}` : 'Add an operation'}</DialogTitle>
          <DialogDescription>
            Operations are the kinds of work you schedule. They show up in the job form, calendar filters, and marketing
            audiences.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${idp}-label`}>Name (plural)</Label>
              <Input
                id={`${idp}-label`}
                name="label"
                required
                maxLength={60}
                defaultValue={operation?.label}
                placeholder="e.g. Tree Removals"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${idp}-singular`}>One job is a…</Label>
              <Input
                id={`${idp}-singular`}
                name="singular"
                required
                maxLength={60}
                defaultValue={operation?.singular}
                placeholder="e.g. Tree Removal"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${idp}-color`}>Calendar color</Label>
              <div className="flex items-center gap-3">
                <input
                  id={`${idp}-color`}
                  type="color"
                  name="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-14 cursor-pointer rounded-md border bg-background p-1"
                />
                <span className="font-mono text-xs text-muted-foreground uppercase">{color}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${idp}-sort`}>Order</Label>
              <Input
                id={`${idp}-sort`}
                name="sortOrder"
                type="number"
                min={0}
                max={999}
                defaultValue={operation?.sortOrder}
                placeholder="Last"
              />
            </div>
          </div>
          {operation && (
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked={operation.active}
                className="mt-0.5 size-4 accent-[var(--primary)]"
              />
              <span className="flex flex-col">
                <span className="font-medium">Available for new jobs</span>
                <span className="text-muted-foreground">Turn off to retire it. Past jobs keep their name and color.</span>
              </span>
            </label>
          )}
          <DialogFooter className="items-center">
            <FormError state={state} />
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : operation ? 'Save' : 'Add operation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
