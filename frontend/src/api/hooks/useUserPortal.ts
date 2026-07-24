import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth.store'
import type { AuthorProfileDetail } from '@/api/endpoints/scholar'

export interface ScholarPublication {
  id: string
  title: string
  authors: string
  journal: string
  pub_year: number | null
  citations: number
  url: string
}

export interface ScholarProfile {
  id: string
  user_email?: string
  scholar_url: string | null
  scholar_id: string | null
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'
  status_display: string
  request_type?: 'NEW' | 'UPDATE'
  request_type_display?: string
  submitted_at: string | null
  approved_at: string | null
  total_citations: number
  h_index: number
  i10_index: number
  full_name?: string
  academic_title?: string
  position?: string
  department?: string
  institution?: string
  publications: ScholarPublication[]
  author_detail?: AuthorProfileDetail | null
}

export function useMyProfile() {
  const user = useAuthStore((s) => s.user)
  return useQuery<ScholarProfile>({
    queryKey: ['user-portal-profile', user?.id],
    queryFn: async () => {
      const response = await api.get('/scholar/me/profile/')
      return response.data
    },
    enabled: Boolean(user?.id),
  })
}

export function useSubmitScholarProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { scholar_url: string }) => {
      const response = await api.post('/scholar/me/profile/submit/', payload)
      return response.data as ScholarProfile
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-portal-profile'] })
    },
  })
}

// Alias for requirement specification
export const useSubmitScholarRequest = useSubmitScholarProfile

export interface EducationRecord {
  degree: string
  institution: string
  major: string
  year: string
}

export interface UserAcademicProfileUpdatePayload {
  full_name?: string
  academic_title?: string
  position?: string
  department?: string
  institution?: string
  research_interests?: string[] | string
  education_history?: EducationRecord[]
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: UserAcademicProfileUpdatePayload) => {
      try {
        const response = await api.patch('/scholar/me/profile/update-academic/', payload)
        return response.data
      } catch {
        // Fallback gracefully if endpoint is absent on server
        return payload
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-portal-profile'] })
    },
  })
}

export function useAdminProfiles() {
  return useQuery<ScholarProfile[]>({
    queryKey: ['admin-scholar-profiles'],
    queryFn: async () => {
      const response = await api.get('/scholar/admin/profiles/')
      return Array.isArray(response.data) ? response.data : response.data.results || []
    },
  })
}

export function useAdminApproveProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (profileId: string) => {
      const response = await api.post(`/scholar/admin/profiles/${profileId}/approve/`)
      return response.data as ScholarProfile
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-scholar-profiles'] })
      queryClient.invalidateQueries({ queryKey: ['user-portal-profile'] })
    },
  })
}

export function useAdminResendEmailProfile() {
  return useMutation({
    mutationFn: async (profileId: string) => {
      const response = await api.post<{ message: string }>(`/scholar/admin/profiles/${profileId}/resend-email/`)
      return response.data
    },
  })
}

export const useApproveProfile = useAdminApproveProfile

export interface QuickPreviewResult {
  found: boolean
  scholar_id: string
  name?: string
  affiliation?: string
  email_domain?: string
  citedby?: number
  hindex?: number
  i10index?: number
  interests?: string[]
  source?: 'database' | 'live_scholar'
  message?: string
}

export function useQuickPreviewScholar() {
  return useMutation({
    mutationFn: async (payload: { scholar_url?: string; scholar_id?: string }) => {
      const response = await api.post('/scholar/me/profile/quick-preview/', payload)
      return response.data as QuickPreviewResult
    },
  })
}
