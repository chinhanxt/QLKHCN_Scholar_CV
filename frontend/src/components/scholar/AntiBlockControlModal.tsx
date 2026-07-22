import { useState, useEffect } from 'react'
import {
  ShieldAlert,
  RefreshCw,
  Key,
  Server,
  Cpu,
  Check,
  X,
  Loader2,
  Activity,
  Zap,
  Lock
} from 'lucide-react'
import { toast } from 'sonner'
import { antiBlockApi } from '@/api/endpoints/scholar'

interface AntiBlockControlModalProps {
  isOpen: boolean
  onClose: () => void
}

interface AntiBlockConfigState {
  use_tor_proxy: boolean
  use_free_proxy_pool: boolean
  custom_proxy_list: string
  enable_captcha_solver: boolean
  captcha_provider: string
  captcha_api_key: string
  base_delay_seconds: number
  max_delay_seconds: number
  total_requests_count: number
  captcha_encountered_count: number
  captcha_solved_count: number
  ip_rotations_count: number
}

const defaultConfig: AntiBlockConfigState = {
  use_tor_proxy: true,
  use_free_proxy_pool: true,
  custom_proxy_list: '',
  enable_captcha_solver: false,
  captcha_provider: '2captcha',
  captcha_api_key: '',
  base_delay_seconds: 1.0,
  max_delay_seconds: 15.0,
  total_requests_count: 0,
  captcha_encountered_count: 0,
  captcha_solved_count: 0,
  ip_rotations_count: 0,
}

export function AntiBlockControlModal({ isOpen, onClose }: AntiBlockControlModalProps) {
  const [config, setConfig] = useState<AntiBlockConfigState>(defaultConfig)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

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

  useEffect(() => {
    if (isOpen) {
      fetchConfig()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        use_tor_proxy: config.use_tor_proxy,
        use_free_proxy_pool: config.use_free_proxy_pool,
        custom_proxy_list: config.custom_proxy_list,
        enable_captcha_solver: config.enable_captcha_solver,
        captcha_provider: config.captcha_provider,
        captcha_api_key: config.captcha_api_key,
        base_delay_seconds: Number(config.base_delay_seconds),
        max_delay_seconds: Number(config.max_delay_seconds),
      }
      const res = await antiBlockApi.updateConfig(payload)
      if (res.data) {
        setConfig((prev) => ({ ...prev, ...res.data }))
      }
      toast.success('Đã cập nhật cấu hình Kháng Chặn thành công!')
      onClose()
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

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Hệ Thống Kháng Chặn 3 Lớp
                <span className="text-[10px] font-mono font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full">
                  Anti-Block Suite
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Quản lý Tor Proxy Gateway, Proxy Pool, 2Captcha Solver & Delay Tự Động
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs font-semibold text-slate-500">Đang tải cấu hình kháng chặn...</p>
          </div>
        ) : (
          <div className="p-6 overflow-y-auto space-y-6 text-slate-800">
            {/* Metric Banner Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-500">Tổng Số Request</div>
                  <div className="text-lg font-bold text-slate-900 font-mono">
                    {config.total_requests_count?.toLocaleString() || 0}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-100 text-purple-600">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-500 font-sans">Lần Đổi IP Tor</div>
                  <div className="text-lg font-bold text-slate-900 font-mono">
                    {config.ip_rotations_count?.toLocaleString() || 0}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-500">CAPTCHA Giải Được</div>
                  <div className="text-lg font-bold text-slate-900 font-mono flex items-center gap-1">
                    <span>{config.captcha_solved_count?.toLocaleString() || 0}</span>
                    <span className="text-xs font-normal text-slate-400">
                      / {config.captcha_encountered_count || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Layer 1: Tor & Proxy Routing */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-3xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-sm text-slate-900">Lớp 1: Điều Hướng Proxy & Tor Gateway</h3>
                </div>

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
                  <span>Xoay IP Tor Ngay (NEWNYM Signal)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tor Proxy Toggle */}
                <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/60 transition-colors">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      Sử Dụng Tor Network (SOCKS5)
                    </span>
                    <p className="text-[11px] text-slate-500">Mã hóa đa tầng & đổi IP tự động</p>
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

            {/* Layer 2: CAPTCHA Auto-Solver */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-3xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-purple-600" />
                  <h3 className="font-bold text-sm text-slate-900">Lớp 2: Tự Động Giải Google CAPTCHA</h3>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enable_captcha_solver}
                    onChange={(e) => setConfig({ ...config, enable_captcha_solver: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  <span className="ml-2 text-xs font-bold text-slate-700">Kích hoạt Solver</span>
                </label>
              </div>

              {config.enable_captcha_solver && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-150">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-slate-500" />
                      Dịch Vụ Giải CAPTCHA Provider
                    </label>
                    <select
                      value={config.captcha_provider || '2captcha'}
                      onChange={(e) => setConfig({ ...config, captcha_provider: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-medium bg-slate-50 focus:bg-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="2captcha">2Captcha Service (2captcha.com)</option>
                      <option value="anti-captcha">Anti-Captcha Service</option>
                      <option value="custom">Custom Captcha Service</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                      API Key (2Captcha API Token)
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={config.captcha_api_key || ''}
                        onChange={(e) => setConfig({ ...config, captcha_api_key: e.target.value })}
                        placeholder="Nhập 2Captcha API Key..."
                        className="w-full border border-slate-200 rounded-xl p-2.5 pr-16 text-xs font-mono bg-slate-50 focus:bg-white focus:outline-none focus:border-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-200/60 rounded-md"
                      >
                        {showApiKey ? 'Ẩn' : 'Hiện'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Layer 3: Adaptive Delays & Rate Limits */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-3xs">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <ShieldAlert className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">Lớp 3: Thời Gian Delay Thích Ứng (Adaptive Delay)</h3>
              </div>

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
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-200/60 font-bold text-xs transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99]"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Check className="w-4 h-4 text-white" />
            )}
            <span>Lưu Cấu Hình Kháng Chặn</span>
          </button>
        </div>
      </div>
    </div>
  )
}
