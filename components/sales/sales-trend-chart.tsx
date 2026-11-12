'use client'

import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MONTHLY_SALES, MONTHS, YEAR_COLORS, YEARS, type Year } from '@/lib/sales-history'
import { cn } from '@/lib/utils'

const usd = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const compact = (v: number) => `$${v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${Math.round(v / 1000)}k`}`

type Mode = 'monthly' | 'cumulative'

export function SalesTrendChart() {
  const [mode, setMode] = useState<Mode>('monthly')
  const [hidden, setHidden] = useState<Set<Year>>(new Set())

  const data = useMemo(() => {
    const running: Record<Year, number> = { 2026: 0, 2025: 0, 2024: 0, 2023: 0 }
    return MONTHS.map((month, i) => {
      const row: Record<string, string | number | null> = { month }
      for (const y of YEARS) {
        const v = MONTHLY_SALES[y][i]
        if (v == null) {
          row[y] = null
          continue
        }
        running[y] += v
        row[y] = mode === 'monthly' ? v : running[y]
      }
      return row
    })
  }, [mode])

  function toggleYear(y: Year) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(y)) next.delete(y)
      else next.add(y)
      return next
    })
  }

  return (
    <section aria-labelledby="trend-heading" className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="trend-heading" className="font-semibold">
          {mode === 'monthly' ? 'Sales by month' : 'Running total for the year'}
        </h2>
        <div role="group" aria-label="Chart view" className="flex rounded-lg border p-0.5 text-sm">
          {(['monthly', 'cumulative'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'rounded-md px-3 py-1 font-medium capitalize transition-colors',
                mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m === 'monthly' ? 'Monthly' : 'Year to date'}
            </button>
          ))}
        </div>
      </div>

      <div role="group" aria-label="Years shown" className="flex flex-wrap gap-2">
        {YEARS.map((y) => {
          const on = !hidden.has(y)
          return (
            <button
              key={y}
              type="button"
              aria-pressed={on}
              onClick={() => toggleYear(y)}
              className={cn(
                'flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium transition-opacity',
                !on && 'opacity-45',
              )}
            >
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: YEAR_COLORS[y] }} />
              {y}
            </button>
          )
        })}
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
            <YAxis
              tickFormatter={compact}
              tickLine={false}
              axisLine={false}
              width={56}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <Tooltip
              formatter={(value, name) => [usd(Number(value)), String(name)]}
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--popover-foreground)',
                fontSize: 13,
              }}
            />
            {[...YEARS].reverse().map((y) =>
              hidden.has(y) ? null : (
                <Line
                  key={y}
                  dataKey={String(y)}
                  name={String(y)}
                  type="monotone"
                  stroke={YEAR_COLORS[y]}
                  strokeWidth={y === 2026 ? 3 : 2}
                  dot={y === 2026 ? { r: 3 } : false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ),
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
