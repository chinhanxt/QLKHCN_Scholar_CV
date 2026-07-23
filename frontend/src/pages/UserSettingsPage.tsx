import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  User,
  Mail,
  Shield,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Clock,
  Laptop,
  ShieldCheck,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useChangePassword } from '@/api/hooks/useAuth'
import { getApiErrorMessage } from '@/lib/api-error'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

export function UserSettingsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const changePasswordMutation = useChangePassword()

  // Change password form state
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Show/hide password states
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Form error state
  const [formError, setFormError] = useState<string | null>(null)

  const email = user?.email || 'Chưa cập nhật email'
  const userRole = user?.is_superuser
    ? 'Quản trị viên tối cao (Superadmin)'
    : user?.is_staff
    ? 'Quản trị viên (Admin)'
    : 'Người dùng'
  const accountStatus = user?.is_active !== false ? 'Đang hoạt động' : 'Tạm khóa'

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!oldPassword) {
      const err = 'Vui lòng nhập mật khẩu hiện tại.'
      setFormError(err)
      toast.error(err)
      return
    }

    if (!newPassword) {
      const err = 'Vui lòng nhập mật khẩu mới.'
      setFormError(err)
      toast.error(err)
      return
    }

    if (newPassword.length < 6) {
      const err = 'Mật khẩu mới phải có ít nhất 6 ký tự.'
      setFormError(err)
      toast.error(err)
      return
    }

    if (newPassword !== confirmPassword) {
      const err = 'Mật khẩu mới và xác nhận mật khẩu không khớp.'
      setFormError(err)
      toast.error(err)
      return
    }

    try {
      await changePasswordMutation.mutateAsync({
        old_password: oldPassword,
        new_password: newPassword,
      })
      toast.success('Đổi mật khẩu thành công!')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu hiện tại.')
      setFormError(msg)
      toast.error(msg)
    }
  }

  const handleLogout = () => {
    logout()
    toast.info('Đã đăng xuất khỏi tài khoản.')
    navigate('/login')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Cài đặt tài khoản</h1>
        <p className="text-sm text-slate-500">
          Quản lý thông tin tài khoản, bảo mật mật khẩu và phiên làm việc cá nhân
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Account Profile & Session Cards (1 col on lg) */}
        <div className="space-y-6 lg:col-span-1">
          {/* Card 1: Account Profile Card */}
          <Card className="border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e6f0f7] text-[#005b9a]">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Thông tin tài khoản</h2>
                <p className="text-xs text-slate-500">Thông tin định danh người dùng</p>
              </div>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <div>
                <label className="text-xs font-medium text-slate-500">Địa chỉ Email</label>
                <div className="mt-1 flex items-center gap-2 text-slate-800 font-medium">
                  <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="truncate">{email}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500">Vai trò tài khoản</label>
                <div className="mt-1 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[#005b9a] shrink-0" />
                  <span className="font-medium text-slate-800">{userRole}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500">Trạng thái tài khoản</label>
                <div className="mt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    {accountStatus}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Card 3: Session & Security Card */}
          <Card className="border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Phiên đăng nhập & Bảo mật</h2>
                <p className="text-xs text-slate-500">Quản lý kết nối & thiết bị</p>
              </div>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <Laptop className="h-4 w-4 text-[#005b9a]" />
                  <span>Phiên làm việc hiện tại</span>
                </div>
                <div className="text-xs text-slate-500 pl-6 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Đã xác thực JWT Token</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>Tự động làm mới phiên</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors cursor-pointer gap-2 font-medium"
                >
                  <LogOut className="h-4 w-4" />
                  Đăng xuất khỏi tài khoản
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Change Password Form (2 cols on lg) */}
        <div className="lg:col-span-2">
          <Card className="border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e6f0f7] text-[#005b9a]">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Thay đổi mật khẩu</h2>
                <p className="text-xs text-slate-500">Cập nhật mật khẩu để bảo mật tài khoản của bạn</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="mt-6 space-y-5">
              {formError && (
                <div className="flex items-start gap-2.5 rounded-lg bg-red-50 p-3.5 text-xs text-red-700 border border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Đã xảy ra lỗi:</span> {formError}
                  </div>
                </div>
              )}

              {/* Mật khẩu hiện tại */}
              <div className="space-y-1.5">
                <Label htmlFor="oldPassword" className="text-xs font-semibold text-slate-700">
                  Mật khẩu hiện tại <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="oldPassword"
                    type={showOldPassword ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Nhập mật khẩu hiện tại"
                    className="pr-10"
                    disabled={changePasswordMutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    tabIndex={-1}
                  >
                    {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Mật khẩu mới */}
              <div className="space-y-1.5">
                <Label htmlFor="newPassword" className="text-xs font-semibold text-slate-700">
                  Mật khẩu mới <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                    className="pr-10"
                    disabled={changePasswordMutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Mật khẩu phải có độ dài từ 6 ký tự trở lên.
                </p>
              </div>

              {/* Xác nhận mật khẩu mới */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-700">
                  Xác nhận mật khẩu mới <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className="pr-10"
                    disabled={changePasswordMutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Security advice */}
              <div className="rounded-lg bg-amber-50/60 p-3 border border-amber-200/80 text-xs text-amber-800 flex items-start gap-2">
                <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Khuyên dùng mật khẩu bao gồm chữ cái, chữ số và ký tự đặc biệt để đảm bảo an toàn tuyệt đối.
                </span>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  className="bg-[#005b9a] hover:bg-[#00487a] text-white px-6 shadow-xs cursor-pointer min-w-[140px]"
                >
                  {changePasswordMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <Spinner className="h-4 w-4 text-white" />
                      <span>Đang xử lý...</span>
                    </div>
                  ) : (
                    'Đổi Mật Khẩu'
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
