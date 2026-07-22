import apiClient from '../client'
import type {
  PaginatedResponse,
  User,
  UserListItem,
  CreateUserPayload,
  UpdateUserPayload,
  ResetUserPasswordPayload,
  UUID,
} from '@/types'

export interface UsersParams {
  search?: string
  page?: number
  page_size?: number
}

export const usersApi = {
  list: (params?: UsersParams) =>
    apiClient.get<PaginatedResponse<UserListItem>>('/users/', { params }),
  retrieve: (id: UUID) => apiClient.get<User>(`/users/${id}/`),
  create: (payload: CreateUserPayload) => apiClient.post<User>('/users/', payload),
  update: (id: UUID, payload: UpdateUserPayload) =>
    apiClient.patch<User>(`/users/${id}/`, payload),
  delete: (id: UUID) => apiClient.delete(`/users/${id}/`),
  resetPassword: (id: UUID, payload: ResetUserPasswordPayload) =>
    apiClient.post<{ detail: string }>(`/users/${id}/reset-password/`, payload),
}

