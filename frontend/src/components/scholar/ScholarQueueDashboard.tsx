import { useCrawlerStore } from '@/stores/crawler.store'
import {
  Layers,
  Trash2,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  Eye,
  UserCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
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

  const totalCount = queue.length
  const completedCount = queue.filter(
    (item) => item.status === 'SUCCESS' || item.status === 'FAILURE'
  ).length
  const successCount = queue.filter((item) => item.status === 'SUCCESS').length
  const failureCount = queue.filter((item) => item.status === 'FAILURE').length
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
            <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            ⏳ Đang chờ
          </span>
        )
      case 'RUNNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
            <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
            🔄 Đang cào ({progress}%)
          </span>
        )
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ✅ Hoàn thành
          </span>
        )
      case 'FAILURE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            ❌ Thất bại
          </span>
        )
    }
  }

  return (
    <Card className={`border-slate-200 shadow-sm overflow-hidden bg-white ${className || ''}`}>
      <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100 text-blue-600">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                Hàng chờ cào tự động Google Scholar
                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                  Batch Queue
                </span>
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Quản lý danh sách cào dữ liệu song song và theo dõi tiến trình trực tiếp
              </p>
            </div>
          </div>

          {/* Author Inspection Dropdown Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="author-inspection-select" className="text-xs font-medium text-slate-600 whitespace-nowrap flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-slate-500" />
              Kiểm tra tác giả:
            </label>
            <select
              id="author-inspection-select"
              value={selectedQueueId || ''}
              onChange={(e) => setSelectedQueueId(e.target.value || null)}
              className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs max-w-[240px] truncate"
            >
              <option value="">-- Chọn tác giả kiểm tra --</option>
              {queue.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.scholarId} {item.userEmail ? `(${item.userEmail})` : ''} [{item.status}]
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Global Progress Header */}
        <div className="mt-4 pt-4 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div className="col-span-1 sm:col-span-2 space-y-1.5">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Completed {completedCount} / Total {totalCount} items
              </span>
              <span className="text-blue-600 font-bold">{overallProgress}%</span>
            </div>
            <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-1.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-slate-200 font-medium text-slate-600 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Active: <strong className="text-slate-900">{activeWorkers}/{maxConcurrency}</strong> workers</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Queue Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100">
          <div className="text-xs text-slate-500">
            Tổng cộng: <strong className="text-slate-800">{totalCount}</strong> tác giả (
            <span className="text-emerald-600 font-medium">{successCount} thành công</span>,{' '}
            <span className="text-rose-600 font-medium">{failureCount} thất bại</span>,{' '}
            <span className="text-amber-600 font-medium">{queue.length - completedCount} đang xử lý</span>)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCompleted}
              disabled={completedCount === 0}
              className="text-xs h-8 border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Clear completed
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={clearScholarQueue}
              disabled={totalCount === 0}
              className="text-xs h-8 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear queue
            </Button>
          </div>
        </div>

        {/* Queue Items Table/Grid */}
        {totalCount === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">Hàng chờ hiện đang trống</p>
            <p className="text-xs text-slate-500 mt-1">
              Vui lòng thêm các yêu cầu cào tác giả từ danh sách chờ duyệt hoặc nhập thủ công.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Scholar ID / Email</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                  <th className="py-2.5 px-3 w-48">Tiến trình</th>
                  <th className="py-2.5 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {queue.map((item) => {
                  const isSelected = item.id === selectedQueueId
                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors hover:bg-slate-50/80 ${
                        isSelected ? 'bg-blue-50/50 font-medium' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 font-mono">
                            {item.scholarId}
                          </span>
                          {item.userEmail && (
                            <span className="text-[11px] text-slate-500">
                              {item.userEmail}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {renderStatusBadge(item.status, item.progress)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
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
                          <span className="text-[11px] font-semibold text-slate-600 w-8 text-right">
                            {item.progress}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedQueueId(item.id)}
                            className={`h-7 px-2.5 text-xs ${
                              isSelected
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                            title="Inspect item logs & data"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {isSelected ? 'Đang chọn' : 'Kiểm tra'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromScholarQueue(item.id)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                            title="Remove from queue"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      </CardContent>
    </Card>
  )
}
