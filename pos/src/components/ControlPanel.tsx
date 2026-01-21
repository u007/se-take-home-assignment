import { Button } from './ui/button'
import { Plus, Minus, Star } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

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
    <div className="border-t bg-card/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Order Controls */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Orders
            </span>

            <div className="flex items-center gap-2">
              <Button
                onClick={onCreateNormalOrder}
                disabled={isCreating}
                variant="default"
                size="lg"
                className="gap-2 font-semibold"
              >
                <Plus className="w-4 h-4" />
                Normal Order
              </Button>

              {canCreateVIP && (
                <Button
                  onClick={onCreateVIPOrder}
                  disabled={isCreating}
                  variant="outline"
                  size="lg"
                  className="gap-2 font-semibold border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                >
                  <Star className="w-4 h-4 fill-yellow-400" />
                  VIP Order
                </Button>
              )}
            </div>
          </div>

          {/* Bot Controls */}
          {canManageBots && (
            <>
              <div className="h-8 w-px bg-border" />

              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Bots ({botCount})
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={onAddBot}
                    disabled={isCreating}
                    variant="secondary"
                    size="lg"
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Bot
                  </Button>

                  {botCount > 0 && (
                    <Button
                      onClick={onRemoveBot}
                      disabled={isCreating}
                      variant="outline"
                      size="lg"
                      className="gap-2 text-destructive border-destructive/50 hover:bg-destructive/10"
                    >
                      <Minus className="w-4 h-4" />
                      Remove Bot
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
