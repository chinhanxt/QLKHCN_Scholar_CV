import apiClient from '../client'

export interface DatabaseStats {
  authors: number
  publications: number
  bioxbio_journals: number
  scimago_journals: number
  clarivate_journals: number
  mapped_journals: number
  match_rate: number
}

export interface TaskStatusResponse {
  task_id: string
  status: 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE'
  progress?: number
  message?: string
  result?: any
}

export interface AuthorCandidate {
  scholar_id: string
  name: string
  affiliation: string
  citedby: number
  interests: string[]
}

export interface JournalDetail {
  id: string
  clarivate_title: string
  title_normalized: string
  issn: string
  eissn: string
  publisher: string
  country: string
  latest_if: number | null
  latest_sjr: number | null
  latest_quartile: string | null
  latest_h_index: number | null
  wos_core_collection: string | null
}

export interface PublicationDetail {
  id: string
  title: string
  authors_list: string
  venue: string
  year: string
  citations: number
  display_order: number
  cites_per_year: Record<string, number>
  journal: JournalDetail | null
  sjr_q: string
  if_val: string
  wos: string
}

export interface AuthorProfileDetail {
  id: string
  scholar_id: string
  name: string
  affiliation: string
  citedby: number
  hindex: number
  i10index: number
  interests: string[]
  publications: PublicationDetail[]
  created_at: string
  updated_at: string
}

export const scholarApi = {
  // Stats
  getStats: () => apiClient.get<DatabaseStats>('/scholar/crawlers/stats/'),

  // Authors & Profiles
  getAuthors: () => apiClient.get<AuthorProfileDetail[]>('/scholar/authors/'),
  
  getAuthor: (scholarId: string) => 
    apiClient.get<AuthorProfileDetail>(`/scholar/authors/${scholarId}/`),
    
  deleteAuthor: (scholarId: string) => 
    apiClient.delete(`/scholar/authors/${scholarId}/`),

  searchAuthors: (q: string) => 
    apiClient.get<AuthorCandidate[]>(`/scholar/authors/search/`, { params: { q } }),

  scrapeAuthor: (authorId: string, limit = 100, detailed = false) => 
    apiClient.post<{ task_id: string; status: string }>('/scholar/authors/scrape/', { author_id: authorId, limit, detailed }),

  getTaskStatus: (taskId: string) => 
    apiClient.get<TaskStatusResponse>(`/scholar/authors/task-status/${taskId}/`),

  // Crawlers & Integrations
  startBioxbioCrawl: (payload: { start_url: string; max_workers: number; delay: number }) => 
    apiClient.post<{ task_id: string; status: string }>('/scholar/crawlers/bioxbio/', payload),

  startScimagoCrawl: (payload: { years: number[]; max_workers: number; delay: number }) => 
    apiClient.post<{ task_id: string; status: string }>('/scholar/crawlers/scimago/', payload),

  startClarivateCrawl: (payload: { max_pages: number | null; max_workers: number; delay: number }) => 
    apiClient.post<{ task_id: string; status: string }>('/scholar/crawlers/clarivate/', payload),

  startIntegration: () => 
    apiClient.post<{ task_id: string; status: string }>('/scholar/crawlers/integrate/'),

  startUnifiedCrawl: (payload: {
    scimago_years?: number[];
    scimago_workers?: number;
    scimago_delay?: number;
    clarivate_max_pages?: number | null;
    clarivate_workers?: number;
    clarivate_delay?: number;
    bioxbio_start_url?: string;
    bioxbio_workers?: number;
    bioxbio_delay?: number;
  }) =>
    apiClient.post<{ task_id: string; status: string }>('/scholar/crawlers/unified/', payload),

  getCrawlerTaskStatus: (taskId: string) => 
    apiClient.get<TaskStatusResponse>(`/scholar/crawlers/status/${taskId}/`),

  getSettings: () => 
    apiClient.get<any>('/scholar/crawlers/settings/'),

  saveSettings: (payload: any) => 
    apiClient.post<any>('/scholar/crawlers/settings/', payload),

  getBioxbioData: (params: { q?: string; year?: string }) => 
    apiClient.get<any[]>('/scholar/crawlers/bioxbio-data/', { params }),

  getScimagoData: (params: { q?: string; year?: string; quartile?: string }) => 
    apiClient.get<any[]>('/scholar/crawlers/scimago-data/', { params }),

  getClarivateData: (params: { q?: string; wos_index?: string }) => 
    apiClient.get<any[]>('/scholar/crawlers/clarivate-data/', { params }),

  getMappedData: (params: { q?: string; wos_index?: string; quartile?: string; mapped_only?: boolean }) => 
    apiClient.get<any[]>('/scholar/crawlers/mapped-data/', { params }),
}

