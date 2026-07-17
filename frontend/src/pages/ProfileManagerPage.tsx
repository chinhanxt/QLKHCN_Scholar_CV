import { useState, useEffect } from 'react'
import { scholarApi } from '@/api/endpoints/scholar'
import type { AuthorProfileDetail } from '@/api/endpoints/scholar'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { 
  FolderHeart, 
  Trash2, 
  Search, 
  User, 
  TrendingUp, 
  Filter, 
  Download,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Menu
} from 'lucide-react'

export function ProfileManagerPage() {
  const [authors, setAuthors] = useState<AuthorProfileDetail[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Selected Profile detail
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<AuthorProfileDetail | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  // Publications filters
  const [pubKeyword, setPubKeyword] = useState('')
  const [pubQuartile, setPubQuartile] = useState<string>('all')
  const [pubYear, setPubYear] = useState<string>('all')
  const [selectedPubId, setSelectedPubId] = useState<string | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const fetchAuthors = async () => {
    setIsLoading(true)
    try {
      const resData = await scholarApi.getAuthors().then((r) => r.data)
      const authorsList = Array.isArray(resData) 
        ? resData 
        : (resData && Array.isArray((resData as any).results)) 
          ? (resData as any).results 
          : []
      setAuthors(authorsList)
    } catch (err) {
      toast.error('Không thể lấy danh sách hồ sơ tác giả.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAuthors()
  }, [])

  // Load detailed profile when selected
  useEffect(() => {
    if (!selectedProfileId) {
      setSelectedProfile(null)
      setSelectedPubId(null)
      return
    }

    const loadDetail = async () => {
      setIsLoadingDetail(true)
      try {
        const res = await scholarApi.getAuthor(selectedProfileId).then((r) => r.data)
        setSelectedProfile(res)
        setSelectedPubId(null)
      } catch (err) {
        toast.error('Không thể lấy chi tiết hồ sơ.')
        setSelectedProfileId(null)
      } finally {
        setIsLoadingDetail(false)
      }
    }
    loadDetail()
  }, [selectedProfileId])

  const handleDelete = async (scholarId: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xoá hồ sơ tác giả "${name}" không? Toàn bộ bài báo liên quan cũng sẽ bị xoá.`)) {
      return
    }

    try {
      await scholarApi.deleteAuthor(scholarId).then((r) => r.data)
      toast.success(`Đã xoá thành công hồ sơ của ${name}`)
      fetchAuthors()
      if (selectedProfileId === scholarId) {
        setSelectedProfileId(null)
      }
    } catch (err) {
      toast.error('Xoá hồ sơ thất bại.')
    }
  }

  // Export selected profile to CSV
  const handleExportCSV = (profile: AuthorProfileDetail) => {
    if (!profile.publications || profile.publications.length === 0) {
      toast.warning('Không có bài báo nào để xuất bản ghi.')
      return
    }

    const headers = ['STT', 'Tên bài báo', 'Tác giả', 'Nơi xuất bản (Venue)', 'Năm', 'Trích dẫn', 'SJR Q', 'Impact Factor', 'WoS Indexing']
    const csvRows = [headers.join(',')]

    profile.publications.forEach((pub, idx) => {
      const row = [
        idx + 1,
        `"${pub.title.replace(/"/g, '""')}"`,
        `"${pub.authors_list.replace(/"/g, '""')}"`,
        `"${pub.venue.replace(/"/g, '""')}"`,
        pub.year,
        pub.citations,
        pub.sjr_q,
        pub.if_val,
        `"${pub.wos.replace(/"/g, '""')}"`
      ]
      csvRows.push(row.join(','))
    })

    const csvContent = '\ufeff' + csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `profile_${profile.name.replace(/\s+/g, '_')}_export.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Đã xuất báo cáo CSV cho tác giả ${profile.name}`)
  }

  // Filter authors list
  const filteredAuthors = authors.filter((a) => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.scholar_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.affiliation && a.affiliation.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Filter selected author publications
  const filteredPublications = selectedProfile?.publications?.filter((pub) => {
    const matchesKeyword = pub.title.toLowerCase().includes(pubKeyword.toLowerCase()) ||
                          pub.venue.toLowerCase().includes(pubKeyword.toLowerCase()) ||
                          pub.authors_list.toLowerCase().includes(pubKeyword.toLowerCase())
    const matchesQuartile = pubQuartile === 'all' || pub.sjr_q === pubQuartile
    const matchesYear = pubYear === 'all' || pub.year.toString() === pubYear
    return matchesKeyword && matchesQuartile && matchesYear
  }) || []

  // Extract years for publication filter dropdown
  const pubYears = selectedProfile?.publications
    ? Array.from(new Set(selectedProfile.publications.map((p) => p.year.toString()).filter(Boolean))).sort((a, b) => b.localeCompare(a))
    : []



  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-32px)] md:h-[calc(100vh-48px)] overflow-hidden">
      {/* Main Split Pane Layout */}
      <div className="flex-1 min-h-0 flex gap-6 overflow-hidden">
        
        {/* Left Sidebar: Authors list */}
        <Card className={cn(
          "border-slate-200 bg-white flex flex-col shrink-0 overflow-hidden shadow-xs transition-all duration-300",
          isSidebarCollapsed ? "w-0 opacity-0 border-none pointer-events-none" : "w-80"
        )}>
          <div className="p-4 border-b border-slate-100 flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <FolderHeart className="w-4 h-4 text-[#005b9a]" />
                DANH SÁCH HỒ SƠ LƯU TRỮ ({filteredAuthors.length})
              </h3>
              <button 
                onClick={() => setIsSidebarCollapsed(true)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 cursor-pointer transition-colors"
                title="Thu gọn danh mục"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm tên tác giả, ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#005b9a]"
              />
            </div>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {isLoading ? (
              <div className="flex py-12 justify-center">
                <Spinner className="h-6 w-6 text-[#005b9a]" />
              </div>
            ) : filteredAuthors.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400 italic">
                Không tìm thấy hồ sơ nào.
              </div>
            ) : (
              filteredAuthors.map((author) => {
                const isSelected = selectedProfileId === author.scholar_id
                return (
                  <button
                    key={author.scholar_id}
                    onClick={() => setSelectedProfileId(author.scholar_id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg flex items-center justify-between transition-all cursor-pointer group",
                      isSelected 
                        ? "bg-[#e6f0f7] border border-[#b8d4e9]" 
                        : "border border-transparent hover:bg-slate-50"
                    )}
                  >
                    <div className="leading-tight flex-1 pr-2 min-w-0">
                      <div className={cn(
                        "text-xs font-bold truncate",
                        isSelected ? "text-[#005b9a]" : "text-slate-700"
                      )}>
                        {author.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {author.affiliation || 'Không có affiliation'}
                      </div>
                      <div className="flex gap-3 text-[9px] text-slate-400 font-bold mt-1.5">
                        <span>Cites: <b className="text-slate-600">{author.citedby}</b></span>
                        <span>H-Index: <b className="text-slate-600">{author.hindex}</b></span>
                      </div>
                    </div>
                    <ChevronRight className={cn(
                      "w-4 h-4 shrink-0 transition-transform",
                      isSelected ? "text-[#005b9a] translate-x-0.5" : "text-slate-300 group-hover:text-slate-500"
                    )} />
                  </button>
                )
              })
            )}
          </div>
        </Card>

        {/* Right Pane: Author details */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {isSidebarCollapsed && !selectedPubId && (
            <div className="flex items-center gap-3 mb-3 shrink-0">
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-3xs cursor-pointer transition-colors"
                title="Hiển thị danh sách hồ sơ"
              >
                <Menu className="w-3.5 h-3.5 text-[#005b9a]" />
                <span>Hiện danh sách hồ sơ</span>
              </button>
            </div>
          )}
          {isLoadingDetail ? (
            <Card className="flex-1 border-slate-200 bg-white flex items-center justify-center">
              <Spinner className="h-8 w-8 text-[#005b9a]" />
            </Card>
          ) : selectedProfile ? (
            selectedPubId ? (
              // PAPER DETAIL VIEW - Takes 100% of the Right Pane
              (() => {
                const selectedPub = selectedProfile.publications?.find((p) => p.id === selectedPubId)
                const pubCitationYears = selectedPub?.cites_per_year
                  ? Object.keys(selectedPub.cites_per_year)
                      .filter((y) => /^\d{4}$/.test(y))
                      .sort()
                  : []

                const pubCitationValues = pubCitationYears.map((year) => ({
                  year,
                  count: selectedPub?.cites_per_year?.[year] || 0
                }))

                const pubMaxCites = Math.max(...pubCitationValues.map((v) => v.count), 1)

                return (
                  <div className="flex-1 flex flex-col min-h-0 gap-4 overflow-y-auto p-1 animate-in fade-in duration-200">
                    {/* Header Controls */}
                    <div className="flex items-center justify-between shrink-0 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setSelectedPubId(null)
                            setIsSidebarCollapsed(false)
                          }}
                          className="flex items-center gap-1.5 text-xs font-bold text-[#005b9a] hover:text-[#004677] cursor-pointer transition-colors"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          <span>Quay lại danh sách</span>
                        </button>
                      </div>

                      {/* Tên chủ bài báo */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hồ sơ tác giả:</span>
                        <span className="text-xs font-bold text-slate-700 bg-white rounded px-2.5 py-1 border border-slate-200 shadow-3xs">{selectedProfile.name}</span>
                      </div>
                    </div>

                    {/* Paper Title Card */}
                    <Card className="p-6 border-slate-200 bg-white shadow-xs">
                      <span className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-wider block">Tiêu đề bài viết</span>
                      <h3 className="text-base md:text-xl font-extrabold text-slate-900 mt-2 leading-snug">{selectedPub?.title}</h3>
                      <p className="text-xs md:text-sm text-slate-600 mt-3 font-semibold leading-relaxed">Tác giả: {selectedPub?.authors_list}</p>
                    </Card>

                    {/* Metadata & Rankings Grid */}
                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Publishing Details */}
                      <Card className="p-5 border-slate-200 bg-white shadow-xs flex flex-col gap-4 justify-between">
                        <h4 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2.5">Thông tin xuất bản</h4>
                        <div className="space-y-3.5 text-xs md:text-sm">
                          <div className="flex justify-between gap-4 items-start">
                            <span className="text-slate-500 font-bold shrink-0">Nơi xuất bản (Venue):</span>
                            <span className="font-bold text-slate-800 italic text-right leading-normal text-sm md:text-base" title={selectedPub?.venue}>
                              {selectedPub?.venue}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-bold">Năm xuất bản:</span>
                            <span className="font-extrabold text-slate-800 text-sm md:text-base">{selectedPub?.year}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-bold">Tổng trích dẫn:</span>
                            <span className="font-extrabold text-[#005b9a] text-sm md:text-base">{selectedPub?.citations}</span>
                          </div>
                        </div>
                      </Card>

                      {/* Rank & Indices */}
                      <Card className="p-5 border-slate-200 bg-white shadow-xs flex flex-col gap-4 justify-between">
                        <h4 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2.5">Phân hạng & Chỉ số</h4>
                        <div className="space-y-3.5 text-xs md:text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-bold">SJR Quartile:</span>
                            {selectedPub?.sjr_q === 'N/A' ? (
                              <span className="text-slate-500 font-bold text-sm md:text-base">N/A</span>
                            ) : (
                              <span className={cn(
                                "inline-block rounded-md px-2.5 py-1 text-xs md:text-sm font-extrabold border shadow-3xs",
                                selectedPub?.sjr_q === 'Q1' && "bg-emerald-50 text-emerald-700 border-emerald-100",
                                selectedPub?.sjr_q === 'Q2' && "bg-amber-50 text-amber-700 border-amber-100",
                                selectedPub?.sjr_q === 'Q3' && "bg-[#e6f0f7] text-[#005b9a] border-[#b8d4e9]",
                                selectedPub?.sjr_q === 'Q4' && "bg-slate-100 text-slate-600 border-slate-200"
                              )}>
                                {selectedPub?.sjr_q}
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-bold">Impact Factor:</span>
                            {selectedPub?.if_val === 'N/A' ? (
                              <span className="text-slate-500 font-bold text-sm md:text-base">N/A</span>
                            ) : (
                              <span className="inline-block rounded-md bg-[#e6f0f7] px-3 py-1 text-xs md:text-sm font-extrabold text-[#005b9a] border border-[#b8d4e9] shadow-3xs">
                                {selectedPub?.if_val}
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between items-center gap-4">
                            <span className="text-slate-500 font-bold shrink-0">Web of Science:</span>
                            {selectedPub?.wos === 'N/A' ? (
                              <span className="text-slate-500 font-bold text-sm md:text-base">N/A</span>
                            ) : (
                              <span className="font-extrabold text-rose-600 text-right leading-normal text-sm md:text-base" title={selectedPub?.wos}>
                                {selectedPub?.wos}
                              </span>
                            )}
                          </div>
                        </div>
                      </Card>
                    </div>

                    {/* Citation History Chart */}
                    <Card className="p-6 border-slate-200 bg-white shadow-xs">
                      <h4 className="text-xs md:text-sm font-bold text-slate-600 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <TrendingUp className="h-4.5 w-4.5 text-[#005b9a]" />
                        Lịch sử trích dẫn theo năm của bài báo (Google Scholar)
                      </h4>

                      {pubCitationValues.length === 0 ? (
                        <div className="flex h-40 items-center justify-center text-sm text-slate-400 italic">
                          Không có dữ liệu trích dẫn theo năm cho bài báo này.
                        </div>
                      ) : (
                        <div className="flex h-56 items-end gap-3.5 pt-6 pb-2 border-b border-slate-200 overflow-x-auto custom-scrollbar">
                          {pubCitationValues.map((v) => {
                            const heightPct = (v.count / pubMaxCites) * 100
                            return (
                              <div key={v.year} className="flex-1 flex flex-col items-center gap-2.5 group min-w-[36px]">
                                <div className="w-full flex flex-col justify-end items-center h-36">
                                  <div
                                    className="w-full bg-[#005b9a]/70 group-hover:bg-[#005b9a] rounded-t-md transition-all duration-300 shadow-3xs relative"
                                    style={{ height: `${heightPct}%` }}
                                  >
                                    {/* Permanently visible label sitting directly on top of this bar */}
                                    <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs md:text-sm font-extrabold text-[#005b9a] bg-[#e6f0f7] px-2.5 py-0.5 rounded border border-[#b8d4e9] shadow-3xs whitespace-nowrap z-10 transition-transform group-hover:scale-110">
                                      {v.count}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-xs font-bold text-slate-500 select-none mt-1">{v.year}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </Card>
                  </div>
                )
              })()
            ) : (
              // DEFAULT AUTHOR PROFILE VIEW - Headers + Publications list
              <div className="flex-1 flex flex-col min-h-0 gap-4 overflow-hidden animate-in fade-in duration-200">
                {/* Author Header Banner Card */}
                <Card className="border-slate-200 bg-white p-4 shrink-0 shadow-xs">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e6f0f7] text-[#005b9a] font-bold text-lg shrink-0">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col justify-center min-w-0">
                        <h2 className="text-sm font-bold text-slate-800 line-clamp-1">{selectedProfile.name}</h2>
                        <p className="text-xs text-slate-500 mt-0.5 italic line-clamp-1">{selectedProfile.affiliation || 'Không có cơ quan công tác'}</p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {selectedProfile.interests?.slice(0, 5).map((interest, i) => (
                            <span key={i} className="text-[9px] font-bold bg-[#e6f0f7] text-[#005b9a] rounded px-2 py-0.5">
                              {interest}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-center">
                      <div className="flex flex-col items-center bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-center min-w-[70px]">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Citations</span>
                        <span className="text-xs font-bold text-slate-800 mt-0.5">{selectedProfile.citedby}</span>
                      </div>
                      <div className="flex flex-col items-center bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-center min-w-[70px]">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">H-Index</span>
                        <span className="text-xs font-bold text-slate-800 mt-0.5">{selectedProfile.hindex}</span>
                      </div>
                      <div className="flex flex-col items-center bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-center min-w-[70px]">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">i10-Index</span>
                        <span className="text-xs font-bold text-slate-800 mt-0.5">{selectedProfile.i10index}</span>
                      </div>

                      <div className="h-8 w-px bg-slate-200 mx-1"></div>
                      
                      {/* Action buttons */}
                      <button
                        onClick={() => handleExportCSV(selectedProfile)}
                        className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs cursor-pointer transition-colors shadow-3xs"
                        title="Xuất báo cáo CSV"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Xuất Excel</span>
                      </button>

                      <button
                        onClick={() => handleDelete(selectedProfile.scholar_id, selectedProfile.name)}
                        className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs cursor-pointer transition-colors shadow-3xs"
                        title="Xoá hồ sơ này"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  </div>
                </Card>

                {/* Table Card (Replaces the Tabs container) */}
                <Card className="flex-1 min-h-0 border-slate-200 bg-white flex flex-col shadow-xs overflow-hidden">
                  {/* Filters Row */}
                  <div className="p-3 bg-slate-50/50 border-b border-slate-100 flex flex-wrap gap-3 items-center shrink-0">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      <Filter className="w-3.5 h-3.5 text-[#005b9a]" />
                      Lọc ấn phẩm:
                    </div>

                    <input
                      type="text"
                      placeholder="Tìm từ khóa..."
                      value={pubKeyword}
                      onChange={(e) => setPubKeyword(e.target.value)}
                      className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#005b9a] w-44 font-medium"
                    />

                    <select
                      value={pubQuartile}
                      onChange={(e) => setPubQuartile(e.target.value)}
                      className="bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#005b9a] text-slate-600 font-medium cursor-pointer"
                    >
                      <option value="all">Mọi Phân hạng Q</option>
                      <option value="Q1">Q1</option>
                      <option value="Q2">Q2</option>
                      <option value="Q3">Q3</option>
                      <option value="Q4">Q4</option>
                      <option value="N/A">Chưa xếp hạng (N/A)</option>
                    </select>

                    <select
                      value={pubYear}
                      onChange={(e) => setPubYear(e.target.value)}
                      className="bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#005b9a] text-slate-600 font-medium cursor-pointer"
                    >
                      <option value="all">Mọi năm</option>
                      {pubYears.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                  {/* Table wrapper */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                    <table className="w-full text-left text-xs border-collapse relative">
                      <thead className="sticky top-0 bg-slate-50 text-slate-500 font-bold border-b border-slate-100 z-10 shadow-3xs">
                        <tr>
                          <th className="py-2.5 px-4 w-10 text-center">STT</th>
                          <th className="py-2.5 px-4">Tên bài báo</th>
                          <th className="py-2.5 px-4 w-16 text-center">Năm</th>
                          <th className="py-2.5 px-4 w-20 text-center">Trích dẫn</th>
                          <th className="py-2.5 px-4 w-18 text-center">SJR Q</th>
                          <th className="py-2.5 px-4 w-20 text-center">IF</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPublications.map((pub, idx) => (
                          <tr 
                            key={pub.id} 
                            onClick={() => {
                              setSelectedPubId(pub.id)
                              setIsSidebarCollapsed(true)
                            }}
                            className="hover:bg-slate-50/50 cursor-pointer transition-all"
                          >
                            <td className="py-3 px-4 font-semibold text-slate-400 text-center">{idx + 1}</td>
                            <td className="py-3 px-4">
                              <div className="text-slate-800 leading-normal line-clamp-2">{pub.title}</div>
                              <div className="text-[10px] text-slate-400 mt-1 truncate max-w-lg">{pub.venue}</div>
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-slate-500">{pub.year}</td>
                            <td className="py-3 px-4 text-center font-bold text-[#005b9a]">{pub.citations}</td>
                            <td className="py-3 px-4 text-center">
                              {pub.sjr_q === 'Q1' && (
                                <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-100">Q1</span>
                              )}
                              {pub.sjr_q === 'Q2' && (
                                <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-100">Q2</span>
                              )}
                              {pub.sjr_q === 'Q3' && (
                                <span className="inline-block rounded bg-[#e6f0f7] px-1.5 py-0.5 text-[9px] font-bold text-[#005b9a] border border-[#b8d4e9]">Q3</span>
                              )}
                              {pub.sjr_q === 'Q4' && (
                                <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">Q4</span>
                              )}
                              {pub.sjr_q === 'N/A' && <span className="text-slate-300 font-medium">─</span>}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {pub.if_val !== 'N/A' ? (
                                <span className="inline-block rounded bg-[#e6f0f7] px-2 py-0.5 text-[9px] font-bold text-[#005b9a] border border-[#b8d4e9]">{pub.if_val}</span>
                              ) : (
                                <span className="text-slate-300 font-medium">─</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )
          ) : (
            <Card className="flex-1 border-slate-200 bg-white flex flex-col items-center justify-center text-slate-400 gap-2">
              <FolderHeart className="h-12 w-12 opacity-20" />
              <span className="text-xs font-bold uppercase tracking-wider">Lựa chọn Hồ sơ</span>
              <p className="text-xs opacity-75 max-w-sm text-center leading-normal">Vui lòng chọn một hồ sơ tác giả khoa học bên thanh danh mục để bắt đầu tra cứu thông tin chi tiết.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
