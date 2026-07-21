# Design Spec: Compact Main Cards & Floating Schedule Config Modal UI Redesign

**Date:** 2026-07-21  
**Status:** Approved  
**Target File:** `frontend/src/pages/ScholarAutoSchedulerPage.tsx`  

---

## 1. Overview
Redesign the top section of `/scholar/auto-scheduler` to eliminate excess blank space:
1. **Main Page Top Cards:** 2 compact cards with content-fitted height placed side-by-side (`grid grid-cols-1 md:grid-cols-2 gap-5`).
   - Card 1: **Tor Proxy Gateway Card** (Header, Exit IP, 9050 & 9051 port badges, IP rotate button).
   - Card 2: **Auto-Scan Schedule Status Card** (Activation toggle, schedule summary pill, and `⚙️ Cấu Hình Thời Gian Quét` button).
2. **Floating Schedule Config Modal (`isScheduleModalOpen`):**
   A light-theme floating modal dialog opening when `⚙️ Cấu Hình Thời Gian Quét` is clicked.

---

## 2. Component Design Specifications

### A. Main Page Compact Cards (Content-Fitted Height)
- **Tor Proxy Card:**
  - Header: `ShieldAlert` icon, Title "Tor Proxy Gateway", Status pill (`● ONLINE`), Exit IP badge.
  - Port Badges: `SOCKS5: 9050` and `Control: 9051`.
  - Button: `🔄 Đổi IP Tor Ngẫu Nhiên` (`bg-[#005b9a] hover:bg-[#004b80] text-white font-bold py-2 px-4 rounded-xl text-xs`).
- **Auto-Scan Schedule Summary Card:**
  - Header: `Settings` icon, Title "Cấu Hình Lịch Auto-Scan", Active toggle switch.
  - Active Schedule Summary Pill:
    `📅 Mode Hằng Tuần • Thứ 2 • 02:00 (Đêm) • 8 CV/Giờ • Delay 8-15s`
  - Button: `⚙️ Cấu Hình Thời Gian Quét` (`bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-5 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer`).

### B. Floating Schedule Config Modal Dialog (`isScheduleModalOpen`)
- Backdrop: `fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4`.
- Modal Window: `bg-white rounded-3xl border border-slate-200 w-full max-w-3xl shadow-2xl overflow-hidden animate-scale-in`.
- Header:
  - Title: "Cấu Hình Thời Gian Quét Auto-Scan"
  - Subtitle: "Thiết lập chu kỳ lặp lại, mốc giờ kích hoạt & hạn ngạch cào"
  - Close button (`X`).
- Body Content:
  1. **3 Mode Selection Bar (Radio buttons):**
     - 📅 `Hằng Tuần` | 🗓️ `Hằng Tháng` | ⚡ `Hằng Ngày`.
  2. **Calendar UI (Matching Reference Image 2 - October 2023 style):**
     - Month & Year Title: `October 2023` with `<` and `>` arrows.
     - Weekday headers: `SUN`, `MON`, `TUE`, `WED`, `THU`, `FRI`, `SAT`.
     - Days: Padding days in `text-slate-300 font-medium`. Active day in vibrant indigo rounded-xl badge: `bg-[#4F46E5] text-white rounded-xl shadow-md font-bold w-8 h-8 flex items-center justify-center mx-auto`.
  3. **Analog Clock & Digital Time Picker.**
  4. **Throttling Inputs Grid:** `CV/Giờ`, `Delay Min`, `Delay Max`.
- Footer Actions:
  - `Hủy` button (`bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl px-5 py-2 text-xs font-bold`).
  - `Lưu Cấu Hình` button (`bg-[#4F46E5] text-white hover:bg-indigo-700 rounded-xl px-6 py-2 text-xs font-bold shadow-md`).

---

## 3. Verification & Testing Plan
- Test clicking `⚙️ Cấu Hình Thời Gian Quét` to open modal.
- Test mode switching and date/time picking inside modal.
- Test saving config inside modal and verifying schedule summary card updates.
- Test main page cards layout fits content cleanly with 0 excess blank space.
- Run `npm run build` to verify 0 errors.
