import Link from 'next/link'
import { cn } from '@/lib/utils'

export type CalendarView = 'day' | 'week' | 'month' | 'year'

const OPTIONS: { value: CalendarView; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

export function ViewToggle({ current, hrefFor }: { current: CalendarView; hrefFor: (view: CalendarView) => string }) {
  return (
    <nav aria-label="Calendar view" className="inline-flex rounded-lg border bg-muted p-0.5">
      {OPTIONS.map((o) => {
        const active = o.value === current
        return (
          <Link
            key={o.value}
            href={hrefFor(o.value)}
            scroll={false}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </Link>
        )
      })}
    </nav>
  )
}
