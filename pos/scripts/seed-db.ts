import Database from 'better-sqlite3'
import { drizzle as drizzleLocal } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../src/db/schema'
import { uuidv7 } from '../src/lib/uuid7'

// Create/ open local database
const dbPath = './local.db'
const localDb = new Database(dbPath)
const db = drizzleLocal(localDb, { schema })

console.log('Seeding local database...')

// Run migrations
console.log('Running migrations...')
await migrate(db, { migrationsFolder: './drizzle' })
console.log('Migrations complete!')

// Seed demo users
console.log('Seeding demo users...')

const passwordHash = Buffer.from('password123').toString('base64')
const now = Math.floor(Date.now() / 1000) // Unix timestamp in seconds

const demoUsers = [
  {
    id: uuidv7(),
    username: 'normal_user',
    passwordHash,
    role: 'NORMAL',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  },
  {
    id: uuidv7(),
    username: 'vip_user',
    passwordHash,
    role: 'VIP',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  },
  {
    id: uuidv7(),
    username: 'manager',
    passwordHash,
    role: 'MANAGER',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  },
]

// Check if users already exist
const existingUsers = localDb.prepare('SELECT * FROM users').all()
if (existingUsers.length === 0) {
  for (const user of demoUsers) {
    localDb
      .prepare(
        'INSERT INTO users (id, username, password_hash, role, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        user.id,
        user.username,
        user.passwordHash,
        user.role,
        user.createdAt,
        user.updatedAt,
        user.deletedAt
      )
  }
  console.log('Demo users created!')
} else {
  console.log('Users already exist, skipping...')
}

// Seed initial bots (2 bots)
console.log('Seeding initial bots...')
const existingBots = localDb.prepare('SELECT * FROM bots').all()
if (existingBots.length === 0) {
  for (let i = 1; i <= 2; i++) {
    const botId = uuidv7()
    localDb
      .prepare(
        'INSERT INTO bots (id, status, current_order_id, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(botId, 'IDLE', null, now, now, null)
  }
  console.log('Initial bots created!')
} else {
  console.log('Bots already exist, skipping...')
}

// Verify seeded data
const userCount = localDb.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
const botCount = localDb.prepare('SELECT COUNT(*) as count FROM bots').get() as { count: number }

console.log(`\nDatabase seeded successfully!`)
console.log(`- ${userCount.count} users`)
console.log(`- ${botCount.count} bots`)
console.log(`\nDatabase location: ${dbPath}`)

localDb.close()
