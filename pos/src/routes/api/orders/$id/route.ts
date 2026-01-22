import { createFileRoute } from '@tanstack/react-router'
import { Client } from '@upstash/qstash'
import { getDb } from '@/db'
import { orders } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'

const BOT_PROCESSING_DELAY_SECONDS = 10

interface UpdateOrderRequest {
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETE'
  botId?: string | null
}

// PATCH /api/orders/:id - Update an order
// DELETE /api/orders/:id - Soft delete an order
export const Route = createFileRoute('/api/orders/$id')({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        try {
          const body: UpdateOrderRequest = await request.json()

          const db = getDb()
          const orderResult = await db
            .select()
            .from(orders)
            .where(and(eq(orders.id, params.id), isNull(orders.deletedAt)))
            .limit(1)

          const order = orderResult[0]
          if (!order) {
            return Response.json({ error: 'Order not found' }, { status: 404 })
          }

          const now = new Date()
          const nowMs = now.getTime()

          const shouldScheduleCompletion =
            body.status === 'PROCESSING' &&
            body.botId !== undefined &&
            body.botId !== null &&
            order.status !== 'PROCESSING'

          if (shouldScheduleCompletion) {
            if (!process.env.QSTASH_TOKEN) {
              return Response.json(
                { error: 'QSTASH_TOKEN is not configured' },
                { status: 500 },
              )
            }

            const baseUrl = process.env.APP_BASE_URL
            if (!baseUrl) {
              return Response.json(
                { error: 'APP_BASE_URL is not configured' },
                { status: 500 },
              )
            }

            const callbackUrl = new URL('/api/orders/complete', baseUrl).toString()
            const client = new Client({
              token: process.env.QSTASH_TOKEN,
            })

            await client.publishJSON({
              url: callbackUrl,
              body: { orderId: params.id, botId: body.botId },
              delay: BOT_PROCESSING_DELAY_SECONDS,
              deduplicationId: `${params.id}:${nowMs}`,
            })
          }

          // Build update object
          const updates: Record<string, any> = {
            updatedAt: now,
          }

          if (body.status !== undefined) {
            updates.status = body.status
            if (body.status === 'COMPLETE') {
              updates.completedAt = now
            }
          }

          if (body.botId !== undefined) {
            updates.botId = body.botId
          }

          await db
            .update(orders)
            .set(updates)
            .where(and(eq(orders.id, params.id), isNull(orders.deletedAt)))

          // Return updated order
          const updatedResult = await db
            .select()
            .from(orders)
            .where(eq(orders.id, params.id))
            .limit(1)

          return Response.json({
            order: updatedResult[0],
            message: 'Order updated successfully',
          })
        } catch (error) {
          console.error('Update order error:', error)
          return Response.json(
            { error: 'Internal server error' },
            { status: 500 },
          )
        }
      },

      DELETE: async ({ params }) => {
        try {
          const db = getDb()

          // Soft delete by setting deletedAt
          await db
            .update(orders)
            .set({ deletedAt: new Date() })
            .where(and(eq(orders.id, params.id), isNull(orders.deletedAt)))

          return Response.json({ message: 'Order deleted successfully' })
        } catch (error) {
          console.error('Delete order error:', error)
          return Response.json(
            { error: 'Internal server error' },
            { status: 500 },
          )
        }
      },
    },
  },
})
