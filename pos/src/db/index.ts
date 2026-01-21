import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import Database from 'better-sqlite3'
import { drizzle as drizzleLocal } from 'drizzle-orm/better-sqlite3'

import * as schema from './schema.ts'

// Database connection singleton
let _dbInstance: ReturnType<typeof drizzle> | ReturnType<typeof drizzleLocal> | null = null

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
    const localDb = new Database('./local.db')
    _dbInstance = drizzleLocal(localDb, { schema })
  }

  return _dbInstance
}

// Export default db instance for convenience
export const db = getDb()
