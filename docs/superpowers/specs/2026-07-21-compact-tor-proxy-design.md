# Design Spec: Ultra-Compact Tor Proxy Gateway Widget

**Date:** 2026-07-21  
**Status:** Approved  
**Target File:** `frontend/src/pages/ScholarAutoSchedulerPage.tsx`  

---

## 1. Overview
Redesign the **Trạng Thái Tor Proxy Gateway** section on `/scholar/auto-scheduler` to be ultra-compact, removing heavy diagram components and integrating the 2 proxy ports (`SOCKS5 9050` and `Control 9051`) cleanly into a compact status bar and activation button.

---

## 2. Component Design Specifications

### A. Compact Card Container
- Container: `p-5 rounded-3xl bg-white border border-slate-200/80 shadow-md space-y-3 flex flex-col justify-between`.

### B. Header & Status Pill
- Icon & Title: `ShieldAlert` icon in indigo container, Title "Tor Proxy Gateway", IP badge (`IP: 185.xxx.xxx.xxx`).
- Status Badge: `● ONLINE` (`bg-emerald-50 text-emerald-700 border-emerald-200`) or `○ NGẮT KẾT NỐI`.

### C. 2-Port Quick Badges
- Port 9050 (SOCKS5): `bg-slate-100/80 font-mono text-xs font-bold text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5`
- Port 9051 (Control): `bg-slate-100/80 font-mono text-xs font-bold text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5`

### D. Integrated Action Button with 2 Ports
- Rotation Button (NEWNYM):
  `🔄 Kích Hoạt Đổi IP Tor (SOCKS5: 9050 • Control: 9051)`
  - Styling: `w-full px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#005b9a] via-indigo-600 to-indigo-700 hover:from-[#004b80] hover:to-indigo-800 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-200`.

---

## 3. Verification & Testing Plan
- Verify IP rotation handler (`handleRotateIp`) works when clicking button.
- Verify 2 port numbers (9050 & 9051) are clearly displayed.
- Run `npm run build` to verify 0 errors.
