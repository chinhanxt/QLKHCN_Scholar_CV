import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationApi } from '@/api/endpoints/notifications'

export function useNotifications() {
  const queryClient = useQueryClient()

  const { data: unreadData, refetch: refetchUnread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationApi.getUnreadCount().then((r) => r.data),
    refetchInterval: 30000,
  })

  const { data: listData, isLoading, refetch: refetchList } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationApi.getNotifications().then((r) => r.data),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  return {
    unreadCount: unreadData?.unread_count || 0,
    notifications: listData?.results || [],
    isLoading,
    refetchUnread,
    refetchList,
    markRead: markReadMutation.mutate,
    markAllRead: markAllReadMutation.mutate,
  }
}
