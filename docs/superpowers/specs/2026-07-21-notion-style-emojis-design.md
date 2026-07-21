# Design Spec: Notion-Style Emoji Icons Clean Redesign

**Date:** 2026-07-21  
**Status:** Approved  
**Target File:** `frontend/src/pages/ScholarAutoSchedulerPage.tsx`  

---

## 1. Overview
Clean up `/scholar/auto-scheduler` by removing bulky colorful background icon container boxes and Lucide SVG icons. Replace them with minimal, clean Notion-style emoji icons inline with headings and buttons:
- `📥` for Bulk Import & CV operations
- `🛡️` for Tor Proxy Gateway
- `🔌` for SOCKS5 Proxy
- `⚡` for Control Port / Action triggers
- `⚙️` for Schedule Configuration
- `📋` for Logs & Terminal Activity
- `📊` for Author Status Table
- `🔄` for Refresh / IP Rotate / Rescan actions
- `🗑️` for Delete / Clear actions
- `💾` for Save actions
- `✖` for Close / Cancel actions

---

## 2. Component Design Specifications

### A. Card 1: Bulk Import CV Card
- Title: `📥 Nhập Danh Sách Hồ Sơ CV Tác Giả` (No colored icon box wrapper).
- Header Action Buttons:
  - `📋 Nhật Ký ({logs.length})`
  - `🔄 Làm mới`
- Textarea & Submit Button: `🚀 Nhập CV & Kích Hoạt Quét Ngay`.

### B. Card 2: Tor Proxy Gateway Card
- Title: `🛡️ Tor Proxy Gateway` (No colored icon box wrapper).
- Badges: `🔌 SOCKS5 Proxy` & `⚡ Control Port`.
- Button: `🔄 Đổi IP Tor Ngẫu Nhiên (9050 • 9051)`.

### C. Card 3: Auto-Scan Schedule Summary Card
- Title: `⚙️ Cấu Hình Lịch Auto-Scan` (No colored icon box wrapper).
- Button: `⚙️ Cấu Hình Thời Gian Quét`.

### D. Card 4: Author Status Table Card
- Title: `📊 Trạng Thái Tự Động Quét CV Tác Giả` (No colored icon box wrapper).
- Batch Action Button: `⚡ Quét Ngay Tác Giả Đã Chọn`.
- Single Row Action Button: `🔄 Quét lại`.

### E. Floating Modals
- Log Modal Title: `📋 Nhật Ký Hoạt Động & Kết Quả Quét CV`.
- Schedule Modal Title: `⚙️ Cấu Hình Thời Gian Quét Auto-Scan`.
- All modal buttons and category pills using Notion emojis.

---

## 3. Verification & Testing Plan
- Verify page renders cleanly without any heavy colorful SVG icon box wrappers.
- Test modal popups render Notion emojis cleanly.
- Run `npm run build` to verify 0 errors.
