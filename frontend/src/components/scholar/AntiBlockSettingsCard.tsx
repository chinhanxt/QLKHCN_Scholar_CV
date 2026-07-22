import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  ShieldAlert,
  Server,
  Zap,
  RefreshCw,
  Loader2,
  Check,
  Cpu,
  Power
} from 'lucide-react'
import { toast } from 'sonner'
import { antiBlockApi, scholarApi } from '@/api/endpoints/scholar'

interface AntiBlockConfigState {
  use_tor_proxy: boolean
  use_free_proxy_pool: boolean
  custom_proxy_list: string
  base_delay_seconds: number
  max_delay_seconds: number
  total_requests_count: number
  ip_rotations_count: number
}

const defaultConfig: AntiBlockConfigState = {
  use_tor_proxy: true,
  use_free_proxy_pool: true,
  custom_proxy_list: '',
  base_delay_seconds: 1.0,
  max_delay_seconds: 15.0,
  total_requests_count: 0,
  ip_rotations_count: 0,
}

export function AntiBlockSettingsCard() {
  const [config, setConfig] = useState<AntiBlockConfigState>(defaultConfig)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [torInfo, setTorInfo] = useState<{ status: string; ip: string } | null>(null)
  const [loadingTorStatus, setLoadingTorStatus] = useState(false)

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const res = await antiBlockApi.getConfig()
      if (res.data) {
        setConfig((prev) => ({
          ...prev,
          ...res.data,
        }))
      }
    } catch (error) {
      console.error('Lỗi tải cấu hình Anti-Block:', error)
      toast.error('Không thể tải cấu hình Hệ thống Kháng Chặn.')
    } finally {
      setLoading(false)
    }
  }

  const fetchTorStatus = async () => {
    setLoadingTorStatus(true)
    try {
      const res = await scholarApi.getTorStatus()
      if (res.data) {
        setTorInfo({
          status: res.data.status || 'offline',
          ip: res.data.ip || 'Unknown',
        })
      }
    } catch {
      setTorInfo({ status: 'offline', ip: 'Unknown' })
    } finally {
      setLoadingTorStatus(false)
    }
  }

  useEffect(() => {
    fetchConfig()
    fetchTorStatus()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        use_tor_proxy: config.use_tor_proxy,
        use_free_proxy_pool: config.use_free_proxy_pool,
        custom_proxy_list: config.custom_proxy_list,
        base_delay_seconds: Number(config.base_delay_seconds),
        max_delay_seconds: Number(config.max_delay_seconds),
      }
      const res = await antiBlockApi.updateConfig(payload)
      if (res.data) {
        setConfig((prev) => ({ ...prev, ...res.data }))
      }
      toast.success('Đã lưu cấu hình Kháng Chặn hệ thống thành công!')
    } catch (error) {
      console.error('Lỗi lưu cấu hình Anti-Block:', error)
      toast.error('Lưu cấu hình Kháng Chặn thất bại.')
    } finally {
      setSaving(false)
    }
  }

  const handleRotateTor = async () => {
    setRotating(true)
    try {
      const res = await antiBlockApi.rotateTor()
      if (res.data?.rotated) {
        toast.success('Đã phát tín hiệu NEWNYM! Đổi IP Tor thành công.')
        setConfig((prev) => ({
          ...prev,
          ip_rotations_count: prev.ip_rotations_count + 1,
        }))
        fetchTorStatus()
      } else {
        toast.warning(res.data?.message || 'Không thể xoay IP Tor vào lúc này.')
      }
    } catch (error) {
      console.error('Lỗi xoay IP Tor:', error)
      toast.error('Gửi tín hiệu NEWNYM xoay IP Tor thất bại.')
    } finally {
      setRotating(false)
    }
  }

  const handleStartTor = async () => {
    setLoadingTorStatus(true)
    try {
      const res = await scholarApi.startTorService()
      if (res.data?.status === 'started' || res.data?.status === 'online') {
        toast.success('Đã khởi động Tor Proxy thành công!')
        fetchTorStatus()
      } else {
        toast.error('Khởi động Tor Proxy thất bại.')
      }
    } catch {
      toast.error('Không thể kết nối đến Tor service.')
    } finally {
      setLoadingTorStatus(false)
    }
  }

  if (loading) {
    return (
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardContent className="p-8 flex justify-center items-center gap-2 text-slate-500 text-xs font-medium">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          <span>Đang tải cấu hình kháng chặn hệ thống...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
      <CardContent className="p-6 space-y-6">
        {/* Title Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="h-4.5 w-4.5 text-blue-600" />
            Hệ Thống Cấu Hình Kháng Chặn & Tor Gateway
          </h2>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow-3xs ${
                torInfo?.status === 'online'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${torInfo?.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span>{torInfo?.status === 'online' ? 'ĐANG HOẠT ĐỘNG' : 'NGẮT KẾT NỐI'}</span>
            </span>

            {torInfo?.status === 'offline' && (
              <button
                type="button"
                onClick={handleStartTor}
                disabled={loadingTorStatus}
                className="px-3.5 py-1.5 rounded-xl bg-[#005b9a] hover:bg-[#004677] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-3xs disabled:opacity-50"
              >
                {loadingTorStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
                <span>Khởi Động Tor</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleRotateTor}
              disabled={rotating || !config.use_tor_proxy}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-3xs"
            >
              {rotating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-white" />
              )}
              <span>Đổi IP Tor (NEWNYM)</span>
            </button>
          </div>
        </div>

        {/* Live Tor Network Info Badges Bar */}
        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-800">Tor Proxy Gateway Live Info</span>
                <span className="font-mono text-[10px] text-[#005b9a] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 font-semibold">
                  Exit IP: {torInfo?.ip || '185.xxx.xxx.xxx'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Mã hóa đa tầng & Đổi IP ngẫu nhiên ngầm tự động</p>
            </div>
            {loadingTorStatus && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="bg-white px-3.5 py-2 rounded-xl border border-slate-200/70 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-600 font-medium text-[11px]">
                <Server className="w-4 h-4 text-blue-600" />
                <span>SOCKS5 Proxy</span>
              </span>
              <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs">
                Port 9050
              </span>
            </div>

            <div className="bg-white px-3.5 py-2 rounded-xl border border-slate-200/70 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-600 font-medium text-[11px]">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Control Port</span>
              </span>
              <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs">
                Port 9051
              </span>
            </div>
          </div>
        </div>

        {/* Layer 1: Tor & Proxy Routing */}
        <div className="space-y-4">
          <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Server className="w-4 h-4 text-blue-600" /> Lớp 1: Điều Hướng Proxy & Tor Gateway
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tor Proxy Toggle */}
            <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/60 transition-colors">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Sử Dụng Tor Network (SOCKS5)
                </span>
                <p className="text-[11px] text-slate-500">Mã hóa đa tầng & đổi IP tự động miễn phí</p>
              </div>
              <input
                type="checkbox"
                checked={config.use_tor_proxy}
                onChange={(e) => setConfig({ ...config, use_tor_proxy: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
            </label>

            {/* Free Proxy Pool Toggle */}
            <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/60 transition-colors">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-blue-500" />
                  Bật Pool Free Proxy Dự Phòng
                </span>
                <p className="text-[11px] text-slate-500">Tự động luân chuyển danh sách proxy public</p>
              </div>
              <input
                type="checkbox"
                checked={config.use_free_proxy_pool}
                onChange={(e) => setConfig({ ...config, use_free_proxy_pool: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
            </label>
          </div>

          {/* Custom Proxy List */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Danh Sách Custom Proxy Tùy Chỉnh</span>
              <span className="text-[11px] font-normal text-slate-400">Mỗi dòng 1 proxy (http://user:pass@ip:port)</span>
            </label>
            <textarea
              rows={3}
              value={config.custom_proxy_list || ''}
              onChange={(e) => setConfig({ ...config, custom_proxy_list: e.target.value })}
              placeholder="http://127.0.0.1:8080&#10;socks5://user:pass@192.168.1.1:1080"
              className="w-full border border-slate-200 rounded-xl p-3 text-xs font-mono bg-slate-50/50 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Layer 2: Adaptive Delays & Rate Limits */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-emerald-600" /> Lớp 2: Thời Gian Delay Thích Ứng (Adaptive Delay Rate-Limiter)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Base Delay (Giây)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="60"
                value={config.base_delay_seconds ?? 1.0}
                onChange={(e) => setConfig({ ...config, base_delay_seconds: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-mono bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-slate-400">Thời gian nghỉ tối thiểu giữa các request</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Max Delay (Giây)</label>
              <input
                type="number"
                step="1"
                min="1"
                max="300"
                value={config.max_delay_seconds ?? 15.0}
                onChange={(e) => setConfig({ ...config, max_delay_seconds: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-mono bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-slate-400">Thời gian backoff tối đa khi phát hiện rate-limit</p>
            </div>
          </div>
        </div>

        {/* Card Footer Save Button */}
        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-5 bg-[#005b9a] hover:bg-[#004677] text-white font-bold text-xs cursor-pointer transition-colors shadow-xs disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            <span>Lưu Cấu Hình Kháng Chặn</span>
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
