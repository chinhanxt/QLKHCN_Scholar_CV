# Design Spec: Top Layout Reordering & Compact Log Button

**Date:** 2026-07-21  
**Status:** Approved  
**Target File:** `frontend/src/pages/ScholarAutoSchedulerPage.tsx`  

---

## 1. Overview
Reorder the layout of `/scholar/auto-scheduler`:
1. **Remove Top Dark Banner:** Completely remove the large dark hero banner ("Tự Động Hóa CV Scholar & Tor Control").
2. **Move Bulk Import Card to Top:** Position **Nhập Danh Sách Hồ Sơ CV Tác Giả** at the top of the page.
3. **Compact Log Button:** In the Bulk Import card header, place a compact log button: `📋 Nhật Ký ({logs.length})` and `🔄 Làm mới`.
4. **Second Row:** Place the 2 compact cards side-by-side (`grid grid-cols-1 md:grid-cols-2 gap-5`):
   - Left: Tor Proxy Gateway Card
   - Right: Auto-Scan Schedule Summary Card
5. **Third Row:** Author Status Table Card.

---

## 2. Component Layout Specifications

### A. Row 1: Bulk Import CV Card (Top of Page)
- Header:
  - Left: Title `📥 Nhập Danh Sách Hồ Sơ CV Tác Giả` & Subtitle.
  - Right:
    - Compact Log Button: `📋 Nhật Ký ({logs.length})` (`bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 border border-slate-200 cursor-pointer`).
    - Compact Refresh Button: `🔄 Làm mới` (`bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 border border-slate-200 cursor-pointer`).
- Body: Monospace textarea with format chips & live detection counter (`Đã phát hiện X ID/URL`).
- Action Button: `🚀 Nhập CV & Kích Hoạt Quét Ngay`.

### B. Row 2: 2 Compact Status Cards (`grid-cols-1 md:grid-cols-2 gap-5`)
- Card 1: Tor Proxy Gateway Card (Status, Exit IP, Port 9050/9051, Rotate IP button).
- Card 2: Auto-Scan Schedule Summary Card (Active toggle, schedule summary pill, `⚙️ Cấu Hình Thời Gian Quét` button).

### C. Row 3: Author Status Table Card
- Author table with Fast Smart Check status indicators & batch triggers.

---

## 3. Verification & Testing Plan
- Test clicking `📋 Nhật Ký` button to verify floating log modal opens.
- Test bulk import functionality.
- Test IP rotate & schedule config modal.
- Run `npm run build` to verify 0 errors.
