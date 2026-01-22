import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Clock, CheckCircle2, Loader2, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OrderCardProps {
  orderNumber: number
  type: 'NORMAL' | 'VIP'
  status: 'PENDING' | 'PROCESSING' | 'COMPLETE'
  className?: string
}

const statusConfig = {
  PENDING: {
    label: 'Pending',
    icon: Clock,
    color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    dot: 'bg-amber-500',
  },
  PROCESSING: {
    label: 'Processing',
    icon: Loader2,
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    dot: 'bg-blue-500',
    spin: true,
  },
  COMPLETE: {
    label: 'Complete',
    icon: CheckCircle2,
    color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    dot: 'bg-emerald-500',
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
      className={cn(
        'group relative overflow-hidden border-border/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5',
        isVIP
          ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] to-transparent'
          : 'bg-card/40 backdrop-blur-md',
        status === 'PENDING' && 'urgency-high',
        className,
      )}
    >
      {isVIP && (
        <div className="absolute -right-6 -top-6 w-16 h-16 bg-amber-500/10 blur-2xl rounded-md transition-all group-hover:bg-amber-500/20" />
      )}

      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Order Reference
            </span>
            <div
              className={cn(
                'font-mono text-2xl font-black tracking-tighter',
                isVIP ? 'text-amber-500' : 'text-foreground',
              )}
            >
              #{String(orderNumber).padStart(3, '0')}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            {isVIP && (
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-1.5 py-0 text-[10px] font-black uppercase tracking-tighter"
              >
                <Star className="w-3 h-3 mr-1 fill-amber-500" />
                VIP
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn(
                'gap-1.5 font-bold text-[10px] uppercase tracking-wider py-1 border-none px-2',
                config.color,
              )}
            >
              <div
                className={cn(
                  'w-1.5 h-1.5 rounded-sm',
                  config.dot,
                  config.spin && 'animate-pulse',
                )}
              />
              <StatusIcon
                className={cn('w-3 h-3', config.spin && 'animate-spin')}
              />
              {config.label}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
