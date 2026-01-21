import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'

import * as schema from './schema.ts'

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DB_PASS,
})

export const db = drizzle(client, { schema })
