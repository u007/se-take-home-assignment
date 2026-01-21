import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// Users table with soft delete support
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // UUID7
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['NORMAL', 'VIP', 'MANAGER', 'BOT'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
})

// Orders table with soft delete and foreign keys
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(), // UUID7
  orderNumber: integer('order_number').notNull(),
  type: text('type', { enum: ['NORMAL', 'VIP'] }).notNull(),
  status: text('status', { enum: ['PENDING', 'PROCESSING', 'COMPLETE'] }).notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  botId: text('bot_id').references(() => bots.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
})

// Bots table with soft delete support
export const bots = sqliteTable('bots', {
  id: text('id').primaryKey(), // UUID7
  status: text('status', { enum: ['IDLE', 'PROCESSING'] }).notNull(),
  currentOrderId: text('current_order_id').references(() => orders.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
})

// Types for TypeScript
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type Bot = typeof bots.$inferSelect
export type NewBot = typeof bots.$inferInsert
