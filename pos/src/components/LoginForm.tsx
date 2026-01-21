import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Button } from './ui/button'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import type { User } from '@/db/schema'

interface LoginFormData {
  username: string
  password: string
}

// Demo credentials
const demoCredentials = [
  { username: 'normal_user', password: 'password123', role: 'NORMAL' },
  { username: 'vip_user', password: 'password123', role: 'VIP' },
  { username: 'manager', password: 'password123', role: 'MANAGER' },
]

export function LoginForm() {
  const navigate = useNavigate()
  const { actions: authActions } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<LoginFormData>({
    username: 'normal_user',
    password: 'password123',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      // Store user in auth store
      authActions.login(data.user as User)

      // Navigate to dashboard
      navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const fillCredentials = (username: string, password: string) => {
    setFormData({ username, password })
    setError(null)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Logo/Brand */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black tracking-tight">
            <span className="text-foreground">FEED</span>
            <span className="text-primary">ME</span>
          </h1>
          <p className="text-muted-foreground">Order Controller</p>
        </div>

        {/* Login Card */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  placeholder="Enter username"
                  className="font-mono"
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Enter password"
                  className="font-mono"
                  required
                />
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/50 text-destructive text-sm">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            {/* Demo Credentials */}
            <div className="mt-6 pt-6 border-t border-border/50">
              <p className="text-sm font-semibold text-muted-foreground mb-3">
                Quick Fill (Demo Accounts):
              </p>
              <div className="space-y-2">
                {demoCredentials.map((cred) => (
                  <button
                    key={cred.username}
                    type="button"
                    onClick={() => fillCredentials(cred.username, cred.password)}
                    className="w-full flex items-center justify-between p-3 rounded-md border border-border/50 bg-card/50 hover:bg-card hover:border-primary/50 transition-all text-left group"
                  >
                    <div>
                      <div className="font-mono font-semibold text-foreground group-hover:text-primary transition-colors">
                        {cred.username}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Role: {cred.role}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      password123
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Industrial Kitchen Command Center</p>
        </div>
      </div>
    </div>
  )
}
