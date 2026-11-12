import Link from 'next/link'
import { Check } from 'lucide-react'
import { OPERATIONS } from '@/lib/operations'
import { cn } from '@/lib/utils'

const chip =
  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30'

export function OperationFilter({
  selected,
  hrefFor,
  mine,
  mineHref,
}: {
  selected: string[]
  hrefFor: (ops: string[]) => string
  mine?: boolean
  mineHref?: string
}) {
  const all = selected.length === 0
  return (
    <nav aria-label="Filter by operation" className="flex flex-wrap items-center gap-2">
      <Link
        href={hrefFor([])}
        aria-current={all ? 'true' : undefined}
        className={cn(chip, all ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-muted')}
      >
        All operations
      </Link>
      {OPERATIONS.map((op) => {
        const active = selected.includes(op.id)
        const nextOps = active ? selected.filter((o) => o !== op.id) : [...selected, op.id]
        return (
          <Link
            key={op.id}
            href={hrefFor(nextOps)}
            aria-pressed={active}
            className={cn(chip, active ? 'border-foreground bg-card' : 'bg-card text-muted-foreground hover:bg-muted')}
          >
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: op.color }} aria-hidden="true" />
            {op.label}
            {active && <Check className="size-3.5" aria-hidden="true" />}
          </Link>
        )
      })}
      {mineHref && (
        <Link
          href={mineHref}
          aria-pressed={mine}
          className={cn(chip, mine ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted')}
        >
          My jobs only
        </Link>
      )}
    </nav>
  )
}
