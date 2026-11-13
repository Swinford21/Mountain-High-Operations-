import { Award, Cake } from 'lucide-react'
import { milestoneLabel, whenLabel, type Milestone } from '@/lib/hr'
import { formatDateShort } from '@/lib/time'
import { cn } from '@/lib/utils'

export function MilestoneList({ items, empty }: { items: Milestone[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="flex flex-col gap-2">
      {items.map((m) => {
        const Icon = m.kind === 'birthday' ? Cake : Award
        return (
          <li key={`${m.kind}-${m.employeeId}`} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full',
                m.daysAway === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{m.name}</span>
              <span className="text-muted-foreground">{milestoneLabel(m)}</span>
            </span>
            <span className="flex flex-col items-end text-right">
              <span className={cn('font-medium', m.daysAway === 0 && 'text-primary')}>{whenLabel(m.daysAway)}</span>
              <span className="text-xs text-muted-foreground">{formatDateShort(m.date)}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
