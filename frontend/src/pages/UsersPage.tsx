import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  UserPlus,
  Pencil,
  Search,
  Trash2,
  User as UserIcon,
  ShieldAlert,
  Eye,
  EyeOff,
  Mail,
  UserCheck,
  UserX,
  Lock as LockIcon,
  KeyRound,
} from 'lucide-react'
import {
  useUsers,
  useUser,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useResetUserPassword,
} from '@/api/hooks/useUsers'
import { getApiErrorMessage } from '@/lib/api-error'
import type { UUID, UserListItem } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'

export function UsersPage() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editId, setEditId] = useState<UUID | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserListItem | null>(null)

  const { data, isLoading, isError, error } = useUsers(search ? { search } : undefined)

  // Filter users by role on frontend if filter is active
  const filteredUsers = data?.results.filter((u) => {
    if (roleFilter === 'admin') return u.is_staff || u.is_superuser
    if (roleFilter === 'user') return !u.is_staff && !u.is_superuser
    return true
  })

  return (
    <div className="flex flex-col gap-5 p-2 sm:p-4">
          {/* Control bar: Search, Role Filter & Create Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Tìm theo địa chỉ email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-xl bg-white border-slate-200 text-sm focus:border-blue-600 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Role filter pills */}
          <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                roleFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({data?.count ?? 0})
            </button>
            <button
              onClick={() => setRoleFilter('admin')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                roleFilter === 'admin'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5 text-indigo-600" />
              Quản trị viên
            </button>
            <button
              onClick={() => setRoleFilter('user')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                roleFilter === 'user'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserIcon className="h-3.5 w-3.5 text-slate-500" />
              Người dùng
            </button>
          </div>

          {/* Create User Button */}
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer shrink-0 text-xs"
          >
            <UserPlus className="h-4 w-4" />
            Tạo người dùng
          </Button>
        </div>
      </div>

      {/* Main Users Data Table */}
      <Card className="rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
            <Spinner className="h-5 w-5 text-blue-600" /> Đang tải danh sách người dùng...
          </div>
        ) : isError ? (
          <div className="p-12 text-center text-sm text-red-600">
            {getApiErrorMessage(error, 'Không tải được danh sách người dùng')}
          </div>
        ) : (
          <Table>
            <THead>
              <TR className="bg-slate-50/80 border-b border-slate-200/80">
                <TH className="py-3.5 px-4 font-semibold text-slate-700">Tài khoản Email</TH>
                <TH className="py-3.5 px-4 font-semibold text-slate-700">Vai trò</TH>
                <TH className="py-3.5 px-4 font-semibold text-slate-700">Trạng thái</TH>
                <TH className="py-3.5 px-4 font-semibold text-slate-700 text-right">Thao tác</TH>
              </TR>
            </THead>
            <TBody>
              {filteredUsers?.map((u) => {
                const isAdmin = u.is_staff || u.is_superuser

                return (
                  <TR key={u.id} className="hover:bg-slate-50/60 transition-colors border-b border-slate-100">
                    <TD className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold text-sm ${
                          isAdmin ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {u.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="font-semibold text-slate-900 text-sm">
                          {u.email}
                        </div>
                      </div>
                    </TD>
                    <TD className="py-3.5 px-4">
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200/80">
                          <ShieldAlert className="h-3.5 w-3.5 text-indigo-600" />
                          Quản trị viên
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200">
                          <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                          Người dùng
                        </span>
                      )}
                    </TD>
                    <TD className="py-3.5 px-4">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/80">
                          <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                          Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200/80">
                          <UserX className="h-3.5 w-3.5 text-rose-600" />
                          Đã khóa
                        </span>
                      )}
                    </TD>
                    <TD className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Consolidated Edit (Pencil button) */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditId(u.id)}
                          className="h-8 px-3 text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-50 rounded-lg cursor-pointer font-medium"
                          title="Chỉnh sửa vai trò & mật khẩu"
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Chỉnh sửa
                        </Button>

                        {/* Delete User Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(u)}
                          className="h-8 px-2 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                          title="Xóa người dùng"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                )
              })}
              {filteredUsers && filteredUsers.length === 0 && (
                <TR>
                  <TD colSpan={4} className="py-12 text-center text-slate-500">
                    Không tìm thấy người dùng nào phù hợp.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        )}
      </Card>

      {/* Modals & Dialogs */}
      {isCreateOpen && <CreateUserDialog onClose={() => setIsCreateOpen(false)} />}
      {editId && <EditUserDialog id={editId} onClose={() => setEditId(null)} />}
      {deleteTarget && <DeleteUserDialog user={deleteTarget} onClose={() => setDeleteTarget(null)} />}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* 1. CREATE USER DIALOG (Rộng rãi max-w-2xl, Form Ngang)                     */
/* -------------------------------------------------------------------------- */

const createSchema = z.object({
  email: z.string().min(1, 'Bắt buộc').email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
  role: z.enum(['user', 'admin']),
  is_active: z.boolean(),
})

type CreateValues = z.infer<typeof createSchema>

function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const createUser = useCreateUser()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      email: '',
      password: '',
      role: 'user',
      is_active: true,
    },
  })

  const currentRole = watch('role')
  const currentIsActive = watch('is_active')

  const onSubmit = (values: CreateValues) => {
    // Auto-generate username from email
    const autoUsername = values.email.split('@')[0] + '_' + Math.random().toString(36).substring(2, 6)

    const payload = {
      email: values.email,
      username: autoUsername,
      password: values.password,
      is_active: values.is_active,
      is_staff: values.role === 'admin',
      is_superuser: values.role === 'admin',
    }

    createUser.mutate(payload, {
      onSuccess: () => {
        toast.success('Tạo người dùng mới thành công!')
        onClose()
      },
      onError: (err) => toast.error(getApiErrorMessage(err, 'Tạo người dùng thất bại')),
    })
  }

  return (
    <Dialog open onClose={onClose} title="Tạo người dùng mới" className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Form Ngang - Row 1: Email & Mật khẩu */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Email */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-email" className="font-semibold text-slate-800 text-sm">
              Email đăng nhập <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="create-email"
                type="email"
                placeholder="vd: user@example.com"
                {...register('email')}
                className="pl-10 h-11 rounded-xl text-sm"
              />
            </div>
            {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-password" className="font-semibold text-slate-800 text-sm">
              Mật khẩu <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <LockIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="create-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Nhập mật khẩu..."
                {...register('password')}
                className="pl-10 pr-10 h-11 rounded-xl font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
          </div>
        </div>

        {/* Form Ngang - Row 2: Vai trò & Trạng thái */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1 border-t border-slate-100">
          {/* Role Selection */}
          <div className="flex flex-col gap-2">
            <Label className="font-semibold text-slate-800 text-sm">Vai trò hệ thống</Label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                  currentRole === 'user'
                    ? 'border-blue-600 bg-blue-50/60 text-blue-900 font-semibold shadow-2xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  value="user"
                  {...register('role')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-semibold">Người dùng</span>
              </label>

              <label
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                  currentRole === 'admin'
                    ? 'border-indigo-600 bg-indigo-50/60 text-indigo-900 font-semibold shadow-2xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  value="admin"
                  {...register('role')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-semibold text-indigo-700 flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5" /> Quản trị viên
                </span>
              </label>
            </div>
          </div>

          {/* Status Switch */}
          <div className="flex flex-col gap-2">
            <Label className="font-semibold text-slate-800 text-sm">Trạng thái tài khoản</Label>
            <button
              type="button"
              onClick={() => setValue('is_active', !currentIsActive)}
              className={`h-11 px-4 rounded-xl text-xs font-semibold transition-all flex items-center justify-between border cursor-pointer ${
                currentIsActive
                  ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-emerald-600" />
                {currentIsActive ? 'Đang hoạt động' : 'Tài khoản đã khóa'}
              </span>
              <span className="font-bold px-2 py-0.5 rounded-md bg-white/80 border border-emerald-200 text-xs">
                {currentIsActive ? '✓ Bật' : '✕ Tắt'}
              </span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl h-10 px-5">
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={createUser.isPending}
            className="rounded-xl h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6"
          >
            {createUser.isPending && <Spinner className="mr-1" />}
            Tạo người dùng
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/* 2. UNIFIED EDIT USER DIALOG (Rộng rãi max-w-2xl, Form Ngang Rõ Ràng)      */
/* -------------------------------------------------------------------------- */

const editSchema = z.object({
  role: z.enum(['user', 'admin']),
  is_active: z.boolean(),
  new_password: z.string().optional(),
})

type EditValues = z.infer<typeof editSchema>

function EditUserDialog({ id, onClose }: { id: UUID; onClose: () => void }) {
  const { data: user, isLoading } = useUser(id)
  const updateUser = useUpdateUser()
  const resetPassword = useResetUserPassword()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    values: user
      ? {
          role: user.is_staff || user.is_superuser ? 'admin' : 'user',
          is_active: user.is_active,
          new_password: '',
        }
      : undefined,
  })

  const currentRole = watch('role')
  const currentIsActive = watch('is_active')

  const onSubmit = async (values: EditValues) => {
    try {
      // 1. Update role & status
      const payload = {
        is_active: values.is_active,
        is_staff: values.role === 'admin',
        is_superuser: values.role === 'admin',
      }

      await updateUser.mutateAsync({ id, payload })

      // 2. Reset password if specified
      if (values.new_password && values.new_password.trim().length >= 6) {
        await resetPassword.mutateAsync({
          id,
          payload: { new_password: values.new_password.trim() },
        })
        toast.success('Đã cập nhật vai trò & đổi mật khẩu thành công!')
      } else {
        toast.success('Đã cập nhật vai trò người dùng thành công!')
      }

      onClose()
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Cập nhật thất bại'))
    }
  }

  const isSubmitting = updateUser.isPending || resetPassword.isPending

  return (
    <Dialog open onClose={onClose} title="Chỉnh sửa tài khoản" className="max-w-2xl">
      {isLoading || !user ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Spinner /> Đang tải dữ liệu...
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Form Ngang - Row 1: Email & Mật khẩu mới */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Email (Cố định) */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-semibold text-slate-600">Email đăng nhập (Cố định)</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={user.email}
                  disabled
                  className="pl-10 h-11 rounded-xl bg-slate-100 font-medium text-sm text-slate-700 border-slate-200"
                />
              </div>
            </div>

            {/* Mật khẩu mới (Tùy chọn) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-new_password" className="font-semibold text-slate-800 flex items-center gap-1.5 text-sm">
                  <KeyRound className="h-4 w-4 text-indigo-600" /> Mật khẩu mới
                </Label>
                <span className="text-[11px] text-slate-400 font-normal">(Bỏ qua nếu giữ nguyên)</span>
              </div>
              <div className="relative">
                <LockIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="edit-new_password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu mới..."
                  {...register('new_password')}
                  className="pl-10 pr-10 h-11 rounded-xl font-mono text-sm placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Form Ngang - Row 2: Vai trò & Trạng thái */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1 border-t border-slate-100">
            {/* Role Selection */}
            <div className="flex flex-col gap-2">
              <Label className="font-semibold text-slate-800 text-sm">Vai trò hệ thống</Label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    currentRole === 'user'
                      ? 'border-blue-600 bg-blue-50/60 text-blue-900 font-semibold shadow-2xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input type="radio" value="user" {...register('role')} className="text-blue-600 focus:ring-blue-500" />
                  <span className="text-xs font-semibold">Người dùng</span>
                </label>

                <label
                  className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    currentRole === 'admin'
                      ? 'border-indigo-600 bg-indigo-50/60 text-indigo-900 font-semibold shadow-2xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input type="radio" value="admin" {...register('role')} className="text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-xs font-semibold text-indigo-700 flex items-center gap-1">
                    <ShieldAlert className="h-3.5 w-3.5" /> Quản trị viên
                  </span>
                </label>
              </div>
            </div>

            {/* Status Switch */}
            <div className="flex flex-col gap-2">
              <Label className="font-semibold text-slate-800 text-sm">Trạng thái tài khoản</Label>
              <button
                type="button"
                onClick={() => setValue('is_active', !currentIsActive)}
                className={`h-11 px-4 rounded-xl text-xs font-semibold transition-all flex items-center justify-between border cursor-pointer ${
                  currentIsActive
                    ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-rose-50/80 text-rose-700 border-rose-200 hover:bg-rose-100'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {currentIsActive ? (
                    <UserCheck className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <UserX className="h-4 w-4 text-rose-600" />
                  )}
                  {currentIsActive ? 'Đang hoạt động' : 'Tài khoản đã khóa'}
                </span>
                <span className="font-bold px-2 py-0.5 rounded-md bg-white/80 border border-emerald-200 text-xs">
                  {currentIsActive ? '✓ Bật' : '✕ Khóa'}
                </span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl h-10 px-5">
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6"
            >
              {isSubmitting && <Spinner className="mr-1" />}
              Lưu thay đổi
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/* 3. DELETE USER DIALOG (Xóa người dùng)                                    */
/* -------------------------------------------------------------------------- */

function DeleteUserDialog({ user, onClose }: { user: UserListItem; onClose: () => void }) {
  const deleteUser = useDeleteUser()

  const handleDelete = () => {
    deleteUser.mutate(user.id, {
      onSuccess: () => {
        toast.success(`Đã xóa tài khoản ${user.email} thành công!`)
        onClose()
      },
      onError: (err) => toast.error(getApiErrorMessage(err, 'Xóa tài khoản thất bại')),
    })
  }

  return (
    <Dialog open onClose={onClose} title="Xác nhận xóa tài khoản">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Bạn có chắc chắn muốn xóa tài khoản <strong className="text-slate-900">{user.email}</strong> không?
          Hành động này không thể hoàn tác.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl h-10">
            Hủy
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleteUser.isPending}
            className="rounded-xl h-10 bg-red-600 hover:bg-red-700 text-white font-semibold px-5"
          >
            {deleteUser.isPending && <Spinner className="mr-1" />}
            Xác nhận xóa
          </Button>
        </div>
      </div>
    </Dialog>
  )
}


