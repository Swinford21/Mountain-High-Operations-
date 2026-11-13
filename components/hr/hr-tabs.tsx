import Link from 'next/link'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'employees', label: 'Employees', href: '/hr' },
  { id: 'team', label: 'Team access', href: '/hr/team' },
] as const

export function HrTabs({ current, pendingCount = 0 }: { current: (typeof TABS)[number]['id']; pendingCount?: number }) {
  return (
    <nav aria-label="Human Resources sections" className="flex gap-1 border-b">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={t.id === current ? 'page' : undefined}
          className={cn(
            '-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium',
            t.id === current
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
          {t.id === 'team' && pendingCount > 0 && (
            <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-foreground tabular-nums">
              {pendingCount}
            </span>
          )}
        </Link>
      ))}
    </nav>
  )
}
