import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Bot, Clock, Zap } from 'lucide-react'

interface BotDisplayProps {
  botId: string
  status: 'IDLE' | 'PROCESSING'
  remainingMs?: number
  currentOrderId?: string | null
  className?: string
}

export function BotDisplay({
  botId,
  status,
  remainingMs = 10000,
  currentOrderId = null,
  className = '',
}: BotDisplayProps) {
  const isProcessing = status === 'PROCESSING'
  const progress = isProcessing ? ((10000 - remainingMs) / 10000) * 100 : 0
  const remainingSeconds = Math.ceil(remainingMs / 1000)

  return (
    <Card
      className={`
        border transition-all duration-300
        ${isProcessing ? 'border-blue-500/50 bg-blue-500/5 animate-pulse-glow' : 'bg-card'}
        ${className}
      `}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bot
              className={`w-4 h-4 ${isProcessing ? 'text-blue-400 animate-pulse' : 'text-muted-foreground'}`}
            />
            <span className="font-mono text-sm text-muted-foreground">
              BOT-{botId.slice(-4).toUpperCase()}
            </span>
          </div>

          <Badge
            variant="outline"
            className={
              isProcessing
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                : 'bg-muted text-muted-foreground'
            }
          >
            {status}
          </Badge>
        </div>

        {/* Processing State */}
        {isProcessing && currentOrderId && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Processing
              </span>
              <span className="font-mono text-blue-400 font-semibold">
                #{String(currentOrderId).padStart(3, '0')}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{Math.round(progress)}% complete</span>
                <span className="font-mono flex items-center gap-1">
                  <Zap className="w-3 h-3 text-blue-400" />
                  {remainingSeconds}s
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Idle State */}
        {!isProcessing && (
          <div className="text-xs text-muted-foreground text-center py-2">
            Ready for orders
          </div>
        )}
      </CardContent>
    </Card>
  )
}
