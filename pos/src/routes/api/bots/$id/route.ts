import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/start'
import { getDb } from '@/db'
import { bots, orders } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'

interface UpdateBotRequest {
  status?: 'IDLE' | 'PROCESSING'
  currentOrderId?: string | null
}

// PATCH /api/bots/:id - Update a bot
// DELETE /api/bots/:id - Soft delete a bot (returns order to PENDING)
export const Route = createFileRoute('/api/bots/$id')({
  PATCH: async ({ request, params }) => {
    try {
      const body: UpdateBotRequest = await request.json()

      const db = getDb()
      const botResult = await db
        .select()
        .from(bots)
        .where(and(eq(bots.id, params.id), isNull(bots.deletedAt)))
        .limit(1)

      const bot = botResult[0]
      if (!bot) {
        return json({ error: 'Bot not found' }, { status: 404 })
      }

      // Build update object
      const updates: Partial<typeof bots.$inferInsert> = {
        updatedAt: new Date(),
      }

      if (body.status !== undefined) {
        updates.status = body.status
      }

      if (body.currentOrderId !== undefined) {
        updates.currentOrderId = body.currentOrderId
      }

      await db
        .update(bots)
        .set(updates)
        .where(and(eq(bots.id, params.id), isNull(bots.deletedAt)))

      // If bot was processing an order and is now being updated to idle/removed,
      // return the order to PENDING
      if (bot.currentOrderId && (body.status === 'IDLE' || body.currentOrderId === null)) {
        await db
          .update(orders)
          .set({
            status: 'PENDING',
            botId: null,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, bot.currentOrderId))
      }

      // Return updated bot
      const updatedResult = await db
        .select()
        .from(bots)
        .where(eq(bots.id, params.id))
        .limit(1)

      return json({
        bot: updatedResult[0],
        message: 'Bot updated successfully',
      })
    } catch (error) {
      console.error('Update bot error:', error)
      return json({ error: 'Internal server error' }, { status: 500 })
    }
  },

  DELETE: async ({ params }) => {
    try {
      const db = getDb()

      // Get bot before soft delete to return order to PENDING
      const botResult = await db
        .select()
        .from(bots)
        .where(and(eq(bots.id, params.id), isNull(bots.deletedAt)))
        .limit(1)

      const bot = botResult[0]

      // If bot was processing an order, return it to PENDING
      if (bot && bot.currentOrderId) {
        await db
          .update(orders)
          .set({
            status: 'PENDING',
            botId: null,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, bot.currentOrderId))
      }

      // Soft delete by setting deletedAt
      await db
        .update(bots)
        .set({ deletedAt: new Date() })
        .where(and(eq(bots.id, params.id), isNull(bots.deletedAt)))

      return json({ message: 'Bot deleted successfully' })
    } catch (error) {
      console.error('Delete bot error:', error)
      return json({ error: 'Internal server error' }, { status: 500 })
    }
  },
})
