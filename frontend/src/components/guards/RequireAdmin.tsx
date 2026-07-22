import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'

export function RequireAdmin() {
  const user = useAuthStore((s) => s.user)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)

  if (!hasHydrated) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500 text-sm">
        Đang xác thực quyền truy cập...
      </div>
    )
  }

  if (!user || (!user.is_staff && !user.is_superuser)) {
    return <Navigate to="/portal" replace />
  }

  return <Outlet />
}
