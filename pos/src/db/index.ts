import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import Database from 'better-sqlite3'
import { drizzle as drizzleLocal } from 'drizzle-orm/better-sqlite3'

import * as schema from './schema.ts'

// Database connection singleton
let db: ReturnType<typeof drizzle> | ReturnType<typeof drizzleLocal> | null = null

export function getDb() {
  if (db) return db

  // Use Turso in production (when DATABASE_URL is set)
  // Use local SQLite in development
  if (process.env.DATABASE_URL) {
    const client = createClient({
      url: process.env.DATABASE_URL,
      authToken: process.env.DB_PASS,
    })
    db = drizzle(client, { schema })
  } else {
    const localDb = new Database('./local.db')
    db = drizzleLocal(localDb, { schema })
  }

  return db
}

// Export default db instance for convenience
export const db = getDb()
