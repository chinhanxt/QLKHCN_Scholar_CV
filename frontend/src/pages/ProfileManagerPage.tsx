import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { scholarApi } from '@/api/endpoints/scholar'
import type { AuthorProfileDetail, PublicationDetail } from '@/api/endpoints/scholar'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PublicationDetailPanel } from '@/components/scholar/PublicationDetailPanel'
import { PublicationTableList } from '@/components/scholar/PublicationTableList'
import { 
  FolderHeart, 
  Trash2, 
  Search, 
  User, 
  Download,
  ChevronRight,
  ChevronLeft,
  Menu,
  X
} from 'lucide-react'

export function ProfileManagerPage() {
  const [searchParams] = useSearchParams()
  const authorIdParam = searchParams.get('id') || searchParams.get('authorId')
  const [authors, setAuthors] = useState<AuthorProfileDetail[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Selected Profile detail
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(authorIdParam)
  const [selectedProfile, setSelectedProfile] = useState<AuthorProfileDetail | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  // Publications filters
  const [pubKeyword, setPubKeyword] = useState('')
  const [pubQuartile, setPubQuartile] = useState<string>('all')
  const [pubYear, setPubYear] = useState<string>('all')
  const [selectedPubId, setSelectedPubId] = useState<string | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Selection state
  const [selectedPubIds, setSelectedPubIds] = useState<string[]>([])

  const fetchAuthors = async () => {
    setIsLoading(true)
    try {
      const resData = await scholarApi.getAuthors().then((r) => r.data)
      const rawList = Array.isArray(resData) 
        ? resData 
        : (resData && Array.isArray((resData as any).results)) 
          ? (resData as any).results 
          : []
      // Only show authors that have scraped publications / data
      const scrapedAuthors = rawList.filter((a: any) => {
        const pubCount = a.publications?.length || a.publications_count || 0
        return pubCount > 0 || Boolean(a.last_scraped_at) || a.last_scan_status === 'COMPLETED'
      })
      setAuthors(scrapedAuthors)
    } catch (err) {
      toast.error('Không thể lấy danh sách hồ sơ tác giả.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAuthors()
  }, [])

  useEffect(() => {
    if (authorIdParam) {
      setSelectedProfileId(authorIdParam)
    }
  }, [authorIdParam])

  // Load detailed profile when selected
  useEffect(() => {
    setSelectedPubIds([])
    if (!selectedProfileId) {
      setSelectedProfile(null)
      setSelectedPubId(null)
      return
    }

    const localMatch = authors.find(
      (a) => String(a.scholar_id) === String(selectedProfileId) || String(a.id) === String(selectedProfileId)
    )

    if (localMatch && localMatch.publications && localMatch.publications.length > 0) {
      setSelectedProfile(localMatch)
      setSelectedPubId(null)
      return
    }

    const loadDetail = async () => {
      setIsLoadingDetail(true)
      try {
        const targetId = localMatch?.scholar_id || selectedProfileId
        const res = await scholarApi.getAuthor(targetId).then((r) => r.data)
        setSelectedProfile(res)
        setSelectedPubId(null)
      } catch (err) {
        if (localMatch) {
          setSelectedProfile(localMatch)
          setSelectedPubId(null)
        } else {
          toast.error('Không thể lấy chi tiết hồ sơ.')
          setSelectedProfileId(null)
        }
      } finally {
        setIsLoadingDetail(false)
      }
    }
    loadDetail()
  }, [selectedProfileId, authors])

  const handleToggleSelectPub = (pubId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    const strId = String(pubId)
    setSelectedPubIds(prev =>
      prev.includes(strId) ? prev.filter(id => id !== strId) : [...prev, strId]
    )
  }

  const handleDeselectAll = () => {
    setSelectedPubIds([])
  }

  const handleToggleSelectAll = () => {
    if (!selectedProfile || !selectedProfile.publications) return
    const allIds = selectedProfile.publications.map(p => String(p.id))
    const isAllSelected = allIds.length > 0 && allIds.every(id => selectedPubIds.includes(id))
    if (isAllSelected) {
      setSelectedPubIds([])
    } else {
      setSelectedPubIds(allIds)
    }
  }

  // Modals state
  const [isAddPubModalOpen, setIsAddPubModalOpen] = useState(false)
  const [isEditPubModalOpen, setIsEditPubModalOpen] = useState(false)
  const [editingPublication, setEditingPublication] = useState<PublicationDetail | null>(null)
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false)
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false)
  const [mergeMainPubId, setMergeMainPubId] = useState<string>('')

  // Trash Bin State
  const [deletedPublications, setDeletedPublications] = useState<PublicationDetail[]>(() => {
    const saved = localStorage.getItem('profile_deletedPublications')
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    localStorage.setItem('profile_deletedPublications', JSON.stringify(deletedPublications))
  }, [deletedPublications])

  // Publication Form State
  const [pubForm, setPubForm] = useState({
    title: '',
    authors_list: '',
    venue: '',
    year: new Date().getFullYear().toString(),
    citations: 0,
    sjr_q: 'N/A',
    if_val: 'N/A',
    wos: 'N/A'
  })

  const handleAddPub = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProfile) return

    const newPub: PublicationDetail = {
      id: `custom_${Date.now()}`,
      title: pubForm.title,
      authors_list: pubForm.authors_list,
      venue: pubForm.venue,
      year: pubForm.year,
      citations: Number(pubForm.citations),
      display_order: (selectedProfile.publications?.length || 0) + 1,
      cites_per_year: {},
      journal: null,
      sjr_q: pubForm.sjr_q,
      if_val: pubForm.if_val,
      wos: pubForm.wos
    }

    setSelectedProfile({
      ...selectedProfile,
      publications: [newPub, ...(selectedProfile.publications || [])],
      citedby: selectedProfile.citedby + Number(pubForm.citations)
    })

    setIsAddPubModalOpen(false)
    setPubForm({
      title: '',
      authors_list: '',
      venue: '',
      year: new Date().getFullYear().toString(),
      citations: 0,
      sjr_q: 'N/A',
      if_val: 'N/A',
      wos: 'N/A'
    })
    toast.success('Thêm bài báo nghiên cứu thành công!')
  }

  const handleDeleteSinglePub = (pubId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!selectedProfile) return
    if (window.confirm('Bạn có chắc muốn xóa bài báo này và chuyển vào thùng rác?')) {
      const pubToDelete = selectedProfile.publications?.find(p => String(p.id) === String(pubId))
      if (pubToDelete) {
        setDeletedPublications(prev => [pubToDelete, ...prev])
        const newPubs = selectedProfile.publications.filter(p => String(p.id) !== String(pubId))
        const newTotalCites = newPubs.reduce((sum, p) => sum + (p.citations || 0), 0)
        setSelectedProfile({
          ...selectedProfile,
          publications: newPubs,
          citedby: newTotalCites
        })
        setSelectedPubId(null)
        toast.success('Đã chuyển bài báo vào thùng rác!')
      }
    }
  }

  const openEditPubModal = (pub: PublicationDetail, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setEditingPublication(pub)
    setPubForm({
      title: pub.title || '',
      authors_list: pub.authors_list || '',
      venue: pub.venue || '',
      year: pub.year || new Date().getFullYear().toString(),
      citations: pub.citations || 0,
      sjr_q: pub.sjr_q || 'N/A',
      if_val: pub.if_val || 'N/A',
      wos: pub.wos || 'N/A'
    })
    setIsEditPubModalOpen(true)
  }

  const handleSaveEditPub = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProfile || !editingPublication) return

    const updatedPub: PublicationDetail = {
      ...editingPublication,
      title: pubForm.title,
      authors_list: pubForm.authors_list,
      venue: pubForm.venue,
      year: pubForm.year,
      citations: Number(pubForm.citations),
      sjr_q: pubForm.sjr_q,
      if_val: pubForm.if_val,
      wos: pubForm.wos
    }

    const updatedPublications = selectedProfile.publications.map(p =>
      String(p.id) === String(editingPublication.id) ? updatedPub : p
    )
    const newTotalCites = updatedPublications.reduce((sum, p) => sum + (p.citations || 0), 0)

    setSelectedProfile({
      ...selectedProfile,
      publications: updatedPublications,
      citedby: newTotalCites
    })

    setIsEditPubModalOpen(false)
    setEditingPublication(null)
    toast.success('Cập nhật thông tin bài báo thành công!')
  }

  const handleMergeConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProfile || selectedPubIds.length < 2 || !mergeMainPubId) return

    const selectedPubs = selectedProfile.publications.filter(p => selectedPubIds.includes(String(p.id)))
    const mainPub = selectedPubs.find(p => String(p.id) === mergeMainPubId)
    if (!mainPub) return

    const mergedCitations = selectedPubs.reduce((sum, p) => sum + (p.citations || 0), 0)

    const mergedCitesPerYear: Record<string, number> = {}
    selectedPubs.forEach(p => {
      if (!p.cites_per_year) return
      Object.entries(p.cites_per_year).forEach(([yr, count]) => {
        mergedCitesPerYear[yr] = (mergedCitesPerYear[yr] || 0) + (count || 0)
      })
    })

    const updatedMainPub: PublicationDetail = {
      ...mainPub,
      citations: mergedCitations,
      cites_per_year: mergedCitesPerYear
    }

    const updatedPublications = selectedProfile.publications
      .filter(p => !selectedPubIds.includes(String(p.id)))
    
    const mainPubOrigIndex = selectedProfile.publications.findIndex(p => String(p.id) === mergeMainPubId)
    updatedPublications.splice(mainPubOrigIndex >= 0 ? mainPubOrigIndex : 0, 0, updatedMainPub)

    const newTotalCites = updatedPublications.reduce((sum, p) => sum + (p.citations || 0), 0)

    setSelectedProfile({
      ...selectedProfile,
      publications: updatedPublications,
      citedby: newTotalCites
    })

    setIsMergeModalOpen(false)
    setSelectedPubIds([])
    setMergeMainPubId('')
    toast.success('Đã gộp thành công các bài báo nghiên cứu đã chọn!')
  }

  const handleBulkDeleteSelected = () => {
    if (!selectedProfile || selectedPubIds.length === 0) return
    if (window.confirm(`Bạn có chắc muốn chuyển ${selectedPubIds.length} bài báo đã chọn vào thùng rác?`)) {
      const pubsToDelete = selectedProfile.publications.filter(p => selectedPubIds.includes(String(p.id)))
      setDeletedPublications(prev => [...pubsToDelete, ...prev])
      const newPubs = selectedProfile.publications.filter(p => !selectedPubIds.includes(String(p.id)))
      const newTotalCites = newPubs.reduce((sum, p) => sum + (p.citations || 0), 0)
      setSelectedProfile({
        ...selectedProfile,
        publications: newPubs,
        citedby: newTotalCites
      })
      setSelectedPubIds([])
      toast.success(`Đã chuyển ${pubsToDelete.length} bài báo vào thùng rác!`)
    }
  }

  const handleRestorePub = (pub: PublicationDetail) => {
    if (!selectedProfile) return
    setSelectedProfile({
      ...selectedProfile,
      publications: [pub, ...selectedProfile.publications],
      citedby: selectedProfile.citedby + (pub.citations || 0)
    })
    setDeletedPublications(prev => prev.filter(p => String(p.id) !== String(pub.id)))
    toast.success(`Đã khôi phục bài báo thành công!`)
  }

  const handleDeletePermanently = (pubId: string) => {
    if (window.confirm('Bạn có chắc muốn xóa vĩnh viễn bài báo này?')) {
      setDeletedPublications(prev => prev.filter(p => String(p.id) !== String(pubId)))
      toast.success('Đã xóa vĩnh viễn bài báo!')
    }
  }

  const handleEmptyTrash = () => {
    if (deletedPublications.length === 0) return
    if (window.confirm('Bạn có chắc muốn xóa vĩnh viễn toàn bộ bài báo trong thùng rác?')) {
      setDeletedPublications([])
      toast.success('Đã dọn sạch thùng rác!')
    }
  }

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



  // Visual citation trend calculation in ProfileManagerPage
  const authorCitesPerYear = selectedProfile?.cites_per_year || {}
  const officialYears = Object.keys(authorCitesPerYear).filter((y) => /^\d{4}$/.test(y)).sort()

  const citationValues = officialYears.length > 0
    ? officialYears.map((year) => ({ year, count: authorCitesPerYear[year] || 0 }))
    : (selectedProfile?.publications
        ? Array.from(
            new Set(
              selectedProfile.publications
                .flatMap((p) => Object.keys(p.cites_per_year || {}))
                .filter((y) => /^\d{4}$/.test(y))
            )
          ).sort().map((year) => ({
            year,
            count: selectedProfile.publications.reduce((sum, p) => sum + (p.cites_per_year?.[year] || 0), 0)
          }))
        : [])

  const recentCitationValues = citationValues.slice(-8)
  const maxRecentCites = Math.max(...recentCitationValues.map((v) => v.count), 1)

  // Auto scroll all scrollable containers to top when selecting a publication in ProfileManagerPage
  useEffect(() => {
    if (selectedPubId) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      const mainEl = document.querySelector('main')
      if (mainEl) {
        mainEl.scrollTop = 0
      }
      setTimeout(() => {
        document.querySelectorAll('.overflow-y-auto').forEach((el) => {
          el.scrollTop = 0
        })
      }, 0)
    }
  }, [selectedPubId])

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
                const isSelected = selectedProfileId === author.scholar_id || String(selectedProfileId) === String(author.id)
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
              // PAPER DETAIL VIEW
              (() => {
                const selectedPub = selectedProfile.publications?.find((p) => p.id === selectedPubId)
                if (!selectedPub) return null

                return (
                  <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar pr-1">
                    <PublicationDetailPanel
                      publication={selectedPub}
                      authorName={selectedProfile.name}
                      onBack={() => {
                        setSelectedPubId(null)
                      }}
                      onEdit={(pub, e) => openEditPubModal(pub, e)}
                      onDelete={(pubId, e) => handleDeleteSinglePub(pubId, e)}
                    />
                  </div>
                )
              })()
            ) : (
              // DEFAULT AUTHOR PROFILE VIEW - Headers + Shared Publications Table Component
              <div className="flex-1 flex flex-col min-h-0 gap-4 overflow-y-auto animate-in fade-in duration-200">
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
                        {selectedProfile.email_domain ? (
                          <p className="text-xs text-[#005b9a] font-semibold mt-0.5">
                            Email được xác minh tại <span className="underline">{selectedProfile.email_domain.replace(/^@/, '')}</span>
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 mt-0.5 italic">Không có email được xác minh</p>
                        )}
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

                {/* 70/30 Grid Layout: Publication List Table (Left 70%) + Cited By Sidebar Card (Right 30%) */}
                <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
                  
                  {/* LEFT (70% - Columns 7/10) */}
                  <div className="lg:col-span-7 flex flex-col gap-6">
                    <PublicationTableList
                      publications={selectedProfile.publications}
                      selectedPubIds={selectedPubIds}
                      onSelectPub={(pub) => {
                        setSelectedPubId(pub.id)
                        setIsSidebarCollapsed(true)
                      }}
                      onToggleSelectPub={handleToggleSelectPub}
                      onToggleSelectAll={handleToggleSelectAll}
                      onDeselectAll={handleDeselectAll}
                      onAddPub={() => setIsAddPubModalOpen(true)}
                      onOpenTrash={() => setIsTrashModalOpen(true)}
                      onMergePubs={() => setIsMergeModalOpen(true)}
                      onDeleteSelectedPubs={handleBulkDeleteSelected}
                      onExport={() => handleExportCSV(selectedProfile)}
                      searchKeyword={pubKeyword}
                      setSearchKeyword={setPubKeyword}
                      yearFilter={pubYear}
                      setYearFilter={setPubYear}
                      quartileFilter={pubQuartile}
                      setQuartileFilter={setPubQuartile}
                      sortBy="citations_desc"
                      setSortBy={() => {}}
                    />
                  </div>

                  {/* RIGHT (30% - Sidebar Widget matching Scholar tab) */}
                  <div className="lg:col-span-3 flex flex-col gap-6 w-full">
                    <Card className="border-[#E5E7EB] rounded-3xl bg-white p-5 shadow-sm">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Trích dẫn bởi</h3>
                      </div>
                      
                      {/* Metrics comparison table */}
                      <table className="w-full text-left text-[11px] border-collapse mb-5">
                        <thead>
                          <tr className="text-slate-400 font-bold border-b border-slate-100">
                            <th className="py-1"></th>
                            <th className="py-1 text-right w-16">Tất cả</th>
                            <th className="py-1 text-right w-20">Từ 2021</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          <tr>
                            <td className="py-2 font-semibold">Số trích dẫn</td>
                            <td className="py-2 text-right font-bold text-slate-800">{selectedProfile.citedby}</td>
                            <td className="py-2 text-right font-bold text-slate-800">{selectedProfile.citedby5y ?? 0}</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-semibold">Chỉ số h-index</td>
                            <td className="py-2 text-right font-bold text-slate-800">{selectedProfile.hindex}</td>
                            <td className="py-2 text-right font-bold text-slate-800">{selectedProfile.hindex5y ?? 0}</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-semibold">Chỉ số i10-index</td>
                            <td className="py-2 text-right font-bold text-slate-800">{selectedProfile.i10index}</td>
                            <td className="py-2 text-right font-bold text-slate-800">{selectedProfile.i10index5y ?? 0}</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Vertical citation trend bar chart */}
                      {recentCitationValues.length === 0 ? (
                        <div className="flex h-36 items-center justify-center text-xs text-[#64748B] italic">
                          Chưa có lịch sử trích dẫn theo năm.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="relative bg-slate-50/50 border border-slate-100 rounded-2xl p-3 flex justify-center items-center">
                            <svg viewBox="0 0 240 140" className="w-full h-auto overflow-visible">
                              <line x1="10" y1="20" x2="210" y2="20" stroke="#E2E8F0" strokeWidth="0.8" />
                              <line x1="10" y1="70" x2="210" y2="70" stroke="#E2E8F0" strokeWidth="0.8" />
                              <line x1="10" y1="120" x2="210" y2="120" stroke="#94A3B8" strokeWidth="1" />
                              
                              <text x="215" y="24" className="text-[9px] font-semibold fill-slate-500">{maxRecentCites}</text>
                              <text x="215" y="74" className="text-[9px] font-semibold fill-slate-500">{Math.round(maxRecentCites / 2)}</text>
                              <text x="215" y="124" className="text-[9px] font-semibold fill-slate-500">0</text>
                              
                              {recentCitationValues.map((v, i) => {
                                const barWidth = 14
                                const spacing = recentCitationValues.length > 1 ? (190 - barWidth) / (recentCitationValues.length - 1) : 0
                                const x = 15 + i * spacing
                                const barHeight = maxRecentCites > 0 ? (v.count / maxRecentCites) * 100 : 0
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
                                      className="text-[8px] font-bold fill-slate-400"
                                    >
                                      {v.year}
                                    </text>
                                  </g>
                                )
                              })}
                            </svg>
                          </div>
                        </div>
                      )}
                    </Card>
                  </div>

                </div>
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

      {/* ========================================== */}
      {/* DIALOG MODAL: ADD NEW PUBLICATION */}
      {/* ========================================== */}
      {isAddPubModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E7EB] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8FAFC]">
              <h3 className="font-bold text-sm text-[#0F172A] uppercase tracking-wider">Thêm bài báo khoa học mới</h3>
              <button 
                onClick={() => setIsAddPubModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-[#64748B] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddPub} className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                <label className="font-bold text-[#64748B] block">Tên bài báo khoa học *</label>
                <textarea 
                  value={pubForm.title}
                  onChange={(e) => setPubForm({ ...pubForm, title: e.target.value })}
                  required
                  rows={2}
                  placeholder="Nhập đầy đủ tên bài báo..."
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-[#64748B] block">Danh sách tác giả * (Cách nhau bằng dấu phẩy)</label>
                <input 
                  type="text" 
                  value={pubForm.authors_list}
                  onChange={(e) => setPubForm({ ...pubForm, authors_list: e.target.value })}
                  required
                  placeholder="Ví dụ: T Duy Thanh, HT Chi Nhân, ..."
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-[#64748B] block">Nơi xuất bản (Journal / Conference / Venue)</label>
                <input 
                  type="text" 
                  value={pubForm.venue}
                  onChange={(e) => setPubForm({ ...pubForm, venue: e.target.value })}
                  placeholder="Ví dụ: IEEE Transactions on Pattern Analysis..."
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B] block">Năm xuất bản</label>
                  <input 
                    type="text" 
                    value={pubForm.year}
                    onChange={(e) => setPubForm({ ...pubForm, year: e.target.value })}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B] block">Số trích dẫn *</label>
                  <input 
                    type="number" 
                    value={pubForm.citations}
                    onChange={(e) => setPubForm({ ...pubForm, citations: Number(e.target.value) })}
                    required
                    className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B] block">Phân hạng SJR Quartile</label>
                  <select 
                    value={pubForm.sjr_q}
                    onChange={(e) => setPubForm({ ...pubForm, sjr_q: e.target.value })}
                    className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  >
                    <option value="N/A">N/A</option>
                    <option value="Q1">Q1</option>
                    <option value="Q2">Q2</option>
                    <option value="Q3">Q3</option>
                    <option value="Q4">Q4</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B] block">Danh mục Web of Science</label>
                  <input 
                    type="text" 
                    value={pubForm.wos}
                    onChange={(e) => setPubForm({ ...pubForm, wos: e.target.value })}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddPubModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-bold transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold transition-all cursor-pointer"
                >
                  Lưu bài báo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* DIALOG MODAL: TRASH BIN */}
      {/* ========================================== */}
      {isTrashModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E7EB] rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8FAFC]">
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-rose-600" />
                <h3 className="font-bold text-sm text-[#0F172A] uppercase tracking-wider">Thùng rác bài viết đã xóa</h3>
              </div>
              <button 
                onClick={() => setIsTrashModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-[#64748B] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[55vh] overflow-y-auto custom-scrollbar">
              {deletedPublications.length === 0 ? (
                <div className="text-center py-12 text-slate-400 italic text-xs">
                  Thùng rác đang trống.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {deletedPublications.map((pub) => (
                    <div key={pub.id} className="py-3.5 flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 line-clamp-2">{pub.title}</div>
                        <div className="text-[10px] text-slate-400 mt-1 truncate">{pub.authors_list}</div>
                        <div className="text-[10px] text-slate-500 italic mt-0.5">{pub.venue || 'Tạp chí khác'} • {pub.year}</div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleRestorePub(pub)}
                          className="px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] transition-colors cursor-pointer"
                          title="Khôi phục bài báo"
                        >
                          Khôi phục
                        </button>
                        <button
                          onClick={() => handleDeletePermanently(String(pub.id))}
                          className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10px] transition-colors cursor-pointer"
                          title="Xóa vĩnh viễn"
                        >
                          Xóa vĩnh viễn
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#E5E7EB] bg-[#F8FAFC] flex justify-between items-center">
              <button
                disabled={deletedPublications.length === 0}
                onClick={handleEmptyTrash}
                className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:pointer-events-none text-xs font-bold transition-all cursor-pointer"
              >
                Dọn sạch thùng rác
              </button>
              <button
                onClick={() => setIsTrashModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* DIALOG MODAL: MERGE SELECTED PUBLICATIONS */}
      {/* ========================================== */}
      {isMergeModalOpen && selectedProfile && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E7EB] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8FAFC]">
              <h3 className="font-bold text-sm text-[#0F172A] uppercase tracking-wider">Gộp các bài báo đã chọn</h3>
              <button 
                onClick={() => {
                  setIsMergeModalOpen(false)
                  setMergeMainPubId('')
                }}
                className="p-1 rounded-lg hover:bg-slate-100 text-[#64748B] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleMergeConfirm} className="p-6 space-y-4 text-xs">
              <p className="text-slate-500 mb-2 leading-relaxed">
                Chọn bài viết nghiên cứu làm <strong>Bản ghi chính</strong>. Tiêu đề và thông tin của bài viết này sẽ được giữ lại, các bài viết còn lại sẽ được gộp trích dẫn vào bản ghi này và bị xóa khỏi danh sách.
              </p>

              <div className="space-y-3 max-h-[40vh] overflow-y-auto custom-scrollbar p-1">
                {selectedProfile.publications
                  .filter(p => selectedPubIds.includes(String(p.id)))
                  .map(pub => (
                    <label 
                      key={pub.id} 
                      className={cn(
                        "flex gap-3 items-start p-3 rounded-2xl border cursor-pointer transition-all",
                        mergeMainPubId === String(pub.id) 
                          ? "border-[#2563EB] bg-[#DBEAFE]/30" 
                          : "border-[#E5E7EB] hover:bg-slate-50"
                      )}
                    >
                      <input
                        type="radio"
                        name="merge_main_pub"
                        value={String(pub.id)}
                        checked={mergeMainPubId === String(pub.id)}
                        onChange={() => setMergeMainPubId(String(pub.id))}
                        className="mt-0.5 text-[#2563EB] focus:ring-[#2563EB]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 leading-snug">{pub.title}</div>
                        <div className="text-[10px] text-slate-500 mt-1 truncate">{pub.authors_list}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{pub.venue} • {pub.year} • Trích dẫn: <strong className="text-slate-700">{pub.citations}</strong></div>
                      </div>
                    </label>
                  ))}
              </div>

              <div className="pt-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600">Tổng số trích dẫn sau khi gộp:</span>
                <strong className="text-base text-[#2563EB]">
                  {selectedProfile.publications
                    .filter(p => selectedPubIds.includes(String(p.id)))
                    .reduce((sum, p) => sum + (p.citations || 0), 0)}{' '}
                  trích dẫn
                </strong>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsMergeModalOpen(false)
                    setMergeMainPubId('')
                  }}
                  className="px-4 py-2 rounded-xl border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-bold transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={!mergeMainPubId}
                  className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                >
                  Xác nhận gộp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================== */}
      {/* DIALOG MODAL: EDIT PUBLICATION */}
      {/* ========================================== */}
      {isEditPubModalOpen && editingPublication && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E7EB] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8FAFC]">
              <h3 className="font-bold text-sm text-[#0F172A] uppercase tracking-wider">Chỉnh sửa bài báo khoa học</h3>
              <button 
                onClick={() => {
                  setIsEditPubModalOpen(false)
                  setEditingPublication(null)
                }}
                className="p-1 rounded-lg hover:bg-slate-100 text-[#64748B] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEditPub} className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                <label className="font-bold text-[#64748B] block">Tên bài báo khoa học *</label>
                <textarea 
                  value={pubForm.title}
                  onChange={(e) => setPubForm({ ...pubForm, title: e.target.value })}
                  required
                  rows={2}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-[#64748B] block">Danh sách tác giả * (Cách nhau bằng dấu phẩy)</label>
                <input 
                  type="text" 
                  value={pubForm.authors_list}
                  onChange={(e) => setPubForm({ ...pubForm, authors_list: e.target.value })}
                  required
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-[#64748B] block">Nơi xuất bản (Journal / Conference / Venue)</label>
                <input 
                  type="text" 
                  value={pubForm.venue}
                  onChange={(e) => setPubForm({ ...pubForm, venue: e.target.value })}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B] block">Năm xuất bản</label>
                  <input 
                    type="text" 
                    value={pubForm.year}
                    onChange={(e) => setPubForm({ ...pubForm, year: e.target.value })}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B] block">Số trích dẫn *</label>
                  <input 
                    type="number" 
                    value={pubForm.citations}
                    onChange={(e) => setPubForm({ ...pubForm, citations: Number(e.target.value) })}
                    required
                    className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B] block">Phân hạng SJR Quartile</label>
                  <select 
                    value={pubForm.sjr_q}
                    onChange={(e) => setPubForm({ ...pubForm, sjr_q: e.target.value })}
                    className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  >
                    <option value="N/A">N/A</option>
                    <option value="Q1">Q1</option>
                    <option value="Q2">Q2</option>
                    <option value="Q3">Q3</option>
                    <option value="Q4">Q4</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B] block">Danh mục Web of Science</label>
                  <input 
                    type="text" 
                    value={pubForm.wos}
                    onChange={(e) => setPubForm({ ...pubForm, wos: e.target.value })}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditPubModalOpen(false)
                    setEditingPublication(null)
                  }}
                  className="px-4 py-2 rounded-xl border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-bold transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold transition-all cursor-pointer"
                >
                  Cập nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
