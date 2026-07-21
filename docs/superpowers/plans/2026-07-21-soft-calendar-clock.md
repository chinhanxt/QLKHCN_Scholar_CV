# Soft Neumorphic Calendar & Clock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Schedule Config card on `/scholar/auto-scheduler` to feature soft rounded styling (`rounded-3xl`), cyan circular day badges (`bg-[#00A3E0]`), soft month/year pill dropdowns, and pastel action buttons matching the uploaded reference image.

**Architecture:** Update `ScholarAutoSchedulerPage.tsx` schedule config JSX and styling.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons (`Calendar`, `Clock`, `ChevronDown`, `CheckCircle2`).

---

### Task 1: Refine ScholarAutoSchedulerPage Calendar & Clock Styling to Match Soft Reference Image

**Files:**
- Modify: `frontend/src/pages/ScholarAutoSchedulerPage.tsx`

- [ ] **Step 1: Soft Calendar Header with Month & Year Pill Dropdowns**

In `frontend/src/pages/ScholarAutoSchedulerPage.tsx`:
Render Month and Year select controls as soft rounded pill buttons:
- Month select dropdown (`bg-slate-100/70 hover:bg-slate-100 rounded-full px-4 py-1.5 text-xs font-bold text-slate-700 border border-slate-200/70 flex items-center gap-1 cursor-pointer`)
- Year select dropdown (`bg-slate-100/70 hover:bg-slate-100 rounded-full px-4 py-1.5 text-xs font-bold text-slate-700 border border-slate-200/70 flex items-center gap-1 cursor-pointer`)

- [ ] **Step 2: Soft Calendar Weekday Headers & Day Grid**

Weekday row: `SUN`, `MON`, `TUE`, `WED`, `THU`, `FRI`, `SAT` in `text-[10px] font-bold text-slate-400 tracking-wider text-center py-2 border-b border-slate-100 mb-2`.
Days:
- Previous & Next month days in `text-slate-300 font-medium text-xs`.
- Current month days in `text-slate-800 font-bold text-xs`.
- Selected active day: `bg-[#00A3E0] text-white font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-md shadow-cyan-400/40 scale-105 transition-all`.

- [ ] **Step 3: Soft Analog Clock Face & Digital Time Steppers**

Clock face: `w-44 h-44 border-4 border-slate-100 rounded-full bg-slate-50/60 relative shadow-inner mx-auto flex items-center justify-center border-slate-200/60`.
Time steppers: Soft pill select controls `[ 09 ▼ ]` : `[ 00 ▼ ]` `[ AM/PM ▼ ]`.

- [ ] **Step 4: Soft Pastel Save Button**

Confirm button: `bg-[#E6F4EA] text-[#137333] hover:bg-[#D2E3FC] hover:text-[#174EA6] font-bold py-2.5 px-6 rounded-full border border-emerald-200/60 shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2`.

- [ ] **Step 5: Verify build & type checking**

Run: `npm run build` in `frontend` directory.
Expected: Build succeeds with 0 errors.

- [ ] **Step 6: Commit changes**

```bash
git add frontend/src/pages/ScholarAutoSchedulerPage.tsx docs/
git commit -m "feat(scholar): update schedule config UI with soft neumorphic calendar, cyan active pill, and pastel buttons"
```
