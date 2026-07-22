import { useState, useEffect, useRef } from 'react'
import { scholarApi } from '@/api/endpoints/scholar'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Layers, Play, Square, Loader2, Zap, Trash2, Copy, Terminal, CheckCircle2, AlertCircle, ChevronUp, ChevronDown, Database, Eye, RefreshCw, History, X, Clock, FileText, Calendar, ChevronLeft, ChevronRight, Settings, Check } from 'lucide-react'
import { useCrawlerStore } from '@/stores/crawler.store'

const WEEKDAYS = [
  { value: 0, label: 'Thứ 2' },
  { value: 1, label: 'Thứ 3' },
  { value: 2, label: 'Thứ 4' },
  { value: 3, label: 'Thứ 5' },
  { value: 4, label: 'Thứ 6' },
  { value: 5, label: 'Thứ 7' },
  { value: 6, label: 'Chủ Nhật' },
]

export function UnifiedCrawlerPage() {
  // Config states
  const [scimagoStartUrl, setScimagoStartUrl] = useState<string>('https://www.scimagojr.com/journalrank.php')
  const [scimagoWorkers, setScimagoWorkers] = useState<number>(10)
  const [scimagoDelay, setScimagoDelay] = useState<number>(0.2)

  const [clarivateStartUrl, setClarivateStartUrl] = useState<string>('https://mjl.clarivate.com/api/mjl/jprof/public/rank-search')
  const [clarivateWorkers, setClarivateWorkers] = useState<number>(15)
  const [clarivateDelay, setClarivateDelay] = useState<number>(0.1)

  const [bioxbioStartUrl, setBioxbioStartUrl] = useState<string>('https://www.bioxbio.com/journal/')
  const [bioxbioWorkers, setBioxbioWorkers] = useState<number>(20)
  const [bioxbioDelay, setBioxbioDelay] = useState<number>(0.3)

  const [showConfig, setShowConfig] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)

  // Staging preview states
  const [stats, setStats] = useState<any>(null)
  const [activeStagingTab, setActiveStagingTab] = useState<'clarivate' | 'scimago' | 'bioxbio' | 'staging_mapped'>('staging_mapped')
  const [previewData, setPreviewData] = useState<any[]>([])
  const [previewSearch, setPreviewSearch] = useState<string>('')
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false)
  const [actionConfirmMode, setActionConfirmMode] = useState<'none' | 'delete'>('none')
  const [submittingAction, setSubmittingAction] = useState<boolean>(false)

  // Sub-task progress states parsed from task status info
  const [clProgress, setClProgress] = useState<any>({ status: 'PENDING', progress: 0, message: 'Đang chờ...' })
  const [scProgress, setScProgress] = useState<any>({ status: 'PENDING', progress: 0, message: 'Đang chờ...' })
  const [bbProgress, setBbProgress] = useState<any>({ status: 'PENDING', progress: 0, message: 'Đang chờ...' })
  const [mapProgress, setMapProgress] = useState<any>({ status: 'PENDING', progress: 0, message: 'Đang chờ...' })

  // Crawler Task State from Zustand Store
  const { taskId, taskStatus, progress: masterProgress, consoleLogs, subTasks: storedSubTasks } = useCrawlerStore((state) => state.unified)
  const setTaskState = useCrawlerStore((state) => state.setTaskState)
  const addConsoleLog = useCrawlerStore((state) => state.addConsoleLog)
  const clearLogs = useCrawlerStore((state) => state.clearLogs)

  const consoleEndRef = useRef<HTMLDivElement>(null)

  // Hydrate sub-task progress states from store on mount
  useEffect(() => {
    if (storedSubTasks) {
      if (storedSubTasks.clarivate) setClProgress(storedSubTasks.clarivate)
      if (storedSubTasks.scimago) setScProgress(storedSubTasks.scimago)
      if (storedSubTasks.bioxbio) setBbProgress(storedSubTasks.bioxbio)
      if (storedSubTasks.mapping) setMapProgress(storedSubTasks.mapping)
    }
  }, [])

  // Fetch Database Stats
  const fetchStats = async () => {
    try {
      const res = await scholarApi.getStats()
      setStats(res.data)
    } catch (err) {
      console.error('Lỗi tải stats:', err)
    }
  }

  // Load preview data dynamically
  const fetchPreview = async (tab: typeof activeStagingTab, searchVal: string) => {
    setLoadingPreview(true)
    try {
      let res: any
      if (tab === 'clarivate') {
        res = await scholarApi.getClarivateData({ q: searchVal })
      } else if (tab === 'scimago') {
        res = await scholarApi.getScimagoData({ q: searchVal })
      } else if (tab === 'bioxbio') {
        res = await scholarApi.getBioxbioData({ q: searchVal })
      } else {
        res = await scholarApi.getMappedData({ q: searchVal, staging: true })
      }
      setPreviewData(res.data || [])
    } catch (err) {
      console.error('Lỗi tải dữ liệu xem trước:', err)
      toast.error('Không thể tải dữ liệu xem trước.')
    } finally {
      setLoadingPreview(false)
    }
  }

  // Polling logic
  useEffect(() => {
    fetchStats()
  }, [])

  useEffect(() => {
    if (!taskId) return

    const pollInterval = setInterval(async () => {
      try {
        const res = await scholarApi.getCrawlerTaskStatus(taskId).then((r) => r.data)

        if (res.info) {
          if (res.info.clarivate) setClProgress(res.info.clarivate)
          if (res.info.scimago) setScProgress(res.info.scimago)
          if (res.info.bioxbio) setBbProgress(res.info.bioxbio)
          if (res.info.mapping) setMapProgress(res.info.mapping)
        }
        
        if (res.status === 'SUCCESS') {
          setTaskState('unified', { 
            taskId: null,
            taskStatus: 'SUCCESS',
            progress: 100,
            subTasks: undefined
          })
          setClProgress({ status: 'SUCCESS', progress: 100, message: 'Hoàn tất cào dữ liệu' })
          setScProgress({ status: 'SUCCESS', progress: 100, message: 'Hoàn tất tải và import CSV' })
          setBbProgress({ status: 'SUCCESS', progress: 100, message: 'Hoàn tất cào dữ liệu' })
          setMapProgress({ status: 'SUCCESS', progress: 100, message: 'Đồng bộ mapping thành công!' })
          clearInterval(pollInterval)
          fetchStats()
          checkActiveTask()
          toast.success('Tiến trình cào song song và mapping đã hoàn thành thành công!')
        } else if (res.status === 'FAILURE') {
          setTaskState('unified', { 
            taskId: null,
            taskStatus: 'FAILURE',
            progress: res.progress || 0,
            subTasks: undefined
          })
          setClProgress({ status: 'FAILURE', progress: 0, message: 'Cào dữ liệu thất bại' })
          setScProgress({ status: 'FAILURE', progress: 0, message: 'Tải SCImago thất bại' })
          setBbProgress({ status: 'FAILURE', progress: 0, message: 'Cào BioxBio thất bại' })
          setMapProgress({ status: 'FAILURE', progress: 0, message: 'Mapping thất bại' })
          clearInterval(pollInterval)
          fetchStats()
          checkActiveTask()
          toast.error('Hệ thống cào song song gặp lỗi thất bại.')
        } else {
          setTaskState('unified', { 
            taskStatus: res.status,
            progress: res.progress || 0,
            subTasks: res.info ? {
              clarivate: res.info.clarivate,
              scimago: res.info.scimago,
              bioxbio: res.info.bioxbio,
              mapping: res.info.mapping
            } : undefined
          })
          if (res.status === 'PROGRESS' && res.message) {
            addConsoleLog('unified', res.message)
          }
        }
      } catch (err) {
        console.error('Error polling status:', err)
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [taskId])

  // Trigger preview fetch when tab or query search changes
  useEffect(() => {
    fetchPreview(activeStagingTab, previewSearch)
  }, [activeStagingTab, previewSearch])

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
    clearLogs('unified')
    setClProgress({ status: 'PROGRESS', progress: 5, message: 'Đang khởi động...' })
    setScProgress({ status: 'PROGRESS', progress: 5, message: 'Đang khởi động...' })
    setBbProgress({ status: 'PROGRESS', progress: 5, message: 'Đang khởi động...' })
    setMapProgress({ status: 'PENDING', progress: 0, message: 'Đang chờ các crawler thô...' })

    try {
      const payload = {
        scimago_start_url: scimagoStartUrl,
        scimago_years: null,
        scimago_workers: scimagoWorkers,
        scimago_delay: scimagoDelay,
        clarivate_start_url: clarivateStartUrl,
        clarivate_max_pages: null,
        clarivate_workers: clarivateWorkers,
        clarivate_delay: clarivateDelay,
        bioxbio_start_url: bioxbioStartUrl,
        bioxbio_max_pages: null,
        bioxbio_workers: bioxbioWorkers,
        bioxbio_delay: bioxbioDelay,
      }

      const res = await scholarApi.startUnifiedCrawl(payload).then((r) => r.data)
      setTaskState('unified', {
        taskId: res.task_id,
        taskStatus: 'PROGRESS',
        progress: 2,
      })
      addConsoleLog('unified', '🚀 Khởi chạy hệ thống cào song song không giới hạn (Clarivate + SCImago + BioxBio)...')
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

  // Staging Action handlers
  const handleConfirmStaging = async () => {
    setSubmittingAction(true)
    try {
      const res = await scholarApi.confirmStaging()
      toast.success(`Đồng bộ & cập nhật DB thành công! Đã tích hợp ${res.data.confirmed_count} bản ghi chính thức.`);
      setActionConfirmMode('none')
      fetchStats()
      fetchPreview(activeStagingTab, previewSearch)
    } catch (err: any) {
      console.error(err)
      toast.error('Lỗi khi đồng bộ & cập nhật dữ liệu.')
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleDeleteStaging = async () => {
    setSubmittingAction(true)
    try {
      const res = await scholarApi.deleteStaging()
      toast.info(`Đã hủy bỏ và xóa sạch ${res.data.deleted_count} bản ghi staging nháp.`);
      setActionConfirmMode('none')
      fetchStats()
      fetchPreview(activeStagingTab, previewSearch)
    } catch (err) {
      console.error(err)
      toast.error('Lỗi khi xóa dữ liệu nháp.')
    } finally {
      setSubmittingAction(false)
    }
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

  const [scheduleConfig, setScheduleConfig] = useState({
    auto_crawl_enabled: false,
    auto_crawl_frequency: 'WEEKLY',
    auto_crawl_weekday: 0,
    auto_crawl_day_of_month: 1,
    auto_crawl_hour: 2,
    auto_crawl_minute: 0,
  })
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date())

  const handlePrevMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1))
  }

  const [savingSchedule, setSavingSchedule] = useState<boolean>(false)
  const [lastRunInfo, setLastRunInfo] = useState<any>(null)
  const [dismissedBannerKey, setDismissedBannerKey] = useState<string>('')
  const [showHistory, setShowHistory] = useState(false)
  const [historyList, setHistoryList] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState<any>(null)
  const [historyDetailLogs, setHistoryDetailLogs] = useState<string>('')
  const [loadingDetail, setLoadingDetail] = useState(false)

  const handleOpenHistory = async () => {
    setShowHistory(true)
    setLoadingHistory(true)
    try {
      const res = await scholarApi.getCrawlHistory()
      setHistoryList(res.data || [])
    } catch (err) {
      console.error('Lỗi tải lịch sử cào:', err)
      toast.error('Không thể tải lịch sử các lượt chạy.')
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleViewHistoryDetail = async (historyItem: any) => {
    setSelectedHistory(historyItem)
    setLoadingDetail(true)
    setHistoryDetailLogs('')
    try {
      const res = await scholarApi.getCrawlHistoryDetail(historyItem.id)
      setHistoryDetailLogs(res.data?.log_output || 'Không có logs ghi nhận.')
    } catch (err) {
      console.error('Lỗi tải chi tiết logs:', err)
      toast.error('Không thể tải chi tiết logs của lượt chạy này.')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleClearHistory = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử nhật ký cào dữ liệu?')) return
    try {
      const res = await scholarApi.clearCrawlHistory()
      toast.success(`Đã xóa sạch ${res.data.deleted_count} bản ghi nhật ký cào dữ liệu!`)
      setHistoryList([])
      setSelectedHistory(null)
      setHistoryDetailLogs('')
    } catch (err) {
      console.error('Lỗi xóa nhật ký cào:', err)
      toast.error('Không thể xóa nhật ký cào.')
    }
  }

  const checkActiveTask = async () => {
    try {
      const res = await scholarApi.getActiveTask().then(r => r.data)
      if (res.last_run_info) {
        setLastRunInfo(res.last_run_info)
      }
      if (res.task_id) {
        setTaskState('unified', {
          taskId: res.task_id,
          taskStatus: res.status,
          progress: res.progress || 2,
          subTasks: res.info ? {
            clarivate: res.info.clarivate,
            scimago: res.info.scimago,
            bioxbio: res.info.bioxbio,
            mapping: res.info.mapping
          } : undefined
        })
        if (res.info) {
          if (res.info.clarivate) setClProgress(res.info.clarivate)
          if (res.info.scimago) setScProgress(res.info.scimago)
          if (res.info.bioxbio) setBbProgress(res.info.bioxbio)
          if (res.info.mapping) setMapProgress(res.info.mapping)
        }
        addConsoleLog('unified', `🔄 Phát hiện tiến trình cào tự động đang chạy ngầm (ID: ${res.task_id}). Đang kết nối giám sát...`)
        if (res.message) {
          addConsoleLog('unified', res.message)
        }
        toast.info('Hệ thống đang chạy cào tự động trong nền. Đang kết nối giám sát...')
      }
    } catch (err) {
      console.error('Lỗi kiểm tra tiến trình đang chạy:', err)
    }
  }

  // Load scheduler settings and check for any running active task
  useEffect(() => {
    const loadScheduleSettings = async () => {
      try {
        const res = await scholarApi.getSettings()
        setScheduleConfig({
          auto_crawl_enabled: res.data.auto_crawl_enabled ?? false,
          auto_crawl_frequency: res.data.auto_crawl_frequency ?? 'WEEKLY',
          auto_crawl_weekday: res.data.auto_crawl_weekday ?? 0,
          auto_crawl_day_of_month: res.data.auto_crawl_day_of_month ?? 1,
          auto_crawl_hour: res.data.auto_crawl_hour ?? 2,
          auto_crawl_minute: res.data.auto_crawl_minute ?? 0,
        })
      } catch (err) {
        console.error('Lỗi tải cấu hình lập lịch:', err)
      }
    }

    loadScheduleSettings()
    checkActiveTask()
  }, [])

  const handleToggleScheduleActive = async (newActive: boolean) => {
    setScheduleConfig((prev) => ({ ...prev, auto_crawl_enabled: newActive }))
    try {
      const currentSettings = await scholarApi.getSettings().then(r => r.data)
      await scholarApi.saveSettings({
        ...currentSettings,
        auto_crawl_enabled: newActive,
      })
      toast.success(`Đã ${newActive ? 'bật' : 'tắt'} lịch cào tự động ngầm.`)
    } catch (err) {
      console.error('Lỗi cập nhật lịch cào:', err)
      toast.error('Không thể lưu trạng thái lịch cào.')
      setScheduleConfig((prev) => ({ ...prev, auto_crawl_enabled: !newActive }))
    }
  }

  const handleSaveModalSchedule = async () => {
    setSavingSchedule(true)
    try {
      const currentSettings = await scholarApi.getSettings().then(r => r.data)
      const updatedSettings = {
        ...currentSettings,
        ...scheduleConfig,
      }
      await scholarApi.saveSettings(updatedSettings)
      toast.success('Đã cập nhật cấu hình lịch cào tổng hợp thành công!')
      setIsScheduleModalOpen(false)
    } catch (err) {
      console.error('Lỗi lưu lịch cào:', err)
      toast.error('Lưu cấu hình lịch cào thất bại.')
    } finally {
      setSavingSchedule(false)
    }
  }

  const displayedData = activeStagingTab === 'staging_mapped'
    ? previewData.filter((item) => item.is_new === true)
    : previewData

  const hasNewData = previewData.some((item) => item.is_new === true)

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
          <button
            onClick={handleOpenHistory}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all text-slate-700 text-xs font-bold gap-2 cursor-pointer bg-white shadow-xs font-sans"
            title="Xem nhật ký lịch sử cào dữ liệu"
          >
            <History className="w-4 h-4 text-[#005b9a]" /> Nhật Ký
          </button>
          <button
            onClick={fetchStats}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 cursor-pointer bg-white"
            title="Đồng bộ lại Stats"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
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
                  <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Đường dẫn quét danh sách (Start URL)</label>
                  <input
                    type="text"
                    value={clarivateStartUrl}
                    onChange={(e) => setClarivateStartUrl(e.target.value)}
                    placeholder="https://mjl.clarivate.com/api/mjl/jprof/public/rank-search"
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
                  <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Đường dẫn quét danh sách (Start URL)</label>
                  <input
                    type="text"
                    value={scimagoStartUrl}
                    onChange={(e) => setScimagoStartUrl(e.target.value)}
                    placeholder="https://www.scimagojr.com/journalrank.php"
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

            {/* Lập lịch cào tự động 3 Mode */}
            <div className="col-span-1 md:col-span-3 pt-6 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-col gap-1.5 max-w-xl">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2 uppercase tracking-wider">
                  <RefreshCw className="w-3.5 h-3.5 text-[#005b9a] animate-spin" style={{ animationDuration: '3s' }} /> Lập lịch cào tự động tổng hợp (Giờ Việt Nam)
                </h4>
                <p className="text-xs text-slate-450 leading-relaxed">
                  Kích hoạt lịch cào tự động ngầm. Hệ thống sẽ chạy bộ cào song song 3 nguồn (Clarivate, SCImago, BioXBio) và tự động đồng bộ vào cơ sở dữ liệu chính thức.
                </p>
                <div className="mt-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200/80">
                    <Calendar className="w-3.5 h-3.5 text-[#005b9a]" />
                    {(() => {
                      const modeText =
                        scheduleConfig.auto_crawl_frequency === 'MONTHLY'
                          ? 'Mode Hằng Tháng'
                          : scheduleConfig.auto_crawl_frequency === 'DAILY'
                          ? 'Mode Hằng Ngày'
                          : 'Mode Hằng Tuần'

                      const dayText =
                        scheduleConfig.auto_crawl_frequency === 'MONTHLY'
                          ? `Ngày ${scheduleConfig.auto_crawl_day_of_month ?? 1}`
                          : scheduleConfig.auto_crawl_frequency === 'DAILY'
                          ? 'Mỗi ngày'
                          : WEEKDAYS.find((w) => w.value === (scheduleConfig.auto_crawl_weekday ?? 0))?.label || 'Thứ 2'

                      const hour = scheduleConfig.auto_crawl_hour ?? 2
                      const minute = scheduleConfig.auto_crawl_minute ?? 0
                      const hourStr = hour < 10 ? `0${hour}` : `${hour}`
                      const minStr = minute < 10 ? `0${minute}` : `${minute}`
                      const timePeriod = hour >= 18 || hour < 6 ? '(Đêm)' : '(Ngày)'

                      return `${modeText} • ${dayText} • ${hourStr}:${minStr} ${timePeriod}`
                    })()}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 bg-slate-50/50 p-4.5 rounded-xl border border-slate-100 w-full md:w-auto">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleConfig.auto_crawl_enabled}
                    onChange={(e) => handleToggleScheduleActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#005b9a]"></div>
                  <span className="ml-2 text-xs font-bold text-slate-700">Kích hoạt cào tự động</span>
                </label>

                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-slate-100/90 hover:bg-slate-200 text-[#005b9a] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-200/80 shadow-3xs"
                >
                  <Settings className="w-4 h-4 text-[#005b9a]" />
                  <span>Cấu Hình Lịch</span>
                </button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Progress & Live Monitors */}
      {taskStatus && taskStatus !== 'IDLE' && (
        <div className="space-y-4">
          {/* Master Progress Bar */}
          <Card className="rounded-xl border border-slate-200 bg-white shadow-xs p-5">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                {isRunning ? (
                  <Loader2 className="w-3.5 h-3.5 text-[#005b9a] animate-spin" />
                ) : taskStatus === 'SUCCESS' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                )}
                Tiến độ tổng hợp dự án {taskStatus === 'SUCCESS' && "(Hoàn thành)"} {taskStatus === 'FAILURE' && "(Thất bại)"}
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
        <div className="p-6 bg-white min-h-[300px] space-y-4">
          {/* Last Run History Alert Banner */}
          {lastRunInfo?.time &&
            dismissedBannerKey !== `${lastRunInfo.time}-${lastRunInfo.status}-${lastRunInfo.message}` &&
            (!taskId || taskStatus === 'IDLE' || taskStatus === 'SUCCESS' || taskStatus === 'FAILURE') && (
            <div className="p-3.5 px-5 rounded-xl border border-sky-100 bg-sky-50/50 text-sky-950 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-xs animate-fade-in">
              <div className="flex flex-wrap items-center gap-2 font-medium">
                <span className="inline-flex w-2 h-2 rounded-full bg-emerald-500 shadow-xs animate-pulse"></span>
                <span>
                  Lượt chạy tự động gần nhất: <strong className="text-slate-800 font-bold">{lastRunInfo.time}</strong>
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  lastRunInfo.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {lastRunInfo.status === 'SUCCESS' ? 'Thành công' : 'Thất bại'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="opacity-95 font-semibold text-slate-700 flex items-center gap-1.5 bg-white border border-slate-150 px-3 py-1 rounded-lg">
                  <span>{lastRunInfo.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDismissedBannerKey(`${lastRunInfo.time}-${lastRunInfo.status}-${lastRunInfo.message}`)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
                  title="Tắt thông báo này"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
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

      {/* Staging Data Preview & Action Card (Draft Preview & Database Sync & Update Manager) */}
      <Card className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between text-slate-800 font-semibold text-sm bg-white">
          <div className="flex items-center gap-2">
            <Database className="w-4.5 h-4.5 text-[#005b9a]" /> Quản lý & Xem trước Dữ liệu Staging (Chờ xác nhận)
          </div>
          {stats?.staging_journals > 0 && actionConfirmMode === 'none' && (
            <div className="flex items-center gap-2">
              {hasNewData && (
                <button
                  disabled={submittingAction}
                  onClick={handleConfirmStaging}
                  className="inline-flex items-center justify-center px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 transition-colors text-white text-xs font-bold gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingAction ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang đồng bộ...
                    </>
                  ) : (
                    "Đồng Bộ & Cập Nhật"
                  )}
                </button>
              )}
              <button
                disabled={submittingAction}
                onClick={handleDeleteStaging}
                className="inline-flex items-center justify-center px-4 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 transition-colors text-rose-600 text-xs font-bold gap-1.5 border border-rose-200 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {submittingAction ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang xóa...
                  </>
                ) : (
                  "Hủy / Xóa Bản Nháp"
                )}
              </button>
            </div>
          )}
        </div>

        <CardContent className="p-6 space-y-6 bg-white">

          {/* Staging Summary Info bar when empty */}
          {(!stats || stats.staging_journals === 0) ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2 text-center bg-slate-50/40 rounded-xl border border-dashed border-slate-200">
              <Eye className="w-8 h-8 opacity-45 text-[#005b9a] animate-pulse" />
              {lastRunInfo?.status === 'SUCCESS' && lastRunInfo?.message?.includes('Không có dữ liệu mới') ? (
                <>
                  <h5 className="font-bold text-xs text-emerald-700">Không có dữ liệu mới nào từ các nguồn.</h5>
                  <p className="text-[10px] text-slate-500 max-w-md px-4 font-semibold">
                    Lượt chạy lúc {lastRunInfo.time} xác nhận toàn bộ dữ liệu thô của Clarivate, SCImago và BioxBio đã ở phiên bản mới nhất. Hệ thống tự động bỏ qua giai đoạn Mapping và giữ nguyên dữ liệu chính thức hiện tại.
                  </p>
                </>
              ) : (
                <>
                  <h5 className="font-bold text-xs text-slate-700">Chưa có dữ liệu cào nháp (Staging) nào trong bộ nhớ tạm.</h5>
                  <p className="text-[10px] text-slate-400 max-w-md px-4">
                    Kích hoạt hệ thống cào song song. Khi giai đoạn mapping hoàn thành 100%, kết quả sẽ xuất hiện ở đây dưới dạng nháp để bạn xem trước, đối chiếu trước khi đồng bộ chính thức.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tab Selector buttons */}
              <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-3">
                <button
                  onClick={() => { setActiveStagingTab('staging_mapped'); setPreviewSearch(''); }}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-3xs",
                    activeStagingTab === 'staging_mapped'
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                  )}
                >
                  4. Kết quả Mapping Draft ({stats?.staging_journals} dòng)
                </button>
                <button
                  onClick={() => { setActiveStagingTab('clarivate'); setPreviewSearch(''); }}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-3xs",
                    activeStagingTab === 'clarivate'
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                  )}
                >
                  1. Clarivate Raw ({stats?.clarivate_journals} dòng)
                </button>
                <button
                  onClick={() => { setActiveStagingTab('scimago'); setPreviewSearch(''); }}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-3xs",
                    activeStagingTab === 'scimago'
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                  )}
                >
                  2. SCImago Raw ({stats?.scimago_journals} dòng)
                </button>
                <button
                  onClick={() => { setActiveStagingTab('bioxbio'); setPreviewSearch(''); }}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-3xs",
                    activeStagingTab === 'bioxbio'
                      ? "bg-purple-50 text-purple-700 border border-purple-200"
                      : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                  )}
                >
                  3. BioxBio Raw ({stats?.bioxbio_journals} dòng)
                </button>
              </div>

              {/* Tab specific search box */}
              <div className="relative max-w-sm">
                <input
                  type="text"
                  value={previewSearch}
                  onChange={(e) => setPreviewSearch(e.target.value)}
                  placeholder="Lọc nhanh kết quả xem trước..."
                  className="w-full pl-3 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#005b9a]/20 focus:border-[#005b9a] bg-white transition-all text-slate-855 font-bold shadow-3xs"
                />
                {loadingPreview && (
                  <Loader2 className="absolute right-3 top-2.5 w-3.5 h-3.5 animate-spin text-slate-400" />
                )}
              </div>

              {/* Grid View Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-3xs bg-white">
                <div className="overflow-x-auto max-h-[300px]">
                  {loadingPreview ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin text-[#005b9a]" />
                      <span className="text-xs font-semibold">Đang tải dữ liệu staging...</span>
                    </div>
                  ) : displayedData.length === 0 ? (
                    <div className="py-12 text-center text-slate-450 text-xs font-semibold">
                      {activeStagingTab === 'staging_mapped'
                        ? "Không tìm thấy dữ liệu mới nào trên các nguồn."
                        : "Không tìm thấy bản ghi nào khớp với từ khóa lọc."}
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10 select-none">
                        {activeStagingTab === 'clarivate' && (
                          <tr>
                            <th className="p-3 pl-4">Tên Tạp Chí (WoS)</th>
                            <th className="p-3">ISSN</th>
                            <th className="p-3">eISSN</th>
                            <th className="p-3">Nhà Xuất Bản</th>
                            <th className="p-3">Quốc Gia</th>
                            <th className="p-3 pr-4">Chỉ Mục Core</th>
                          </tr>
                        )}
                        {activeStagingTab === 'scimago' && (
                          <tr>
                            <th className="p-3 pl-4">Tên Tạp Chí</th>
                            <th className="p-3">Loại</th>
                            <th className="p-3">Nhà Xuất Bản</th>
                            <th className="p-3">Quốc Gia</th>
                            <th className="p-3">SJR</th>
                            <th className="p-3">Phân Nhóm Q</th>
                            <th className="p-3 pr-4">H-Index</th>
                          </tr>
                        )}
                        {activeStagingTab === 'bioxbio' && (
                          <tr>
                            <th className="p-3 pl-4">Tên Tạp Chí</th>
                            <th className="p-3">ISSNs</th>
                            <th className="p-3">Impact Factor</th>
                            <th className="p-3">Bài Báo</th>
                            <th className="p-3 pr-4">Trích Dẫn</th>
                          </tr>
                        )}
                        {activeStagingTab === 'staging_mapped' && (
                          <tr>
                            <th className="p-3 pl-4">Tên Tạp Chí (WoS)</th>
                            <th className="p-3">ISSN</th>
                            <th className="p-3">eISSN</th>
                            <th className="p-3">Impact Factor</th>
                            <th className="p-3">SJR Score</th>
                            <th className="p-3">Quartile</th>
                            <th className="p-3">Khớp BioxBio</th>
                            <th className="p-3 pr-4">Khớp SCImago</th>
                          </tr>
                        )}
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        {displayedData.slice(0, 100).map((row, idx) => (
                          <tr key={row.id || idx} className="hover:bg-slate-50/50 transition-colors">
                            {activeStagingTab === 'clarivate' && (
                              <>
                                <td className="p-3 pl-4 font-bold text-slate-800 truncate max-w-xs">{row.title}</td>
                                <td className="p-3 font-semibold text-slate-500">{row.issn || '-'}</td>
                                <td className="p-3 font-semibold text-slate-500">{row.eissn || '-'}</td>
                                <td className="p-3 truncate max-w-[150px]">{row.publisher || '-'}</td>
                                <td className="p-3">{row.country || '-'}</td>
                                <td className="p-3 pr-4"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 font-bold rounded-md text-[10px]">{row.wos_core_collection}</span></td>
                              </>
                            )}
                            {activeStagingTab === 'scimago' && (
                              <>
                                <td className="p-3 pl-4 font-bold text-slate-800 truncate max-w-xs">{row.title}</td>
                                <td className="p-3 capitalize">{row.journal_type || '-'}</td>
                                <td className="p-3 truncate max-w-[150px]">{row.publisher || '-'}</td>
                                <td className="p-3">{row.country || '-'}</td>
                                <td className="p-3 text-amber-700 font-bold">{row.rankings?.[0]?.sjr_score || '-'}</td>
                                <td className="p-3"><span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-100 font-bold rounded-md text-[10px]">{row.rankings?.[0]?.sjr_quartile || '-'}</span></td>
                                <td className="p-3 pr-4">{row.rankings?.[0]?.h_index || '-'}</td>
                              </>
                            )}
                            {activeStagingTab === 'bioxbio' && (
                              <>
                                <td className="p-3 pl-4 font-bold text-slate-800 truncate max-w-xs">{row.title}</td>
                                <td className="p-3">{row.issns?.join(', ') || '-'}</td>
                                <td className="p-3 text-purple-700 font-bold">{row.rankings?.[0]?.impact_factor || '-'}</td>
                                <td className="p-3">{row.rankings?.[0]?.total_articles || '-'}</td>
                                <td className="p-3 pr-4">{row.rankings?.[0]?.total_cites || '-'}</td>
                              </>
                            )}
                            {activeStagingTab === 'staging_mapped' && (
                              <>
                                <td className="p-3 pl-4 truncate max-w-xs">
                                  <div className="flex flex-col gap-1 items-start">
                                    <span className="font-bold text-slate-800">{row.clarivate_title}</span>
                                    {row.is_new ? (
                                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded text-[9px] uppercase">
                                        Mới cào
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 font-bold rounded text-[9px] uppercase">
                                        Hiện có
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 font-semibold text-slate-500">{row.issn || '-'}</td>
                                <td className="p-3 font-semibold text-slate-500">{row.eissn || '-'}</td>
                                <td className="p-3 text-purple-700 font-bold">{row.latest_if || '-'}</td>
                                <td className="p-3 text-amber-750 font-bold">{row.latest_sjr || '-'}</td>
                                <td className="p-3"><span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-100 font-bold rounded-md text-[10px]">{row.latest_quartile || '-'}</span></td>
                                <td className="p-3"><span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold border", row.bioxbio_match ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100")}>{row.bioxbio_match || 'No Match'}</span></td>
                                <td className="p-3 pr-4"><span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold border", row.scimago_match ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100")}>{row.scimago_match || 'No Match'}</span></td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="p-2.5 px-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400 font-bold">
                  <span>HIỂN THỊ TỐI ĐA 100 DÒNG XEM TRƯỚC</span>
                  <span className="text-[#005b9a]">PHÂN VÙNG DỮ LIỆU STAGING NHÁP</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Crawl History & Logs Overlay Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-md transition-all duration-300 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-zoom-in font-sans">
            {/* Modal Header */}
            <div className="p-4 px-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#005b9a]" />
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Nhật Ký Lịch Sử Cào & Đẩy Dữ Liệu</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Hiển thị chi tiết lịch sử hoạt động cào dữ liệu, thời gian thực thi và log tiến trình.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {historyList.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-3xs"
                    title="Xóa toàn bộ lịch sử nhật ký cào"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Xóa Nhật Ký</span>
                  </button>
                )}
                <button
                  onClick={() => { setShowHistory(false); setSelectedHistory(null); }}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 transition-colors text-slate-400 cursor-pointer bg-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Split dual-column layout */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Column: History list */}
              <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/40">
                <div className="p-3 px-4 border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-500 tracking-wider">
                  DANH SÁCH LƯỢT CHẠY ({historyList.length})
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {loadingHistory ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2 text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin text-[#005b9a]" />
                      <span className="text-xs">Đang tải lịch sử...</span>
                    </div>
                  ) : historyList.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 text-xs">
                      Chưa có lịch sử chạy nào được lưu lại.
                    </div>
                  ) : (
                    historyList.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleViewHistoryDetail(item)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl transition-all border flex flex-col gap-1.5 cursor-pointer",
                          selectedHistory?.id === item.id
                            ? "bg-sky-50/70 border-sky-200 shadow-3xs"
                            : "bg-white border-slate-150 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex justify-between items-start w-full">
                          <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                            {item.is_automated ? (
                              <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 text-[9px] font-bold rounded">Auto</span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-bold rounded">Manual</span>
                            )}
                            {item.triggered_at_formatted ? item.triggered_at_formatted.split(' ')[0] : ''}
                          </span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                            item.status === 'SUCCESS' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            item.status === 'RUNNING' ? "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse" :
                            "bg-rose-50 text-rose-700 border border-rose-200"
                          )}>
                            {item.status === 'SUCCESS' ? 'Thành công' : item.status === 'RUNNING' ? 'Đang chạy' : 'Thất bại'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400" /> {item.duration}</span>
                          <span>{item.triggered_at_formatted ? item.triggered_at_formatted.split(' ')[1] : ''}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Execution logs and counters detail */}
              <div className="flex-1 flex flex-col bg-white overflow-hidden">
                {selectedHistory ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Run Meta Info Cards */}
                    <div className="p-4 bg-slate-50 border-b border-slate-150 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      {/* Clarivate block */}
                      <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col gap-1.5 shadow-3xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase select-none">Clarivate Scraped</span>
                        {selectedHistory.clarivate_count > 0 && selectedHistory.clarivate_total > 0 ? (
                          <span className="font-bold text-emerald-600 text-sm">+{selectedHistory.clarivate_count.toLocaleString()} dòng mới</span>
                        ) : (
                          <span className="font-bold text-slate-500 text-sm">Không có dữ liệu mới</span>
                        )}
                        <span className="text-[10px] text-slate-550 font-semibold select-none">
                          Hiện tại: {(selectedHistory.clarivate_total > 0 ? selectedHistory.clarivate_total : selectedHistory.clarivate_count)?.toLocaleString() || '-'} dòng
                        </span>
                      </div>

                      {/* SCImago block */}
                      <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col gap-1.5 shadow-3xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase select-none">SCImago Scraped</span>
                        {selectedHistory.scimago_count > 0 && selectedHistory.scimago_total > 0 ? (
                          <span className="font-bold text-emerald-600 text-sm">+{selectedHistory.scimago_count.toLocaleString()} dòng mới</span>
                        ) : (
                          <span className="font-bold text-slate-500 text-sm">Không có dữ liệu mới</span>
                        )}
                        <span className="text-[10px] text-slate-550 font-semibold select-none">
                          Hiện tại: {(selectedHistory.scimago_total > 0 ? selectedHistory.scimago_total : selectedHistory.scimago_count)?.toLocaleString() || '-'} dòng
                        </span>
                      </div>

                      {/* BioxBio block */}
                      <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col gap-1.5 shadow-3xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase select-none">BioxBio Scraped</span>
                        {selectedHistory.bioxbio_count > 0 && selectedHistory.bioxbio_total > 0 ? (
                          <span className="font-bold text-emerald-600 text-sm">+{selectedHistory.bioxbio_count.toLocaleString()} dòng mới</span>
                        ) : (
                          <span className="font-bold text-slate-500 text-sm">Không có dữ liệu mới</span>
                        )}
                        <span className="text-[10px] text-slate-550 font-semibold select-none">
                          Hiện tại: {(selectedHistory.bioxbio_total > 0 ? selectedHistory.bioxbio_total : selectedHistory.bioxbio_count)?.toLocaleString() || '-'} dòng
                        </span>
                      </div>

                      {/* Mapped block */}
                      <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col gap-1.5 shadow-3xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase select-none">Mapped Journals</span>
                        {selectedHistory.mapped_count > 0 && selectedHistory.mapped_total > 0 ? (
                          <span className="font-bold text-[#005b9a] text-sm">+{selectedHistory.mapped_count.toLocaleString()} dòng mới</span>
                        ) : (
                          <span className="font-bold text-slate-500 text-sm">Bỏ qua Mapping</span>
                        )}
                        <span className="text-[10px] text-slate-550 font-semibold select-none">
                          Hiện tại: {(selectedHistory.mapped_total > 0 ? selectedHistory.mapped_total : selectedHistory.mapped_count)?.toLocaleString() || '-'} dòng
                        </span>
                      </div>
                    </div>

                    {/* Console logs header */}
                    <div className="p-3 px-6 border-b border-slate-100 flex items-center justify-between text-slate-800 font-semibold text-xs bg-white">
                      <span className="flex items-center gap-1.5"><Terminal className="w-4 h-4 text-[#005b9a]" /> Console Logs Log-output</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(historyDetailLogs)
                          toast.success('Đã sao chép logs lượt chạy vào clipboard!')
                        }}
                        disabled={!historyDetailLogs || loadingDetail}
                        className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-200 rounded-md text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 cursor-pointer disabled:opacity-50"
                      >
                        <Copy className="w-3 h-3" /> Sao chép logs
                      </button>
                    </div>

                    {/* Console terminal window - light theme (white background, border gray) */}
                    <div className="flex-1 bg-white p-4 font-mono text-[11px] leading-relaxed text-slate-800 overflow-y-auto select-text scrollbar-thin border-t border-slate-100">
                      {loadingDetail ? (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin text-[#005b9a]" />
                          <span>Đang tải log chi tiết...</span>
                        </div>
                      ) : historyDetailLogs ? (
                        historyDetailLogs.split('\n').map((line, idx) => (
                          <div key={idx} className="hover:bg-slate-100 py-0.5 rounded px-2 w-full break-words border-b border-slate-50">
                            <span className="text-slate-400 select-none mr-3 inline-block w-6 text-right font-semibold">{(idx + 1)}</span>
                            <span>{line}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500 italic p-4 text-center">Không tìm thấy bản ghi logs.</div>
                      )}
                      
                      {selectedHistory.error_message && (
                        <div className="mt-4 p-4 border border-rose-200 bg-rose-50/50 text-rose-950 rounded-lg text-xs leading-relaxed max-w-full overflow-x-auto whitespace-pre-wrap font-sans">
                          <div className="font-bold text-rose-700 mb-1 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" /> ERROR TRACEBACK:
                          </div>
                          {selectedHistory.error_message}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 gap-3 text-center p-6 bg-slate-50/30">
                    <FileText className="w-12 h-12 opacity-35 text-[#005b9a]" />
                    <h4 className="font-bold text-xs text-slate-700">Chọn một lượt chạy để xem logs.</h4>
                    <p className="text-[10px] text-slate-400 max-w-xs leading-relaxed">
                      Danh sách các lượt chạy thô trên cột bên trái chứa cả lịch cào tự động và kích hoạt bằng tay.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 px-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-bold">
              <span>HỆ THỐNG GHI NHẬT KÝ HOẠT ĐỘNG (MAX 50 LƯỢT GẦN NHẤT)</span>
              <span className="text-[#005b9a]">EDU ECOSYSTEM SCHOLAR MATCHER</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Schedule Config Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-3xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-slate-700" />
                  <span>Cấu Hình Thời Gian Cào Tổng Hợp Auto-Crawl</span>
                </h3>
                <p className="text-xs text-slate-500">Thiết lập chu kỳ (Ngày/Tuần/Tháng) & mốc giờ cào song song tự động</p>
              </div>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
              {/* 3 Mode Radio Bar */}
              <div className="grid grid-cols-3 gap-3 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/70">
                <button
                  type="button"
                  onClick={() => {
                    setScheduleConfig({ ...scheduleConfig, auto_crawl_frequency: 'WEEKLY' })
                  }}
                  className={`p-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between border ${
                    (scheduleConfig.auto_crawl_frequency || 'WEEKLY') === 'WEEKLY'
                      ? 'bg-white text-[#005b9a] shadow-sm border-[#005b9a] ring-2 ring-blue-100'
                      : 'bg-white/50 text-slate-600 hover:bg-white border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <div className="text-left leading-tight">
                      <div>Hằng Tuần</div>
                      <div className="text-[10px] text-slate-400 font-normal">Chạy theo Thứ</div>
                    </div>
                  </div>
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] ${
                    (scheduleConfig.auto_crawl_frequency || 'WEEKLY') === 'WEEKLY' ? 'border-[#005b9a] bg-[#005b9a] text-white font-bold' : 'border-slate-300'
                  }`}>
                    {(scheduleConfig.auto_crawl_frequency || 'WEEKLY') === 'WEEKLY' && '✓'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setScheduleConfig({ ...scheduleConfig, auto_crawl_frequency: 'MONTHLY' })
                  }}
                  className={`p-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between border ${
                    scheduleConfig.auto_crawl_frequency === 'MONTHLY'
                      ? 'bg-white text-[#005b9a] shadow-sm border-[#005b9a] ring-2 ring-blue-100'
                      : 'bg-white/50 text-slate-600 hover:bg-white border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <div className="text-left leading-tight">
                      <div>Hằng Tháng</div>
                      <div className="text-[10px] text-slate-400 font-normal">Chạy theo Ngày</div>
                    </div>
                  </div>
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] ${
                    scheduleConfig.auto_crawl_frequency === 'MONTHLY' ? 'border-[#005b9a] bg-[#005b9a] text-white font-bold' : 'border-slate-300'
                  }`}>
                    {scheduleConfig.auto_crawl_frequency === 'MONTHLY' && '✓'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setScheduleConfig({ ...scheduleConfig, auto_crawl_frequency: 'DAILY' })
                  }}
                  className={`p-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between border ${
                    scheduleConfig.auto_crawl_frequency === 'DAILY'
                      ? 'bg-white text-[#005b9a] shadow-sm border-[#005b9a] ring-2 ring-blue-100'
                      : 'bg-white/50 text-slate-600 hover:bg-white border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    <div className="text-left leading-tight">
                      <div>Hằng Ngày</div>
                      <div className="text-[10px] text-slate-400 font-normal">Mỗi 24 giờ</div>
                    </div>
                  </div>
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] ${
                    scheduleConfig.auto_crawl_frequency === 'DAILY' ? 'border-[#005b9a] bg-[#005b9a] text-white font-bold' : 'border-slate-300'
                  }`}>
                    {scheduleConfig.auto_crawl_frequency === 'DAILY' && '✓'}
                  </span>
                </button>
              </div>

              {/* Calendar & Analog Clock Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Calendar Widget */}
                <div className="bg-slate-50/60 rounded-2xl p-4 border border-slate-200/80 space-y-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-[#005b9a]" />
                      <span>Chọn Ngày Cào</span>
                    </label>
                    <span className="text-[10px] font-mono font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                      {(scheduleConfig.auto_crawl_frequency || 'WEEKLY') === 'WEEKLY' && `Lặp lại: ${WEEKDAYS.find(w => w.value === (scheduleConfig.auto_crawl_weekday ?? 0))?.label}`}
                      {scheduleConfig.auto_crawl_frequency === 'MONTHLY' && `Lặp lại: Ngày ${scheduleConfig.auto_crawl_day_of_month ?? 1} hằng tháng`}
                      {scheduleConfig.auto_crawl_frequency === 'DAILY' && 'Lặp lại hằng ngày'}
                    </span>
                  </div>

                  {scheduleConfig.auto_crawl_frequency === 'DAILY' ? (
                    <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 text-center space-y-2 my-auto">
                      <div className="w-10 h-10 rounded-xl bg-white text-[#005b9a] font-bold text-lg flex items-center justify-center mx-auto shadow-xs border border-blue-100">
                        <Zap className="w-5 h-5 text-[#005b9a]" />
                      </div>
                      <h4 className="font-bold text-xs text-slate-800">Chế độ Quét Hằng Ngày</h4>
                      <p className="text-[11px] text-slate-600 leading-relaxed max-w-xs mx-auto">
                        Tự động cào ngầm lặp lại <strong>mỗi 24 giờ</strong> vào mốc giờ đã chọn.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(scheduleConfig.auto_crawl_frequency || 'WEEKLY') === 'WEEKLY' && (
                        <div className="grid grid-cols-7 gap-1">
                          {WEEKDAYS.map((w) => {
                            const isSelected = (scheduleConfig.auto_crawl_weekday ?? 0) === w.value
                            return (
                              <button
                                key={w.value}
                                type="button"
                                onClick={() => {
                                  setScheduleConfig((prev: any) => ({ ...prev, auto_crawl_frequency: 'WEEKLY', auto_crawl_weekday: w.value }))
                                }}
                                className={`py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-center ${
                                  isSelected
                                    ? 'bg-[#005b9a] text-white shadow-xs'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {w.label}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2">
                        {/* Month Navigation */}
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-800">
                            {currentCalendarDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={handlePrevMonth}
                              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                              title="Tháng trước"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={handleNextMonth}
                              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                              title="Tháng sau"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Weekday Row */}
                        <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-slate-400 tracking-wider py-1 border-b border-slate-100 mb-1">
                          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((dayName) => (
                            <div key={dayName}>{dayName}</div>
                          ))}
                        </div>

                        {/* Day Grid */}
                        {(() => {
                          const year = currentCalendarDate.getFullYear()
                          const month = currentCalendarDate.getMonth()
                          const firstDayIndex = new Date(year, month, 1).getDay()
                          const totalDays = new Date(year, month + 1, 0).getDate()
                          const prevMonthLastDate = new Date(year, month, 0).getDate()

                          const daysElements = []

                          for (let i = firstDayIndex - 1; i >= 0; i--) {
                            const prevDay = prevMonthLastDate - i
                            daysElements.push(
                              <div
                                key={`prev-${prevDay}`}
                                className="text-slate-300 font-medium text-xs w-8 h-8 flex items-center justify-center mx-auto"
                              >
                                {prevDay}
                              </div>
                            )
                          }

                          for (let d = 1; d <= totalDays; d++) {
                            const clickedDate = new Date(year, month, d)
                            const weekday = (clickedDate.getDay() + 6) % 7

                            const isSelected = scheduleConfig.auto_crawl_frequency === 'MONTHLY'
                              ? (scheduleConfig.auto_crawl_day_of_month ?? 1) === d
                              : (scheduleConfig.auto_crawl_weekday ?? 0) === weekday

                            daysElements.push(
                              <button
                                key={`day-${d}`}
                                type="button"
                                onClick={() => {
                                  setScheduleConfig((prev: any) => ({
                                    ...prev,
                                    auto_crawl_frequency: 'MONTHLY',
                                    auto_crawl_day_of_month: d,
                                    auto_crawl_weekday: weekday,
                                  }))
                                }}
                                className={
                                  isSelected
                                    ? 'bg-[#005b9a] text-white rounded-xl shadow-md font-bold w-8 h-8 flex items-center justify-center mx-auto cursor-pointer transition-all'
                                    : 'text-slate-800 font-bold text-xs w-8 h-8 flex items-center justify-center mx-auto rounded-xl hover:bg-slate-100 cursor-pointer transition-all'
                                }
                              >
                                {d}
                              </button>
                            )
                          }

                          const totalGridCells = Math.ceil((firstDayIndex + totalDays) / 7) * 7
                          const nextMonthDaysCount = totalGridCells - (firstDayIndex + totalDays)
                          for (let nextD = 1; nextD <= nextMonthDaysCount; nextD++) {
                            daysElements.push(
                              <div
                                key={`next-${nextD}`}
                                className="text-slate-300 font-medium text-xs w-8 h-8 flex items-center justify-center mx-auto"
                              >
                                {nextD}
                              </div>
                            )
                          }

                          return <div className="grid grid-cols-7 gap-1">{daysElements}</div>
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Analog Clock & Digital Time Picker Widget */}
                <div className="bg-slate-50/60 rounded-2xl p-4 border border-slate-200/80 space-y-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#005b9a]" />
                      <span>Chọn Giờ Kích Hoạt</span>
                    </label>
                    <span className="text-[10px] font-mono text-[#005b9a] font-bold bg-white px-2 py-0.5 rounded-full border border-slate-200">
                      {((scheduleConfig.auto_crawl_hour ?? 2) < 10 ? `0${scheduleConfig.auto_crawl_hour ?? 2}` : scheduleConfig.auto_crawl_hour ?? 2)}:{(scheduleConfig.auto_crawl_minute ?? 0) < 10 ? `0${scheduleConfig.auto_crawl_minute ?? 0}` : scheduleConfig.auto_crawl_minute ?? 0}
                    </span>
                  </div>

                  {/* Visual Analog Clock Face */}
                  <div className="py-1">
                    <div className="w-36 h-36 border-4 border-slate-200/80 rounded-full bg-white relative shadow-inner mx-auto flex items-center justify-center">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div
                          key={i}
                          style={{ transform: `rotate(${i * 30}deg) translateY(-56px)` }}
                          className="absolute w-1 h-2 bg-slate-300 rounded-full"
                        />
                      ))}
                      {(() => {
                        const hour24 = scheduleConfig.auto_crawl_hour ?? 2
                        const minute = scheduleConfig.auto_crawl_minute ?? 0
                        const hour12 = hour24 % 12
                        const hourAngle = hour12 * 30 + minute * 0.5
                        const minuteAngle = minute * 6
                        return (
                          <>
                            <div
                              style={{ transform: `rotate(${hourAngle}deg)` }}
                              className="w-1.5 h-10 bg-slate-700 absolute top-4 left-1/2 -translate-x-1/2 origin-bottom rounded-full transition-transform duration-300 shadow-xs"
                            />
                            <div
                              style={{ transform: `rotate(${minuteAngle}deg)` }}
                              className="w-1 h-13 bg-[#005b9a] absolute top-2 left-1/2 -translate-x-1/2 origin-bottom rounded-full transition-transform duration-300 shadow-xs"
                            />
                          </>
                        )
                      })()}
                      <div className="w-3 h-3 bg-slate-800 rounded-full z-10 border-2 border-white shadow-xs" />
                    </div>
                  </div>

                  {/* Digital Time Picker */}
                  <div className="flex items-center justify-center gap-2 pt-1">
                    {(() => {
                      const hour24 = scheduleConfig.auto_crawl_hour ?? 2
                      const minute = scheduleConfig.auto_crawl_minute ?? 0
                      const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
                      const ampm = hour24 >= 12 ? 'PM' : 'AM'

                      return (
                        <>
                          <select
                            value={hour12}
                            onChange={(e) => {
                              const selectedH12 = parseInt(e.target.value, 10)
                              let newH24 = selectedH12
                              if (ampm === 'PM') {
                                newH24 = selectedH12 === 12 ? 12 : selectedH12 + 12
                              } else {
                                newH24 = selectedH12 === 12 ? 0 : selectedH12
                              }
                              setScheduleConfig((prev: any) => ({ ...prev, auto_crawl_hour: newH24 }))
                            }}
                            className="bg-white hover:bg-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 border border-slate-200 focus:outline-none cursor-pointer"
                          >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                              <option key={h} value={h}>
                                {h < 10 ? `0${h}` : h}
                              </option>
                            ))}
                          </select>

                          <span className="text-slate-400 font-bold">:</span>

                          <select
                            value={minute}
                            onChange={(e) => {
                              const selectedMin = parseInt(e.target.value, 10)
                              setScheduleConfig((prev: any) => ({ ...prev, auto_crawl_minute: selectedMin }))
                            }}
                            className="bg-white hover:bg-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 border border-slate-200 focus:outline-none cursor-pointer"
                          >
                            {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                              <option key={m} value={m}>
                                {m < 10 ? `0${m}` : m}
                              </option>
                            ))}
                          </select>

                          <select
                            value={ampm}
                            onChange={(e) => {
                              const newAmPm = e.target.value
                              let newH24 = hour12
                              if (newAmPm === 'PM') {
                                newH24 = hour12 === 12 ? 12 : hour12 + 12
                              } else {
                                newH24 = hour12 === 12 ? 0 : hour12
                              }
                              setScheduleConfig((prev: any) => ({ ...prev, auto_crawl_hour: newH24 }))
                            }}
                            className="bg-white hover:bg-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 border border-slate-200 focus:outline-none cursor-pointer"
                          >
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                        </>
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl px-5 py-2 text-xs font-bold cursor-pointer transition-all"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveModalSchedule}
                disabled={savingSchedule}
                className="bg-[#005b9a] hover:bg-[#004b7c] text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 transition-all"
              >
                {savingSchedule ? (
                  <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                ) : (
                  <Check className="w-4 h-4 text-white" />
                )}
                <span>Lưu Cấu Hình</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
