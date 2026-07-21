import React from 'react'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Edit, Trash2, TrendingUp, GraduationCap } from 'lucide-react'
import type { PublicationDetail } from '@/api/endpoints/scholar'

interface PublicationDetailPanelProps {
  publication: PublicationDetail
  authorName?: string
  onBack: () => void
  onEdit?: (pub: PublicationDetail, e: React.MouseEvent) => void
  onDelete?: (pubId: string, e: React.MouseEvent) => void
}

export const PublicationDetailPanel: React.FC<PublicationDetailPanelProps> = ({
  publication,
  authorName,
  onBack,
  onEdit,
  onDelete,
}) => {
  const translateVersionsCount = (countStr?: string) => {
    if (!countStr) return 'Tất cả các phiên bản'
    const numMatch = countStr.match(/\d+/)
    if (numMatch) {
      return `Tất cả ${numMatch[0]} phiên bản`
    }
    return countStr
  }

  const citesHistory = publication.cites_per_year || {}
  const years = Object.keys(citesHistory).filter(y => /^\d{4}$/.test(y)).sort()
  const values = years.map(yr => ({ year: yr, count: citesHistory[yr] || 0 }))
  const maxVal = Math.max(...values.map(v => v.count), 1)

  return (
    <Card className="border-[#E5E7EB] rounded-3xl bg-white p-6 shadow-sm animate-fade-in">
      {/* Header action bar */}
      <div className="flex flex-wrap justify-between items-center pb-4 border-b border-[#E5E7EB] mb-5 gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3.5 py-1.5 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Quay lại danh sách
          </button>

          {authorName && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hồ sơ tác giả:</span>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 rounded px-2.5 py-1 border border-slate-200">
                {authorName}
              </span>
            </div>
          )}
        </div>

        {(onEdit || onDelete) && (
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={(e) => onEdit(publication, e)}
                className="px-3.5 py-1.5 rounded-xl border border-[#E5E7EB] bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Edit className="h-3.5 w-3.5" />
                Sửa bài báo
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => onDelete(publication.id, e)}
                className="px-3.5 py-1.5 rounded-xl border border-[#E5E7EB] bg-white hover:bg-rose-50 text-rose-600 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Xóa bài báo
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Paper Title */}
        <div>
          <h2 className="text-lg font-bold text-[#2563EB] leading-snug">
            {publication.title}
          </h2>
        </div>

        {/* Paper Details Info Table */}
        <div className="space-y-3.5 text-xs text-slate-800">
          <div className="grid grid-cols-4 py-2 border-b border-slate-100 items-start">
            <span className="font-bold text-slate-500">Tác giả</span>
            <span className="col-span-3 text-slate-700 font-medium">{publication.authors_list || '─'}</span>
          </div>

          <div className="grid grid-cols-4 py-2 border-b border-slate-100 items-start">
            <span className="font-bold text-slate-500">Ngày xuất bản</span>
            <span className="col-span-3 text-slate-700">{publication.pub_date || publication.year || '─'}</span>
          </div>

          <div className="grid grid-cols-4 py-2 border-b border-slate-100 items-start">
            <span className="font-bold text-slate-500">Tạp chí / Nơi xuất bản</span>
            <span className="col-span-3 text-slate-700 italic">{publication.venue || '─'}</span>
          </div>

          {publication.volume && (
            <div className="grid grid-cols-4 py-2 border-b border-slate-100 items-start">
              <span className="font-bold text-slate-500">Tập (Volume)</span>
              <span className="col-span-3 text-slate-700">{publication.volume}</span>
            </div>
          )}

          {publication.issue && (
            <div className="grid grid-cols-4 py-2 border-b border-slate-100 items-start">
              <span className="font-bold text-slate-500">Số (Issue)</span>
              <span className="col-span-3 text-slate-700">{publication.issue}</span>
            </div>
          )}

          {publication.pages && (
            <div className="grid grid-cols-4 py-2 border-b border-slate-100 items-start">
              <span className="font-bold text-slate-500">Trang (Pages)</span>
              <span className="col-span-3 text-slate-700">{publication.pages}</span>
            </div>
          )}

          <div className="grid grid-cols-4 py-2 border-b border-slate-100 items-start">
            <span className="font-bold text-slate-500">Nhà xuất bản</span>
            <span className="col-span-3 text-slate-700 font-medium">{publication.publisher || '─'}</span>
          </div>

          {(publication.pub_url || publication.eprint_url) && (
            <div className="grid grid-cols-4 py-2 border-b border-slate-100 items-start">
              <span className="font-bold text-slate-500">Liên kết</span>
              <div className="col-span-3 flex flex-wrap gap-3">
                {publication.pub_url && (
                  <a
                    href={publication.pub_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#2563EB] hover:underline font-semibold"
                  >
                    Xem bài viết gốc
                  </a>
                )}
                {publication.eprint_url && (
                  <a
                    href={publication.eprint_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-600 hover:underline font-semibold"
                  >
                    Tải PDF / Bản xem trước 📄
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 py-2 border-b border-slate-100 items-start">
            <span className="font-bold text-slate-500">Mô tả</span>
            <span className="col-span-3 text-slate-600 leading-relaxed font-normal whitespace-pre-line max-h-40 overflow-y-auto block pr-1">
              {publication.description || '─'}
            </span>
          </div>

          <div className="grid grid-cols-4 py-2 border-b border-slate-100 items-start">
            <span className="font-bold text-slate-500">Tổng trích dẫn</span>
            <span className="col-span-3 text-[#2563EB] font-bold">
              Trích dẫn {publication.citations || 0} bài viết
            </span>
          </div>

          {/* Scientific Indexes Badges */}
          <div className="grid grid-cols-4 py-2 items-start">
            <span className="font-bold text-slate-500">Chỉ số khoa học</span>
            <div className="col-span-3 flex flex-wrap gap-2">
              {publication.sjr_q !== 'N/A' && (
                <span className="inline-block rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100">
                  {publication.sjr_q}
                </span>
              )}
              {publication.if_val !== 'N/A' && (
                <span className="inline-block rounded-lg bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-100">
                  IF: {publication.if_val}
                </span>
              )}
              {publication.wos !== 'N/A' && (
                <span className="inline-block rounded-lg bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 border border-rose-100">
                  WoS: {publication.wos}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Paper Cites Histogram Chart */}
        <div>
          <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-[#2563EB]" />
            Lịch sử trích dẫn theo năm của bài báo
          </h4>

          {years.length === 0 ? (
            <div className="text-center py-8 bg-[#F8FAFC] border border-dashed border-[#E5E7EB] rounded-2xl text-xs text-[#64748B] italic">
              Chưa có dữ liệu trích dẫn theo năm cho bài báo này.
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-center items-center">
              <svg viewBox="0 0 460 140" className="w-full h-auto overflow-visible">
                <line x1="10" y1="20" x2="420" y2="20" stroke="#E2E8F0" strokeWidth="0.8" />
                <line x1="10" y1="70" x2="420" y2="70" stroke="#E2E8F0" strokeWidth="0.8" />
                <line x1="10" y1="120" x2="420" y2="120" stroke="#94A3B8" strokeWidth="1" />

                <text x="425" y="24" className="text-[10px] font-semibold fill-slate-500">{maxVal}</text>
                <text x="425" y="74" className="text-[10px] font-semibold fill-slate-500">{Math.round(maxVal / 2)}</text>
                <text x="425" y="124" className="text-[10px] font-semibold fill-slate-500">0</text>

                {values.map((v, i) => {
                  const barWidth = 14
                  const spacing = values.length > 1 ? (400 - barWidth) / (values.length - 1) : 0
                  const x = 12 + i * spacing
                  const barHeight = maxVal > 0 ? (v.count / maxVal) * 100 : 0
                  const y = 120 - barHeight
                  return (
                    <g key={v.year} className="group cursor-pointer">
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        fill="#777777"
                        className="hover:fill-[#2563EB] transition-colors"
                      />
                      {v.count > 0 && (
                        <text
                          x={x + barWidth / 2}
                          y={y - 4}
                          textAnchor="middle"
                          className="text-[8px] font-bold fill-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {v.count}
                        </text>
                      )}
                      <text
                        x={x + barWidth / 2}
                        y="134"
                        textAnchor="middle"
                        className="text-[9px] font-bold fill-slate-500"
                      >
                        {v.year}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          )}
        </div>

        {/* Scholar articles section */}
        <div className="pt-5 border-t border-slate-100">
          <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4 text-[#2563EB]" />
            Các bài viết Scholar
          </h4>

          <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-2xl p-4 shadow-3xs text-left">
            <a
              href={publication.url_scholar_article || publication.pub_url || (publication.cites_id ? `https://scholar.google.com/scholar?cluster=${publication.cites_id}` : `https://scholar.google.com/scholar?q=${encodeURIComponent(publication.title)}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm font-semibold text-[#1a0dab] hover:underline leading-snug"
            >
              {publication.title}
            </a>

            <div className="flex flex-wrap items-center gap-4 mt-2.5 text-[11px] text-[#1a0dab] font-medium">
              <a
                href={publication.cites_id ? `https://scholar.google.com/scholar?cites=${publication.cites_id}` : `https://scholar.google.com/scholar?q=${encodeURIComponent(publication.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline cursor-pointer"
              >
                Trích dẫn {publication.citations || 0} bài viết
              </a>

              <a
                href={publication.url_related_articles || (publication.cites_id ? `https://scholar.google.com/scholar?q=related:${publication.cites_id}` : `https://scholar.google.com/scholar?q=related:${encodeURIComponent(publication.title)}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline cursor-pointer"
              >
                Bài viết có liên quan
              </a>

              <a
                href={publication.url_all_versions || (publication.cites_id ? `https://scholar.google.com/scholar?cluster=${publication.cites_id}` : `https://scholar.google.com/scholar?q=${encodeURIComponent(publication.title)}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline cursor-pointer"
              >
                {translateVersionsCount(publication.versions_count ?? undefined)}
              </a>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
