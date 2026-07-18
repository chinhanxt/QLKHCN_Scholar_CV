import { useState, useEffect, useRef } from 'react'
import { scholarApi } from '@/api/endpoints/scholar'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Layers, Play, Square, Loader2, Zap, Trash2, Copy, Terminal, CheckCircle2, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react'
import { useCrawlerStore } from '@/stores/crawler.store'

export function UnifiedCrawlerPage() {
  // Config states
  const [scimagoYearsRaw, setScimagoYearsRaw] = useState<string>('2024, 2023, 2022')
  const [scimagoWorkers, setScimagoWorkers] = useState<number>(5)
  const [scimagoDelay, setScimagoDelay] = useState<number>(1)

  const [clarivateMaxPages, setClarivateMaxPages] = useState<number | null>(null)
  const [clarivateWorkers, setClarivateWorkers] = useState<number>(3)
  const [clarivateDelay, setClarivateDelay] = useState<number>(1.5)

  const [bioxbioStartUrl, setBioxbioStartUrl] = useState<string>('https://www.bioxbio.com/journal/')
  const [bioxbioWorkers, setBioxbioWorkers] = useState<number>(10)
  const [bioxbioDelay, setBioxbioDelay] = useState<number>(2)

  const [showConfig, setShowConfig] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)

  // Sub-task progress states parsed from task status info
  const [clProgress, setClProgress] = useState<any>({ status: 'PENDING', progress: 0, message: 'Đang chờ...' })
  const [scProgress, setScProgress] = useState<any>({ status: 'PENDING', progress: 0, message: 'Đang chờ...' })
  const [bbProgress, setBbProgress] = useState<any>({ status: 'PENDING', progress: 0, message: 'Đang chờ...' })
  const [mapProgress, setMapProgress] = useState<any>({ status: 'PENDING', progress: 0, message: 'Đang chờ...' })

  // Crawler Task State from Zustand Store
  const { taskId, taskStatus, progress: masterProgress, consoleLogs } = useCrawlerStore((state) => state.unified)
  const setTaskState = useCrawlerStore((state) => state.setTaskState)
  const addConsoleLog = useCrawlerStore((state) => state.addConsoleLog)
  const clearLogs = useCrawlerStore((state) => state.clearLogs)

  const consoleEndRef = useRef<HTMLDivElement>(null)

  // Polling logic
  useEffect(() => {
    if (!taskId) return

    const pollInterval = setInterval(async () => {
      try {
        const res = await scholarApi.getCrawlerTaskStatus(taskId).then((r) => r.data)
        
        // Update general status
        setTaskState('unified', { 
          taskStatus: res.status,
          progress: res.progress || 0
        })

        // Update sub-task metadata
        if (res.result) {
          // Task completed
          setClProgress({ status: 'SUCCESS', progress: 100, message: 'Hoàn tất cào dữ liệu' })
          setScProgress({ status: 'SUCCESS', progress: 100, message: 'Hoàn tất tải và import CSV' })
          setBbProgress({ status: 'SUCCESS', progress: 100, message: 'Hoàn tất cào dữ liệu' })
          setMapProgress({ status: 'SUCCESS', progress: 100, message: 'Đồng bộ mapping thành công!' })
        } else if (res.status === 'PROGRESS' && res.message) {
          addConsoleLog('unified', res.message)
        }
      } catch (err) {
        console.error('Error polling status:', err)
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [taskId])

  // Auto-scroll logic
  useEffect(() => {
    if (autoScroll) {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [consoleLogs, autoScroll])

  // Custom parser of sub-tasks info from logs
  useEffect(() => {
    if (consoleLogs.length === 0) return
    const lastLog = consoleLogs[consoleLogs.length - 1]

    if (lastLog.includes('Clarivate:')) {
      const parts = lastLog.split('|')
      const msg = parts[0]?.replace('Clarivate:', '').trim()
      setClProgress({ status: 'PROGRESS', progress: 50, message: msg })
    } else if (lastLog.includes('Processed page')) {
      setClProgress({ status: 'PROGRESS', progress: 75, message: lastLog })
    } else if (lastLog.includes('BioxBio:')) {
      const parts = lastLog.split('|')
      const msg = parts[0]?.replace('BioxBio:', '').trim()
      const match = lastLog.match(/Trang (\d+)\/(\d+)/)
      let pct = 40
      if (match && match[1] && match[2]) {
        pct = Math.round((parseInt(match[1]) / parseInt(match[2])) * 100)
      }
      setBbProgress({ status: 'PROGRESS', progress: pct, message: msg })
    } else if (lastLog.includes('Downloading SCImago CSV') || lastLog.includes('Importing SCImago')) {
      setScProgress({ status: 'PROGRESS', progress: 50, message: lastLog })
    } else if (lastLog.includes('Mapping & tích hợp')) {
      const match = lastLog.match(/(\d+)%/)
      let pct = 10
      if (match && match[1]) pct = parseInt(match[1])
      setMapProgress({ status: 'PROGRESS', progress: pct, message: lastLog })
    } else if (lastLog.includes('Self-Healing')) {
      if (lastLog.includes('Clarivate')) {
        setClProgress({ status: 'PROGRESS', progress: 90, message: lastLog })
      } else if (lastLog.includes('BioxBio')) {
        setBbProgress({ status: 'PROGRESS', progress: 90, message: lastLog })
      }
    }
  }, [consoleLogs])

  const handleStartCrawl = async () => {
    const years = scimagoYearsRaw
      .split(',')
      .map((y) => parseInt(y.trim()))
      .filter((y) => !isNaN(y))

    if (years.length === 0) {
      toast.error('Vui lòng nhập ít nhất một năm cho SCImago (ví dụ: 2024).')
      return
    }

    clearLogs('unified')
    setClProgress({ status: 'PROGRESS', progress: 5, message: 'Đang khởi động...' })
    setScProgress({ status: 'PROGRESS', progress: 5, message: 'Đang khởi động...' })
    setBbProgress({ status: 'PROGRESS', progress: 5, message: 'Đang khởi động...' })
    setMapProgress({ status: 'PENDING', progress: 0, message: 'Đang chờ các crawler thô...' })

    try {
      const payload = {
        scimago_years: years,
        scimago_workers: scimagoWorkers,
        scimago_delay: scimagoDelay,
        clarivate_max_pages: clarivateMaxPages,
        clarivate_workers: clarivateWorkers,
        clarivate_delay: clarivateDelay,
        bioxbio_start_url: bioxbioStartUrl,
        bioxbio_workers: bioxbioWorkers,
        bioxbio_delay: bioxbioDelay,
      }

      const res = await scholarApi.startUnifiedCrawl(payload).then((r) => r.data)
      setTaskState('unified', {
        taskId: res.task_id,
        taskStatus: 'PROGRESS',
        progress: 2,
      })
      addConsoleLog('unified', '🚀 Khởi chạy hệ thống cào song song (Clarivate + SCImago + BioxBio)...')
      toast.success('Hệ thống cào và đồng bộ song song đã bắt đầu!')
      setShowConfig(false)
    } catch (err) {
      console.error(err)
      toast.error('Lỗi khi kích hoạt tiến trình cào song song.')
    }
  }

  const handleStopCrawl = () => {
    setTaskState('unified', { taskId: null, taskStatus: 'IDLE', progress: 0 })
    setClProgress({ status: 'PENDING', progress: 0, message: 'Đã dừng' })
    setScProgress({ status: 'PENDING', progress: 0, message: 'Đã dừng' })
    setBbProgress({ status: 'PENDING', progress: 0, message: 'Đã dừng' })
    setMapProgress({ status: 'PENDING', progress: 0, message: 'Đã dừng' })
    addConsoleLog('unified', '🛑 Tiến trình cào và đồng bộ đã được dừng bởi người dùng.')
    toast.info('Đã dừng theo dõi tiến trình cào.')
  }

  const handleCopyLogs = () => {
    if (consoleLogs.length === 0) return
    navigator.clipboard.writeText(consoleLogs.join('\n'))
    toast.success('Đã sao chép toàn bộ logs vào clipboard!')
  }

  const handleClearLogs = () => {
    clearLogs('unified')
    toast.info('Đã xóa logs.')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Hoàn thành</span>
      case 'PROGRESS':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-[#005b9a]"><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Đang chạy</span>
      case 'FAILURE':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800"><AlertCircle className="w-3.5 h-3.5 mr-1" /> Thất bại</span>
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">Đang chờ</span>
    }
  }

  const isRunning = taskStatus === 'PENDING' || taskStatus === 'PROGRESS'

  return (
    <div className="space-y-4 max-w-7xl mx-auto p-2">
      {/* Header section - Matches exactly screenshot styles (light theme) */}
      <Card className="rounded-xl border border-slate-200 bg-white shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#e6f0f7] rounded-xl border border-[#b8d4e9] text-[#005b9a]">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Bộ Cào & Mapping Song Song</h1>
            <p className="text-slate-500 text-xs mt-1">
              Điều phối song song 3 nguồn Clarivate, SCImago, BioxBio và tự động chạy Healing + Mapping.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isRunning ? (
            <button
              onClick={handleStopCrawl}
              className="inline-flex items-center justify-center px-5 py-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-all text-rose-600 text-xs font-bold gap-2 cursor-pointer shadow-xs"
            >
              <Square className="w-3.5 h-3.5" /> Dừng Hủy Theo Dõi
            </button>
          ) : (
            <button
              onClick={handleStartCrawl}
              className="inline-flex items-center justify-center px-5 py-2 rounded-lg bg-[#005b9a] hover:bg-[#004b7c] transition-all text-white text-xs font-bold gap-2 cursor-pointer shadow-xs"
            >
              <Play className="w-3.5 h-3.5" /> Kích Hoạt Hệ Thống
            </button>
          )}
        </div>
      </Card>

      {/* Main configuration panel with header toggle button */}
      <Card className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between text-slate-800 font-semibold text-sm bg-white">
          <div className="flex items-center gap-2">
            <Zap className="w-4.5 h-4.5 text-[#005b9a]" /> Bảng điều khiển cấu hình tham số
          </div>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 cursor-pointer bg-white flex items-center justify-center"
            title={showConfig ? "Thu gọn cấu hình" : "Mở rộng cấu hình"}
          >
            {showConfig ? <ChevronUp className="w-4.5 h-4.5" /> : <ChevronDown className="w-4.5 h-4.5" />}
          </button>
        </div>
        {showConfig && (
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-white">
            {/* Clarivate config */}
            <div className="space-y-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-3xs">
              <h4 className="font-bold text-slate-800 text-sm pb-3 border-b border-slate-100 flex items-center justify-between">
                <span>1. Cấu hình Clarivate (WoS)</span>
                <span className={cn(
                  "w-2.5 h-2.5 rounded-full bg-emerald-500 transition-all duration-300",
                  isRunning && "animate-pulse"
                )}></span>
              </h4>
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Giới hạn trang cào (Trống = Tất cả)</label>
                  <input
                    type="number"
                    value={clarivateMaxPages || ''}
                    onChange={(e) => setClarivateMaxPages(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Tự động quét tất cả"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-855 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#005b9a]/20 focus:border-[#005b9a] hover:border-slate-350 transition-all font-semibold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Số luồng (Workers)</label>
                    <input
                      type="number"
                      value={clarivateWorkers}
                      onChange={(e) => setClarivateWorkers(parseInt(e.target.value) || 3)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-855 focus:outline-none focus:ring-2 focus:ring-[#005b9a]/20 focus:border-[#005b9a] hover:border-slate-350 transition-all font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Độ trễ (Delay s)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={clarivateDelay}
                      onChange={(e) => setClarivateDelay(parseFloat(e.target.value) || 1.5)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-855 focus:outline-none focus:ring-2 focus:ring-[#005b9a]/20 focus:border-[#005b9a] hover:border-slate-350 transition-all font-semibold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SCImago config */}
            <div className="space-y-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-3xs">
              <h4 className="font-bold text-slate-800 text-sm pb-3 border-b border-slate-100 flex items-center justify-between">
                <span>2. Cấu hình SCImago (SJR)</span>
                <span className={cn(
                  "w-2.5 h-2.5 rounded-full bg-emerald-500 transition-all duration-300",
                  isRunning && "animate-pulse"
                )}></span>
              </h4>
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Các năm cần cào (Ngăn cách bằng dấu phẩy)</label>
                  <input
                    type="text"
                    value={scimagoYearsRaw}
                    onChange={(e) => setScimagoYearsRaw(e.target.value)}
                    placeholder="2024, 2023, 2022"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-855 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#005b9a]/20 focus:border-[#005b9a] hover:border-slate-350 transition-all font-semibold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Số luồng (Workers)</label>
                    <input
                      type="number"
                      value={scimagoWorkers}
                      onChange={(e) => setScimagoWorkers(parseInt(e.target.value) || 5)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-855 focus:outline-none focus:ring-2 focus:ring-[#005b9a]/20 focus:border-[#005b9a] hover:border-slate-350 transition-all font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Độ trễ (Delay s)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={scimagoDelay}
                      onChange={(e) => setScimagoDelay(parseFloat(e.target.value) || 1.0)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-855 focus:outline-none focus:ring-2 focus:ring-[#005b9a]/20 focus:border-[#005b9a] hover:border-slate-350 transition-all font-semibold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* BioxBio config */}
            <div className="space-y-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-3xs">
              <h4 className="font-bold text-slate-800 text-sm pb-3 border-b border-slate-100 flex items-center justify-between">
                <span>3. Cấu hình BioxBio (IF)</span>
                <span className={cn(
                  "w-2.5 h-2.5 rounded-full bg-emerald-500 transition-all duration-300",
                  isRunning && "animate-pulse"
                )}></span>
              </h4>
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Đường dẫn quét danh sách (Start URL)</label>
                  <input
                    type="text"
                    value={bioxbioStartUrl}
                    onChange={(e) => setBioxbioStartUrl(e.target.value)}
                    placeholder="https://www.bioxbio.com/journal/"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-855 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#005b9a]/20 focus:border-[#005b9a] hover:border-slate-350 transition-all font-semibold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Số luồng (Workers)</label>
                    <input
                      type="number"
                      value={bioxbioWorkers}
                      onChange={(e) => setBioxbioWorkers(parseInt(e.target.value) || 10)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-855 focus:outline-none focus:ring-2 focus:ring-[#005b9a]/20 focus:border-[#005b9a] hover:border-slate-350 transition-all font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Độ trễ (Delay s)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={bioxbioDelay}
                      onChange={(e) => setBioxbioDelay(parseFloat(e.target.value) || 2.0)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-855 focus:outline-none focus:ring-2 focus:ring-[#005b9a]/20 focus:border-[#005b9a] hover:border-slate-350 transition-all font-semibold"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Progress & Live Monitors */}
      {isRunning && (
        <div className="space-y-4">
          {/* Master Progress Bar */}
          <Card className="rounded-xl border border-slate-200 bg-white shadow-xs p-5">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-[#005b9a] animate-spin" /> Tiến độ tổng hợp dự án
              </span>
              <span className="text-sm font-bold text-[#005b9a]">{masterProgress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 p-0.5 border border-slate-200">
              <div 
                className="bg-[#005b9a] h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${masterProgress}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-wider">
              <span>0% Khởi động</span>
              <span>75% Cào thô hoàn tất & Healing</span>
              <span>100% Đồng bộ mapping hoàn tất</span>
            </div>
          </Card>

          {/* Sub-Tasks Parallel View */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Clarivate status card */}
            <Card className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-blue-50/15">
                <span className="text-[10px] font-bold text-blue-700 tracking-wider">CLARIVATE CRAWLER</span>
                {getStatusBadge(clProgress.status)}
              </div>
              <div className="p-4 space-y-2.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400">Tiến trình</span>
                  <span className="text-slate-700">{clProgress.progress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${clProgress.progress}%` }}></div>
                </div>
                <p className="text-slate-500 text-xs truncate" title={clProgress.message}>{clProgress.message}</p>
              </div>
            </Card>

            {/* SCImago status card */}
            <Card className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-amber-50/15">
                <span className="text-[10px] font-bold text-amber-700 tracking-wider">SCIMAGO CRAWLER</span>
                {getStatusBadge(scProgress.status)}
              </div>
              <div className="p-4 space-y-2.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400">Tiến trình</span>
                  <span className="text-slate-700">{scProgress.progress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${scProgress.progress}%` }}></div>
                </div>
                <p className="text-slate-500 text-xs truncate" title={scProgress.message}>{scProgress.message}</p>
              </div>
            </Card>

            {/* BioxBio status card */}
            <Card className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-purple-50/15">
                <span className="text-[10px] font-bold text-purple-700 tracking-wider">BIOXBIO CRAWLER</span>
                {getStatusBadge(bbProgress.status)}
              </div>
              <div className="p-4 space-y-2.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400">Tiến trình</span>
                  <span className="text-slate-700">{bbProgress.progress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-purple-500 h-1.5 rounded-full transition-all" style={{ width: `${bbProgress.progress}%` }}></div>
                </div>
                <p className="text-slate-500 text-xs truncate" title={bbProgress.message}>{bbProgress.message}</p>
              </div>
            </Card>

            {/* Mapping integrator status card */}
            <Card className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-emerald-50/15">
                <span className="text-[10px] font-bold text-emerald-700 tracking-wider">SCORE INTEGRATOR</span>
                {getStatusBadge(mapProgress.status)}
              </div>
              <div className="p-4 space-y-2.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400">Tiến trình</span>
                  <span className="text-slate-700">{mapProgress.progress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${mapProgress.progress}%` }}></div>
                </div>
                <p className="text-slate-500 text-xs truncate" title={mapProgress.message}>{mapProgress.message}</p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Terminal logs monitor - Styled 100% like screenshot with light theme container */}
      <Card className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="p-4 px-6 border-b border-slate-100 flex justify-between items-center bg-white">
          <span className="font-semibold text-slate-800 text-sm flex items-center gap-2">
            <Terminal className="w-4.5 h-4.5 text-[#005b9a]" /> Live Console Log Monitor
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClearLogs}
              disabled={consoleLogs.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-550 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer bg-white"
            >
              <Trash2 className="w-3.5 h-3.5" /> Xóa log
            </button>
            <button
              onClick={handleCopyLogs}
              disabled={consoleLogs.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-550 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer bg-white"
            >
              <Copy className="w-3.5 h-3.5" /> Sao chép
            </button>
            
            {/* Auto-scroll custom toggle */}
            <div className="flex items-center gap-2.5 ml-3 border-l border-slate-200 pl-4">
              <span className="text-xs text-slate-600 font-bold select-none">Tự động cuộn</span>
              <button
                type="button"
                onClick={() => setAutoScroll(!autoScroll)}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#005b9a]/20",
                  autoScroll ? "bg-[#005b9a]" : "bg-slate-200"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                    autoScroll ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white min-h-[300px]">
          {consoleLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              {/* Custom SVG window terminal design as shown in screenshot */}
              <svg className="w-16 h-16" viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="90" height="70" rx="8" stroke="#b8d4e9" strokeWidth="2.5" fill="none" />
                <line x1="5" y1="22" x2="95" y2="22" stroke="#b8d4e9" strokeWidth="2" />
                <circle cx="15" cy="13" r="2.5" fill="#b8d4e9" />
                <circle cx="24" cy="13" r="2.5" fill="#b8d4e9" />
                <circle cx="33" cy="13" r="2.5" fill="#b8d4e9" />
                <path d="M22 36 L32 44 L22 52" stroke="#005b9a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="37" y1="52" x2="54" y2="52" stroke="#005b9a" strokeWidth="3.5" strokeLinecap="round" />
              </svg>
              <h4 className="font-bold text-slate-800 text-sm mt-2">Chưa có log sự kiện nào được ghi nhận.</h4>
              <p className="text-slate-400 text-xs">Vui lòng kích hoạt bộ cào để xem.</p>
            </div>
          ) : (
            <div className="h-[280px] overflow-y-auto p-4 font-mono text-[12px] text-slate-700 bg-slate-50/40 border border-slate-200 rounded-xl space-y-1 scrollbar-thin scrollbar-thumb-slate-200">
              {consoleLogs.map((log, index) => {
                let colorClass = 'text-slate-600'
                if (log.includes('Clarivate') || log.includes('page')) colorClass = 'text-blue-600 font-semibold'
                else if (log.includes('SCImago') || log.includes('CSV')) colorClass = 'text-amber-700 font-semibold'
                else if (log.includes('BioxBio')) colorClass = 'text-purple-600 font-semibold'
                else if (log.includes('Mapping') || log.includes('tích hợp')) colorClass = 'text-emerald-700 font-semibold'
                else if (log.includes('Self-Healing')) colorClass = 'text-cyan-700 font-bold'
                else if (log.includes('🚀') || log.includes('🛑')) colorClass = 'text-slate-900 font-bold'
                
                return (
                  <div key={index} className={cn("py-0.5 border-b border-slate-100 hover:bg-slate-100/40 transition-colors", colorClass)}>
                    <span className="text-slate-400 mr-2">[{new Date().toLocaleTimeString()}]</span>
                    <span>{log}</span>
                  </div>
                )
              })}
              <div ref={consoleEndRef} />
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
