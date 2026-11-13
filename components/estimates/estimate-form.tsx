'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { AddressInput } from '@/components/address-input'
import { CustomerPicker } from '@/components/jobs/customer-picker'
import { MaterialsEditor, type MaterialLine } from '@/components/jobs/materials-editor'
import type { Operation } from '@/lib/operations'
import type { ActionState } from '@/app/actions/jobs'
import type { CustomerOption, ProductOption, SalespersonOption } from '@/lib/queries'
import { cn } from '@/lib/utils'

type EstimateDefaults = {
  customerId?: number
  operation?: string
  title?: string
  address?: string | null
  priceCents?: number | null
  description?: string | null
  validUntil?: string | null
  salespersonId?: string | null
}

export function EstimateForm({
  action,
  customers,
  operations,
  products,
  salespeople,
  initialItems = [],
  defaults,
  mode,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  customers: CustomerOption[]
  operations: Operation[]
  products: ProductOption[]
  salespeople: SalespersonOption[]
  initialItems?: MaterialLine[]
  defaults: EstimateDefaults
  mode: 'create' | 'edit'
}) {
  const [state, formAction, pending] = useActionState(action, null)
  const [operation, setOperation] = useState(defaults.operation ?? operations[0]?.id ?? '')
  const [address, setAddress] = useState(defaults.address ?? '')
  const [price, setPrice] = useState(defaults.priceCents != null ? (defaults.priceCents / 100).toFixed(2) : '')
  const [priceTouched, setPriceTouched] = useState(defaults.priceCents != null)

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Operation</h2>
        <div role="radiogroup" aria-label="Operation" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {operations.map((op) => {
            const checked = operation === op.id
            return (
              <label
                key={op.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm font-medium transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/30',
                  checked ? 'border-foreground' : 'hover:bg-muted',
                )}
              >
                <input
                  type="radio"
                  name="operation"
                  value={op.id}
                  checked={checked}
                  onChange={() => setOperation(op.id)}
                  className="sr-only"
                />
                <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: op.color }} aria-hidden="true" />
                {op.singular}
              </label>
            )
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <CustomerPicker
          customers={customers}
          defaultCustomerId={defaults.customerId}
          allowNew={mode === 'create'}
          onSelect={(c) => {
            if (c) setAddress(c.address ?? '')
          }}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="title">Project</Label>
          <Input
            id="title"
            name="title"
            required
            defaultValue={defaults.title ?? ''}
            placeholder="e.g. Front beds — 12 yds pine nuggets + edging"
            className="h-9"
          />
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="address">Job address</Label>
          <AddressInput
            id="address"
            name="address"
            value={address}
            onValueChange={setAddress}
            placeholder="Fills in from the customer — or start typing an address"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="price">Estimate total (USD)</Label>
          <Input
            id="price"
            name="price"
            inputMode="decimal"
            placeholder="0.00"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value)
              setPriceTouched(true)
            }}
            className="h-9 tabular-nums"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="validUntil">Valid until</Label>
          <Input id="validUntil" name="validUntil" type="date" defaultValue={defaults.validUntil ?? ''} className="h-9" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="salespersonId">Salesperson</Label>
          <NativeSelect id="salespersonId" name="salespersonId" defaultValue={defaults.salespersonId ?? ''}>
            <option value="">None</option>
            {salespeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            {defaults.salespersonId && !salespeople.some((p) => p.id === defaults.salespersonId) && (
              <option value={defaults.salespersonId}>Former salesperson</option>
            )}
          </NativeSelect>
        </div>
      </section>

      <MaterialsEditor
        products={products}
        initial={initialItems}
        onTotalChange={(cents) => {
          if (!priceTouched) setPrice(cents ? (cents / 100).toFixed(2) : '')
        }}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Scope of work</Label>
        <Textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={defaults.description ?? ''}
          placeholder="What's included, prep work, haul-off, anything the customer is agreeing to…"
        />
        <p className="text-sm text-muted-foreground">The customer sees this on their approval page and in the email.</p>
      </div>

      <div className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="sendNow" defaultChecked={mode === 'create'} className="mt-0.5 size-4 accent-[var(--primary)]" />
          <span className="flex flex-col">
            <span className="font-medium">{mode === 'create' ? 'Email and text it to the customer now' : 'Resend to the customer'}</span>
            <span className="text-muted-foreground">They get a link to review and approve it online.</span>
          </span>
        </label>
        <div className="flex items-center gap-3">
          {state && !state.ok && (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}
          <Button type="submit" disabled={pending} className="h-10 px-5">
            {pending ? 'Saving…' : mode === 'create' ? 'Create estimate' : 'Save changes'}
          </Button>
        </div>
      </div>
    </form>
  )
}
