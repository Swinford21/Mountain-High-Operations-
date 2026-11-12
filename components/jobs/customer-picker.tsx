'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { AddressInput } from '@/components/address-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { searchCustomers } from '@/app/actions/customers'
import type { CustomerOption } from '@/lib/queries'

export function CustomerPicker({
  customers,
  defaultCustomerId,
  allowNew,
  onSelect,
}: {
  customers: CustomerOption[]
  defaultCustomerId?: number
  allowNew: boolean
  onSelect?: (customer: CustomerOption | null) => void
}) {
  const listId = useId()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<CustomerOption | null>(
    customers.find((c) => c.id === defaultCustomerId) ?? null,
  )
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState(false)
  const [matches, setMatches] = useState<CustomerOption[]>([])
  const [searching, startSearch] = useTransition()
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef('')

  function onQueryChange(value: string) {
    setQuery(value)
    setOpen(true)
    latest.current = value
    if (debounce.current) clearTimeout(debounce.current)
    if (value.trim().length < 2) {
      setMatches([])
      return
    }
    debounce.current = setTimeout(() => {
      startSearch(async () => {
        const results = await searchCustomers(value)
        if (latest.current === value) setMatches(results)
      })
    }, 200)
  }

  function choose(c: CustomerOption | null) {
    setSelected(c)
    setOpen(false)
    setQuery('')
    setMatches([])
    onSelect?.(c)
  }

  if (creating) {
    return (
      <fieldset className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
        <div className="flex items-center justify-between">
          <legend className="text-sm font-medium">New customer</legend>
          <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
            Pick existing instead
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="newCustomerName">Name</Label>
            <Input id="newCustomerName" name="newCustomerName" required autoComplete="off" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="newCustomerPhone">Mobile phone</Label>
            <Input id="newCustomerPhone" name="newCustomerPhone" type="tel" autoComplete="off" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="newCustomerEmail">Email</Label>
            <Input id="newCustomerEmail" name="newCustomerEmail" type="email" autoComplete="off" />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-3">
            <Label htmlFor="newCustomerBillingAddress">Billing address</Label>
            <AddressInput
              id="newCustomerBillingAddress"
              name="newCustomerBillingAddress"
              defaultValue=""
              placeholder="Leave blank if it's the same as the job address"
            />
          </div>
        </div>
      </fieldset>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${listId}-search`}>Customer</Label>
      <input type="hidden" name="customerId" value={selected?.id ?? ''} />
      {selected ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 p-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-medium">{selected.name}</span>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="truncate">{selected.phone || '—'}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="truncate">{selected.email || '—'}</dd>
              <dt className="text-muted-foreground">Address</dt>
              <dd className="truncate">{selected.address || 'No address on file'}</dd>
            </dl>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => choose(null)} aria-label="Change customer">
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={`${listId}-search`}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            placeholder="Search name, phone, email, or address"
            className="h-9 pl-9"
            value={query}
            autoComplete="off"
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && query.trim().length >= 2 && (
            <ul
              id={listId}
              role="listbox"
              aria-busy={searching}
              className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-md"
            >
              {matches.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  {searching ? 'Searching…' : 'No matching customers'}
                </li>
              )}
              {matches.map((c) => (
                <li key={c.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-muted"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(c)}
                  >
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {[c.phone, c.email].filter(Boolean).join(' · ') || 'No phone or email'}
                    </span>
                    <span className="text-xs text-muted-foreground">{c.address || 'No address on file'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {allowNew && !selected && (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" />
          New customer
        </Button>
      )}
    </div>
  )
}
