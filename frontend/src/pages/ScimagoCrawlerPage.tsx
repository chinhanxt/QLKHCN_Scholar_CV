import { useState, useEffect } from 'react'
import { scholarApi } from '@/api/endpoints/scholar'
import { Card, CardContent } from '@/components/ui/card'
import { TerminalWindow } from '@/components/ui/TerminalWindow'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { BarChart3, Play, Square, HelpCircle, Database, Search, Loader2 } from 'lucide-react'
import { CustomSelect } from '@/components/ui/CustomSelect'

// Helper to parse inputs like "2024, 2025" or "2020-2023" into a list of numbers
const parseYearsInput = (inputStr: string): number[] => {
  const years: number[] = []
  const parts = inputStr.split(/[,;\s]+/)
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    if (trimmed.includes('-')) {
      const subparts = trimmed.split('-')
      if (subparts.length === 2) {
        const start = parseInt(subparts[0].trim(), 10)
        const end = parseInt(subparts[1].trim(), 10)
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.min(start, end)
          const max = Math.max(start, end)
          for (let y = min; y <= max; y++) {
            years.push(y)
          }
        }
      }
    } else {
      const parsed = parseInt(trimmed, 10)
      if (!isNaN(parsed)) {
        years.push(parsed)
      }
    }
  }
  return Array.from(new Set(years)).sort((a, b) => b - a)
}

import { useCrawlerStore } from '@/stores/crawler.store'

export function ScimagoCrawlerPage() {
  const [yearMode, setYearMode] = useState<'all' | 'custom'>('custom')
  const [customYearsText, setCustomYearsText] = useState('2023, 2024')
  const [maxWorkers, setMaxWorkers] = useState(5)
  const [delay, setDelay] = useState(1.0)
  
  // Inner tab and data viewer state
  const [activeTab, setActiveTab] = useState<'tool' | 'data'>('data')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedQuartile, setSelectedQuartile] = useState<string>('')
  const [dataList, setDataList] = useState<any[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [selectedJournal, setSelectedJournal] = useState<any | null>(null)
  
  // Stats state
  const [dbStats, setDbStats] = useState<any>(null)

  const fetchStats = async () => {
    try {
      const res = await scholarApi.getStats().then((r) => r.data)
      setDbStats(res)
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }
  
  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 450)
    return () => clearTimeout(handler)
  }, [searchQuery])

  // Fetch SCImago raw journals database list
  useEffect(() => {
    if (activeTab !== 'data') return
    
    let isMounted = true
    const fetchData = async () => {
      setIsLoadingData(true)
      try {
        const res = await scholarApi.getScimagoData({
          q: debouncedSearchQuery,
          year: selectedYear,
          quartile: selectedQuartile
        }).then((r) => r.data)
        if (isMounted) {
          setDataList(res)
          if (res.length > 0) {
            setSelectedJournal(res[0])
          } else {
            setSelectedJournal(null)
          }
        }
      } catch (err) {
        console.error(err)
        toast.error('Lỗi khi tải dữ liệu SCImago từ cơ sở dữ liệu')
      } finally {
        if (isMounted) {
          setIsLoadingData(false)
        }
      }
    }
    fetchData()
    fetchStats()
    return () => {
      isMounted = false
    }
  }, [activeTab, debouncedSearchQuery, selectedYear, selectedQuartile])



  // Crawler Task State from Zustand Store
  const { taskId, taskStatus, consoleLogs } = useCrawlerStore((state) => state.scimago)
  const setTaskState = useCrawlerStore((state) => state.setTaskState)
  const addConsoleLog = useCrawlerStore((state) => state.addConsoleLog)
  const clearLogs = useCrawlerStore((state) => state.clearLogs)


  useEffect(() => {
    if (!taskId) return

    const pollInterval = setInterval(async () => {
      try {
        const res = await scholarApi.getCrawlerTaskStatus(taskId).then((r) => r.data)
        setTaskState('scimago', { taskStatus: res.status })
        
        if (res.status === 'PROGRESS') {
          if (res.message) {
            addConsoleLog('scimago', res.message)
          }
        } else if (res.status === 'SUCCESS') {
          setTaskState('scimago', { taskId: null })
          clearInterval(pollInterval)
          addConsoleLog('scimago', '>>> HOÀN THÀNH: Tải và nạp dữ liệu SCImago thành công!')
          addConsoleLog('scimago', `  Tổng số tạp chí đã lưu/cập nhật: ${res.result?.imported_journals || 0}`)
          toast.success('SCImago Crawler đã hoàn tất nạp dữ liệu!')
          fetchStats()
        } else if (res.status === 'FAILURE') {
          setTaskState('scimago', { taskId: null })
          clearInterval(pollInterval)
          const err = res.message || 'Lỗi không xác định.'
          addConsoleLog('scimago', `>>> LỖI: ${err}`)
          toast.error(`Nạp dữ liệu SCImago thất bại: ${err}`)
          fetchStats()
        }
      } catch (err: any) {
        console.error('Error polling crawler task:', err)
      }
    }, 1500)

    return () => clearInterval(pollInterval)
  }, [taskId, setTaskState, addConsoleLog])

  const handleStartCrawl = async () => {
    let targetYears: number[] = []
    
    if (yearMode === 'all') {
      targetYears = Array.from({ length: 2025 - 1999 + 1 }, (_, i) => 1999 + i)
    } else {
      targetYears = parseYearsInput(customYearsText)
      if (targetYears.length === 0) {
        toast.warning('Vui lòng nhập ít nhất một năm hợp lệ.')
        return
      }
    }

    clearLogs('scimago')
    addConsoleLog('scimago', '=== KHỞI ĐỘNG SCIMAGO CRAWLER (SJR RANKINGS) ===')
    addConsoleLog('scimago', `Chế độ: ${yearMode === 'all' ? 'Tất cả các năm (1999 - 2025)' : 'Năm tùy chọn'}`)
    addConsoleLog('scimago', `Danh sách năm: ${targetYears.sort().join(', ')}`)
    addConsoleLog('scimago', `Số luồng chạy: ${maxWorkers} threads`)
    addConsoleLog('scimago', `Khoảng nghỉ delay: ${delay}s`)
    addConsoleLog('scimago', '[System] Đang kết nối tới máy chủ SCImago để tải các tệp CSV chỉ mục...')
    addConsoleLog('scimago', '[System] Sử dụng cơ chế nạp trực tiếp bằng Pandas & Bulk insert...')
    
    setTaskState('scimago', { taskStatus: 'PENDING', progress: 5 })
    
    try {
      const res = await scholarApi.startScimagoCrawl({
        years: targetYears,
        max_workers: maxWorkers,
        delay: delay
      }).then((r) => r.data)
      setTaskState('scimago', { taskId: res.task_id })
      addConsoleLog('scimago', `[System] Đã kích hoạt Celery Task ID: ${res.task_id}`)
    } catch (err: any) {
      toast.error('Không thể kích hoạt crawler.')
      addConsoleLog('scimago', `[System] Lỗi kích hoạt: ${err.message}`)
      setTaskState('scimago', { taskStatus: 'IDLE' })
    }
  }

  const handleStopCrawl = () => {
    setTaskState('scimago', { taskId: null, taskStatus: 'IDLE' })
    addConsoleLog('scimago', '>>> ĐÃ DỪNG: Ngắt kết nối theo dõi tác vụ cào dữ liệu.')
    toast.info('Đã dừng theo dõi tiến trình cào.')
  }

  // Determine current active step in the workflow
  const activeStep: number = (() => {
    if (taskStatus === 'SUCCESS') return 5
    if (taskStatus === 'PENDING' || taskStatus === 'PROGRESS') return 3 // step 3 & 4 active
    return 1 // step 1 & 2 active
  })()

  const isScrawling = taskStatus === 'PENDING' || taskStatus === 'PROGRESS'

  return (
    <div className="flex flex-col gap-4">
      {/* Unified Control Header Card - Sticky at viewport top with glassmorphism blur */}
      <Card className="border-slate-200 border-x-0 border-t-0 shadow-xs bg-white/90 backdrop-blur-md p-4 sticky top-[-16px] md:top-[-24px] z-20 -mx-4 md:-mx-6 px-4 md:px-6 rounded-b-xl rounded-t-none transition-all duration-200 border-b border-slate-200/80">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col gap-2 w-full lg:w-auto">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="h-4.5 w-4.5 text-[#005b9a]" />
              Bảng điều khiển SCImago Scraper
            </h3>
            <CustomSelect
              value={activeTab}
              onChange={(val) => setActiveTab(val as 'tool' | 'data')}
              options={[
                { value: 'data', label: 'Chế độ: Xem dữ liệu' },
                { value: 'tool', label: 'Chế độ: Công cụ cào dữ liệu' }
              ]}
              className="border-[#005b9a]/35 text-[#005b9a] focus:ring-[#005b9a]/20 focus:border-[#005b9a] hover:border-[#005b9a] text-[11px] font-bold py-1.5"
              chevronClassName="text-[#005b9a]"
              dropdownClassName="min-w-[220px]"
            />
          </div>

          {activeTab === 'data' && (
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto items-center">
              {/* Search Query */}
              <div className="relative w-full sm:w-60">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm tạp chí, ISSN..."
                  className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#005b9a]/20 focus:border-[#005b9a] hover:border-slate-300 bg-white transition-all text-slate-855 font-bold shadow-xs"
                />
              </div>

              {/* Quartile Select */}
              <CustomSelect
                value={selectedQuartile}
                onChange={(val) => setSelectedQuartile(val)}
                options={[
                  { value: '', label: 'Tất cả phân hạng (Q)' },
                  { value: 'Q1', label: 'Q1' },
                  { value: 'Q2', label: 'Q2' },
                  { value: 'Q3', label: 'Q3' },
                  { value: 'Q4', label: 'Q4' }
                ]}
                className="text-slate-700 font-bold py-1.5"
                dropdownClassName="min-w-[180px]"
              />

              {/* Year Select */}
              <CustomSelect
                value={selectedYear}
                onChange={(val) => setSelectedYear(val)}
                options={[
                  { value: '', label: 'Tất cả các năm' },
                  ...Array.from({ length: 15 }, (_, i) => 2024 - i).map((y) => ({
                    value: y.toString(),
                    label: y.toString()
                  }))
                ]}
                className="text-slate-700 font-bold py-1.5"
                dropdownClassName="min-w-[160px]"
              />
            </div>
          )}
        </div>
      </Card>

      {activeTab === 'tool' ? (
        <>
          {/* Visual Workflow Steps - Matches Tool 1 & 2 design */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs p-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-[#005b9a]" />
              QUY TRÌNH THỰC HIỆN CÔNG CỤ
            </h3>
            <div className="grid gap-2 grid-cols-2 md:grid-cols-5 lg:grid-cols-5 items-center">
              {[
                { id: 1, label: '1. Nhập cấu hình năm', desc: 'Chọn năm cần quét' },
                { id: 2, label: '2. Định tham số', desc: 'Chọn Workers & Delay' },
                { id: 3, label: '3. Chạy Celery', desc: 'Kích hoạt tác vụ cào' },
                { id: 4, label: '4. Quét Console', desc: 'Theo dõi log cào chạy' },
                { id: 5, label: '5. Kiểm tra DB', desc: 'Lưu vào scimago_all.db' }
              ].map((step, idx) => {
                const isActive = activeStep === step.id || (step.id === 2 && activeStep === 1) || (step.id === 4 && activeStep === 3)
                const isCompleted = activeStep > step.id && !(step.id === 1 && activeStep === 2) && !(step.id === 3 && activeStep === 4)
                
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
                    
                    {idx < 4 && (
                      <span className="hidden lg:block mx-1 text-slate-300 font-bold select-none shrink-0">→</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Unified configuration horizontal bar */}
          <Card className="border-slate-100 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4 items-end justify-between">
                <div className="flex-1 w-full grid gap-4 grid-cols-1 md:grid-cols-4">
                  {/* Col 1: Cấu hình năm quét */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500 uppercase">Năm quét dữ liệu</label>
                      <button
                        type="button"
                        onClick={() => {
                          const nextMode = yearMode === 'all' ? 'custom' : 'all'
                          setYearMode(nextMode)
                          if (nextMode === 'all') {
                            setCustomYearsText('2024')
                          }
                        }}
                        disabled={taskStatus === 'PENDING' || taskStatus === 'PROGRESS'}
                        className="text-[10px] text-[#005b9a] hover:underline font-bold cursor-pointer"
                      >
                        {yearMode === 'all' ? 'Chọn năm thủ công' : 'Quét tất cả năm'}
                      </button>
                    </div>
                    
                    {yearMode === 'all' ? (
                      <input
                        type="text"
                        value="Tất cả các năm (2024 về trước)"
                        disabled
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-400 bg-slate-50 focus:outline-none w-full font-bold"
                      />
                    ) : (
                      <input
                        type="text"
                        value={customYearsText}
                        onChange={(e) => setCustomYearsText(e.target.value)}
                        placeholder="Ví dụ: 2023, 2024 hoặc 2020-2024"
                        disabled={taskStatus === 'PENDING' || taskStatus === 'PROGRESS'}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#005b9a] w-full font-medium"
                      />
                    )}
                  </div>

                  {/* Col 2: Số luồng chạy */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Số luồng chạy (Workers)</label>
                    <select
                      value={maxWorkers}
                      onChange={(e) => setMaxWorkers(parseInt(e.target.value) || 1)}
                      disabled={taskStatus === 'PENDING' || taskStatus === 'PROGRESS'}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#005b9a] cursor-pointer font-medium w-full"
                    >
                      {[1, 2, 3, 5, 8, 10, 15, 20].map((w) => (
                        <option key={w} value={w}>{w} luồng song song</option>
                      ))}
                    </select>
                  </div>

                  {/* Col 3: Delay */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Khoảng nghỉ (Delay - s)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={delay}
                      onChange={(e) => setDelay(parseFloat(e.target.value) || 1.0)}
                      disabled={taskStatus === 'PENDING' || taskStatus === 'PROGRESS'}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#005b9a] w-full font-medium"
                    />
                  </div>

                  {/* Col 4: Hướng dẫn cào */}
                  <div className="flex flex-col gap-1 bg-[#e6f0f7]/40 border border-[#b8d4e9]/40 p-2.5 rounded-lg text-[9px] text-[#005b9a] leading-relaxed">
                    <strong>Mẹo hiệu suất:</strong> Nên chọn từ 3-8 luồng và delay &gt;= 1.0s để tránh IP bị chặn hoặc nghẽn mạng từ SCImago.
                  </div>
                </div>

                <div className="shrink-0 w-full lg:w-auto">
                  {taskStatus === 'PENDING' || taskStatus === 'PROGRESS' ? (
                    <button
                      onClick={handleStopCrawl}
                      className="w-full lg:w-44 flex items-center justify-center gap-2 rounded-lg py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs cursor-pointer transition-colors shadow-xs"
                    >
                      <Square className="h-3.5 w-3.5" />
                      <span>Dừng tiến trình cào</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleStartCrawl}
                      className="w-full lg:w-44 flex items-center justify-center gap-2 rounded-lg py-2 bg-[#005b9a] hover:bg-[#004677] text-white font-bold text-xs cursor-pointer transition-colors shadow-xs"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Kích hoạt cào tin</span>
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main split grid: overview on left, console on right only when running */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Side: Overview Details */}
            <div className={cn(
              "flex flex-col gap-6",
              isScrawling ? "lg:col-span-2" : "lg:col-span-3"
            )}>
              <Card className="border-slate-100 shadow-sm bg-white p-6 space-y-6">
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">Giới thiệu SCImago Crawler</h3>
                
                <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
                  <p>
                    Trình cào SCImago Journal Rank tự động duyệt qua danh sách xếp hạng tạp chí, cào thông tin chi tiết của từng tạp chí bao gồm các chỉ số SJR, Quartile và H-Index từ trang chủ <strong>scimagojr.com</strong>.
                  </p>
                  <div className="grid gap-4 md:grid-cols-3 pt-2">
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Đối tượng cào</div>
                      <div className="text-sm font-bold text-slate-800 mt-1">Quartile, H-Index & SJR</div>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Công nghệ</div>
                      <div className="text-sm font-bold text-slate-800 mt-1">Multi-threading Scraper</div>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Trạng thái cơ sở dữ liệu</div>
                      <div className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Sẵn sàng hoạt động</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Right Side: Console output - displays dynamically and is highly compact */}
            {isScrawling && (
              <div className="lg:col-span-1 flex flex-col gap-4">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Màn hình tiến trình chạy</h2>
                <div className="h-fit">
                  <TerminalWindow
                    title="SCImago Scraper Output Console"
                    logs={consoleLogs}
                    onClear={() => clearLogs('scimago')}
                    isRunning={taskStatus === 'PENDING' || taskStatus === 'PROGRESS'}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Data Viewer Tab */
        <Card className="border-slate-100 shadow-sm bg-white p-6 overflow-visible">

          {/* Prominent Database Metric Card - Compact Version */}
          <div className="mb-4 bg-gradient-to-r from-blue-50 to-[#e6f0f7]/50 border border-[#b8d4e9]/70 rounded-lg py-2 px-3.5 flex items-center justify-between shadow-3xs animate-in fade-in duration-300">
            <div className="flex items-center gap-2.5">
              <Database className="h-4 w-4 text-[#005b9a]" />
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-550 uppercase tracking-wider">
                  Cơ sở dữ liệu SCImago:
                </span>
                <span className="text-base font-extrabold text-[#005b9a]">
                  {dbStats ? dbStats.scimago_journals.toLocaleString() : '---'}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">
                  tạp chí đã nạp
                </span>
              </div>
            </div>
            <div className="hidden sm:block">
              <span className="text-[10px] font-bold text-slate-400">
                scimagojr_all.db
              </span>
            </div>
          </div>

          {isLoadingData ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 className="h-8 w-8 text-[#005b9a] animate-spin" />
              <span className="text-xs text-slate-500 font-medium">Đang tải dữ liệu...</span>
            </div>
          ) : dataList.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl">
              <Database className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <span className="text-xs text-slate-500 font-medium">Không tìm thấy dữ liệu nào trong database.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Journal List (col-span-2) */}
              <div className="lg:col-span-2 overflow-x-auto border border-slate-100 rounded-xl bg-white">
                <table className="w-full min-w-[750px] text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 font-bold">
                      <th className="p-3 w-24 whitespace-nowrap">Source ID</th>
                      <th className="p-3">Tên tạp chí</th>
                      <th className="p-3 w-36 whitespace-nowrap">Thông tin chung</th>
                      <th className="p-3 w-48 whitespace-nowrap">SJR & Phân hạng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {dataList.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedJournal(row)}
                        className={cn(
                          "hover:bg-slate-50/50 transition-all cursor-pointer",
                          selectedJournal?.id === row.id
                            ? "bg-[#e6f0f7]/40 text-[#005b9a]"
                            : ""
                        )}
                      >
                        <td className={cn(
                          "p-3 font-semibold whitespace-nowrap",
                          selectedJournal?.id === row.id ? "text-[#005b9a]" : "text-slate-500"
                        )}>{row.source_id || 'N/A'}</td>
                        <td className="p-3">
                          <div className={cn(
                            "font-bold",
                            selectedJournal?.id === row.id ? "text-[#005b9a]" : "text-slate-800"
                          )}>{row.title}</div>
                        </td>
                        <td className="p-3 whitespace-nowrap w-36">
                          <div className="flex flex-col gap-1 items-start">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[9px] capitalize border border-slate-200 whitespace-nowrap">
                              {row.journal_type || 'Journal'}
                            </span>
                            {row.issns && row.issns.length > 0 && (
                              <span className="font-mono text-[9px] text-slate-500 whitespace-nowrap">
                                ISSN: {row.issns[0]}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap w-48">
                          {(() => {
                            if (!row.rankings || row.rankings.length === 0) return <span className="text-slate-400">-</span>;
                            const latest = row.rankings[0];
                            return (
                              <div className="flex items-center gap-1.5 whitespace-nowrap">
                                {latest.sjr_quartile ? (
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded font-bold text-[9px] border whitespace-nowrap",
                                    latest.sjr_quartile === 'Q1' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                    latest.sjr_quartile === 'Q2' ? "bg-blue-50 text-blue-700 border-blue-100" :
                                    latest.sjr_quartile === 'Q3' ? "bg-amber-50 text-amber-700 border-amber-100" :
                                    "bg-red-50 text-red-700 border-red-100"
                                  )}>
                                    {latest.sjr_quartile}
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded font-bold text-[9px] border bg-slate-50 text-slate-500 border-slate-100 whitespace-nowrap">
                                    -
                                  </span>
                                )}
                                <span className="text-slate-650 font-semibold font-mono text-[10px] whitespace-nowrap">
                                  SJR: {latest.sjr_score !== null ? latest.sjr_score : 'N/A'} ({latest.year})
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Right Column: Detailed SJR / Rankings (col-span-1) */}
              <div className="lg:col-span-1 lg:sticky lg:top-[74px] md:lg:top-[80px] self-start">
                {selectedJournal ? (
                  <Card className="border border-slate-100 rounded-xl bg-slate-50/30 overflow-hidden shadow-2xs h-fit">
                    <CardContent className="p-4 flex flex-col gap-4">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Chi tiết tạp chí tuyển chọn
                        </span>
                        <h4 className="text-xs font-bold text-[#005b9a] leading-tight">
                          {selectedJournal.title}
                        </h4>
                        <div className="text-[9px] text-slate-400 mt-1 font-mono break-all">
                          Normalized: {selectedJournal.title_normalized}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 text-xs border-y border-slate-100 py-3">
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">Source ID</span>
                          <span className="font-bold text-slate-700">{selectedJournal.source_id || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">Phân loại</span>
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-750 font-semibold text-[9px] capitalize border border-slate-200 mt-0.5">
                            {selectedJournal.journal_type || 'Journal'}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">Nhà xuất bản</span>
                          <span className="font-semibold text-slate-800 break-words">{selectedJournal.publisher || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">Quốc gia</span>
                          <span className="font-semibold text-slate-650">{selectedJournal.country || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">Mã ISSN</span>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {selectedJournal.issns && selectedJournal.issns.length > 0 ? (
                              selectedJournal.issns.map((issn: string) => (
                                <span key={issn} className="px-1 rounded bg-slate-200 text-slate-700 font-mono text-[9px]">
                                  {issn}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                          Lịch sử xếp hạng SJR & H-Index
                        </span>
                        {selectedJournal.rankings && selectedJournal.rankings.length > 0 ? (
                          <div className="overflow-y-auto max-h-[320px] border border-slate-100 rounded-lg bg-white">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                                  <th className="p-2 w-16">Năm</th>
                                  <th className="p-2">SJR (Quartile)</th>
                                  <th className="p-2">H-Index</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-slate-700">
                                {selectedJournal.rankings.map((rank: any) => (
                                  <tr key={rank.year} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-2 font-bold text-slate-800">{rank.year}</td>
                                    <td className="p-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className={cn(
                                          "inline-block px-1.5 py-0.5 rounded font-bold text-[9px] border",
                                          rank.sjr_quartile === 'Q1' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                          rank.sjr_quartile === 'Q2' ? "bg-blue-50 text-blue-700 border-blue-100" :
                                          rank.sjr_quartile === 'Q3' ? "bg-amber-50 text-amber-700 border-amber-100" :
                                          "bg-red-50 text-red-700 border-red-100"
                                        )}>
                                          {rank.sjr_quartile || 'N/A'}
                                        </span>
                                        <span className="text-slate-500 font-medium text-[9px]">
                                          SJR: {rank.sjr_score !== null ? rank.sjr_score : 'N/A'}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="p-2 text-slate-500 font-medium">
                                      {rank.h_index !== null ? rank.h_index : '0'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-white border border-dashed border-slate-200 rounded-lg text-slate-400">
                            Không có thông tin xếp hạng SJR.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/30 text-slate-400 text-xs h-32">
                    Chọn một tạp chí bên danh sách để xem chi tiết SJR & Rankings.
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
