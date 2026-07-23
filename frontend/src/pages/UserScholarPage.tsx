import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  GraduationCap,
  ExternalLink,
  User,
  Download,
  Clock,
  Sparkles,
  Trash2,
  X
} from 'lucide-react'
import { useMyProfile } from '@/api/hooks/useUserPortal'
import { scholarApi } from '@/api/endpoints/scholar'
import type { AuthorProfileDetail, PublicationDetail } from '@/api/endpoints/scholar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PublicationDetailPanel } from '@/components/scholar/PublicationDetailPanel'
import { PublicationTableList } from '@/components/scholar/PublicationTableList'

export function UserScholarPage() {
  const navigate = useNavigate()
  const { data: profile, isLoading: isProfileLoading } = useMyProfile()

  const scholarId = useMemo(() => {
    if (profile?.scholar_id) return profile.scholar_id
    if (profile?.scholar_url) {
      const match = profile.scholar_url.match(/user=([a-zA-Z0-9_-]+)/)
      if (match?.[1]) return match[1]
    }
    return null
  }, [profile])

  const scholarExternalUrl = scholarId
    ? `https://scholar.google.com/citations?user=${scholarId}`
    : profile?.scholar_url || 'https://scholar.google.com'

  const isApproved = profile?.status === 'APPROVED' || Boolean(profile?.scholar_id && profile?.status !== 'PENDING')

  // Fetch full AuthorProfileDetail from DRF
  const { data: authorDetail, isLoading: isAuthorLoading } = useQuery<AuthorProfileDetail | null>({
    queryKey: ['user-scholar-author-detail', scholarId],
    queryFn: async () => {
      if (!scholarId) return null
      try {
        const res = await scholarApi.getAuthor(scholarId)
        return res.data
      } catch (e) {
        return null
      }
    },
    enabled: Boolean(scholarId && isApproved),
  })

  // Selected publication for detail view
  const [selectedPubId, setSelectedPubId] = useState<string | null>(null)
  const [selectedPubIds, setSelectedPubIds] = useState<string[]>([])

  // Modals state
  const [isAddPubModalOpen, setIsAddPubModalOpen] = useState(false)
  const [isEditPubModalOpen, setIsEditPubModalOpen] = useState(false)
  const [editingPublication, setEditingPublication] = useState<PublicationDetail | null>(null)
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false)
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false)
  const [mergeMainPubId, setMergeMainPubId] = useState<string>('')

  // Trash Bin State
  const [deletedPublications, setDeletedPublications] = useState<PublicationDetail[]>(() => {
    const saved = localStorage.getItem('user_deletedPublications')
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    localStorage.setItem('user_deletedPublications', JSON.stringify(deletedPublications))
  }, [deletedPublications])

  // Custom Local Publications Override
  const [customPublications, setCustomPublications] = useState<PublicationDetail[]>([])

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

  // Filters state for PublicationTableList
  const [pubKeyword, setPubKeyword] = useState('')
  const [pubQuartile, setPubQuartile] = useState<string>('all')
  const [pubYear, setPubYear] = useState<string>('all')

  // Construct active profile object
  const activeProfile: AuthorProfileDetail | null = useMemo(() => {
    let base: AuthorProfileDetail | null = null
    if (authorDetail) base = { ...authorDetail }
    else if (profile?.author_detail) base = { ...profile.author_detail }
    else if (profile && isApproved) {
      base = {
        id: profile.id || 'my_profile',
        scholar_id: scholarId || 'unknown',
        name: profile.user_email?.split('@')[0] || 'Nghiên cứu viên',
        affiliation: '',
        email_domain: '',
        interests: [],
        citedby: profile.total_citations || 0,
        citedby5y: 0,
        hindex: profile.h_index || 0,
        hindex5y: 0,
        i10index: profile.i10_index || 0,
        i10index5y: 0,
        cites_per_year: {},
        publications: (profile.publications || []).map((p: any) => ({
          id: p.id,
          title: p.title || '',
          authors_list: p.authors || p.authors_list || '',
          venue: p.journal || p.venue || '',
          year: String(p.pub_year || p.year || 'N/A'),
          citations: p.citations || 0,
          display_order: 1,
          cites_per_year: p.cites_per_year || {},
          journal: null,
          sjr_q: p.sjr_q || 'N/A',
          if_val: p.if_val || 'N/A',
          wos: p.wos || 'N/A',
          pub_url: p.url || p.pub_url || undefined
        })),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }

    if (!base) return null

    // Merge custom publications if added locally
    let allPubs = [...customPublications, ...(base.publications || [])]
    const deletedIds = deletedPublications.map(d => String(d.id))
    allPubs = allPubs.filter(p => !deletedIds.includes(String(p.id)))

    return {
      ...base,
      publications: allPubs,
      citedby: allPubs.reduce((sum, p) => sum + (p.citations || 0), 0)
    }
  }, [authorDetail, profile, scholarId, isApproved, customPublications, deletedPublications])

  // Citation graph calculation
  const authorCitesPerYear = activeProfile?.cites_per_year || {}
  const officialYears = Object.keys(authorCitesPerYear).filter((y) => /^\d{4}$/.test(y)).sort()

  const citationValues = officialYears.length > 0
    ? officialYears.map((year) => ({ year, count: authorCitesPerYear[year] || 0 }))
    : (activeProfile?.publications
        ? Array.from(
            new Set(
              activeProfile.publications
                .flatMap((p) => Object.keys(p.cites_per_year || {}))
                .filter((y) => /^\d{4}$/.test(y))
            )
          ).sort().map((year) => ({
            year,
            count: activeProfile.publications.reduce((sum, p) => sum + (p.cites_per_year?.[year] || 0), 0)
          }))
        : [])

  const recentCitationValues = citationValues.slice(-8)
  const maxRecentCites = Math.max(...recentCitationValues.map((v) => v.count), 1)

  // Handlers for Add / Delete / Merge
  const handleAddPub = (e: React.FormEvent) => {
    e.preventDefault()
    const newPub: PublicationDetail = {
      id: `custom_${Date.now()}`,
      title: pubForm.title,
      authors_list: pubForm.authors_list,
      venue: pubForm.venue,
      year: pubForm.year,
      citations: Number(pubForm.citations),
      display_order: 1,
      cites_per_year: {},
      journal: null,
      sjr_q: pubForm.sjr_q,
      if_val: pubForm.if_val,
      wos: pubForm.wos
    }
    setCustomPublications(prev => [newPub, ...prev])
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
    if (!activeProfile) return
    if (window.confirm('Bạn có chắc muốn xóa bài báo này và chuyển vào thùng rác?')) {
      const pubToDelete = activeProfile.publications?.find(p => String(p.id) === String(pubId))
      if (pubToDelete) {
        setDeletedPublications(prev => [pubToDelete, ...prev])
        setSelectedPubId(null)
        toast.success('Đã chuyển bài báo vào thùng rác!')
      }
    }
  }

  const handleBulkDeleteSelected = () => {
    if (!activeProfile || selectedPubIds.length === 0) return
    if (window.confirm(`Bạn có chắc muốn chuyển ${selectedPubIds.length} bài báo đã chọn vào thùng rác?`)) {
      const pubsToDelete = activeProfile.publications.filter(p => selectedPubIds.includes(String(p.id)))
      setDeletedPublications(prev => [...pubsToDelete, ...prev])
      setSelectedPubIds([])
      toast.success(`Đã chuyển ${pubsToDelete.length} bài báo vào thùng rác!`)
    }
  }

  const handleMergeConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeProfile || selectedPubIds.length < 2 || !mergeMainPubId) return
    const selectedPubs = activeProfile.publications.filter(p => selectedPubIds.includes(String(p.id)))
    const mainPub = selectedPubs.find(p => String(p.id) === mergeMainPubId)
    if (!mainPub) return

    const mergedCitations = selectedPubs.reduce((sum, p) => sum + (p.citations || 0), 0)
    const otherPubs = selectedPubs.filter(p => String(p.id) !== mergeMainPubId)

    // Move merged duplicate papers to trash
    setDeletedPublications(prev => [...otherPubs, ...prev])
    
    // Update main pub in customPublications
    const updatedMainPub: PublicationDetail = {
      ...mainPub,
      citations: mergedCitations
    }
    setCustomPublications(prev => [updatedMainPub, ...prev.filter(p => !selectedPubIds.includes(String(p.id)))])

    setIsMergeModalOpen(false)
    setSelectedPubIds([])
    setMergeMainPubId('')
    toast.success('Đã gộp thành công các bài báo nghiên cứu đã chọn!')
  }

  const handleRestorePub = (pub: PublicationDetail) => {
    setDeletedPublications(prev => prev.filter(p => String(p.id) !== String(pub.id)))
    toast.success('Đã khôi phục bài báo thành công!')
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
    if (!editingPublication) return
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
    setCustomPublications(prev => [updatedPub, ...prev.filter(p => String(p.id) !== String(editingPublication.id))])
    setIsEditPubModalOpen(false)
    setEditingPublication(null)
    toast.success('Cập nhật thông tin bài báo thành công!')
  }

  // Export CSV helper
  const handleExportCSV = (profileData: AuthorProfileDetail) => {
    if (!profileData.publications || profileData.publications.length === 0) {
      toast.warning('Không có bài báo nào để xuất bản ghi.')
      return
    }

    const headers = ['STT', 'Tên bài báo', 'Tác giả', 'Nơi xuất bản (Venue)', 'Năm', 'Trích dẫn', 'SJR Q', 'Impact Factor', 'WoS Indexing']
    const csvRows = [headers.join(',')]

    profileData.publications.forEach((pub, idx) => {
      const row = [
        idx + 1,
        `"${pub.title.replace(/"/g, '""')}"`,
        `"${pub.authors_list.replace(/"/g, '""')}"`,
        `"${pub.venue.replace(/"/g, '""')}"`,
        pub.year,
        pub.citations,
        pub.sjr_q || 'N/A',
        pub.if_val || 'N/A',
        `"${(pub.wos || 'N/A').replace(/"/g, '""')}"`
      ]
      csvRows.push(row.join(','))
    })

    const csvContent = '\ufeff' + csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `profile_${profileData.name.replace(/\s+/g, '_')}_export.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Đã xuất báo cáo CSV cho tác giả ${profileData.name}`)
  }

  const handleToggleSelectPub = (pubId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    const strId = String(pubId)
    setSelectedPubIds(prev =>
      prev.includes(strId) ? prev.filter(id => id !== strId) : [...prev, strId]
    )
  }

  const handleDeselectAll = () => setSelectedPubIds([])

  const handleToggleSelectAll = () => {
    if (!activeProfile || !activeProfile.publications) return
    const allIds = activeProfile.publications.map(p => String(p.id))
    const isAllSelected = allIds.length > 0 && allIds.every(id => selectedPubIds.includes(id))
    setSelectedPubIds(isAllSelected ? [] : allIds)
  }

  const isLoading = isProfileLoading || (isApproved && isAuthorLoading)

  if (isLoading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Spinner className="h-8 w-8 text-[#005b9a]" />
          <span className="text-sm font-medium">Đang tải phân tích & bài báo Scholar...</span>
        </div>
      </div>
    )
  }

  // Empty State if user hasn't submitted a Scholar URL or status is not APPROVED
  if (!profile || !isApproved || (!profile.scholar_url && !profile.scholar_id)) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 pb-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Hồ Sơ Google Scholar Chi Tiết
            </h1>
            <p className="text-sm text-slate-500">
              Theo dõi danh sách bài báo, lượt trích dẫn và các chỉ số xếp hạng công trình khoa học
            </p>
          </div>
          <a
            href={scholarExternalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#005b9a] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#00487a] transition-colors shadow-xs"
          >
            <ExternalLink className="h-4 w-4" />
            Mở trang Google Scholar gốc ↗
          </a>
        </div>

        <Card className="overflow-hidden border border-slate-200 bg-white p-8 sm:p-12 text-center shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-[#005b9a] shadow-xs mb-4">
            {profile?.status === 'PENDING' ? (
              <Clock className="h-8 w-8 text-amber-600 animate-pulse" />
            ) : (
              <GraduationCap className="h-8 w-8 text-[#005b9a]" />
            )}
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-2">
            {profile?.status === 'PENDING'
              ? 'Hồ sơ Google Scholar đang được xử lý'
              : 'Chưa có dữ liệu Google Scholar'}
          </h2>

          <p className="max-w-md mx-auto text-sm text-slate-500 leading-relaxed mb-6">
            {profile?.status === 'PENDING' ? (
              <>
                Yêu cầu kết nối link Google Scholar <span className="font-mono text-slate-700 font-semibold">{profile.scholar_url}</span> của bạn đang được Quản trị viên xem xét. Dữ liệu phân tích và danh sách bài báo sẽ tự động xuất hiện tại đây ngay khi yêu cầu được phê duyệt.
              </>
            ) : (
              <>
                Dữ liệu Google Scholar và phân tích trích dẫn sẽ tự động hiển thị sau khi bạn kết nối tài khoản Google Scholar và được Quản trị viên phê duyệt.
              </>
            )}
          </p>

          <div className="flex justify-center">
            <Button
              onClick={() => navigate('/user/edit-profile')}
              className="bg-[#005b9a] hover:bg-[#00487a] text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-xs cursor-pointer gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Gửi Link Google Scholar Ngay
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (!activeProfile) return null

  // Detailed Publication View
  if (selectedPubId) {
    const selectedPub = activeProfile.publications?.find((p) => String(p.id) === String(selectedPubId))
    if (selectedPub) {
      return (
        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar pr-1">
          <PublicationDetailPanel
            publication={selectedPub}
            authorName={activeProfile.name}
            onBack={() => setSelectedPubId(null)}
            onEdit={(pub, e) => openEditPubModal(pub, e)}
            onDelete={(pubId, e) => handleDeleteSinglePub(pubId, e)}
          />
        </div>
      )
    }
  }

  // 70/30 Rich Profile Layout matching ProfileManagerPage
  return (
    <div className="flex-1 flex flex-col min-h-0 gap-4 overflow-y-auto animate-in fade-in duration-200 pb-8">
      {/* Author Header Banner Card */}
      <Card className="border-slate-200 bg-white p-4 shrink-0 shadow-xs">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e6f0f7] text-[#005b9a] font-bold text-lg shrink-0">
              <User className="h-5 w-5" />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <h2 className="text-sm font-bold text-slate-800 line-clamp-1">{activeProfile.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5 italic line-clamp-1">{activeProfile.affiliation || 'Không có cơ quan công tác'}</p>
              {activeProfile.email_domain ? (
                <p className="text-xs text-[#005b9a] font-semibold mt-0.5">
                  Email được xác minh tại <span className="underline">{activeProfile.email_domain.replace(/^@/, '')}</span>
                </p>
              ) : (
                <p className="text-xs text-slate-400 mt-0.5 italic">Không có email được xác minh</p>
              )}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {activeProfile.interests?.slice(0, 5).map((interest, i) => (
                  <span key={i} className="text-[9px] font-bold bg-[#e6f0f7] text-[#005b9a] rounded px-2 py-0.5">
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-center flex-wrap">
            <div className="flex flex-col items-center bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-center min-w-[70px]">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">CITATIONS</span>
              <span className="text-xs font-bold text-[#005b9a] mt-0.5">{activeProfile.citedby}</span>
            </div>
            <div className="flex flex-col items-center bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-center min-w-[70px]">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">H-INDEX</span>
              <span className="text-xs font-bold text-slate-800 mt-0.5">{activeProfile.hindex}</span>
            </div>
            <div className="flex flex-col items-center bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-center min-w-[70px]">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">I10-INDEX</span>
              <span className="text-xs font-bold text-slate-800 mt-0.5">{activeProfile.i10index}</span>
            </div>

            <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block"></div>

            {/* Action Buttons */}
            <button
              onClick={() => handleExportCSV(activeProfile)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition-colors shadow-3xs"
              title="Xuất báo cáo CSV / Excel"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Xuất Excel</span>
            </button>

            <a
              href={scholarExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#005b9a] hover:bg-[#00487a] text-white font-bold text-xs cursor-pointer transition-colors shadow-3xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Mở trang Google Scholar gốc ↗</span>
            </a>
          </div>
        </div>
      </Card>

      {/* 70/30 Grid Layout: Publication List Table (Left 70%) + Cited By Sidebar Card (Right 30%) */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
        {/* LEFT (70% - Columns 7/10) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <PublicationTableList
            publications={activeProfile.publications}
            selectedPubIds={selectedPubIds}
            onSelectPub={(pub) => setSelectedPubId(String(pub.id))}
            onToggleSelectPub={handleToggleSelectPub}
            onToggleSelectAll={handleToggleSelectAll}
            onDeselectAll={handleDeselectAll}
            onAddPub={() => setIsAddPubModalOpen(true)}
            onOpenTrash={() => setIsTrashModalOpen(true)}
            onMergePubs={() => setIsMergeModalOpen(true)}
            onDeleteSelectedPubs={handleBulkDeleteSelected}
            onExport={() => handleExportCSV(activeProfile)}
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

        {/* RIGHT (30% - Sidebar Widget with Citation Table & Histogram Bar Chart) */}
        <div className="lg:col-span-3 flex flex-col gap-6 w-full">
          <Card className="border-[#E5E7EB] rounded-3xl bg-white p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">TRÍCH DẪN BỞI</h3>
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
                  <td className="py-2 text-right font-bold text-slate-800">{activeProfile.citedby}</td>
                  <td className="py-2 text-right font-bold text-slate-800">{activeProfile.citedby5y ?? 0}</td>
                </tr>
                <tr>
                  <td className="py-2 font-semibold">Chỉ số h-index</td>
                  <td className="py-2 text-right font-bold text-slate-800">{activeProfile.hindex}</td>
                  <td className="py-2 text-right font-bold text-slate-800">{activeProfile.hindex5y ?? 0}</td>
                </tr>
                <tr>
                  <td className="py-2 font-semibold">Chỉ số i10-index</td>
                  <td className="py-2 text-right font-bold text-slate-800">{activeProfile.i10index}</td>
                  <td className="py-2 text-right font-bold text-slate-800">{activeProfile.i10index5y ?? 0}</td>
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

      {/* DIALOG MODAL: ADD NEW PUBLICATION */}
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

      {/* DIALOG MODAL: TRASH BIN */}
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

      {/* DIALOG MODAL: MERGE SELECTED PUBLICATIONS */}
      {isMergeModalOpen && activeProfile && (
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
                {activeProfile.publications
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
                  {activeProfile.publications
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

      {/* DIALOG MODAL: EDIT PUBLICATION */}
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


