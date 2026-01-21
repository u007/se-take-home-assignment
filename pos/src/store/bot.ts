import { createStore } from '@tanstack/store'
import { useEffect } from 'react'

// Bot timer state type
export interface BotTimerState {
  remainingMs: number
  status: 'IDLE' | 'PROCESSING'
  currentOrderId: string | null
  lastTick: number
}

// Bot store state
interface BotStoreState {
  bots: Map<string, BotTimerState>
  isLeader: boolean // Single-writer: only leader tab processes orders
}

// Initialize store from localStorage if available
function loadBotStoreState(): BotStoreState {
  if (typeof window === 'undefined') {
    return { bots: new Map(), isLeader: false }
  }

  try {
    const saved = localStorage.getItem('bot-store-state')
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        bots: new Map(Object.entries(parsed.bots || {})),
        isLeader: parsed.isLeader || false,
      }
    }
  } catch (e) {
    console.error('Failed to load bot store state:', e)
  }

  return { bots: new Map(), isLeader: false }
}

// Save state to localStorage
function saveBotStoreState(state: BotStoreState) {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(
      'bot-store-state',
      JSON.stringify({
        bots: Object.fromEntries(state.bots),
        isLeader: state.isLeader,
      }),
    )
  } catch (e) {
    console.error('Failed to save bot store state:', e)
  }
}

// Create bot store
export const botStore = createStore<BotStoreState>({
  ...loadBotStoreState(),
})

// Subscribe to state changes and persist to localStorage
if (typeof window !== 'undefined') {
  botStore.subscribe((state) => {
    saveBotStoreState(state)
  })
}

// Bot store actions
export const botActions = {
  // Initialize or update a bot's state
  setBotState: (
    botId: string,
    state: Partial<BotTimerState>,
    updateTimestamp = true,
  ) => {
    botStore.setState((prev) => {
      const bots = new Map(prev.bots)
      const existing = bots.get(botId) || {
        remainingMs: 10000, // 10 seconds
        status: 'IDLE' as const,
        currentOrderId: null,
        lastTick: Date.now(),
      }
      bots.set(botId, {
        ...existing,
        ...state,
        lastTick: updateTimestamp ? Date.now() : existing.lastTick,
      })
      return { ...prev, bots }
    })
  },

  // Start bot timer (10-second countdown)
  startBotTimer: (botId: string, orderId: string) => {
    botActions.setBotState(botId, {
      status: 'PROCESSING',
      currentOrderId: orderId,
      remainingMs: 10000, // 10 seconds in milliseconds
      lastTick: Date.now(),
    })
  },

  // Tick bot timer (decrement remaining time)
  tickBotTimer: (botId: string, deltaMs: number) => {
    botStore.setState((prev) => {
      const bots = new Map(prev.bots)
      const existing = bots.get(botId)
      if (existing && existing.status === 'PROCESSING') {
        const newRemainingMs = Math.max(0, existing.remainingMs - deltaMs)
        bots.set(botId, {
          ...existing,
          remainingMs: newRemainingMs,
          lastTick: Date.now(),
        })
        return { ...prev, bots }
      }
      return prev
    })
  },

  // Complete bot order (move to idle)
  completeBotOrder: (botId: string) => {
    botActions.setBotState(botId, {
      status: 'IDLE',
      currentOrderId: null,
      remainingMs: 10000,
    })
  },

  // Remove bot from store
  removeBot: (botId: string) => {
    botStore.setState((prev) => {
      const bots = new Map(prev.bots)
      bots.delete(botId)
      return { ...prev, bots }
    })
  },

  // Clear all bot timers
  clearAllTimers: () => {
    botStore.setState((prev) => ({
      ...prev,
      bots: new Map(),
    }))
  },

  // Set leader status (single-writer mode)
  setLeader: (isLeader: boolean) => {
    botStore.setState((prev) => ({
      ...prev,
      isLeader,
    }))
  },
}

// React hook for bot store
export function useBotStore() {
  const [state, setState] = botStore.useStore()

  return {
    state,
    actions: botActions,
  }
}

// React hook to cleanup timers on unmount
export function useBotTimerCleanup() {
  useEffect(() => {
    return () => {
      // Clear all timers when component unmounts
      botActions.clearAllTimers()
    }
  }, [])
}
