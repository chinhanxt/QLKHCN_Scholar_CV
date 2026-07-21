import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Search, Download, Plus, Trash2, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react'
import type { PublicationDetail } from '@/api/endpoints/scholar'

interface PublicationTableListProps {
  publications: PublicationDetail[]
  selectedPubIds: string[]
  onSelectPub: (pub: PublicationDetail) => void
  onToggleSelectPub: (pubId: string, e: React.ChangeEvent<HTMLInputElement>) => void
  onToggleSelectAll: () => void
  onDeselectAll?: () => void
  onAddPub?: () => void
  onOpenTrash?: () => void
  onMergePubs?: () => void
  onDeleteSelectedPubs?: () => void
  onExport?: () => void
  searchKeyword: string
  setSearchKeyword: (val: string) => void
  yearFilter: string
  setYearFilter: (val: string) => void
  quartileFilter: string
  setQuartileFilter: (val: string) => void
  sortBy: string
  setSortBy: (val: string) => void
}

export const getShortenedAuthors = (authorsStr: string) => {
  if (!authorsStr) return ''
  const list = authorsStr.split(',').map(s => s.trim())
  const shortened = list.map(name => {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length > 1) {
      const lastName = parts[parts.length - 1]
      const initials = parts.slice(0, parts.length - 1).map(p => p[0].toUpperCase()).join('')
      return `${initials} ${lastName}`
    }
    return name
  })
  if (shortened.length > 5) {
    return shortened.slice(0, 5).join(', ') + '…'
  }
  return shortened.join(', ')
}

export const PublicationTableList: React.FC<PublicationTableListProps> = ({
  publications,
  selectedPubIds,
  onSelectPub,
  onToggleSelectPub,
  onToggleSelectAll,
  onDeselectAll,
  onAddPub,
  onOpenTrash,
  onMergePubs,
  onDeleteSelectedPubs,
  onExport,
  searchKeyword,
  setSearchKeyword,
  yearFilter,
  setYearFilter,
  quartileFilter,
  setQuartileFilter,
  sortBy,
  setSortBy,
}) => {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    setCurrentPage(1)
  }, [searchKeyword, yearFilter, quartileFilter, sortBy])

  // Available years for dropdown
  const availableYears = Array.from(
    new Set(publications.map(p => p.year).filter(y => y && y !== 'Không rõ'))
  ).sort().reverse()

  // Filter logic
  const filteredPubs = publications.filter(pub => {
    const matchesKeyword = !searchKeyword.trim() ||
      pub.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      pub.venue.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      pub.authors_list.toLowerCase().includes(searchKeyword.toLowerCase())

    const matchesYear = yearFilter === 'All' || yearFilter === 'all' || pub.year === yearFilter
    const matchesQuartile = quartileFilter === 'All' || quartileFilter === 'all' || pub.sjr_q === quartileFilter

    return matchesKeyword && matchesYear && matchesQuartile
  })

  // Sort logic
  const sortedPubs = [...filteredPubs].sort((a, b) => {
    if (sortBy === 'citations_desc') return (b.citations || 0) - (a.citations || 0)
    if (sortBy === 'citations_asc') return (a.citations || 0) - (b.citations || 0)
    if (sortBy === 'year_desc') return (parseInt(b.year) || 0) - (parseInt(a.year) || 0)
    if (sortBy === 'year_asc') return (parseInt(a.year) || 0) - (parseInt(b.year) || 0)
    if (sortBy === 'title_asc') return a.title.localeCompare(b.title)
    if (sortBy === 'title_desc') return b.title.localeCompare(a.title)
    return 0
  })

  const totalPages = Math.ceil(sortedPubs.length / itemsPerPage)
  const paginatedPubs = sortedPubs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const isAllSelected = sortedPubs.length > 0 && sortedPubs.every(p => selectedPubIds.map(String).includes(String(p.id)))

  return (
    <Card className="border-[#E5E7EB] rounded-3xl bg-white p-6 shadow-sm">
      {/* Multi-Select Action Banner (Merge / Delete selected) */}
      {selectedPubIds.length > 0 && (
        <div className="mb-4 p-3.5 bg-[#DBEAFE]/40 border border-[#93C5FD] rounded-2xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs text-[#1E40AF] font-bold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2563EB] text-white text-[11px]">
              {selectedPubIds.length}
            </span>
            <span>Đã chọn {selectedPubIds.length} bài báo khoa học</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedPubIds.length >= 2 && onMergePubs && (
              <button
                onClick={onMergePubs}
                className="px-3.5 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Gộp bài báo trùng lặp ({selectedPubIds.length})</span>
              </button>
            )}
            {onDeleteSelectedPubs && (
              <button
                onClick={onDeleteSelectedPubs}
                className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa các bài đã chọn</span>
              </button>
            )}
            <button
              onClick={onDeselectAll}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-semibold text-xs transition-colors cursor-pointer"
            >
              Bỏ chọn tất cả
            </button>
          </div>
        </div>
      )}

      {/* Toolbar options right above the table */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 mb-4">
        <div className="flex-1 flex flex-col sm:flex-row gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <input
              type="text"
              placeholder="Lọc tên bài báo khoa học..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-1.5 pl-9 text-xs text-[#0F172A] placeholder-slate-400 focus:outline-none"
            />
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          </div>

          <select
            value={quartileFilter}
            onChange={(e) => setQuartileFilter(e.target.value)}
            className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs text-slate-600 font-semibold focus:outline-none cursor-pointer"
          >
            <option value="all">Mọi Phân hạng Q</option>
            <option value="Q1">Q1</option>
            <option value="Q2">Q2</option>
            <option value="Q3">Q3</option>
            <option value="Q4">Q4</option>
            <option value="N/A">Chưa xếp hạng (N/A)</option>
          </select>

          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs text-slate-600 font-semibold focus:outline-none cursor-pointer"
          >
            <option value="All">Tất cả năm</option>
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs text-slate-650 font-semibold focus:outline-none cursor-pointer"
          >
            <option value="citations_desc">Trích dẫn (Cao-Thấp)</option>
            <option value="citations_asc">Trích dẫn (Thấp-Cao)</option>
            <option value="year_desc">Năm (Mới nhất)</option>
            <option value="year_asc">Năm (Cũ nhất)</option>
            <option value="title_asc">Tựa đề (A-Z)</option>
            <option value="title_desc">Tựa đề (Z-A)</option>
          </select>
        </div>

        {onExport && (
          <button
            onClick={onExport}
            className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Xuất Excel</span>
          </button>
        )}
      </div>

      {/* Publications Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-3 w-10">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 accent-[#2563EB] cursor-pointer"
                  checked={isAllSelected}
                  onChange={onToggleSelectAll}
                />
              </th>
              <th
                className="py-3 px-4 font-bold text-[#2563EB] hover:underline cursor-pointer uppercase tracking-wider text-[10px]"
                onClick={() => setSortBy(sortBy === 'title_asc' ? 'title_desc' : 'title_asc')}
              >
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="cursor-pointer hover:underline" onClick={() => setSortBy(sortBy === 'title_asc' ? 'title_desc' : 'title_asc')}>
                    TIÊU ĐỀ
                  </span>
                  {onAddPub && (
                    <button
                      onClick={onAddPub}
                      className="p-0.5 rounded hover:bg-slate-200 text-[#2563EB] transition-colors ml-1"
                      title="Thêm công báo mới"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {onOpenTrash && (
                    <button
                      onClick={onOpenTrash}
                      className="p-0.5 rounded hover:bg-slate-200 text-rose-600 transition-colors"
                      title="Xem Thùng rác bài viết"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </th>
              <th
                className="py-3 px-4 font-bold text-[#2563EB] hover:underline cursor-pointer uppercase tracking-wider text-[10px] w-28 text-right"
                onClick={() => setSortBy(sortBy === 'citations_desc' ? 'citations_asc' : 'citations_desc')}
              >
                TRÍCH DẪN
              </th>
              <th
                className="py-3 px-4 font-bold text-[#2563EB] hover:underline cursor-pointer uppercase tracking-wider text-[10px] w-20 text-right"
                onClick={() => setSortBy(sortBy === 'year_desc' ? 'year_asc' : 'year_desc')}
              >
                NĂM
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedPubs.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-550 italic">
                  Không tìm thấy bài báo nào khớp điều kiện lọc.
                </td>
              </tr>
            ) : (
              paginatedPubs.map((pub) => (
                <tr
                  key={pub.id}
                  className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  onClick={() => onSelectPub(pub)}
                >
                  <td className="py-4 px-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 accent-[#2563EB] cursor-pointer"
                      checked={selectedPubIds.map(String).includes(String(pub.id))}
                      onChange={(e) => onToggleSelectPub(String(pub.id), e as any)}
                    />
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-bold text-[#2563EB] hover:underline text-sm leading-snug">
                      {pub.title}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">
                      {getShortenedAuthors(pub.authors_list)}
                    </div>
                    <div className="text-[11px] text-slate-500 italic mt-0.5 font-medium flex items-center gap-1.5 flex-wrap">
                      <span>
                        {pub.volume || pub.pages ? (
                          `${pub.venue || ''} ${pub.volume || ''}${pub.issue ? `(${pub.issue})` : ''}${pub.pages ? `, ${pub.pages}` : ''}`.trim()
                        ) : (
                          pub.venue || 'Tạp chí khác'
                        )}
                      </span>
                    </div>

                    {/* Inline Scientific Rank Badges */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {pub.sjr_q !== 'N/A' && (
                        <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100">
                          {pub.sjr_q}
                        </span>
                      )}
                      {pub.if_val !== 'N/A' && (
                        <span className="inline-block rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-100">
                          IF: {pub.if_val}
                        </span>
                      )}
                      {pub.wos !== 'N/A' && (
                        <span className="inline-block rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 border border-rose-100">
                          WoS: {pub.wos}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-4 px-4 text-right font-bold text-[#2563EB] text-sm">
                    {pub.citations || 0}
                  </td>
                  <td className="py-4 px-4 text-right font-bold text-slate-600 text-sm">
                    {pub.year || '─'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-4 text-xs text-[#64748B]">
          <span>
            Hiển thị <strong>{paginatedPubs.length}</strong> trên tổng số <strong>{sortedPubs.length}</strong> bài báo
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="p-1.5 rounded-lg border border-[#E5E7EB] hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-bold">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="p-1.5 rounded-lg border border-[#E5E7EB] hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}
