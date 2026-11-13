import { Badge } from '@/components/ui/badge'
import { estimateStatusLabel } from '@/lib/estimate-status'
import { cn } from '@/lib/utils'

export function EstimateStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium',
        status === 'approved' && 'border-accent bg-accent/30 text-foreground',
        status === 'scheduled' && 'border-primary/30 bg-primary/10 text-primary',
        status === 'declined' && 'text-muted-foreground line-through',
      )}
    >
      {estimateStatusLabel(status)}
    </Badge>
  )
}
