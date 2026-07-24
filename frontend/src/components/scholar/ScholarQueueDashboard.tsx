import { useState, useEffect, useRef } from 'react'
import { useCrawlerStore } from '@/stores/crawler.store'
import {
  Trash2,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  Eye,
  UserCheck,
  RotateCcw,
  Sparkles,
  Activity,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ScholarQueueDashboardProps {
  className?: string
}

export function ScholarQueueDashboard({ className }: ScholarQueueDashboardProps) {
  const scholarQueue = useCrawlerStore((state) => state.scholarQueue)
  const removeFromScholarQueue = useCrawlerStore((state) => state.removeFromScholarQueue)
  const setSelectedQueueId = useCrawlerStore((state) => state.setSelectedQueueId)
  const clearScholarQueue = useCrawlerStore((state) => state.clearScholarQueue)

  const { queue, activeTaskIds, maxConcurrency, selectedQueueId } = scholarQueue

  const [isDismissed, setIsDismissed] = useState(() => {
    return sessionStorage.getItem('scholar_queue_dashboard_dismissed') === 'true'
  })

  const prevQueueLengthRef = useRef(queue.length)
  useEffect(() => {
    if (queue.length > prevQueueLengthRef.current && isDismissed) {
      setIsDismissed(false)
      sessionStorage.removeItem('scholar_queue_dashboard_dismissed')
    }
    prevQueueLengthRef.current = queue.length
  }, [queue.length, isDismissed])

  const handleDismiss = () => {
    setIsDismissed(true)
    sessionStorage.setItem('scholar_queue_dashboard_dismissed', 'true')
  }

  if (isDismissed) return null

  const totalCount = queue.length
  const completedCount = queue.filter(
    (item) => item.status === 'SUCCESS' || item.status === 'FAILURE'
  ).length
  const runningCount = queue.filter((item) => item.status === 'RUNNING').length
  const activeWorkers = activeTaskIds.length > 0 ? activeTaskIds.length : runningCount

  const overallProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const handleClearCompleted = () => {
    const completedItems = queue.filter(
      (item) => item.status === 'SUCCESS' || item.status === 'FAILURE'
    )
    completedItems.forEach((item) => removeFromScholarQueue(item.id))
  }

  const renderStatusBadge = (status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILURE', progress: number) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
            <Clock className="w-3 h-3 text-amber-500 animate-pulse" />
            ⏳ Đang chờ
          </span>
        )
      case 'RUNNING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
            <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
            🔄 Đang cào ({progress}%)
          </span>
        )
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            ✅ Hoàn thành
          </span>
        )
      case 'FAILURE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
            <XCircle className="w-3 h-3 text-rose-600" />
            ❌ Thất bại
          </span>
        )
    }
  }

  return (
    <div className={`bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs space-y-3 ${className || ''}`}>
      {/* Light-theme Progress & Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/60">
        
        {/* Left: Overall Progress */}
        <div className="flex-1 space-y-1.5 min-w-[280px]">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Đã hoàn thành <strong className="text-slate-900">{completedCount}</strong> / Tổng số <strong className="text-slate-900">{totalCount}</strong> hồ sơ
            </span>
            <span className="text-blue-600 font-bold font-mono">{overallProgress}%</span>
          </div>
          <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden p-0.5 border border-slate-300/50">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-1 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* Right: Active Workers & Author Dropdown & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs">
            <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>Đang chạy: <strong className="text-emerald-600 font-mono">{activeWorkers}/{maxConcurrency}</strong> luồng</span>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="author-select-light" className="text-xs font-medium text-slate-600 whitespace-nowrap flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-slate-500" />
            </label>
            <select
              id="author-select-light"
              value={selectedQueueId || ''}
              onChange={(e) => setSelectedQueueId(e.target.value || null)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs max-w-[200px] truncate"
            >
              <option value="">-- Chọn tác giả xem nhật ký --</option>
              {queue.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.scholarId} {item.userEmail ? `(${item.userEmail})` : ''} [{item.status}]
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleClearCompleted}
            disabled={completedCount === 0}
            className="text-xs h-7 px-2.5 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-slate-500 mr-1" />
            Xóa đã xong
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={clearScholarQueue}
            disabled={totalCount === 0}
            className="text-xs h-7 px-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60 cursor-pointer"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Xóa hàng đợi
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-xs h-7 w-7 p-0 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 rounded-lg cursor-pointer ml-1"
            title="Tắt bảng danh sách tiến trình"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Queue Items Table (Only when queue is not empty) */}
      {totalCount > 0 && (
        <div className="overflow-x-auto border border-slate-200/90 rounded-xl shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2 px-3">Google Scholar ID / Email người gửi</th>
                <th className="py-2 px-3">Trạng thái xử lý</th>
                <th className="py-2 px-3 w-40">Tiến trình cào</th>
                <th className="py-2 px-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {queue.map((item) => {
                const isSelected = item.id === selectedQueueId
                return (
                  <tr
                    key={item.id}
                    className={`transition-colors hover:bg-slate-50 ${
                      isSelected ? 'bg-blue-50/60 font-medium' : ''
                    }`}
                  >
                    <td className="py-2 px-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900 font-mono text-[11px]">
                          {item.scholarId}
                        </span>
                        {item.userEmail && (
                          <span className="text-[11px] text-slate-500">
                            {item.userEmail}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      {renderStatusBadge(item.status, item.progress)}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                          <div
                            className={`h-full transition-all duration-300 ${
                              item.status === 'SUCCESS'
                                ? 'bg-emerald-500'
                                : item.status === 'FAILURE'
                                ? 'bg-rose-500'
                                : item.status === 'RUNNING'
                                ? 'bg-blue-500'
                                : 'bg-amber-400'
                            }`}
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono font-semibold text-slate-600 w-8 text-right">
                          {item.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedQueueId(item.id)}
                          className={`h-6 px-2 text-[11px] cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'border-slate-200 text-slate-700 hover:text-blue-700 hover:bg-blue-50'
                          }`}
                          title="Xem nhật ký & dữ liệu tác giả"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          {isSelected ? 'Đang chọn' : 'Kiểm tra'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromScholarQueue(item.id)}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                          title="Xóa khỏi hàng đợi"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
