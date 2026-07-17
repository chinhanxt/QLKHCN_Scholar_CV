import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Pencil, Search } from 'lucide-react'
import { useUsers, useUser, useUpdateUser } from '@/api/hooks/useUsers'
import { getApiErrorMessage } from '@/lib/api-error'
import type { UUID } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'

export function UsersPage() {
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState<UUID | null>(null)
  const { data, isLoading, isError, error } = useUsers(search ? { search } : undefined)

  return (
    <div className="flex flex-col gap-4">

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Tìm theo tên, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
            <Spinner /> Đang tải...
          </div>
        ) : isError ? (
          <div className="p-10 text-center text-sm text-red-600">
            {getApiErrorMessage(error, 'Không tải được danh sách người dùng')}
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Email</TH>
                <TH>Tên đăng nhập</TH>
                <TH>Họ tên</TH>
                <TH>Trạng thái</TH>
                <TH className="text-right">Thao tác</TH>
              </TR>
            </THead>
            <TBody>
              {data?.results.map((u) => (
                <TR key={u.id}>
                  <TD className="font-medium text-slate-900">{u.email}</TD>
                  <TD>{u.username}</TD>
                  <TD>{[u.last_name, u.first_name].filter(Boolean).join(' ')}</TD>
                  <TD>
                    <span
                      className={
                        u.is_active
                          ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700'
                          : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500'
                      }
                    >
                      {u.is_active ? 'Hoạt động' : 'Khóa'}
                    </span>
                  </TD>
                  <TD className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditId(u.id)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Sửa
                    </Button>
                  </TD>
                </TR>
              ))}
              {data && data.results.length === 0 && (
                <TR>
                  <TD colSpan={5} className="py-10 text-center text-slate-500">
                    Không có người dùng nào.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        )}
      </Card>

      {data && (
        <p className="text-xs text-slate-500">Tổng: {data.count} người dùng</p>
      )}

      {editId && <EditUserDialog id={editId} onClose={() => setEditId(null)} />}
    </div>
  )
}

const editSchema = z.object({
  username: z.string().min(1, 'Bắt buộc'),
  last_name: z.string().optional(),
  first_name: z.string().optional(),
  phone: z.string().optional(),
})

type EditValues = z.infer<typeof editSchema>

function EditUserDialog({ id, onClose }: { id: UUID; onClose: () => void }) {
  const { data: user, isLoading } = useUser(id)
  const updateUser = useUpdateUser()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    values: user
      ? {
          username: user.username,
          last_name: user.last_name ?? '',
          first_name: user.first_name ?? '',
          phone: user.phone ?? '',
        }
      : undefined,
  })

  const onSubmit = (values: EditValues) => {
    updateUser.mutate(
      { id, payload: values },
      {
        onSuccess: () => {
          toast.success('Đã cập nhật người dùng')
          onClose()
        },
        onError: (err) => toast.error(getApiErrorMessage(err, 'Cập nhật thất bại')),
      },
    )
  }

  return (
    <Dialog open onClose={onClose} title="Sửa người dùng">
      {isLoading || !user ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
          <Spinner /> Đang tải...
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input value={user.email} disabled />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username">Tên đăng nhập</Label>
            <Input id="username" {...register('username')} />
            {errors.username && (
              <p className="text-xs text-red-600">{errors.username.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="last_name">Họ</Label>
              <Input id="last_name" {...register('last_name')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="first_name">Tên</Label>
              <Input id="first_name" {...register('first_name')} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input id="phone" {...register('phone')} />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={updateUser.isPending}>
              {updateUser.isPending && <Spinner />}
              Lưu
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
