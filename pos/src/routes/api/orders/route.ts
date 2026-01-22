import { createFileRoute } from '@tanstack/react-router'
import { Client } from '@upstash/qstash'
import { getDb } from '@/db'
import { orders, bots } from '@/db/schema'
import { and, eq, isNull, desc, sql } from 'drizzle-orm'
import { uuidv7 } from '@/lib/uuid7'

const BOT_PROCESSING_DELAY_SECONDS = 10

const getUpdatedAtMs = (value: unknown) => {
  if (value instanceof Date) return value.getTime()
  return new Date(value as string | number).getTime()
}

const resumeProcessingOrders = async () => {
  const db = getDb()
  const processingOrders = await db
    .select()
    .from(orders)
    .where(and(eq(orders.status, 'PROCESSING'), isNull(orders.deletedAt)))

  if (processingOrders.length === 0) return

  const nowMs = Date.now()
  const baseUrl = process.env.APP_BASE_URL
  const token = process.env.QSTASH_TOKEN
  const client = baseUrl && token ? new Client({ token }) : null
  const callbackUrl = baseUrl
    ? new URL('/api/orders/complete', baseUrl).toString()
    : null

  for (const order of processingOrders) {
    if (!order.botId) continue

    const updatedAtMs = getUpdatedAtMs(order.updatedAt)
    const elapsedMs = nowMs - updatedAtMs

    if (elapsedMs >= BOT_PROCESSING_DELAY_SECONDS * 1000) {
      const now = new Date(nowMs)
      await db
        .update(orders)
        .set({
          status: 'COMPLETE',
          completedAt: now,
          updatedAt: now,
        })
        .where(and(eq(orders.id, order.id), isNull(orders.deletedAt)))

      await db
        .update(bots)
        .set({
          status: 'IDLE',
          currentOrderId: null,
          updatedAt: now,
        })
        .where(and(eq(bots.id, order.botId), isNull(bots.deletedAt)))
      continue
    }

    if (client && callbackUrl) {
      const remainingSeconds = Math.max(
        1,
        Math.ceil((BOT_PROCESSING_DELAY_SECONDS * 1000 - elapsedMs) / 1000),
      )

      await client.publishJSON({
        url: callbackUrl,
        body: { orderId: order.id, botId: order.botId },
        delay: remainingSeconds,
        deduplicationId: `${order.id}-${updatedAtMs}`,
      })
    }
  }
}

interface CreateOrderRequest {
  type: 'NORMAL' | 'VIP'
  userId: string
}

// GET /api/orders - List all orders (excluding soft-deleted)
// POST /api/orders - Create a new order
export const Route = createFileRoute('/api/orders')({
  server: {
    handlers: {
      GET: async () => {
        try {
          await resumeProcessingOrders()

          const db = getDb()
          const allOrders = await db
            .select()
            .from(orders)
            .where(isNull(orders.deletedAt))
            .orderBy(
              sql<number>`
                case
                  when ${orders.status} = 'PENDING' and ${orders.type} = 'VIP' then 0
                  when ${orders.status} = 'PENDING' and ${orders.type} = 'NORMAL' then 1
                  when ${orders.status} = 'PROCESSING' then 2
                  else 3
                end
              `,
              sql<number>`case when ${orders.status} = 'PENDING' then ${orders.orderNumber} end`,
              desc(orders.createdAt),
            )

          return Response.json({ orders: allOrders })
        } catch (error) {
          console.error('Get orders error:', error)
          return Response.json(
            { error: 'Internal server error' },
            { status: 500 },
          )
        }
      },

      POST: async ({ request }) => {
        try {
          const body: CreateOrderRequest = await request.json()

          // Get next order number (max + 1, or 1 if no orders)
          const db = getDb()
          const maxOrderResult = await db
            .select({ orderNumber: orders.orderNumber })
            .from(orders)
            .where(isNull(orders.deletedAt))
            .orderBy(desc(orders.orderNumber))
            .limit(1)

          const nextOrderNumber = maxOrderResult[0]?.orderNumber
            ? maxOrderResult[0].orderNumber + 1
            : 1

          // Create order with UUID7
          const newOrder = {
            id: uuidv7(),
            orderNumber: nextOrderNumber,
            type: body.type,
            status: 'PENDING' as const,
            userId: body.userId,
            botId: null,
            completedAt: null,
          }

          await db.insert(orders).values(newOrder)

          return Response.json({
            order: newOrder,
            message: 'Order created successfully',
          })
        } catch (error) {
          console.error('Create order error:', error)
          return Response.json(
            { error: 'Internal server error' },
            { status: 500 },
          )
        }
      },
    },
  },
})
