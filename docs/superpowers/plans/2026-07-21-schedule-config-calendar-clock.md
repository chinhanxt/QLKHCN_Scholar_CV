# Auto-Scheduler Calendar & Analog Clock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement interactive Visual Calendar and SVG Analog Clock Widgets for the **Cấu Hình Lịch Auto-Scan** card on `/scholar/auto-scheduler`.

**Architecture:** Update `ScholarAutoSchedulerPage.tsx` schedule configuration section. Add calendar state for month navigation (`calendarDate`), weekday & day-of-month picker handlers, and SVG Analog Clock component with dynamic clock hands rotation calculated from `preferred_hour`.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons (`Calendar`, `Clock`, `ChevronLeft`, `ChevronRight`, `Settings`).

---

### Task 1: Build Interactive Calendar & SVG Analog Clock Widgets in ScholarAutoSchedulerPage

**Files:**
- Modify: `frontend/src/pages/ScholarAutoSchedulerPage.tsx`

- [ ] **Step 1: Add Calendar View State in ScholarAutoSchedulerPage**

In `frontend/src/pages/ScholarAutoSchedulerPage.tsx`:
Add state for active month navigation in calendar:
```typescript
const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date())
```

Add month navigation functions:
```typescript
const handlePrevMonth = () => {
  setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
}
const handleNextMonth = () => {
  setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
}
```

- [ ] **Step 2: Build Interactive Calendar Widget UI**

Render month header (`Tháng M, YYYY`) with `<` and `>` buttons.
Render weekday grid (`CN`, `T2`, `T3`, `T4`, `T5`, `T6`, `T7`).
Calculate days of month array.
Render day buttons with circular active highlight (`bg-[#005b9a] text-white font-bold shadow-md`).
Clicking a day sets `preferred_day_of_month` and `preferred_weekday`.

- [ ] **Step 3: Build Interactive SVG Analog Clock Widget UI**

Render clock face:
- Circular face (`w-44 h-44 border-4 border-slate-800 rounded-full bg-white relative shadow-lg mx-auto flex items-center justify-center`).
- Hour markers (12 tick marks).
- Hour Hand: `<div style={{ transform: `rotate(${((config.preferred_hour || 2) % 12) * 30}deg)` }} className="w-1.5 h-12 bg-slate-900 absolute top-4 left-1/2 -translate-x-1/2 origin-bottom rounded-full transition-transform duration-300" />`.
- Minute Hand: `<div style={{ transform: 'rotate(0deg)' }} className="w-1 h-16 bg-rose-500 absolute top-2 left-1/2 -translate-x-1/2 origin-bottom rounded-full transition-transform duration-300" />`.
- Pivot center point.
- Digital Time Selector underneath: Hour dropdown / stepper, Minute (00), AM/PM badge.

- [ ] **Step 4: Verify build & type checking**

Run: `npm run build` in `frontend` directory.
Expected: Build succeeds with 0 errors.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/pages/ScholarAutoSchedulerPage.tsx docs/
git commit -m "feat(scholar): add visual calendar and SVG analog clock widgets to schedule config"
```
