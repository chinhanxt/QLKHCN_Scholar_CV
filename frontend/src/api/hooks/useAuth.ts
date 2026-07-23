import { useMutation, useQuery } from '@tanstack/react-query'
import { authApi } from '@/api/endpoints/auth'
import { useAuthStore } from '@/stores/auth.store'
import type { LoginPayload, ChangePasswordPayload } from '@/types'

export function useLogin() {
  const setTokens = useAuthStore((s) => s.setTokens)
  const setUser = useAuthStore((s) => s.setUser)

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const { data: tokens } = await authApi.login(payload)
      setTokens(tokens.access, tokens.refresh)
      const { data: user } = await authApi.me()
      setUser(user)
      return user
    },
  })
}

export function useMe(enabled = true) {
  const setUser = useAuthStore((s) => s.setUser)
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const { data } = await authApi.me()
      setUser(data)
      return data
    },
    enabled,
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) =>
      authApi.changePassword(payload).then((r) => r.data),
  })
}

export function useUpdateProfile() {
  const setUser = useAuthStore((s) => s.setUser)
  return useMutation({
    mutationFn: async (fullName: string) => {
      const { data } = await authApi.updateProfile(fullName)
      setUser(data)
      return data
    },
  })
}
