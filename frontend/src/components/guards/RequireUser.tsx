import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'

export function RequireUser() {
  const user = useAuthStore((s) => s.user)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)

  if (!hasHydrated) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500 text-sm">
        Đang xác thực quyền truy cập...
      </div>
    )
  }

  // Admin users are blocked from /portal and redirected to Admin Dashboard (/)
  if (user && (user.is_staff || user.is_superuser)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
