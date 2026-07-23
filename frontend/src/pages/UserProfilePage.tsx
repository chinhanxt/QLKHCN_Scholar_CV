import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mail,
  Building,
  Briefcase,
  ArrowRight,
  Clock,
  AlertCircle,
  Edit3,
  BadgeCheck,
  GraduationCap,
  Award,
  BookOpen,
  FileText,
  TrendingUp,
  Sparkles,
} from 'lucide-react'
import { useMyProfile } from '@/api/hooks/useUserPortal'
import { useAuthStore } from '@/stores/auth.store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

export function UserProfilePage() {
  const navigate = useNavigate()
  const { data: profile, isLoading } = useMyProfile()
  const user = useAuthStore((s) => s.user)

  // Publications list sorted by citations count descending (Must be called before any early return)
  const sortedPublications = useMemo(() => {
    const list = profile?.publications?.length
      ? [...profile.publications]
      : profile?.author_detail?.publications
      ? [...profile.author_detail.publications]
      : []
    return list.sort((a: any, b: any) => (Number(b.citations) || 0) - (Number(a.citations) || 0))
  }, [profile])

  if (isLoading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Spinner className="h-8 w-8 text-[#005b9a]" />
          <span className="text-sm font-medium">Đang tải thông tin hồ sơ...</span>
        </div>
      </div>
    )
  }

  // Extract Scholar ID
  const scholarId = profile?.scholar_id || (profile?.scholar_url ? profile.scholar_url.match(/user=([a-zA-Z0-9_-]+)/)?.[1] : null)

  // Status logic
  const isApproved = profile?.status === 'APPROVED' || Boolean(profile?.scholar_id && profile?.status !== 'PENDING')
  const isPending = profile?.status === 'PENDING'

  // Derived user display info
  const fullName =
    profile?.full_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    profile?.author_detail?.name ||
    'Chưa cập nhật'

  const academicTitle = profile?.academic_title || 'Chưa cập nhật'
  const position = profile?.position || 'Chưa cập nhật'
  const department = profile?.department || 'Chưa cập nhật'
  const email = user?.email || profile?.user_email || 'Chưa cập nhật'
  const affiliation = profile?.institution || profile?.author_detail?.affiliation || 'Chưa cập nhật'

  const publicationsCount = sortedPublications.length
  const topPublicationsPreview = sortedPublications.slice(0, 4)

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Hồ sơ cá nhân</h1>
        </div>
        <Button
          onClick={() => navigate('/user/edit-profile')}
          className="mt-2 md:mt-0 bg-[#005b9a] hover:bg-[#00487a] text-white gap-2 shadow-xs cursor-pointer rounded-xl text-xs font-semibold px-4 py-2"
        >
          <Edit3 className="h-4 w-4" />
          Cập nhật hồ sơ
        </Button>
      </div>

      {/* Card 1: Main Academic Identity & Credentials Header */}
      <Card className="overflow-hidden border border-slate-200/90 bg-white p-6 shadow-sm rounded-2xl space-y-6">
        {/* Profile Header Block */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-5 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            {/* Academic Crest Icon Badge */}
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-blue-50/90 border-2 border-blue-100/90 text-[#005b9a] shadow-xs">
              {user?.avatar ? (
                <img src={user.avatar} alt={fullName} className="h-full w-full rounded-full object-cover" />
              ) : (
                <GraduationCap className="h-10 w-10 text-[#005b9a]" />
              )}
            </div>

            {/* Clean Author Name & Scholar ID */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">{fullName}</h2>
                <BadgeCheck className="h-5 w-5 text-blue-600 shrink-0" />
              </div>

              {scholarId && (
                <div className="pt-0.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 font-mono border border-blue-100">
                    ID: {scholarId}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Connection Status Badge */}
          <div className="shrink-0">
            {isApproved ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                ✓ Đã kết nối Google Scholar
              </span>
            ) : isPending ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200 shadow-2xs">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                ⏳ Đang chờ duyệt
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-200 shadow-2xs">
                <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
                ✕ Chưa kết nối Google Scholar
              </span>
            )}
          </div>
        </div>

        {/* Clean 5-Card Info Grid with Circular Icon Badges (Zero Duplicates!) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {/* Email */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 transition-colors hover:bg-blue-50/30">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50/90 border border-blue-100/80 text-[#005b9a] shrink-0">
              <Mail className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Email liên hệ</span>
              <span className="font-semibold text-slate-800 truncate block">{email}</span>
            </div>
          </div>

          {/* Academic Degree / Title */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 transition-colors hover:bg-blue-50/30">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50/90 border border-blue-100/80 text-[#005b9a] shrink-0">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Học hàm / Học vị</span>
              <span className="font-semibold text-slate-800 truncate block">{academicTitle}</span>
            </div>
          </div>

          {/* Department / Faculty */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 transition-colors hover:bg-blue-50/30">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50/90 border border-blue-100/80 text-[#005b9a] shrink-0">
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Bộ môn / Khoa</span>
              <span className="font-semibold text-slate-800 truncate block">{department}</span>
            </div>
          </div>

          {/* Institution */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 transition-colors hover:bg-blue-50/30">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50/90 border border-blue-100/80 text-[#005b9a] shrink-0">
              <Building className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Cơ quan công tác</span>
              <span className="font-semibold text-slate-800 truncate block">{affiliation}</span>
            </div>
          </div>

          {/* Position */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 transition-colors hover:bg-blue-50/30 md:col-span-2 lg:col-span-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50/90 border border-blue-100/80 text-[#005b9a] shrink-0">
              <Briefcase className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Chức vụ công tác</span>
              <span className="font-semibold text-slate-800 truncate block">{position}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Card 2: Citation Analytics Dashboard */}
      {isApproved ? (
        <Card className="overflow-hidden border border-slate-200/90 bg-white p-6 shadow-sm rounded-2xl space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Award className="h-4.5 w-4.5 text-[#005b9a]" />
              Thống kê chỉ số tác động khoa học (Google Scholar)
            </h3>
          </div>

          {/* 4 Citation Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <FileText className="h-3.5 w-3.5 text-[#005b9a]" />
                Công trình
              </div>
              <p className="mt-1.5 text-2xl font-extrabold text-[#005b9a]">
                {publicationsCount}
              </p>
              <span className="text-[10px] text-slate-400 font-medium">Bài báo đã xuất bản</span>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                Tổng Trích Dẫn
              </div>
              <p className="mt-1.5 text-2xl font-extrabold text-emerald-700">
                {profile?.total_citations ?? profile?.author_detail?.citedby ?? 0}
              </p>
              <span className="text-[10px] text-slate-400 font-medium">Lượt tham chiếu</span>
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <Award className="h-3.5 w-3.5 text-indigo-600" />
                H-Index
              </div>
              <p className="mt-1.5 text-2xl font-extrabold text-indigo-700">
                {profile?.h_index ?? profile?.author_detail?.hindex ?? 0}
              </p>
              <span className="text-[10px] text-slate-400 font-medium">Năng suất khoa học</span>
            </div>

            <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                i10-Index
              </div>
              <p className="mt-1.5 text-2xl font-extrabold text-purple-700">
                {profile?.i10_index ?? profile?.author_detail?.i10index ?? 0}
              </p>
              <span className="text-[10px] text-slate-400 font-medium">Bài trích dẫn ≥ 10</span>
            </div>
          </div>
        </Card>
      ) : isPending ? (
        <Card className="border border-amber-200 bg-amber-50/60 p-5 rounded-2xl space-y-3">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Yêu cầu liên kết Google Scholar đang chờ phê duyệt</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Quản trị viên đang xem xét link Scholar:{' '}
                <span className="font-mono underline font-medium">{profile?.scholar_url}</span>. 
                Các chỉ số trích dẫn và danh sách công trình sẽ tự động hiển thị sau khi được phê duyệt.
              </p>
            </div>
          </div>
          <div className="pt-1 flex justify-end">
            <Button
              onClick={() => navigate('/user/edit-profile')}
              size="sm"
              variant="outline"
              className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-medium cursor-pointer"
            >
              Chỉnh sửa link gửi duyệt ➔
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="border border-slate-200 bg-slate-50/70 p-6 text-center space-y-3 rounded-2xl">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-600">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Tài khoản chưa kết nối Google Scholar</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Cung cấp link Google Scholar cá nhân để tự động trích xuất các công trình nghiên cứu và chỉ số H-index, i10-index.
            </p>
          </div>
          <div className="pt-2">
            <Button
              onClick={() => navigate('/user/edit-profile')}
              className="bg-[#005b9a] hover:bg-[#00487a] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs cursor-pointer gap-2"
            >
              Gửi Link Google Scholar Ngay
            </Button>
          </div>
        </Card>
      )}

      {/* Card 3: Top Highlighted Publications Preview (If available) */}
      {topPublicationsPreview.length > 0 && (
        <Card className="overflow-hidden border border-slate-200/90 bg-white p-6 shadow-sm rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <FileText className="h-4.5 w-4.5 text-[#005b9a]" />
              Công trình nghiên cứu tiêu biểu ({topPublicationsPreview.length}/{publicationsCount})
            </h3>
            <Button
              onClick={() => navigate('/user/scholar')}
              variant="ghost"
              size="sm"
              className="text-xs text-[#005b9a] font-semibold hover:bg-blue-50 p-1.5 h-auto cursor-pointer gap-1"
            >
              Xem tất cả ({publicationsCount})
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-3">
            {topPublicationsPreview.map((pub: any, idx: number) => (
              <div
                key={pub.id || idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 hover:bg-blue-50/30 transition-colors"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-relaxed">
                    {pub.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    {pub.authors_list && <span className="truncate max-w-xs">{pub.authors_list}</span>}
                    {pub.venue && <span className="font-medium text-slate-700">• {pub.venue}</span>}
                    {pub.year && <span className="font-semibold text-[#005b9a]">({pub.year})</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-bold text-[#005b9a]">
                    <TrendingUp className="h-3 w-3" />
                    {pub.citations || 0} trích dẫn
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
