export const BOT_PROCESSING_TIME_MS = { NORMAL: 10_000, VIP: 5_000 } as const
export const BOT_PROCESSING_DELAY_SECONDS = { NORMAL: 10, VIP: 5 } as const

export const DEFAULT_BOT_TIMER_STATE = {
  remainingMs: BOT_PROCESSING_TIME_MS.NORMAL,
  botType: 'NORMAL' as const,
  status: 'IDLE' as const,
  currentOrderId: null,
  lastTick: 0,
}
