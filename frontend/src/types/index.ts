export type UUID = string

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface TokenPair {
  access: string
  refresh: string
}

export interface LoginPayload {
  email: string
  password: string
}

/** Matches apps/users/api/serializers.py::UserSerializer */
export interface User {
  id: UUID
  email: string
  username: string
  first_name: string
  last_name: string
  phone?: string | null
  avatar?: string | null
  is_active: boolean
  date_joined: string
}

/** Matches UserListSerializer (list endpoint) */
export interface UserListItem {
  id: UUID
  email: string
  username: string
  first_name: string
  last_name: string
  is_active: boolean
}

export interface UpdateUserPayload {
  username?: string
  first_name?: string
  last_name?: string
  phone?: string | null
}

export interface ChangePasswordPayload {
  old_password: string
  new_password: string
}
