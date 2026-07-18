import { useEffect, useState } from 'react'
import { scholarApi } from '@/api/endpoints/scholar'
import { Card, CardContent } from '@/components/ui/card'
import { TerminalWindow } from '@/components/ui/TerminalWindow'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { GitMerge, Play, Square, AlertCircle, HelpCircle, Database, Search, Loader2, CheckCircle2 } from 'lucide-react'
import { useCrawlerStore } from '@/stores/crawler.store'
import { CustomSelect } from '@/components/ui/CustomSelect'

const getShortWosIndex = (fullname: string) => {
  if (!fullname) return '-';
  const upper = fullname.toUpperCase();
  if (upper.includes('SCIENCE CITATION INDEX EXPANDED')) return 'SCIE';
  if (upper.includes('SOCIAL SCIENCES CITATION INDEX')) return 'SSCI';
  if (upper.includes('ARTS & HUMANITIES CITATION INDEX')) return 'AHCI';
  if (upper.includes('EMERGING SOURCES CITATION INDEX')) return 'ESCI';
  return fullname;
};

const getMatchBadge = (method: string | null) => {
  if (!method) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold text-[9px] border border-slate-200">
        <AlertCircle className="w-2.5 h-2.5 text-slate-400 animate-pulse" />
        Không liên kết
      </span>
    )
  }
  const cleanMethod = method.toLowerCase()
  if (cleanMethod === 'issn') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[9px] border border-emerald-100">
        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
        Khớp qua ISSN
      </span>
    )
  }
  if (cleanMethod === 'title') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-[#005b9a] font-bold text-[9px] border border-blue-100">
        <CheckCircle2 className="w-2.5 h-2.5 text-[#005b9a]" />
        Khớp qua Tên
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#e6f0f7] text-[#005b9a] font-semibold text-[9px] border border-[#b8d4e9]">
      <CheckCircle2 className="w-2.5 h-2.5" />
      {method}
    </span>
  )
}

const getQuartileBadge = (quartile: string | null) => {
  if (!quartile) return <span className="text-slate-400 font-medium">-</span>
  const upper = quartile.toUpperCase()
  if (upper.includes('Q1')) {
    return (
      <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[9px] border border-emerald-100">
        Q1
      </span>
    )
  }
  if (upper.includes('Q2')) {
    return (
      <span className="inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[9px] border border-blue-100">
        Q2
      </span>
    )
  }
  if (upper.includes('Q3')) {
    return (
      <span className="inline-block px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-[9px] border border-amber-100">
        Q3
      </span>
    )
  }
  if (upper.includes('Q4')) {
    return (
      <span className="inline-block px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-bold text-[9px] border border-red-100">
        Q4
      </span>
    )
  }
  return (
    <span className="inline-block px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 font-semibold text-[9px] border border-slate-100">
      {quartile}
    </span>
  )
}

export function ScoreIntegratorPage() {
  // Inner tab and data viewer state
  const [activeTab, setActiveTab] = useState<'tool' | 'data'>('data')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [selectedWosIndex, setSelectedWosIndex] = useState<string>('')
  const [selectedQuartile, setSelectedQuartile] = useState<string>('')
  const [mappedOnly, setMappedOnly] = useState(false)
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

  // Integrator Task State from Zustand Store
  const { taskId, taskStatus, consoleLogs } = useCrawlerStore((state) => state.integrator)
  const setTaskState = useCrawlerStore((state) => state.setTaskState)
  const addConsoleLog = useCrawlerStore((state) => state.addConsoleLog)
  const clearLogs = useCrawlerStore((state) => state.clearLogs)

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 450)
    return () => clearTimeout(handler)
  }, [searchQuery])

  // Fetch integrated journals database list
  useEffect(() => {
    if (activeTab !== 'data') return
    
    let isMounted = true
    const fetchData = async () => {
      setIsLoadingData(true)
      try {
        const res = await scholarApi.getMappedData({
          q: debouncedSearchQuery,
          wos_index: selectedWosIndex,
          quartile: selectedQuartile,
          mapped_only: mappedOnly
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
        toast.error('Lỗi khi tải dữ liệu đối khớp tích hợp từ database')
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
  }, [activeTab, debouncedSearchQuery, selectedWosIndex, selectedQuartile, mappedOnly])


  useEffect(() => {
    if (!taskId) return

    const pollInterval = setInterval(async () => {
      try {
        const res = await scholarApi.getCrawlerTaskStatus(taskId).then((r) => r.data)
        setTaskState('integrator', { taskStatus: res.status })
        
        if (res.status === 'PROGRESS') {
          if (res.message) {
            addConsoleLog('integrator', res.message)
          }
        } else if (res.status === 'SUCCESS') {
          setTaskState('integrator', { taskId: null })
          clearInterval(pollInterval)
          addConsoleLog('integrator', '>>> HOÀN THÀNH: Tích hợp dữ liệu và đối khớp thành công!')
          addConsoleLog('integrator', `  Tổng số tạp chí đã cập nhật liên kết: ${res.result?.integrated_count || 0}`)
          toast.success('Đối khớp tích hợp CSDL đã hoàn tất!')
          fetchStats()
        } else if (res.status === 'FAILURE') {
          setTaskState('integrator', { taskId: null })
          clearInterval(pollInterval)
          const err = res.message || 'Lỗi không xác định.'
          addConsoleLog('integrator', `>>> LỖI: ${err}`)
          toast.error(`Tích hợp CSDL thất bại: ${err}`)
          fetchStats()
        }
      } catch (err: any) {
        console.error('Error polling integration task:', err)
      }
    }, 1500)

    return () => clearInterval(pollInterval)
  }, [taskId, setTaskState, addConsoleLog])

  const handleStartIntegration = async () => {
    clearLogs('integrator')
    addConsoleLog('integrator', '=== KHỞI ĐỘNG SCORE INTEGRATOR (MASTER MAPPED DB) ===')
    addConsoleLog('integrator', '[System] Đang chuẩn bị nạp bộ nhớ đệm ISSN từ BioxBio và SCImago...')
    addConsoleLog('integrator', '[System] Tiến hành thuật toán đối khớp kép (Double-Matching Strategy):')
    addConsoleLog('integrator', '  - Bước 1: So khớp Clarivate với BioxBio bằng ISSN/eISSN trước, Title sau.')
    addConsoleLog('integrator', '  - Bước 2: So khớp Clarivate với SCImago bằng ISSN/eISSN trước, Title sau.')
    addConsoleLog('integrator', '  - Bước 3: Hợp nhất lịch sử rankings và điểm số Impact Factor/SJR mới nhất.')
    addConsoleLog('integrator', '[System] Đang gửi yêu cầu đến Celery Worker...')
    
    setTaskState('integrator', { taskStatus: 'PENDING', progress: 5 })
    
    try {
      const res = await scholarApi.startIntegration().then((r) => r.data)
      setTaskState('integrator', { taskId: res.task_id })
      addConsoleLog('integrator', `[System] Đã kích hoạt Celery Task ID: ${res.task_id}`)
    } catch (err: any) {
      toast.error('Không thể kích hoạt bộ tích hợp.')
      addConsoleLog('integrator', `[System] Lỗi kích hoạt: ${err.message}`)
      setTaskState('integrator', { taskStatus: 'IDLE' })
    }
  }

  const handleStopCrawl = () => {
    setTaskState('integrator', { taskId: null, taskStatus: 'IDLE' })
    addConsoleLog('integrator', '>>> ĐÃ DỪNG: Ngắt kết nối theo dõi tác vụ tích hợp.')
    toast.info('Đã dừng theo dõi tiến trình.')
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
              <GitMerge className="h-4.5 w-4.5 text-[#005b9a]" />
              Bảng điều khiển Score Integrator
            </h3>
            <CustomSelect
              value={activeTab}
              onChange={(val) => setActiveTab(val as 'tool' | 'data')}
              options={[
                { value: 'data', label: 'Chế độ: Xem dữ liệu tích hợp' },
                { value: 'tool', label: 'Chế độ: Công cụ tích hợp' }
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

              {/* Mapped Mode Dropdown */}
              <CustomSelect
                value={mappedOnly ? 'mapped' : 'all'}
                onChange={(val) => setMappedOnly(val === 'mapped')}
                options={[
                  { value: 'all', label: 'Tất cả tạp chí (WoS)' },
                  { value: 'mapped', label: 'Chỉ tạp chí đã đối khớp' }
                ]}
                className="text-slate-700 font-bold py-1.5"
                dropdownClassName="min-w-[210px]"
              />

              {/* WoS Index Select */}
              <CustomSelect
                value={selectedWosIndex}
                onChange={(val) => setSelectedWosIndex(val)}
                options={[
                  { value: '', label: 'Tất cả chỉ mục Core' },
                  { value: 'SCIE', label: 'SCIE' },
                  { value: 'SSCI', label: 'SSCI' },
                  { value: 'AHCI', label: 'AHCI' },
                  { value: 'ESCI', label: 'ESCI' }
                ]}
                className="text-slate-700 font-bold py-1.5"
                dropdownClassName="min-w-[180px]"
              />

              {/* Quartile Select */}
              <CustomSelect
                value={selectedQuartile}
                onChange={(val) => setSelectedQuartile(val)}
                options={[
                  { value: '', label: 'Tất cả phân hạng (Quartile)' },
                  { value: 'Q1', label: 'Q1' },
                  { value: 'Q2', label: 'Q2' },
                  { value: 'Q3', label: 'Q3' },
                  { value: 'Q4', label: 'Q4' }
                ]}
                className="text-slate-700 font-bold py-1.5"
                dropdownClassName="min-w-[220px]"
              />
            </div>
          )}
        </div>
      </Card>

      {activeTab === 'tool' ? (
        <>
          {/* Visual Workflow Steps - Matches Tool 1, 2, 3, 4 design */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-[#005b9a]" />
              QUY TRÌNH THỰC HIỆN CÔNG CỤ
            </h3>
            <div className="grid gap-2 grid-cols-2 md:grid-cols-5 lg:grid-cols-5 items-center">
              {[
                { id: 1, label: '1. Tải CSDL raw', desc: 'BioxBio, SJR, Clarivate' },
                { id: 2, label: '2. Kết nối CSDL', desc: 'Nạp cache bộ nhớ đệm' },
                { id: 3, label: '3. So khớp kép', desc: 'Thuật toán tích hợp' },
                { id: 4, label: '4. Đồng bộ hóa', desc: 'Ghi đè clarivate_mapped.db' },
                { id: 5, label: '5. Hoàn tất', desc: 'CSDL tích hợp sẵn sàng' }
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

          {/* Horizontal configuration bar - Unified look */}
          <Card className="border-slate-100 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                <div className="flex-1 w-full flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#e6f0f7] text-[#005b9a]">
                    <GitMerge className="h-5 w-5" />
                  </div>
                  <div className="leading-tight">
                    <div className="text-xs font-bold text-slate-800">Cơ chế tự động hóa tích hợp</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Sử dụng chiến lược so khớp kép (Double-Matching) kết nối ISSN và Title chuẩn hóa của 3 cơ sở dữ liệu gốc.</div>
                  </div>
                </div>

                <div className="shrink-0 w-full lg:w-auto">
                  {taskStatus === 'PENDING' || taskStatus === 'PROGRESS' ? (
                    <button
                      onClick={handleStopCrawl}
                      className="w-full lg:w-44 flex items-center justify-center gap-2 rounded-lg py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs cursor-pointer transition-colors shadow-xs"
                    >
                      <Square className="h-3.5 w-3.5" />
                      <span>Dừng tích hợp</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleStartIntegration}
                      className="w-full lg:w-44 flex items-center justify-center gap-2 rounded-lg py-2 bg-[#005b9a] hover:bg-[#004677] text-white font-bold text-xs cursor-pointer transition-colors shadow-xs"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Kích hoạt Đối khớp</span>
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
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                  <HelpCircle className="h-4.5 w-4.5 text-[#005b9a]" />
                  Chi tiết cơ chế đối khớp kép (Double-Matching)
                </h3>
                
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e6f0f7] text-xs font-bold text-[#005b9a]">1</div>
                    <div className="text-xs font-bold text-slate-700">1. Đối sánh ISSN</div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      So khớp trùng khớp tuyệt đối theo mã ISSN hoặc eISSN thô từ BioxBio và SCImago vào bảng Clarivate gốc.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e6f0f7] text-xs font-bold text-[#005b9a]">2</div>
                    <div className="text-xs font-bold text-slate-700">2. So khớp Tên chuẩn hóa</div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Chuẩn hóa tên tạp chí (loại bỏ khoảng trắng, ký tự đặc biệt, "The", "and") để truy vết chéo nếu ISSN bị thiếu.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e6f0f7] text-xs font-bold text-[#005b9a]">3</div>
                    <div className="text-xs font-bold text-slate-700">3. Tính toán Ranking & IF</div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Hợp nhất Impact Factor cao nhất từ BioxBio, SJR và Quartile tương ứng từ SCImago vào CSDL đích Clarivate Mapped.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#e6f0f7]/50 rounded-lg border border-[#b8d4e9] text-[11px] text-[#005b9a] flex gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Lưu ý: Tác vụ này chạy trực tiếp trên server qua celery background worker. Cơ sở dữ liệu đích sẽ tự động cập nhật ngay sau khi tiến trình hoàn thành.</span>
                </div>
              </Card>
            </div>

            {/* Right Side: Console output - displays dynamically and is highly compact */}
            {isScrawling && (
              <div className="lg:col-span-1 flex flex-col gap-4">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Màn hình tiến trình chạy</h2>
                <div className="h-fit">
                  <TerminalWindow
                    title="Score Integrator Console Output"
                    logs={consoleLogs}
                    onClear={() => clearLogs('integrator')}
                    isRunning={taskStatus === 'PENDING' || taskStatus === 'PROGRESS'}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Mapped/Integrated Data Viewer Tab */
        <Card className="border-slate-100 shadow-sm bg-white p-6 overflow-visible">

          {/* Prominent Database Metric Card - Compact Version */}
          <div className="mb-4 bg-gradient-to-r from-blue-50 to-[#e6f0f7]/50 border border-[#b8d4e9]/70 rounded-lg py-2 px-3.5 flex items-center justify-between shadow-3xs animate-in fade-in duration-300">
            <div className="flex items-center gap-2.5">
              <GitMerge className="h-4 w-4 text-[#005b9a]" />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[11px] font-bold text-slate-555 uppercase tracking-wider">
                  CSDL Tích hợp & Đối khớp:
                </span>
                <span className="text-base font-extrabold text-[#005b9a]">
                  {dbStats ? dbStats.mapped_journals.toLocaleString() : '---'}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">
                  tạp chí đã liên kết
                </span>
                {dbStats && dbStats.staging_journals > 0 && (
                  <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100/50 animate-pulse">
                    +{dbStats.staging_journals.toLocaleString()} staging
                  </span>
                )}
                {dbStats && (
                  <span className="text-[10px] font-bold text-[#005b9a] bg-[#e6f0f7]/60 px-1.5 py-0.5 rounded border border-[#b8d4e9]/30 ml-1">
                    Tỷ lệ khớp: {dbStats.match_rate}%
                  </span>
                )}
              </div>
            </div>
            <div className="hidden sm:block">
              <span className="text-[10px] font-bold text-slate-400">
                scholar_cv_all
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
              <p className="text-xs text-slate-550 font-medium">Không tìm thấy dữ liệu nào trong database.</p>
              <span className="text-[10px] text-slate-400 block mt-1">Hãy chạy Công cụ tích hợp trước nếu cơ sở dữ liệu trống.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Journal List (col-span-2) */}
              <div className="lg:col-span-2 overflow-x-auto border border-slate-100 rounded-xl bg-white">
                <table className="w-full min-w-[700px] text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 font-bold">
                      <th className="p-3">Tên tạp chí</th>
                      <th className="p-3 w-32 whitespace-nowrap">ISSN / eISSN</th>
                      <th className="p-3 w-28 whitespace-nowrap">Impact Factor</th>
                      <th className="p-3 w-28 whitespace-nowrap">SJR / Quartile</th>
                      <th className="p-3 w-28 whitespace-nowrap">Chỉ mục Core</th>
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
                        <td className="p-3">
                          <div className={cn(
                            "font-bold",
                            selectedJournal?.id === row.id ? "text-[#005b9a]" : "text-slate-800"
                          )}>{row.clarivate_title || row.title_normalized}</div>
                        </td>
                        <td className="p-3 whitespace-nowrap w-32">
                          <div className="flex flex-col gap-0.5 font-mono text-[9px]">
                            <span className="text-slate-600">ISSN: {row.issn || '-'}</span>
                            {row.eissn && (
                              <span className="text-slate-400">eISSN: {row.eissn}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap w-28">
                          {row.latest_if !== null ? (
                            <span className="font-bold text-slate-800">
                              {row.latest_if.toFixed(3)}
                              {row.latest_if_year && (
                                <span className="text-[9px] text-slate-400 font-normal ml-0.5">({row.latest_if_year})</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap w-28">
                          <div className="flex items-center gap-1.5">
                            {row.latest_sjr !== null ? (
                              <span className="font-semibold text-slate-700">{row.latest_sjr.toFixed(3)}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                            {getQuartileBadge(row.latest_quartile)}
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap w-28">
                          {row.wos_core_collection ? (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-violet-50 text-violet-750 font-bold text-[9px] border border-violet-100 uppercase whitespace-nowrap">
                              {getShortWosIndex(row.wos_core_collection)}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Right Column: Detailed Info (col-span-1) */}
              <div className="lg:col-span-1 lg:sticky lg:top-[74px] md:lg:top-[80px] self-start">
                {selectedJournal ? (
                  <Card className="border border-slate-100 rounded-xl bg-slate-50/30 overflow-hidden shadow-2xs h-fit">
                    <CardContent className="p-4 flex flex-col gap-4">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Chi tiết tạp chí đối khớp
                        </span>
                        <h4 className="text-xs font-bold text-[#005b9a] leading-tight">
                          {selectedJournal.clarivate_title || selectedJournal.title_normalized}
                        </h4>
                        <div className="text-[9px] text-slate-400 mt-1 font-mono break-all">
                          Normalized: {selectedJournal.title_normalized}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 text-xs border-y border-slate-100 py-3">
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">Quốc gia</span>
                          <span className="font-semibold text-slate-600">{selectedJournal.country || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">Mã ISSN / eISSN</span>
                          <span className="font-mono text-slate-705 font-semibold">{selectedJournal.issn || selectedJournal.eissn || '-'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">Nhà xuất bản</span>
                          <span className="font-semibold text-slate-800 break-words">{selectedJournal.publisher || 'N/A'}</span>
                        </div>
                      </div>

                      {/* Integrated Metrics Section */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                          Chỉ số học thuật tích hợp
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white p-2.5 rounded-lg border border-slate-100 flex flex-col gap-0.5">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Impact Factor (IF)</span>
                            <span className="text-xs font-bold text-slate-800">
                              {selectedJournal.latest_if !== null ? selectedJournal.latest_if.toFixed(3) : 'N/A'}
                            </span>
                            {selectedJournal.latest_if_year && (
                              <span className="text-[8px] text-slate-400">Năm cập nhật: {selectedJournal.latest_if_year}</span>
                            )}
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-slate-100 flex flex-col gap-0.5">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">SJR Score</span>
                            <span className="text-xs font-bold text-slate-800">
                              {selectedJournal.latest_sjr !== null ? selectedJournal.latest_sjr.toFixed(3) : 'N/A'}
                            </span>
                            {selectedJournal.latest_sjr_year && (
                              <span className="text-[8px] text-slate-400">Năm cập nhật: {selectedJournal.latest_sjr_year}</span>
                            )}
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-slate-100 flex flex-col gap-0.5">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Phân hạng (Quartile)</span>
                            <div className="mt-0.5">{getQuartileBadge(selectedJournal.latest_quartile)}</div>
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-slate-100 flex flex-col gap-0.5">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">H-Index (SCImago)</span>
                            <span className="text-xs font-bold text-slate-800">
                              {selectedJournal.latest_h_index !== null ? selectedJournal.latest_h_index : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Mapping details / status */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                          Nguồn & Trạng thái đối khớp chéo
                        </span>
                        
                        <div className="space-y-3 bg-white border border-slate-100 rounded-lg p-3">
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Web of Science Core Collection</span>
                            {selectedJournal.wos_core_collection ? (
                              <span className="inline-block px-2 py-0.5 rounded bg-violet-50 text-violet-750 font-semibold text-[10px] border border-violet-100 break-words font-mono">
                                {selectedJournal.wos_core_collection}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px] italic">Không thuộc Core Collection</span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 border-t border-slate-50 pt-2.5">
                            <div>
                              <span className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Nguồn BioxBio</span>
                              <div className="mt-0.5">{getMatchBadge(selectedJournal.bioxbio_match)}</div>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Nguồn SCImago</span>
                              <div className="mt-0.5">{getMatchBadge(selectedJournal.scimago_match)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/30 text-slate-400 text-xs h-32">
                    Chọn một tạp chí bên danh sách để xem chi tiết đối khớp và chỉ số.
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

