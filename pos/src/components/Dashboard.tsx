import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuthStore, type UserRole } from '@/store/auth'
import { useBotStore, useBotTimerCleanup } from '@/store/bot'
import { botProcessor } from '@/lib/bot-processor'
import { OrderCard } from './OrderCard'
import { BotDisplay } from './BotDisplay'
import { ControlPanel } from './ControlPanel'
import { OfflineIndicator } from './OfflineIndicator'
import { LogOut, User as UserIcon } from 'lucide-react'
import { Button } from './ui/button'
import { useQuery } from '@tanstack/react-query'
import type { Order, Bot } from '@/db/schema'

interface DashboardOrder {
  id: string
  orderNumber: number
  type: 'NORMAL' | 'VIP'
  status: 'PENDING' | 'PROCESSING' | 'COMPLETE'
}

interface DashboardBot {
  id: string
  status: 'IDLE' | 'PROCESSING'
  currentOrderId: string | null
}

export function Dashboard() {
  const navigate = useNavigate()
  const { state: authState, actions: authActions } = useAuthStore()
  const { state: botState, actions: botActions } = useBotStore()
  const [isCreating, setIsCreating] = useState(false)

  // Cleanup bot timers on unmount
  useBotTimerCleanup()

  // Fetch orders
  const {
    data: ordersData,
    refetch: refetchOrders,
    isLoading: ordersLoading,
  } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const response = await fetch('/api/orders')
      if (!response.ok) throw new Error('Failed to fetch orders')
      return response.json()
    },
    refetchInterval: 2000, // Poll every 2 seconds
  })

  // Fetch bots
  const {
    data: botsData,
    refetch: refetchBots,
    isLoading: botsLoading,
  } = useQuery({
    queryKey: ['bots'],
    queryFn: async () => {
      const response = await fetch('/api/bots')
      if (!response.ok) throw new Error('Failed to fetch bots')
      return response.json()
    },
    refetchInterval: 2000,
  })

  const orders = ordersData?.orders || []
  const bots = botsData?.bots || []

  // Group orders by status
  const pendingOrders = orders.filter((o: DashboardOrder) => o.status === 'PENDING')
  const processingOrders = orders.filter((o: DashboardOrder) => o.status === 'PROCESSING')
  const completeOrders = orders.filter((o: DashboardOrder) => o.status === 'COMPLETE')

  // Handle logout
  const handleLogout = () => {
    authActions.logout()
    navigate({ to: '/login' })
  }

  // Create order
  const createOrder = async (type: 'NORMAL' | 'VIP') => {
    if (!authState.user) return

    setIsCreating(true)
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          userId: authState.user.id,
        }),
      })

      if (!response.ok) throw new Error('Failed to create order')

      await refetchOrders()
    } catch (error) {
      console.error('Error creating order:', error)
    } finally {
      setIsCreating(false)
    }
  }

  // Add bot
  const addBot = async () => {
    setIsCreating(true)
    try {
      const response = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) throw new Error('Failed to create bot')

      const data = await response.json()
      const bot = data.bot

      // Initialize bot in store
      botActions.setBotState(bot.id, {
        status: 'IDLE',
        currentOrderId: null,
        remainingMs: 10000,
      })

      await refetchBots()
    } catch (error) {
      console.error('Error creating bot:', error)
    } finally {
      setIsCreating(false)
    }
  }

  // Remove bot
  const removeBot = async () => {
    const activeBots = bots.filter((b: DashboardBot) => b.status !== 'DELETED')
    if (activeBots.length === 0) return

    const newestBot = activeBots[activeBots.length - 1]

    setIsCreating(true)
    try {
      const response = await fetch(`/api/bots/${newestBot.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to remove bot')

      // Remove from store
      botActions.removeBot(newestBot.id)

      await refetchBots()
      await refetchOrders()
    } catch (error) {
      console.error('Error removing bot:', error)
    } finally {
      setIsCreating(false)
    }
  }

  // Auto-assign orders to idle bots
  useEffect(() => {
    if (!botState.isLeader) return

    const idleBots = bots.filter((b: DashboardBot) => b.status === 'IDLE')
    const unassignedOrders = pendingOrders

    if (idleBots.length > 0 && unassignedOrders.length > 0) {
      const bot = idleBots[0]
      const order = unassignedOrders[0] // VIP orders first due to SQL ordering

      // Start processing
      botProcessor.startOrderProcessing(bot.id, order.id)

      // Update order status
      fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PROCESSING',
          botId: bot.id,
        }),
      })
    }
  }, [bots, pendingOrders, botState.isLeader])

  // Listen for bot completion events
  useEffect(() => {
    const handleBotComplete = async (event: CustomEvent) => {
      const { botId, orderId } = event.detail

      // Mark order as complete
      await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETE' }),
      })

      await refetchOrders()
      await refetchBots()
    }

    window.addEventListener('bot-order-complete', handleBotComplete as EventListener)
    return () => {
      window.removeEventListener('bot-order-complete', handleBotComplete as EventListener)
    }
  }, [refetchOrders, refetchBots])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              <span className="text-foreground">FEED</span>
              <span className="text-primary">ME</span>
            </h1>
            <p className="text-sm text-muted-foreground">Order Controller</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-semibold">{authState.user?.username}</div>
              <div className="text-xs text-muted-foreground">
                {authState.user?.role}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Three Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pending Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Pending
                </h2>
                <span className="font-mono text-sm text-muted-foreground">
                  {pendingOrders.length}
                </span>
              </div>

              <div className="space-y-3 min-h-[400px]">
                {ordersLoading ? (
                  <div className="text-center text-muted-foreground py-8">
                    Loading...
                  </div>
                ) : pendingOrders.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 border border-dashed border-border/50 rounded-lg">
                    No pending orders
                  </div>
                ) : (
                  pendingOrders.map((order: DashboardOrder) => (
                    <OrderCard
                      key={order.id}
                      orderNumber={order.orderNumber}
                      type={order.type}
                      status={order.status}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Processing Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  Processing
                </h2>
                <span className="font-mono text-sm text-muted-foreground">
                  {processingOrders.length}
                </span>
              </div>

              <div className="space-y-3 min-h-[400px]">
                {ordersLoading ? (
                  <div className="text-center text-muted-foreground py-8">
                    Loading...
                  </div>
                ) : processingOrders.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 border border-dashed border-border/50 rounded-lg">
                    No orders processing
                  </div>
                ) : (
                  processingOrders.map((order: DashboardOrder) => (
                    <OrderCard
                      key={order.id}
                      orderNumber={order.orderNumber}
                      type={order.type}
                      status={order.status}
                    />
                  ))
                )}
              </div>

              {/* Bots Section */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Active Bots
                </h3>
                <div className="space-y-3">
                  {botsLoading ? (
                    <div className="text-center text-muted-foreground py-4 text-sm">
                      Loading...
                    </div>
                  ) : bots.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4 text-sm border border-dashed border-border/50 rounded-lg">
                      No bots active
                    </div>
                  ) : (
                    bots.map((bot: DashboardBot) => {
                      const botTimerState = botState.bots.get(bot.id)
                      return (
                        <BotDisplay
                          key={bot.id}
                          botId={bot.id}
                          status={bot.status}
                          remainingMs={botTimerState?.remainingMs}
                          currentOrderId={bot.currentOrderId}
                        />
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Complete Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Complete
                </h2>
                <span className="font-mono text-sm text-muted-foreground">
                  {completeOrders.length}
                </span>
              </div>

              <div className="space-y-3 min-h-[400px]">
                {ordersLoading ? (
                  <div className="text-center text-muted-foreground py-8">
                    Loading...
                  </div>
                ) : completeOrders.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 border border-dashed border-border/50 rounded-lg">
                    No complete orders
                  </div>
                ) : (
                  completeOrders.map((order: DashboardOrder) => (
                    <OrderCard
                      key={order.id}
                      orderNumber={order.orderNumber}
                      type={order.type}
                      status={order.status}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Control Panel */}
      <ControlPanel
        onCreateNormalOrder={() => createOrder('NORMAL')}
        onCreateVIPOrder={() => createOrder('VIP')}
        onAddBot={addBot}
        onRemoveBot={removeBot}
        botCount={bots.length}
        isCreating={isCreating}
      />

      {/* Offline Indicator */}
      <OfflineIndicator />
    </div>
  )
}
