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
  Pause,
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
  Terminal
} from 'lucide-react'

export interface AutoSchedulerLogEntry {
  id: string
  timestamp: string
  category: 'IMPORT' | 'SCAN' | 'TOR' | 'CONFIG' | 'SYSTEM'
  level: 'SUCCESS' | 'INFO' | 'UPDATE' | 'WARN' | 'ERROR'
  action: string
  target?: string
  details: string
}

export function ScholarAutoSchedulerPage() {
  const [torInfo, setTorInfo] = useState<any>(null)
  const [config, setConfig] = useState<any>({
    is_active: true,
    scan_interval_hours: 24,
    batch_size_per_hour: 8,
    delay_min_seconds: 8,
    delay_max_seconds: 15,
    cooldown_min_seconds: 45,
    cooldown_max_seconds: 90,
  })
  const [bulkText, setBulkText] = useState('')
  const [loadingTor, setLoadingTor] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [loadingImport, setLoadingImport] = useState(false)
  const [authors, setAuthors] = useState<AuthorProfileDetail[]>([])
  const [loadingAuthors, setLoadingAuthors] = useState(false)
  const [selectedAuthorIds, setSelectedAuthorIds] = useState<number[]>([])
  const [loadingScan, setLoadingScan] = useState(false)
  const [isJobBannerDismissed, setIsJobBannerDismissed] = useState(false)

  // Realtime Log Terminal States
  const [logs, setLogs] = useState<AutoSchedulerLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('auto_scheduler_logs')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      }
    } catch (e) {
      console.error('Lỗi đọc auto_scheduler_logs từ localStorage:', e)
    }
    return [
      {
        id: 'init-1',
        timestamp: new Date().toISOString(),
        category: 'SYSTEM',
        level: 'INFO',
        action: 'Hệ thống sẵn sàng',
        details: 'Khởi tạo bối cảnh Realtime Auto-Scheduler & Monitoring Terminal.'
      }
    ]
  })

  const [logSearch, setLogSearch] = useState('')
  const [logCategoryFilter, setLogCategoryFilter] = useState<'ALL' | 'IMPORT' | 'SCAN' | 'TOR' | 'CONFIG' | 'SYSTEM'>('ALL')
  const [logLevelFilter, setLogLevelFilter] = useState<'ALL' | 'SUCCESS' | 'INFO' | 'UPDATE' | 'WARN' | 'ERROR'>('ALL')
  const [isAutoScroll, setIsAutoScroll] = useState(true)
  const logContainerRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (isAutoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0
    }
  }, [logs, isAutoScroll])

  useEffect(() => {
    if (config.current_job_status === 'RUNNING') {
      setIsJobBannerDismissed(false)
    }
  }, [config.current_job_status])

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
      setConfig(res.data)
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
    addSchedulerLog('TOR', 'INFO', 'Đổi IP Tor (NEWNYM)', 'Gửi tín hiệu NEWNYM đến Tor Control Port 9051...', 'Port 9051')
    try {
      await scholarApi.rotateTorIp()
      toast.success('Đã gửi tín hiệu NEWNYM. IP Tor đã được đổi ngẫu nhiên!')
      addSchedulerLog('TOR', 'SUCCESS', 'Đã đổi IP Tor thành công', 'Đã nhận xác nhận từ Tor Control. IP đã được đổi ngẫu nhiên.', 'Port 9051')
      await fetchTorStatus()
    } catch (e) {
      toast.error('Lỗi khi đổi IP Tor.')
      addSchedulerLog('TOR', 'ERROR', 'Lỗi khi đổi IP Tor', 'Không thể gửi tín hiệu NEWNYM đến Tor Control Port 9051.', 'Port 9051')
    } finally {
      setLoadingTor(false)
    }
  }

  const handleStartTor = async () => {
    setLoadingTor(true)
    addSchedulerLog('TOR', 'INFO', 'Khởi động Tor Proxy', 'Đang gửi lệnh kích hoạt Tor Proxy Container...', 'Docker Container')
    try {
      const res = await scholarApi.startTorService()
      toast.success(res.data?.message || 'Đã gửi lệnh bật Tor Proxy Container!')
      addSchedulerLog('TOR', 'SUCCESS', 'Khởi động Tor Proxy thành công', res.data?.message || 'Container Tor Proxy đã khởi động.', 'Docker Container')
      await fetchTorStatus()
    } catch (e: any) {
      const errMsg = e.response?.data?.error || 'Lỗi khi bật Tor Proxy Container.'
      toast.error(errMsg)
      addSchedulerLog('TOR', 'ERROR', 'Lỗi bật Tor Container', errMsg, 'Docker Container')
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
        'CONFIG',
        'SUCCESS',
        'Lưu cấu hình auto-scan',
        `Cấu hình mới: Kích hoạt=${config.is_active ? 'Bật' : 'Tắt'}, Chu kỳ=${config.frequency_type || 'WEEKLY'}, Hạn ngạch=${config.batch_size_per_hour || 8} CV/h, Delay=${config.delay_min_seconds}-${config.delay_max_seconds}s`,
        'AutoScanConfig'
      )
    } catch (e) {
      toast.error('Lỗi khi lưu cấu hình.')
      addSchedulerLog('CONFIG', 'ERROR', 'Lỗi lưu cấu hình', 'Không thể lưu thông số cấu hình auto-scan.', 'AutoScanConfig')
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
      'IMPORT',
      'INFO',
      'Bulk Import CV',
      `Bắt đầu import ${lineCount} dòng dữ liệu CV. Mẫu: "${snippet}${bulkText.length > 60 ? '...' : ''}"`,
      `Count: ${lineCount}`
    )
    setLoadingImport(true)
    try {
      const res = await scholarApi.bulkImportCVs({ scholar_ids_or_urls: bulkText, trigger_now: true })
      toast.success(res.data?.message || 'Đã nhập danh sách CV thành công!')
      addSchedulerLog(
        'IMPORT',
        'SUCCESS',
        'Bulk Import CV hoàn tất',
        res.data?.message || `Đã nhập thành công ${lineCount} hồ sơ CV.`,
        `Count: ${lineCount}`
      )
      setBulkText('')
      fetchAuthors()
    } catch (e) {
      toast.error('Lỗi khi nhập danh sách CV.')
      addSchedulerLog('IMPORT', 'ERROR', 'Lỗi Bulk Import', 'Xảy ra lỗi trong quá trình import danh sách CV tác giả.', `Count: ${lineCount}`)
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
      'SCAN',
      'INFO',
      'Kích hoạt quét CV trực tiếp',
      `Bắt đầu quét trực tiếp cho ${ids.length} tác giả (IDs: ${ids.join(', ')})`,
      `IDs: ${ids.slice(0, 4).join(', ')}${ids.length > 4 ? '...' : ''}`
    )
    setLoadingScan(true)
    try {
      const res = await scholarApi.triggerAuthorsScan(ids)
      toast.success(res.data?.message || `Đã phát lệnh quét ngầm trực tiếp cho ${ids.length} tác giả!`)
      addSchedulerLog(
        'SCAN',
        'SUCCESS',
        'Phát lệnh quét thành công',
        res.data?.message || `Đã gửi tác vụ quét cho ${ids.length} tác giả vào Celery queue.`,
        `Count: ${ids.length}`
      )
      setSelectedAuthorIds([])
      fetchAuthors()
    } catch (e) {
      toast.error('Lỗi khi phát lệnh quét ngầm.')
      addSchedulerLog('SCAN', 'ERROR', 'Lỗi phát lệnh quét', 'Không thể khởi chạy tiến trình quét CV cho các tác giả được chọn.', `Count: ${ids.length}`)
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

  const getLevelBadgeStyle = (level: AutoSchedulerLogEntry['level']) => {
    switch (level) {
      case 'SUCCESS':
        return 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
      case 'INFO':
        return 'bg-blue-950/80 text-blue-400 border-blue-800/60'
      case 'UPDATE':
        return 'bg-cyan-950/80 text-cyan-400 border-cyan-800/60'
      case 'WARN':
        return 'bg-amber-950/80 text-amber-400 border-amber-800/60'
      case 'ERROR':
        return 'bg-rose-950/80 text-rose-400 border-rose-800/60'
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700'
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
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" /> UP_TO_DATE
          </span>
        )
      case 'UPDATED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
            <Zap className="w-3.5 h-3.5" /> UPDATED
          </span>
        )
      case 'FAILED_CAPTCHA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" /> FAILED_CAPTCHA
          </span>
        )
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> IN_PROGRESS
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <Clock className="w-3.5 h-3.5" /> PENDING
          </span>
        )
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="h-6 w-6 text-[#005b9a]" />
            Tự Động Hóa CV Scholar & Tor Control
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý cào dữ liệu CV tác giả tự động ngầm với Tor Multi-Hop Proxy & Fast Smart Check
          </p>
        </div>
        <button
          onClick={() => { fetchTorStatus(); fetchConfig(); fetchAuthors(); }}
          className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center gap-2 cursor-pointer transition-all"
        >
          <RefreshCw className="h-4 w-4" />
          Làm mới
        </button>
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
              style={{ width: `${Math.max(5, config.current_job_progress || (config.current_job_status === 'COMPLETED' ? 100 : 100))}%` }}
            />
          </div>
        </Card>
      )}

      {/* Top Section: Tor Proxy Widget & Schedule Config */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tor Proxy Status Widget */}
        <Card className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-indigo-600" />
              <h2 className="font-bold text-slate-800">Trạng Thái Tor Proxy Gateway</h2>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                torInfo?.status === 'online'
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-100 text-rose-700 border border-rose-200'
              }`}
            >
              {torInfo?.status === 'online' ? '● ONLINE' : '○ DISCONNECTED'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">SOCKS5 Proxy Port:</span>
              <span className="font-mono font-semibold text-slate-700">9050</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Control Port (NEWNYM):</span>
              <span className="font-mono font-semibold text-slate-700">9051</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Mọi request đến Google Scholar đều được mã hóa chui qua 3 máy chủ Tor ngẫu nhiên toàn cầu (3-hop multi-relay). IP máy chủ gốc hoàn toàn được ẩn giấu.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-2">
            {torInfo?.status === 'offline' && (
              <button
                onClick={handleStartTor}
                disabled={loadingTor}
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Power className={`h-4 w-4 ${loadingTor ? 'animate-spin' : ''}`} />
                Khởi Động Tor Container (Docker)
              </button>
            )}
            <button
              onClick={handleRotateIp}
              disabled={loadingTor || torInfo?.status !== 'online'}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 ${loadingTor ? 'animate-spin' : ''}`} />
              Đổi IP Tor Ngay (NEWNYM Signal)
            </button>
          </div>
        </Card>

        {/* Schedule Config Form */}
        <Card className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-[#005b9a]" />
              <h2 className="font-bold text-slate-800">Cấu Hình Lịch Auto-Scan</h2>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.is_active ?? true}
                onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#005b9a]"></div>
              <span className="ml-2 text-xs font-semibold text-slate-700">Kích hoạt</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Column 1: Frequency Type */}
            <div>
              <label className="block text-slate-600 font-medium mb-1">Chu kỳ lặp lại quét CV</label>
              <select
                value={config.frequency_type || 'WEEKLY'}
                onChange={(e) => setConfig({ ...config, frequency_type: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#005b9a] bg-white cursor-pointer font-medium"
              >
                <option value="WEEKLY">📅 Hằng tuần (Chạy theo thứ)</option>
                <option value="MONTHLY">🗓️ Hằng tháng (Chạy theo ngày)</option>
                <option value="DAILY">⚡ Hằng ngày (Chạy mỗi ngày)</option>
              </select>
              <span className="text-[10px] text-slate-400 block mt-0.5">Tự động chọn chu kỳ quét ngầm</span>
            </div>

            {/* Column 2: Dynamic Single Slot Box (Changes based on frequency_type) */}
            <div>
              <label className="block text-slate-600 font-medium mb-1">Mốc thời gian chạy tự động</label>
              <div className="flex gap-1.5">
                {config.frequency_type === 'WEEKLY' && (
                  <select
                    value={config.preferred_weekday ?? 0}
                    onChange={(e) => setConfig({ ...config, preferred_weekday: parseInt(e.target.value) })}
                    className="w-1/2 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#005b9a] bg-white cursor-pointer font-medium text-xs"
                  >
                    <option value={0}>Thứ Hai</option>
                    <option value={1}>Thứ Ba</option>
                    <option value={2}>Thứ Tư</option>
                    <option value={3}>Thứ Năm</option>
                    <option value={4}>Thứ Sáu</option>
                    <option value={5}>Thứ Bảy</option>
                    <option value={6}>Chủ Nhật</option>
                  </select>
                )}

                {config.frequency_type === 'MONTHLY' && (
                  <select
                    value={config.preferred_day_of_month ?? 1}
                    onChange={(e) => setConfig({ ...config, preferred_day_of_month: parseInt(e.target.value) })}
                    className="w-1/2 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#005b9a] bg-white cursor-pointer font-medium text-xs"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        Ngày {d}
                      </option>
                    ))}
                  </select>
                )}

                <select
                  value={config.preferred_hour ?? 2}
                  onChange={(e) => setConfig({ ...config, preferred_hour: parseInt(e.target.value) })}
                  className={`${config.frequency_type === 'DAILY' ? 'w-full' : 'w-1/2'} border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#005b9a] bg-white cursor-pointer font-medium text-xs`}
                >
                  {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                    <option key={h} value={h}>
                      {h < 10 ? `0${h}` : h}:00 ({h < 12 ? 'Sáng' : h === 12 ? 'Trưa' : 'Chiều/Đêm'})
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Thời điểm chính xác kích hoạt quét ngầm</span>
            </div>

            {/* Row 2 Column 1: Batch size per hour */}
            <div>
              <label className="block text-slate-600 font-medium mb-1">Hạn ngạch CV/Giờ</label>
              <input
                type="number"
                value={config.batch_size_per_hour ?? 8}
                onChange={(e) => setConfig({ ...config, batch_size_per_hour: parseInt(e.target.value) || 8 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#005b9a]"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">Số lượng CV rải rác cào trong 1 giờ</span>
            </div>
            
            <div>
              <label className="block text-slate-600 font-medium mb-1">Delay Min (Giây)</label>
              <input
                type="number"
                value={config.delay_min_seconds ?? 8}
                onChange={(e) => setConfig({ ...config, delay_min_seconds: parseInt(e.target.value) || 8 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#005b9a]"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Delay Max (Giây)</label>
              <input
                type="number"
                value={config.delay_max_seconds ?? 15}
                onChange={(e) => setConfig({ ...config, delay_max_seconds: parseInt(e.target.value) || 15 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#005b9a]"
              />
            </div>
          </div>

          <div className="pt-1">
            <button
              onClick={handleSaveConfig}
              disabled={loadingConfig}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs cursor-pointer transition-all shadow-sm"
            >
              {loadingConfig ? 'Đang lưu...' : 'Lưu Cấu Hình Hẹn Giờ'}
            </button>
          </div>
        </Card>
      </div>

      {/* Middle Section: Bulk CV Importer */}
      <Card className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-[#005b9a]" />
          <h2 className="font-bold text-slate-800">Bulk Import CV Tác Giả</h2>
        </div>
        <p className="text-xs text-slate-500">
          Nhập danh sách Google Scholar ID hoặc URL hồ sơ tác giả (mỗi dòng 1 ID/URL) để đưa vào hàng chờ tự động quét CV ngầm.
        </p>
        <textarea
          rows={3}
          placeholder="Dán scholar_id (VD: q81c5sAAAAAJ) hoặc URL profile (VD: https://scholar.google.com/citations?user=q81c5sAAAAAJ)..."
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          className="w-full border border-slate-200 rounded-lg p-3 text-xs font-mono focus:outline-none focus:border-[#005b9a]"
        />
        <button
          onClick={handleBulkImport}
          disabled={loadingImport || !bulkText.trim()}
          className="px-5 py-2 rounded-lg bg-[#005b9a] hover:bg-[#004b80] disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-sm"
        >
          {loadingImport ? <Spinner className="w-4 h-4 text-white" /> : <Play className="h-4 w-4" />}
          Nhập CV & Chạy Quét Ngay
        </button>
      </Card>

      {/* Bottom Section: Author CV Status List/Table */}
      <Card className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <List className="h-5 w-5 text-slate-700" />
            <h2 className="font-bold text-slate-800">Trạng Thái Tự Động Quét CV Tác Giả</h2>
          </div>
          <div className="flex items-center gap-3">
            {selectedAuthorIds.length > 0 && (
              <button
                onClick={() => handleTriggerScan()}
                disabled={loadingScan}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm animate-pulse transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingScan ? 'animate-spin' : ''}`} />
                Quét Lại Trực Tiếp ({selectedAuthorIds.length} Đã Chọn)
              </button>
            )}
            <span className="text-xs text-slate-500 font-medium">
              Tổng cộng: <strong className="text-slate-800">{authors.length}</strong> tác giả
            </span>
          </div>
        </div>

        {loadingAuthors ? (
          <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm">
            <Spinner /> Đang tải danh sách tác giả...
          </div>
        ) : authors.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            Chưa có tác giả nào trong hệ thống. Hãy nhập danh sách CV phía trên.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold">
                  <th className="py-3 px-3 w-8">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 accent-[#005b9a] cursor-pointer"
                      checked={authors.length > 0 && selectedAuthorIds.length === authors.length}
                      onChange={handleToggleSelectAll}
                    />
                  </th>
                  <th className="py-3 px-4">Tác Giả</th>
                  <th className="py-3 px-4">Scholar ID</th>
                  <th className="py-3 px-4 text-center">Số Bài Báo</th>
                  <th className="py-3 px-4 text-center">Fast Smart Check</th>
                  <th className="py-3 px-4 text-right">Lần Quét Cuối</th>
                  <th className="py-3 px-4 text-center">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {authors.map((author: any) => (
                  <tr key={author.id || author.scholar_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-3">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 accent-[#005b9a] cursor-pointer"
                        checked={selectedAuthorIds.includes(author.id)}
                        onChange={() => handleToggleSelectRow(author.id)}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                        <div>
                          <div className="font-semibold text-slate-800">{author.name}</div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[240px]">{author.affiliation || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{author.scholar_id}</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">
                      {author.publication_count_cached || author.publications?.length || 0}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(author.last_scan_status)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 font-mono">
                      {author.last_scraped_at
                        ? new Date(author.last_scraped_at).toLocaleString('vi-VN')
                        : 'Chưa từng'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleTriggerScan([author.id])}
                        disabled={loadingScan}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
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

      {/* Log Console UI Component */}
      <Card className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Terminal className="h-5 w-5 text-indigo-600" />
            <h2 className="font-bold text-slate-800 text-base">Nhật Ký Quét Realtime & Kiểm Soát Dữ Liệu</h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              LIVE LOGGING
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              {filteredLogs.length} / {logs.length} nhật ký
            </span>
          </div>

          {/* Export & Clear Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAutoScroll(!isAutoScroll)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isAutoScroll
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title={isAutoScroll ? 'Tắt cuộn tự động' : 'Bật cuộn tự động'}
            >
              {isAutoScroll ? <Pause className="w-3.5 h-3.5 text-indigo-600" /> : <Play className="w-3.5 h-3.5" />}
              Auto Scroll
            </button>

            <button
              onClick={() => handleExportLogs('json')}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Xuất nhật ký dạng JSON"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Xuất File Log
            </button>

            <button
              onClick={handleClearLogs}
              className="px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Xóa tất cả nhật ký"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa Log
            </button>
          </div>
        </div>

        {/* Toolbar: Search, Category Filter Tabs & Level Filter Dropdown */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
            {[
              { id: 'ALL', label: 'Tất cả' },
              { id: 'SCAN', label: 'Quét CV' },
              { id: 'IMPORT', label: 'Import' },
              { id: 'TOR', label: 'Tor Proxy' },
              { id: 'CONFIG', label: 'Cấu hình' },
              { id: 'SYSTEM', label: 'Hệ thống' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setLogCategoryFilter(cat.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  logCategoryFilter === cat.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Box & Level Filter Select */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Tìm nhật ký..."
                className="w-full pl-8 pr-3 py-1 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-[#005b9a] bg-white"
              />
            </div>

            <select
              value={logLevelFilter}
              onChange={(e) => setLogLevelFilter(e.target.value as any)}
              className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium focus:outline-none focus:border-[#005b9a] bg-white cursor-pointer"
            >
              <option value="ALL">Tất cả mức độ</option>
              <option value="SUCCESS">Success</option>
              <option value="INFO">Info</option>
              <option value="UPDATE">Update</option>
              <option value="WARN">Warning</option>
              <option value="ERROR">Error</option>
            </select>
          </div>
        </div>

        {/* Terminal Log Box */}
        <div
          ref={logContainerRef}
          className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs max-h-96 overflow-y-auto custom-scrollbar shadow-inner space-y-2"
        >
          {filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-500 font-sans text-xs">
              Không tìm thấy nhật ký phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-start gap-2 py-1 px-2 rounded hover:bg-slate-900/80 transition-colors border-b border-slate-900/50 last:border-0"
              >
                {/* Level Badge */}
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${getLevelBadgeStyle(
                    log.level
                  )}`}
                >
                  {log.level}
                </span>

                {/* Category Tag */}
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700 font-mono shrink-0">
                  {log.category}
                </span>

                {/* Timestamp */}
                <span className="text-slate-500 shrink-0 select-none">
                  [{formatLogTime(log.timestamp)}]
                </span>

                {/* Action Name */}
                <span className="font-semibold text-slate-200 shrink-0">
                  {log.action}
                </span>

                {/* Target */}
                {log.target && (
                  <span className="text-cyan-400/90 text-[11px] bg-cyan-950/40 px-1 rounded border border-cyan-900/40 shrink-0">
                    @{log.target}
                  </span>
                )}

                {/* Details */}
                <span className="text-slate-400 break-all flex-1">
                  - {log.details}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}

