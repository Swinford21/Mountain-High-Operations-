'use client'

import { useActionState, useState, useTransition } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
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
import { createProduct, syncProductsFromSquare } from '@/app/actions/admin'

export function ProductActions({ categories, defaultCategory }: { categories: string[]; defaultCategory: string }) {
  const [syncing, startSync] = useTransition()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        className="h-9"
        disabled={syncing}
        onClick={() =>
          startSync(async () => {
            const r = await syncProductsFromSquare()
            if (r?.ok) toast.success(r.message)
            else toast.error(r?.message ?? 'Sync failed')
          })
        }
      >
        <RefreshCw aria-hidden="true" className={syncing ? 'animate-spin' : undefined} />
        {syncing ? 'Syncing…' : 'Sync from Square'}
      </Button>
      <AddProductDialog categories={categories} defaultCategory={defaultCategory} />
    </div>
  )
}

function AddProductDialog({ categories, defaultCategory }: { categories: string[]; defaultCategory: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(createProduct, null)
  useActionToast(state, () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="h-9" />}>
        <Plus aria-hidden="true" />
        Add product
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a product</DialogTitle>
          <DialogDescription>
            For items that aren&apos;t in Square. Items you add in Square come in with &ldquo;Sync from Square&rdquo;.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" name="name" required maxLength={200} placeholder="e.g. Triple Shredded Hardwood Mulch" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-category">Category</Label>
            <Input
              id="p-category"
              name="category"
              required
              maxLength={100}
              list="product-categories"
              defaultValue={defaultCategory}
              placeholder="Pick or type a new one"
            />
            <datalist id="product-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-price">Price (USD)</Label>
              <Input id="p-price" name="price" inputMode="decimal" placeholder="Leave blank if it varies" className="tabular-nums" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-unit">Unit</Label>
              <Input id="p-unit" name="unit" maxLength={30} defaultValue="each" placeholder="each, yard, ton…" />
            </div>
          </div>
          <DialogFooter className="items-center">
            <FormError state={state} />
            <Button type="submit" disabled={pending}>
              {pending ? 'Adding…' : 'Add product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
