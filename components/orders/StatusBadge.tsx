import { cn } from '@/lib/utils'
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from '@/types'
import type { OrderStatus } from '@/types'

interface StatusBadgeProps {
  status: OrderStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = ORDER_STATUS_LABELS[status]
  const colorClasses = ORDER_STATUS_COLORS[status]

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        colorClasses,
        className,
      )}
    >
      {label}
    </span>
  )
}
