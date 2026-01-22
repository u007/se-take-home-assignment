import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Bot, Clock, Zap, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'

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
      className={cn(
        'group relative border-border/50 transition-all duration-500',
        isProcessing
          ? 'border-blue-500/40 bg-blue-500/[0.03] shadow-lg shadow-blue-500/5'
          : 'bg-card/40 backdrop-blur-md opacity-80',
        className,
      )}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'p-1.5 rounded-lg border transition-colors',
                isProcessing
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-500'
                  : 'bg-muted border-border text-muted-foreground',
              )}
            >
              <Cpu
                className={cn('w-3.5 h-3.5', isProcessing && 'animate-pulse')}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                Network Unit
              </span>
              <span className="font-mono text-xs font-bold">
                BOT-{botId.slice(-4).toUpperCase()}
              </span>
            </div>
          </div>

          <Badge
            variant="outline"
            className={cn(
              'text-[9px] font-black uppercase tracking-widest px-2 py-0 border-none',
              isProcessing
                ? 'bg-blue-500/10 text-blue-500'
                : 'bg-muted/50 text-muted-foreground/70',
            )}
          >
            {status}
          </Badge>
        </div>

        {/* Processing State */}
        {isProcessing && currentOrderId ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-blue-500 animate-ping" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Active Task
                </span>
              </div>
              <span className="font-mono text-[10px] font-black text-blue-500 bg-blue-500/10 px-1.5 rounded border border-blue-500/20">
                ORDER #{String(currentOrderId).padStart(3, '0')}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="relative">
                <Progress value={progress} className="h-1.5 bg-blue-500/10" />
                <div
                  className="absolute top-0 bottom-0 left-0 bg-blue-400 blur-sm opacity-50"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tighter">
                <span className="text-muted-foreground/60">
                  {Math.round(progress)}% Optimized
                </span>
                <span className="flex items-center gap-1 text-blue-500">
                  <Clock className="w-2.5 h-2.5" />
                  {remainingSeconds}s
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-4 border border-dashed border-border/50 rounded-lg bg-muted/20">
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
            <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em]">
              Standby Mode
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
