import { useState, useEffect } from 'react'
import { scholarApi } from '@/api/endpoints/scholar'
import { Card, CardContent } from '@/components/ui/card'
import { TerminalWindow } from '@/components/ui/TerminalWindow'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Globe, Play, Square, HelpCircle, Database, Search, Loader2 } from 'lucide-react'
import { useCrawlerStore } from '@/stores/crawler.store'
import { CustomSelect } from '@/components/ui/CustomSelect'

export function BioxbioCrawlerPage() {
  const [startUrl, setStartUrl] = useState('https://www.bioxbio.com/journal/')
  const [crawlMode, setCrawlMode] = useState<'all' | 'custom'>('all')
  const [maxWorkers, setMaxWorkers] = useState(10)
  const [delay, setDelay] = useState(2.0)

  // Inner tab and data viewer state
  const [activeTab, setActiveTab] = useState<'tool' | 'data'>('data')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [selectedYear, setSelectedYear] = useState<string>('')
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

  // Fetch BioxBio raw journals database list
  useEffect(() => {
    if (activeTab !== 'data') return
    
    let isMounted = true
    const fetchData = async () => {
      setIsLoadingData(true)
      try {
        const res = await scholarApi.getBioxbioData({ q: debouncedSearchQuery, year: selectedYear }).then((r) => r.data)
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
        toast.error('Lỗi khi tải dữ liệu BioxBio từ cơ sở dữ liệu')
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
  }, [activeTab, debouncedSearchQuery, selectedYear])


  
  // Crawler Task State from Zustand Store
  const { taskId, taskStatus, consoleLogs } = useCrawlerStore((state) => state.bioxbio)
  const setTaskState = useCrawlerStore((state) => state.setTaskState)
  const addConsoleLog = useCrawlerStore((state) => state.addConsoleLog)
  const clearLogs = useCrawlerStore((state) => state.clearLogs)

  useEffect(() => {
    if (!taskId) return

    const pollInterval = setInterval(async () => {
      try {
        const res = await scholarApi.getCrawlerTaskStatus(taskId).then((r) => r.data)
        setTaskState('bioxbio', { taskStatus: res.status })
        
        if (res.status === 'PROGRESS') {
          if (res.message) {
            addConsoleLog('bioxbio', res.message)
          }
        } else if (res.status === 'SUCCESS') {
          setTaskState('bioxbio', { taskId: null })
          clearInterval(pollInterval)
          addConsoleLog('bioxbio', '>>> HOÀN THÀNH: Quá trình cào BioxBio đã hoàn tất!')
          addConsoleLog('bioxbio', `  Tổng số tạp chí đã lưu: ${res.result?.scraped_journals || 0}`)
          toast.success('BioxBio Crawler đã cào xong!')
          fetchStats()
        } else if (res.status === 'FAILURE') {
          setTaskState('bioxbio', { taskId: null })
          clearInterval(pollInterval)
          const err = res.message || 'Lỗi không xác định.'
          addConsoleLog('bioxbio', `>>> LỖI: ${err}`)
          toast.error(`Cào dữ liệu BioxBio thất bại: ${err}`)
          fetchStats()
        }
      } catch (err: any) {
        console.error('Error polling crawler task:', err)
      }
    }, 1500)

    return () => clearInterval(pollInterval)
  }, [taskId, setTaskState, addConsoleLog])

  const handleStartCrawl = async () => {
    clearLogs('bioxbio')
    addConsoleLog('bioxbio', '=== KHỞI ĐỘNG BIOXBIO CRAWLER (IMPACT FACTOR) ===')
    addConsoleLog('bioxbio', `Target URL: ${startUrl}`)
    addConsoleLog('bioxbio', `Chế độ cào: ${crawlMode === 'all' ? 'Tất cả tạp chí' : 'Chủ đề cụ thể'}`)
    addConsoleLog('bioxbio', `Số luồng chạy: ${maxWorkers} workers`)
    addConsoleLog('bioxbio', `Khoảng nghỉ delay: ${delay}s`)
    addConsoleLog('bioxbio', '[System] Đang kết nối tới máy chủ cào dữ liệu BioxBio...')
    
    setTaskState('bioxbio', { taskStatus: 'PENDING', progress: 5 })
    
    try {
      const res = await scholarApi.startBioxbioCrawl({
        start_url: startUrl,
        max_workers: maxWorkers,
        delay: delay
      }).then((r) => r.data)
      setTaskState('bioxbio', { taskId: res.task_id })
      addConsoleLog('bioxbio', `[System] Đã kích hoạt Celery Task ID: ${res.task_id}`)
    } catch (err: any) {
      toast.error('Không thể kích hoạt crawler.')
      addConsoleLog('bioxbio', `[System] Lỗi kích hoạt: ${err.message}`)
      setTaskState('bioxbio', { taskStatus: 'IDLE' })
    }
  }

  const handleStopCrawl = () => {
    setTaskState('bioxbio', { taskId: null, taskStatus: 'IDLE' })
    addConsoleLog('bioxbio', '>>> ĐÃ DỪNG: Ngắt kết nối theo dõi tác vụ cào dữ liệu.')
    toast.info('Đã dừng theo dõi tiến trình cào.')
  }

  // Determine current active step in the workflow
  const activeStep: number = (() => {
    if (taskStatus === 'SUCCESS') return 5
    if (taskStatus === 'PENDING' || taskStatus === 'PROGRESS') return 3 // steps 3 & 4 active
    return 1 // steps 1 & 2 active
  })()

  const isScrawling = taskStatus === 'PENDING' || taskStatus === 'PROGRESS'

  return (
    <div className="flex flex-col gap-4">
      {/* Unified Control Header Card - Sticky at viewport top with glassmorphism blur */}
      <Card className="border-slate-200 border-x-0 border-t-0 shadow-xs bg-white/90 backdrop-blur-md p-4 sticky top-[-16px] md:top-[-24px] z-20 -mx-4 md:-mx-6 px-4 md:px-6 rounded-b-xl rounded-t-none transition-all duration-200 border-b border-slate-200/80">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col gap-2 w-full lg:w-auto">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Globe className="h-4.5 w-4.5 text-[#005b9a]" />
              Bảng điều khiển BioxBio Scraper
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
                  className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#005b9a]/20 focus:border-[#005b9a] hover:border-slate-300 bg-white transition-all text-slate-850 font-bold shadow-xs"
                />
              </div>

              {/* Year Select */}
              <CustomSelect
                value={selectedYear}
                onChange={(val) => setSelectedYear(val)}
                options={[
                  { value: '', label: 'Tất cả các năm' },
                  ...Array.from({ length: 14 }, (_, i) => 2025 - i).map((y) => ({
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
                { id: 1, label: '1. Thiết lập URL', desc: 'Định nghĩa link bắt đầu' },
                { id: 2, label: '2. Định tham số', desc: 'Chọn Workers & Delay' },
                { id: 3, label: '3. Chạy Celery', desc: 'Kích hoạt tác vụ cào' },
                { id: 4, label: '4. Quét Console', desc: 'Theo dõi log cào chạy' },
                { id: 5, label: '5. Kiểm tra DB', desc: 'Lưu vào bioxbio_all.db' }
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
                  {/* Col 1: Link trang */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Link trang (URL)</label>
                    <input
                      type="text"
                      value={crawlMode === 'all' ? 'https://www.bioxbio.com/journal/' : startUrl}
                      onChange={(e) => setStartUrl(e.target.value)}
                      disabled={crawlMode === 'all' || taskStatus === 'PENDING' || taskStatus === 'PROGRESS'}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#005b9a] w-full font-medium disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </div>

                  {/* Col 2: Chế độ cào */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Chế độ cào</label>
                    <select
                      value={crawlMode}
                      onChange={(e) => {
                        const mode = e.target.value as 'all' | 'custom'
                        setCrawlMode(mode)
                        if (mode === 'all') {
                          setStartUrl('https://www.bioxbio.com/journal/')
                        }
                      }}
                      disabled={taskStatus === 'PENDING' || taskStatus === 'PROGRESS'}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-650 focus:outline-none focus:ring-2 focus:ring-[#005b9a] cursor-pointer font-medium w-full"
                    >
                      <option value="all">Tất cả tạp chí</option>
                      <option value="custom">Chủ đề cụ thể</option>
                    </select>
                  </div>

                  {/* Col 3: Số luồng chạy */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Số luồng chạy (Workers)</label>
                    <input
                      type="number"
                      value={maxWorkers}
                      onChange={(e) => setMaxWorkers(parseInt(e.target.value) || 1)}
                      disabled={taskStatus === 'PENDING' || taskStatus === 'PROGRESS'}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#005b9a] w-full font-medium"
                    />
                  </div>

                  {/* Col 4: Khoảng nghỉ delay */}
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
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">Giới thiệu BioxBio Crawler</h3>
                
                <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
                  <p>
                    Trình cào BioxBio Impact Factor tự động duyệt qua danh sách các chủ đề (Subjects) và cào thông tin chi tiết từng tạp chí trên trang web <strong>BioxBio.com</strong>.
                  </p>
                  <div className="grid gap-4 md:grid-cols-3 pt-2">
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Đối tượng cào</div>
                      <div className="text-sm font-bold text-slate-800 mt-1">Tạp chí & Impact Factor</div>
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
                    title="BioxBio Scraper Output Console"
                    logs={consoleLogs}
                    onClear={() => clearLogs('bioxbio')}
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
              <Globe className="h-4 w-4 text-[#005b9a]" />
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-550 uppercase tracking-wider">
                  Cơ sở dữ liệu BioxBio:
                </span>
                <span className="text-base font-extrabold text-[#005b9a]">
                  {dbStats ? dbStats.bioxbio_journals.toLocaleString() : '---'}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">
                  tạp chí đã nạp
                </span>
              </div>
            </div>
            <div className="hidden sm:block">
              <span className="text-[10px] font-bold text-slate-400">
                bioxbio_all.db
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
                <table className="w-full min-w-[650px] text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 font-bold">
                      <th className="p-3 w-24 whitespace-nowrap">Source ID</th>
                      <th className="p-3">Tên tạp chí</th>
                      <th className="p-3 w-36 whitespace-nowrap">ISSNs</th>
                      <th className="p-3 w-44 whitespace-nowrap">Impact Factor (Mới nhất)</th>
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
                          {row.issns && row.issns.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {row.issns.map((issn: string) => (
                                <span key={issn} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[9px] border border-slate-200 whitespace-nowrap">
                                  {issn}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap w-44">
                          {(() => {
                            const latest = row.rankings && row.rankings.length > 0 ? row.rankings[0] : null;
                            if (!latest) return <span className="text-slate-400">-</span>;
                            return (
                              <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-100 whitespace-nowrap">
                                IF {latest.impact_factor !== null ? latest.impact_factor : 'N/A'} ({latest.year})
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Right Column: Detailed Impact Factor / Rankings (col-span-1) */}
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

                      <div className="grid grid-cols-2 gap-2 text-xs border-y border-slate-100 py-3">
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">Source ID</span>
                          <span className="font-bold text-slate-700">{selectedJournal.source_id || 'N/A'}</span>
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
                          Lịch sử xếp hạng Impact Factor
                        </span>
                        {selectedJournal.rankings && selectedJournal.rankings.length > 0 ? (
                          <div className="overflow-y-auto max-h-[320px] border border-slate-100 rounded-lg bg-white">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                                  <th className="p-2 w-16">Năm</th>
                                  <th className="p-2">Impact Factor</th>
                                  <th className="p-2">Lượt trích dẫn</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-slate-700">
                                {selectedJournal.rankings.map((rank: any) => (
                                  <tr key={rank.year} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-2 font-bold text-slate-800">{rank.year}</td>
                                    <td className="p-2">
                                      <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[9px] border border-emerald-100">
                                        {rank.impact_factor !== null ? `IF ${rank.impact_factor}` : 'N/A'}
                                      </span>
                                    </td>
                                    <td className="p-2 text-slate-500 font-medium">
                                      {rank.total_cites !== null ? rank.total_cites.toLocaleString() : '0'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-white border border-dashed border-slate-200 rounded-lg text-slate-400">
                            Không có thông tin Impact Factor.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/30 text-slate-400 text-xs h-32">
                    Chọn một tạp chí bên danh sách để xem chi tiết Impact Factor.
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
