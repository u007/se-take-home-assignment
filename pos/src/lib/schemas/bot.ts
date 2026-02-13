import { z } from 'zod'
import { orderTypeSchema } from './order'

// Bot type enum (reuses order type: NORMAL | VIP)
export const botTypeSchema = orderTypeSchema

// Bot status enum (database states)
export const botStatusSchema = z.enum(['IDLE', 'PROCESSING'])
export type BotStatus = z.infer<typeof botStatusSchema>
export type BotType = z.infer<typeof botTypeSchema>

// Display status includes DELETED (UI-only, soft-deleted bots)
export const botDisplayStatusSchema = z.enum(['IDLE', 'PROCESSING', 'DELETED'])
export type BotDisplayStatus = z.infer<typeof botDisplayStatusSchema>

// Create bot schema
export const createBotSchema = z.object({
  status: botStatusSchema.default('IDLE'),
  botType: botTypeSchema.default('NORMAL'),
})

export type CreateBotInput = z.infer<typeof createBotSchema>

// Update bot schema
export const updateBotSchema = z.object({
  status: botStatusSchema.optional(),
  currentOrderId: z.string().uuid().optional().nullable(),
})

export type UpdateBotInput = z.infer<typeof updateBotSchema>
