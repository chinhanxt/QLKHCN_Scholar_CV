import { useState, useEffect } from 'react'
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
  List
} from 'lucide-react'

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

  const fetchAuthors = async () => {
    setLoadingAuthors(true)
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
      setLoadingAuthors(false)
    }
  }

  useEffect(() => {
    fetchTorStatus()
    fetchConfig()
    fetchAuthors()
  }, [])

  const handleRotateIp = async () => {
    setLoadingTor(true)
    try {
      await scholarApi.rotateTorIp()
      toast.success('Đã gửi tín hiệu NEWNYM. IP Tor đã được đổi ngẫu nhiên!')
      await fetchTorStatus()
    } catch (e) {
      toast.error('Lỗi khi đổi IP Tor.')
    } finally {
      setLoadingTor(false)
    }
  }

  const handleSaveConfig = async () => {
    setLoadingConfig(true)
    try {
      await scholarApi.updateAutoScanConfig(config)
      toast.success('Đã cập nhật cấu hình lịch cào tự động.')
    } catch (e) {
      toast.error('Lỗi khi lưu cấu hình.')
    } finally {
      setLoadingConfig(false)
    }
  }

  const handleBulkImport = async () => {
    if (!bulkText.trim()) {
      toast.error('Vui lòng dán danh sách Scholar ID hoặc URL!')
      return
    }
    setLoadingImport(true)
    try {
      const res = await scholarApi.bulkImportCVs({ scholar_ids_or_urls: bulkText, trigger_now: true })
      toast.success(res.data?.message || 'Đã nhập danh sách CV thành công!')
      setBulkText('')
      fetchAuthors()
    } catch (e) {
      toast.error('Lỗi khi nhập danh sách CV.')
    } finally {
      setLoadingImport(false)
    }
  }

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

          <div className="pt-2">
            <button
              onClick={handleRotateIp}
              disabled={loadingTor}
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
            <div>
              <label className="block text-slate-600 font-medium mb-1">Tần suất quét (Giờ)</label>
              <input
                type="number"
                value={config.scan_interval_hours ?? 24}
                onChange={(e) => setConfig({ ...config, scan_interval_hours: parseInt(e.target.value) || 24 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#005b9a]"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Hạn ngạch CV/Giờ</label>
              <input
                type="number"
                value={config.batch_size_per_hour ?? 8}
                onChange={(e) => setConfig({ ...config, batch_size_per_hour: parseInt(e.target.value) || 8 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#005b9a]"
              />
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
          <span className="text-xs text-slate-500 font-medium">
            Tổng cộng: <strong className="text-slate-800">{authors.length}</strong> tác giả
          </span>
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
                  <th className="py-3 px-4">Tác Giả</th>
                  <th className="py-3 px-4">Scholar ID</th>
                  <th className="py-3 px-4 text-center">Số Bài Báo</th>
                  <th className="py-3 px-4 text-center">Fast Smart Check</th>
                  <th className="py-3 px-4 text-right">Lần Quét Cuối</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {authors.map((author: any) => (
                  <tr key={author.id || author.scholar_id} className="hover:bg-slate-50/50 transition-colors">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
