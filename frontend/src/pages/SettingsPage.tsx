import { useState, useEffect } from 'react'
import { scholarApi } from '@/api/endpoints/scholar'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { Settings, ShieldAlert, Check, RefreshCw } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

export function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Settings State
  const [proxyMode, setProxyMode] = useState('DIRECT')
  const [scraperApiKey, setScraperApiKey] = useState('')
  const [luminatiUser, setLuminatiUser] = useState('')
  const [luminatiPassword, setLuminatiPassword] = useState('')
  const [luminatiPort, setLuminatiPort] = useState(0)
  const [httpProxy, setHttpProxy] = useState('')
  const [httpsProxy, setHttpsProxy] = useState('')
  const [retries, setRetries] = useState(3)

  const loadSettings = async () => {
    setIsLoading(true)
    try {
      const data = await scholarApi.getSettings().then((r) => r.data)
      setProxyMode(data.SCHOLAR_PROXY_MODE || 'DIRECT')
      setScraperApiKey(data.SCRAPER_API_KEY || '')
      setLuminatiUser(data.SCHOLAR_LUMINATI_USER || '')
      setLuminatiPassword(data.SCHOLAR_LUMINATI_PASSWORD || '')
      setLuminatiPort(data.SCHOLAR_LUMINATI_PORT || 0)
      setHttpProxy(data.SCHOLAR_HTTP_PROXY || '')
      setHttpsProxy(data.SCHOLAR_HTTPS_PROXY || '')
      setRetries(data.SCHOLAR_RETRIES ?? 3)
    } catch (err) {
      toast.error('Không thể tải cấu hình hệ thống.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const payload = {
        SCHOLAR_PROXY_MODE: proxyMode,
        SCRAPER_API_KEY: scraperApiKey,
        SCHOLAR_LUMINATI_USER: luminatiUser,
        SCHOLAR_LUMINATI_PASSWORD: luminatiPassword,
        SCHOLAR_LUMINATI_PORT: luminatiPort,
        SCHOLAR_HTTP_PROXY: httpProxy,
        SCHOLAR_HTTPS_PROXY: httpsProxy,
        SCHOLAR_RETRIES: retries
      }
      await scholarApi.saveSettings(payload)
      toast.success('Đã lưu cấu hình hệ thống thành công!')
    } catch (err) {
      toast.error('Lưu cấu hình hệ thống thất bại.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-4xl">

      {isLoading ? (
        <Card className="border-slate-100 shadow-sm bg-white">
          <CardContent className="p-12 flex justify-center items-center">
            <Spinner className="h-8 w-8 text-[#005b9a]" />
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Proxy Configuration Card */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardContent className="p-6 space-y-6">
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Settings className="h-4.5 w-4.5 text-[#005b9a]" />
                Cấu hình Proxy & IP (Độ tin cậy cao)
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Loại Proxy</label>
                  <select
                    value={proxyMode}
                    onChange={(e) => setProxyMode(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#005b9a] cursor-pointer font-medium w-full"
                  >
                    <option value="DIRECT">Không sử dụng (None / Direct)</option>
                    <option value="SCRAPERAPI">ScraperAPI Service</option>
                    <option value="FREE_PROXIES">Free Proxies Pool</option>
                    <option value="TOR">Tor Network</option>
                    <option value="SINGLEPROXY">Single Proxy (HTTP/HTTPS)</option>
                    <option value="LUMINATI">Luminati Service</option>
                  </select>
                </div>

                {/* Retries */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Số lần thử lại khi lỗi HTTP</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={retries}
                    onChange={(e) => setRetries(Number(e.target.value))}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#005b9a] w-full font-medium"
                  />
                </div>
              </div>

              {/* Conditional Inputs */}
              {proxyMode === 'SCRAPERAPI' && (
                <div className="space-y-4 pt-2 border-t border-slate-50 animate-in fade-in-50 duration-200">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">ScraperAPI Key</label>
                    <input
                      type="text"
                      placeholder="Nhập ScraperAPI Key của bạn..."
                      value={scraperApiKey}
                      onChange={(e) => setScraperApiKey(e.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#005b9a] w-full font-mono"
                      required
                    />
                  </div>
                </div>
              )}

              {proxyMode === 'SINGLEPROXY' && (
                <div className="grid gap-4 md:grid-cols-2 pt-2 border-t border-slate-50 animate-in fade-in-50 duration-200">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">HTTP Proxy URL</label>
                    <input
                      type="text"
                      placeholder="http://username:password@ip:port"
                      value={httpProxy}
                      onChange={(e) => setHttpProxy(e.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#005b9a] w-full font-mono"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">HTTPS Proxy URL</label>
                    <input
                      type="text"
                      placeholder="https://username:password@ip:port"
                      value={httpsProxy}
                      onChange={(e) => setHttpsProxy(e.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#005b9a] w-full font-mono"
                    />
                  </div>
                </div>
              )}

              {proxyMode === 'LUMINATI' && (
                <div className="grid gap-4 md:grid-cols-3 pt-2 border-t border-slate-50 animate-in fade-in-50 duration-200">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Luminati User</label>
                    <input
                      type="text"
                      value={luminatiUser}
                      onChange={(e) => setLuminatiUser(e.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#005b9a] w-full"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Luminati Password</label>
                    <input
                      type="password"
                      value={luminatiPassword}
                      onChange={(e) => setLuminatiPassword(e.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#005b9a] w-full"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Luminati Port</label>
                    <input
                      type="number"
                      value={luminatiPort}
                      onChange={(e) => setLuminatiPort(Number(e.target.value))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#005b9a] w-full"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-700 flex gap-2">
                <ShieldAlert className="h-4.5 w-4.5 shrink-0 text-amber-500" />
                <div className="leading-normal">
                  <span className="font-bold">Lưu ý bảo mật:</span> Khi thay đổi cấu hình Proxy, Celery background worker sẽ sử dụng cài đặt mới để thực hiện cào thông tin Google Scholar và các trang liên kết. Đảm bảo thông tin Proxy chính xác để tránh bị chặn IP.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={loadSettings}
              disabled={isSaving}
              className="flex items-center justify-center gap-1.5 rounded-lg py-2 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs cursor-pointer transition-colors shadow-3xs disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Hủy thay đổi</span>
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center justify-center gap-1.5 rounded-lg py-2 px-5 bg-[#005b9a] hover:bg-[#004677] text-white font-bold text-xs cursor-pointer transition-colors shadow-xs disabled:opacity-50"
            >
              {isSaving ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              <span>Lưu cấu hình</span>
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
