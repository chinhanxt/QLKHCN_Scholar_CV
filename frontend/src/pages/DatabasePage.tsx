import { useState, useEffect } from 'react'
import { scholarApi } from '@/api/endpoints/scholar'
import type { DatabaseStats } from '@/api/endpoints/scholar'
import { Card, CardContent } from '@/components/ui/card'
import { Database, CheckCircle, RefreshCw } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

export function DatabasePage() {
  const [stats, setStats] = useState<DatabaseStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadStats = async () => {
    setIsLoading(true)
    try {
      const data = await scholarApi.getStats().then((r) => r.data)
      setStats(data)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  return (
    <div className="flex flex-col gap-4 max-w-4xl">

      {isLoading ? (
        <Card className="border-slate-100 shadow-sm bg-white">
          <CardContent className="p-12 flex justify-center items-center">
            <Spinner className="h-8 w-8 text-[#005b9a]" />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Database className="h-4.5 w-4.5 text-[#005b9a]" />
                  Danh sách file cơ sở dữ liệu hệ thống
                </h2>
                <button
                  onClick={loadStats}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                  title="Làm mới"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { name: 'clarivate_mapped.db', desc: 'CSDL tích hợp liên kết cuối cùng', count: stats?.mapped_journals || 0 },
                  { name: 'clarivate_all.db', desc: 'CSDL danh mục thô của Clarivate MJL', count: stats?.clarivate_journals || 0 },
                  { name: 'bioxbio_all.db', desc: 'CSDL Impact Factor thô từ BioxBio', count: stats?.bioxbio_journals || 0 },
                  { name: 'scimagojr_all.db', desc: 'CSDL phân hạng thô từ SCImagoJR', count: stats?.scimago_journals || 0 },
                  { name: 'saved_profiles.db', desc: 'CSDL lưu trữ hồ sơ tác giả khoa học', count: stats?.authors || 0 },
                ].map((db, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <div className="font-mono text-xs font-bold text-slate-700">{db.name}</div>
                      <p className="text-[10px] text-slate-400 mt-1">{db.desc}</p>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100/50">
                      <span className="text-[10px] font-bold text-[#005b9a]">
                        Số bản ghi: {db.count.toLocaleString()}
                      </span>
                      <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-0.5">
                        <CheckCircle className="w-3.5 h-3.5" /> Sẵn sàng
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
