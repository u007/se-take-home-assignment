import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'

import * as schema from './schema.ts'

// Database connection singleton
let _dbInstance: ReturnType<typeof drizzle> | null = null

export function getDb() {
  if (_dbInstance) return _dbInstance

  // Use Turso in production (when DATABASE_URL is set)
  // Use local SQLite in development
  if (process.env.DATABASE_URL) {
    const client = createClient({
      url: process.env.DATABASE_URL,
      authToken: process.env.DB_PASS,
    })
    _dbInstance = drizzle(client, { schema })
  } else {
    // Dynamic import for better-sqlite3 (not available on Vercel)
    try {
      const Database = require('better-sqlite3')
      const { drizzle: drizzleLocal } = require('drizzle-orm/better-sqlite3')
      const localDb = new Database('./local.db')
      _dbInstance = drizzleLocal(localDb, { schema })
    } catch (e) {
      console.warn('better-sqlite3 not available, DATABASE_URL required for production')
      throw new Error('Database not available. Please set DATABASE_URL environment variable or install better-sqlite3 for local development.')
    }
  }

  return _dbInstance
}

// Export default db instance for convenience
export const db = getDb()
