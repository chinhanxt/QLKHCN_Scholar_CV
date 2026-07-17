import apiClient from '../client'
import type { PaginatedResponse, User, UserListItem, UpdateUserPayload, UUID } from '@/types'

export interface UsersParams {
  search?: string
  page?: number
  page_size?: number
}

export const usersApi = {
  list: (params?: UsersParams) =>
    apiClient.get<PaginatedResponse<UserListItem>>('/users/', { params }),
  retrieve: (id: UUID) => apiClient.get<User>(`/users/${id}/`),
  update: (id: UUID, payload: UpdateUserPayload) =>
    apiClient.patch<User>(`/users/${id}/`, payload),
}
