import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Save,
  ArrowLeft,
  Send,
  FileText,
} from 'lucide-react'
import {
  useMyProfile,
  useSubmitScholarRequest,
  useUpdateMyProfile,
  useQuickPreviewScholar,
  type QuickPreviewResult,
} from '@/api/hooks/useUserPortal'
import { useAuthStore } from '@/stores/auth.store'
import { getApiErrorMessage } from '@/lib/api-error'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { ScholarGuide } from '@/components/ScholarGuide'

export function UserEditProfilePage() {
  const navigate = useNavigate()
  const { data: profile, isLoading } = useMyProfile()
  const submitScholarMutation = useSubmitScholarRequest()
  const updateProfileMutation = useUpdateMyProfile()
  const user = useAuthStore((s) => s.user)

  // Card 1: Google Scholar URL State & Anti-Spam Cooldown
  const [scholarUrl, setScholarUrl] = useState('')
  const [isEditingScholarUrl, setIsEditingScholarUrl] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const quickPreviewMutation = useQuickPreviewScholar()

  // Countdown timer for Anti-Spam Rate Limiting (10s)
  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldownSeconds])

  // Card 2: NAFOSTED Academic Profile Form State
  const [fullName, setFullName] = useState('')
  const [academicTitle, setAcademicTitle] = useState('')
  const [position, setPosition] = useState('')
  const [department, setDepartment] = useState('')
  const [institution, setInstitution] = useState('')

  // Sync state when profile or user data finishes loading
  useEffect(() => {
    if (profile?.scholar_url) {
      setScholarUrl(profile.scholar_url)
    }
    setFullName(
      profile?.full_name ||
      [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
      profile?.author_detail?.name ||
      ''
    )
    setAcademicTitle(profile?.academic_title || '')
    setPosition(profile?.position || '')
    setDepartment(profile?.department || '')
    setInstitution(profile?.institution || profile?.author_detail?.affiliation || '')
  }, [profile, user])

  // Real-time Client-Side Regex Extraction of Scholar ID (Standard Google Scholar ID is 12 chars)
  const extractedId = useMemo(() => {
    if (!scholarUrl.trim()) return null
    const match = scholarUrl.match(/user=([a-zA-Z0-9_-]{10,16})/)
    return match ? match[1] : null
  }, [scholarUrl])

  // External Scholar Preview Link
  const externalPreviewUrl = useMemo(() => {
    if (extractedId) {
      return `https://scholar.google.com/citations?user=${extractedId}`
    }
    if (!scholarUrl.trim()) return '#'
    if (scholarUrl.startsWith('http://') || scholarUrl.startsWith('https://')) {
      return scholarUrl.trim()
    }
    return `https://${scholarUrl.trim()}`
  }, [scholarUrl, extractedId])

  // Handler for Quick Live Check with Tor Proxy
  const handleQuickCheck = () => {
    if (!extractedId) {
      toast.error('Vui lòng nhập đường dẫn Google Scholar hợp lệ chứa mã user=...')
      return
    }
    setCooldownSeconds(10)
    quickPreviewMutation.mutate(
      { scholar_url: scholarUrl.trim(), scholar_id: extractedId },
      {
        onSuccess: (data: QuickPreviewResult) => {
          if (data.found && data.name) {
            toast.success(`Đã quét thấy hồ sơ Google Scholar của tác giả "${data.name}"!`)
          } else {
            toast.warning(data.message || 'Không tìm thấy dữ liệu tác giả trên Google Scholar.')
          }
        },
        onError: () => {
          toast.error('Không thể kết nối máy chủ quét live. Vui lòng thử lại.')
        },
      }
    )
  }

  // Handlers for Google Scholar URL Submission
  const handleSubmitScholarUrl = (e: React.FormEvent) => {
    e.preventDefault()
    if (!extractedId) {
      toast.error('Vui lòng nhập đường dẫn Google Scholar hợp lệ chứa tham số user=...')
      return
    }

    submitScholarMutation.mutate(
      { scholar_url: scholarUrl.trim() },
      {
        onSuccess: () => {
          toast.success(
            profile?.status === 'APPROVED' || profile?.scholar_url
              ? 'Đã gửi yêu cầu cập nhật hồ sơ Google Scholar thành công!'
              : 'Đã gửi yêu cầu phê duyệt kết nối Google Scholar thành công!'
          )
          setIsEditingScholarUrl(false)
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(err, 'Không thể gửi yêu cầu phê duyệt'))
        },
      }
    )
  }

  // Handlers for Saving Academic Profile
  const handleSaveAcademicProfile = (e: React.FormEvent) => {
    e.preventDefault()
    updateProfileMutation.mutate(
      {
        full_name: fullName,
        academic_title: academicTitle,
        position,
        department,
        institution,
      },
      {
        onSuccess: () => {
          toast.success('Đã lưu thành công thông tin lý lịch khoa học!')
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(err, 'Không thể lưu thông tin lý lịch'))
        },
      }
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Spinner className="h-8 w-8 text-[#005b9a]" />
          <span className="text-sm font-medium">Đang tải trang cập nhật hồ sơ...</span>
        </div>
      </div>
    )
  }

  const isPending = profile?.status === 'PENDING'

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Top Header & Navigation */}
      <div className="flex flex-col gap-1 border-b border-slate-200 pb-3">
        <button
          onClick={() => navigate('/user/profile')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#005b9a] hover:underline mb-0.5 cursor-pointer w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Quay lại Hồ sơ cá nhân
        </button>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Cập nhật thông tin
        </h1>
      </div>

      {/* Amber Banner if current status === 'PENDING' */}
      {isPending && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-2xs flex items-start gap-3">
          <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold">Yêu cầu kết nối đang chờ xử lý</h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              Yêu cầu kết nối Google Scholar của bạn đã được gửi và đang chờ Admin phê duyệt. Bạn vẫn có thể gửi lại đường dẫn mới nếu cần thay đổi.
            </p>
          </div>
        </div>
      )}

      {/* Card 1: Google Scholar URL Submission */}
      <Card className="overflow-hidden border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            Kết nối Google Scholar
          </h2>

          {/* Compact Status Badge */}
          {profile?.status === 'APPROVED' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Đã phê duyệt
            </span>
          )}
          {profile?.status === 'PENDING' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              {profile?.request_type === 'UPDATE' ? 'Đang chờ duyệt cập nhật' : 'Đang chờ duyệt hồ sơ mới'}
            </span>
          )}
          {profile?.status === 'REJECTED' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
              Chưa được duyệt
            </span>
          )}
        </div>

        {profile?.status === 'APPROVED' && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50/80 px-3 py-2 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Liên kết Google Scholar đã được Admin phê duyệt thành công.</span>
          </div>
        )}

        <form onSubmit={handleSubmitScholarUrl} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scholar-url-input" className="text-xs font-bold text-slate-800">
              Đường dẫn trang cá nhân Google Scholar
            </Label>
            <div className="flex gap-2">
              <Input
                id="scholar-url-input"
                type="text"
                placeholder="https://scholar.google.com/citations?user=vIowI28AAAAJ"
                value={scholarUrl}
                onChange={(e) => setScholarUrl(e.target.value)}
                disabled={
                  (profile?.status === 'PENDING' || profile?.status === 'APPROVED') &&
                  !isEditingScholarUrl
                }
                className="h-10 text-xs font-mono bg-slate-50/50 border-slate-300 focus:bg-white flex-1 disabled:bg-slate-100 disabled:text-slate-600 disabled:border-slate-200"
              />
              <Button
                type="button"
                onClick={handleQuickCheck}
                disabled={!extractedId || cooldownSeconds > 0 || quickPreviewMutation.isPending}
                className="h-10 px-5 bg-[#005b9a] hover:bg-[#00487a] text-[#ffffff] font-semibold text-xs rounded-xl cursor-pointer shrink-0 disabled:opacity-50"
              >
                {quickPreviewMutation.isPending ? (
                  <>
                    <Spinner className="h-3.5 w-3.5 text-white" />
                    <span>Đang kiểm tra...</span>
                  </>
                ) : cooldownSeconds > 0 ? (
                  <span>Đợi {cooldownSeconds}s</span>
                ) : (
                  <span>Kiểm tra</span>
                )}
              </Button>
            </div>
          </div>

          {/* Live Scraped Profile Preview Result */}
          {scholarUrl.trim() !== '' && (
            <div className="rounded-xl border p-4 transition-all space-y-3 bg-slate-50/80">
              {extractedId ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Link Google Scholar hợp lệ</span>
                    </div>

                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-100 text-slate-800 font-mono font-bold text-xs border border-slate-200">
                      Scholar ID: <strong className="text-slate-900">{extractedId}</strong>
                    </span>
                  </div>

                  {/* Live Scraped Result Card */}
                  {quickPreviewMutation.isPending ? (
                    <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-100/60 p-3 rounded-xl border border-slate-200">
                      <Spinner className="h-4 w-4 text-[#005b9a]" />
                      <span>Đang kiểm tra thông tin từ Google Scholar...</span>
                    </div>
                  ) : quickPreviewMutation.data?.found ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-2 text-xs animate-in fade-in duration-200">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{quickPreviewMutation.data.name}</span>
                        <span className="text-[10px] font-bold bg-blue-50 text-[#005b9a] px-2.5 py-0.5 rounded-md border border-blue-200">
                          {quickPreviewMutation.data.citedby} Trích dẫn | H-Index {quickPreviewMutation.data.hindex}
                        </span>
                      </div>
                      {quickPreviewMutation.data.affiliation && (
                        <p className="text-slate-600 text-xs italic">{quickPreviewMutation.data.affiliation}</p>
                      )}
                      {quickPreviewMutation.data.email_domain && (
                        <p className="text-[11px] text-emerald-800 font-semibold">
                          Email xác minh: <span className="underline">{quickPreviewMutation.data.email_domain.replace(/^@/, '')}</span>
                        </p>
                      )}
                    </div>
                  ) : quickPreviewMutation.data?.message ? (
                    <div className="flex items-start gap-2.5 text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] font-medium">{quickPreviewMutation.data.message}</p>
                    </div>
                  ) : null}

                  {/* External preview link */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                    <span className="text-slate-600">Mở thử trang gốc:</span>
                    <a
                      href={externalPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-[#005b9a] hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Mở Google Scholar ↗
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 text-rose-700 text-xs font-semibold">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">✕ Link chưa đúng định dạng</p>
                    <p className="text-[11px] text-rose-600 font-normal mt-0.5">
                      Đường dẫn phải chứa tham số <code className="font-mono bg-rose-100 px-1 py-0.5 rounded">user=...</code> (12 ký tự). Ví dụ: <code className="font-mono text-slate-800">https://scholar.google.com/citations?user=vIowI28AAAAJ</code>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Scholar Visual Guide Section */}
          <ScholarGuide
            defaultOpen={false}
            className="mt-3"
          />

          {/* Action Submit Button */}
          <div className="flex justify-end pt-2">
            {profile?.scholar_url && (profile.status === 'PENDING' || profile.status === 'APPROVED') && !isEditingScholarUrl ? (
              <Button
                type="button"
                onClick={() => setIsEditingScholarUrl(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-xs cursor-pointer gap-2"
              >
                <FileText className="h-4 w-4" />
                Yêu cầu cập nhật
              </Button>
            ) : isEditingScholarUrl ? (
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditingScholarUrl(false)
                    if (profile?.scholar_url) {
                      setScholarUrl(profile.scholar_url)
                    }
                  }}
                  className="h-10 rounded-xl text-xs font-semibold px-4 cursor-pointer"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={!extractedId || submitScholarMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-xs cursor-pointer gap-2 disabled:opacity-40"
                >
                  {submitScholarMutation.isPending ? (
                    <>
                      <Spinner className="h-4 w-4 text-white" />
                      Đang gửi yêu cầu...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Gửi yêu cầu cập nhật
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <Button
                type="submit"
                disabled={!extractedId || submitScholarMutation.isPending}
                className="bg-[#005b9a] hover:bg-[#00487a] text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-xs cursor-pointer gap-2 disabled:opacity-40"
              >
                {submitScholarMutation.isPending ? (
                  <>
                    <Spinner className="h-4 w-4 text-white" />
                    Đang gửi yêu cầu...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Gửi yêu cầu phê duyệt
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Card 2: Compact NAFOSTED Academic Profile Form */}
      <Card className="overflow-hidden border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            Thông tin cá nhân
          </h2>
        </div>

        <form onSubmit={handleSaveAcademicProfile} className="space-y-6">
          {/* Section A: General Info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Full Name */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="full-name" className="text-xs font-bold text-slate-800">
                Họ và tên
              </Label>
              <Input
                id="full-name"
                type="text"
                placeholder="Ví dụ: Nguyễn Văn A"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            {/* Academic Title / Degree */}
            <div className="space-y-1.5">
              <Label htmlFor="academic-title" className="text-xs font-bold text-slate-800">
                Học hàm / Học vị
              </Label>
              <select
                id="academic-title"
                value={academicTitle}
                onChange={(e) => setAcademicTitle(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-800 focus:border-[#005b9a] focus:outline-none focus:ring-1 focus:ring-[#005b9a] cursor-pointer"
              >
                <option value="">-- Chọn học hàm / học vị --</option>
                <option value="GS.TS">GS.TS - Giáo sư, Tiến sĩ</option>
                <option value="PGS.TS">PGS.TS - Phó Giáo sư, Tiến sĩ</option>
                <option value="Tiến sĩ">Tiến sĩ (Ph.D.)</option>
                <option value="Thạc sĩ">Thạc sĩ (M.Sc.)</option>
                <option value="Cử nhân">Cử nhân / Kỹ sư (B.Sc./Eng.)</option>
              </select>
            </div>

            {/* Administrative Position */}
            <div className="space-y-1.5">
              <Label htmlFor="position" className="text-xs font-bold text-slate-800">
                Chức vụ công tác
              </Label>
              <Input
                id="position"
                type="text"
                placeholder="Ví dụ: Giảng viên cao cấp, Trưởng nhóm nghiên cứu"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <Label htmlFor="department" className="text-xs font-bold text-slate-800">
                Bộ môn / Khoa
              </Label>
              <Input
                id="department"
                type="text"
                placeholder="Ví dụ: Khoa Khoa học Máy tính"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* Institution */}
            <div className="space-y-1.5">
              <Label htmlFor="institution" className="text-xs font-bold text-slate-800">
                Cơ quan công tác
              </Label>
              <Input
                id="institution"
                type="text"
                placeholder="Ví dụ: Trường Đại học Công nghệ - ĐHQGHN"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Action Save Button */}
          <div className="flex justify-end pt-3 border-t border-slate-100">
            <Button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="bg-[#005b9a] hover:bg-[#00487a] text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-xs cursor-pointer gap-2"
            >
              {updateProfileMutation.isPending ? (
                <>
                  <Spinner className="h-4 w-4 text-white" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Lưu Thông Tin Lý Lịch
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
