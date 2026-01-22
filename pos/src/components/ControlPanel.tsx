import { Button } from './ui/button'
import { Plus, Minus, Star, Cpu, ListChecks } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'
import { Separator } from './ui/separator'

interface ControlPanelProps {
  onCreateNormalOrder: () => void
  onCreateVIPOrder: () => void
  onAddBot: () => void
  onRemoveBot: () => void
  botCount: number
  isCreating?: boolean
}

export function ControlPanel({
  onCreateNormalOrder,
  onCreateVIPOrder,
  onAddBot,
  onRemoveBot,
  botCount,
  isCreating = false,
}: ControlPanelProps) {
  const { state } = useAuthStore()
  const user = state.user

  const canCreateVIP = user?.role === 'VIP' || user?.role === 'MANAGER'
  const canManageBots = user?.role === 'MANAGER'

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-fit px-6">
      <div className="glass shadow-2xl rounded-md px-6 py-4 flex items-center gap-8 ring-1 ring-white/10">
        {/* Order Controls */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-1">
              Order
            </span>
            <div className="flex items-center gap-2">
              <Button
                onClick={onCreateNormalOrder}
                disabled={isCreating}
                variant="default"
                size="sm"
                className="h-10 px-4 rounded-md gap-2 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Normal
              </Button>

              {canCreateVIP && (
                <Button
                  onClick={onCreateVIPOrder}
                  disabled={isCreating}
                  variant="outline"
                  size="sm"
                  className="h-10 px-4 rounded-md gap-2 font-bold border-amber-500/30 text-amber-500 bg-amber-500/5 transition-all hover:bg-amber-500/10 hover:scale-105 active:scale-95"
                >
                  <Star className="w-4 h-4 fill-amber-500" />
                  VIP Order
                </Button>
              )}
            </div>
          </div>
        </div>

        {canManageBots && (
          <>
            <Separator orientation="vertical" className="h-10 bg-white/10" />

            {/* Bot Controls */}
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-1">
                  Fleet ({botCount})
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={onAddBot}
                    disabled={isCreating}
                    variant="secondary"
                    size="sm"
                    className="h-10 px-4 rounded-md gap-2 font-bold bg-white/5 border border-white/10 transition-all hover:bg-white/10 hover:scale-105 active:scale-95"
                  >
                    <Plus className="w-4 h-4 text-blue-400" />
                    Deploy Bot
                  </Button>

                  {botCount > 0 && (
                    <Button
                      onClick={onRemoveBot}
                      disabled={isCreating}
                      variant="outline"
                      size="sm"
                      className="h-10 w-10 p-0 rounded-md border-destructive/20 text-destructive bg-destructive/5 transition-all hover:bg-destructive/10 hover:scale-105 active:scale-95"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
