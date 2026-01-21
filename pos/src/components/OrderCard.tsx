import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Clock, CheckCircle2, Loader2 } from 'lucide-react'

interface OrderCardProps {
  orderNumber: number
  type: 'NORMAL' | 'VIP'
  status: 'PENDING' | 'PROCESSING' | 'COMPLETE'
  className?: string
}

const statusConfig = {
  PENDING: {
    label: 'PENDING',
    icon: Clock,
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    pulse: true,
  },
  PROCESSING: {
    label: 'PROCESSING',
    icon: Loader2,
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    pulse: true,
    spin: true,
  },
  COMPLETE: {
    label: 'COMPLETE',
    icon: CheckCircle2,
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    pulse: false,
  },
}

export function OrderCard({
  orderNumber,
  type,
  status,
  className = '',
}: OrderCardProps) {
  const config = statusConfig[status]
  const StatusIcon = config.icon
  const isVIP = type === 'VIP'

  return (
    <Card
      className={`
        relative overflow-hidden border transition-all duration-300
        ${isVIP ? 'border-yellow-500/50 bg-gradient-to-br from-yellow-500/10 to-transparent' : 'bg-card'}
        ${config.pulse ? 'urgency-high' : ''}
        ${className}
      `}
    >
      {isVIP && (
        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-yellow-500/20 to-transparent" />
      )}

      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          {/* Order Number */}
          <div className="flex items-center gap-3">
            <div
              className={`
                font-mono text-2xl font-bold
                ${isVIP ? 'text-yellow-400' : 'text-foreground'}
              `}
            >
              #{String(orderNumber).padStart(3, '0')}
            </div>

            {/* Type Badge */}
            {isVIP && (
              <Badge
                variant="outline"
                className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50 font-semibold"
              >
                VIP
              </Badge>
            )}
          </div>

          {/* Status Badge */}
          <Badge
            variant="outline"
            className={`${config.color} gap-1.5 font-semibold`}
          >
            <StatusIcon className={`w-3.5 h-3.5 ${config.spin ? 'animate-spin' : ''}`} />
            {config.label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
