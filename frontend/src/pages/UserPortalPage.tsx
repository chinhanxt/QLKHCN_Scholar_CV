import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  KeyRound,
  Plus,
  Trash2,
  FileText,
} from 'lucide-react'
import { useMyProfile, useSubmitScholarProfile } from '@/api/hooks/useUserPortal'
import type { PublicationDetail } from '@/api/endpoints/scholar'
import { getApiErrorMessage } from '@/lib/api-error'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Dialog } from '@/components/ui/dialog'
import { PublicationTableList } from '@/components/scholar/PublicationTableList'
import { PublicationDetailPanel } from '@/components/scholar/PublicationDetailPanel'
import { ScholarGuide } from '@/components/ScholarGuide'

const submitSchema = z.object({
  scholar_url: z
    .string()
    .min(1, 'Vui lòng nhập đường dẫn Google Scholar')
    .url('Đường dẫn không hợp lệ')
    .refine((url) => url.toLowerCase().includes('scholar.google'), {
      message: 'Đường dẫn phải thuộc miền scholar.google.com',
    }),
})

type SubmitValues = z.infer<typeof submitSchema>

export function UserPortalPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as 'profile' | 'submit' | 'settings') || 'profile'

  const setActiveTab = (tab: 'profile' | 'submit' | 'settings') => {
    setSearchParams({ tab })
  }

  const { data: profile, isLoading } = useMyProfile()
  const submitProfile = useSubmitScholarProfile()
  const [isEditingScholarUrl, setIsEditingScholarUrl] = useState(false)

  // Interactive UI State for Profile Tab
  const [selectedPublication, setSelectedPublication] = useState<PublicationDetail | null>(null)

  // Automatically scroll all scrollable containers to top when selecting a publication (matches Admin behavior)
  useEffect(() => {
    if (selectedPublication) {
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
  }, [selectedPublication])

  const [pubSearch, setPubSearch] = useState('')
  const [yearFilter, setYearFilter] = useState('All')
  const [quartileFilter, setQuartileFilter] = useState('all')
  const [sortBy, setSortBy] = useState('citations_desc')
  const [selectedPubIds, setSelectedPubIds] = useState<string[]>([])

  // Trash & Custom Publications State
  const [customPublications, setCustomPublications] = useState<PublicationDetail[]>([])
  const [deletedPublications, setDeletedPublications] = useState<PublicationDetail[]>([])

  // Modal Dialog States
  const [isAddPubModalOpen, setIsAddPubModalOpen] = useState(false)
  const [isEditPubModalOpen, setIsEditPubModalOpen] = useState(false)
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false)
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false)
  const [editingPub, setEditingPub] = useState<PublicationDetail | null>(null)

  // Forms
  const [addPubForm, setAddPubForm] = useState({
    title: '',
    authors: '',
    venue: '',
    year: new Date().getFullYear().toString(),
    citations: '0',
  })

  const [editPubForm, setEditPubForm] = useState({
    title: '',
    authors: '',
    venue: '',
    year: '',
    citations: '0',
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SubmitValues>({
    resolver: zodResolver(submitSchema),
    values: profile ? { scholar_url: profile.scholar_url || '' } : undefined,
  })

  const onSubmitScholarUrl = (values: SubmitValues) => {
    submitProfile.mutate(values, {
      onSuccess: () => {
        toast.success(
          profile?.status === 'APPROVED' || profile?.scholar_url
            ? 'Đã gửi yêu cầu cập nhật hồ sơ Google Scholar thành công!'
            : 'Đã gửi thông tin liên kết Google Scholar thành công!'
        )
        setIsEditingScholarUrl(false)
        setActiveTab('submit')
      },
      onError: (err) => toast.error(getApiErrorMessage(err, 'Gửi thông tin thất bại')),
    })
  }

  // Combine publications list
  const authorDetail = profile?.author_detail
  const rawPubs: PublicationDetail[] =
    authorDetail?.publications && authorDetail.publications.length > 0
      ? (authorDetail.publications as unknown as PublicationDetail[])
      : (profile?.publications || []).map((p, idx) => ({
          id: String(p.id),
          title: p.title,
          authors_list: p.authors,
          venue: p.journal,
          year: p.pub_year ? String(p.pub_year) : '',
          citations: p.citations || 0,
          pub_url: p.url,
          sjr_q: 'N/A',
          if_val: 'N/A',
          wos: 'N/A',
          display_order: idx + 1,
          cites_per_year: {},
          journal: null,
        }))

  const deletedIds = deletedPublications.map((p) => p.id)
  const publicationsList: PublicationDetail[] = [...rawPubs, ...customPublications].filter(
    (p) => !deletedIds.includes(p.id)
  )

  // Multi-selection handlers
  const handleToggleSelect = (pubId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    setSelectedPubIds((prev) =>
      prev.includes(pubId) ? prev.filter((id) => id !== pubId) : [...prev, pubId]
    )
  }

  const handleToggleSelectAll = () => {
    if (selectedPubIds.length === publicationsList.length) {
      setSelectedPubIds([])
    } else {
      setSelectedPubIds(publicationsList.map((p) => p.id))
    }
  }

  const handleDeselectAll = () => {
    setSelectedPubIds([])
  }

  // Action handlers
  const handleAddPublicationSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!addPubForm.title.trim()) {
      toast.error('Vui lòng nhập tên bài báo!')
      return
    }

    const newPub: PublicationDetail = {
      id: `custom_${Date.now()}`,
      title: addPubForm.title.trim(),
      authors_list: addPubForm.authors.trim(),
      venue: addPubForm.venue.trim(),
      year: addPubForm.year.trim(),
      citations: parseInt(addPubForm.citations, 10) || 0,
      pub_url: '',
      sjr_q: 'N/A',
      if_val: 'N/A',
      wos: 'N/A',
      display_order: publicationsList.length + 1,
      cites_per_year: {},
      journal: null,
    }

    setCustomPublications((prev) => [newPub, ...prev])
    setIsAddPubModalOpen(false)
    setAddPubForm({
      title: '',
      authors: '',
      venue: '',
      year: new Date().getFullYear().toString(),
      citations: '0',
    })
    toast.success('Đã thêm bài báo mới thành công!')
  }

  const openEditPubModal = (pub: PublicationDetail) => {
    setEditingPub(pub)
    setEditPubForm({
      title: pub.title || '',
      authors: pub.authors_list || '',
      venue: pub.venue || '',
      year: pub.year || '',
      citations: String(pub.citations || 0),
    })
    setIsEditPubModalOpen(true)
  }

  const handleEditPubSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPub) return

    const updated: PublicationDetail = {
      ...editingPub,
      title: editPubForm.title.trim(),
      authors_list: editPubForm.authors.trim(),
      venue: editPubForm.venue.trim(),
      year: editPubForm.year.trim(),
      citations: parseInt(editPubForm.citations, 10) || 0,
    }

    setCustomPublications((prev) =>
      prev.some((p) => p.id === editingPub.id)
        ? prev.map((p) => (p.id === editingPub.id ? updated : p))
        : [updated, ...prev]
    )

    if (selectedPublication?.id === editingPub.id) {
      setSelectedPublication(updated)
    }

    setIsEditPubModalOpen(false)
    setEditingPub(null)
    toast.success('Đã cập nhật bài báo thành công!')
  }

  const handleDeletePub = (pubId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const target = publicationsList.find((p) => p.id === pubId)
    if (target) {
      setDeletedPublications((prev) => [target, ...prev])
      setSelectedPubIds((prev) => prev.filter((id) => id !== pubId))
      if (selectedPublication?.id === pubId) {
        setSelectedPublication(null)
      }
      toast.success('Đã chuyển bài báo vào thùng rác!')
    }
  }

  const handleBulkDeleteSelected = () => {
    if (selectedPubIds.length === 0) return
    const targets = publicationsList.filter((p) => selectedPubIds.includes(p.id))
    setDeletedPublications((prev) => [...targets, ...prev])
    setSelectedPubIds([])
    toast.success(`Đã chuyển ${targets.length} bài báo vào thùng rác!`)
  }

  const handleRestoreFromTrash = (pubId: string) => {
    setDeletedPublications((prev) => prev.filter((p) => p.id !== pubId))
    toast.success('Đã khôi phục bài báo thành công!')
  }

  const handleMergePubsSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedPubIds.length < 2) {
      toast.error('Vui lòng chọn từ 2 bài báo trở lên để gộp!')
      return
    }

    const mainPub = publicationsList.find((p) => p.id === selectedPubIds[0])
    if (!mainPub) return

    const otherPubs = publicationsList.filter((p) => selectedPubIds.includes(p.id) && p.id !== mainPub.id)
    const extraCitations = otherPubs.reduce((sum, p) => sum + (p.citations || 0), 0)

    const merged: PublicationDetail = {
      ...mainPub,
      citations: (mainPub.citations || 0) + extraCitations,
    }

    setCustomPublications((prev) =>
      prev.some((p) => p.id === mainPub.id)
        ? prev.map((p) => (p.id === mainPub.id ? merged : p))
        : [merged, ...prev]
    )

    setDeletedPublications((prev) => [...otherPubs, ...prev])
    setSelectedPubIds([])
    setIsMergeModalOpen(false)
    toast.success(`Đã gộp thành công ${selectedPubIds.length} bài báo!`)
  }

  // Export Excel handler
  const handleExport = async () => {
    if (!publicationsList || publicationsList.length === 0) {
      toast.error('Không có dữ liệu bài báo để xuất báo cáo!')
      return
    }

    try {
      const isSelectiveExport = selectedPubIds.length > 0
      const pubsToExport = isSelectiveExport
        ? publicationsList.filter((p) => selectedPubIds.includes(p.id))
        : publicationsList

      toast.info(
        isSelectiveExport
          ? `Đang xuất ${pubsToExport.length} bài báo đã chọn...`
          : 'Đang tạo file Excel (.xlsx) chuyên nghiệp...'
      )
      const ExcelJSModule = await import('exceljs')
      const Workbook =
        ExcelJSModule.Workbook ||
        (ExcelJSModule as unknown as { default: { Workbook: typeof ExcelJSModule.Workbook } }).default?.Workbook ||
        (ExcelJSModule as unknown as { default: typeof ExcelJSModule.Workbook }).default
      const workbook = new Workbook()

      const sheet1 = workbook.addWorksheet('Tổng quan')
      sheet1.views = [{ showGridLines: true }]
      sheet1.columns = [
        { key: 'A', width: 35 },
        { key: 'B', width: 45 },
        { key: 'C', width: 15 },
        { key: 'D', width: 15 },
      ]

      sheet1.mergeCells('A1:D2')
      const banner = sheet1.getCell('A1')
      banner.value = isSelectiveExport
        ? `BÁO CÁO HỒ SƠ TÁC GIẢ - XUẤT LỰA CHỌN (${pubsToExport.length} BÀI)`
        : 'BÁO CÁO HỒ SƠ TÁC GIẢ KHOA HỌC (GOOGLE SCHOLAR)'
      banner.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
      banner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
      banner.alignment = { vertical: 'middle', horizontal: 'center' }

      sheet1.getCell('A4').value = 'I. THÔNG TIN CHUNG TÁC GIẢ'
      sheet1.getCell('A4').font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF2563EB' } }
      sheet1.mergeCells('A4:D4')

      const authorName = authorDetail?.name || profile?.user_email || 'Hồ sơ Tác giả'
      const infoFields = [
        ['Họ và tên tác giả', authorName],
        ['Cơ quan công tác', authorDetail?.affiliation || 'Mục liên kết không xác định'],
        ['Tổng số trích dẫn', authorDetail?.citedby || profile?.total_citations || 0],
        ['Chỉ số H-index', authorDetail?.hindex || profile?.h_index || 0],
        ['Chỉ số i10-index', authorDetail?.i10index || profile?.i10_index || 0],
      ]

      infoFields.forEach((row, idx) => {
        const rIdx = 5 + idx
        sheet1.getCell(`A${rIdx}`).value = row[0]
        sheet1.getCell(`A${rIdx}`).font = { bold: true }
        sheet1.getCell(`B${rIdx}`).value = row[1]
      })

      sheet1.getCell('A12').value = 'II. DANH SÁCH BÀI BÁO KHOA HỌC'
      sheet1.getCell('A12').font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF2563EB' } }

      const headers = ['STT', 'Tên bài báo', 'Tác giả', 'Năm', 'Trích dẫn', 'Tạp chí / Nơi XB']
      headers.forEach((h, i) => {
        const col = String.fromCharCode(65 + i)
        const cell = sheet1.getCell(`${col}14`)
        cell.value = h
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }
      })

      pubsToExport.forEach((pub, i) => {
        const rIdx = 15 + i
        sheet1.getCell(`A${rIdx}`).value = i + 1
        sheet1.getCell(`B${rIdx}`).value = pub.title
        sheet1.getCell(`C${rIdx}`).value = pub.authors_list
        sheet1.getCell(`D${rIdx}`).value = pub.year || '-'
        sheet1.getCell(`E${rIdx}`).value = pub.citations || 0
        sheet1.getCell(`F${rIdx}`).value = pub.venue || '-'
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `GoogleScholar_Profile_${authorName.replace(/\s+/g, '_')}.xlsx`
      anchor.click()
      window.URL.revokeObjectURL(url)
      toast.success('Đã xuất báo cáo Excel thành công!')
    } catch {
      toast.error('Lỗi khi xuất file Excel!')
    }
  }

  // Citation bar chart calculation (Fallback to aggregated publication citations if cites_per_year is empty)
  const rawCitesMap = authorDetail?.cites_per_year || {}
  const citesMap: Record<string, number> = { ...rawCitesMap }
  if (Object.keys(citesMap).length === 0) {
    publicationsList.forEach((pub) => {
      const yr = pub.year?.trim()
      if (yr && /^\d{4}$/.test(yr)) {
        citesMap[yr] = (citesMap[yr] || 0) + (pub.citations || 0)
      }
    })
  }

  const currentYear = new Date().getFullYear()
  const recentYears = Array.from({ length: 8 }, (_, i) => currentYear - 7 + i)
  const recentCitationValues = recentYears.map((yr) => ({
    year: yr,
    count: citesMap[String(yr)] || citesMap[yr] || 0,
  }))
  const maxRecentCites = Math.max(...recentCitationValues.map((v) => v.count), 1)

  // 5-Year Metrics (From 2021) Calculation Fallback
  const start5y = 2021
  const pubs5y = publicationsList.filter((p) => p.year && parseInt(p.year, 10) >= start5y)
  const citedby5yCalculated = pubs5y.reduce((sum, p) => sum + (p.citations || 0), 0)
  const citedby5y = authorDetail?.citedby5y ? authorDetail.citedby5y : citedby5yCalculated

  const cites5yArr = pubs5y.map((p) => p.citations || 0).sort((a, b) => b - a)
  let h5y = 0
  for (let i = 0; i < cites5yArr.length; i++) {
    if (cites5yArr[i] >= i + 1) h5y = i + 1
    else break
  }
  const hindex5y = authorDetail?.hindex5y ? authorDetail.hindex5y : h5y
  const i10index5y = authorDetail?.i10index5y
    ? authorDetail.i10index5y
    : pubs5y.filter((p) => (p.citations || 0) >= 10).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500 text-sm">
        <Spinner className="mr-2 h-5 w-5 text-blue-600" /> Đang tải thông tin hồ sơ...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tab 1: Scholar Profile & CV */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {profile?.status === 'APPROVED' ? (
            <div className="flex flex-col gap-6">
              {/* Profile Header Banner */}
              <Card className="border-[#E5E7EB] rounded-3xl shadow-sm bg-white overflow-hidden p-6 relative">
                <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6">
                  {/* Circular avatar containing GraduationCap icon */}
                  <div className="relative shrink-0">
                    <div className="h-28 w-28 rounded-full border-4 border-[#DBEAFE] bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden shadow-sm">
                      <GraduationCap className="h-14 w-14 text-slate-500" />
                    </div>
                  </div>

                  {/* Author Details Info */}
                  <div className="flex-1 flex flex-col justify-center min-w-0">
                    <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap">
                      <h1 className="text-2xl font-bold text-[#0F172A] truncate">
                        {authorDetail?.name || profile.user_email || 'Hồ sơ Tác giả'}
                      </h1>
                    </div>

                    <p className="text-sm font-semibold text-slate-700 mt-1.5">
                      {authorDetail?.affiliation && authorDetail.affiliation !== 'Unknown affiliation'
                        ? authorDetail.affiliation
                        : 'Mục liên kết không xác định'}
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      {authorDetail?.email_domain
                        ? `Email được xác minh tại ${authorDetail.email_domain.replace(/^@/, '')}`
                        : profile.user_email
                        ? `Email được xác minh tại ${profile.user_email.split('@')[1]}`
                        : 'Không có email được xác minh'}
                    </p>

                    <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 mt-3">
                      {authorDetail?.interests &&
                        authorDetail.interests.map((int, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-bold bg-[#F8FAFC] text-slate-650 border border-[#E5E7EB] rounded-lg px-2.5 py-0.5"
                          >
                            {int}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Main Content Layout (Split 70/30) */}
              <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
                {/* LEFT (70% in list view, 100% in detail view) */}
                <div
                  className={
                    selectedPublication
                      ? 'lg:col-span-10 flex flex-col gap-6'
                      : 'lg:col-span-7 flex flex-col gap-6'
                  }
                >
                  {selectedPublication ? (
                    <PublicationDetailPanel
                      publication={selectedPublication}
                      authorName={authorDetail?.name || profile.user_email || ''}
                      onBack={() => setSelectedPublication(null)}
                      onEdit={(pub) => openEditPubModal(pub)}
                      onDelete={(pubId) => handleDeletePub(pubId)}
                    />
                  ) : (
                    <PublicationTableList
                      publications={publicationsList}
                      selectedPubIds={selectedPubIds}
                      onSelectPub={(pub) => setSelectedPublication(pub)}
                      onToggleSelectPub={handleToggleSelect}
                      onToggleSelectAll={handleToggleSelectAll}
                      onDeselectAll={handleDeselectAll}
                      onAddPub={() => setIsAddPubModalOpen(true)}
                      onOpenTrash={() => setIsTrashModalOpen(true)}
                      onMergePubs={() => setIsMergeModalOpen(true)}
                      onDeleteSelectedPubs={handleBulkDeleteSelected}
                      onExport={handleExport}
                      searchKeyword={pubSearch}
                      setSearchKeyword={setPubSearch}
                      yearFilter={yearFilter}
                      setYearFilter={setYearFilter}
                      quartileFilter={quartileFilter}
                      setQuartileFilter={setQuartileFilter}
                      sortBy={sortBy}
                      setSortBy={setSortBy}
                    />
                  )}
                </div>

                {/* RIGHT (30% Sidebar Widget: Cited by Table + Citation Trend Chart) */}
                {!selectedPublication && (
                  <div className="lg:col-span-3 flex flex-col gap-6 w-full">
                    <Card className="border-[#E5E7EB] rounded-3xl bg-white p-5 shadow-sm">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Trích dẫn bởi
                        </h3>
                      </div>

                      {/* Metrics Comparison Table */}
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
                            <td className="py-2 text-right font-bold text-slate-800">
                              {authorDetail?.citedby || profile.total_citations}
                            </td>
                            <td className="py-2 text-right font-bold text-slate-800">{citedby5y}</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-semibold">Chỉ số h-index</td>
                            <td className="py-2 text-right font-bold text-slate-800">
                              {authorDetail?.hindex || profile.h_index}
                            </td>
                            <td className="py-2 text-right font-bold text-slate-800">{hindex5y}</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-semibold">Chỉ số i10-index</td>
                            <td className="py-2 text-right font-bold text-slate-800">
                              {authorDetail?.i10index || profile.i10_index}
                            </td>
                            <td className="py-2 text-right font-bold text-slate-800">{i10index5y}</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Annual Citation Trend Bar Chart */}
                      {recentCitationValues.length === 0 ? (
                        <div className="flex h-36 items-center justify-center text-xs text-[#64748B] italic">
                          Chưa có lịch sử trích dẫn theo năm.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="relative bg-slate-50/50 border border-slate-100 rounded-2xl p-3 flex justify-center items-center">
                            <svg viewBox="0 0 240 140" className="w-full h-auto overflow-visible">
                              {/* Horizontal Grid Lines */}
                              <line x1="10" y1="20" x2="210" y2="20" stroke="#E2E8F0" strokeWidth="0.8" />
                              <line x1="10" y1="70" x2="210" y2="70" stroke="#E2E8F0" strokeWidth="0.8" />
                              <line x1="10" y1="120" x2="210" y2="120" stroke="#94A3B8" strokeWidth="1" />

                              {/* Ticks */}
                              <text x="215" y="24" className="text-[9px] font-semibold fill-slate-500">
                                {maxRecentCites}
                              </text>
                              <text x="215" y="74" className="text-[9px] font-semibold fill-slate-500">
                                {Math.round(maxRecentCites / 2)}
                              </text>
                              <text x="215" y="124" className="text-[9px] font-semibold fill-slate-500">
                                0
                              </text>

                              {/* Bars */}
                              {recentCitationValues.map((v, i) => {
                                const barWidth = 14
                                const spacing =
                                  recentCitationValues.length > 1
                                    ? (190 - barWidth) / (recentCitationValues.length - 1)
                                    : 0
                                const x = 15 + i * spacing
                                const barHeight =
                                  maxRecentCites > 0 ? (v.count / maxRecentCites) * 100 : 0
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
                )}
              </div>
            </div>
          ) : (
            <Card className="p-8 text-center rounded-2xl border border-slate-200 bg-white space-y-4 max-w-xl mx-auto shadow-2xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 mx-auto">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Hồ sơ đang trong quá trình xử lý</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Hồ sơ của bạn đang trong quá trình kiểm tra và chờ duyệt. Vui lòng quay lại sau khi quản trị viên hoàn tất kiểm tra thông tin.
              </p>
              <Button onClick={() => setActiveTab('submit')} className="bg-blue-600 hover:bg-blue-700 text-xs font-semibold rounded-xl">
                Xem trạng thái hồ sơ
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* Tab 2: Profile Submission & Status */}
      {activeTab === 'submit' && (
        <Card className="p-6 rounded-2xl border border-slate-200 bg-white space-y-6 max-w-2xl mx-auto shadow-2xs">
          <div>
            <h3 className="text-base font-bold text-slate-900">Gửi thông tin liên kết Google Scholar</h3>
            <p className="text-xs text-slate-500 mt-1">
              Nhập đường dẫn trang cá nhân Google Scholar của bạn để được cập nhật dữ liệu.
            </p>
          </div>

          {/* Current Status Banner */}
          <div className="p-4 rounded-xl border flex items-center justify-between bg-slate-50 border-slate-200">
            <span className="text-xs font-semibold text-slate-700">Trạng thái hồ sơ hiện tại:</span>
            {profile?.status === 'PENDING' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="h-3.5 w-3.5" />{' '}
                {profile?.request_type === 'UPDATE' ? 'Đang chờ duyệt cập nhật' : 'Đang chờ duyệt hồ sơ mới'}
              </span>
            )}
            {profile?.status === 'APPROVED' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" /> Đã phê duyệt
              </span>
            )}
            {(profile?.status === 'DRAFT' || !profile?.status) && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                <AlertCircle className="h-3.5 w-3.5" /> Chưa gửi hồ sơ
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmitScholarUrl)} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="scholar_url" className="text-sm font-semibold text-slate-800">
                  Liên kết Google Scholar
                </Label>
                <a
                  href="https://scholar.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                >
                  Truy cập Google Scholar của bạn <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <Input
                id="scholar_url"
                placeholder="vd: https://scholar.google.com/citations?user=AHHDABDaaaaJ"
                {...register('scholar_url')}
                disabled={(profile?.status === 'PENDING' || profile?.status === 'APPROVED') && !isEditingScholarUrl}
                className="h-11 rounded-xl text-sm font-mono disabled:bg-slate-50 disabled:text-slate-600 disabled:border-slate-200"
              />
              {errors.scholar_url && <p className="text-xs text-red-600">{errors.scholar_url.message}</p>}
              <p className="text-[11px] text-slate-400">
                Ví dụ cấu trúc URL hợp lệ: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">https://scholar.google.com/citations?user=AHHDABDaaaaJ</code>
              </p>
            </div>

            <ScholarGuide defaultOpen={false} className="mt-2" />

            {profile?.scholar_url && (profile.status === 'PENDING' || profile.status === 'APPROVED') && !isEditingScholarUrl ? (
              <Button
                type="button"
                onClick={() => setIsEditingScholarUrl(true)}
                className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Yêu cầu cập nhật
              </Button>
            ) : isEditingScholarUrl ? (
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditingScholarUrl(false)}
                  className="flex-1 h-11 text-xs font-semibold rounded-xl"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={submitProfile.isPending}
                  className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs cursor-pointer"
                >
                  {submitProfile.isPending && <Spinner className="mr-2" />}
                  Gửi yêu cầu cập nhật
                </Button>
              </div>
            ) : (
              <Button
                type="submit"
                disabled={submitProfile.isPending}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs cursor-pointer"
              >
                {submitProfile.isPending && <Spinner className="mr-2" />}
                Gửi thông tin hồ sơ
              </Button>
            )}
          </form>
        </Card>
      )}

      {/* Tab 3: Account Settings */}
      {activeTab === 'settings' && (
        <Card className="p-6 rounded-2xl border border-slate-200 bg-white space-y-6 max-w-xl mx-auto shadow-2xs">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-blue-600" /> Cài đặt Tài khoản
          </h3>
          <p className="text-xs text-slate-500">Quản lý mật khẩu và thông tin tài khoản cá nhân.</p>
        </Card>
      )}

      {/* Modals & Dialogs */}
      {/* 1. Add Publication Dialog */}
      <Dialog
        open={isAddPubModalOpen}
        onClose={() => setIsAddPubModalOpen(false)}
        title={
          <span className="flex items-center gap-2 text-slate-900 font-bold">
            <Plus className="h-5 w-5 text-blue-600" /> Thêm bài báo mới
          </span>
        }
        className="max-w-lg"
      >
        <form onSubmit={handleAddPublicationSubmit} className="space-y-3">
          <div>
            <Label className="text-xs font-semibold">Tên bài báo khoa học *</Label>
            <Input
              value={addPubForm.title}
              onChange={(e) => setAddPubForm({ ...addPubForm, title: e.target.value })}
              placeholder="Nhập tên bài báo công bố..."
              className="h-10 text-xs mt-1"
              required
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Tác giả</Label>
            <Input
              value={addPubForm.authors}
              onChange={(e) => setAddPubForm({ ...addPubForm, authors: e.target.value })}
              placeholder="vd: Nguyen Van A, Tran Van B"
              className="h-10 text-xs mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Tạp chí / Nơi xuất bản</Label>
            <Input
              value={addPubForm.venue}
              onChange={(e) => setAddPubForm({ ...addPubForm, venue: e.target.value })}
              placeholder="vd: Nature, IEEE Transactions..."
              className="h-10 text-xs mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Năm xuất bản</Label>
              <Input
                value={addPubForm.year}
                onChange={(e) => setAddPubForm({ ...addPubForm, year: e.target.value })}
                placeholder="2024"
                className="h-10 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Số lượt trích dẫn</Label>
              <Input
                type="number"
                value={addPubForm.citations}
                onChange={(e) => setAddPubForm({ ...addPubForm, citations: e.target.value })}
                className="h-10 text-xs mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsAddPubModalOpen(false)} className="text-xs h-9">
              Hủy
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9">
              Thêm bài báo
            </Button>
          </div>
        </form>
      </Dialog>

      {/* 2. Edit Publication Dialog */}
      <Dialog
        open={isEditPubModalOpen}
        onClose={() => setIsEditPubModalOpen(false)}
        title={<span className="font-bold text-slate-900">Chỉnh sửa thông tin bài báo</span>}
        className="max-w-lg"
      >
        <form onSubmit={handleEditPubSubmit} className="space-y-3">
          <div>
            <Label className="text-xs font-semibold">Tên bài báo</Label>
            <Input
              value={editPubForm.title}
              onChange={(e) => setEditPubForm({ ...editPubForm, title: e.target.value })}
              className="h-10 text-xs mt-1"
              required
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Tác giả</Label>
            <Input
              value={editPubForm.authors}
              onChange={(e) => setEditPubForm({ ...editPubForm, authors: e.target.value })}
              className="h-10 text-xs mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Tạp chí / Nơi xuất bản</Label>
            <Input
              value={editPubForm.venue}
              onChange={(e) => setEditPubForm({ ...editPubForm, venue: e.target.value })}
              className="h-10 text-xs mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Năm</Label>
              <Input
                value={editPubForm.year}
                onChange={(e) => setEditPubForm({ ...editPubForm, year: e.target.value })}
                className="h-10 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Trích dẫn</Label>
              <Input
                type="number"
                value={editPubForm.citations}
                onChange={(e) => setEditPubForm({ ...editPubForm, citations: e.target.value })}
                className="h-10 text-xs mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsEditPubModalOpen(false)} className="text-xs h-9">
              Hủy
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9">
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Dialog>

      {/* 3. Trash Bin Dialog */}
      <Dialog
        open={isTrashModalOpen}
        onClose={() => setIsTrashModalOpen(false)}
        title={
          <span className="flex items-center gap-2 text-slate-900 font-bold">
            <Trash2 className="h-5 w-5 text-red-600" /> Thùng rác bài báo ({deletedPublications.length})
          </span>
        }
        className="max-w-2xl"
      >
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {deletedPublications.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">Thùng rác trống.</div>
          ) : (
            deletedPublications.map((pub) => (
              <div key={pub.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900 truncate">{pub.title}</p>
                  <p className="text-[11px] text-slate-500 truncate">{pub.authors_list}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleRestoreFromTrash(pub.id)}
                  className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shrink-0"
                >
                  Khôi phục
                </Button>
              </div>
            ))
          )}
        </div>
      </Dialog>

      {/* 4. Merge Publications Dialog */}
      <Dialog
        open={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        title={
          <span className="flex items-center gap-2 text-slate-900 font-bold">
            <FileText className="h-5 w-5 text-blue-600" /> Gộp {selectedPubIds.length} bài báo đã chọn
          </span>
        }
        className="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Các bài báo trùng lặp sẽ được hợp nhất số lượt trích dẫn vào bài báo chính. Các bài báo còn lại sẽ được chuyển vào thùng rác.
          </p>
          <form onSubmit={handleMergePubsSubmit} className="space-y-4">
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsMergeModalOpen(false)} className="text-xs h-9">
                Hủy
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9">
                Xác nhận gộp
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </div>
  )
}
