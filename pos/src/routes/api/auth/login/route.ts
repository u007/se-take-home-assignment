import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/start'
import type { User } from '@/db/schema'
import { getDb } from '@/db'
import { users } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'

interface LoginRequest {
  username: string
  password: string
}

export const Route = createFileRoute('/api/auth/login/')({
  POST: async ({ request }) => {
    try {
      const body: LoginRequest = await request.json()

      // Find user by username (excluding soft-deleted)
      const db = getDb()
      const userResult = await db
        .select()
        .from(users)
        .where(and(eq(users.username, body.username), isNull(users.deletedAt)))
        .limit(1)

      const user = userResult[0]

      if (!user) {
        return json(
          { error: 'Invalid username or password' },
          { status: 401 },
        )
      }

      // Simple password check (for demo - use bcrypt in production)
      const passwordHash = Buffer.from(body.password).toString('base64')
      if (user.passwordHash !== passwordHash) {
        return json(
          { error: 'Invalid username or password' },
          { status: 401 },
        )
      }

      // Return user data (excluding password)
      const { passwordHash: _, ...userWithoutPassword } = user
      return json({
        user: userWithoutPassword,
        message: 'Login successful',
      })
    } catch (error) {
      console.error('Login error:', error)
      return json({ error: 'Internal server error' }, { status: 500 })
    }
  },
})
