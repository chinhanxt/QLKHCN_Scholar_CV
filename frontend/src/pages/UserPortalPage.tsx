import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  KeyRound,
  Award,
  TrendingUp,
} from 'lucide-react'
import { useMyProfile, useSubmitScholarProfile } from '@/api/hooks/useUserPortal'
import { getApiErrorMessage } from '@/lib/api-error'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Spinner } from '@/components/ui/spinner'

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
        toast.success('Đã gửi thông tin liên kết Google Scholar thành công!')
        setActiveTab('submit')
      },
      onError: (err) => toast.error(getApiErrorMessage(err, 'Gửi thông tin thất bại')),
    })
  }

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
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between shadow-2xs">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Tổng trích dẫn</p>
                    <p className="text-2xl font-extrabold text-slate-900">{profile.total_citations}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-600 opacity-80" />
                </Card>
                <Card className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between shadow-2xs">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Chỉ số h-index</p>
                    <p className="text-2xl font-extrabold text-indigo-700">{profile.h_index}</p>
                  </div>
                  <Award className="h-8 w-8 text-indigo-600 opacity-80" />
                </Card>
                <Card className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between shadow-2xs">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Chỉ số i10-index</p>
                    <p className="text-2xl font-extrabold text-emerald-700">{profile.i10_index}</p>
                  </div>
                  <Award className="h-8 w-8 text-emerald-600 opacity-80" />
                </Card>
              </div>

              {/* Publications Table */}
              <Card className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Danh sách Bài báo & Công trình khoa học ({profile.publications?.length || 0})
                  </h3>
                </div>
                <Table>
                  <THead>
                    <TR className="bg-slate-50">
                      <TH className="py-3 px-4 font-semibold text-slate-700">Tên bài báo</TH>
                      <TH className="py-3 px-4 font-semibold text-slate-700">Tác giả</TH>
                      <TH className="py-3 px-4 font-semibold text-slate-700">Năm</TH>
                      <TH className="py-3 px-4 font-semibold text-slate-700 text-right">Trích dẫn</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {profile.publications?.map((pub) => (
                      <TR key={pub.id} className="hover:bg-slate-50/60">
                        <TD className="py-3 px-4 font-medium text-slate-900 text-sm">
                          {pub.url ? (
                            <a
                              href={pub.url}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline text-blue-700 flex items-center gap-1"
                            >
                              {pub.title} <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ) : (
                            pub.title
                          )}
                        </TD>
                        <TD className="py-3 px-4 text-xs text-slate-600">{pub.authors}</TD>
                        <TD className="py-3 px-4 text-xs font-semibold text-slate-700">{pub.pub_year || '-'}</TD>
                        <TD className="py-3 px-4 text-xs font-bold text-blue-700 text-right">{pub.citations}</TD>
                      </TR>
                    ))}
                    {(!profile.publications || profile.publications.length === 0) && (
                      <TR>
                        <TD colSpan={4} className="py-8 text-center text-slate-500 text-sm">
                          Chưa có công trình khoa học nào được ghi nhận.
                        </TD>
                      </TR>
                    )}
                  </TBody>
                </Table>
              </Card>
            </>
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
                <Clock className="h-3.5 w-3.5" /> Đang chờ duyệt
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
                className="h-11 rounded-xl text-sm font-mono"
              />
              {errors.scholar_url && <p className="text-xs text-red-600">{errors.scholar_url.message}</p>}
              <p className="text-[11px] text-slate-400">
                Ví dụ cấu trúc URL hợp lệ: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">https://scholar.google.com/citations?user=AHHDABDaaaaJ</code>
              </p>
            </div>

            <Button
              type="submit"
              disabled={submitProfile.isPending}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs cursor-pointer"
            >
              {submitProfile.isPending && <Spinner className="mr-2" />}
              Gửi thông tin hồ sơ
            </Button>
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
    </div>
  )
}
