import { getDb } from './index.ts'
import { users } from './schema.ts'
import { uuidv7 } from '../lib/uuid7.ts'
import { scrypt } from 'crypto'

// Simple password hash function for demo (use bcrypt in production)
function hashPassword(password: string): string {
  // For demo purposes, we'll use a simple hash
  // In production, use bcrypt or argon2
  return Buffer.from(password).toString('base64')
}

async function seed() {
  const db = getDb()

  // Sample users with UUID7 IDs
  const sampleUsers = [
    {
      id: '01912345678900000000000000000001',
      username: 'normal_user',
      passwordHash: hashPassword('password123'),
      role: 'NORMAL' as const,
    },
    {
      id: '01912345678900000000000000000002',
      username: 'vip_user',
      passwordHash: hashPassword('password123'),
      role: 'VIP' as const,
    },
    {
      id: '01912345678900000000000000000003',
      username: 'manager',
      passwordHash: hashPassword('password123'),
      role: 'MANAGER' as const,
    },
    {
      id: '01912345678900000000000000000004',
      username: 'bot',
      passwordHash: hashPassword('password123'),
      role: 'BOT' as const,
    },
  ]

  // Insert users (ignore duplicates)
  for (const user of sampleUsers) {
    await db
      .insert(users)
      .values(user)
      .onConflictDoNothing({
        target: users.id,
      })
  }

  console.log('✅ Seed completed! Sample users created:')
  console.log('  - normal_user (password: password123)')
  console.log('  - vip_user (password: password123)')
  console.log('  - manager (password: password123)')
  console.log('  - bot (password: password123)')
}

// Run seed
seed().catch(console.error)
