import { NotificationBell } from './NotificationBell'

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 md:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-bold text-slate-800 tracking-tight">Hệ Thống Quản Lý Khoa Học & Lý Lịch (Scholar CV)</h1>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
      </div>
    </header>
  )
}
