import { Badge } from '@/components/ui/badge'
import { formatDateShort } from '@/lib/time'
import { cn } from '@/lib/utils'

export const EXPIRY_WARNING_DAYS = 30

export type ExpiryStatus = 'expired' | 'soon' | 'ok' | 'none'

export function expiryStatus(date: string | null | undefined, today: string): ExpiryStatus {
  if (!date) return 'none'
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
  if (days < 0) return 'expired'
  if (days <= EXPIRY_WARNING_DAYS) return 'soon'
  return 'ok'
}

export function ExpiryBadge({ date, today, label }: { date: string | null; today: string; label?: string }) {
  const status = expiryStatus(date, today)
  if (status === 'none' || !date) return <span className="text-muted-foreground">—</span>
  const text = `${label ? `${label} ` : ''}${status === 'expired' ? 'expired' : 'expires'} ${formatDateShort(date)}, ${date.slice(0, 4)}`
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium',
        status === 'expired' && 'border-destructive/40 bg-destructive/10 text-destructive',
        status === 'soon' && 'border-accent bg-accent/30 text-foreground',
        status === 'ok' && 'text-muted-foreground',
      )}
    >
      {text}
    </Badge>
  )
}
