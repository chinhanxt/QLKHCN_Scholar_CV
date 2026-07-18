import { useState, useEffect } from 'react'
import { scholarApi } from '@/api/endpoints/scholar'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Layers, Play, Square, Loader2, RefreshCw, Zap, CheckCircle2, AlertCircle } from 'lucide-react'
import { useCrawlerStore } from '@/stores/crawler.store'

export function UnifiedCrawlerPage() {
  // Config states
  const [scimagoYearsRaw, setScimagoYearsRaw] = useState<string>('2024, 2023, 2022')
  const [scimagoWorkers, setScimagoWorkers] = useState<number>(5)
  const [scimagoDelay, setScimagoDelay] = useState<number>(1.0)

  const [clarivateMaxPages, setClarivateMaxPages] = useState<number | null>(null)
  const [clarivateWorkers, setClarivateWorkers] = useState<number>(3)
  const [clarivateDelay, setClarivateDelay] = useState<number>(1.5)

  const [bioxbioStartUrl, setBioxbioStartUrl] = useState<string>('https://www.bioxbio.com/journal/')
  const [bioxbioWorkers, setBioxbioWorkers] = useState<number>(10)
  const [bioxbioDelay, setBioxbioDelay] = useState<number>(2.0)

  const [showConfig, setShowConfig] = useState(true)

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
    toast.info('Đã hủy theo dõi tiến trình.')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Hoàn thành</span>
      case 'PROGRESS':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Đang chạy</span>
      case 'FAILURE':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400"><AlertCircle className="w-3.5 h-3.5 mr-1" /> Thất bại</span>
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400">Đang chờ</span>
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Header section with glassmorphism */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400 shadow-inner">
            <Layers className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Bộ Cào & Mapping Song Song</h1>
            <p className="text-slate-400 text-sm mt-1">
              Điều phối song song 3 nguồn Clarivate, SCImago, BioxBio và tự động chạy Healing + Mapping.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {taskStatus === 'PROGRESS' ? (
            <button
              onClick={handleStopCrawl}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500 hover:text-white transition-all duration-200 text-rose-400 text-sm font-semibold shadow-lg shadow-rose-950/20 gap-2"
            >
              <Square className="w-4 h-4" /> Dừng Hủy Theo Dõi
            </button>
          ) : (
            <button
              onClick={handleStartCrawl}
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition-all duration-200 text-white text-sm font-semibold shadow-lg shadow-indigo-950/40 gap-2 border border-indigo-400/20"
            >
              <Play className="w-4 h-4" /> Kích Hoạt Hệ Thống
            </button>
          )}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 transition-colors text-slate-400"
            title="Ẩn/Hiện Cấu Hình"
          >
            <RefreshCw className={cn("w-4 h-4", taskStatus === 'PROGRESS' && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Main configuration panel */}
      {showConfig && (
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden rounded-2xl">
          <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-400" /> Bảng điều khiển cấu hình tham số
            </h3>
          </div>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Clarivate config */}
            <div className="space-y-4 p-4 rounded-xl bg-slate-950/40 border border-slate-800">
              <h4 className="font-semibold text-white text-sm border-b border-slate-800 pb-2 flex items-center justify-between">
                <span>1. Cấu hình Clarivate (WoS)</span>
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1">Giới hạn trang cào (Trống = Tất cả)</label>
                  <input
                    type="number"
                    value={clarivateMaxPages || ''}
                    onChange={(e) => setClarivateMaxPages(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Tự động quét tất cả"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 font-medium mb-1">Số luồng (Workers)</label>
                    <input
                      type="number"
                      value={clarivateWorkers}
                      onChange={(e) => setClarivateWorkers(parseInt(e.target.value) || 3)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 font-medium mb-1">Độ trễ (Delay s)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={clarivateDelay}
                      onChange={(e) => setClarivateDelay(parseFloat(e.target.value) || 1.5)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SCImago config */}
            <div className="space-y-4 p-4 rounded-xl bg-slate-950/40 border border-slate-800">
              <h4 className="font-semibold text-white text-sm border-b border-slate-800 pb-2 flex items-center justify-between">
                <span>2. Cấu hình SCImago (SJR)</span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1">Các năm cần cào (Ngăn cách bằng dấu phẩy)</label>
                  <input
                    type="text"
                    value={scimagoYearsRaw}
                    onChange={(e) => setScimagoYearsRaw(e.target.value)}
                    placeholder="2024, 2023, 2022"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 font-medium mb-1">Số luồng (Workers)</label>
                    <input
                      type="number"
                      value={scimagoWorkers}
                      onChange={(e) => setScimagoWorkers(parseInt(e.target.value) || 5)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 font-medium mb-1">Độ trễ (Delay s)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={scimagoDelay}
                      onChange={(e) => setScimagoDelay(parseFloat(e.target.value) || 1.0)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* BioxBio config */}
            <div className="space-y-4 p-4 rounded-xl bg-slate-950/40 border border-slate-800">
              <h4 className="font-semibold text-white text-sm border-b border-slate-800 pb-2 flex items-center justify-between">
                <span>3. Cấu hình BioxBio (IF)</span>
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1">Đường dẫn quét danh sách (Start URL)</label>
                  <input
                    type="text"
                    value={bioxbioStartUrl}
                    onChange={(e) => setBioxbioStartUrl(e.target.value)}
                    placeholder="https://www.bioxbio.com/journal/"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 font-medium mb-1">Số luồng (Workers)</label>
                    <input
                      type="number"
                      value={bioxbioWorkers}
                      onChange={(e) => setBioxbioWorkers(parseInt(e.target.value) || 10)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 font-medium mb-1">Độ trễ (Delay s)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={bioxbioDelay}
                      onChange={(e) => setBioxbioDelay(parseFloat(e.target.value) || 2.0)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress & Live Monitors */}
      {taskStatus === 'PROGRESS' && (
        <div className="space-y-6">
          {/* Master Progress Bar */}
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden rounded-2xl p-6">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400 animate-spin" /> Tiến độ tổng hợp dự án
              </span>
              <span className="text-lg font-bold text-indigo-400">{masterProgress}%</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-3.5 p-0.5 border border-slate-800">
              <div 
                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${masterProgress}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-2.5">
              <span>0% (Bắt đầu)</span>
              <span>75% (Hoàn thành cào thô, Chạy Self-Healing)</span>
              <span>100% (Hoàn thành mapping & điểm)</span>
            </div>
          </Card>

          {/* Sub-Tasks Parallel View */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Clarivate status card */}
            <Card className="border-slate-800 bg-slate-900/40 rounded-xl overflow-hidden shadow-md">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-blue-950/10">
                <span className="text-xs font-bold text-blue-400 tracking-wider">CLARIVATE CRAWLER</span>
                {getStatusBadge(clProgress.status)}
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Tiến trình</span>
                  <span className="font-semibold text-slate-200">{clProgress.progress}%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5">
                  <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${clProgress.progress}%` }}></div>
                </div>
                <p className="text-slate-400 text-xs truncate" title={clProgress.message}>{clProgress.message}</p>
              </div>
            </Card>

            {/* SCImago status card */}
            <Card className="border-slate-800 bg-slate-900/40 rounded-xl overflow-hidden shadow-md">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-amber-950/10">
                <span className="text-xs font-bold text-amber-400 tracking-wider">SCIMAGO CRAWLER</span>
                {getStatusBadge(scProgress.status)}
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Tiến trình</span>
                  <span className="font-semibold text-slate-200">{scProgress.progress}%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5">
                  <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${scProgress.progress}%` }}></div>
                </div>
                <p className="text-slate-400 text-xs truncate" title={scProgress.message}>{scProgress.message}</p>
              </div>
            </Card>

            {/* BioxBio status card */}
            <Card className="border-slate-800 bg-slate-900/40 rounded-xl overflow-hidden shadow-md">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-purple-950/10">
                <span className="text-xs font-bold text-purple-400 tracking-wider">BIOXBIO CRAWLER</span>
                {getStatusBadge(bbProgress.status)}
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Tiến trình</span>
                  <span className="font-semibold text-slate-200">{bbProgress.progress}%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5">
                  <div className="bg-purple-500 h-1.5 rounded-full transition-all" style={{ width: `${bbProgress.progress}%` }}></div>
                </div>
                <p className="text-slate-400 text-xs truncate" title={bbProgress.message}>{bbProgress.message}</p>
              </div>
            </Card>

            {/* Mapping integrator status card */}
            <Card className="border-slate-800 bg-slate-900/40 rounded-xl overflow-hidden shadow-md">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-emerald-950/10">
                <span className="text-xs font-bold text-emerald-400 tracking-wider">SCORE INTEGRATOR</span>
                {getStatusBadge(mapProgress.status)}
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Tiến trình</span>
                  <span className="font-semibold text-slate-200">{mapProgress.progress}%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5">
                  <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${mapProgress.progress}%` }}></div>
                </div>
                <p className="text-slate-400 text-xs truncate" title={mapProgress.message}>{mapProgress.message}</p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Terminal logs monitor */}
      <Card className="border-slate-800 bg-slate-950/80 rounded-2xl overflow-hidden shadow-xl border">
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
          <span className="font-semibold text-slate-300 text-xs flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" /> Live Console Log Monitor
          </span>
        </div>
        <div className="h-96 overflow-y-auto p-4 font-mono text-xs text-slate-300 space-y-1 bg-slate-950 scrollbar-thin scrollbar-thumb-slate-800">
          {consoleLogs.length === 0 ? (
            <div className="text-slate-500 flex flex-col items-center justify-center h-full gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-slate-700" />
              <span>Chưa có log sự kiện nào được ghi nhận. Vui lòng kích hoạt bộ cào để xem.</span>
            </div>
          ) : (
            consoleLogs.map((log, index) => {
              let colorClass = 'text-slate-300'
              if (log.includes('Clarivate') || log.includes('page')) colorClass = 'text-blue-400'
              else if (log.includes('SCImago') || log.includes('CSV')) colorClass = 'text-amber-400'
              else if (log.includes('BioxBio')) colorClass = 'text-purple-400'
              else if (log.includes('Mapping') || log.includes('tích hợp')) colorClass = 'text-emerald-400'
              else if (log.includes('Self-Healing')) colorClass = 'text-cyan-400 font-bold'
              else if (log.includes('🚀') || log.includes('🛑')) colorClass = 'text-white font-bold'
              
              return (
                <div key={index} className={cn("py-0.5 border-b border-slate-900/40 hover:bg-slate-900/30 transition-colors", colorClass)}>
                  <span className="text-slate-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                  <span>{log}</span>
                </div>
              )
            })
          )}
        </div>
      </Card>
    </div>
  )
}
