# Design Spec: Auto-Scheduler Floating Modal Log System (Vietnamese & Light Theme)

**Date:** 2026-07-21  
**Status:** Approved  
**Target File:** `frontend/src/pages/ScholarAutoSchedulerPage.tsx`  

---

## 1. Overview
Redesign the **Scholar Auto Scheduler & Tor Control** page (`/scholar/auto-scheduler`) log system:
1. Replace inline dark terminal box with a **Floating Modal Dialog (Form nổi)** triggered by a prominent header action button: `📋 Nhật Ký Cào Dữ Liệu`.
2. Use a clean **Light Theme (Màn trắng - `bg-white`)** matching the rest of the application styling.
3. 100% Vietnamese localization for all labels, statuses, categories, badges, and messages (except proper nouns like `Tor`, `Google Scholar`, `ID`, `SOCKS5`).
4. Simplify logging: Focus on recording event history (cào/quét CV, lỗi, thành công, nhập CV, đổi IP Tor, lưu cấu hình) without complex real-time streaming polling overhead.

---

## 2. Log Model & Categories (Vietnamese)

```typescript
export interface AutoSchedulerLogEntry {
  id: string
  timestamp: string // HH:mm:ss DD/MM/YYYY
  category: 'CÀO_CV' | 'NHẬP_CV' | 'PROXY_TOR' | 'CẤU_HÌNH' | 'HỆ_THỐNG'
  level: 'THÀNH_CÔNG' | 'BÁO_LỖI' | 'CẢNH_BÁO' | 'THÔNG_TIN'
  action: string // Tên hành động tiếng Việt
  target?: string // Tên tác giả hoặc Scholar ID
  details: string // Nội dung chi tiết kết quả cào / lỗi
}
```

---

## 3. UI Component Architecture

### A. Action Button on Main Page
- Positioned in page header / section header.
- Text: `📋 Nhật Ký Cào Dữ Liệu` with counter badge `(N)`.

### B. Floating Log Modal (`isLogModalOpen`)
- White background (`bg-white`), `rounded-3xl`, `max-w-4xl`, backdrop blur.
- Header:
  - Title: **"Nhật Ký Hoạt Động & Kết Quả Quét CV"**
  - Subtitle: *"Lưu vết thông tin cào dữ liệu, trạng thái thành công và báo lỗi"*
  - Close button (`X`).
- Filters:
  - Search input: `Tìm kiếm từ khóa, tên tác giả, ID...`
  - Category filter select: `Tất cả danh mục`, `Quét & Cào CV`, `Nhập danh sách CV`, `Proxy Tor`, `Cấu hình hệ thống`.
  - Level filter select: `Tất cả kết quả`, `Thành công`, `Báo lỗi`, `Cảnh báo`, `Thông tin`.
- Log Item List (Light Theme):
  - Scrollable container (`max-h-[60vh]`).
  - Item card with light badges:
    - `THÀNH_CÔNG`: Green badge (`bg-emerald-50 text-emerald-700 border-emerald-200`)
    - `BÁO_LỖI`: Red badge (`bg-rose-50 text-rose-700 border-rose-200`)
    - `CẢNH_BÁO`: Yellow badge (`bg-amber-50 text-amber-700 border-amber-200`)
    - `THÔNG_TIN`: Blue badge (`bg-blue-50 text-blue-700 border-blue-200`)
  - Displays Timestamp, Action, Target Author, and Detailed message.
- Footer:
  - Button: `Xuất file nhật ký (TXT/JSON)`
  - Button: `Xóa nhật ký`
  - Button: `Đóng`

---

## 4. Verification & Testing Plan
- Test opening/closing the log modal.
- Verify logging when doing actions (Import CV, Scan authors, Rotate Tor IP, Save config).
- Verify filters and search work correctly in light theme modal.
- Verify TypeScript compilation via `npm run build`.
