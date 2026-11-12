'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { AddressInput } from '@/components/address-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ActionState } from '@/app/actions/jobs'

type Defaults = {
  name?: string
  email?: string | null
  phone?: string | null
  address?: string | null
  billingAddress?: string | null
  notes?: string | null
  emailOptIn?: boolean
  smsOptIn?: boolean
}

export function CustomerForm({
  action,
  defaults = {},
  mode,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  defaults?: Defaults
  mode: 'create' | 'edit'
}) {
  const [state, formAction, pending] = useActionState(action, null)

  useEffect(() => {
    if (state) (state.ok ? toast.success : toast.error)(state.message)
  }, [state])

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="c-name">Name</Label>
          <Input id="c-name" name="name" required defaultValue={defaults.name} className="h-9" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="c-phone">Mobile phone</Label>
          <Input id="c-phone" name="phone" type="tel" defaultValue={defaults.phone ?? ''} className="h-9" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="c-email">Email</Label>
          <Input id="c-email" name="email" type="email" defaultValue={defaults.email ?? ''} className="h-9" />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="c-address">Service address</Label>
          <AddressInput id="c-address" name="address" defaultValue={defaults.address ?? ''} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="c-billing">Billing address</Label>
          <AddressInput
            id="c-billing"
            name="billingAddress"
            defaultValue={defaults.billingAddress ?? ''}
            placeholder="Leave blank if it's the same as the service address"
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="c-notes">Notes</Label>
          <Textarea id="c-notes" name="notes" rows={3} defaultValue={defaults.notes ?? ''} />
        </div>
      </div>

      {mode === 'edit' && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Marketing permission</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="emailOptIn" defaultChecked={defaults.emailOptIn} className="size-4 accent-[var(--primary)]" />
            Marketing emails
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="smsOptIn" defaultChecked={defaults.smsOptIn} className="size-4 accent-[var(--primary)]" />
            Marketing texts
          </label>
          <p className="text-sm text-muted-foreground">Job confirmations and reminders are always sent.</p>
        </fieldset>
      )}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Saving…' : mode === 'create' ? 'Add customer' : 'Save customer'}
      </Button>
    </form>
  )
}
