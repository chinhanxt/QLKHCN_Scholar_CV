# Design Spec: Soft Neumorphic Calendar & Clock UI Redesign

**Date:** 2026-07-21  
**Status:** Approved  
**Target File:** `frontend/src/pages/ScholarAutoSchedulerPage.tsx`  

---

## 1. Overview
Redesign the **Cấu Hình Lịch Auto-Scan** section on `/scholar/auto-scheduler` to match the exact soft pill aesthetic, rounded styling (`rounded-3xl`), cyan circular active highlight, and pastel pill action buttons from the reference image uploaded by the user.

---

## 2. Component Design Specifications

### A. Soft Calendar Card (Select Date)
- Card Container: `bg-white rounded-3xl p-5 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-3`.
- Header Selectors:
  - 2 Soft Pill Buttons for Month & Year:
    - Month Selector: `[ Tháng X ▼ ]` (`bg-slate-100/70 hover:bg-slate-100 rounded-full px-4 py-1.5 text-xs font-bold text-slate-700 border border-slate-200/70 flex items-center gap-1 cursor-pointer`)
    - Year Selector: `[ Năm YYYY ▼ ]` (`bg-slate-100/70 hover:bg-slate-100 rounded-full px-4 py-1.5 text-xs font-bold text-slate-700 border border-slate-200/70 flex items-center gap-1 cursor-pointer`)
- Weekday Row:
  - `SUN`, `MON`, `TUE`, `WED`, `THU`, `FRI`, `SAT`
  - Typography: `text-[10px] font-bold text-slate-400 tracking-wider text-center py-2 border-b border-slate-100 mb-2`.
- Day Grid:
  - Empty/Padding Days (Prev & Next Month): `text-slate-300 font-medium text-xs`.
  - Current Month Days: `text-slate-800 font-bold text-xs`.
  - Active Selected Day: Vibrant Cyan Pill Circle (`bg-[#00A3E0] text-white font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-md shadow-cyan-400/40 scale-105 transition-all`).

### B. Soft Analog Clock Card (Set Time)
- Card Container: `bg-white rounded-3xl p-5 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-3 flex flex-col justify-between`.
- Analog Clock Face:
  - Outer ring: `w-44 h-44 border-4 border-slate-100 rounded-full bg-slate-50/60 relative shadow-inner mx-auto flex items-center justify-center border-slate-200/60`.
  - Hour Tick Marks: 12 soft tick marks (`bg-slate-300`).
  - Hour & Minute Hands: Smooth rounded tips with subtle drop-shadows.
- Digital Time Controls:
  - Soft Pill Selectors: `[ 09 ▼ ]` : `[ 00 ▼ ]` `[ AM/PM ▼ ]` (`bg-slate-100/70 border border-slate-200/70 rounded-2xl px-3 py-1.5 font-bold text-xs text-slate-700`).

### C. Soft Pastel Action Buttons
- Confirm / Save Button: Soft pastel lime/emerald pill button:
  - `bg-[#E6F4EA] text-[#137333] hover:bg-[#D2E3FC] hover:text-[#174EA6] font-bold py-2.5 px-6 rounded-full border border-emerald-200/60 shadow-xs transition-all cursor-pointer`

---

## 3. Verification & Testing Plan
- Verify month and year selection.
- Verify day selection highlights active day with cyan circular pill badge.
- Verify clock hands rotate dynamically with hour selection.
- Verify soft pastel action buttons.
- Run `npm run build` to verify 0 errors.
