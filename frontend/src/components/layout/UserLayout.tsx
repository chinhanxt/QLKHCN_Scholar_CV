import { Outlet, Link } from 'react-router-dom'
import { GraduationCap, LogOut, User as UserIcon, ShieldAlert } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'

export function UserLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const isAdmin = user?.is_staff || user?.is_superuser

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Minimal Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/portal" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-xs">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-bold text-slate-900 text-base tracking-tight">Cổng Nhà Khoa Học</span>
          </Link>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link to="/">
                <Button
                  size="sm"
                  className="h-9 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Chuyển sang trang Quản trị Admin"
                >
                  <ShieldAlert className="h-4 w-4" />
                  Giao diện Admin
                </Button>
              </Link>
            )}

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
              <UserIcon className="h-3.5 w-3.5 text-slate-500" />
              {user?.email}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="h-9 px-3 text-xs text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl"
              title="Đăng xuất"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Thoát
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  )
}
