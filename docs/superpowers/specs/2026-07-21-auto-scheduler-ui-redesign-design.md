# Design Spec: Auto-Scheduler Visual UI Redesign (Soft Neumorphic & Modern Light Theme)

**Date:** 2026-07-21  
**Status:** Approved  
**Target File:** `frontend/src/pages/ScholarAutoSchedulerPage.tsx`  

---

## 1. Overview
Redesign the user interface of the **Scholar Auto Scheduler & Tor Control** page (`/scholar/auto-scheduler`) to enhance visual aesthetics, clarity, and ease of use, while **maintaining 100% of existing workflows and functional business logic**.

Visual Design Highlights:
- Soft Light Theme (`bg-white`, `rounded-3xl`, `shadow-sm shadow-slate-200/60`, `border-slate-200/80`).
- Interactive Visual Calendar & Time Slot Selector for Schedule Config (Pill buttons for weekdays Mon-Sun, 31-day grid for Monthly, Time slot badges for Hours).
- Visual Tor Proxy Status Widget with IP multi-relay connection map and status indicator.
- Rebranded Bulk CV Importer with format badges, auto-detection counter, and clean code font textarea.
- Preserved Author Avatar (`User` icon) with soft status badges (`UPDATED`, `UP_TO_DATE`, `FAILED_CAPTCHA`, `PENDING`).

---

## 2. Component Design & Layout

### A. Header & Top Action Bar
- Page Title: **Tự Động Hóa CV Scholar & Tor Control**
- Subtitle: *"Hệ thống cào ngầm lý lịch khoa học tự động & Bảo vệ danh tính IP với Tor Multi-Hop Proxy"*
- Buttons:
  - `📋 Xem Nhật Ký Cào Dữ Liệu (N)` (launches floating log modal)
  - `🔄 Làm mới`

### B. Tor Proxy Status Widget (`Tor Status & Control Card`)
- Header status pill: `● ONLINE - Sẵn sàng bảo vệ IP` (green) or `○ NGẮT KẾT NỐI` (red).
- Relay Connection Map Diagram:
  - Visual nodes: `[Web Server] ➔ [Tor Node 1] ➔ [Tor Node 2] ➔ [Exit Node IP] ➔ [Google Scholar]`
- Port info grid:
  - SOCKS5 Proxy Port: `127.0.0.1:9050`
  - Control Port (NEWNYM): `127.0.0.1:9051`
- Action Buttons:
  - `🔄 Đổi IP Tor Ngẫu Nhiên Ngay (NEWNYM)` (indigo button)
  - `⚡ Khởi Động Tor Container (Docker)` (if offline)

### C. Cấu Hình Lịch Auto-Scan (`Schedule Config Card`)
- Toggle Switch: **Bật Lịch Hẹn Giờ Tự Động**
- Frequency Tabs: 📅 **Hằng Tuần** | 🗓️ **Hằng Tháng** | ⚡ **Hằng Ngày**
- Visual Day Selector:
  - **Weekly:** 7 Pill buttons (`Thứ 2`, `Thứ 3`, `Thứ 4`, `Thứ 5`, `Thứ 6`, `Thứ 7`, `Chủ Nhật`).
  - **Monthly:** 31 Grid buttons (`1` to `31`).
- Visual Hour Slot Selector:
  - Time slot buttons (00:00 to 23:00) grouped into Morning, Afternoon, Evening, Night indicators.
- Quota & Delay Input Cards:
  - Batch size per hour (`CV/Giờ`)
  - Delay Min & Max (`Giây`)
- Button: `Lưu Cấu Hình Hẹn Giờ`

### D. Nhập Danh Sách CV Tác Giả (`Bulk Import Card`)
- Title: **📥 Nhập Danh Sách Hồ Sơ CV Tác Giả**
- Format badges:
  - `Ví dụ ID: q81c5sAAAAAJ`
  - `Ví dụ URL: https://scholar.google.com/citations?user=...`
- Textarea with monospace font & live counter (`Đã phát hiện X ID/URL`).
- Button: `🚀 Nhập CV & Kích Hoạt Quét Ngay`

### E. Trạng Thái Tự Động Quét CV Tác Giả (`Author Scan Table Card`)
- Keep `User` icon for author avatars.
- Selection checkboxes & batch action `Quét Lại Trực Tiếp (N Đã Chọn)`.
- Status Badges:
  - `UPDATED`: Soft blue pill (`bg-blue-50 text-blue-700 border-blue-200`)
  - `UP_TO_DATE`: Soft green pill (`bg-emerald-50 text-emerald-700 border-emerald-200`)
  - `FAILED_CAPTCHA`: Soft red pill (`bg-rose-50 text-rose-700 border-rose-200`)
  - `PENDING`: Soft gray pill (`bg-slate-100 text-slate-600 border-slate-200`)
- Row Action: `Quét lại` button.

---

## 3. Verification & Testing Plan
- Test Schedule Config interaction (selecting Weekday, Day of Month, Hour, saving config).
- Test Tor Proxy IP rotation button.
- Test Bulk Import text parsing & submit.
- Test Author table selection and single/bulk scan triggers.
- Run `npm run build` to verify 0 TypeScript/build errors.
