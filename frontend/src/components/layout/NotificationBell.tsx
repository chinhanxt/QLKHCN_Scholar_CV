import { useState, useRef, useEffect } from 'react'
import { useNotifications } from '@/hooks/useNotifications'
import { Bell, CheckCircle2, Sparkles, AlertCircle, Check, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface NotificationBellProps {
  direction?: 'down' | 'up'
}

export function NotificationBell({ direction = 'down' }: NotificationBellProps) {
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
      {/* Floating Glassmorphic Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/90 shadow-sm hover:shadow-md hover:bg-white text-slate-600 hover:text-[#005b9a] transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0"
        title="Thông báo hệ thống"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full shadow-sm animate-pulse border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className={`absolute ${
            direction === 'up' ? 'bottom-full mb-3 right-0' : 'right-0 mt-2'
          } w-80 sm:w-96 bg-white rounded-2xl border border-slate-200/90 shadow-2xl z-50 overflow-hidden transition-all duration-200`}
        >
          {/* Header */}
          <div className="p-3.5 px-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-800">Thông báo</span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2 py-0.5 rounded-full">
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
          <div className="flex border-b border-slate-100 px-3 pt-2 gap-4 text-xs font-semibold text-slate-500 bg-white">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`pb-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'ALL' ? 'border-[#005b9a] text-[#005b9a]' : 'border-transparent hover:text-slate-700'
              }`}
            >
              Tất cả ({notifications.length})
            </button>
            <button
              onClick={() => setActiveTab('UNREAD')}
              className={`pb-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'UNREAD' ? 'border-[#005b9a] text-[#005b9a]' : 'border-transparent hover:text-slate-700'
              }`}
            >
              Chưa đọc ({unreadCount})
            </button>
          </div>

          {/* Refined Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 bg-white">
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
                  className={`p-3.5 px-4 hover:bg-slate-50/80 transition-all cursor-pointer flex gap-3 items-start relative ${
                    !item.is_read ? 'bg-sky-50/30' : ''
                  }`}
                >
                  {/* Icon Indicator */}
                  <div className="mt-0.5 shrink-0">
                    {item.notification_type === 'PROFILE_APPROVED' && (
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
                        <CheckCircle2 className="w-4.5 h-4.5" />
                      </div>
                    )}
                    {item.notification_type === 'NEW_PUBLICATIONS_DETECTED' && (
                      <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shadow-xs">
                        <Sparkles className="w-4.5 h-4.5" />
                      </div>
                    )}
                    {item.notification_type !== 'PROFILE_APPROVED' && item.notification_type !== 'NEW_PUBLICATIONS_DETECTED' && (
                      <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center shadow-xs">
                        <AlertCircle className="w-4.5 h-4.5" />
                      </div>
                    )}
                  </div>

                  {/* Message Body */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{item.title}</p>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mt-0.5">{item.message}</p>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium mt-1.5">
                      <Clock className="w-3 h-3 text-slate-300" />
                      <span>{item.created_at_human}</span>
                    </div>
                  </div>

                  {/* Unread Accent Line */}
                  {!item.is_read && (
                    <span className="w-2 h-2 rounded-full bg-[#005b9a] shrink-0 mt-2 shadow-xs" />
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
