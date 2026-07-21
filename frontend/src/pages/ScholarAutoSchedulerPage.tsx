import { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { scholarApi } from '@/api/endpoints/scholar'
import type { AuthorProfileDetail } from '@/api/endpoints/scholar'
import {
  Cpu,
  ShieldAlert,
  RefreshCw,
  Upload,
  Play,
  Settings,
  Clock,
  User,
  Zap,
  CheckCircle,
  XCircle,
  Loader2,
  List,
  Power,
  X,
  Search,
  Trash2,
  Download,
  FileText,
  Sparkles,
  Server,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

export interface AutoSchedulerLogEntry {
  id: string
  timestamp: string
  category: 'CÀO_CV' | 'NHẬP_CV' | 'PROXY_TOR' | 'CẤU_HÌNH' | 'HỆ_THỐNG'
  level: 'THÀNH_CÔNG' | 'BÁO_LỖI' | 'CẢNH_BÁO' | 'THÔNG_TIN'
  action: string
  target?: string
  details: string
}

const WEEKDAYS = [
  { value: 0, label: 'Thứ 2' },
  { value: 1, label: 'Thứ 3' },
  { value: 2, label: 'Thứ 4' },
  { value: 3, label: 'Thứ 5' },
  { value: 4, label: 'Thứ 6' },
  { value: 5, label: 'Thứ 7' },
  { value: 6, label: 'Chủ Nhật' },
]



export function ScholarAutoSchedulerPage() {
  const [torInfo, setTorInfo] = useState<any>(null)
  const [config, setConfig] = useState<any>({
    is_active: true,
    frequency_type: 'WEEKLY',
    preferred_weekday: 0,
    preferred_day_of_month: 1,
    preferred_hour: 2,
    scan_interval_hours: 24,
    batch_size_per_hour: 8,
    delay_min_seconds: 8,
    delay_max_seconds: 15,
    cooldown_min_seconds: 45,
    cooldown_max_seconds: 90,
  })
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date())

  const handlePrevMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1))
  }
  const [bulkText, setBulkText] = useState('')
  const [loadingTor, setLoadingTor] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [loadingImport, setLoadingImport] = useState(false)
  const [authors, setAuthors] = useState<AuthorProfileDetail[]>([])
  const [loadingAuthors, setLoadingAuthors] = useState(false)
  const [selectedAuthorIds, setSelectedAuthorIds] = useState<number[]>([])
  const [loadingScan, setLoadingScan] = useState(false)
  const [isJobBannerDismissed, setIsJobBannerDismissed] = useState(false)
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)

  // Realtime Log States
  const [logs, setLogs] = useState<AutoSchedulerLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('auto_scheduler_logs')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => ({
            id: item.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            timestamp: item.timestamp || new Date().toISOString(),
            category:
              item.category === 'SCAN'
                ? 'CÀO_CV'
                : item.category === 'IMPORT'
                ? 'NHẬP_CV'
                : item.category === 'TOR'
                ? 'PROXY_TOR'
                : item.category === 'CONFIG'
                ? 'CẤU_HÌNH'
                : item.category === 'SYSTEM'
                ? 'HỆ_THỐNG'
                : item.category || 'HỆ_THỐNG',
            level:
              item.level === 'SUCCESS'
                ? 'THÀNH_CÔNG'
                : item.level === 'ERROR'
                ? 'BÁO_LỖI'
                : item.level === 'WARN'
                ? 'CẢNH_BÁO'
                : item.level === 'INFO' || item.level === 'UPDATE'
                ? 'THÔNG_TIN'
                : item.level || 'THÔNG_TIN',
            action: item.action || '',
            target: item.target,
            details: item.details || ''
          }))
        }
      }
    } catch (e) {
      console.error('Lỗi đọc auto_scheduler_logs từ localStorage:', e)
    }
    return [
      {
        id: 'init-1',
        timestamp: new Date().toISOString(),
        category: 'HỆ_THỐNG',
        level: 'THÔNG_TIN',
        action: 'Hệ thống sẵn sàng',
        details: 'Khởi tạo bối cảnh Realtime Auto-Scheduler & Monitoring Terminal.'
      }
    ]
  })

  const [logSearch, setLogSearch] = useState('')
  const [logCategoryFilter, setLogCategoryFilter] = useState<
    'ALL' | 'CÀO_CV' | 'NHẬP_CV' | 'PROXY_TOR' | 'CẤU_HÌNH' | 'HỆ_THỐNG'
  >('ALL')
  const [logLevelFilter, setLogLevelFilter] = useState<
    'ALL' | 'THÀNH_CÔNG' | 'BÁO_LỖI' | 'CẢNH_BÁO' | 'THÔNG_TIN'
  >('ALL')

  const addSchedulerLog = (
    category: AutoSchedulerLogEntry['category'],
    level: AutoSchedulerLogEntry['level'],
    action: string,
    details: string,
    target?: string
  ) => {
    const newEntry: AutoSchedulerLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      category,
      level,
      action,
      target,
      details,
    }
    setLogs((prevLogs) => {
      const updated = [newEntry, ...prevLogs].slice(0, 300)
      try {
        localStorage.setItem('auto_scheduler_logs', JSON.stringify(updated))
      } catch (e) {
        console.error('Lỗi lưu log vào localStorage', e)
      }
      return updated
    })
  }

  const prevJobStatusRef = useRef<string | null>(null)

  useEffect(() => {
    if (config.current_job_status === 'RUNNING') {
      setIsJobBannerDismissed(false)
    }
    if (prevJobStatusRef.current === 'RUNNING') {
      if (config.current_job_status === 'COMPLETED') {
        addSchedulerLog(
          'CÀO_CV',
          'THÀNH_CÔNG',
          'Hoàn tất quét ngầm',
          config.current_job_detail || 'Đã hoàn thành cào CV ngầm.'
        )
      } else if (config.current_job_status === 'FAILED') {
        addSchedulerLog(
          'CÀO_CV',
          'BÁO_LỖI',
          'Hoàn tất quét ngầm',
          config.current_job_detail || 'Quét ngầm thất bại hoặc bị Google CAPTCHA.'
        )
      }
    }
    prevJobStatusRef.current = config.current_job_status || null
  }, [config.current_job_status, config.current_job_detail])

  const fetchTorStatus = async () => {
    try {
      const res = await scholarApi.getTorStatus()
      setTorInfo(res.data)
    } catch (e) {
      setTorInfo({ status: 'offline' })
    }
  }

  const fetchConfig = async () => {
    try {
      const res = await scholarApi.getAutoScanConfig()
      setConfig((prev: any) => ({ ...prev, ...res.data }))
    } catch (e) {
      console.error(e)
    }
  }

  const fetchAuthors = async (isSilent = false) => {
    if (!isSilent) setLoadingAuthors(true)
    try {
      const resData = await scholarApi.getAuthors().then((r) => r.data)
      const authorsList = Array.isArray(resData)
        ? resData
        : (resData && Array.isArray((resData as any).results))
          ? (resData as any).results
          : []
      setAuthors(authorsList)
    } catch (e) {
      console.error(e)
    } finally {
      if (!isSilent) setLoadingAuthors(false)
    }
  }

  useEffect(() => {
    fetchTorStatus()
    fetchConfig()
    fetchAuthors(false)

    // Poll config & status silently every 4 seconds to reflect live progress without flashing UI
    const interval = setInterval(() => {
      fetchConfig()
      fetchAuthors(true)
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  const handleRotateIp = async () => {
    setLoadingTor(true)
    addSchedulerLog(
      'PROXY_TOR',
      'THÔNG_TIN',
      'Gửi lệnh đổi IP Tor',
      'Đã phát tín hiệu NEWNYM tới Tor Control Port 9051...',
      'Port 9051'
    )
    try {
      await scholarApi.rotateTorIp()
      toast.success('Đã gửi tín hiệu NEWNYM. IP Tor đã được đổi ngẫu nhiên!')
      addSchedulerLog(
        'PROXY_TOR',
        'THÀNH_CÔNG',
        'Đổi IP Tor thành công',
        'Đã nhận xác nhận từ Tor Control. IP đã được đổi ngẫu nhiên.',
        'Port 9051'
      )
      await fetchTorStatus()
    } catch (e) {
      toast.error('Lỗi khi đổi IP Tor.')
      addSchedulerLog(
        'PROXY_TOR',
        'BÁO_LỖI',
        'Lỗi đổi IP Tor',
        'Không thể gửi tín hiệu NEWNYM đến Tor Control Port 9051.',
        'Port 9051'
      )
    } finally {
      setLoadingTor(false)
    }
  }

  const handleStartTor = async () => {
    setLoadingTor(true)
    addSchedulerLog(
      'PROXY_TOR',
      'THÔNG_TIN',
      'Bật Tor Proxy',
      'Khởi động Tor Proxy Container...',
      'Docker Container'
    )
    try {
      const res = await scholarApi.startTorService()
      toast.success(res.data?.message || 'Đã gửi lệnh bật Tor Proxy Container!')
      addSchedulerLog(
        'PROXY_TOR',
        'THÀNH_CÔNG',
        'Khởi động Tor Proxy thành công',
        res.data?.message || 'Container Tor Proxy đã khởi động.',
        'Docker Container'
      )
      await fetchTorStatus()
    } catch (e: any) {
      const errMsg = e.response?.data?.error || 'Lỗi khi bật Tor Proxy Container.'
      toast.error(errMsg)
      addSchedulerLog('PROXY_TOR', 'BÁO_LỖI', 'Lỗi bật Tor Container', errMsg, 'Docker Container')
    } finally {
      setLoadingTor(false)
    }
  }

  const handleSaveConfig = async () => {
    setLoadingConfig(true)
    try {
      await scholarApi.updateAutoScanConfig(config)
      toast.success('Đã cập nhật cấu hình lịch cào tự động.')
      addSchedulerLog(
        'CẤU_HÌNH',
        'THÀNH_CÔNG',
        'Lưu cấu hình lịch cào',
        `Cấu hình mới: Kích hoạt=${config.is_active ? 'Bật' : 'Tắt'}, Chu kỳ=${config.frequency_type || 'WEEKLY'}, Hạn ngạch=${config.batch_size_per_hour || 8} CV/h, Delay=${config.delay_min_seconds}-${config.delay_max_seconds}s`,
        'AutoScanConfig'
      )
    } catch (e) {
      toast.error('Lỗi khi lưu cấu hình.')
      addSchedulerLog('CẤU_HÌNH', 'BÁO_LỖI', 'Lỗi lưu cấu hình', 'Không thể lưu thông số cấu hình auto-scan.', 'AutoScanConfig')
    } finally {
      setLoadingConfig(false)
    }
  }

  const handleBulkImport = async () => {
    if (!bulkText.trim()) {
      toast.error('Vui lòng dán danh sách Scholar ID hoặc URL!')
      return
    }
    const snippet = bulkText.trim().slice(0, 60)
    const lineCount = bulkText.trim().split('\n').filter(Boolean).length
    addSchedulerLog(
      'NHẬP_CV',
      'THÔNG_TIN',
      'Bulk Import CV',
      `Bắt đầu import ${lineCount} dòng dữ liệu CV. Mẫu: "${snippet}${bulkText.length > 60 ? '...' : ''}"`,
      `Count: ${lineCount}`
    )
    setLoadingImport(true)
    try {
      const res = await scholarApi.bulkImportCVs({ scholar_ids_or_urls: bulkText, trigger_now: true })
      toast.success(res.data?.message || 'Đã nhập danh sách CV thành công!')
      addSchedulerLog(
        'NHẬP_CV',
        'THÀNH_CÔNG',
        'Nhập danh sách CV tác giả',
        res.data?.message || `Đã nhập thành công ${lineCount} hồ sơ CV.`,
        `Count: ${lineCount}`
      )
      setBulkText('')
      fetchAuthors()
    } catch (e) {
      toast.error('Lỗi khi nhập danh sách CV.')
      addSchedulerLog('NHẬP_CV', 'BÁO_LỖI', 'Lỗi Bulk Import', 'Xảy ra lỗi trong quá trình import danh sách CV tác giả.', `Count: ${lineCount}`)
    } finally {
      setLoadingImport(false)
    }
  }

  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = authors.map((a: any) => a.id).filter(Boolean)
      setSelectedAuthorIds(allIds)
    } else {
      setSelectedAuthorIds([])
    }
  }

  const handleToggleSelectRow = (id: number) => {
    if (selectedAuthorIds.includes(id)) {
      setSelectedAuthorIds(selectedAuthorIds.filter((i) => i !== id))
    } else {
      setSelectedAuthorIds([...selectedAuthorIds, id])
    }
  }

  const handleTriggerScan = async (targetIds?: number[]) => {
    const ids = targetIds || selectedAuthorIds
    if (!ids || ids.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 tác giả!')
      return
    }
    addSchedulerLog(
      'CÀO_CV',
      'THÔNG_TIN',
      'Kích hoạt cào CV ngầm',
      `Bắt đầu quét trực tiếp cho ${ids.length} tác giả (IDs: ${ids.join(', ')})`,
      `IDs: ${ids.slice(0, 4).join(', ')}${ids.length > 4 ? '...' : ''}`
    )
    setLoadingScan(true)
    try {
      const res = await scholarApi.triggerAuthorsScan(ids)
      toast.success(res.data?.message || `Đã phát lệnh quét ngầm trực tiếp cho ${ids.length} tác giả!`)
      addSchedulerLog(
        'CÀO_CV',
        'THÀNH_CÔNG',
        'Phát lệnh cào CV thành công',
        res.data?.message || `Đã gửi tác vụ quét cho ${ids.length} tác giả vào Celery queue.`,
        `Count: ${ids.length}`
      )
      setSelectedAuthorIds([])
      fetchAuthors()
    } catch (e) {
      toast.error('Lỗi khi phát lệnh quét ngầm.')
      addSchedulerLog('CÀO_CV', 'BÁO_LỖI', 'Lỗi phát lệnh cào CV', 'Không thể khởi chạy tiến trình quét CV cho các tác giả được chọn.', `Count: ${ids.length}`)
    } finally {
      setLoadingScan(false)
    }
  }

  const handleClearLogs = () => {
    setLogs([])
    try {
      localStorage.removeItem('auto_scheduler_logs')
    } catch (e) {
      console.error(e)
    }
    toast.success('Đã xóa tất cả nhật ký.')
  }

  const handleExportLogs = (format: 'json' | 'txt') => {
    if (logs.length === 0) {
      toast.error('Không có nhật ký nào để xuất!')
      return
    }
    let content = ''
    let mimeType = 'text/plain'
    let fileName = `auto_scheduler_logs_${new Date().toISOString().slice(0, 10)}`

    if (format === 'json') {
      content = JSON.stringify(logs, null, 2)
      mimeType = 'application/json'
      fileName += '.json'
    } else {
      content = logs
        .map(
          (l) =>
            `[${formatLogTime(l.timestamp)}] [${l.level}] [${l.category}] ${l.action}${l.target ? ` (@${l.target})` : ''}: ${l.details}`
        )
        .join('\n')
      fileName += '.txt'
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Đã xuất file nhật ký (${fileName})`)
  }

  const formatLogTime = (isoOrFormatted: string) => {
    try {
      const d = new Date(isoOrFormatted)
      if (isNaN(d.getTime())) return isoOrFormatted
      const pad = (n: number) => n.toString().padStart(2, '0')
      const hh = pad(d.getHours())
      const mm = pad(d.getMinutes())
      const ss = pad(d.getSeconds())
      const DD = pad(d.getDate())
      const MM = pad(d.getMonth() + 1)
      const YYYY = d.getFullYear()
      return `${hh}:${mm}:${ss} ${DD}/${MM}/${YYYY}`
    } catch {
      return isoOrFormatted
    }
  }

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !logSearch.trim() ||
      log.action.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.details.toLowerCase().includes(logSearch.toLowerCase()) ||
      (log.target && log.target.toLowerCase().includes(logSearch.toLowerCase()))

    const matchesCategory =
      logCategoryFilter === 'ALL' || log.category === logCategoryFilter

    const matchesLevel =
      logLevelFilter === 'ALL' || log.level === logLevelFilter

    return matchesSearch && matchesCategory && matchesLevel
  })

  const getStatusBadge = (status: string | undefined) => {
    const s = status ? status.toUpperCase() : 'PENDING'
    switch (s) {
      case 'UP_TO_DATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-3xs">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> UP_TO_DATE
          </span>
        )
      case 'UPDATED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-3xs">
            <Zap className="w-3.5 h-3.5 text-blue-600" /> UPDATED
          </span>
        )
      case 'FAILED_CAPTCHA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-3xs">
            <XCircle className="w-3.5 h-3.5 text-rose-600" /> FAILED_CAPTCHA
          </span>
        )
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-3xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" /> IN_PROGRESS
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200/80 shadow-3xs">
            <Clock className="w-3.5 h-3.5 text-slate-500" /> PENDING
          </span>
        )
    }
  }

  const detectedCount = bulkText.trim().split('\n').filter(Boolean).length

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            <span>Scholar Auto-Scheduler Terminal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/30 border border-indigo-400/30 text-cyan-300 shadow-inner">
              <Cpu className="h-6 w-6" />
            </div>
            Tự Động Hóa CV Scholar & Tor Control
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Quản lý cào dữ liệu CV tác giả tự động ngầm với Tor Multi-Hop Proxy & Fast Smart Check
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 shrink-0">
          <button
            onClick={() => setIsLogModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md backdrop-blur-md hover:scale-[1.02] active:scale-[0.98]"
          >
            <FileText className="h-4 w-4 text-cyan-300" />
            <span>📋 Xem Nhật Ký Cào Dữ Liệu</span>
            <span className="bg-cyan-400/20 text-cyan-200 border border-cyan-400/30 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full">
              {logs.length}
            </span>
          </button>

          <button
            onClick={() => {
              fetchTorStatus()
              fetchConfig()
              fetchAuthors()
            }}
            className="px-4 py-2.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 border border-indigo-400/30 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md hover:scale-[1.02] active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" />
            🔄 Làm mới
          </button>
        </div>
      </div>

      {/* Live Job Execution Progress & Status Monitor Card */}
      {!isJobBannerDismissed && config.current_job_status && config.current_job_status !== 'IDLE' && (
        <Card
          className={`p-5 rounded-2xl text-white shadow-lg border transition-all duration-300 ${
            config.current_job_status === 'RUNNING'
              ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-indigo-700/50'
              : config.current_job_status === 'COMPLETED'
              ? 'bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-950 border-emerald-600/50'
              : 'bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 border-rose-700/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5 font-bold text-sm">
              {config.current_job_status === 'RUNNING' && (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
                  <span className="tracking-wide uppercase text-xs text-cyan-300">
                    TIẾN TRÌNH QUÉT TỰ ĐỘNG CV NGẦM (BACKGROUND JOB)
                  </span>
                </>
              )}
              {config.current_job_status === 'COMPLETED' && (
                <>
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                  <span className="tracking-wide uppercase text-xs text-emerald-300">
                    HOÀN THÀNH TIẾN TRÌNH QUÉT CV NGẦM
                  </span>
                </>
              )}
              {config.current_job_status === 'FAILED' && (
                <>
                  <XCircle className="h-5 w-5 text-rose-400" />
                  <span className="tracking-wide uppercase text-xs text-rose-300">
                    BÁO LỖI QUÉT CV / BỊ GOOGLE CAPTCHA CHẶN
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                  config.current_job_status === 'RUNNING'
                    ? 'bg-indigo-900/90 text-cyan-300 border-indigo-500/50'
                    : config.current_job_status === 'COMPLETED'
                    ? 'bg-emerald-900/90 text-emerald-300 border-emerald-500/50'
                    : 'bg-rose-900/90 text-rose-300 border-rose-500/50'
                }`}
              >
                {config.current_job_status === 'RUNNING'
                  ? `${config.current_job_progress || 0}%`
                  : config.current_job_status === 'COMPLETED'
                  ? '100% THÀNH CÔNG'
                  : 'THẤT BẠI'}
              </span>

              {config.current_job_status !== 'RUNNING' && (
                <button
                  onClick={() => {
                    setIsJobBannerDismissed(true)
                    setConfig((prev: any) => ({ ...prev, current_job_status: 'IDLE' }))
                    scholarApi.updateAutoScanConfig({ current_job_status: 'IDLE' }).then(fetchConfig)
                  }}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/20 transition-colors cursor-pointer shrink-0"
                  title="Tắt thông báo"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-200 font-medium mb-3">
            {config.current_job_detail || 'Đang theo dõi tiến trình thực hiện ngầm...'}
          </p>

          <div className="w-full bg-slate-950/80 rounded-full h-2.5 overflow-hidden border border-white/10 p-0.5">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 shadow-sm ${
                config.current_job_status === 'RUNNING'
                  ? 'bg-gradient-to-r from-cyan-400 to-blue-500'
                  : config.current_job_status === 'COMPLETED'
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
                  : 'bg-gradient-to-r from-rose-500 to-red-600'
              }`}
              style={{
                width: `${Math.max(
                  5,
                  config.current_job_progress || (config.current_job_status === 'COMPLETED' ? 100 : 100)
                )}%`,
              }}
            />
          </div>
        </Card>
      )}

      {/* Main Page Top Section (2 Compact Cards Side-by-Side, zero empty whitespace) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Tor Proxy Gateway Card (Content-fitted height) */}
        <Card className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-md space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            {/* Header: ShieldAlert, "Tor Proxy Gateway", Status pill (● ONLINE), Exit IP badge */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 text-xs sm:text-sm">Tor Proxy Gateway</h2>
                  <span className="font-mono text-[10px] text-[#005b9a] bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-semibold inline-block mt-0.5">
                    Exit IP: {torInfo?.ip || '185.xxx'}
                  </span>
                </div>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-3xs ${
                  torInfo?.status === 'online'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${torInfo?.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {torInfo?.status === 'online' ? '● ONLINE' : 'OFF'}
              </span>
            </div>

            {/* Port Badges Row */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50/80 px-3 py-1.5 rounded-xl border border-slate-200/70 flex items-center justify-between">
                <span className="flex items-center gap-1 text-slate-500 font-medium text-[11px]">
                  <Server className="w-3.5 h-3.5 text-indigo-500" />
                  SOCKS5
                </span>
                <span className="font-mono font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                  9050
                </span>
              </div>
              <div className="bg-slate-50/80 px-3 py-1.5 rounded-xl border border-slate-200/70 flex items-center justify-between">
                <span className="flex items-center gap-1 text-slate-500 font-medium text-[11px]">
                  <Zap className="w-3.5 h-3.5 text-indigo-500" />
                  Control
                </span>
                <span className="font-mono font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                  9051
                </span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-1 flex flex-col items-center gap-2">
            {torInfo?.status === 'offline' && (
              <button
                onClick={handleStartTor}
                disabled={loadingTor}
                className="w-full px-3 py-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-200"
              >
                <Power className={`h-3.5 w-3.5 ${loadingTor ? 'animate-spin' : ''}`} />
                ⚡ Khởi Động Tor (9050/9051)
              </button>
            )}
            <button
              onClick={handleRotateIp}
              disabled={loadingTor || torInfo?.status !== 'online'}
              className="w-full px-3 py-2.5 rounded-2xl bg-gradient-to-r from-[#005b9a] via-indigo-600 to-indigo-700 hover:from-[#004b80] hover:to-indigo-800 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-indigo-200 text-center leading-tight"
            >
              <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${loadingTor ? 'animate-spin' : ''}`} />
              <span>🔄 Đổi IP Tor Ngẫu Nhiên (9050 • 9051)</span>
            </button>
          </div>
        </Card>

        {/* Card 2: Auto-Scan Schedule Status Card (Content-fitted height) */}
        <Card className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-md space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            {/* Header: Icon Settings, Title "Cấu Hình Lịch Auto-Scan", Active toggle switch */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 border border-blue-100 text-[#005b9a]">
                  <Settings className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 text-xs sm:text-sm">Cấu Hình Lịch Auto-Scan</h2>
                  <p className="text-[11px] text-slate-500">Chu kỳ & mốc giờ quét tự động</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.is_active ?? true}
                  onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#005b9a]"></div>
                <span className="ml-2 text-xs font-bold text-slate-700">Kích hoạt</span>
              </label>
            </div>

            {/* Schedule Summary Badge */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 flex-wrap">
                {(() => {
                  const modeText =
                    config.frequency_type === 'MONTHLY'
                      ? '🗓️ Mode Hằng Tháng'
                      : config.frequency_type === 'DAILY'
                      ? '⚡ Mode Hằng Ngày'
                      : '📅 Mode Hằng Tuần'

                  const dayText =
                    config.frequency_type === 'MONTHLY'
                      ? `Ngày ${config.preferred_day_of_month ?? 1}`
                      : config.frequency_type === 'DAILY'
                      ? 'Mỗi ngày'
                      : WEEKDAYS.find((w) => w.value === (config.preferred_weekday ?? 0))?.label || 'Thứ 2'

                  const hour = config.preferred_hour ?? 2
                  const minute = config.preferred_minute ?? 0
                  const hourStr = hour < 10 ? `0${hour}` : `${hour}`
                  const minStr = minute < 10 ? `0${minute}` : `${minute}`
                  const timePeriod = hour >= 18 || hour < 6 ? '(Đêm)' : '(Ngày)'
                  const timeText = `${hourStr}:${minStr} ${timePeriod}`

                  const quotaText = `${config.batch_size_per_hour ?? 8} CV/h`
                  const delayText = `Delay ${config.delay_min_seconds ?? 8}-${config.delay_max_seconds ?? 15}s`

                  return `${modeText} • ${dayText} • ${timeText} • ${quotaText} • ${delayText}`
                })()}
              </span>
            </div>
          </div>

          {/* Button */}
          <div className="pt-1">
            <button
              onClick={() => setIsScheduleModalOpen(true)}
              className="w-full px-4 py-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-[#4F46E5] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-indigo-200/80 shadow-2xs"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>⚙️ Cấu Hình Thời Gian Quét</span>
            </button>
          </div>
        </Card>
      </div>

      {/* Floating Schedule Config Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-3xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#4F46E5]" />
                  Cấu Hình Thời Gian Quét Auto-Scan
                </h3>
                <p className="text-xs text-slate-500">Thiết lập chu kỳ, mốc giờ & hạn ngạch</p>
              </div>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
              {/* 3 Mode Radio Bar */}
              <div className="grid grid-cols-3 gap-3 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/70">
                <button
                  type="button"
                  onClick={() => {
                    setConfig({ ...config, frequency_type: 'WEEKLY' })
                    addSchedulerLog('CẤU_HÌNH', 'THÔNG_TIN', 'Chuyển Mode Chu kỳ', 'Đã chuyển sang Mode 1: Hằng Tuần', 'ModeSelector')
                  }}
                  className={`p-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between border ${
                    (config.frequency_type || 'WEEKLY') === 'WEEKLY'
                      ? 'bg-white text-[#4F46E5] shadow-sm border-[#4F46E5] ring-2 ring-indigo-100'
                      : 'bg-white/50 text-slate-600 hover:bg-white border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">📅</span>
                    <div className="text-left leading-tight">
                      <div>Hằng Tuần</div>
                      <div className="text-[10px] text-slate-400 font-normal">Chạy theo Thứ</div>
                    </div>
                  </div>
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] ${
                    (config.frequency_type || 'WEEKLY') === 'WEEKLY' ? 'border-[#4F46E5] bg-[#4F46E5] text-white font-bold' : 'border-slate-300'
                  }`}>
                    {(config.frequency_type || 'WEEKLY') === 'WEEKLY' && '✓'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConfig({ ...config, frequency_type: 'MONTHLY' })
                    addSchedulerLog('CẤU_HÌNH', 'THÔNG_TIN', 'Chuyển Mode Chu kỳ', 'Đã chuyển sang Mode 2: Hằng Tháng', 'ModeSelector')
                  }}
                  className={`p-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between border ${
                    config.frequency_type === 'MONTHLY'
                      ? 'bg-white text-[#4F46E5] shadow-sm border-[#4F46E5] ring-2 ring-indigo-100'
                      : 'bg-white/50 text-slate-600 hover:bg-white border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">🗓️</span>
                    <div className="text-left leading-tight">
                      <div>Hằng Tháng</div>
                      <div className="text-[10px] text-slate-400 font-normal">Chạy theo Ngày</div>
                    </div>
                  </div>
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] ${
                    config.frequency_type === 'MONTHLY' ? 'border-[#4F46E5] bg-[#4F46E5] text-white font-bold' : 'border-slate-300'
                  }`}>
                    {config.frequency_type === 'MONTHLY' && '✓'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConfig({ ...config, frequency_type: 'DAILY' })
                    addSchedulerLog('CẤU_HÌNH', 'THÔNG_TIN', 'Chuyển Mode Chu kỳ', 'Đã chuyển sang Mode 3: Hằng Ngày', 'ModeSelector')
                  }}
                  className={`p-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between border ${
                    config.frequency_type === 'DAILY'
                      ? 'bg-white text-[#4F46E5] shadow-sm border-[#4F46E5] ring-2 ring-indigo-100'
                      : 'bg-white/50 text-slate-600 hover:bg-white border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚡</span>
                    <div className="text-left leading-tight">
                      <div>Hằng Ngày</div>
                      <div className="text-[10px] text-slate-400 font-normal">Mỗi 24 giờ</div>
                    </div>
                  </div>
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] ${
                    config.frequency_type === 'DAILY' ? 'border-[#4F46E5] bg-[#4F46E5] text-white font-bold' : 'border-slate-300'
                  }`}>
                    {config.frequency_type === 'DAILY' && '✓'}
                  </span>
                </button>
              </div>

              {/* Calendar & Analog Clock Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Calendar Widget */}
                <div className="bg-slate-50/60 rounded-2xl p-4 border border-slate-200/80 space-y-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-[#4F46E5]" />
                      <span>Chọn Ngày Cào</span>
                    </label>
                    <span className="text-[10px] font-mono font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                      {(config.frequency_type || 'WEEKLY') === 'WEEKLY' && `Lặp lại: ${WEEKDAYS.find(w => w.value === (config.preferred_weekday ?? 0))?.label}`}
                      {config.frequency_type === 'MONTHLY' && `Lặp lại: Ngày ${config.preferred_day_of_month ?? 1} hằng tháng`}
                      {config.frequency_type === 'DAILY' && '⚡ Lặp lại hằng ngày'}
                    </span>
                  </div>

                  {config.frequency_type === 'DAILY' ? (
                    <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 text-center space-y-2 my-auto">
                      <div className="w-10 h-10 rounded-xl bg-white text-[#4F46E5] font-bold text-lg flex items-center justify-center mx-auto shadow-xs border border-indigo-100">
                        ⚡
                      </div>
                      <h4 className="font-bold text-xs text-slate-800">Chế độ Quét Hằng Ngày</h4>
                      <p className="text-[11px] text-slate-600 leading-relaxed max-w-xs mx-auto">
                        Tự động cào ngầm lặp lại <strong>mỗi 24 giờ</strong> vào mốc giờ đã chọn.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(config.frequency_type || 'WEEKLY') === 'WEEKLY' && (
                        <div className="grid grid-cols-7 gap-1">
                          {WEEKDAYS.map((w) => {
                            const isSelected = (config.preferred_weekday ?? 0) === w.value
                            return (
                              <button
                                key={w.value}
                                type="button"
                                onClick={() => {
                                  setConfig((prev: any) => ({ ...prev, preferred_weekday: w.value }))
                                  addSchedulerLog('CẤU_HÌNH', 'THÔNG_TIN', 'Chọn Thứ cào CV', `Đã chọn ${w.label} hàng tuần`, 'WeekdayPill')
                                }}
                                className={`py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-center ${
                                  isSelected
                                    ? 'bg-[#4F46E5] text-white shadow-xs'
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

                            const isSelected = config.frequency_type === 'MONTHLY'
                              ? (config.preferred_day_of_month ?? 1) === d
                              : (config.preferred_weekday ?? 0) === weekday

                            daysElements.push(
                              <button
                                key={`day-${d}`}
                                type="button"
                                onClick={() => {
                                  setConfig((prev: any) => ({
                                    ...prev,
                                    preferred_day_of_month: d,
                                    preferred_weekday: weekday,
                                  }))
                                  addSchedulerLog(
                                    'CẤU_HÌNH',
                                    'THÔNG_TIN',
                                    'Chọn ngày cào CV',
                                    `Đã chọn ngày ${d} (${WEEKDAYS.find(w => w.value === weekday)?.label || ''})`,
                                    'CalendarWidget'
                                  )
                                }}
                                className={
                                  isSelected
                                    ? 'bg-[#4F46E5] text-white rounded-xl shadow-md font-bold w-8 h-8 flex items-center justify-center mx-auto cursor-pointer transition-all'
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
                      <Clock className="w-4 h-4 text-[#4F46E5]" />
                      <span>Chọn Giờ Kích Hoạt</span>
                    </label>
                    <span className="text-[10px] font-mono text-[#4F46E5] font-bold bg-white px-2 py-0.5 rounded-full border border-slate-200">
                      {((config.preferred_hour ?? 2) < 10 ? `0${config.preferred_hour ?? 2}` : config.preferred_hour ?? 2)}:{(config.preferred_minute ?? 0) < 10 ? `0${config.preferred_minute ?? 0}` : config.preferred_minute ?? 0}
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
                        const hour24 = config.preferred_hour ?? 2
                        const minute = config.preferred_minute ?? 0
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
                              className="w-1 h-13 bg-[#4F46E5] absolute top-2 left-1/2 -translate-x-1/2 origin-bottom rounded-full transition-transform duration-300 shadow-xs"
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
                      const hour24 = config.preferred_hour ?? 2
                      const minute = config.preferred_minute ?? 0
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
                              setConfig((prev: any) => ({ ...prev, preferred_hour: newH24 }))
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
                              setConfig((prev: any) => ({ ...prev, preferred_minute: selectedMin }))
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
                              setConfig((prev: any) => ({ ...prev, preferred_hour: newH24 }))
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

              {/* Throttling Inputs Grid */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <label className="block text-slate-600 font-semibold text-[11px]">CV/Giờ</label>
                  <input
                    type="number"
                    value={config.batch_size_per_hour ?? 8}
                    onChange={(e) => setConfig({ ...config, batch_size_per_hour: parseInt(e.target.value) || 8 })}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#4F46E5] bg-white font-mono font-bold text-slate-800"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <label className="block text-slate-600 font-semibold text-[11px]">Delay Min (s)</label>
                  <input
                    type="number"
                    value={config.delay_min_seconds ?? 8}
                    onChange={(e) => setConfig({ ...config, delay_min_seconds: parseInt(e.target.value) || 8 })}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#4F46E5] bg-white font-mono font-bold text-slate-800"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <label className="block text-slate-600 font-semibold text-[11px]">Delay Max (s)</label>
                  <input
                    type="number"
                    value={config.delay_max_seconds ?? 15}
                    onChange={(e) => setConfig({ ...config, delay_max_seconds: parseInt(e.target.value) || 15 })}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#4F46E5] bg-white font-mono font-bold text-slate-800"
                  />
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
                onClick={async () => {
                  await handleSaveConfig()
                  setIsScheduleModalOpen(false)
                }}
                disabled={loadingConfig}
                className="bg-[#4F46E5] text-white hover:bg-indigo-700 disabled:opacity-50 rounded-xl px-6 py-2 text-xs font-bold shadow-md cursor-pointer transition-all flex items-center gap-1.5"
              >
                {loadingConfig && <Spinner className="w-3.5 h-3.5 text-white" />}
                Lưu Cấu Hình
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Middle Section: Nhập Danh Sách Hồ Sơ CV Tác Giả Card */}
      <Card className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-base">📥 Nhập Danh Sách Hồ Sơ CV Tác Giả</h2>
              <p className="text-xs text-slate-500">Đưa hàng loạt ID/URL tác giả vào hàng chờ cào CV tự động</p>
            </div>
          </div>

          {/* Format Instruction Badges */}
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
              ID: <code className="text-[#005b9a] font-bold">q81c5sAAAAAJ</code>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 hidden md:inline-block">
              URL: <code className="text-[#005b9a]">https://scholar.google.com/citations?user=...</code>
            </span>
          </div>
        </div>

        <div className="relative">
          <textarea
            rows={4}
            placeholder="Dán scholar_id (VD: q81c5sAAAAAJ) hoặc URL profile (VD: https://scholar.google.com/citations?user=q81c5sAAAAAJ)..."
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            className="w-full border border-slate-200/80 rounded-2xl p-4 text-xs font-mono focus:outline-none focus:border-[#005b9a] bg-slate-50/50 shadow-inner leading-relaxed"
          />
          <div className="absolute right-3 bottom-3 text-[11px] font-mono text-slate-400 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-3xs">
            Đã phát hiện <strong className="text-[#005b9a]">{detectedCount}</strong> ID/URL
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleBulkImport}
            disabled={loadingImport || !bulkText.trim()}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#005b9a] to-indigo-600 hover:from-[#004b80] hover:to-indigo-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-indigo-200 hover:scale-[1.01] active:scale-[0.99]"
          >
            {loadingImport ? <Spinner className="w-4 h-4 text-white" /> : <Play className="h-4 w-4 text-cyan-300 fill-cyan-300" />}
            🚀 Nhập CV & Kích Hoạt Quét Ngay
          </button>
        </div>
      </Card>

      {/* 5. Bottom Section: Trạng Thái Tự Động Quét CV Tác Giả Table Card */}
      <Card className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <List className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-base">Trạng Thái Tự Động Quét CV Tác Giả</h2>
              <p className="text-xs text-slate-500">Danh sách tác giả và trạng thái Fast Smart Check mới nhất</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {selectedAuthorIds.length > 0 && (
              <button
                onClick={() => handleTriggerScan()}
                disabled={loadingScan}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md shadow-blue-200 transition-all animate-pulse"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingScan ? 'animate-spin' : ''}`} />
                Quét Lại Trực Tiếp ({selectedAuthorIds.length} Đã Chọn)
              </button>
            )}
            <span className="text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/80">
              Tổng cộng: <strong className="text-slate-800">{authors.length}</strong> tác giả
            </span>
          </div>
        </div>

        {loadingAuthors ? (
          <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm">
            <Spinner /> Đang tải danh sách tác giả...
          </div>
        ) : authors.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Chưa có tác giả nào trong hệ thống. Hãy nhập danh sách CV phía trên.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4 w-10">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 accent-[#005b9a] cursor-pointer"
                      checked={authors.length > 0 && selectedAuthorIds.length === authors.length}
                      onChange={handleToggleSelectAll}
                    />
                  </th>
                  <th className="py-3.5 px-4">Tác Giả</th>
                  <th className="py-3.5 px-4">Scholar ID</th>
                  <th className="py-3.5 px-4 text-center">Số Bài Báo</th>
                  <th className="py-3.5 px-4 text-center">Fast Smart Check</th>
                  <th className="py-3.5 px-4 text-right">Lần Quét Cuối</th>
                  <th className="py-3.5 px-4 text-center">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {authors.map((author: any) => (
                  <tr key={author.id || author.scholar_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 accent-[#005b9a] cursor-pointer"
                        checked={selectedAuthorIds.includes(author.id)}
                        onChange={() => handleToggleSelectRow(author.id)}
                      />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500 shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{author.name}</div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[240px]">
                            {author.affiliation || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-600">{author.scholar_id}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                      {author.publication_count_cached || author.publications?.length || 0}
                    </td>
                    <td className="py-3.5 px-4 text-center">{getStatusBadge(author.last_scan_status)}</td>
                    <td className="py-3.5 px-4 text-right text-slate-500 font-mono text-[11px]">
                      {author.last_scraped_at
                        ? new Date(author.last_scraped_at).toLocaleString('vi-VN')
                        : 'Chưa từng'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleTriggerScan([author.id])}
                        disabled={loadingScan}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] inline-flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-3xs"
                      >
                        <RefreshCw className="w-3 h-3 text-slate-500" />
                        Quét lại
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 6. Floating Log Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#005b9a]" />
                  Nhật Ký Hoạt Động & Kết Quả Quét CV
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lưu vết thông tin cào dữ liệu, trạng thái thành công và báo lỗi
                </p>
              </div>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter controls bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-3 items-center justify-between">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Tìm kiếm nhật ký, tên tác giả, ID..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#005b9a]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Category Filter select */}
                <select
                  value={logCategoryFilter}
                  onChange={(e) => setLogCategoryFilter(e.target.value as any)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#005b9a] cursor-pointer"
                >
                  <option value="ALL">Tất cả danh mục</option>
                  <option value="CÀO_CV">Cào CV</option>
                  <option value="NHẬP_CV">Nhập CV</option>
                  <option value="PROXY_TOR">Proxy Tor</option>
                  <option value="CẤU_HÌNH">Cấu hình</option>
                  <option value="HỆ_THỐNG">Hệ thống</option>
                </select>

                {/* Level Filter select */}
                <select
                  value={logLevelFilter}
                  onChange={(e) => setLogLevelFilter(e.target.value as any)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#005b9a] cursor-pointer"
                >
                  <option value="ALL">Tất cả kết quả</option>
                  <option value="THÀNH_CÔNG">Thành công</option>
                  <option value="BÁO_LỖI">Báo lỗi</option>
                  <option value="CẢNH_BÁO">Cảnh báo</option>
                  <option value="THÔNG_TIN">Thông tin</option>
                </select>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-2.5 flex-1">
              {filteredLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  Không tìm thấy nhật ký nào phù hợp.
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl border border-slate-100 bg-white shadow-2xs hover:border-slate-200 transition-all space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Category badge */}
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {log.category.replace('_', ' ')}
                        </span>
                        {/* Level badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                            log.level === 'THÀNH_CÔNG'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : log.level === 'BÁO_LỖI'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : log.level === 'CẢNH_BÁO'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {log.level.replace('_', ' ')}
                        </span>
                        {/* Action Title */}
                        <span className="font-semibold text-slate-800 text-xs">
                          {log.action}
                        </span>
                        {/* Target author badge (if present) */}
                        {log.target && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                            @{log.target}
                          </span>
                        )}
                      </div>
                      {/* Timestamp */}
                      <span className="text-[11px] text-slate-400 font-mono">
                        {formatLogTime(log.timestamp)}
                      </span>
                    </div>
                    {/* Details description */}
                    <p className="text-xs text-slate-600 leading-relaxed pl-1">
                      {log.details}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="relative group">
                  <button
                    onClick={() => handleExportLogs('txt')}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-3xs"
                  >
                    <Download className="w-4 h-4 text-slate-500" />
                    Xuất file (TXT/JSON)
                  </button>
                  <div className="hidden group-hover:flex absolute left-0 bottom-full mb-1 bg-slate-800 text-white rounded-lg p-1 text-[11px] gap-1 z-10 shadow-lg">
                    <button
                      onClick={() => handleExportLogs('txt')}
                      className="px-2 py-1 hover:bg-slate-700 rounded cursor-pointer"
                    >
                      TXT
                    </button>
                    <button
                      onClick={() => handleExportLogs('json')}
                      className="px-2 py-1 hover:bg-slate-700 rounded cursor-pointer"
                    >
                      JSON
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleClearLogs}
                  className="px-3.5 py-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-3xs"
                >
                  <Trash2 className="w-4 h-4" />
                  Xóa nhật ký
                </button>
              </div>

              <button
                onClick={() => setIsLogModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all cursor-pointer shadow-3xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
