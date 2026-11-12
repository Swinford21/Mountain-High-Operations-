import { NOVEMBER_TO_DATE, pctChange, yearToDate, type Year } from '@/lib/sales-history'
import { cn } from '@/lib/utils'

const usd = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pct = (v: number) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`

export function Change({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('font-semibold tabular-nums', value >= 0 ? 'text-paid' : 'text-destructive', className)}>
      {pct(value)}
    </span>
  )
}

export function SalesSummary() {
  const ytd2026 = yearToDate(2026)
  const compare: Year[] = [2025, 2024, 2023]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-col gap-1 rounded-xl bg-primary p-5 text-primary-foreground">
        <span className="text-sm opacity-80">2026 sales, Jan–Oct</span>
        <span className="font-display text-3xl font-extrabold tabular-nums">{usd(ytd2026)}</span>
        <span className="text-sm opacity-80">
          November so far: <span className="font-semibold tabular-nums">{usd(NOVEMBER_TO_DATE[2026])}</span>
        </span>
      </div>
      {compare.map((y) => {
        const prior = yearToDate(y)
        const change = pctChange(ytd2026, prior)
        return (
          <div key={y} className="flex flex-col gap-1 rounded-xl border bg-card p-5">
            <span className="text-sm text-muted-foreground">vs. {y}, same months</span>
            <Change value={change} className="text-3xl" />
            <span className="text-sm text-muted-foreground">
              {usd(Math.abs(ytd2026 - prior))} {ytd2026 >= prior ? 'ahead' : 'behind'} · {y}: {usd(prior)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
