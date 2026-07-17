import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  GraduationCap,
  Globe,
  BarChart3,
  Database,
  GitMerge,
  FolderHeart,
  Users,
  Settings,
  HelpCircle,
  Server,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { fullName } from '@/lib/utils'

const TOOLS_NAV = [
  { to: '/scholar/scraper', label: 'Scholar Scraper', icon: GraduationCap },
  { to: '/scholar/bioxbio', label: 'BioxBio Crawler', icon: Globe },
  { to: '/scholar/scimago', label: 'SCImago Crawler', icon: BarChart3 },
  { to: '/scholar/clarivate', label: 'Clarivate Crawler', icon: Database },
  { to: '/scholar/integrator', label: 'Score Integrator', icon: GitMerge },
  { to: '/scholar/profiles', label: 'Profile Manager', icon: FolderHeart },
]

const SYSTEM_NAV = [
  { to: '/users', label: 'Người dùng', icon: Users },
  { to: '/settings', label: 'Cài đặt', icon: Settings },
  { to: '/database', label: 'Cơ sở dữ liệu', icon: Server },
  { to: '/help', label: 'Trợ giúp', icon: HelpCircle },
]

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  return (
    <aside className={cn(
      "flex shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm transition-all duration-300 overflow-x-hidden",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Branding Header with Gemini-like Hover Morphing Toggle when collapsed */}
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-[#005b9a] shrink-0" />
            <span className="text-sm font-bold text-[#005b9a] tracking-tight">Scholar Matcher</span>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <button 
              onClick={onToggle}
              className="group relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100 transition-all cursor-pointer shrink-0"
              title="Mở thanh bên"
            >
              {/* GraduationCap icon morphs smoothly into PanelLeftOpen icon on hover */}
              <GraduationCap className="h-6 w-6 text-[#005b9a] transition-all duration-200 group-hover:opacity-0 group-hover:scale-75 absolute" />
              <PanelLeftOpen className="h-5 w-5 text-[#005b9a] transition-all duration-200 opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 absolute" />
            </button>
          </div>
        )}
      </div>
      
      {/* Navigation - Shifted down a bit with pt-4 */}
      <nav className="flex flex-1 flex-col gap-5 p-3 pt-4">
        {/* General */}
        <div>
          {!isCollapsed ? (
            <div className="px-3 mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Trang chủ
              </span>
              <button 
                onClick={onToggle}
                className="rounded-lg p-0.5 text-slate-400 hover:bg-slate-100 hover:text-[#005b9a] transition-all cursor-pointer"
                title="Đóng thanh bên"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="h-1.5" />
          )}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isCollapsed ? 'justify-center px-0' : '',
                isActive
                  ? 'bg-[#e6f0f7] text-[#005b9a] border-l-4 border-[#005b9a] shadow-sm font-semibold pl-2.5'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )
            }
            title={isCollapsed ? "Tổng quan" : undefined}
          >
            <LayoutDashboard className="h-4.5 w-4.5 shrink-0" />
            {!isCollapsed && <span>Tổng quan</span>}
          </NavLink>
        </div>

        {/* 6 Main Tools */}
        <div>
          {!isCollapsed && (
            <div className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              6 Công cụ chính
            </div>
          )}
          <div className="flex flex-col gap-1">
            {TOOLS_NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isCollapsed ? 'justify-center px-0' : '',
                    isActive
                      ? 'bg-[#e6f0f7] text-[#005b9a] border-l-4 border-[#005b9a] shadow-sm font-semibold pl-2.5'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  )
                }
                title={isCollapsed ? label : undefined}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {!isCollapsed && <span>{label}</span>}
              </NavLink>
            ))}
          </div>
        </div>

        {/* System Settings */}
        <div>
          {!isCollapsed && (
            <div className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Hệ thống
            </div>
          )}
          <div className="flex flex-col gap-1">
            {SYSTEM_NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                    isCollapsed ? 'justify-center px-0' : '',
                    isActive
                      ? 'bg-[#e6f0f7] text-[#005b9a] border-l-4 border-[#005b9a] shadow-sm font-semibold pl-2.5'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  )
                }
                title={isCollapsed ? label : undefined}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {!isCollapsed && <span>{label}</span>}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
      
      {/* Footer Profile Info with Logout at the bottom-left of the sidebar */}
      {user && (
        <div className={cn(
          "flex border-t border-slate-200 bg-slate-50/50 transition-all duration-300 shrink-0",
          isCollapsed ? "flex-col items-center gap-4 py-4" : "items-center justify-between p-4"
        )}>
          <div className={cn("flex items-center gap-2.5 min-w-0", isCollapsed ? "flex-col" : "")}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e6f0f7] text-[#005b9a] font-bold text-sm" title={user.email}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="leading-tight min-w-0">
                <div className="text-xs font-bold text-slate-800 truncate">{fullName(user) || user.username}</div>
                <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
              </div>
            )}
          </div>
          <button 
            onClick={logout}
            className={cn(
              "rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer shrink-0",
              isCollapsed ? "mt-1" : ""
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
