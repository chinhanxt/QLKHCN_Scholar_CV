import { useState, useEffect, useRef, useMemo } from 'react'
import { scholarApi } from '@/api/endpoints/scholar'
import type { AuthorCandidate, AuthorProfileDetail, PublicationDetail } from '@/api/endpoints/scholar'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useCrawlerStore } from '@/stores/crawler.store'
import { PublicationDetailPanel } from '@/components/scholar/PublicationDetailPanel'
import { PublicationTableList } from '@/components/scholar/PublicationTableList'
import { ScholarPendingRequestsModal } from '@/components/scholar/ScholarPendingRequestsModal'
import { ScholarQueueDashboard } from '@/components/scholar/ScholarQueueDashboard'
import { useAdminProfiles } from '@/api/hooks/useUserPortal'
import { 
  Search, 
  Download, 
  FileText,
  Edit,
  BookOpen,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  GraduationCap
} from 'lucide-react'

export function ScholarScraperPage() {
  const [authorInput, setAuthorInput] = useState(() => localStorage.getItem('scholar_authorInput') || '')
  const [searchMode, setSearchMode] = useState<'id' | 'search'>(() => (localStorage.getItem('scholar_searchMode') as 'id' | 'search') || 'search')
  const [isSearching, setIsSearching] = useState(false)
  const [candidates, setCandidates] = useState<AuthorCandidate[]>(() => {
    const saved = localStorage.getItem('scholar_candidates')
    return saved ? JSON.parse(saved) : []
  })
  const [scrapeLimit, setScrapeLimit] = useState<number>(() => {
    const saved = localStorage.getItem('scholar_scrapeLimit')
    return saved ? parseInt(saved, 10) : 10
  })
  const [profile, setProfile] = useState<AuthorProfileDetail | null>(() => {
    const saved = localStorage.getItem('scholar_profile')
    return saved ? JSON.parse(saved) : null
  })
  const profileCache = useRef<Map<string, AuthorProfileDetail>>(new Map())
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [isL2Running, setIsL2Running] = useState(() => localStorage.getItem('scholar_isL2Running') === 'true')
  const [completedL2Authors, setCompletedL2Authors] = useState<string[]>(() => {
    const saved = localStorage.getItem('scholar_completedL2Authors')
    return saved ? JSON.parse(saved) : []
  })
  const [selectedPublication, setSelectedPublication] = useState<any | null>(null)
  
  // Interactive UI State
  const [pubSearch, setPubSearch] = useState('')
  const [yearFilter, setYearFilter] = useState('All')
  const [quartileFilter, setQuartileFilter] = useState('all')
  const [sortBy, setSortBy] = useState('citations_desc')

  // Multi-select State
  const [selectedPubIds, setSelectedPubIds] = useState<string[]>([])

  // Trash Bin State
  const [deletedPublications, setDeletedPublications] = useState<PublicationDetail[]>(() => {
    const saved = localStorage.getItem('scholar_deletedPublications')
    return saved ? JSON.parse(saved) : []
  })

  // Dialog Modals
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isAddPubModalOpen, setIsAddPubModalOpen] = useState(false)
  const [isEditPubModalOpen, setIsEditPubModalOpen] = useState(false)
  const [isAllCitationsModalOpen, setIsAllCitationsModalOpen] = useState(false)
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false)
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false)
  const [editingPublication, setEditingPublication] = useState<any | null>(null)
  
  // Merge Form State
  const [mergeMainPubId, setMergeMainPubId] = useState<string>('')

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: '',
    affiliation: '',
    interests: ''
  })

  // Publication Form State
  const [pubForm, setPubForm] = useState({
    title: '',
    authors_list: '',
    venue: '',
    year: new Date().getFullYear().toString(),
    citations: 0,
    sjr_q: 'N/A',
    if_val: 'N/A',
    wos: 'N/A',
    doi: ''
  })

  // Pending Requests & Batch Queue State
  const [isPendingRequestsModalOpen, setIsPendingRequestsModalOpen] = useState(false)
  const { data: adminProfiles } = useAdminProfiles()
  const pendingCount = useMemo(() => {
    if (!adminProfiles) return 0
    return adminProfiles.filter((p) => {
      const extractedId =
        p.scholar_id || (p.scholar_url ? p.scholar_url.match(/user=([a-zA-Z0-9_-]+)/)?.[1] : null)
      if (!extractedId) return false

      const authorDetail = (p as any).author_detail
      const pubCount = authorDetail?.publications?.length || authorDetail?.publication_count_cached || authorDetail?.publications_count || (p as any).publications?.length || 0
      const hasScrapedAt = Boolean(authorDetail?.last_scraped_at) || Boolean((p as any).last_scraped_at)
      const hasData = pubCount > 0 && hasScrapedAt

      return p.status === 'PENDING' && !hasData
    }).length
  }, [adminProfiles])

  // Scholar Batch Queue Store
  const scholarQueue = useCrawlerStore((state) => state.scholarQueue)
  const addToScholarQueue = useCrawlerStore((state) => state.addToScholarQueue)
  const setSelectedQueueId = useCrawlerStore((state) => state.setSelectedQueueId)
  const updateScholarQueueItem = useCrawlerStore((state) => state.updateScholarQueueItem)
  const setActiveTaskIds = useCrawlerStore((state) => state.setActiveTaskIds)

  // Auto-Queue Dispatcher & Batch Task Polling
  const dispatchingIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const { queue, maxConcurrency } = scholarQueue

    const runningCount = queue.filter((item) => item.status === 'RUNNING').length
    if (runningCount < maxConcurrency) {
      const nextItem = queue.find(
        (item) => item.status === 'PENDING' && !dispatchingIdsRef.current.has(item.id)
      )

      if (nextItem) {
        dispatchingIdsRef.current.add(nextItem.id)
        updateScholarQueueItem(nextItem.id, {
          status: 'RUNNING',
          progress: 5,
          consoleLogs: [
            ...(nextItem.consoleLogs || []),
            `[System] Kích hoạt cào tự động cho Scholar ID: ${nextItem.scholarId}`,
          ],
        })

        scholarApi
          .scrapeAuthor(nextItem.scholarId, 0, true)
          .then((res) => {
            const taskId = res.data.task_id
            updateScholarQueueItem(nextItem.id, {
              taskId,
              consoleLogs: [
                ...(nextItem.consoleLogs || []),
                `[System] Tác vụ Celery đã khởi tạo thành công (Task ID: ${taskId})`,
              ],
            })
            setActiveTaskIds((prev) => (prev.includes(taskId) ? prev : [...prev, taskId]))
          })
          .catch((err: any) => {
            const errorMsg = err?.message || 'Lỗi không xác định khi khởi tạo cào'
            updateScholarQueueItem(nextItem.id, {
              status: 'FAILURE',
              consoleLogs: [
                ...(nextItem.consoleLogs || []),
                `[System] Lỗi khởi tạo tác vụ: ${errorMsg}`,
              ],
            })
          })
          .finally(() => {
            dispatchingIdsRef.current.delete(nextItem.id)
          })
      }
    }
  }, [
    scholarQueue.queue,
    scholarQueue.activeTaskIds,
    scholarQueue.maxConcurrency,
    updateScholarQueueItem,
    setActiveTaskIds,
  ])

  // Poll status for active tasks in scholarQueue
  useEffect(() => {
    const runningItemsWithTaskId = scholarQueue.queue.filter(
      (item) => item.status === 'RUNNING' && item.taskId
    )

    if (runningItemsWithTaskId.length === 0) return

    const pollInterval = setInterval(() => {
      runningItemsWithTaskId.forEach(async (item) => {
        if (!item.taskId) return
        try {
          const res = await scholarApi.getTaskStatus(item.taskId).then((r) => r.data)

          if (res.status === 'PROGRESS') {
            const newProgress = res.progress || item.progress || 5
            const currentLogs = item.consoleLogs || []
            const lastLog = currentLogs[currentLogs.length - 1]
            const updatedLogs =
              res.message && lastLog !== res.message ? [...currentLogs, res.message] : currentLogs

            updateScholarQueueItem(item.id, {
              progress: newProgress,
              consoleLogs: updatedLogs,
            })
          } else if (res.status === 'SUCCESS') {
            const currentLogs = item.consoleLogs || []
            const updatedLogs = [
              ...currentLogs,
              `>>> HOÀN THÀNH: Cào tự động thành công cho tác giả ${item.scholarId}`,
            ]

            updateScholarQueueItem(item.id, {
              status: 'SUCCESS',
              progress: 100,
              consoleLogs: updatedLogs,
              resultData: res.result,
            })

            setActiveTaskIds((prev) => prev.filter((id) => id !== item.taskId))

            const scId = res.result?.author?.scholar_id || item.scholarId
            if (scId) {
              loadProfile(scId)
            }
          } else if (res.status === 'FAILURE') {
            const currentLogs = item.consoleLogs || []
            const err = res.message || 'Lỗi cào tác giả.'
            const updatedLogs = [...currentLogs, `>>> LỖI: ${err}`]

            updateScholarQueueItem(item.id, {
              status: 'FAILURE',
              consoleLogs: updatedLogs,
            })

            setActiveTaskIds((prev) => prev.filter((id) => id !== item.taskId))
          }
        } catch (err) {
          console.error(`Lỗi polling task ${item.taskId} của queue item ${item.id}:`, err)
        }
      })
    }, 1200)

    return () => clearInterval(pollInterval)
  }, [
    scholarQueue.queue,
    scholarQueue.selectedQueueId,
    updateScholarQueueItem,
    setActiveTaskIds,
  ])

  // Sync selected queue item data & logs to main display
  useEffect(() => {
    if (!scholarQueue.selectedQueueId) return
    const selectedItem = scholarQueue.queue.find((i) => i.id === scholarQueue.selectedQueueId)
    if (!selectedItem) return

    if (selectedItem.consoleLogs && selectedItem.consoleLogs.length > 0) {
      setTaskState('scholar', { consoleLogs: selectedItem.consoleLogs })
    }

    const scId = selectedItem.resultData?.author?.scholar_id || selectedItem.scholarId
    if (scId) {
      if (profileCache.current.has(scId)) {
        setProfile(profileCache.current.get(scId)!)
      }
      loadProfile(scId)
    }
  }, [scholarQueue.selectedQueueId, scholarQueue.queue])

  const lastNotifiedTaskId = useRef<string | null>(null)

  useEffect(() => {
    localStorage.setItem('scholar_isL2Running', isL2Running.toString())
  }, [isL2Running])

  useEffect(() => {
    localStorage.setItem('scholar_completedL2Authors', JSON.stringify(completedL2Authors))
  }, [completedL2Authors])



  useEffect(() => {
    localStorage.setItem('scholar_authorInput', authorInput)
  }, [authorInput])

  useEffect(() => {
    localStorage.setItem('scholar_searchMode', searchMode)
  }, [searchMode])

  useEffect(() => {
    localStorage.setItem('scholar_candidates', JSON.stringify(candidates))
  }, [candidates])

  useEffect(() => {
    localStorage.setItem('scholar_scrapeLimit', scrapeLimit.toString())
  }, [scrapeLimit])

  useEffect(() => {
    localStorage.setItem('scholar_deletedPublications', JSON.stringify(deletedPublications))
  }, [deletedPublications])

  useEffect(() => {
    if (profile) {
      localStorage.setItem('scholar_profile', JSON.stringify(profile))
      setProfileForm({
        name: profile.name,
        affiliation: profile.affiliation || 'Cơ quan công tác chưa xác định',
        interests: profile.interests ? profile.interests.join(', ') : ''
      })
    } else {
      localStorage.removeItem('scholar_profile')
    }
  }, [profile])

  // Clear selections when switching profiles
  useEffect(() => {
    setSelectedPubIds([])
  }, [profile])

  // Automatically scroll all scrollable containers to top when selecting a publication (matches Image 2 layout)
  useEffect(() => {
    if (selectedPublication) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      const mainEl = document.querySelector('main')
      if (mainEl) {
        mainEl.scrollTop = 0
      }
      setTimeout(() => {
        document.querySelectorAll('.overflow-y-auto').forEach((el) => {
          el.scrollTop = 0
        })
      }, 0)
    }
  }, [selectedPublication])
  
  const { taskId, taskStatus } = useCrawlerStore((state) => state.scholar)
  const setTaskState = useCrawlerStore((state) => state.setTaskState)
  const addConsoleLog = useCrawlerStore((state) => state.addConsoleLog)
  const clearLogs = useCrawlerStore((state) => state.clearLogs)

  // Polling Celery Task Status
  useEffect(() => {
    if (!taskId) return

    const pollInterval = setInterval(async () => {
      try {
        const res = await scholarApi.getTaskStatus(taskId).then((r) => r.data)
        setTaskState('scholar', { taskStatus: res.status })
        
        if (res.status === 'PROGRESS') {
          setTaskState('scholar', { progress: res.progress || 0 })
          if (res.message) {
            addConsoleLog('scholar', res.message)
          }
        } else if (res.status === 'SUCCESS') {
          if (lastNotifiedTaskId.current === taskId) {
            clearInterval(pollInterval)
            return
          }
          lastNotifiedTaskId.current = taskId
          setTaskState('scholar', { progress: 100 })
          addConsoleLog('scholar', '>>> HOÀN THÀNH: Cào dữ liệu tác giả thành công!')
          setTaskState('scholar', { taskId: null })
          clearInterval(pollInterval)
          
          const failedPubs = res.result?.failed_publications || []
          const scId = res.result?.author?.scholar_id || profile?.scholar_id
          if (isL2Running) {
            if (scId) {
              setCompletedL2Authors((prev) => (prev.includes(scId) ? prev : [...prev, scId]))
            }
            if (failedPubs.length > 0) {
              toast.warning(`Hoàn thành quét lần 2 nhưng có ${failedPubs.length} bài lỗi! (Đã quét lần 1 & 2 xong)`)
              failedPubs.forEach((fp: any) => {
                addConsoleLog('scholar', `>>> CẢNH BẢO: Lỗi cào chi tiết bài "${fp.title}": ${fp.error}`)
              })
            } else {
              toast.success('Đã quét lần 1 và 2 xong!')
            }
            addConsoleLog('scholar', '>>> HOÀN THÀNH: Đã quét xong lần 1 (Danh sách) và lần 2 (Chi tiết) thành công!')
            setIsL2Running(false)
          } else {
            toast.success('Đã quét lần 1 thành công (Danh sách bài báo)!')
          }
          
          setSelectedPublication(null)
          loadProfile(res.result?.author?.scholar_id)
        } else if (res.status === 'FAILURE') {
          if (lastNotifiedTaskId.current === taskId) {
            clearInterval(pollInterval)
            return
          }
          lastNotifiedTaskId.current = taskId
          setTaskState('scholar', { taskId: null })
          clearInterval(pollInterval)
          const err = res.message || 'Lỗi không xác định.'
          addConsoleLog('scholar', `>>> LỖI: ${err}`)
          toast.error(`Cào dữ liệu thất bại: ${err}`)
          setIsL2Running(false)
        }
      } catch (err: any) {
        console.error('Error polling task status:', err)
      }
    }, 1000)

    return () => clearInterval(pollInterval)
  }, [taskId, setTaskState, addConsoleLog, isL2Running])

  const loadProfile = async (scholarId: string) => {
    if (!scholarId) return

    if (profileCache.current.has(scholarId)) {
      setProfile(profileCache.current.get(scholarId)!)
      setIsLoadingProfile(false)
    } else if (!profile || profile.scholar_id !== scholarId) {
      setIsLoadingProfile(true)
    }

    try {
      const p = await scholarApi.getAuthor(scholarId).then((r) => r.data)
      if (p) {
        profileCache.current.set(scholarId, p)
        setProfile(p)
        setDeletedPublications([])
      }
    } catch (err) {
      console.error(`Lỗi loadProfile cho ${scholarId}:`, err)
    } finally {
      setIsLoadingProfile(false)
    }
  }

  const parseScholarInput = (input: string): { id: string; isId: boolean } => {
    const trimmed = input.trim()
    if (trimmed.includes('citations') || trimmed.includes('user=')) {
      try {
        const urlPart = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
        const urlObj = new URL(urlPart)
        const userParam = urlObj.searchParams.get('user')
        if (userParam) {
          return { id: userParam, isId: true }
        }
      } catch (e) {
        const match = trimmed.match(/user=([^&]+)/)
        if (match && match[1]) {
          return { id: match[1], isId: true }
        }
      }
    }
    if (trimmed.length === 12 && /^[a-zA-Z0-9_-]{12}$/.test(trimmed)) {
      return { id: trimmed, isId: true }
    }
    return { id: trimmed, isId: false }
  }

  const handleSearch = async () => {
    const trimmedInput = authorInput.trim()
    if (!trimmedInput) return
    
    setCandidates([])
    setProfile(null)
    setSelectedPublication(null)
    clearLogs('scholar')
    
    const parsed = parseScholarInput(trimmedInput)
    
    if (parsed.isId || searchMode === 'id') {
      const targetId = parsed.isId ? parsed.id : trimmedInput
      
      const existing = scholarQueue.queue.find((i) => i.scholarId === targetId)
      if (existing) {
        setSelectedQueueId(existing.id)
        if (profileCache.current.has(targetId)) {
          setProfile(profileCache.current.get(targetId)!)
        }
        loadProfile(targetId)
        toast.info(`Hồ sơ ${targetId} đã có trong hàng đợi xử lý.`)
        return
      }

      const newItem = {
        id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        scholarId: targetId,
        userEmail: '',
        status: 'PENDING' as const,
        progress: 0,
        taskId: null,
        consoleLogs: [`[System] Kích hoạt cào tự động tác giả ${targetId}...`],
      }

      addToScholarQueue([newItem])
      setSelectedQueueId(newItem.id)
      toast.success(`🚀 Đã thêm tác giả ${targetId} vào hàng đợi cào tự động!`)
    } else {
      setIsSearching(true)
      try {
        const res = await scholarApi.searchAuthors(trimmedInput).then((r) => r.data)
        setCandidates(res)
        if (res.length === 0) {
          toast.warning('Không tìm thấy ứng viên tác giả nào.')
        }
      } catch (err) {
        toast.error('Lỗi tìm kiếm tác giả.')
      } finally {
        setIsSearching(false)
      }
    }
  }

  const triggerCandidateScrape = async (scholarId: string, name: string) => {
    setCandidates([])
    setSelectedPublication(null)

    const existing = scholarQueue.queue.find((i) => i.scholarId === scholarId)
    if (existing) {
      setSelectedQueueId(existing.id)
      loadProfile(scholarId)
      toast.info(`Hồ sơ ${name} (${scholarId}) đã có trong hàng đợi.`)
      return
    }

    const newItem = {
      id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      scholarId,
      userEmail: name,
      status: 'PENDING' as const,
      progress: 0,
      taskId: null,
      consoleLogs: [`[System] Kích hoạt cào ứng viên tác giả ${name} (${scholarId})...`],
    }

    addToScholarQueue([newItem])
    setSelectedQueueId(newItem.id)
    toast.success(`🚀 Đã thêm ứng viên ${name} vào hàng đợi cào tự động!`)
  }



  // Handle Export to Excel
  const handleExport = async () => {
    if (!profile || profile.publications.length === 0) {
      toast.error('Không có dữ liệu bài báo để xuất báo cáo!')
      return
    }

    try {
      const isSelectiveExport = selectedPubIds.length > 0
      const pubsToExport = isSelectiveExport
        ? profile.publications.filter(p => selectedPubIds.includes(p.id))
        : profile.publications

      toast.info(isSelectiveExport ? `Đang xuất ${pubsToExport.length} bài báo đã chọn...` : 'Đang tạo file Excel (.xlsx) chuyên nghiệp...')
      const ExcelJSModule = await import('exceljs')
      const Workbook = ExcelJSModule.Workbook || (ExcelJSModule as any).default?.Workbook || (ExcelJSModule as any).default
      const workbook = new Workbook()

      const hasDetailedData = pubsToExport.some(
        (pub) => pub.cites_per_year && Object.keys(pub.cites_per_year).length > 0
      )

      // SHEET 1: TỔNG QUAN
      const sheet1 = workbook.addWorksheet('Tổng quan')
      sheet1.views = [{ showGridLines: true }]
      sheet1.columns = [
        { key: 'A', width: 35 },
        { key: 'B', width: 45 },
        { key: 'C', width: 15 },
        { key: 'D', width: 15 }
      ]

      sheet1.mergeCells('A1:D2')
      const banner = sheet1.getCell('A1')
      banner.value = isSelectiveExport 
        ? `BÁO CÁO HỒ SƠ TÁC GIẢ - XUẤT LỰA CHỌN (${pubsToExport.length} BÀI)` 
        : 'BÁO CÁO HỒ SƠ TÁC GIẢ KHOA HỌC (GOOGLE SCHOLAR)'
      banner.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
      banner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
      banner.alignment = { vertical: 'middle', horizontal: 'center' }

      sheet1.getCell('A4').value = 'I. THÔNG TIN CHUNG TÁC GIẢ'
      sheet1.getCell('A4').font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF2563EB' } }
      sheet1.mergeCells('A4:D4')

      const totalCitesOfExport = pubsToExport.reduce((sum, p) => sum + (p.citations || 0), 0)

      const infoFields = [
        ['Họ và tên tác giả', profile.name],
        ['Cơ quan công tác', profile.affiliation || 'Không rõ cơ quan công tác'],
        [isSelectiveExport ? 'Tổng số trích dẫn bài xuất' : 'Tổng số trích dẫn', isSelectiveExport ? totalCitesOfExport : profile.citedby],
        ['Tổng số trích dẫn (5 năm gần nhất)', profile.citedby5y ?? 0],
        ['Chỉ số H-index', profile.hindex || 0],
        ['Chỉ số H-index (5 năm gần nhất)', profile.hindex5y ?? 0],
        ['Chỉ số i10-index', profile.i10index || 0],
        ['Chỉ số i10-index (5 năm gần nhất)', profile.i10index5y ?? 0]
      ]

      infoFields.forEach((field, i) => {
        const rowIdx = 5 + i
        const cellA = sheet1.getCell(`A${rowIdx}`)
        const cellB = sheet1.getCell(`B${rowIdx}`)
        
        cellA.value = field[0]
        cellA.font = { name: 'Calibri', size: 11, bold: true }
        cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
        cellA.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        }

        cellB.value = field[1]
        cellB.font = { name: 'Calibri', size: 11 }
        if (typeof field[1] === 'number') {
          cellB.alignment = { horizontal: 'left' }
        }
        sheet1.mergeCells(`B${rowIdx}:D${rowIdx}`)

        for (let col = 2; col <= 4; col++) {
          const colLetter = String.fromCharCode(64 + col)
          sheet1.getCell(`${colLetter}${rowIdx}`).border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          }
        }
      })

      const totalPubs = pubsToExport.length
      const wosCount = pubsToExport.filter(p => p.wos && p.wos !== 'N/A').length
      const sjrCount = pubsToExport.filter(p => p.sjr_q && (p.sjr_q.includes('Q1') || p.sjr_q.includes('Q2'))).length
      const ifCount = pubsToExport.filter(p => p.if_val && p.if_val !== 'N/A').length
      const bothCount = pubsToExport.filter(p => p.if_val && p.if_val !== 'N/A' && p.sjr_q && p.sjr_q !== 'N/A').length

      const statStartRow = 5 + infoFields.length + 1
      sheet1.getCell('A' + statStartRow).value = 'II. THỐNG KÊ ĐỐI KHỚP DANH MỤC CƠ SỞ DỮ LIỆU'
      sheet1.getCell('A' + statStartRow).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF2563EB' } }
      sheet1.mergeCells(`A${statStartRow}:D${statStartRow}`)

      const statFields = [
        ['Tổng số bài báo khoa học xuất', totalPubs],
        ['Bài báo thuộc danh mục WoS Core Collection', wosCount],
        ['Bài báo phân hạng Q1/Q2 SCImago', sjrCount],
        ['Bài báo có Impact Factor (IF)', ifCount],
        ['Bài báo có cả chỉ số IF & SJR', bothCount]
      ]

      statFields.forEach((field, i) => {
        const rowIdx = statStartRow + 1 + i
        const cellA = sheet1.getCell(`A${rowIdx}`)
        const cellB = sheet1.getCell(`B${rowIdx}`)
        
        cellA.value = field[0]
        cellA.font = { name: 'Calibri', size: 11, bold: true }
        cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
        cellA.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        }

        cellB.value = field[1]
        cellB.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF2563EB' } }
        cellB.alignment = { horizontal: 'center' }
        sheet1.mergeCells(`B${rowIdx}:D${rowIdx}`)

        for (let col = 2; col <= 4; col++) {
          const colLetter = String.fromCharCode(64 + col)
          sheet1.getCell(`${colLetter}${rowIdx}`).border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          }
        }
      })

      if (hasDetailedData) {
        const chartStartRow = statStartRow + 7
        sheet1.getCell(`A${chartStartRow}`).value = 'III. SƠ ĐỒ TRÍCH DẪN THEO NĂM CỦA CÁC BÀI BÁO XUẤT'
        sheet1.getCell(`A${chartStartRow}`).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF2563EB' } }
        sheet1.mergeCells(`A${chartStartRow}:D${chartStartRow}`)

        const headerRowIdx = chartStartRow + 1
        const cellA_Header = sheet1.getCell(`A${headerRowIdx}`)
        const cellB_Header = sheet1.getCell(`B${headerRowIdx}`)
        
        cellA_Header.value = 'Năm'
        cellA_Header.font = { name: 'Calibri', size: 11, bold: true }
        cellA_Header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
        cellA_Header.alignment = { horizontal: 'center' }
        cellA_Header.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        }

        cellB_Header.value = 'Số lượt trích dẫn'
        cellB_Header.font = { name: 'Calibri', size: 11, bold: true }
        cellB_Header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
        cellB_Header.alignment = { horizontal: 'center' }
        sheet1.mergeCells(`B${headerRowIdx}:D${headerRowIdx}`)

        for (let col = 2; col <= 4; col++) {
          const colLetter = String.fromCharCode(64 + col)
          sheet1.getCell(`${colLetter}${headerRowIdx}`).border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          }
        }

        const selectiveCitationYears = Array.from(
          new Set(
            pubsToExport
              .flatMap((p) => Object.keys(p.cites_per_year || {}))
              .filter((y) => /^\d{4}$/.test(y))
          )
        ).sort()

        const selectiveCitationValues = selectiveCitationYears.map((year) => {
          const totalCites = pubsToExport.reduce((sum, p) => {
            return sum + (p.cites_per_year?.[year] || 0)
          }, 0) || 0
          return { year, count: totalCites }
        })

        selectiveCitationValues.forEach((val, i) => {
          const rowIdx = headerRowIdx + 1 + i
          const cellA = sheet1.getCell(`A${rowIdx}`)
          const cellB = sheet1.getCell(`B${rowIdx}`)
          
          cellA.value = parseInt(val.year, 10)
          cellA.font = { name: 'Calibri', size: 11 }
          cellA.alignment = { horizontal: 'center' }
          cellA.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          }

          cellB.value = val.count
          cellB.font = { name: 'Calibri', size: 11 }
          cellB.alignment = { horizontal: 'center' }
          sheet1.mergeCells(`B${rowIdx}:D${rowIdx}`)

          for (let col = 2; col <= 4; col++) {
            const colLetter = String.fromCharCode(64 + col)
            sheet1.getCell(`${colLetter}${rowIdx}`).border = {
              top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            }
          }
        })

        const sumRowIdx = headerRowIdx + 1 + selectiveCitationValues.length
        const cellA_Sum = sheet1.getCell(`A${sumRowIdx}`)
        const cellB_Sum = sheet1.getCell(`B${sumRowIdx}`)

        cellA_Sum.value = 'Tổng cộng trích dẫn'
        cellA_Sum.font = { name: 'Calibri', size: 11, bold: true }
        cellA_Sum.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
        cellA_Sum.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'double', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        }

        cellB_Sum.value = { formula: `=SUM(B${headerRowIdx + 1}:B${sumRowIdx - 1})` }
        cellB_Sum.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF2563EB' } }
        cellB_Sum.alignment = { horizontal: 'center' }
        sheet1.mergeCells(`B${sumRowIdx}:D${sumRowIdx}`)

        for (let col = 2; col <= 4; col++) {
          const colLetter = String.fromCharCode(64 + col)
          sheet1.getCell(`${colLetter}${sumRowIdx}`).border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'double', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          }
        }
      }

      // SHEET 2: DANH SÁCH BÀI BÁO CHI TIẾT
      const sheet2 = workbook.addWorksheet('Danh sách bài báo')
      sheet2.views = [{ showGridLines: true }]

      const pubCols: any[] = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Tên bài báo khoa học', key: 'title', width: 55 },
        { header: 'Danh sách tác giả', key: 'authors', width: 38 },
        { header: 'Nơi xuất bản (Venue)', key: 'venue', width: 32 },
        { header: 'Ngày xuất bản', key: 'pub_date', width: 15 },
        { header: 'Tập (Volume)', key: 'volume', width: 12 },
        { header: 'Số (Issue)', key: 'issue', width: 10 },
        { header: 'Số trang (Pages)', key: 'pages', width: 14 },
        { header: 'Nhà xuất bản', key: 'publisher', width: 25 },
        { header: 'Tổng trích dẫn', key: 'citations', width: 15 },
        { header: 'SJR Q', key: 'sjr_q', width: 10 },
        { header: 'Impact Factor (IF)', key: 'if_val', width: 16 },
        { header: 'Web of Science (WoS)', key: 'wos', width: 26 },
        { header: 'Link bài viết', key: 'pub_url', width: 30 },
        { header: 'Link PDF', key: 'eprint_url', width: 30 },
        { header: 'Tóm tắt (Abstract)', key: 'description', width: 60 }
      ]

      if (hasDetailedData) {
        const selectiveYears = Array.from(
          new Set(
            pubsToExport
              .flatMap((p) => Object.keys(p.cites_per_year || {}))
              .filter((y) => /^\d{4}$/.test(y))
          )
        ).sort()
        
        selectiveYears.forEach((year) => {
          pubCols.push({ header: year, key: `year_${year}`, width: 9 })
        })
      }

      sheet2.columns = pubCols

      const headerRow = sheet2.getRow(1)
      headerRow.height = 36
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF1D4ED8' } },
          bottom: { style: 'medium', color: { argb: 'FF1D4ED8' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        }
      })

      pubsToExport.forEach((pub, idx) => {
        const rowData: any = {
          stt: idx + 1,
          title: pub.title,
          authors: pub.authors_list,
          venue: pub.venue,
          pub_date: pub.pub_date || pub.year || '',
          volume: pub.volume || '',
          issue: pub.issue || '',
          pages: pub.pages || '',
          publisher: pub.publisher || '',
          citations: pub.citations || 0,
          sjr_q: pub.sjr_q || 'N/A',
          if_val: pub.if_val || 'N/A',
          wos: pub.wos || 'N/A',
          pub_url: pub.pub_url || '',
          eprint_url: pub.eprint_url || '',
          description: pub.description || ''
        }

        if (hasDetailedData) {
          const citesMap = pub.cites_per_year || {}
          const selectiveYears = Array.from(
            new Set(
              pubsToExport
                .flatMap((p) => Object.keys(p.cites_per_year || {}))
                .filter((y) => /^\d{4}$/.test(y))
            )
          ).sort()

          selectiveYears.forEach((year) => {
            const val = citesMap[year]
            rowData[`year_${year}`] = val !== undefined ? val : null
          })
        }

        const row = sheet2.addRow(rowData)
        row.height = 30

        const isOdd = idx % 2 === 1
        const zebraColor = isOdd ? 'FFF8FAFC' : 'FFFFFFFF'
        
        const isHighQuality = (pub.sjr_q && (pub.sjr_q.includes('Q1') || pub.sjr_q.includes('Q2'))) || 
                              (pub.wos && pub.wos !== 'N/A') || 
                              (pub.if_val && pub.if_val !== 'N/A')

        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          cell.font = { name: 'Calibri', size: 10 }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebraColor } }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          }

          const colKey = sheet2.columns[colNum - 1]?.key
          if (!colKey) return
          
          if (colKey === 'stt' || colKey === 'pub_date' || colKey === 'volume' || colKey === 'issue' || colKey === 'pages' || colKey === 'sjr_q' || colKey.startsWith('year_')) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
          } else if (colKey === 'citations' || colKey === 'if_val') {
            cell.alignment = { vertical: 'middle', horizontal: 'right' }
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
          }

          if (colKey === 'citations' || colKey.startsWith('year_')) {
            if (typeof cell.value === 'number') {
              cell.numFmt = '#,##0'
            }
          }

          if (isHighQuality && (colKey === 'sjr_q' || colKey === 'if_val' || colKey === 'wos')) {
            const valStr = String(cell.value || '')
            if (valStr && valStr !== 'N/A') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } }
              cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF137333' } }
            }
          }
        })
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Scholar_Profile_${profile.name.replace(/\s+/g, '_')}_export.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success(isSelectiveExport ? `Đã tải về danh sách ${pubsToExport.length} bài báo được chọn!` : 'Xuất báo cáo Excel (.xlsx) thành công!')
    } catch (error: any) {
      console.error('Error generating Excel file:', error)
      toast.error(`Lỗi xuất Excel: ${error.message}`)
    }
  }

  // Clean values for visual computations
  const authorCitesPerYear = profile?.cites_per_year || {}
  const officialYears = Object.keys(authorCitesPerYear).filter((y) => /^\d{4}$/.test(y)).sort()

  const citationValues = officialYears.length > 0
    ? officialYears.map((year) => ({ year, count: authorCitesPerYear[year] || 0 }))
    : (profile?.publications
        ? Array.from(
            new Set(
              profile.publications
                .flatMap((p) => Object.keys(p.cites_per_year || {}))
                .filter((y) => /^\d{4}$/.test(y))
            )
          ).sort().map((year) => ({
            year,
            count: profile.publications.reduce((sum, p) => sum + (p.cites_per_year?.[year] || 0), 0)
          }))
        : [])

  const maxCites = Math.max(...citationValues.map((v) => v.count), 1)

  // Sidebar citation values (Slice only the last 8 years to keep it uncluttered)
  const recentCitationValues = citationValues.slice(-8)
  const maxRecentCites = Math.max(...recentCitationValues.map((v) => v.count), 1)









  // Dynamic DOI generator
  const getDoi = (pub: any) => {
    if (pub.doi) return pub.doi
    const cleanVenue = (pub.venue || 'jrn').toLowerCase().replace(/[^a-z]/g, '').slice(0, 8) || 'paper'
    const year = pub.year || '2025'
    const hash = pub.id ? pub.id.toString().slice(0, 6) : '10352'
    return `10.1016/j.${cleanVenue}.${year}.${hash}`
  }

  const handleDeselectAll = () => {
    setSelectedPubIds([])
  }

  const handleToggleSelectAll = () => {
    if (!profile) return
    const allIds = profile.publications.map(p => String(p.id))
    const isAllSelected = allIds.length > 0 && allIds.every(id => selectedPubIds.includes(id))
    if (isAllSelected) {
      setSelectedPubIds([])
    } else {
      setSelectedPubIds(allIds)
    }
  }

  const handleToggleSelect = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    setSelectedPubIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  // Trash & Restore functions
  const handleRestorePub = (pub: PublicationDetail) => {
    if (!profile) return
    setProfile({
      ...profile,
      publications: [pub, ...profile.publications],
      citedby: profile.citedby + (pub.citations || 0)
    })
    setDeletedPublications(prev => prev.filter(p => p.id !== pub.id))
    toast.success(`Đã khôi phục thành công bài báo: "${pub.title.slice(0, 40)}..."!`)
  }

  const handleDeletePermanently = (pubId: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn bài báo này? Thao tác này không thể phục hồi.')) {
      setDeletedPublications(prev => prev.filter(p => p.id !== pubId))
      toast.success('Đã xóa vĩnh viễn bài báo!')
    }
  }

  const handleEmptyTrash = () => {
    if (deletedPublications.length === 0) return
    if (window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn toàn bộ bài báo trong thùng rác?')) {
      setDeletedPublications([])
      toast.success('Đã dọn sạch thùng rác vĩnh viễn!')
    }
  }

  // Merge Action logic
  const handleMergeConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || selectedPubIds.length < 2 || !mergeMainPubId) return

    const selectedPubs = profile.publications.filter(p => selectedPubIds.includes(p.id))
    const mainPub = selectedPubs.find(p => p.id === mergeMainPubId)
    if (!mainPub) return

    // Calculate total merged citations
    const mergedCitations = selectedPubs.reduce((sum, p) => sum + (p.citations || 0), 0)

    // Calculate merged citation history per year
    const mergedCitesPerYear: Record<string, number> = {}
    selectedPubs.forEach(p => {
      if (!p.cites_per_year) return
      Object.entries(p.cites_per_year).forEach(([yr, count]) => {
        mergedCitesPerYear[yr] = (mergedCitesPerYear[yr] || 0) + (count || 0)
      })
    })

    // Construct updated main publication object
    const updatedMainPub: PublicationDetail = {
      ...mainPub,
      citations: mergedCitations,
      cites_per_year: mergedCitesPerYear
    }

    // Filter out all selected publications
    const updatedPublications = profile.publications
      .filter(p => !selectedPubIds.includes(p.id))
    
    // Insert updated main pub back to its original order index
    const mainPubOrigIndex = profile.publications.findIndex(p => p.id === mergeMainPubId)
    updatedPublications.splice(mainPubOrigIndex >= 0 ? mainPubOrigIndex : 0, 0, updatedMainPub)

    // Recalculate total profile citations
    const newTotalCites = updatedPublications.reduce((sum, p) => sum + (p.citations || 0), 0)

    setProfile({
      ...profile,
      publications: updatedPublications,
      citedby: newTotalCites
    })

    setIsMergeModalOpen(false)
    setSelectedPubIds([])
    setMergeMainPubId('')
    toast.success('Đã gộp thành công các bài báo nghiên cứu đã chọn!')
  }

  // Profile modal action handler
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    
    const interestsArray = profileForm.interests
      .split(',')
      .map(i => i.trim())
      .filter(i => i.length > 0)

    setProfile({
      ...profile,
      name: profileForm.name,
      affiliation: profileForm.affiliation,
      interests: interestsArray
    })
    setIsProfileModalOpen(false)
    toast.success('Cập nhật hồ sơ thành công!')
  }

  // Add Publication Action Handler
  const handleAddPub = (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    const newPub: PublicationDetail = {
      id: `custom_${Date.now()}`,
      title: pubForm.title,
      authors_list: pubForm.authors_list,
      venue: pubForm.venue,
      year: pubForm.year,
      citations: Number(pubForm.citations),
      display_order: profile.publications.length + 1,
      cites_per_year: {},
      journal: null,
      sjr_q: pubForm.sjr_q,
      if_val: pubForm.if_val,
      wos: pubForm.wos
    }

    setProfile({
      ...profile,
      publications: [newPub, ...profile.publications],
      citedby: profile.citedby + Number(pubForm.citations)
    })

    setIsAddPubModalOpen(false)
    // reset form
    setPubForm({
      title: '',
      authors_list: '',
      venue: '',
      year: new Date().getFullYear().toString(),
      citations: 0,
      sjr_q: 'N/A',
      if_val: 'N/A',
      wos: 'N/A',
      doi: ''
    })
    toast.success('Thêm bài báo nghiên cứu thành công!')
  }

  // Edit publication Action Handler
  const handleEditPub = (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !editingPublication) return

    const updatedPublications = profile.publications.map(p => {
      if (p.id === editingPublication.id) {
        return {
          ...p,
          title: pubForm.title,
          authors_list: pubForm.authors_list,
          venue: pubForm.venue,
          year: pubForm.year,
          citations: Number(pubForm.citations),
          sjr_q: pubForm.sjr_q,
          if_val: pubForm.if_val,
          wos: pubForm.wos
        }
      }
      return p
    })

    // Re-calculate citedby
    const totalCites = updatedPublications.reduce((sum, p) => sum + (p.citations || 0), 0)

    setProfile({
      ...profile,
      publications: updatedPublications,
      citedby: totalCites
    })

    if (selectedPublication && selectedPublication.id === editingPublication.id) {
      setSelectedPublication({
        ...selectedPublication,
        title: pubForm.title,
        authors_list: pubForm.authors_list,
        venue: pubForm.venue,
        year: pubForm.year,
        citations: Number(pubForm.citations),
        sjr_q: pubForm.sjr_q,
        if_val: pubForm.if_val,
        wos: pubForm.wos
      })
    }

    setIsEditPubModalOpen(false)
    setEditingPublication(null)
    toast.success('Cập nhật bài báo thành công!')
  }

  const openEditPubModal = (pub: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingPublication(pub)
    setPubForm({
      title: pub.title,
      authors_list: pub.authors_list || '',
      venue: pub.venue || '',
      year: pub.year || '2025',
      citations: pub.citations || 0,
      sjr_q: pub.sjr_q || 'N/A',
      if_val: pub.if_val || 'N/A',
      wos: pub.wos || 'N/A',
      doi: getDoi(pub)
    })
    setIsEditPubModalOpen(true)
  }

  const handleDeletePub = (pubId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!profile) return
    if (window.confirm('Bạn có chắc muốn xóa bài báo này và chuyển vào thùng rác?')) {
      const pubToDelete = profile.publications.find(p => p.id === pubId)
      if (pubToDelete) {
        setDeletedPublications(prev => [pubToDelete, ...prev])
        const minusCites = pubToDelete.citations || 0
        const newPubs = profile.publications.filter(p => p.id !== pubId)
        setProfile({
          ...profile,
          publications: newPubs,
          citedby: Math.max(0, profile.citedby - minusCites)
        })
        toast.success('Đã chuyển bài báo vào thùng rác!')
      }
      if (selectedPublication && selectedPublication.id === pubId) {
        setSelectedPublication(null)
      }
    }
  }

  const handleBulkDeleteSelected = () => {
    if (!profile || selectedPubIds.length === 0) return
    if (window.confirm(`Bạn có chắc muốn chuyển ${selectedPubIds.length} bài báo đã chọn vào thùng rác?`)) {
      const pubsToDelete = profile.publications.filter(p => selectedPubIds.includes(String(p.id)))
      setDeletedPublications(prev => [...pubsToDelete, ...prev])
      const newPubs = profile.publications.filter(p => !selectedPubIds.includes(String(p.id)))
      const newTotalCites = newPubs.reduce((sum, p) => sum + (p.citations || 0), 0)
      setProfile({
        ...profile,
        publications: newPubs,
        citedby: newTotalCites
      })
      setSelectedPubIds([])
      toast.success(`Đã chuyển ${pubsToDelete.length} bài báo vào thùng rác!`)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 text-[#0F172A] font-sans antialiased custom-scrollbar">
      
      {/* 1. Dashboard Controls Bar & Workflow */}
      <div className="mb-6 flex flex-col gap-4">
        
        {/* Search & Scrape Toolbar (Placed at the VERY TOP) */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm flex flex-col gap-3.5">
          <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
            Tìm kiếm hoặc Dán Link Google Scholar tác giả
          </label>
          
          {/* Main Controls Row: Select + Input + Search Button */}
          <div className="flex flex-col sm:flex-row gap-2.5 w-full items-stretch sm:items-center">
            <select 
              value={searchMode}
              onChange={(e) => setSearchMode(e.target.value as 'id' | 'search')}
              className="w-full sm:w-auto shrink-0 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3.5 py-2.5 text-sm text-[#0F172A] font-semibold focus:outline-none focus:ring-2 focus:ring-[#2563EB] cursor-pointer"
            >
              <option value="search">Tìm theo tên</option>
              <option value="id">Nhập ID / Link</option>
            </select>
            
            <div className="relative flex-1 w-full">
              <input
                type="text"
                placeholder={searchMode === 'id' ? 'Nhập ID hoặc dán link (Ví dụ: user=vlowI28AAAAJ...)' : 'Nhập tên nhà nghiên cứu cần cào dữ liệu...'}
                value={authorInput}
                onChange={(e) => setAuthorInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full rounded-xl border border-[#E5E7EB] px-4 py-2.5 pl-10 text-sm text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#64748B]" />
            </div>

            <button
              onClick={handleSearch}
              disabled={isSearching || taskStatus === 'PENDING' || !authorInput.trim()}
              className="w-full sm:w-auto shrink-0 px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-sm shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSearching ? (
                <>
                  <Spinner className="h-4 w-4 text-white animate-spin" />
                  <span>Đang tìm...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  <span>Tìm kiếm</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsPendingRequestsModalOpen(true)}
              className="w-full sm:w-auto shrink-0 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm border border-slate-200 shadow-2xs flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <FileText className="w-4 h-4 text-slate-600 shrink-0" />
              <span>Danh sách yêu cầu chờ cào ({pendingCount})</span>
            </button>
          </div>

          {/* Sub Row: Scrape Limit Options */}
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Giới hạn số bài:</span>
            <div className="flex gap-1.5 flex-wrap">
              {[10, 50, 100, 0].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setScrapeLimit(val)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                    scrapeLimit === val
                      ? "bg-[#2563EB] border-[#2563EB] text-white shadow-xs"
                      : "bg-white hover:bg-slate-50 border-[#E5E7EB] text-[#64748B]"
                  )}
                >
                  {val === 0 ? "Không giới hạn" : `${val} bài`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scholar Queue Progress Dashboard (Light Theme) */}
        <ScholarQueueDashboard className="mt-1 mb-2" />
      </div>

      {/* 2. Candidates Author List */}
      {(isSearching || candidates.length > 0) && (
        <div className="mb-6 flex flex-col gap-4">
          <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Ứng viên tìm thấy từ Google Scholar</h2>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {isSearching ? (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-400 bg-white border border-[#E5E7EB] rounded-2xl">
                <Spinner className="h-6 w-6 text-[#2563EB] mb-2" />
                <span className="text-xs font-semibold">Đang truy vấn danh sách tác giả...</span>
              </div>
            ) : (
              candidates.map((c) => (
                <div key={c.scholar_id} className="p-5 rounded-2xl border border-[#E5E7EB] bg-white shadow-sm flex flex-col gap-3 hover:border-[#93C5FD] transition-all justify-between group hover:shadow-md">
                  <div className="space-y-2">
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#2563EB] font-bold text-base">
                        {c.name.charAt(0)}
                      </div>
                      <div className="leading-tight">
                        <div className="text-sm font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">{c.name}</div>
                        <div className="text-[10px] text-[#64748B] font-mono mt-0.5">{c.scholar_id}</div>
                      </div>
                    </div>
                    
                    {c.affiliation && (
                      <div className="text-xs text-[#64748B] italic line-clamp-2 pl-1">
                        {c.affiliation}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1 pt-1">
                      {c.interests.slice(0, 3).map((int, i) => (
                        <span key={i} className="text-[10px] font-bold bg-[#F8FAFC] text-[#64748B] border border-[#E5E7EB] rounded-lg px-2 py-0.5">
                          {int}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => triggerCandidateScrape(c.scholar_id, c.name)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2 bg-[#DBEAFE] hover:bg-[#BFDBFE] text-[#2563EB] font-bold text-xs cursor-pointer transition-colors mt-2"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Lấy dữ liệu & So khớp</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3. Empty Onboarding State */}
      {!isLoadingProfile && !profile && candidates.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-16 bg-white border border-[#E5E7EB] rounded-3xl p-8 shadow-sm max-w-xl mx-auto my-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F5F9] text-[#64748B] mb-4">
            <BookOpen className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-[#0F172A]">Dữ liệu trống</h2>
          <p className="text-sm text-[#64748B] max-w-sm mt-1.5 leading-relaxed">
            Vui lòng nhập tên nhà khoa học hoặc link hồ sơ Google Scholar ở thanh tìm kiếm phía trên để nạp dữ liệu.
          </p>
        </div>
      )}

      {/* 4. Loading Skeletons */}
      {isLoadingProfile && (
        <div className="flex flex-col gap-6">
          <div className="h-32 w-full bg-white border border-[#E5E7EB] rounded-3xl p-6 flex items-center gap-4 animate-pulse">
            <div className="h-20 w-20 rounded-full bg-slate-200" />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-48 bg-slate-200 rounded" />
              <div className="h-4 w-96 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
      )}

      {/* 5. Main Dashboard Content (When Profile Loaded) */}
      {!isLoadingProfile && profile && (
        <div className="flex flex-col gap-6">

          {/* Profile Header Card */}
          <Card className="border-[#E5E7EB] rounded-3xl shadow-sm bg-white overflow-hidden p-6 relative">
            <button
              type="button"
              onClick={() => {
                setProfile(null)
                setSelectedQueueId(null)
                setSelectedPublication(null)
                localStorage.removeItem('scholar_profile')
                toast.info('Đã đóng thông tin và danh sách hồ sơ.')
              }}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all cursor-pointer z-10"
              title="Tắt thông tin và danh sách hồ sơ"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6">
              
              {/* Circular avatar containing a simple GraduationCap icon */}
              <div className="relative shrink-0">
                <div className="h-28 w-28 rounded-full border-4 border-[#DBEAFE] bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden shadow-sm">
                  <GraduationCap className="h-14 w-14 text-slate-500" />
                </div>
              </div>

              {/* Author Details Info */}
              <div className="flex-1 flex flex-col justify-center min-w-0">
                <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-bold text-[#0F172A] truncate">{profile.name}</h1>
                  <button
                    onClick={() => setIsProfileModalOpen(true)}
                    className="p-1.5 rounded-lg border border-[#E5E7EB] hover:bg-slate-50 text-slate-555 transition-colors cursor-pointer"
                    title="Chỉnh sửa hồ sơ"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                </div>
                
                <p className="text-sm font-semibold text-slate-700 mt-1.5">
                  {profile.affiliation && profile.affiliation !== 'Unknown affiliation' ? profile.affiliation : 'Mục liên kết không xác định'}
                </p>
                
                <p className="text-xs text-slate-500 mt-1">
                  {profile.email_domain ? `Email được xác minh tại ${profile.email_domain.replace(/^@/, '')}` : 'Không có email được xác minh'}
                </p>

                <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 mt-3">
                  {profile.interests && profile.interests.map((int, idx) => (
                    <span key={idx} className="text-[10px] font-bold bg-[#F8FAFC] text-slate-650 border border-[#E5E7EB] rounded-lg px-2.5 py-0.5">
                      {int}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Main Content Layout (Split 70/30) */}
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
            
            {/* LEFT (70% in list view, 100% in detail view) */}
            <div className={selectedPublication ? "lg:col-span-10 flex flex-col gap-6" : "lg:col-span-7 flex flex-col gap-6"}>
              
              {/* Detailed View Panel or Table List */}
              {selectedPublication ? (
                <PublicationDetailPanel
                  publication={selectedPublication}
                  authorName={profile.name}
                  onBack={() => setSelectedPublication(null)}
                  onEdit={(pub, e) => openEditPubModal(pub, e)}
                  onDelete={(pubId, e) => handleDeletePub(pubId, e)}
                />
              ) : (
                <PublicationTableList
                  publications={profile.publications}
                  selectedPubIds={selectedPubIds}
                  onSelectPub={(pub) => setSelectedPublication(pub)}
                  onToggleSelectPub={(pubId, e) => handleToggleSelect(pubId, e as any)}
                  onToggleSelectAll={handleToggleSelectAll}
                  onDeselectAll={handleDeselectAll}
                  onAddPub={() => setIsAddPubModalOpen(true)}
                  onOpenTrash={() => setIsTrashModalOpen(true)}
                  onMergePubs={() => setIsMergeModalOpen(true)}
                  onDeleteSelectedPubs={handleBulkDeleteSelected}
                  onExport={handleExport}
                  searchKeyword={pubSearch}
                  setSearchKeyword={setPubSearch}
                  yearFilter={yearFilter}
                  setYearFilter={setYearFilter}
                  quartileFilter={quartileFilter}
                  setQuartileFilter={setQuartileFilter}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                />
              )}

            </div>

            {/* RIGHT (30% - Columns 3/10 - Sidebar Widgets mirroring Scholar, hidden in detail view) */}
            {!selectedPublication && (
              <div className="lg:col-span-3 flex flex-col gap-6 w-full">
              
              {/* Cited by Card */}
              <Card className="border-[#E5E7EB] rounded-3xl bg-white p-5 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Trích dẫn bởi</h3>
                  <button 
                    onClick={() => setIsAllCitationsModalOpen(true)}
                    className="text-[10px] font-bold text-[#2563EB] hover:underline uppercase cursor-pointer"
                  >
                    Xem tất cả
                  </button>
                </div>
                
                {/* Metrics comparison table */}
                <table className="w-full text-left text-[11px] border-collapse mb-5">
                  <thead>
                    <tr className="text-slate-400 font-bold border-b border-slate-100">
                      <th className="py-1"></th>
                      <th className="py-1 text-right w-16">Tất cả</th>
                      <th className="py-1 text-right w-20">Từ 2021</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="py-2 font-semibold">Số trích dẫn</td>
                      <td className="py-2 text-right font-bold text-slate-800">{profile.citedby}</td>
                      <td className="py-2 text-right font-bold text-slate-800">{profile.citedby5y ?? 0}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-semibold">Chỉ số h-index</td>
                      <td className="py-2 text-right font-bold text-slate-800">{profile.hindex}</td>
                      <td className="py-2 text-right font-bold text-slate-800">{profile.hindex5y ?? 0}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-semibold">Chỉ số i10-index</td>
                      <td className="py-2 text-right font-bold text-slate-800">{profile.i10index}</td>
                      <td className="py-2 text-right font-bold text-slate-800">{profile.i10index5y ?? 0}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Vertical citation trend bar chart (Exactly last 8 years to keep it clean) */}
                {recentCitationValues.length === 0 ? (
                  <div className="flex h-36 items-center justify-center text-xs text-[#64748B] italic">
                    Chưa có lịch sử trích dẫn theo năm.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative bg-slate-50/50 border border-slate-100 rounded-2xl p-3 flex justify-center items-center">
                      <svg viewBox="0 0 240 140" className="w-full h-auto overflow-visible">
                        {/* Horizontal lines */}
                        <line x1="10" y1="20" x2="210" y2="20" stroke="#E2E8F0" strokeWidth="0.8" />
                        <line x1="10" y1="70" x2="210" y2="70" stroke="#E2E8F0" strokeWidth="0.8" />
                        <line x1="10" y1="120" x2="210" y2="120" stroke="#94A3B8" strokeWidth="1" />
                        
                        {/* Right Ticks */}
                        <text x="215" y="24" className="text-[9px] font-semibold fill-slate-500">{maxRecentCites}</text>
                        <text x="215" y="74" className="text-[9px] font-semibold fill-slate-500">{Math.round(maxRecentCites / 2)}</text>
                        <text x="215" y="124" className="text-[9px] font-semibold fill-slate-500">0</text>
                        
                        {/* Bars */}
                        {recentCitationValues.map((v, i) => {
                          const barWidth = 14
                          const spacing = recentCitationValues.length > 1 ? (190 - barWidth) / (recentCitationValues.length - 1) : 0
                          const x = 15 + i * spacing
                          const barHeight = maxRecentCites > 0 ? (v.count / maxRecentCites) * 100 : 0
                          const y = 120 - barHeight
                          return (
                            <g key={v.year} className="group cursor-pointer">
                              <rect 
                                x={x} 
                                y={y} 
                                width={barWidth} 
                                height={barHeight} 
                                fill="#777777" 
                                className="hover:fill-[#2563EB] transition-colors"
                              />
                              {v.count > 0 && (
                                <text 
                                  x={x + barWidth / 2} 
                                  y={y - 4} 
                                  textAnchor="middle" 
                                  className="text-[8px] font-bold fill-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  {v.count}
                                </text>
                              )}
                              <text 
                                x={x + barWidth / 2} 
                                y="134" 
                                textAnchor="middle" 
                                className="text-[8px] font-bold fill-slate-400"
                              >
                                {v.year}
                              </text>
                            </g>
                          )
                        })}
                      </svg>
                    </div>
                  </div>
                )}
              </Card>

              </div>
            )}

          </div>

        </div>
      )}



      {/* ========================================== */}
      {/* DIALOG MODAL 1: EDIT AUTHOR PROFILE */}
      {/* ========================================== */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E7EB] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8FAFC]">
              <h3 className="font-bold text-sm text-[#0F172A] uppercase tracking-wider">Chỉnh sửa hồ sơ tác giả</h3>
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-[#64748B] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveProfile} className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-[#64748B] block">Họ và tên</label>
                <input 
                  type="text" 
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  required
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-[#64748B] block">Cơ quan công tác (Affiliation)</label>
                <input 
                  type="text" 
                  value={profileForm.affiliation}
                  onChange={(e) => setProfileForm({ ...profileForm, affiliation: e.target.value })}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#64748B] block">Lĩnh vực nghiên cứu (Cách nhau bằng dấu phẩy)</label>
                <input 
                  type="text" 
                  value={profileForm.interests}
                  onChange={(e) => setProfileForm({ ...profileForm, interests: e.target.value })}
                  placeholder="Ví dụ: AI, IoT, Machine Learning"
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-bold transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold transition-all cursor-pointer"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* DIALOG MODAL 2: ADD NEW PUBLICATION */}
      {/* ========================================== */}
      {isAddPubModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E7EB] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8FAFC]">
              <h3 className="font-bold text-sm text-[#0F172A] uppercase tracking-wider">Thêm bài báo khoa học mới</h3>
              <button 
                onClick={() => setIsAddPubModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-[#64748B] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddPub} className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                <label className="font-bold text-[#64748B] block">Tên bài báo khoa học *</label>
                <textarea 
                  value={pubForm.title}
                  onChange={(e) => setPubForm({ ...pubForm, title: e.target.value })}
                  required
                  rows={2}
                  placeholder="Nhập đầy đủ tên bài báo..."
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-[#64748B] block">Danh sách tác giả * (Cách nhau bằng dấu phẩy)</label>
                <input 
                  type="text" 
                  value={pubForm.authors_list}
                  onChange={(e) => setPubForm({ ...pubForm, authors_list: e.target.value })}
                  required
                  placeholder="Ví dụ: T Duy Thanh, HT Chi Nhân, ..."
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-[#64748B] block">Tạp chí / Venue *</label>
                <input 
                  type="text" 
                  value={pubForm.venue}
                  onChange={(e) => setPubForm({ ...pubForm, venue: e.target.value })}
                  required
                  placeholder="Ví dụ: Sensors and Actuators B: Chemical"
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B] block">Năm *</label>
                  <input 
                    type="number" 
                    value={pubForm.year}
                    onChange={(e) => setPubForm({ ...pubForm, year: e.target.value })}
                    required
                    className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B] block">Số trích dẫn *</label>
                  <input 
                    type="number" 
                    value={pubForm.citations}
                    onChange={(e) => setPubForm({ ...pubForm, citations: Number(e.target.value) })}
                    required
                    className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B] block">Impact Factor (IF)</label>
                  <input 
                    type="text" 
                    value={pubForm.if_val}
                    onChange={(e) => setPubForm({ ...pubForm, if_val: e.target.value })}
                    placeholder="Ví dụ: 8.300"
                    className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B] block">Phân hạng SJR Quartile</label>
                  <select 
                    value={pubForm.sjr_q}
                    onChange={(e) => setPubForm({ ...pubForm, sjr_q: e.target.value })}
                    className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  >
                    <option value="N/A">N/A</option>
                    <option value="Q1">Q1</option>
                    <option value="Q2">Q2</option>
                    <option value="Q3">Q3</option>
                    <option value="Q4">Q4</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B] block">Danh mục Web of Science</label>
                  <input 
                    type="text" 
                    value={pubForm.wos}
                    onChange={(e) => setPubForm({ ...pubForm, wos: e.target.value })}
                    placeholder="Ví dụ: SCIE"
                    className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddPubModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-bold transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold transition-all cursor-pointer"
                >
                  Lưu bài báo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* DIALOG MODAL 3: EDIT EXISTING PUBLICATION */}
      {/* ========================================== */}
      {isEditPubModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E7EB] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8FAFC]">
              <h3 className="font-bold text-sm text-[#0F172A] uppercase tracking-wider">Chỉnh sửa bài báo khoa học</h3>
              <button 
                onClick={() => {
                  setIsEditPubModalOpen(false)
                  setEditingPublication(null)
                }}
                className="p-1 rounded-lg hover:bg-slate-100 text-[#64748B] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleEditPub} className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                <label className="font-bold text-[#64748B] block">Tên bài báo khoa học *</label>
                <textarea 
                  value={pubForm.title}
                  onChange={(e) => setPubForm({ ...pubForm, title: e.target.value })}
                  required
                  rows={2}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-[#64748B] block">Danh sách tác giả *</label>
                <input 
                  type="text" 
                  value={pubForm.authors_list}
                  onChange={(e) => setPubForm({ ...pubForm, authors_list: e.target.value })}
                  required
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-[#64748B] block">Tạp chí / Venue *</label>
                <input 
                  type="text" 
                  value={pubForm.venue}
                  onChange={(e) => setPubForm({ ...pubForm, venue: e.target.value })}
                  required
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B] block">Năm *</label>
                  <input 
                    type="number" 
                    value={pubForm.year}
                    onChange={(e) => setPubForm({ ...pubForm, year: e.target.value })}
                    required
                    className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B] block">Số trích dẫn *</label>
                  <input 
                    type="number" 
                    value={pubForm.citations}
                    onChange={(e) => setPubForm({ ...pubForm, citations: Number(e.target.value) })}
                    required
                    className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B] block">Impact Factor (IF)</label>
                  <input 
                    type="text" 
                    value={pubForm.if_val}
                    onChange={(e) => setPubForm({ ...pubForm, if_val: e.target.value })}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B] block">Phân hạng SJR Quartile</label>
                  <select 
                    value={pubForm.sjr_q}
                    onChange={(e) => setPubForm({ ...pubForm, sjr_q: e.target.value })}
                    className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  >
                    <option value="N/A">N/A</option>
                    <option value="Q1">Q1</option>
                    <option value="Q2">Q2</option>
                    <option value="Q3">Q3</option>
                    <option value="Q4">Q4</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B] block">Danh mục Web of Science</label>
                  <input 
                    type="text" 
                    value={pubForm.wos}
                    onChange={(e) => setPubForm({ ...pubForm, wos: e.target.value })}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditPubModalOpen(false)
                    setEditingPublication(null)
                  }}
                  className="px-4 py-2 rounded-xl border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-bold transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold transition-all cursor-pointer"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* DIALOG MODAL 4: SHOW ALL CITATIONS HISTOGRAM */}
      {/* ========================================== */}
      {isAllCitationsModalOpen && profile && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E7EB] rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8FAFC]">
              <h3 className="font-bold text-sm text-[#0F172A] uppercase tracking-wider">Số lượng trích dẫn theo năm</h3>
              <button 
                onClick={() => setIsAllCitationsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-[#64748B] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              
              {/* Outer scrollable wrapper with horizontal navigation sliders */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col gap-4 overflow-hidden relative">
                
                {/* Horizontal scroll view showing full year database (Image 2 style) */}
                <div className="overflow-x-auto custom-scrollbar pb-2">
                  <div className="min-w-[540px] px-2">
                    <svg viewBox="0 0 520 140" className="w-full h-auto overflow-visible">
                      {/* Horizontal lines */}
                      <line x1="10" y1="20" x2="480" y2="20" stroke="#E2E8F0" strokeWidth="0.8" />
                      <line x1="10" y1="70" x2="480" y2="70" stroke="#E2E8F0" strokeWidth="0.8" />
                      <line x1="10" y1="120" x2="480" y2="120" stroke="#94A3B8" strokeWidth="1" />
                      
                      {/* Right Ticks */}
                      <text x="485" y="24" className="text-[10px] font-semibold fill-slate-500">{maxCites}</text>
                      <text x="485" y="74" className="text-[10px] font-semibold fill-slate-500">{Math.round(maxCites / 2)}</text>
                      <text x="485" y="124" className="text-[10px] font-semibold fill-slate-500">0</text>
                      
                      {/* Bars */}
                      {citationValues.map((v, i) => {
                        const barWidth = 14
                        const spacing = citationValues.length > 1 ? (460 - barWidth) / (citationValues.length - 1) : 0
                        const x = 12 + i * spacing
                        const barHeight = maxCites > 0 ? (v.count / maxCites) * 100 : 0
                        const y = 120 - barHeight
                        return (
                          <g key={v.year} className="group cursor-pointer">
                            <rect 
                              x={x} 
                              y={y} 
                              width={barWidth} 
                              height={barHeight} 
                              fill="#777777" 
                              className="hover:fill-[#2563EB] transition-colors"
                            />
                            {v.count > 0 && (
                              <text 
                                x={x + barWidth / 2} 
                                y={y - 4} 
                                textAnchor="middle" 
                                className="text-[9px] font-bold fill-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                {v.count}
                              </text>
                            )}
                            <text 
                              x={x + barWidth / 2} 
                              y="134" 
                              textAnchor="middle" 
                              className="text-[9px] font-bold fill-slate-500"
                            >
                              {v.year}
                            </text>
                          </g>
                        )
                      })}
                    </svg>
                  </div>
                </div>

                {/* Left/Right slider indicator style representation */}
                <div className="flex items-center justify-center gap-4 text-xs text-slate-400 mt-2">
                  <ChevronLeft className="w-4 h-4 cursor-pointer hover:text-slate-600" />
                  <div className="w-1/2 h-1.5 bg-slate-200 rounded-full relative">
                    <div className="absolute left-[30%] w-[40%] h-full bg-slate-450 rounded-full"></div>
                  </div>
                  <ChevronRight className="w-4 h-4 cursor-pointer hover:text-slate-600" />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setIsAllCitationsModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all text-xs cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* DIALOG MODAL 5: TRASH BIN / RESTORE */}
      {/* ========================================== */}
      {isTrashModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E7EB] rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8FAFC]">
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-rose-600" />
                <h3 className="font-bold text-sm text-[#0F172A] uppercase tracking-wider">Thùng rác bài viết đã xóa</h3>
              </div>
              <button 
                onClick={() => setIsTrashModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-[#64748B] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[55vh] overflow-y-auto custom-scrollbar">
              {deletedPublications.length === 0 ? (
                <div className="text-center py-12 text-slate-400 italic text-xs">
                  Thùng rác đang trống.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {deletedPublications.map((pub) => (
                    <div key={pub.id} className="py-3.5 flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 line-clamp-2">{pub.title}</div>
                        <div className="text-[10px] text-slate-400 mt-1 truncate">{pub.authors_list}</div>
                        <div className="text-[10px] text-slate-500 italic mt-0.5">{pub.venue || 'Tạp chí khác'} • {pub.year}</div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleRestorePub(pub)}
                          className="px-2.5 py-1 rounded-lg border border-emerald-250 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] transition-colors cursor-pointer"
                          title="Khôi phục bài báo"
                        >
                          Khôi phục
                        </button>
                        <button
                          onClick={() => handleDeletePermanently(pub.id)}
                          className="px-2.5 py-1 rounded-lg border border-rose-250 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10px] transition-colors cursor-pointer"
                          title="Xóa vĩnh viễn"
                        >
                          Xóa vĩnh viễn
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#E5E7EB] bg-[#F8FAFC] flex justify-between items-center">
              <button
                disabled={deletedPublications.length === 0}
                onClick={handleEmptyTrash}
                className="px-4 py-2 rounded-xl border border-rose-250 text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:pointer-events-none text-xs font-bold transition-all cursor-pointer"
              >
                Dọn sạch thùng rác
              </button>
              <button
                onClick={() => setIsTrashModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* DIALOG MODAL 6: MERGE SELECTED PUBLICATIONS */}
      {/* ========================================== */}
      {isMergeModalOpen && profile && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E7EB] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8FAFC]">
              <h3 className="font-bold text-sm text-[#0F172A] uppercase tracking-wider">Gộp các bài báo đã chọn</h3>
              <button 
                onClick={() => {
                  setIsMergeModalOpen(false)
                  setMergeMainPubId('')
                }}
                className="p-1 rounded-lg hover:bg-slate-100 text-[#64748B] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleMergeConfirm} className="p-6 space-y-4 text-xs">
              <p className="text-slate-500 mb-2 leading-relaxed">
                Chọn bài viết nghiên cứu làm <strong>Bản ghi chính</strong>. Tiêu đề và thông tin của bài viết này sẽ được giữ lại, các bài viết còn lại sẽ được gộp trích dẫn vào bản ghi này và bị xóa khỏi danh sách.
              </p>

              <div className="space-y-3 max-h-[40vh] overflow-y-auto custom-scrollbar p-1">
                {profile.publications
                  .filter(p => selectedPubIds.includes(p.id))
                  .map(pub => (
                    <label 
                      key={pub.id} 
                      className={cn(
                        "flex gap-3 items-start p-3 rounded-2xl border cursor-pointer transition-all",
                        mergeMainPubId === pub.id 
                          ? "border-[#2563EB] bg-[#DBEAFE]/30" 
                          : "border-[#E5E7EB] hover:bg-slate-50"
                      )}
                    >
                      <input
                        type="radio"
                        name="merge_main_pub"
                        value={pub.id}
                        checked={mergeMainPubId === pub.id}
                        onChange={() => setMergeMainPubId(pub.id)}
                        className="mt-0.5 text-[#2563EB] focus:ring-[#2563EB]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 leading-snug">{pub.title}</div>
                        <div className="text-[10px] text-slate-500 mt-1 truncate">{pub.authors_list}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{pub.venue} • {pub.year} • Trích dẫn: <strong className="text-slate-700">{pub.citations}</strong></div>
                      </div>
                    </label>
                  ))}
              </div>

              <div className="pt-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600">Tổng số trích dẫn sau khi gộp:</span>
                <strong className="text-base text-[#2563EB]">
                  {profile.publications
                    .filter(p => selectedPubIds.includes(p.id))
                    .reduce((sum, p) => sum + (p.citations || 0), 0)}{' '}
                  trích dẫn
                </strong>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsMergeModalOpen(false)
                    setMergeMainPubId('')
                  }}
                  className="px-4 py-2 rounded-xl border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-bold transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={!mergeMainPubId}
                  className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                >
                  Xác nhận gộp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pending Requests Batch Crawl Selection Modal */}
      <ScholarPendingRequestsModal
        open={isPendingRequestsModalOpen}
        onClose={() => setIsPendingRequestsModalOpen(false)}
      />

    </div>
  )
}
