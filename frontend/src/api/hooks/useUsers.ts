import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usersApi, type UsersParams } from '@/api/endpoints/users'
import type { UpdateUserPayload, UUID } from '@/types'

const USERS_KEY = ['users'] as const

export const usersKeys = {
  all: () => USERS_KEY,
  list: (params?: UsersParams) => [...USERS_KEY, 'list', params] as const,
  detail: (id: UUID) => [...USERS_KEY, 'detail', id] as const,
}

export function useUsers(params?: UsersParams) {
  return useQuery({
    queryKey: usersKeys.list(params),
    queryFn: () => usersApi.list(params).then((r) => r.data),
  })
}

export function useUser(id: UUID, enabled = true) {
  return useQuery({
    queryKey: usersKeys.detail(id),
    queryFn: () => usersApi.retrieve(id).then((r) => r.data),
    enabled,
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: UUID; payload: UpdateUserPayload }) =>
      usersApi.update(id, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: usersKeys.all() })
    },
  })
}
