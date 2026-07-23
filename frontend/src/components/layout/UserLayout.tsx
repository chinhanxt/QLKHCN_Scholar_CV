import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  User,
  GraduationCap,
  FileEdit,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'

interface UserSidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

function UserSidebar({ isCollapsed, onToggle }: UserSidebarProps) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const location = useLocation()
  const navigate = useNavigate()

  const menuItems = [
    { label: 'Thông tin cá nhân', path: '/user/profile', icon: User },
    { label: 'Hồ sơ Scholar chi tiết', path: '/user/scholar', icon: GraduationCap },
    { label: 'Cập nhật thông tin', path: '/user/edit-profile', icon: FileEdit },
    { label: 'Cài đặt tài khoản', path: '/user/settings', icon: Settings },
  ]

  return (
    <aside
      className={cn(
        'sticky top-0 h-screen flex shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm transition-all duration-300 z-30',
        isCollapsed ? 'w-16 overflow-visible' : 'w-64 overflow-x-hidden'
      )}
    >
      {/* Branding Header */}
      <div className="flex h-14 items-center border-b border-slate-200 px-4 shrink-0 overflow-hidden relative">
        <div
          className={cn(
            'flex items-center gap-2 transition-all duration-300 origin-left',
            isCollapsed ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
          )}
        >
          <GraduationCap className="h-6 w-6 text-[#005b9a] shrink-0" />
          <span className="text-sm font-bold text-[#005b9a] tracking-tight whitespace-nowrap">
            Cổng Nhà Khoa Học
          </span>
        </div>

        <div
          className={cn(
            'absolute right-4 transition-all duration-300 flex items-center justify-center',
            isCollapsed ? 'left-0 right-0 mx-auto w-9 h-9' : 'w-8 h-8'
          )}
        >
          <button
            onClick={onToggle}
            className={cn(
              'group relative flex items-center justify-center rounded-lg hover:bg-slate-100 transition-all duration-300 cursor-pointer shrink-0',
              isCollapsed ? 'h-9 w-9' : 'h-8 w-8 text-slate-400 hover:text-[#005b9a]'
            )}
            title={isCollapsed ? 'Mở thanh bên' : 'Đóng thanh bên'}
          >
            {isCollapsed ? (
              <>
                <GraduationCap className="h-6 w-6 text-[#005b9a] transition-all duration-200 group-hover:opacity-0 group-hover:scale-75 absolute" />
                <PanelLeftOpen className="h-5 w-5 text-[#005b9a] transition-all duration-200 opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 absolute" />
              </>
            ) : (
              <PanelLeftClose className="h-4.5 w-4.5" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav
        className={cn(
          'flex flex-1 flex-col gap-1 p-3 pt-4',
          isCollapsed ? 'overflow-visible' : 'overflow-y-auto overflow-x-hidden custom-scrollbar'
        )}
      >
        <div className="flex flex-col gap-1">
          {menuItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path

            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  'flex items-center transition-all duration-300 rounded-lg text-sm font-medium w-full relative overflow-hidden group cursor-pointer',
                  isCollapsed ? 'justify-center h-10 w-10 mx-auto px-0' : 'gap-3 px-3 py-2.5',
                  isActive
                    ? isCollapsed
                      ? 'bg-[#e6f0f7] text-[#005b9a] shadow-sm'
                      : 'bg-[#e6f0f7] text-[#005b9a] border-l-4 border-[#005b9a] shadow-sm font-semibold pl-[9.5px]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
                title={isCollapsed ? label : undefined}
              >
                <Icon className="h-4.5 w-4.5 shrink-0 transition-colors" />
                <span
                  className={cn(
                    'transition-all duration-300 origin-left whitespace-nowrap overflow-hidden text-ellipsis',
                    isCollapsed ? 'opacity-0 max-w-0 pointer-events-none' : 'opacity-100 max-w-[180px]'
                  )}
                >
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* User Info Footer */}
      {user && (
        <div className="flex flex-col border-t border-slate-200 bg-slate-50/50 transition-all duration-300 shrink-0 p-3 items-center">
          <div className="flex items-center gap-2.5 w-full justify-start overflow-hidden">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e6f0f7] text-[#005b9a] font-bold text-sm"
              title={user.email}
            >
              {user.username ? user.username.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
            </div>
            <div
              className={cn(
                'leading-tight min-w-0 transition-all duration-300 origin-left overflow-hidden',
                isCollapsed ? 'opacity-0 max-w-0 pointer-events-none' : 'opacity-100 max-w-[120px]'
              )}
            >
              <div className="text-xs font-bold text-slate-800 truncate">
                {user.username || user.email.split('@')[0]}
              </div>
              <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
            </div>
            <button
              onClick={logout}
              className={cn(
                'rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer shrink-0 ml-auto transition-opacity duration-300',
                isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
              )}
              title="Đăng xuất"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>

          <button
            onClick={logout}
            className={cn(
              'rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer shrink-0 transition-all duration-300 flex items-center justify-center',
              isCollapsed ? 'opacity-100 h-8 w-8 mt-2' : 'opacity-0 h-0 w-0 pointer-events-none mt-0 overflow-hidden'
            )}
            title="Đăng xuất"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      )}
    </aside>
  )
}

export function UserLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="flex min-h-screen bg-slate-50">
      <UserSidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
      <div className="flex-1 min-w-0">
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
