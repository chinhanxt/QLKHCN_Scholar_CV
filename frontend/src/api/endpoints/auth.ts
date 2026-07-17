import apiClient from '../client'
import type { TokenPair, LoginPayload, User, ChangePasswordPayload } from '@/types'

export const authApi = {
  // SimpleJWT TokenObtainPairView; USERNAME_FIELD is email on this backend.
  login: (payload: LoginPayload) => apiClient.post<TokenPair>('/auth/login/', payload),
  refresh: (refresh: string) => apiClient.post<{ access: string }>('/auth/refresh/', { refresh }),
  me: () => apiClient.get<User>('/auth/me/'),
  changePassword: (payload: ChangePasswordPayload) =>
    apiClient.post<{ detail: string }>('/auth/change-password/', payload),
}
