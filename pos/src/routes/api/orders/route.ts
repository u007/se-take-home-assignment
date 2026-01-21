import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/start'
import { getDb } from '@/db'
import { orders } from '@/db/schema'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { uuidv7 } from '@/lib/uuid7'

interface CreateOrderRequest {
  type: 'NORMAL' | 'VIP'
  userId: string
}

// GET /api/orders - List all orders (excluding soft-deleted)
// POST /api/orders - Create a new order
export const Route = createFileRoute('/api/orders/')({
  GET: async () => {
    try {
      const db = getDb()
      const allOrders = await db
        .select()
        .from(orders)
        .where(isNull(orders.deletedAt))
        .orderBy(desc(orders.createdAt))

      return json({ orders: allOrders })
    } catch (error) {
      console.error('Get orders error:', error)
      return json({ error: 'Internal server error' }, { status: 500 })
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

      return json({
        order: newOrder,
        message: 'Order created successfully',
      })
    } catch (error) {
      console.error('Create order error:', error)
      return json({ error: 'Internal server error' }, { status: 500 })
    }
  },
})
