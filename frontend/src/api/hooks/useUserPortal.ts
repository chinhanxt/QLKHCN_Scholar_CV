import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

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
  submitted_at: string | null
  approved_at: string | null
  total_citations: number
  h_index: number
  i10_index: number
  publications: ScholarPublication[]
}

export function useMyProfile() {
  return useQuery<ScholarProfile>({
    queryKey: ['user-portal-profile'],
    queryFn: async () => {
      const response = await api.get('/scholar/me/profile/')
      return response.data
    },
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

export function useAdminProfiles() {
  return useQuery<ScholarProfile[]>({
    queryKey: ['admin-scholar-profiles'],
    queryFn: async () => {
      const response = await api.get('/scholar/admin/profiles/')
      return Array.isArray(response.data) ? response.data : response.data.results || []
    },
  })
}

export function useApproveProfile() {
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
