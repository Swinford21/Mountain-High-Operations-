'use client'

import { useId, useMemo, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
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
  const [selectedId, setSelectedId] = useState<number | undefined>(defaultCustomerId)
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState(false)

  const selected = customers.find((c) => c.id === selectedId) ?? null

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers.slice(0, 8)
    const digits = q.replace(/\D/g, '')
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          (digits.length >= 3 && c.phone?.replace(/\D/g, '').includes(digits)) ||
          c.address?.toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [customers, query])

  function choose(c: CustomerOption | null) {
    setSelectedId(c?.id)
    setOpen(false)
    setQuery('')
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
          <div className="flex min-w-0 flex-col">
            <span className="font-medium">{selected.name}</span>
            <span className="truncate text-sm text-muted-foreground">
              {[selected.phone, selected.email].filter(Boolean).join(' · ') || 'No contact info'}
            </span>
            {selected.address && <span className="truncate text-sm text-muted-foreground">{selected.address}</span>}
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
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-md"
            >
              {matches.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No matching customers</li>}
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
                      {[c.phone, c.address].filter(Boolean).join(' · ')}
                    </span>
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
