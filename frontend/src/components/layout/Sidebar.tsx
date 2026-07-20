import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
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
  PanelLeftOpen,
  Layers,
  ChevronDown,
  ChevronRight,
  Download
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { fullName } from '@/lib/utils'

const OTHER_TOOLS = [
  { to: '/scholar/scraper', label: 'Scholar Scraper', icon: GraduationCap },
  { to: '/scholar/integrator', label: 'Data chuẩn', icon: GitMerge },
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

interface SidebarLinkProps {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
  isCollapsed: boolean
}

function SidebarLink({ to, label, icon: Icon, end, isCollapsed }: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center transition-all duration-300 rounded-lg text-sm font-medium w-full relative overflow-hidden group",
          isCollapsed 
            ? "justify-center h-10 w-10 mx-auto px-0" 
            : "gap-3 px-3 py-2.5",
          isActive
            ? isCollapsed
              ? "bg-[#e6f0f7] text-[#005b9a] shadow-sm"
              : "bg-[#e6f0f7] text-[#005b9a] border-l-4 border-[#005b9a] shadow-sm font-semibold pl-[9.5px]"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        )
      }
      title={isCollapsed ? label : undefined}
    >
      <Icon className="h-4.5 w-4.5 shrink-0 transition-colors" />
      <span
        className={cn(
          "transition-all duration-300 origin-left whitespace-nowrap overflow-hidden text-ellipsis",
          isCollapsed 
            ? "opacity-0 max-w-0 pointer-events-none" 
            : "opacity-100 max-w-[180px]"
        )}
      >
        {label}
      </span>
    </NavLink>
  )
}

interface SidebarChildLinkProps {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  isCollapsed: boolean
}

function SidebarChildLink({ to, label, icon: Icon, isCollapsed }: SidebarChildLinkProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center transition-all duration-300 rounded-lg text-sm font-medium w-full relative overflow-hidden",
          isCollapsed
            ? "justify-center h-10 w-10 mx-auto px-0"
            : "gap-2.5 px-3 py-2 text-xs font-semibold",
          isActive
            ? "bg-[#e6f0f7] text-[#005b9a] font-bold"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
        )
      }
      title={isCollapsed ? label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0 transition-colors" />
      <span
        className={cn(
          "transition-all duration-300 origin-left whitespace-nowrap overflow-hidden text-ellipsis",
          isCollapsed 
            ? "opacity-0 max-w-0 pointer-events-none" 
            : "opacity-100 max-w-[150px]"
        )}
      >
        {label}
      </span>
    </NavLink>
  )
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const location = useLocation()

  const isCrawlActive = ['/scholar/unified', '/scholar/clarivate', '/scholar/scimago', '/scholar/bioxbio'].some(
    path => location.pathname === path
  )
  const [isCrawlOpen, setIsCrawlOpen] = useState(isCrawlActive)

  useEffect(() => {
    if (isCrawlActive) {
      setIsCrawlOpen(true)
    }
  }, [location.pathname, isCrawlActive])

  return (
    <aside className={cn(
      "flex shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm transition-all duration-300",
      isCollapsed ? "w-16 overflow-visible" : "w-64 overflow-x-hidden"
    )}>
      {/* Branding Header */}
      <div className="flex h-14 items-center border-b border-slate-200 px-4 shrink-0 overflow-hidden relative">
        {/* Branding Container: Logo + Brand Name */}
        <div className={cn(
          "flex items-center gap-2 transition-all duration-300 origin-left",
          isCollapsed ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"
        )}>
          <GraduationCap className="h-6 w-6 text-[#005b9a] shrink-0" />
          <span className="text-sm font-bold text-[#005b9a] tracking-tight whitespace-nowrap">
            Scholar Matcher
          </span>
        </div>

        {/* Toggle Button Container */}
        <div className={cn(
          "absolute right-4 transition-all duration-300 flex items-center justify-center",
          isCollapsed ? "left-0 right-0 mx-auto w-9 h-9" : "w-8 h-8"
        )}>
          <button 
            onClick={onToggle}
            className={cn(
              "group relative flex items-center justify-center rounded-lg hover:bg-slate-100 transition-all duration-300 cursor-pointer shrink-0",
              isCollapsed ? "h-9 w-9" : "h-8 w-8 text-slate-400 hover:text-[#005b9a]"
            )}
            title={isCollapsed ? "Mở thanh bên" : "Đóng thanh bên"}
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
      
      {/* Navigation - Shifted down a bit with pt-4 */}
      <nav className={cn(
        "flex flex-1 flex-col gap-5 p-3 pt-4",
        isCollapsed ? "overflow-visible" : "overflow-y-auto overflow-x-hidden custom-scrollbar"
      )}>
        {/* General */}
        <div>
          <div className="px-3 mb-2 flex items-center h-5 overflow-hidden">
            <span className={cn(
              "text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap transition-all duration-300 origin-left",
              isCollapsed ? "opacity-0 max-w-0" : "opacity-100 max-w-[150px]"
            )}>
              Trang chủ
            </span>
          </div>
          
          <SidebarLink to="/" end label="Tổng quan" icon={LayoutDashboard} isCollapsed={isCollapsed} />
        </div>

        {/* 6 Main Tools */}
        <div>
          <div className="px-3 mb-2 flex items-center h-5 overflow-hidden">
            <span className={cn(
              "text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap transition-all duration-300 origin-left",
              isCollapsed ? "opacity-0 max-w-0" : "opacity-100 max-w-[150px]"
            )}>
              Công cụ
            </span>
          </div>

          <div className="flex flex-col gap-1">
            {/* 1. Parent Menu: Cào dữ liệu */}
            {/* 1. Parent Menu: Cào dữ liệu */}
            <div className={cn("relative group", isCollapsed ? "w-full" : "")}>
              <button
                onClick={() => !isCollapsed && setIsCrawlOpen(!isCrawlOpen)}
                className={cn(
                  "w-full flex items-center justify-between rounded-lg transition-all duration-300 text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer overflow-hidden",
                  isCrawlActive && "bg-[#e6f0f7] text-[#005b9a] font-semibold",
                  isCollapsed 
                    ? "justify-center h-10 w-10 mx-auto px-0" 
                    : "px-3 py-2.5 text-sm font-medium"
                )}
                title={isCollapsed ? "Cào dữ liệu" : undefined}
              >
                <div className={cn("flex items-center overflow-hidden", isCollapsed ? "justify-center" : "gap-3")}>
                  <Download className={cn("h-4.5 w-4.5 shrink-0 transition-colors", isCrawlActive ? "text-[#005b9a]" : "text-slate-500", "group-hover:text-[#005b9a]")} />
                  <span className={cn(
                    "transition-all duration-300 origin-left whitespace-nowrap overflow-hidden text-ellipsis",
                    isCollapsed ? "opacity-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[150px]"
                  )}>
                    Cào dữ liệu
                  </span>
                </div>
                {!isCollapsed && (
                  <div className="transition-opacity duration-300">
                    {isCrawlOpen ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                  </div>
                )}
              </button>

              {/* Inline Sub-menu (Only active in expanded mode, collapses smoothly to 0 height when collapsed) */}
              <div
                className={cn(
                  "flex flex-col ml-4 border-l border-slate-200 pl-3 mt-1 gap-1 overflow-hidden transition-all duration-300",
                  (!isCollapsed && isCrawlOpen) ? "opacity-100 max-h-60" : "opacity-0 max-h-0 pointer-events-none"
                )}
              >
                <SidebarChildLink to="/scholar/unified" label="Cào tổng hợp" icon={Layers} isCollapsed={false} />
                <SidebarChildLink to="/scholar/clarivate" label="Clarivate Crawler" icon={Database} isCollapsed={false} />
                <SidebarChildLink to="/scholar/scimago" label="SCImago Crawler" icon={BarChart3} isCollapsed={false} />
                <SidebarChildLink to="/scholar/bioxbio" label="BioxBio Crawler" icon={Globe} isCollapsed={false} />
              </div>

              {/* Hover Popover Sub-menu (Only active in collapsed mode) */}
              <div
                className={cn(
                  "absolute left-full top-0 pl-2 transition-all duration-300 z-50 w-52",
                  isCollapsed 
                    ? "opacity-0 translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto"
                    : "opacity-0 pointer-events-none hidden"
                )}
              >
                <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-2 flex flex-col gap-1">
                  <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Cào dữ liệu
                    </span>
                  </div>
                  <SidebarChildLink to="/scholar/unified" label="Cào tổng hợp" icon={Layers} isCollapsed={false} />
                  <SidebarChildLink to="/scholar/clarivate" label="Clarivate Crawler" icon={Database} isCollapsed={false} />
                  <SidebarChildLink to="/scholar/scimago" label="SCImago Crawler" icon={BarChart3} isCollapsed={false} />
                  <SidebarChildLink to="/scholar/bioxbio" label="BioxBio Crawler" icon={Globe} isCollapsed={false} />
                </div>
              </div>
            </div>

            {/* Other Flat Nav links */}
            {OTHER_TOOLS.map(({ to, label, icon }) => (
              <SidebarLink
                key={to}
                to={to}
                label={label}
                icon={icon}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>
        </div>

        {/* System Settings */}
        <div>
          <div className="px-3 mb-2 flex items-center h-5 overflow-hidden">
            <span className={cn(
              "text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap transition-all duration-300 origin-left",
              isCollapsed ? "opacity-0 max-w-0" : "opacity-100 max-w-[150px]"
            )}>
              Hệ thống
            </span>
          </div>
          
          <div className="flex flex-col gap-1">
            {SYSTEM_NAV.map(({ to, label, icon }) => (
              <SidebarLink
                key={to}
                to={to}
                label={label}
                icon={icon}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>
        </div>
      </nav>
      
      {/* Footer Profile Info with Logout at the bottom-left of the sidebar */}
      {user && (
        <div className="flex flex-col border-t border-slate-200 bg-slate-50/50 transition-all duration-300 shrink-0 p-3 items-center">
          <div className="flex items-center gap-2.5 w-full justify-start overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e6f0f7] text-[#005b9a] font-bold text-sm" title={user.email}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className={cn(
              "leading-tight min-w-0 transition-all duration-300 origin-left overflow-hidden",
              isCollapsed ? "opacity-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[120px]"
            )}>
              <div className="text-xs font-bold text-slate-800 truncate">{fullName(user) || user.username}</div>
              <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
            </div>
            <button 
              onClick={logout}
              className={cn(
                "rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer shrink-0 ml-auto transition-opacity duration-300",
                isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
              )}
              title="Đăng xuất"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
          
          {/* Collapsed logout link shown only when collapsed */}
          <button 
            onClick={logout}
            className={cn(
              "rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer shrink-0 transition-all duration-300 flex items-center justify-center",
              isCollapsed ? "opacity-100 h-8 w-8 mt-2" : "opacity-0 h-0 w-0 pointer-events-none mt-0 overflow-hidden"
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
