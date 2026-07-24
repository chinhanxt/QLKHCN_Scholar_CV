import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CheckSquare,
  Square,
  Play,
  ExternalLink,
  Database,
  UserCheck,
  FileText,
} from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useAdminProfiles, type ScholarProfile } from '@/api/hooks/useUserPortal'
import { scholarApi } from '@/api/endpoints/scholar'
import { useCrawlerStore, type QueueItemState } from '@/stores/crawler.store'

interface ScholarPendingRequestsModalProps {
  open?: boolean
  isOpen?: boolean
  onClose: () => void
}

export function extractScholarId(
  scholarUrl: string | null,
  scholarId: string | null
): string | null {
  if (scholarId && scholarId.trim()) {
    return scholarId.trim()
  }
  if (scholarUrl && scholarUrl.trim()) {
    const match = scholarUrl.match(/user=([a-zA-Z0-9_-]+)/)
    if (match && match[1]) {
      return match[1]
    }
  }
  return null
}

export function ScholarPendingRequestsModal({
  open,
  isOpen,
  onClose,
}: ScholarPendingRequestsModalProps) {
  const isModalOpen = open ?? isOpen ?? false

  const { data: profiles, isLoading: isLoadingProfiles } = useAdminProfiles()
  const addToScholarQueue = useCrawlerStore((state) => state.addToScholarQueue)

  // Fetch existing authors in DB to determine if profile author exists in DB
  const { data: dbAuthors, isLoading: isLoadingAuthors } = useQuery({
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
    enabled: isModalOpen,
  })

  // Set of scholar_ids existing in DB (must have publications or full scrape data)
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

  // Filter profiles that are strictly PENDING with valid scholar_url/scholar_id
  const pendingProfiles = useMemo(() => {
    if (!profiles) return []
    return profiles.filter((p: ScholarProfile) => {
      const extractedId = extractScholarId(p.scholar_url, p.scholar_id)
      if (!extractedId) return false
      return p.status === 'PENDING'
    })
  }, [profiles])

  // Map pending profiles with DB existence check status
  const profileItems = useMemo(() => {
    return pendingProfiles.map((p) => {
      const scholarId = extractScholarId(p.scholar_url, p.scholar_id) || ''
      const existsInDb = Boolean(
        p.author_detail ||
          (scholarId && existingScholarIds.has(scholarId.toLowerCase()))
      )
      return {
        profile: p,
        scholarId,
        existsInDb, // false -> 🟢 Mới 100%, true -> 🟡 Đã có trong DB
      }
    })
  }, [pendingProfiles, existingScholarIds])

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false)

  // Default-select all `Mới 100%` requests when modal opens or profileItems finish loading
  useEffect(() => {
    if (isModalOpen) {
      if (profileItems.length > 0 && !hasInitializedSelection) {
        const defaultSelected = profileItems
          .filter((item) => !item.existsInDb)
          .map((item) => item.profile.id)
        setSelectedIds(defaultSelected)
        setHasInitializedSelection(true)
      }
    } else {
      setHasInitializedSelection(false)
      setSelectedIds([])
    }
  }, [isModalOpen, profileItems, hasInitializedSelection])

  const handleSelectAll = () => {
    setSelectedIds(profileItems.map((item) => item.profile.id))
  }

  const handleDeselectAll = () => {
    setSelectedIds([])
  }

  const handleToggleItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    )
  }

  const handleActivateBatchCrawl = () => {
    const selectedItems = profileItems.filter((item) =>
      selectedIds.includes(item.profile.id)
    )

    if (selectedItems.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 hồ sơ để kích hoạt cào hàng loạt!')
      return
    }

    const queueItems: QueueItemState[] = selectedItems.map((item) => ({
      id: item.profile.id || crypto.randomUUID(),
      scholarId: item.scholarId,
      userEmail: item.profile.user_email || item.profile.full_name || 'N/A',
      status: 'PENDING',
      progress: 0,
      taskId: null,
      consoleLogs: [],
    }))

    addToScholarQueue(queueItems)
    toast.success(`🚀 Đã thêm ${queueItems.length} hồ sơ vào hàng đợi cào hàng loạt!`)
    onClose()
  }

  const isLoading = isLoadingProfiles || isLoadingAuthors

  const newCount = profileItems.filter((item) => !item.existsInDb).length
  const existingCount = profileItems.filter((item) => item.existsInDb).length

  return (
    <Dialog
      open={isModalOpen}
      onClose={onClose}
      className="max-w-3xl"
      title={
        <div className="flex items-center gap-2 text-slate-900">
          <FileText className="h-5 w-5 text-slate-700" />
          <span>Chọn yêu cầu cào hàng loạt Google Scholar</span>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Stats & Summary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 border border-slate-200 text-sm">
          <div className="flex items-center gap-4">
            <span className="text-slate-600">
              Tổng số yêu cầu: <strong className="text-slate-900">{profileItems.length}</strong>
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <FileText className="h-4 w-4 text-slate-600" /> Mới 100%: <strong>{newCount}</strong>
            </span>
            <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
              <Database className="h-4 w-4 text-amber-500" /> Đã có trong cơ sở dữ liệu: <strong>{existingCount}</strong>
            </span>
          </div>
          <div className="text-xs text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200 font-medium">
            Đã chọn: {selectedIds.length} / {profileItems.length}
          </div>
        </div>

        {/* Selection Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={profileItems.length === 0}
              className="h-8 text-xs gap-1.5"
            >
              <CheckSquare className="h-3.5 w-3.5 text-indigo-600" />
              Chọn tất cả
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDeselectAll}
              disabled={selectedIds.length === 0}
              className="h-8 text-xs gap-1.5"
            >
              <Square className="h-3.5 w-3.5 text-slate-500" />
              Bỏ chọn tất cả
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            * Mặc định chọn tất cả hồ sơ 🟢 Mới 100%
          </p>
        </div>

        {/* Profiles Table / List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Spinner className="h-8 w-8 mb-2 text-indigo-600" />
            <p className="text-sm">Đang tải danh sách yêu cầu hồ sơ...</p>
          </div>
        ) : profileItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 rounded-lg border border-dashed border-slate-300 text-center">
            <UserCheck className="h-10 w-10 text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-700">Không có yêu cầu cào hồ sơ nào đang chờ</p>
            <p className="text-xs text-slate-500 mt-1">Các hồ sơ gửi lên đã được xử lý hoặc chưa có URL Google Scholar hợp lệ.</p>
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-100/90 backdrop-blur text-xs font-semibold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="w-10 px-3 py-2.5 text-center">Select</th>
                  <th className="px-3 py-2.5">Email / Người gửi</th>
                  <th className="px-3 py-2.5">Scholar ID</th>
                  <th className="px-3 py-2.5">Trạng thái đối soát</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {profileItems.map(({ profile, scholarId, existsInDb }) => {
                  const isSelected = selectedIds.includes(profile.id)
                  return (
                    <tr
                      key={profile.id}
                      onClick={() => handleToggleItem(profile.id)}
                      className={`cursor-pointer transition-colors hover:bg-indigo-50/50 ${
                        isSelected ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleItem(profile.id)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-slate-900">
                          {profile.user_email || profile.full_name || 'N/A'}
                        </div>
                        {profile.submitted_at && (
                          <div className="text-[11px] text-slate-400">
                            Gửi: {new Date(profile.submitted_at).toLocaleDateString('vi-VN')}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 font-mono text-xs text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded w-fit border border-indigo-100">
                          <span>{scholarId}</span>
                          {profile.scholar_url && (
                            <a
                              href={profile.scholar_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-indigo-400 hover:text-indigo-600"
                              title="Mở Scholar URL"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {!existsInDb ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span>🟢</span> Mới 100%
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <span>🟡</span> Đã có trong cơ sở dữ liệu
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button
            type="button"
            onClick={handleActivateBatchCrawl}
            disabled={selectedIds.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium gap-2"
          >
            <Play className="h-4 w-4 fill-white" />
            Kích hoạt cào hàng loạt ({selectedIds.length} hồ sơ đã chọn)
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
