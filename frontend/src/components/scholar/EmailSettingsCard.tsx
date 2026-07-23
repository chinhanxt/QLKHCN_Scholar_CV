import { useState, useEffect } from 'react'
import { notificationApi } from '@/api/endpoints/notifications'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { Mail, Send, Check, Eye, EyeOff } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

export function EmailSettingsCard() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [form, setForm] = useState({
    EMAIL_HOST: 'smtp.gmail.com',
    EMAIL_PORT: 587,
    EMAIL_USE_TLS: true,
    EMAIL_HOST_USER: '',
    DEFAULT_FROM_EMAIL: ''
  })

  useEffect(() => {
    setIsLoading(true)
    notificationApi.getEmailSettings()
      .then((r) => setForm(r.data))
      .catch(() => toast.error('Không thể tải cấu hình Email SMTP'))
      .finally(() => setIsLoading(false))
  }, [])

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setIsSaving(true)
    try {
      const res = await notificationApi.saveEmailSettings(form)
      toast.success(res.data.message || 'Đã lưu cấu hình Email SMTP thành công!')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.detail || 'Lưu cấu hình Email thất bại.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSendTest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!testEmail) {
      toast.error('Vui lòng nhập địa chỉ email nhận thư thử nghiệm!')
      return
    }
    setIsSendingTest(true)
    try {
      const res = await notificationApi.sendTestEmail(testEmail)
      toast.success(res.data.message || `Đã gửi thư thử nghiệm tới ${testEmail}!`)
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.response?.data?.detail || 'Gửi email thử nghiệm thất bại. Vui lòng kiểm tra tài khoản & Mật khẩu ứng dụng.'
      toast.error(errMsg)
    } finally {
      setIsSendingTest(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="border-slate-100 bg-white p-8 flex justify-center">
        <Spinner className="h-6 w-6 text-[#005b9a]" />
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardContent className="p-6 space-y-5">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Mail className="h-4.5 w-4.5 text-[#005b9a]" />
            Cấu hình Dịch vụ Gửi Email (SMTP Settings)
          </h2>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">EMAIL HOST (SMTP)</label>
                <input
                  type="text"
                  value={form.EMAIL_HOST}
                  onChange={(e) => setForm({ ...form, EMAIL_HOST: e.target.value })}
                  className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">EMAIL PORT</label>
                <input
                  type="number"
                  value={form.EMAIL_PORT}
                  onChange={(e) => setForm({ ...form, EMAIL_PORT: parseInt(e.target.value) || 587 })}
                  className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-mono"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Tài khoản Email gửi (User)</label>
                <input
                  type="text"
                  value={form.EMAIL_HOST_USER}
                  onChange={(e) => setForm({ ...form, EMAIL_HOST_USER: e.target.value })}
                  placeholder="admin@gmail.com"
                  className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Mật khẩu ứng dụng (App Password)</label>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.EMAIL_HOST_PASSWORD || ''}
                    onChange={(e) => setForm({ ...form, EMAIL_HOST_PASSWORD: e.target.value })}
                    placeholder="•••• •••• •••• ••••"
                    autoComplete="new-password"
                    className="w-full p-2.5 pr-10 text-xs rounded-xl border border-slate-200 bg-slate-50 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#005b9a] transition-colors cursor-pointer p-1"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Tên người gửi mặc định (Default From Email)</label>
              <input
                type="text"
                value={form.DEFAULT_FROM_EMAIL}
                onChange={(e) => setForm({ ...form, DEFAULT_FROM_EMAIL: e.target.value })}
                placeholder="Edu Ecosystem <nguyenhuy151025@gmail.com>"
                className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-mono"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Khuyên dùng dạng chuẩn Gmail: <code className="text-slate-600 bg-slate-100 px-1 py-0.5 rounded">Tên Hiển Thị &lt;email_của_bạn@gmail.com&gt;</code></span>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-[#005b9a] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-[#004b80] transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isSaving ? <Spinner className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                Lưu Cấu Hình SMTP
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Live Email Test Card */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardContent className="p-6 space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-600" />
            Kiểm tra gửi Email thử nghiệm
          </h3>
          <p className="text-xs text-slate-500">Nhập địa chỉ email cá nhân để kiểm tra trực tiếp thông báo từ hệ thống.</p>
          <form onSubmit={handleSendTest} className="flex gap-2">
            <input
              type="email"
              placeholder="nhan.email@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1 p-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50"
            />
            <button
              type="submit"
              disabled={isSendingTest}
              className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 cursor-pointer shrink-0"
            >
              {isSendingTest ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              Gửi Email Thử
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
