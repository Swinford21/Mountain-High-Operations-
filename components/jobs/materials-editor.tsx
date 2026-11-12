'use client'

import { useId, useMemo, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ProductOption } from '@/lib/queries'

export type MaterialLine = {
  productId: number | null
  name: string
  unit: string
  quantity: number
  unitPriceCents: number
}

const money = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export function MaterialsEditor({
  products,
  initial,
  onTotalChange,
}: {
  products: ProductOption[]
  initial: MaterialLine[]
  onTotalChange?: (cents: number) => void
}) {
  const listId = useId()
  const [lines, setLines] = useState<MaterialLine[]>(initial)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      .slice(0, 10)
  }, [products, query])

  function update(next: MaterialLine[]) {
    setLines(next)
    onTotalChange?.(next.reduce((s, l) => s + Math.round(l.quantity * l.unitPriceCents), 0))
  }

  function add(p: ProductOption) {
    update([...lines, { productId: p.id, name: p.name, unit: p.unit, quantity: 1, unitPriceCents: p.priceCents ?? 0 }])
    setQuery('')
    setOpen(false)
  }

  const total = lines.reduce((s, l) => s + Math.round(l.quantity * l.unitPriceCents), 0)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Materials</h2>
        {lines.length > 0 && (
          <span className="text-sm text-muted-foreground">
            Materials total <span className="font-semibold text-foreground tabular-nums">{money(total)}</span>
          </span>
        )}
      </div>
      <input type="hidden" name="items" value={JSON.stringify(lines)} />

      {lines.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border bg-card">
          {lines.map((l, i) => (
            <li key={i} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <span className="min-w-40 flex-1 text-sm font-medium">{l.name}</span>
              <label className="flex items-center gap-1.5 text-sm">
                <span className="sr-only">Quantity of {l.name}</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.5"
                  value={l.quantity}
                  onChange={(e) =>
                    update(lines.map((x, j) => (j === i ? { ...x, quantity: Math.max(0, Number(e.target.value)) } : x)))
                  }
                  className="h-8 w-20 tabular-nums"
                />
                <span className="text-muted-foreground">{l.unit}</span>
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <span className="text-muted-foreground">@</span>
                <span className="sr-only">Unit price for {l.name}</span>
                <Input
                  inputMode="decimal"
                  value={(l.unitPriceCents / 100).toFixed(2)}
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(/[$,]/g, ''))
                    if (Number.isFinite(v) && v >= 0)
                      update(lines.map((x, j) => (j === i ? { ...x, unitPriceCents: Math.round(v * 100) } : x)))
                  }}
                  className="h-8 w-24 tabular-nums"
                />
              </label>
              <span className="w-24 text-right text-sm font-semibold tabular-nums">
                {money(Math.round(l.quantity * l.unitPriceCents))}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${l.name}`}
                onClick={() => update(lines.filter((_, j) => j !== i))}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative max-w-lg">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          role="combobox"
          aria-expanded={open && matches.length > 0}
          aria-controls={listId}
          aria-label="Add a product"
          placeholder="Add product — mulch, #57 stone, pavers, sod…"
          value={query}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="h-9 pl-9"
        />
        {open && matches.length > 0 && (
          <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-md">
            {matches.map((p) => (
              <li key={p.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(p)}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-muted"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.category}</span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums">
                    {p.priceCents != null ? `${money(p.priceCents)} / ${p.unit}` : 'Variable'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {lines.length === 0 && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Plus className="size-3.5" aria-hidden="true" />
          Search your Square catalog to add materials. Prices fill in automatically.
        </p>
      )}
    </section>
  )
}
