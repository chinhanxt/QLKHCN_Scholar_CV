# Design System — HUTECH Program Frontend

> **Mục đích:** Tài liệu tham chiếu phong cách & giao diện của frontend, để mọi UI mới
> đồng nhất với hệ thống hiện có. Đây là mô tả **đúng theo code thực tế** (không phải
> thiết kế lý tưởng) — nguồn: `src/index.css` (design tokens), `src/components/`, `src/App.tsx`.
> **Cập nhật:** 2026-06-25

---

## 1. Tech stack giao diện

| Lớp | Công nghệ |
|---|---|
| Framework | **React 19** + **Vite 8** + TypeScript |
| Styling | **Tailwind CSS v4** (qua `@tailwindcss/vite`, cấu hình bằng `@theme` trong CSS — **không có `tailwind.config.js`**) |
| Tiện ích class | `cn()` = `clsx` + `tailwind-merge` (`src/lib/utils.ts`) + `class-variance-authority` |
| Icon | **lucide-react** (toàn bộ icon trong app) |
| Routing | React Router 7 |
| Server state | TanStack Query 5 (`@tanstack/react-query`) |
| Client state | Zustand 5 (`auth.store`, `ui.store`, `version-context.store`…) |
| Form | react-hook-form + **zod** (`@hookform/resolvers`) |
| Toast | **sonner** (`<Toaster position="top-right">`) |
| Biểu đồ | recharts |
| Sơ đồ / flow | `@xyflow/react`, `konva` / `react-konva` |
| Kéo-thả | `@dnd-kit/*` |
| Soạn thảo rich-text | TipTap (`@tiptap/*`) |
| Export | `jspdf`, `html-to-image` |

**Không có thư viện component dựng sẵn** (shadcn/ui, Radix, MUI…). Style đi theo *tinh thần*
shadcn (tokens + `cn()` + lucide), nhưng button/card/modal đều viết tay bằng chuỗi utility
Tailwind hoặc component nội bộ trong `src/components/shared/`.

---

## 2. Design tokens

Khai báo trong `src/index.css` qua `@theme`. **Luôn dùng token, không hardcode hex.**

### 2.1 Màu (semantic — dùng qua class `bg-*` / `text-*` / `border-*`)

| Token | Hex | Tham chiếu | Dùng cho |
|---|---|---|---|
| `primary` | `#1d4ed8` | blue-700 | Hành động chính, link active, ring focus |
| `primary-foreground` | `#ffffff` | | Chữ trên nền primary |
| `background` | `#f8fafc` | slate-50 | Nền toàn trang (`body`) |
| `foreground` | `#020817` | ~slate-950 | Chữ chính |
| `card` / `popover` | `#ffffff` | | Nền card, modal, popover |
| `card-foreground` | `#020817` | | Chữ trong card |
| `secondary` / `muted` | `#f1f5f9` | slate-100 | Nền phụ, vùng disabled/nhẹ |
| `muted-foreground` | `#64748b` | slate-500 | Chữ phụ, mô tả, placeholder |
| `accent` | `#e2e8f0` | slate-200 | Nền hover của nút phụ / item |
| `border` / `input` | `#e2e8f0` | slate-200 | Viền mặc định, viền input |
| `ring` | `#1d4ed8` | blue-700 | Vòng focus (`focus-visible:ring-ring`) |
| `sidebar` | `#f1f5f9` | slate-100 | Nền sidebar |
| `sidebar-foreground` | `#334155` | slate-700 | Chữ nav |
| `sidebar-accent` | `#e2e8f0` | slate-200 | Nền hover nav |
| `destructive` | `#ef4444` | red-500 | Xóa, lỗi, nút nguy hiểm |
| `success` | `#22c55e` | green-500 | Thành công |
| `warning` | `#eab308` | yellow-500 | Cảnh báo |

> **Lưu ý màu thương hiệu:** logo HUTECH ở header sidebar dùng `#004b93` (xanh đậm thương hiệu)
> — **khác** với `primary` `#1d4ed8`. `#004b93` chỉ dành cho chữ thương hiệu cạnh logo, không
> dùng cho nút/link.

> ⚠ **Không dùng `text-gray-*` cho chữ** — trong Tailwind v4 ở dự án này chúng dễ render mờ/khuất.
> Dùng `text-foreground` / `text-muted-foreground`. (Các thang màu `*-50/700/200` chỉ xuất hiện
> trong **status badge**, xem §8.)

### 2.2 Bo góc (radius)

| Token | Giá trị | Dùng cho |
|---|---|---|
| `rounded-sm` | 0.25rem | Chi tiết nhỏ |
| `rounded-md` | 0.375rem | Nút icon nhỏ, ô vuông |
| `rounded-lg` | 0.5rem | **Button, input, nav item** |
| `rounded-xl` | 0.75rem | **Card, panel, table, modal nhỏ** |
| `rounded-2xl` | (Tailwind 1rem) | Modal lớn / nổi bật |
| `rounded-full` | | Badge pill, avatar, scrollbar thumb |

### 2.3 Font

- **Inter** (Google Fonts, nạp ở `index.html`), weight **400 / 500 / 600 / 700**.
- `--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif` → class `font-sans` (đã set trên `body`).
- `lang="vi"`, `antialiased`.

---

## 3. Typography scale (thực dùng)

| Vai trò | Class | Ghi chú |
|---|---|---|
| Tiêu đề trang (H1) | `text-2xl font-bold text-foreground` | Mẫu phổ biến nhất |
| Tiêu đề section (H2/H3) | `text-xl font-semibold text-foreground` | |
| Tiêu đề trong card/modal | `text-lg font-semibold text-card-foreground` | |
| Body | `text-sm` | Mặc định hầu hết UI |
| Phụ / mô tả | `text-sm text-muted-foreground` hoặc `text-xs text-muted-foreground` | |
| Nhãn nav | `text-[15px] font-medium` (mục cha) / `text-sm font-medium` (mục con) | |
| Badge | `text-xs font-medium` | |

---

## 4. Layout & AppShell

Khung chính: `src/components/layout/AppShell.tsx`.

```
<div class="flex h-screen overflow-hidden bg-background">
  <aside> Sidebar (w-64 mở / w-16 thu) </aside>
  <main class="flex-1 overflow-y-auto"> <div class="w-full px-6 py-6"> <Outlet/> </div> </main>
</div>
```

**Sidebar:**
- `border-r border-border bg-sidebar`, chuyển trạng thái `transition-all duration-300 ease-in-out`,
  rộng `w-64` (mở) ↔ `w-16` (thu gọn).
- Header logo cao `h-16`, `border-b`. Tên app `text-[17px] font-bold text-[#004b93]`.
- Nav item (mục cha): `rounded-lg px-3 py-3 text-[15px] font-medium transition-colors`
  - **Active:** `bg-primary/10 text-primary`
  - **Hover:** `hover:bg-sidebar-accent hover:text-sidebar-accent-foreground`
  - Icon `size={22}`, nhãn fade khi thu gọn (`opacity` + `duration-300`).
- Nhóm có submenu (Chương trình ĐT, Học phần, Yêu cầu, Quản lý) bung/thu bằng
  `grid-rows-[1fr]`↔`grid-rows-[0fr]` + `transition-[grid-template-rows] duration-300`. Mục con:
  `pl-4`, `rounded-lg px-3 py-2.5 text-sm font-medium`, icon `size={18}`, cùng quy ước active/hover.
- Avatar: `h-8 w-8 rounded-full bg-primary text-primary-foreground text-xs font-bold` (chữ cái đầu tên).
- Vùng cuộn nav dùng `.custom-scrollbar` (thanh cuộn mảnh 6px, màu `border`).

**Nội dung trang:** padding chuẩn `px-6 py-6`.

---

## 5. Buttons (viết inline — không có component `<Button>`)

Nút là chuỗi utility Tailwind lặp lại nhất quán. Mẫu chuẩn (sao chép nguyên xi để đồng bộ):

**Primary**
```
inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold
text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60
disabled:cursor-not-allowed
```

**Secondary / Outline**
```
inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2
text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60
```

**Destructive**
```
rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground
transition-colors hover:bg-destructive/90
```

**Ghost / icon-only** (vd nút đóng, toggle): `rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors`

**Kích thước:**
- Mặc định: `px-4 py-2 text-sm`.
- Nhỏ (trong bảng / hàng): `px-3 py-1.5 text-xs` hoặc `text-sm`.
- Nút chính thường thêm `shadow-sm`.

> Quy ước: nút thường có `font-semibold`, icon lucide đặt trước nhãn với `gap-2`, hiệu ứng
> `transition-colors`, trạng thái disabled `disabled:opacity-60`.

---

## 6. Cards & panels

Mẫu nền tảng:
```
rounded-xl border border-border bg-card shadow-sm        ← card cơ bản
rounded-xl border border-border bg-card p-6 shadow-sm    ← card có nội dung
rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md  ← card click được
```
- Card: `rounded-xl` + `border-border` + `bg-card` + `shadow-sm`. Padding `p-5` hoặc `p-6`.
- Vùng nhấn nhẹ / highlight: `bg-primary/5`.
- Modal lớn dùng `rounded-2xl ... shadow-2xl` (xem §7).

---

## 7. Modals & dialogs

Overlay + panel (mẫu từ `ConfirmDialog.tsx`):
```
Overlay : fixed inset-0 z-50 flex items-center justify-center  (+ p-4 cho modal lớn)
Backdrop: absolute inset-0 bg-black/40 backdrop-blur-sm
Panel   : relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6
          shadow-2xl animate-in fade-in zoom-in-95 duration-200
```
- Nút đóng `X` (`lucide` size 18) góc trên-phải: `absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:text-foreground`.
- Tiêu đề `text-lg font-semibold text-card-foreground`; mô tả `mt-2 text-sm text-muted-foreground`.
- Hàng nút cuối: `mt-6 flex justify-end gap-3` (Hủy = outline, Xác nhận = primary/destructive).
- Variant **danger**: icon `AlertTriangle` trong `h-10 w-10 rounded-full bg-destructive/10`.
- Modal lớn hơn dùng `rounded-2xl` + `max-w-lg/xl/2xl`, đôi khi backdrop `bg-slate-950/35`.

Dùng sẵn: `ConfirmDialog` + `useConfirmDialog`, `PromptDialog` + `usePromptDialog`.

---

## 8. Status badges

Component `src/components/shared/StatusBadge.tsx`. Pill chuẩn:
```
inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset
```
Mỗi trạng thái = bộ 3 lớp `bg-{color}-50 text-{color}-700 ring-{color}-200`:

| Trạng thái | Nhãn | Màu |
|---|---|---|
| `DRAFT` | Bản nháp | slate |
| `SUBMITTED` | Đã nộp | blue |
| `PDT_REVIEWING` | Phòng ĐT đang xét duyệt | violet |
| `BGH_REVIEWING` | BGH đang xét duyệt | fuchsia |
| `UNDER_REVIEW` | Đang duyệt | amber |
| `REVISION_REQUIRED` | Cần chỉnh sửa | orange |
| `APPROVED` / `PUBLISHED` / `LOCKED` | Đã duyệt / Đã công bố | emerald |
| `ACTIVE` | Đang áp dụng | green |
| `ARCHIVED` | Lưu trữ | gray |
| (null / fallback) | — | gray / slate |

> Đây là **nơi duy nhất** dùng thang màu trực tiếp (`*-50/700/200`) thay vì token semantic,
> vì cần phổ màu rộng để phân biệt trạng thái workflow.

---

## 9. Bảng dữ liệu (DataTable)

Component `src/components/shared/DataTable.tsx` — bảng chuẩn của app:
- Khung: `rounded-xl border border-border bg-card shadow-sm overflow-hidden`, bọc `overflow-x-auto`.
- `<thead>`: `border-b border-border bg-muted/50`; `<th>`: `px-4 py-3 font-medium text-muted-foreground whitespace-nowrap`.
- `<tbody>`: `divide-y divide-border`; ô `px-4 py-3.5 text-foreground`.
- Hàng click được: `cursor-pointer hover:bg-muted/50 transition-colors`.
- **Loading:** 5 hàng skeleton `h-4 w-3/4 animate-pulse rounded bg-muted`.
- **Rỗng:** `px-4 py-12 text-center text-muted-foreground` (mặc định "Không có dữ liệu").

---

## 10. Form inputs

Class tiện ích `.form-input` (định nghĩa trong `index.css @layer base`):
```
flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm
ring-offset-background placeholder:text-muted-foreground
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
transition-shadow
```
- Select tùy biến: `Select.tsx` / `FormSelect.tsx` (`src/components/shared/`).
- Form dùng react-hook-form + zod resolver; schema gom ở `src/lib/schemas.ts`.

---

## 11. Icon (lucide-react)

Kích thước thực dùng theo ngữ cảnh:

| `size` | Dùng cho |
|---|---|
| `12`–`14` | Icon phụ trong text nhỏ, badge |
| `16` | **Mặc định** trong nút / hàng (phổ biến nhất) |
| `18` | Nút trung bình, mục nav con, nút đóng modal |
| `20`–`22` | Icon nav cha, toggle sidebar |
| `24` | Icon tiêu đề trang (header) |

---

## 12. Toast (sonner)

Cấu hình ở `App.tsx`: `position="top-right"`, **tắt mọi icon mặc định** và `closeButton={false}`.
CSS tinh chỉnh ở `index.css`:
- Bề rộng `--width: 384px`, padding `14px 16px`, `border-radius: var(--radius-lg)`.
- Tiêu đề/mô tả căn trái, `line-height 1.55`, `white-space: pre-line` (giữ nhiều dòng lỗi từ
  `getApiErrorMessage`), `overflow-wrap: anywhere`.

Lấy message lỗi API qua `src/lib/api-error.ts`.

---

## 13. Chuyển động (motion)

| Hiệu ứng | Class | Dùng khi |
|---|---|---|
| Đổi màu hover/active | `transition-colors` | Hầu hết nút, link, nav |
| Sidebar mở/thu, submenu | `duration-300 ease-in-out` (+ `transition-[grid-template-rows]`) | Sidebar, nhóm nav |
| Mở modal | `animate-in fade-in zoom-in-95 duration-200` | Dialog / modal |
| Skeleton loading | `animate-pulse` | DataTable, placeholder |
| Fade nhãn nav | `transition-opacity duration-300` | Khi thu gọn sidebar |

---

## 14. Quy ước trang danh sách (bắt buộc)

Mọi trang list **phải** tuân theo `docs/conventions/list-pagination-filtering.md` (repo backend):
- **Phân trang server-side** (`page` + `page_size`), đọc `count/next/previous/results`. Không fetch-all rồi cắt client.
- **State lọc/tìm/phân trang/tab đồng bộ lên URL** qua hook `@/hooks/useUrlFilters` (`get`/`getPage`/`set`).
- **Ô search** dùng `@/hooks/useUrlSearch` (debounce ~300ms, an toàn bộ gõ tiếng Việt/IME) —
  **không** bind `<input>` thẳng vào URL mỗi keystroke.
- Modal/view con (transient): **không** URL-sync; nếu search gọi server thì dùng `useDebounce` riêng.
- Bản mẫu tham chiếu: `ProposedCoursesTab.tsx`, `CourseCatalogPage.tsx`.

Header hub "Quản lý" dùng chung `ManagementPageHeader` (tiêu đề "Quản lý › <mục>" + chip + slot `actions`).

---

## 15. Thư mục & component tái dùng

```
src/
├─ components/
│  ├─ layout/    AppShell, AuthGuard, ManagementPageHeader
│  ├─ shared/    DataTable, StatusBadge, ConfirmDialog, PromptDialog, Select,
│  │             FormSelect, ActionDropdown, Breadcrumb, Collapse,
│  │             ApprovalWorkflowStrip, SectionApprovalBlock, useConfirmDialog, usePromptDialog
│  ├─ features/  Theo nghiệp vụ (profile, notifications, …)
│  └─ progress-diagram/  Sơ đồ tiến trình (xyflow/konva)
├─ pages/        courses, ctdt, management, program-contents, programs, syllabus-catalogs
├─ hooks/        useUrlFilters, useUrlSearch, useDebounce, …
├─ lib/          utils (cn), api-error, schemas, query-client, constants, …
├─ stores/       Zustand: auth.store, ui.store, version-context.store
└─ index.css     ← design tokens (@theme) + base + toast/scrollbar
```

**Trước khi viết UI mới:** tái dùng `DataTable`, `StatusBadge`, `ConfirmDialog`/`useConfirmDialog`,
`Select`/`FormSelect`, `ManagementPageHeader`. Nút/card sao chép mẫu utility ở §5–§6 để giữ đồng bộ.

---

## 16. Checklist khi thêm UI mới

- [ ] Dùng **token semantic** (`bg-primary`, `text-muted-foreground`, `border-border`…), không hardcode hex.
- [ ] Không dùng `text-gray-*` cho chữ → dùng `text-foreground` / `text-muted-foreground`.
- [ ] Button theo mẫu §5 (`rounded-lg`, `text-sm font-semibold`, `transition-colors`, `disabled:opacity-60`).
- [ ] Card `rounded-xl border border-border bg-card shadow-sm`; modal `rounded-xl/2xl ... shadow-2xl` + `animate-in`.
- [ ] Bảng dùng `DataTable`; trạng thái workflow dùng `StatusBadge`.
- [ ] Icon lucide, size theo §11 (16 mặc định).
- [ ] Trang list: phân trang server-side + URL-state (`useUrlFilters`/`useUrlSearch`).
- [ ] Thông báo qua `toast` (sonner) + `getApiErrorMessage`.
- [ ] Nút bị ẩn ⇔ endpoint chặn (nhất quán RBAC UI↔API); kết hợp permission + entity status cho `can_edit`.
