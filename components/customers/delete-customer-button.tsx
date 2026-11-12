'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { deleteCustomer } from '@/app/actions/customers'

export function DeleteCustomerButton({ customerId }: { customerId: number }) {
  const [pending, startTransition] = useTransition()
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" className="self-start" />}>
        <Trash2 aria-hidden="true" />
        Delete customer
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this customer?</DialogTitle>
          <DialogDescription>
            Customers with jobs can&apos;t be deleted. This doesn&apos;t change anything in Square.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await deleteCustomer(customerId)
                if (r && !r.ok) toast.error(r.message)
              })
            }
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
