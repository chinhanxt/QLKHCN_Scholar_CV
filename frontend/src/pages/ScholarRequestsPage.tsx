import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Clock,
  CheckCircle2,
  ExternalLink,
  Search,
  FileText,
  RefreshCw,
} from 'lucide-react'
import { useAdminProfiles, useApproveProfile } from '@/api/hooks/useUserPortal'
import { scholarApi } from '@/api/endpoints/scholar'
import { useCrawlerStore, type QueueItemState } from '@/stores/crawler.store'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'

export function ScholarRequestsPage() {
  const { data: profiles, isLoading, isError, error, refetch } = useAdminProfiles()
  const approveProfile = useApproveProfile()
  const addToScholarQueue = useCrawlerStore((state) => state.addToScholarQueue)
  const scholarQueue = useCrawlerStore((state) => state.scholarQueue)

  // Fetch existing authors in DB to determine if profile author exists in DB
  const { data: dbAuthors } = useQuery({
    queryKey: ['scholar-authors-lookup'],
    queryFn: async () => {
      try {
        const res = await scholarApi.getAuthors()
        const data = res.data
        if (Array.isArray(data)) return data
        if (data && Array.isArray((data as any).results)) return (data as any).results
        return []
      } catch {
        return []
      }
    },
  })

  const existingScholarIds = useMemo(() => {
    const set = new Set<string>()
    if (dbAuthors) {
      dbAuthors.forEach((author: any) => {
        if (author.scholar_id && author.scholar_id.trim()) {
          set.add(author.scholar_id.trim().toLowerCase())
        }
      })
    }
    return set
  }, [dbAuthors])

  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all')
  const [search, setSearch] = useState('')
  const [scanningId, setScanningId] = useState<string | null>(null)

  // Bảng chỉ hiển thị các user thực sự ĐÃ GỬI YÊU CẦU (Bỏ qua các user chưa gửi / DRAFT không có URL)
  const submittedProfiles = useMemo(() => {
    if (!profiles) return []
    return profiles.filter((p) => {
      const hasUrl = Boolean(p.scholar_url && p.scholar_url.trim() !== '')
      const hasSubmitted = p.status !== 'DRAFT' || hasUrl || Boolean(p.submitted_at)
      return hasSubmitted
    })
  }, [profiles])

  const pendingCount = useMemo(
    () => submittedProfiles.filter((p) => p.status === 'PENDING').length,
    [submittedProfiles]
  )

  const approvedCount = useMemo(
    () => submittedProfiles.filter((p) => p.status === 'APPROVED').length,
    [submittedProfiles]
  )

  const filteredProfiles = useMemo(() => {
    return submittedProfiles.filter((p) => {
      // Filter by status tab
      if (filter === 'pending' && p.status !== 'PENDING') return false
      if (filter === 'approved' && p.status !== 'APPROVED') return false

      // Filter by search term
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchEmail = p.user_email?.toLowerCase().includes(q)
        const matchScholarId = p.scholar_id?.toLowerCase().includes(q)
        const matchUrl = p.scholar_url?.toLowerCase().includes(q)
        return matchEmail || matchScholarId || matchUrl
      }

      return true
    })
  }, [submittedProfiles, filter, search])

  // Helper to extract Scholar ID from profile object or URL
  const getScholarIdFromProfile = (p: any): string | null => {
    if (p.scholar_id && p.scholar_id.trim()) return p.scholar_id.trim()
    if (p.scholar_url) {
      const match = p.scholar_url.match(/user=([a-zA-Z0-9_-]{10,16})/)
      if (match) return match[1]
    }
    return null
  }

  // Helper to check if profile has author data in DB
  const hasProfileScrapedData = (p: any): boolean => {
    if (p.author_detail) return true
    const scId = getScholarIdFromProfile(p)?.toLowerCase()
    if (scId && existingScholarIds.has(scId)) return true
    if (p.publications && p.publications.length > 0) return true
    if (p.total_citations && p.total_citations > 0) return true
    return false
  }

  // Handler to trigger crawler tool ONLY for new unscraped requests
  const handleTriggerToolScrape = (profile: any) => {
    const scholarId = getScholarIdFromProfile(profile)
    if (!scholarId) {
      toast.error('Không tìm thấy Google Scholar ID hợp lệ từ đường dẫn của người dùng.')
      return
    }

    const isAlreadyInQueue = scholarQueue.queue.some(
      (item) => item.id === profile.id || (scholarId && item.scholarId === scholarId)
    )
    if (isAlreadyInQueue) {
      toast.info(`Hồ sơ ${profile.user_email || 'này'} đã có trong hàng đợi cào ngầm!`)
      return
    }

    const queueItem: QueueItemState = {
      id: profile.id || crypto.randomUUID(),
      scholarId: scholarId,
      userEmail: profile.user_email || profile.full_name || 'N/A',
      status: 'PENDING',
      progress: 0,
      taskId: null,
      consoleLogs: [],
    }

    addToScholarQueue([queueItem])
    toast.success(`🚀 Đã thêm ${profile.user_email} vào hàng đợi cào tự động!`)
  }

  // Handler to approve profile in DB when data is already available
  const handleApproveProfile = async (profile: any) => {
    setScanningId(profile.id)
    try {
      await approveProfile.mutateAsync(profile.id)
      toast.success(`✅ Đã phê duyệt yêu cầu của ${profile.user_email}!`)
      refetch()
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không thể phê duyệt yêu cầu'))
    } finally {
      setScanningId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5 p-2 sm:p-4">

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              filter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả yêu cầu ({submittedProfiles.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              filter === 'pending' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            Đang chờ duyệt ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              filter === 'approved' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Đã duyệt ({approvedCount})
          </button>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Tìm email, Scholar ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-xl bg-white border-slate-200 text-xs focus:border-blue-600 shadow-xs"
          />
        </div>
      </div>

      {/* Requests Table */}
      <Card className="rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
            <Spinner className="h-5 w-5 text-blue-600" /> Đang tải danh sách yêu cầu...
          </div>
        ) : isError ? (
          <div className="p-12 text-center text-sm text-red-600">
            {getApiErrorMessage(error, 'Không tải được danh sách yêu cầu hồ sơ')}
          </div>
        ) : (
          <Table>
            <THead>
              <TR className="bg-slate-50/80 border-b border-slate-200/80">
                <TH className="py-3.5 px-4 font-semibold text-slate-700">Tài khoản Email</TH>
                <TH className="py-3.5 px-4 font-semibold text-slate-700">Google Scholar Link / ID</TH>
                <TH className="py-3.5 px-4 font-semibold text-slate-700">Trạng thái</TH>
                <TH className="py-3.5 px-4 font-semibold text-slate-700">Công trình & Chỉ số</TH>
                <TH className="py-3.5 px-4 font-semibold text-slate-700 text-right">Thao tác</TH>
              </TR>
            </THead>
            <TBody>
              {filteredProfiles.map((p) => {
                const hasData = hasProfileScrapedData(p)
                const pubCount = p.author_detail?.publications?.length || p.publications?.length || 0
                const citesCount = p.author_detail?.citedby || p.total_citations || 0

                return (
                  <TR key={p.id} className="hover:bg-slate-50/60 transition-colors border-b border-slate-100">
                    <TD className="py-3.5 px-4 font-medium text-slate-900 text-sm">{p.user_email || 'User'}</TD>
                    <TD className="py-3.5 px-4 text-xs font-mono text-slate-600">
                      {p.scholar_url ? (
                        <a
                          href={p.scholar_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 hover:underline flex items-center gap-1 max-w-xs truncate"
                        >
                          {p.scholar_id ? `ID: ${p.scholar_id}` : p.scholar_url}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-400">Chưa cung cấp</span>
                      )}
                    </TD>
                    <TD className="py-3.5 px-4">
                      {p.status === 'PENDING' ? (
                        p.request_type === 'UPDATE' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200/80">
                            <RefreshCw className="h-3.5 w-3.5 text-amber-600" /> Yêu cầu cập nhật
                          </span>
                        ) : hasData ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/80">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Đã có trong cơ sở dữ liệu
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200/80">
                            <Clock className="h-3.5 w-3.5 text-blue-600" /> Hồ sơ mới
                          </span>
                        )
                      ) : p.status === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/80">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Đã phê duyệt
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200">
                          Chưa gửi
                        </span>
                      )}
                    </TD>
                    <TD className="py-3.5 px-4 text-xs text-slate-600">
                      {hasData ? (
                        <span className="font-medium text-slate-800">{pubCount} bài báo (Citations: {citesCount})</span>
                      ) : (
                        <span className="text-slate-400">Chưa có dữ liệu (Chờ quét)...</span>
                      )}
                    </TD>
                    <TD className="py-3.5 px-4 text-right">
                      {p.status === 'PENDING' ? (
                        hasData ? (
                          <Button
                            size="sm"
                            onClick={() => handleApproveProfile(p)}
                            disabled={scanningId !== null}
                            className="h-8 px-3.5 text-xs text-white font-semibold rounded-lg cursor-pointer flex items-center gap-1.5 ml-auto shadow-2xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {scanningId === p.id ? (
                              <>
                                <Spinner className="h-3.5 w-3.5 text-white" />
                                <span>Đang duyệt...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Duyệt</span>
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleTriggerToolScrape(p)}
                            className="h-8 px-3.5 text-xs text-white font-semibold rounded-lg cursor-pointer flex items-center gap-1.5 ml-auto shadow-2xs bg-[#005b9a] hover:bg-[#00487a]"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>Quét hồ sơ mới</span>
                          </Button>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                          ✓ Đã duyệt
                        </span>
                      )}
                    </TD>
                  </TR>
                )
              })}
              {filteredProfiles.length === 0 && (
                <TR>
                  <TD colSpan={5} className="py-12 text-center text-slate-500 text-sm">
                    {search ? 'Không tìm thấy yêu cầu hồ sơ nào phù hợp.' : 'Chưa có yêu cầu hồ sơ nào từ người dùng.'}
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
