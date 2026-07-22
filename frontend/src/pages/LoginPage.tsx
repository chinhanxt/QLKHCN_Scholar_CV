import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  GraduationCap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react'
import { useLogin } from '@/api/hooks/useAuth'
import { useAuthStore } from '@/stores/auth.store'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

const schema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email').email('Địa chỉ email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const login = useLogin()
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (isAuthenticated) return <Navigate to="/" replace />

  const onSubmit = (values: FormValues) => {
    login.mutate(values, {
      onSuccess: () => {
        toast.success('Đăng nhập thành công!', {
          description: 'Chào mừng bạn trở lại hệ thống Edu Ecosystem.',
        })
        const to = (location.state as { from?: { pathname?: string } })?.from?.pathname ?? '/'
        navigate(to, { replace: true })
      },
      onError: (err) => {
        toast.error('Đăng nhập thất bại', {
          description: getApiErrorMessage(err, 'Vui lòng kiểm tra lại thông tin email và mật khẩu.'),
        })
      },
    })
  }

  const handleForgotPassword = () => {
    toast.info('Trợ giúp đăng nhập', {
      description: 'Nếu bạn quên mật khẩu hoặc cần cấp quyền truy cập, vui lòng liên hệ Quản trị viên hệ thống (Admin).',
    })
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-slate-100/80 p-4 sm:p-6 font-sans selection:bg-blue-600 selection:text-white overflow-y-auto">
      {/* Decorative ambient background blur orbs */}
      <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-blue-400/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />

      {/* Main Centered Login Card - Wider (max-w-xl) & Compact Height */}
      <div className="relative z-10 w-full max-w-xl rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-2xl shadow-blue-950/10 backdrop-blur-xl space-y-5 transition-all">
        
        {/* Brand Logo & Badge Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30 ring-4 ring-blue-50">
            <GraduationCap className="h-7 w-7" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold tracking-wide border border-blue-100">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
            CỔNG ĐĂNG NHẬP XÁC THỰC
          </div>

          <div className="space-y-0.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Chào mừng trở lại
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Edu Ecosystem — Hệ thống Quản lý Dữ liệu Khoa học
            </p>
          </div>
        </div>

        {/* The Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
          {/* Email Field */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs sm:text-sm font-semibold text-slate-800 flex items-center justify-between">
              <span>Địa chỉ Email <span className="text-red-500">*</span></span>
            </Label>
            <div className="relative rounded-2xl shadow-xs">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Mail className="h-4.5 w-4.5" />
              </div>
              <Input
                id="email"
                type="email"
                placeholder="tennguoidung@domain.edu.vn"
                autoComplete="email"
                {...register('email')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSubmit(onSubmit)()
                  }
                }}
                className={`h-11 pl-11 pr-4 text-xs sm:text-sm font-medium rounded-2xl border bg-slate-50/50 text-slate-900 transition-all placeholder:text-slate-400 focus:bg-white ${
                  errors.email
                    ? 'border-red-400 ring-2 ring-red-500/20 focus:border-red-500'
                    : 'border-slate-200 hover:border-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15'
                }`}
              />
            </div>
            {errors.email && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-red-600 pt-0.5 animate-fadeIn">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs sm:text-sm font-semibold text-slate-800">
                Mật khẩu <span className="text-red-500">*</span>
              </Label>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors focus:outline-none"
              >
                Quên mật khẩu?
              </button>
            </div>
            <div className="relative rounded-2xl shadow-xs">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Lock className="h-4.5 w-4.5" />
              </div>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                {...register('password')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSubmit(onSubmit)()
                  }
                }}
                className={`h-11 pl-11 pr-11 text-xs sm:text-sm font-medium rounded-2xl border bg-slate-50/50 text-slate-900 transition-all placeholder:text-slate-400 focus:bg-white ${
                  errors.password
                    ? 'border-red-400 ring-2 ring-red-500/20 focus:border-red-500'
                    : 'border-slate-200 hover:border-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
            {errors.password && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-red-600 pt-0.5 animate-fadeIn">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Checkbox Remember me */}
          <div className="flex items-center justify-between pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer group selection:bg-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500/30 transition duration-150 cursor-pointer"
              />
              <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                Ghi nhớ phiên đăng nhập
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={login.isPending}
            className="w-full h-11 mt-1 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm sm:text-base rounded-2xl shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/35 transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
          >
            {login.isPending ? (
              <>
                <Spinner className="h-4.5 w-4.5 text-white" />
                <span>Đang xác thực thông tin...</span>
              </>
            ) : (
              <>
                <span>Đăng nhập hệ thống</span>
                <ArrowRight className="h-4.5 w-4.5 ml-1 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>
        </form>

        {/* Security & System Notice */}
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 text-xs text-slate-600 flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <span>
            Hệ thống chỉ dành cho cán bộ, giảng viên &amp; nhà nghiên cứu được cấp quyền. Mọi truy cập trái phép sẽ bị ghi lại theo quy định.
          </span>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-400 space-y-0.5 pt-1">
          <p>© {new Date().getFullYear()} Edu Ecosystem. Tất cả quyền được bảo lưu.</p>
          <p className="font-mono text-[11px] text-slate-400">Phiên bản 2.5.0 • QLKHCN Scholar System</p>
        </div>
      </div>
    </div>
  )
}



