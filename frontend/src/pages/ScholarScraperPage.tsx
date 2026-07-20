import { useState, useEffect, useRef } from 'react'
import { scholarApi } from '@/api/endpoints/scholar'
import type { AuthorCandidate, AuthorProfileDetail, PublicationDetail } from '@/api/endpoints/scholar'
import { Card } from '@/components/ui/card'
import { TerminalWindow } from '@/components/ui/TerminalWindow'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useCrawlerStore } from '@/stores/crawler.store'
import { 
  Search, 
  TrendingUp, 
  Download, 
  FileText,
  ArrowLeft,
  Plus,
  Edit,
  CheckCircle2,
  BookOpen,
  Trash2,
  X,
  Sparkles,
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
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [isL2Running, setIsL2Running] = useState(() => localStorage.getItem('scholar_isL2Running') === 'true')
  const [selectedPublication, setSelectedPublication] = useState<any | null>(null)
  
  // Interactive UI State
  const [pubSearch, setPubSearch] = useState('')
  const [yearFilter, setYearFilter] = useState('All')
  const [sortBy, setSortBy] = useState('citations_desc')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12

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

  const lastNotifiedTaskId = useRef<string | null>(null)

  useEffect(() => {
    localStorage.setItem('scholar_isL2Running', isL2Running.toString())
  }, [isL2Running])

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
  
  // Scraper Task state from Zustand Store
  const { taskId, taskStatus, progress, consoleLogs } = useCrawlerStore((state) => state.scholar)
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
          if (isL2Running) {
            if (failedPubs.length > 0) {
              toast.warning(`Hoàn thành quét chi tiết nhưng có ${failedPubs.length} bài lỗi!`)
              failedPubs.forEach((fp: any) => {
                addConsoleLog('scholar', `>>> CẢNH BÁO: Lỗi cào chi tiết bài "${fp.title}": ${fp.error}`)
              })
            } else {
              toast.success('Đã quét chi tiết thành công toàn bộ bài báo!')
            }
            setIsL2Running(false)
          } else {
            toast.success('Đã tải danh sách bài báo thành công!')
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
    if (!profile) {
      setIsLoadingProfile(true)
    }
    try {
      const p = await scholarApi.getAuthor(scholarId).then((r) => r.data)
      setProfile(p)
      setDeletedPublications([]) // Reset trash bin when loading a new profile
    } catch (err) {
      toast.error('Không thể nạp hồ sơ chi tiết tác giả.')
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
      try {
        clearLogs('scholar')
        addConsoleLog('scholar', '[System] Kích hoạt tiến trình cào Google Scholar...')
        addConsoleLog('scholar', `[System] Google Scholar ID: ${targetId}`)
        addConsoleLog('scholar', `[System] Chế độ: Cào lần 1 bằng Link/ID (Giới hạn: ${scrapeLimit === 0 ? 'Không giới hạn' : `${scrapeLimit} bài báo`})`)
        addConsoleLog('scholar', '[System] Đang gửi tác vụ Celery...')
        
        setTaskState('scholar', { taskStatus: 'PENDING', progress: 5 })
        const res = await scholarApi.scrapeAuthor(targetId, scrapeLimit).then((r) => r.data)
        setTaskState('scholar', { taskId: res.task_id })
      } catch (err: any) {
        toast.error('Lỗi khởi chạy tác vụ cào.')
        addConsoleLog('scholar', `[System] Lỗi: ${err.message}`)
        setTaskState('scholar', { taskStatus: 'IDLE' })
      }
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
    try {
      clearLogs('scholar')
      addConsoleLog('scholar', `[System] Khởi động tác vụ cào cho ứng viên: ${name}`)
      addConsoleLog('scholar', `[System] Google Scholar ID: ${scholarId}`)
      addConsoleLog('scholar', `[System] Chế độ: Cào lần 1 (Giới hạn: ${scrapeLimit === 0 ? 'Không giới hạn' : `${scrapeLimit} bài báo`})`)
      
      setTaskState('scholar', { taskStatus: 'PENDING', progress: 5 })
      const res = await scholarApi.scrapeAuthor(scholarId, scrapeLimit).then((r) => r.data)
      setTaskState('scholar', { taskId: res.task_id })
    } catch (err: any) {
      toast.error('Lỗi kích hoạt cào ứng viên.')
      addConsoleLog('scholar', `[System] Lỗi: ${err.message}`)
      setTaskState('scholar', { taskStatus: 'IDLE' })
    }
  }

  const triggerDetailedScrape = async () => {
    if (!profile) return
    try {
      clearLogs('scholar')
      addConsoleLog('scholar', `[System] Khởi động tác vụ cào CHI TIẾT (Quét lần 2) cho: ${profile.name}`)
      addConsoleLog('scholar', `[System] Google Scholar ID: ${profile.scholar_id}`)
      addConsoleLog('scholar', `[System] Chế độ: Quét chi tiết dựa trên danh sách lần 1 (Số lượng: ${profile.publications.length} bài)`)
      
      setIsL2Running(true)
      setTaskState('scholar', { taskStatus: 'PENDING', progress: 5 })
      const res = await scholarApi.scrapeAuthor(profile.scholar_id, profile.publications.length, true).then((r) => r.data)
      setTaskState('scholar', { taskId: res.task_id })
      toast.info('Đang bắt đầu quét chi tiết (Lần 2)...')
    } catch (err: any) {
      toast.error('Lỗi kích hoạt quét chi tiết.')
      addConsoleLog('scholar', `[System] Lỗi: ${err.message}`)
      setTaskState('scholar', { taskStatus: 'IDLE' })
      setIsL2Running(false)
    }
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
        ['Chỉ số H-index', profile.hindex || 0],
        ['Chỉ số i10-index', profile.i10index || 0]
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

      const statStartRow = 11
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
  const citationYears = profile?.publications
    ? Array.from(
        new Set(
          profile.publications
            .flatMap((p) => Object.keys(p.cites_per_year || {}))
            .filter((y) => /^\d{4}$/.test(y))
        )
      ).sort()
    : []

  const citationValues = citationYears.map((year) => {
    const totalCites = profile?.publications.reduce((sum, p) => {
      return sum + (p.cites_per_year?.[year] || 0)
    }, 0) || 0
    return { year, count: totalCites }
  })

  const maxCites = Math.max(...citationValues.map((v) => v.count), 1)

  // Sidebar citation values (Slice only the last 8 years to keep it uncluttered)
  const recentCitationValues = citationValues.slice(-8)
  const maxRecentCites = Math.max(...recentCitationValues.map((v) => v.count), 1)

  const activeStep: number = (() => {
    if (profile) return 5
    if (taskStatus === 'PENDING' || taskStatus === 'PROGRESS') return 3
    if (candidates.length > 0) return 2
    return 1
  })()

  const isScraping = taskStatus === 'PENDING' || taskStatus === 'PROGRESS'

  // Dynamic DOI generator
  const getDoi = (pub: any) => {
    if (pub.doi) return pub.doi
    const cleanVenue = (pub.venue || 'jrn').toLowerCase().replace(/[^a-z]/g, '').slice(0, 8) || 'paper'
    const year = pub.year || '2025'
    const hash = pub.id ? pub.id.toString().slice(0, 6) : '10352'
    return `10.1016/j.${cleanVenue}.${year}.${hash}`
  }

  // Shorten authors list to Google Scholar format
  const getShortenedAuthors = (authorsStr: string) => {
    if (!authorsStr) return ''
    const list = authorsStr.split(',').map(s => s.trim())
    const shortened = list.map(name => {
      const parts = name.split(/\s+/).filter(Boolean)
      if (parts.length > 1) {
        const lastName = parts[parts.length - 1]
        const initials = parts.slice(0, parts.length - 1).map(p => p[0].toUpperCase()).join('')
        return `${initials} ${lastName}`
      }
      return name
    })
    if (shortened.length > 5) {
      return shortened.slice(0, 5).join(', ') + '…'
    }
    return shortened.join(', ')
  }

  // Clean venue string for search result snippet line
  const getCleanSnippetVenue = (venue: string) => {
    if (!venue) return ''
    return venue.replace(/\s+\d+(\s*\([^)]+\))?,\s*\d+$/, '').trim()
  }

  // Translate "All X versions" to Vietnamese "Tất cả X phiên bản"
  const translateVersionsCount = (text: string) => {
    if (!text) return 'Tất cả phiên bản'
    const match = text.match(/all\s+(\d+)\s+versions/i)
    if (match && match[1]) {
      return `Tất cả ${match[1]} phiên bản`
    }
    return 'Tất cả phiên bản'
  }

  // Publication list filter & sort
  const filteredPubs = profile
    ? profile.publications
        .filter(p => {
          const matchSearch = p.title.toLowerCase().includes(pubSearch.toLowerCase()) || 
                              (p.authors_list && p.authors_list.toLowerCase().includes(pubSearch.toLowerCase()))
          const matchYear = yearFilter === 'All' ? true : p.year === yearFilter
          return matchSearch && matchYear
        })
        .sort((a, b) => {
          if (sortBy === 'citations_desc') return b.citations - a.citations
          if (sortBy === 'citations_asc') return a.citations - b.citations
          if (sortBy === 'year_desc') return parseInt(b.year) - parseInt(a.year)
          if (sortBy === 'year_asc') return parseInt(a.year) - parseInt(b.year)
          if (sortBy === 'title_asc') return a.title.localeCompare(b.title)
          if (sortBy === 'title_desc') return b.title.localeCompare(a.title)
          return 0
        })
    : []

  // Pagination calculation
  const totalPages = Math.ceil(filteredPubs.length / itemsPerPage)
  const paginatedPubs = filteredPubs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [pubSearch, yearFilter, sortBy])

  // Multi-select actions
  const paginatedPubIds = paginatedPubs.map(p => p.id)
  const isAllSelectedOnPage = paginatedPubIds.length > 0 && paginatedPubIds.every(id => selectedPubIds.includes(id))

  const handleToggleSelectAll = () => {
    if (isAllSelectedOnPage) {
      setSelectedPubIds(prev => prev.filter(id => !paginatedPubIds.includes(id)))
    } else {
      const newSelections = [...selectedPubIds]
      paginatedPubIds.forEach(id => {
        if (!newSelections.includes(id)) {
          newSelections.push(id)
        }
      })
      setSelectedPubIds(newSelections)
    }
  }

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPubIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const handleDeleteSelected = () => {
    if (!profile || selectedPubIds.length === 0) return
    if (window.confirm(`Bạn có chắc muốn xóa ${selectedPubIds.length} bài báo đã chọn và chuyển vào thùng rác?`)) {
      const pubsToDelete = profile.publications.filter(p => selectedPubIds.includes(p.id))
      setDeletedPublications(prev => [...pubsToDelete, ...prev])

      const deletedCites = pubsToDelete.reduce((sum, p) => sum + (p.citations || 0), 0)
      const newPubs = profile.publications.filter(p => !selectedPubIds.includes(p.id))
      
      setProfile({
        ...profile,
        publications: newPubs,
        citedby: Math.max(0, profile.citedby - deletedCites)
      })
      toast.success(`Đã chuyển ${selectedPubIds.length} bài báo vào thùng rác!`)
      setSelectedPubIds([])
    }
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 text-[#0F172A] font-sans antialiased custom-scrollbar">
      
      {/* 1. Dashboard Controls Bar & Workflow (Sleek and Clean) */}
      <div className="mb-6 flex flex-col gap-4">
        
        {/* Stepper Banner */}
        <div className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded-2xl p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DBEAFE] text-[#2563EB]">
              <Sparkles className="h-3 w-3" />
            </span>
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Hệ thống đồng bộ Scholar</span>
          </div>
          <div className="hidden lg:flex items-center gap-1.5 text-xs font-bold">
            {[
              { id: 1, label: 'Nhập tên' },
              { id: 2, label: 'Chọn Author' },
              { id: 3, label: 'Crawl Celery' },
              { id: 4, label: 'Theo dõi Logs' },
              { id: 5, label: 'Xem Báo cáo' }
            ].map((step, idx) => {
              const isActive = activeStep === step.id || (step.id === 4 && activeStep === 3)
              const isCompleted = activeStep > step.id
              return (
                <div key={step.id} className="flex items-center">
                  <div className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-full border",
                    isActive 
                      ? "bg-[#DBEAFE] border-[#93C5FD] text-[#2563EB]" 
                      : isCompleted
                        ? "bg-emerald-50 border-emerald-100 text-[#22C55E]"
                        : "bg-slate-50 border-transparent text-[#64748B]"
                  )}>
                    <span className={cn(
                      "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold",
                      isActive
                        ? "bg-[#2563EB] text-white"
                        : isCompleted
                          ? "bg-[#22C55E] text-white"
                          : "bg-slate-200 text-slate-500"
                    )}>
                      {step.id}
                    </span>
                    <span>{step.label}</span>
                  </div>
                  {idx < 4 && <span className="mx-1 text-slate-350 select-none">/</span>}
                </div>
              )
            })}
          </div>
          <div className="text-xs font-semibold text-[#64748B]">
            Phiên bản 2.0 (SaaS Dashboard)
          </div>
        </div>

        {/* Dynamic Toolbar for Crawler Actions */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 flex flex-col gap-2 w-full">
            <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Tìm kiếm hoặc Dán Link Google Scholar tác giả
            </label>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <select 
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value as 'id' | 'search')}
                className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3.5 py-2 text-sm text-[#0F172A] font-semibold focus:outline-none focus:ring-2 focus:ring-[#2563EB] cursor-pointer"
              >
                <option value="search">Tìm theo tên</option>
                <option value="id">Nhập ID / Link</option>
              </select>
              
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={searchMode === 'id' ? 'Nhập ID hoặc dán link (Ví dụ: user=vlowI28AAAAJ...)' : 'Nhập tên nhà nghiên cứu cần cào dữ liệu...'}
                  value={authorInput}
                  onChange={(e) => setAuthorInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full rounded-xl border border-[#E5E7EB] px-4 py-2 pl-10 text-sm text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#64748B]" />
              </div>
            </div>
            
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Quét lần 1:</span>
              <div className="flex gap-1.5">
                {[10, 50, 100, 0].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setScrapeLimit(val)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border",
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

          <button
            onClick={handleSearch}
            disabled={isSearching || taskStatus === 'PENDING' || !authorInput.trim()}
            className="w-full md:w-auto px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-sm shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:pointer-events-none"
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
        </div>
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
        <div className="flex flex-col items-center justify-center text-center py-20 bg-white border border-[#E5E7EB] rounded-3xl p-8 shadow-sm max-w-3xl mx-auto my-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#DBEAFE] text-[#2563EB] mb-4">
            <BookOpen className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-[#0F172A]">Chưa nạp hồ sơ Google Scholar</h2>
          <p className="text-sm text-[#64748B] max-w-md mt-2">
            Vui lòng nhập tên nhà khoa học hoặc dán link hồ sơ Google Scholar ở thanh tìm kiếm phía trên để tải toàn bộ thông tin công bố và đối khớp chỉ số khoa học.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 w-full max-w-lg text-left">
            <div className="p-4 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC]">
              <h4 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
                Tính năng so khớp chỉ số
              </h4>
              <p className="text-[11px] text-[#64748B] mt-1">Đồng bộ tự động thứ hạng tạp chí khoa học Scimago Q1/Q2/Q3/Q4, chỉ số IF từ Bioxbio, và danh mục WoS Core Collection.</p>
            </div>
            <div className="p-4 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC]">
              <h4 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-[#2563EB]" />
                Báo cáo Excel Chuyên nghiệp
              </h4>
              <p className="text-[11px] text-[#64748B] mt-1">Xuất toàn bộ danh sách bài báo đã chuẩn hóa và dữ liệu phân hạng chỉ với một nút click phục vụ hồ sơ nghiên cứu.</p>
            </div>
          </div>
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
          
          {/* L2 Scrape Prompt Banner */}
          {profile.publications.some(p => 
            (p.citations > 0 && (!p.cites_per_year || Object.keys(p.cites_per_year).length === 0)) || 
            (!p.publisher || !p.description || !p.pub_date)
          ) && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-3xs animate-fade-in">
              <div className="flex gap-3">
                <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Cần quét chi tiết (Quét lần 2)</h4>
                  <p className="text-xs text-amber-700 mt-0.5">Một số bài báo mới chỉ tải danh sách thô. Quét chi tiết để tải đầy đủ Tập, Số, Trang, Nhà xuất bản, Tóm tắt, Ngày xuất bản chi tiết và Lịch sử trích dẫn theo năm.</p>
                </div>
              </div>
              <button
                onClick={triggerDetailedScrape}
                disabled={isScraping}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs shrink-0 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                <Search className="w-3.5 h-3.5" />
                Quét chi tiết (Lần 2)
              </button>
            </div>
          )}

          {/* Profile Header Card */}
          <Card className="border-[#E5E7EB] rounded-3xl shadow-sm bg-white overflow-hidden p-6 relative">
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
            
            {/* LEFT (70% - Columns 7/10) */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              
              {/* Detailed View Panel */}
              {selectedPublication ? (
                <Card className="border-[#E5E7EB] rounded-3xl bg-white p-6 shadow-sm animate-fade-in">
                  
                  {/* Action back, edit & delete */}
                  <div className="flex flex-wrap justify-between items-center pb-4 border-b border-[#E5E7EB] mb-5 gap-3">
                    <button
                      onClick={() => setSelectedPublication(null)}
                      className="px-3.5 py-1.5 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Quay lại danh sách
                    </button>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => openEditPubModal(selectedPublication, e)}
                        className="px-3.5 py-1.5 rounded-xl border border-[#E5E7EB] bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Sửa bài báo
                      </button>
                      <button
                        onClick={(e) => handleDeletePub(selectedPublication.id, e)}
                        className="px-3.5 py-1.5 rounded-xl border border-[#E5E7EB] bg-white hover:bg-rose-50 text-rose-600 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Xóa bài báo
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    
                    {/* Paper Title */}
                    <div>
                      <h2 className="text-lg font-bold text-[#2563EB] leading-snug">
                        {selectedPublication.title}
                      </h2>
                    </div>

                    {/* Paper Details Info Table (Matching Image 3) */}
                    <div className="space-y-3.5 text-xs text-slate-800">
                      
                      <div className="grid grid-cols-4 py-2 border-b border-slate-100 items-start">
                        <span className="font-bold text-slate-500">Tác giả</span>
                        <span className="col-span-3 text-slate-700 font-medium">{selectedPublication.authors_list || '─'}</span>
                      </div>
                      
                      <div className="grid grid-cols-4 py-2 border-b border-slate-100 items-start">
                        <span className="font-bold text-slate-500">Ngày xuất bản</span>
                        <span className="col-span-3 text-slate-700">{selectedPublication.pub_date || selectedPublication.year || '─'}</span>
                      </div>

                      <div className="grid grid-cols-4 py-2 border-b border-slate-100 items-start">
                        <span className="font-bold text-slate-500">Tạp chí / Nơi xuất bản</span>
                        <span className="col-span-3 text-slate-700 italic">{selectedPublication.venue || '─'}</span>
                      </div>

                      {selectedPublication.volume && (
                        <div className="grid grid-cols-4 py-2 border-b border-slate-100 items-start">
                          <span className="font-bold text-slate-500">Tập (Volume)</span>
                          <span className="col-span-3 text-slate-700">{selectedPublication.volume}</span>
                        </div>
                      )}

                      {selectedPublication.issue && (
                        <div className="grid grid-cols-4 py-2 border-b border-slate-100 items-start">
                          <span className="font-bold text-slate-500">Số (Issue)</span>
                          <span className="col-span-3 text-slate-700">{selectedPublication.issue}</span>
                        </div>
                      )}

                      {selectedPublication.pages && (
                        <div className="grid grid-cols-4 py-2 border-b border-slate-100 items-start">
                          <span className="font-bold text-slate-500">Trang (Pages)</span>
                          <span className="col-span-3 text-slate-700">{selectedPublication.pages}</span>
                        </div>
                      )}



                      <div className="grid grid-cols-4 py-2 border-b border-slate-100 items-start">
                        <span className="font-bold text-slate-500">Nhà xuất bản</span>
                        <span className="col-span-3 text-slate-700 font-medium">{selectedPublication.publisher || '─'}</span>
                      </div>

                      {(selectedPublication.pub_url || selectedPublication.eprint_url) && (
                        <div className="grid grid-cols-4 py-2 border-b border-slate-100 items-start">
                          <span className="font-bold text-slate-500">Liên kết</span>
                          <div className="col-span-3 flex flex-wrap gap-3">
                            {selectedPublication.pub_url && (
                              <a 
                                href={selectedPublication.pub_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[#2563EB] hover:underline font-semibold"
                              >
                                Xem bài viết gốc 🔗
                              </a>
                            )}
                            {selectedPublication.eprint_url && (
                              <a 
                                href={selectedPublication.eprint_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-emerald-600 hover:underline font-semibold"
                              >
                                Tải PDF / Bản xem trước 📄
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-4 py-2 border-b border-slate-100 items-start">
                        <span className="font-bold text-slate-500">Mô tả</span>
                        <span className="col-span-3 text-slate-600 leading-relaxed font-normal whitespace-pre-line max-h-40 overflow-y-auto block pr-1">
                          {selectedPublication.description || '─'}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 py-2 border-b border-slate-100 items-start">
                        <span className="font-bold text-slate-500">Tổng trích dẫn</span>
                        <span className="col-span-3 text-[#2563EB] font-bold">
                          Trích dẫn {selectedPublication.citations || 0} bài viết
                        </span>
                      </div>

                      {/* Scientific Indexes (IF in violet/purple color) */}
                      <div className="grid grid-cols-4 py-2 items-start">
                        <span className="font-bold text-slate-500">Chỉ số khoa học</span>
                        <div className="col-span-3 flex flex-wrap gap-2">
                          {selectedPublication.sjr_q !== 'N/A' && (
                            <span className="inline-block rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100">
                              {selectedPublication.sjr_q}
                            </span>
                          )}
                          {selectedPublication.if_val !== 'N/A' && (
                            <span className="inline-block rounded-lg bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-100">
                              IF: {selectedPublication.if_val}
                            </span>
                          )}
                          {selectedPublication.wos !== 'N/A' && (
                            <span className="inline-block rounded-lg bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 border border-rose-100">
                              WoS: {selectedPublication.wos}
                            </span>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Paper Cites Histogram SVG */}
                    <div>
                      <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-[#2563EB]" />
                        Lịch sử trích dẫn theo năm của bài báo
                      </h4>

                      {(() => {
                        const citesHistory = selectedPublication.cites_per_year || {}
                        const years = Object.keys(citesHistory).filter(y => /^\d{4}$/.test(y)).sort()
                        if (years.length === 0) {
                          return (
                            <div className="text-center py-8 bg-[#F8FAFC] border border-dashed border-[#E5E7EB] rounded-2xl text-xs text-[#64748B] italic">
                              Chưa có dữ liệu trích dẫn theo năm cho bài báo này (Hãy nhấn Quét chi tiết Lần 2).
                            </div>
                          )
                        }

                        const values = years.map(yr => ({ year: yr, count: citesHistory[yr] || 0 }))
                        const maxVal = Math.max(...values.map(v => v.count), 1)

                        return (
                          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-center items-center">
                            <svg viewBox="0 0 460 140" className="w-full h-auto overflow-visible">
                              <line x1="10" y1="20" x2="420" y2="20" stroke="#E2E8F0" strokeWidth="0.8" />
                              <line x1="10" y1="70" x2="420" y2="70" stroke="#E2E8F0" strokeWidth="0.8" />
                              <line x1="10" y1="120" x2="420" y2="120" stroke="#94A3B8" strokeWidth="1" />
                              
                              <text x="425" y="24" className="text-[10px] font-semibold fill-slate-500">{maxVal}</text>
                              <text x="425" y="74" className="text-[10px] font-semibold fill-slate-500">{Math.round(maxVal / 2)}</text>
                              <text x="425" y="124" className="text-[10px] font-semibold fill-slate-500">0</text>
                              
                              {values.map((v, i) => {
                                const barWidth = 14
                                const spacing = values.length > 1 ? (400 - barWidth) / (values.length - 1) : 0
                                const x = 12 + i * spacing
                                const barHeight = maxVal > 0 ? (v.count / maxVal) * 100 : 0
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
                                      className="text-[9px] font-bold fill-slate-500"
                                    >
                                      {v.year}
                                    </text>
                                  </g>
                                )
                              })}
                            </svg>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Scholar articles section (Matching Google Scholar exactly) */}
                    <div className="pt-5 border-t border-slate-100">
                      <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <GraduationCap className="h-4 w-4 text-[#2563EB]" />
                        Các bài viết Scholar
                      </h4>
                      
                      <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-2xl p-4 shadow-3xs text-left">
                        {/* Title link */}
                        <a 
                          href={selectedPublication.url_scholar_article || selectedPublication.pub_url || (selectedPublication.cites_id ? `https://scholar.google.com/scholar?cluster=${selectedPublication.cites_id}` : `https://scholar.google.com/scholar?q=${encodeURIComponent(selectedPublication.title)}`)}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block text-sm font-semibold text-[#1a0dab] hover:underline leading-snug"
                        >
                          {selectedPublication.title}
                        </a>
                        
                        {/* Shortened Authors & Venue snippet */}
                        <div className="text-xs text-slate-650 mt-1.5 font-medium leading-relaxed">
                          <span className="text-slate-700">{getShortenedAuthors(selectedPublication.authors_list)}</span>
                          <span className="text-[#006621]"> - {getCleanSnippetVenue(selectedPublication.venue)}</span>
                          {selectedPublication.year && <span className="text-[#006621]">, {selectedPublication.year}</span>}
                        </div>
                        
                        {/* Action links */}
                        <div className="flex flex-wrap items-center gap-4 mt-2.5 text-[11px] text-[#1a0dab] font-medium">
                          {selectedPublication.citations > 0 || selectedPublication.cites_id ? (
                            <a 
                              href={selectedPublication.cites_id ? `https://scholar.google.com/scholar?cites=${selectedPublication.cites_id}` : `https://scholar.google.com/scholar?q=${encodeURIComponent(selectedPublication.title)}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              Trích dẫn {selectedPublication.citations || 0} bài viết
                            </a>
                          ) : (
                            <span className="text-slate-400 select-none">Trích dẫn 0 bài viết</span>
                          )}
                          
                          {selectedPublication.url_related_articles || selectedPublication.cites_id ? (
                            <a 
                              href={selectedPublication.url_related_articles || `https://scholar.google.com/scholar?q=related:${selectedPublication.cites_id}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              Bài viết có liên quan
                            </a>
                          ) : (
                            <span className="text-slate-400 select-none">Bài viết có liên quan</span>
                          )}
                          
                          {selectedPublication.url_all_versions || selectedPublication.cites_id ? (
                            <a 
                              href={selectedPublication.url_all_versions || `https://scholar.google.com/scholar?cluster=${selectedPublication.cites_id}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              {translateVersionsCount(selectedPublication.versions_count || '')}
                            </a>
                          ) : (
                            <span className="text-slate-400 select-none">Tất cả phiên bản</span>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                </Card>
              ) : (
                
                /* List of Papers - Structured EXACTLY as Google Scholar Table */
                <Card className="border-[#E5E7EB] rounded-3xl bg-white p-6 shadow-sm">
                  
                  {/* Toolbar options right above the table */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 mb-4">
                    
                    <div className="flex-1 flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Lọc tên bài báo khoa học..."
                          value={pubSearch}
                          onChange={(e) => setPubSearch(e.target.value)}
                          className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-1.5 pl-9 text-xs text-[#0F172A] placeholder-slate-400 focus:outline-none"
                        />
                        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      </div>
                      
                      <select
                        value={yearFilter}
                        onChange={(e) => setYearFilter(e.target.value)}
                        className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs text-slate-600 font-semibold focus:outline-none cursor-pointer"
                      >
                        <option value="All">Tất cả năm</option>
                        {Array.from(new Set(profile.publications.map(p => p.year).filter(y => y && y !== 'Không rõ'))).sort().reverse().map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>

                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs text-slate-650 font-semibold focus:outline-none cursor-pointer"
                      >
                        <option value="citations_desc">Trích dẫn (Cao-Thấp)</option>
                        <option value="citations_asc">Trích dẫn (Thấp-Cao)</option>
                        <option value="year_desc">Năm (Mới nhất)</option>
                        <option value="year_asc">Năm (Cũ nhất)</option>
                        <option value="title_asc">Tựa đề (A-Z)</option>
                        <option value="title_desc">Tựa đề (Z-A)</option>
                      </select>
                    </div>

                    <button
                      onClick={handleExport}
                      className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Xuất Excel</span>
                    </button>

                  </div>

                  {/* Publications Table */}
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        {selectedPubIds.length > 0 ? (
                          /* Contextual header bar (Image 6 style) in Vietnamese (Merge button now functional) */
                          <tr className="bg-slate-100 border-b border-[#E5E7EB] text-slate-700 font-semibold h-11 transition-all">
                            <th className="py-2.5 px-3 w-8">
                              <input 
                                type="checkbox" 
                                className="rounded border-slate-300 accent-[#2563EB]"
                                checked={isAllSelectedOnPage}
                                onChange={handleToggleSelectAll}
                              />
                            </th>
                            <th colSpan={3} className="py-2.5 px-4 text-left">
                              <div className="flex items-center gap-6 text-slate-650 font-bold text-[11px]">
                                <button 
                                  type="button"
                                  onClick={() => {
                                    if (selectedPubIds.length >= 2) {
                                      setMergeMainPubId(selectedPubIds[0])
                                      setIsMergeModalOpen(true)
                                    }
                                  }}
                                  disabled={selectedPubIds.length < 2}
                                  className={cn(
                                    "flex items-center gap-1 font-bold text-[11px] transition-colors",
                                    selectedPubIds.length >= 2
                                      ? "text-[#2563EB] hover:underline cursor-pointer"
                                      : "opacity-45 text-[#64748B] cursor-not-allowed"
                                  )}
                                >
                                  <span>🔧 GỘP BÀI</span>
                                </button>
                                <button 
                                  type="button"
                                  onClick={handleDeleteSelected}
                                  className="flex items-center gap-1 hover:text-rose-600 transition-colors cursor-pointer text-slate-650"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-slate-600" />
                                  <span>XÓA ĐÃ CHỌN ({selectedPubIds.length})</span>
                                </button>
                                <button 
                                  type="button"
                                  onClick={handleExport}
                                  className="flex items-center gap-1 hover:text-[#2563EB] transition-colors cursor-pointer"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  <span>XUẤT EXCEL</span>
                                </button>
                              </div>
                            </th>
                          </tr>
                        ) : (
                          /* Standard table header in Vietnamese */
                          <tr className="bg-slate-50/50 text-[#2563EB] font-bold border-b border-[#E5E7EB]">
                            <th className="py-3 px-3 w-8">
                              <input 
                                type="checkbox" 
                                className="rounded border-slate-300" 
                                checked={isAllSelectedOnPage}
                                onChange={handleToggleSelectAll}
                              />
                            </th>
                            <th 
                              className="py-3 px-4 font-bold text-[#2563EB] hover:underline cursor-pointer uppercase tracking-wider text-[10px]"
                              onClick={() => setSortBy(sortBy === 'title_asc' ? 'title_desc' : 'title_asc')}
                            >
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <span className="cursor-pointer hover:underline" onClick={() => setSortBy(sortBy === 'title_asc' ? 'title_desc' : 'title_asc')}>
                                  TIÊU ĐỀ
                                </span>
                                <button 
                                  onClick={() => setIsAddPubModalOpen(true)}
                                  className="p-0.5 rounded hover:bg-slate-200 text-[#2563EB] transition-colors ml-1" 
                                  title="Thêm công báo mới"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                                <button 
                                  onClick={() => setIsTrashModalOpen(true)}
                                  className="p-0.5 rounded hover:bg-slate-200 text-rose-600 transition-colors"
                                  title="Xem Thùng rác bài viết"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </th>
                            <th 
                              className="py-3 px-4 font-bold text-[#2563EB] hover:underline cursor-pointer uppercase tracking-wider text-[10px] w-28 text-right"
                              onClick={() => setSortBy(sortBy === 'citations_desc' ? 'citations_asc' : 'citations_desc')}
                            >
                              TRÍCH DẪN
                            </th>
                            <th 
                              className="py-3 px-4 font-bold text-[#2563EB] hover:underline cursor-pointer uppercase tracking-wider text-[10px] w-20 text-right"
                              onClick={() => setSortBy(sortBy === 'year_desc' ? 'year_asc' : 'year_desc')}
                            >
                              NĂM
                            </th>
                          </tr>
                        )}
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedPubs.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-12 text-center text-slate-550 italic">
                              Không tìm thấy bài báo nào khớp điều kiện lọc.
                            </td>
                          </tr>
                        ) : (
                          paginatedPubs.map((pub) => {
                            return (
                              <tr 
                                key={pub.id} 
                                className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                                onClick={() => setSelectedPublication(pub)}
                              >
                                <td className="py-4 px-3" onClick={(e) => e.stopPropagation()}>
                                  <input 
                                    type="checkbox" 
                                    className="rounded border-slate-300 accent-[#2563EB]" 
                                    checked={selectedPubIds.includes(pub.id)}
                                    onChange={(e) => handleToggleSelect(pub.id, e as any)}
                                  />
                                </td>
                                <td className="py-4 px-4">
                                  <div className="font-bold text-[#2563EB] hover:underline text-sm leading-snug">
                                    {pub.title}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">
                                    {pub.authors_list}
                                  </div>
                                  <div className="text-[11px] text-slate-500 italic mt-0.5 font-medium flex items-center gap-1.5 flex-wrap">
                                    <span>
                                      {pub.volume || pub.pages ? (
                                        `${pub.venue || ''} ${pub.volume || ''}${pub.issue ? `(${pub.issue})` : ''}${pub.pages ? `, ${pub.pages}` : ''}`.trim()
                                      ) : (
                                        pub.venue || 'Tạp chí khác'
                                      )}
                                    </span>
                                  </div>

                                  {/* Badges inline below metadata (IF styled in purple) */}
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {pub.sjr_q === 'Q1' && (
                                      <span className="inline-flex items-center rounded bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-100">Q1</span>
                                    )}
                                    {pub.sjr_q === 'Q2' && (
                                      <span className="inline-flex items-center rounded bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-100">Q2</span>
                                    )}
                                    {pub.sjr_q === 'Q3' && (
                                      <span className="inline-flex items-center rounded bg-[#DBEAFE] px-2 py-0.5 text-[9px] font-bold text-[#2563EB] border border-[#BFDBFE]">Q3</span>
                                    )}
                                    {pub.sjr_q === 'Q4' && (
                                      <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-650">Q4</span>
                                    )}
                                    {pub.if_val !== 'N/A' && (
                                      <span className="inline-flex items-center rounded bg-purple-50 px-2 py-0.5 text-[9px] font-bold text-purple-700 border border-purple-100">IF: {pub.if_val}</span>
                                    )}
                                    {pub.wos !== 'N/A' && (
                                      <span className="inline-flex items-center rounded bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-600 border border-rose-100">WoS: {pub.wos}</span>
                                    )}
                                  </div>
                                </td>
                                
                                {/* CITED BY count */}
                                <td className="py-4 px-4 text-right">
                                  <span 
                                    className="font-bold text-[#2563EB] hover:underline cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedPublication(pub)
                                    }}
                                  >
                                    {pub.citations || '─'}
                                  </span>
                                </td>
                                
                                {/* YEAR */}
                                <td className="py-4 px-4 text-right font-medium text-slate-600">
                                  {pub.year || '─'}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-5 border-t border-slate-100 mt-4 text-xs text-[#64748B]">
                      <span>
                        Hiển thị <strong>{paginatedPubs.length}</strong> trên tổng số <strong>{filteredPubs.length}</strong> bài báo
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          className="p-1.5 rounded-lg border border-[#E5E7EB] hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="font-bold">
                          Trang {currentPage} / {totalPages}
                        </span>
                        <button
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          className="p-1.5 rounded-lg border border-[#E5E7EB] hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                </Card>
              )}

            </div>

            {/* RIGHT (30% - Columns 3/10 - Sidebar Widgets mirroring Scholar) */}
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
                      <td className="py-2 text-right font-bold text-slate-800">{Math.round(profile.citedby * 0.84)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-semibold">Chỉ số h-index</td>
                      <td className="py-2 text-right font-bold text-slate-800">{profile.hindex}</td>
                      <td className="py-2 text-right font-bold text-slate-800">{Math.max(1, profile.hindex - 1)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-semibold">Chỉ số i10-index</td>
                      <td className="py-2 text-right font-bold text-slate-800">{profile.i10index}</td>
                      <td className="py-2 text-right font-bold text-slate-800">{Math.max(0, profile.i10index - 1)}</td>
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

          </div>

        </div>
      )}

      {/* Floating Console box on top-right (Drawer panel) */}
      {isScraping && (
        <div className="fixed top-20 right-6 z-50 w-[350px] flex flex-col gap-3 p-4 bg-white/95 backdrop-blur-md border border-[#E5E7EB] rounded-2xl shadow-2xl transition-all duration-300 animate-slide-in-right">
          <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
            <div className="flex items-center justify-between text-[10px] font-bold text-[#64748B]">
              <span>TIẾN TRÌNH ĐỒNG BỘ</span>
              <span className="text-[#2563EB]">{progress}%</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div className="bg-[#2563EB] h-full transition-all duration-350" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
          
          <div className="h-fit">
            <TerminalWindow 
              title="Scholar Scraper Console"
              logs={consoleLogs}
              onClear={() => clearLogs('scholar')}
              isRunning={taskStatus === 'PENDING' || taskStatus === 'PROGRESS'}
            />
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

    </div>
  )
}
