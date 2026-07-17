import { useState, useEffect } from 'react'
import { scholarApi } from '@/api/endpoints/scholar'
import type { AuthorCandidate, AuthorProfileDetail } from '@/api/endpoints/scholar'
import { Card, CardContent } from '@/components/ui/card'
import { TerminalWindow } from '@/components/ui/TerminalWindow'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useCrawlerStore } from '@/stores/crawler.store'
import { 
  Search, 
  User, 
  TrendingUp, 
  Download, 
  FileText,
  HelpCircle,
  ArrowLeft
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
    if (profile) {
      localStorage.setItem('scholar_profile', JSON.stringify(profile))
    } else {
      localStorage.removeItem('scholar_profile')
    }
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
          
          // Reset selected publication
          setSelectedPublication(null)
          // Load the newly saved profile
          loadProfile(res.result?.author?.scholar_id)
        } else if (res.status === 'FAILURE') {
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
    } catch (err) {
      toast.error('Không thể nạp hồ sơ chi tiết tác giả.')
    } finally {
      setIsLoadingProfile(false)
    }
  }

  // Helper to parse input: extracts user ID from a Google Scholar URL if present
  const parseScholarInput = (input: string): { id: string; isId: boolean } => {
    const trimmed = input.trim()
    
    // Check if it's a Google Scholar profile URL
    if (trimmed.includes('citations') || trimmed.includes('user=')) {
      try {
        // Try parsing URL query params
        const urlPart = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
        const urlObj = new URL(urlPart)
        const userParam = urlObj.searchParams.get('user')
        if (userParam) {
          return { id: userParam, isId: true }
        }
      } catch (e) {
        // Regex fallback
        const match = trimmed.match(/user=([^&]+)/)
        if (match && match[1]) {
          return { id: match[1], isId: true }
        }
      }
    }
    
    // Check if it is a 12-char Scholar ID
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
      // If we parsed an ID from the link/input, force direct scrape
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
      // Search by Name
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

  // Export report to CSV
  const handleExport = () => {
    if (!profile || profile.publications.length === 0) {
      toast.error('Không có dữ liệu bài báo để xuất báo cáo!')
      return
    }
    
    const headers = ['STT', 'Tên bài báo', 'Tác giả', 'Nơi xuất bản (Venue)', 'Năm', 'Trích dẫn', 'SJR Q', 'Impact Factor', 'Web of Science']
    
    const rows = profile.publications.map((pub, idx) => [
      idx + 1,
      `"${pub.title.replace(/"/g, '""')}"`,
      `"${pub.authors_list.replace(/"/g, '""')}"`,
      `"${pub.venue.replace(/"/g, '""')}"`,
      pub.year,
      pub.citations,
      pub.sjr_q,
      pub.if_val,
      pub.wos
    ])
    
    // Add UTF-8 BOM so Excel opens Vietnamese characters correctly
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `Scholar_Profile_${profile.name.replace(/\s+/g, '_')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Xuất file báo cáo (CSV) thành công!')
  }

  // Calculate Citation Histogram heights
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

  // Dynamically determine current active step in the workflow
  const activeStep: number = (() => {
    if (profile) return 5 // Step 5 is reading table, Step 6 (Export) is also ready
    if (taskStatus === 'PENDING' || taskStatus === 'PROGRESS') return 3 // Step 3 Crawl & Step 4 Console active
    if (candidates.length > 0) return 2 // Step 2 Select author candidate
    return 1 // Step 1 Input name
  })()

  const isScraping = taskStatus === 'PENDING' || taskStatus === 'PROGRESS'

  return (
    <div className="flex flex-col gap-4">
      {/* Interactive Visual Workflow Stepper - Guides the user clearly */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-[#005b9a]" />
          QUY TRÌNH THỰC HIỆN CÔNG CỤ
        </h3>
        <div className="grid gap-2 grid-cols-2 md:grid-cols-6 lg:grid-cols-6 items-center">
          {[
            { id: 1, label: '1. Nhập tên', desc: 'Tìm trên Scholar' },
            { id: 2, label: '2. Chọn Author', desc: 'Lọc ứng viên phù hợp' },
            { id: 3, label: '3. Crawl dữ liệu', desc: 'Celery cào thông tin' },
            { id: 4, label: '4. Theo dõi Console', desc: 'Giám sát logs chạy' },
            { id: 5, label: '5. Xem Table', desc: 'Đọc bảng đối khớp' },
            { id: 6, label: '6. Xuất báo cáo', desc: 'Tải file Excel/CSV' }
          ].map((step, idx) => {
            const isActive = activeStep === step.id || (step.id === 4 && activeStep === 3) || (step.id === 6 && activeStep === 5)
            const isCompleted = activeStep > step.id && !(step.id === 3 && activeStep === 4) && !(step.id === 5 && activeStep === 6)
            
            return (
              <div key={step.id} className="flex items-center w-full">
                <div className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border w-full transition-all duration-300",
                  isActive 
                    ? "bg-[#e6f0f7] border-[#b8d4e9] text-[#005b9a] shadow-3xs" 
                    : isCompleted
                      ? "bg-emerald-50/40 border-emerald-100 text-emerald-600"
                      : "bg-slate-50/50 border-slate-200 text-slate-400"
                )}>
                  <span className={cn(
                    "w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0",
                    isActive
                      ? "bg-[#005b9a] text-white"
                      : isCompleted
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-200 text-slate-500"
                  )}>
                    {step.id}
                  </span>
                  <div className="leading-tight text-left">
                    <div className="text-[11px] font-bold">{step.label}</div>
                    <div className="text-[9px] opacity-75 font-semibold mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{step.desc}</div>
                  </div>
                </div>
                
                {idx < 5 && (
                  <span className="hidden lg:block mx-1 text-slate-300 font-bold select-none shrink-0">→</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Main split grid: Scraper logic on left, Scrape console only on right (when running) */}
      <div className="relative flex flex-col gap-6 w-full">
        {/* Left Side: Control card, Candidates block, and profile details */}
        <div className="flex flex-col gap-6 w-full">
          {/* Control Card */}
          <Card className="border-slate-100 shadow-sm bg-white">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Nhập Tên, ID hoặc Dán Link Google Scholar tác giả
                  </label>
                  
                  <div className="flex gap-2">
                    <select 
                      value={searchMode}
                      onChange={(e) => setSearchMode(e.target.value as 'id' | 'search')}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#005b9a] cursor-pointer"
                    >
                      <option value="search">Tìm theo tên</option>
                      <option value="id">Nhập ID / Link hồ sơ</option>
                    </select>
                    
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder={searchMode === 'id' ? 'Nhập ID hoặc dán link hồ sơ (Ví dụ: https://scholar.google.com/citations?user=z8H-N7gAAAAJ...)' : 'Nhập tên tác giả hoặc dán link hồ sơ Google Scholar trực tiếp'}
                        value={authorInput}
                        onChange={(e) => setAuthorInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="w-full rounded-lg border border-slate-200 px-4 py-2 pl-10 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#005b9a]"
                      />
                      <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                  
                  {/* Scrape Limit options for First Run */}
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Giới hạn quét lần 1:</span>
                    <div className="flex gap-2">
                      {[10, 50, 100, 0].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setScrapeLimit(val)}
                          className={cn(
                            "px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border",
                            scrapeLimit === val
                              ? "bg-[#005b9a] border-[#005b9a] text-white shadow-3xs"
                              : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
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
                  className="px-6 py-2 rounded-lg bg-[#005b9a] hover:bg-[#004677] text-white font-bold text-sm shadow-xs flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50 disabled:pointer-events-none mb-0.5"
                >
                  {isSearching ? (
                    <>
                      <Spinner className="h-4 w-4" />
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
            </CardContent>
          </Card>

          {/* Candidates Box */}
          {(isSearching || candidates.length > 0) && (
            <div className="flex flex-col gap-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ứng viên tìm thấy</h2>
              
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {isSearching ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-10 text-slate-400 bg-white border border-slate-100 rounded-xl">
                    <Spinner className="h-6 w-6 text-[#005b9a] mb-2" />
                    <span className="text-xs">Đang quét Google Scholar...</span>
                  </div>
                ) : (
                  candidates.map((c) => (
                    <div key={c.scholar_id} className="p-4 rounded-xl border border-slate-100 bg-white shadow-xs flex flex-col gap-3 hover:border-[#b8d4e9] transition-colors justify-between">
                      <div className="space-y-2">
                        <div className="flex gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e6f0f7] text-[#005b9a] font-bold text-sm">
                            {c.name.charAt(0)}
                          </div>
                          <div className="leading-tight">
                            <div className="text-xs font-bold text-slate-800">{c.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{c.scholar_id}</div>
                          </div>
                        </div>
                        
                        {c.affiliation && (
                          <div className="text-[11px] text-slate-500 italic line-clamp-2">
                            {c.affiliation}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1">
                          {c.interests.slice(0, 2).map((int, i) => (
                            <span key={i} className="text-[9px] font-bold bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
                              {int}
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => triggerCandidateScrape(c.scholar_id, c.name)}
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 bg-[#e6f0f7] hover:bg-[#d5e5f2] text-[#005b9a] font-bold text-xs cursor-pointer transition-colors mt-2"
                      >
                        <Download className="h-3 w-3" />
                        <span>Lấy dữ liệu & So khớp</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Author Scrape Result */}
          {isLoadingProfile ? (
            <div className="flex justify-center py-20 bg-white border border-slate-100 rounded-2xl">
              <Spinner className="h-8 w-8 text-[#005b9a]" />
            </div>
          ) : profile ? (
            <div className="flex flex-col gap-6">
              {/* Detailed Scan Alert Banner */}
              {profile.publications.some(p => p.citations > 0 && (!p.cites_per_year || Object.keys(p.cites_per_year).length === 0)) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-3xs animate-fade-in">
                  <div className="flex gap-3">
                    <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wide">Danh sách thô đã tải (Quét lần 1)</h4>
                      <p className="text-xs text-amber-700 mt-1">Hệ thống đã tải danh sách {profile.publications.length} bài báo. Hãy nhấn <strong>Quét chi tiết</strong> để tải đầy đủ tên tác giả và các năm trích dẫn cho các bài báo này.</p>
                    </div>
                  </div>
                  <button
                    onClick={triggerDetailedScrape}
                    disabled={isScraping}
                    className="w-full sm:w-auto px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs shrink-0 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Search className="w-3.5 h-3.5" />
                    Quét chi tiết (Lần 2)
                  </button>
                </div>
              )}

              {/* Profile Details Header */}
              <Card className="border-slate-100 shadow-sm bg-white overflow-hidden">
                <div className="bg-[#005b9a] h-2"></div>
                <CardContent className="p-6 flex flex-col md:flex-row justify-between gap-6">
                  <div className="flex gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e6f0f7] text-[#005b9a] font-bold text-2xl shadow-xs shrink-0">
                      <User className="h-8 w-8" />
                    </div>
                    <div className="flex flex-col justify-center">
                      <h2 className="text-lg font-bold text-slate-800">{profile.name}</h2>
                      <p className="text-xs text-slate-500 mt-1 italic">{profile.affiliation || 'Không có cơ quan công tác'}</p>
                      
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {profile.interests.map((int, idx) => (
                          <span key={idx} className="text-[10px] font-bold bg-[#e6f0f7] text-[#005b9a] rounded px-2.5 py-0.5">
                            {int}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Stats badges */}
                  <div className="flex gap-4 self-center">
                    <div className="flex flex-col items-center bg-slate-50 border border-slate-100 rounded-xl px-5 py-3 text-center">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Trích dẫn</span>
                      <span className="text-lg font-bold text-slate-800 mt-1">{profile.citedby}</span>
                    </div>
                    <div className="flex flex-col items-center bg-slate-50 border border-slate-100 rounded-xl px-5 py-3 text-center">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">H-Index</span>
                      <span className="text-lg font-bold text-slate-800 mt-1">{profile.hindex}</span>
                    </div>
                    <div className="flex flex-col items-center bg-slate-50 border border-slate-100 rounded-xl px-5 py-3 text-center">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">i10-Index</span>
                      <span className="text-lg font-bold text-slate-800 mt-1">{profile.i10index}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Citation Over Time Chart & Stats summary */}
              <div className="flex flex-col gap-6">
                {/* Citation histogram with integrated stats summary in header */}
                <Card className="w-full border-slate-100 shadow-sm bg-white p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 border-b border-slate-100/50 pb-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0 mb-0">
                      <TrendingUp className="h-4 w-4 text-[#005b9a]" />
                      Lịch sử trích dẫn theo năm (Google Scholar)
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs font-bold">
                      <span className="text-slate-450 uppercase text-[9px] tracking-wide mr-1 select-none">Thống kê đối khớp:</span>
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 rounded-lg px-2.5 py-0.5">
                        <span className="text-slate-500 font-medium">Tổng bài:</span>
                        <span className="text-slate-800">{profile.publications.length}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-0.5 text-rose-600">
                        <span className="font-medium">WoS Core:</span>
                        <span>{profile.publications.filter(p => p.wos !== 'N/A').length}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-0.5 text-emerald-700">
                        <span className="font-medium">Q1/Q2 SCImago:</span>
                        <span>{profile.publications.filter(p => p.sjr_q === 'Q1' || p.sjr_q === 'Q2').length}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-sky-50 border border-sky-100 rounded-lg px-2.5 py-0.5 text-sky-700">
                        <span className="font-medium">Bài có IF:</span>
                        <span>{profile.publications.filter(p => p.if_val !== 'N/A').length}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-100 rounded-lg px-2.5 py-0.5 text-purple-700">
                        <span className="font-medium">Có cả IF & SJR:</span>
                        <span>{profile.publications.filter(p => p.if_val !== 'N/A' && p.sjr_q !== 'N/A').length}</span>
                      </div>
                    </div>
                  </div>
                  
                  {citationValues.length === 0 ? (
                    <div className="flex h-40 items-center justify-center text-xs text-slate-400 italic">
                      Không tìm thấy dữ liệu trích dẫn theo năm.
                    </div>
                  ) : (
                    <div className="flex h-48 items-end gap-2.5 pt-4 pb-2 border-b border-slate-200 overflow-visible w-full">
                      {citationValues.map((v) => {
                        const heightPct = (v.count / maxCites) * 100
                        return (
                          <div key={v.year} className="flex-1 flex flex-col items-center gap-2 group min-w-[32px]">
                            {/* Tooltip bar */}
                            <div className="relative w-full flex flex-col justify-end items-center h-32 pt-6">
                              <div 
                                className="w-full bg-[#005b9a]/70 group-hover:bg-[#005b9a] rounded-t-sm transition-all duration-300 relative"
                                style={{ height: `${heightPct}%` }}
                              >
                                {v.count > 0 && (
                                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] md:text-xs font-bold text-[#005b9a] bg-[#e6f0f7] px-1 py-0.5 rounded border border-[#b8d4e9] shadow-2xs whitespace-nowrap z-10 transition-transform group-hover:scale-110">
                                    {v.count}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 select-none">{v.year}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          ) : null}
        </div>

        {/* Floating Console output - floats top right dynamically, smaller, avoids breaking layout */}
        {isScraping && (
          <div className="fixed top-20 right-6 z-50 w-[330px] flex flex-col gap-3 p-4 bg-white/95 backdrop-blur-md border border-slate-200/95 rounded-xl shadow-2xl transition-all duration-300 animate-slide-in-right">
            <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-slate-50 border border-slate-150">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                <span>TIẾN TRÌNH CÀO</span>
                <span className="text-[#005b9a]">{progress}%</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#005b9a] h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
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
      </div>

      {/* Bottom Area: Publications Table or Details View */}
      {!isLoadingProfile && profile && (
        selectedPublication ? (
          <Card className="border-slate-100 shadow-sm bg-white overflow-hidden p-6 animate-fade-in">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-6">
              <button
                onClick={() => setSelectedPublication(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Quay lại danh sách
              </button>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Chi tiết bài báo khoa học
              </span>
            </div>

            <div className="space-y-6">
              {/* Paper Title */}
              <div>
                <h2 className="text-base md:text-lg font-extrabold text-slate-800 leading-snug">
                  {selectedPublication.title}
                </h2>
                <p className="text-xs font-semibold mt-1.5 text-slate-500">
                  Tác giả: <span className="text-slate-650">{selectedPublication.authors_list}</span>
                </p>
              </div>

              {/* Paper details grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-y border-slate-100 py-5">
                <div className="p-3 bg-slate-50/50 rounded-lg border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nơi xuất bản (Venue)</span>
                  <span className="text-xs font-semibold text-slate-700 mt-1 block italic">{selectedPublication.venue || 'N/A'}</span>
                </div>
                <div className="p-3 bg-slate-50/50 rounded-lg border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Năm & Trích dẫn</span>
                  <span className="text-xs font-bold text-slate-800 mt-1 block">
                    Năm {selectedPublication.year} ─ <span className="text-[#005b9a]">{selectedPublication.citations} lượt trích dẫn</span>
                  </span>
                </div>
                <div className="p-3 bg-slate-50/50 rounded-lg border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Chỉ số Tạp chí</span>
                  <div className="flex gap-2 mt-1.5">
                    {selectedPublication.sjr_q !== 'N/A' && (
                      <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100">{selectedPublication.sjr_q}</span>
                    )}
                    {selectedPublication.if_val !== 'N/A' && (
                      <span className="inline-block rounded-md bg-[#e6f0f7] px-2.5 py-0.5 text-[10px] font-bold text-[#005b9a] border border-[#b8d4e9]">IF: {selectedPublication.if_val}</span>
                    )}
                    {selectedPublication.sjr_q === 'N/A' && selectedPublication.if_val === 'N/A' && (
                      <span className="text-xs font-medium text-slate-400">-</span>
                    )}
                  </div>
                </div>
                <div className="p-3 bg-slate-50/50 rounded-lg border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Web of Science (WoS)</span>
                  <span className="text-xs font-bold text-slate-700 mt-1 block">{selectedPublication.wos !== 'N/A' ? selectedPublication.wos : 'N/A'}</span>
                </div>
              </div>

              {/* Paper's individual citation history over the years */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-6 flex items-center gap-1.5">
                  <TrendingUp className="h-4.5 w-4.5 text-[#005b9a]" />
                  Sơ đồ trích dẫn của bài báo theo các năm (Google Scholar)
                </h4>

                {(() => {
                  const citesHistory = selectedPublication.cites_per_year || {};
                  const years = Object.keys(citesHistory).filter((y) => /^\d{4}$/.test(y)).sort();
                  if (years.length === 0) {
                    return (
                      <div className="text-center py-10 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 italic">
                        Chưa có dữ liệu lịch sử trích dẫn cho bài báo này (Hãy nhấn Quét chi tiết Lần 2).
                      </div>
                    );
                  }
                  const values = years.map((yr) => ({ year: yr, count: citesHistory[yr] || 0 }));
                  const maxVal = Math.max(...values.map((v) => v.count), 1);

                  return (
                    <div className="flex h-48 items-end gap-2.5 pt-4 pb-2 border-b border-slate-200 w-full overflow-visible">
                      {values.map((v) => {
                        const heightPct = (v.count / maxVal) * 100;
                        return (
                          <div key={v.year} className="flex-1 flex flex-col items-center gap-2 group min-w-[32px]">
                            <div className="relative w-full flex flex-col justify-end items-center h-32 pt-6">
                              <div
                                className="w-full bg-[#005b9a]/70 group-hover:bg-[#005b9a] rounded-t-sm transition-all duration-300 relative"
                                style={{ height: `${heightPct}%` }}
                              >
                                {v.count > 0 && (
                                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] md:text-xs font-bold text-[#005b9a] bg-[#e6f0f7] px-1 py-0.5 rounded border border-[#b8d4e9] shadow-2xs whitespace-nowrap z-10 transition-transform group-hover:scale-110">
                                    {v.count}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 select-none">{v.year}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="border-slate-100 shadow-sm bg-white overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-[#005b9a]" />
                Danh sách bài báo khoa học ({profile.publications.length})
              </h3>
              
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={triggerDetailedScrape}
                  disabled={isScraping}
                  className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-3xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Quét chi tiết (Lần 2)</span>
                </button>
                
                <button
                  onClick={handleExport}
                  className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg bg-[#005b9a] hover:bg-[#004677] text-white font-bold text-xs shadow-3xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Xuất báo cáo (CSV)</span>
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                    <th className="py-3.5 px-6 w-12">STT</th>
                    <th className="py-3.5 px-4 min-w-[220px]">Tên bài báo / Tác giả</th>
                    <th className="py-3.5 px-4 min-w-[140px]">Nơi xuất bản (Venue)</th>
                    <th className="py-3.5 px-4 w-20 text-center">Năm</th>
                    <th className="py-3.5 px-4 w-24 text-center">Trích dẫn</th>
                    <th className="py-3.5 px-4 w-24 text-center">SJR Q</th>
                    <th className="py-3.5 px-4 w-24 text-center">Impact Factor</th>
                    <th className="py-3.5 px-6 min-w-[180px] text-center">Web of Science</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profile.publications.map((pub, idx) => (
                    <tr 
                      key={pub.id} 
                      onClick={() => setSelectedPublication(pub)}
                      className="hover:bg-slate-100/60 transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-6 font-medium text-slate-400">{idx + 1}</td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-800 leading-normal line-clamp-2" title={pub.title}>
                          {pub.title}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 truncate max-w-[400px]">
                          {pub.authors_list}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-semibold text-slate-600 italic">
                        {pub.venue}
                      </td>
                      <td className="py-4 px-4 text-center font-bold text-slate-500">{pub.year}</td>
                      <td className="py-4 px-4 text-center font-bold text-[#005b9a]">{pub.citations}</td>
                      
                      {/* SJR Quartile Badge */}
                      <td className="py-4 px-4 text-center">
                        {pub.sjr_q === 'Q1' && (
                          <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100">Q1</span>
                        )}
                        {pub.sjr_q === 'Q2' && (
                          <span className="inline-block rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-100">Q2</span>
                        )}
                        {pub.sjr_q === 'Q3' && (
                          <span className="inline-block rounded-md bg-[#e6f0f7] px-2 py-0.5 text-[10px] font-bold text-[#005b9a] border border-[#b8d4e9]">Q3</span>
                        )}
                        {pub.sjr_q === 'Q4' && (
                          <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">Q4</span>
                        )}
                        {pub.sjr_q === 'N/A' && (
                          <span className="text-slate-300 font-medium">─</span>
                        )}
                      </td>
                      
                      {/* IF Highlight */}
                      <td className="py-4 px-4 text-center">
                        {pub.if_val !== 'N/A' ? (
                          <span className="inline-block rounded-md bg-[#e6f0f7] px-2.5 py-0.5 text-[10px] font-bold text-[#005b9a] border border-[#b8d4e9]">
                            {pub.if_val}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-medium">─</span>
                        )}
                      </td>
                      
                      {/* WoS index Highlight */}
                      <td className="py-4 px-6 text-center">
                        {pub.wos !== 'N/A' ? (
                          <span className="inline-block rounded-md bg-rose-50 px-2.5 py-1 text-[9px] font-bold text-rose-600 border border-rose-100 whitespace-normal leading-tight text-center" title={pub.wos}>
                            {pub.wos}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-medium">─</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}
    </div>
  )
}
