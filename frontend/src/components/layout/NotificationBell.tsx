import { useState, useRef, useEffect } from 'react'
import { useNotifications } from '@/hooks/useNotifications'
import { Bell, CheckCircle2, Sparkles, AlertCircle, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNREAD'>('ALL')
  const { unreadCount, notifications, markRead, markAllRead } = useNotifications()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'UNREAD') return !item.is_read
    return true
  })

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        title="Thông báo"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="p-3.5 px-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-800">Thông báo</span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                  {unreadCount} chưa đọc
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="text-xs font-semibold text-[#005b9a] hover:underline cursor-pointer flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                Đọc tất cả
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-100 px-3 pt-2 gap-4 text-xs font-semibold text-slate-500">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`pb-2 border-b-2 transition-colors ${
                activeTab === 'ALL' ? 'border-[#005b9a] text-[#005b9a]' : 'border-transparent hover:text-slate-700'
              }`}
            >
              Tất cả ({notifications.length})
            </button>
            <button
              onClick={() => setActiveTab('UNREAD')}
              className={`pb-2 border-b-2 transition-colors ${
                activeTab === 'UNREAD' ? 'border-[#005b9a] text-[#005b9a]' : 'border-transparent hover:text-slate-700'
              }`}
            >
              Chưa đọc ({unreadCount})
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Không có thông báo nào
              </div>
            ) : (
              filteredNotifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (!item.is_read) markRead(item.id)
                    if (item.link) navigate(item.link)
                    setIsOpen(false)
                  }}
                  className={`p-3.5 px-4 hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 items-start ${
                    !item.is_read ? 'bg-sky-50/40' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {item.notification_type === 'PROFILE_APPROVED' && (
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                    {item.notification_type === 'NEW_PUBLICATIONS_DETECTED' && (
                      <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    )}
                    {item.notification_type !== 'PROFILE_APPROVED' && item.notification_type !== 'NEW_PUBLICATIONS_DETECTED' && (
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{item.title}</p>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">{item.message}</p>
                    <span className="text-[10px] text-slate-400 mt-1 block">{item.created_at_human}</span>
                  </div>

                  {!item.is_read && (
                    <span className="w-2 h-2 rounded-full bg-[#005b9a] shrink-0 mt-2" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
