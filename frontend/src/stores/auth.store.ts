import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  hasHydrated: boolean
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  isAuthenticated: boolean

  setTokens: (access: string, refresh: string) => void
  setAccessToken: (access: string) => void
  setUser: (user: User) => void
  markHydrated: () => void
  restoreSession: () => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh, isAuthenticated: true }),
      setAccessToken: (access) => set({ accessToken: access }),
      setUser: (user) => set({ user }),
      markHydrated: () => set({ hasHydrated: true }),
      restoreSession: () =>
        set((state) => ({
          hasHydrated: true,
          isAuthenticated: Boolean(state.accessToken || state.refreshToken),
        })),
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
          hasHydrated: true,
        }),
    }),
    {
      name: 'eco-sys-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.restoreSession()
      },
    },
  ),
)
