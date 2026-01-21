import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth'
import { LoginForm } from '@/components/LoginForm'

export const Route = createFileRoute('/login')({
  component: LoginComponent,
})

function LoginComponent() {
  const router = useRouter()
  const { state: authState } = useAuthStore()

  useEffect(() => {
    // Redirect to dashboard if already authenticated
    if (authState.isAuthenticated) {
      router.navigate({ to: '/' })
    }
  }, [authState.isAuthenticated, router])

  // Show nothing while redirecting
  if (authState.isAuthenticated) {
    return null
  }

  return <LoginForm />
}
