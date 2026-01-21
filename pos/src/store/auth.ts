import { Store } from '@tanstack/store'
import { useEffect, useState } from 'react'

// User role types
export type UserRole = 'NORMAL' | 'VIP' | 'MANAGER' | 'BOT'

// User type
export interface User {
  id: string
  username: string
  role: UserRole
}

// Auth store state
interface AuthStoreState {
  user: User | null
  isAuthenticated: boolean
}

// Initialize store from sessionStorage if available
function loadAuthStoreState(): AuthStoreState {
  if (typeof window === 'undefined') {
    return { user: null, isAuthenticated: false }
  }

  try {
    const saved = sessionStorage.getItem('auth-store-state')
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (e) {
    console.error('Failed to load auth store state:', e)
  }

  return { user: null, isAuthenticated: false }
}

// Create auth store
export const authStore = new Store<AuthStoreState>({
  ...loadAuthStoreState(),
})

// Subscribe to state changes and persist to sessionStorage
if (typeof window !== 'undefined') {
  authStore.subscribe((state) => {
    try {
      sessionStorage.setItem('auth-store-state', JSON.stringify(state))
    } catch (e) {
      console.error('Failed to save auth store state:', e)
    }
  })
}

// Auth store actions
export const authActions = {
  // Login user
  login: (user: User) => {
    authStore.setState({
      user,
      isAuthenticated: true,
    })
  },

  // Logout user
  logout: () => {
    authStore.setState({
      user: null,
      isAuthenticated: false,
    })
  },

  // Update user
  updateUser: (user: User) => {
    authStore.setState((prev) => ({
      ...prev,
      user,
    }))
  },
}

// React hook for auth store
export function useAuthStore() {
  const [state, setState] = useState<AuthStoreState>(authStore.state)

  useEffect(() => {
    const unsubscribe = authStore.subscribe((newState) => setState(newState))
    return unsubscribe
  }, [])

  return {
    state,
    actions: authActions,
  }
}
