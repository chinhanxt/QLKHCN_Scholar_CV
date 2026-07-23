import apiClient from '../client'

export interface NotificationItem {
  id: string
  title: string
  message: string
  notification_type: 'PROFILE_APPROVED' | 'NEW_PUBLICATIONS_DETECTED' | 'METRICS_UPDATED' | 'SYSTEM_NOTICE'
  category: 'PERSONAL' | 'SCHOLAR' | 'SYSTEM'
  metadata: Record<string, any>
  link?: string
  is_read: boolean
  created_at: string
  created_at_human: string
}

export interface UnreadCountResponse {
  unread_count: number
}

export interface EmailSettings {
  EMAIL_HOST: string
  EMAIL_PORT: number
  EMAIL_USE_TLS: boolean
  EMAIL_HOST_USER: string
  EMAIL_HOST_PASSWORD?: string
  DEFAULT_FROM_EMAIL: string
}

export const notificationApi = {
  getNotifications: (params?: { category?: string; is_read?: boolean }) =>
    apiClient.get<{ results: NotificationItem[] }>('/core/notifications/', { params }),

  getUnreadCount: () =>
    apiClient.get<UnreadCountResponse>('/core/notifications/unread-count/'),

  markRead: (id: string) =>
    apiClient.post<{ status: string }>(`/core/notifications/${id}/mark-read/`),

  markAllRead: () =>
    apiClient.post<{ status: string; message: string }>('/core/notifications/mark-all-read/'),

  getEmailSettings: () =>
    apiClient.get<EmailSettings>('/scholar/crawlers/email-settings/'),

  saveEmailSettings: (payload: Partial<EmailSettings>) =>
    apiClient.post<{ message: string }>('/scholar/crawlers/email-settings/', payload),

  sendTestEmail: (email: string) =>
    apiClient.post<{ message: string }>('/scholar/crawlers/test-email/', { email }),
}
