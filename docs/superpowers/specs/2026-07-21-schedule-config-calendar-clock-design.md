# Design Spec: Auto-Scheduler Interactive Calendar & Analog Clock Schedule Config

**Date:** 2026-07-21  
**Status:** Approved  
**Target File:** `frontend/src/pages/ScholarAutoSchedulerPage.tsx`  

---

## 1. Overview
Redesign the **Cấu Hình Lịch Auto-Scan** section on `/scholar/auto-scheduler` to feature a high-polish **Interactive Calendar Widget** (Select Date) and an **Interactive SVG Analog Clock Widget** (Set Time), matching the visual reference styling in uploaded user images.

---

## 2. Component Specifications

### A. Visual Interactive Calendar Widget (Select Date)
- Month Header: Month name & Year (e.g. `Tháng 7, 2026`) with `<` and `>` navigation controls to change month view.
- Weekday Headers: `CN`, `T2`, `T3`, `T4`, `T5`, `T6`, `T7`.
- Day Grid: Full calendar grid showing days of the current month.
- Selection Behavior:
  - Active selected date is highlighted with a circular active badge (`bg-[#005b9a] text-white font-bold shadow-md`).
  - Clicking any date updates `config.preferred_weekday` (0-6) for Weekly mode or `config.preferred_day_of_month` (1-31) for Monthly mode.

### B. Visual Interactive Analog Clock Widget (Set Time)
- SVG Clock Face:
  - Outer clock ring, hour tick marks (1 to 12), center pivot.
  - Hour Hand: Dynamically rotated based on `config.preferred_hour` (`(hour % 12) * 30 + (minute / 2)` degrees).
  - Minute Hand: Fixed or set to 00.
  - Smooth SVG rendering matching the reference design image.
- Time Picker Control Bar:
  - Hour Select (`00` to `23` or `01` to `12`).
  - Minute Select (`00`).
  - AM/PM indicator badge.
  - Clicking/selecting an hour updates `config.preferred_hour` and animates the clock hands.

### C. Config Inputs & Actions
- Throttling input cards: `Hạn ngạch CV/Giờ`, `Delay Min (s)`, `Delay Max (s)`.
- Submit button: `Lưu Cấu Hình Hẹn Giờ` (`bg-[#0f172a] text-white hover:bg-slate-800`).

---

## 3. Verification & Testing Plan
- Test navigating months in Calendar Widget.
- Test selecting dates on Calendar Widget and checking state updates.
- Test selecting hours on Clock Widget and verifying clock hand rotation.
- Test saving config to backend API (`scholarApi.updateAutoScanConfig`).
- Run `npm run build` to verify 0 TypeScript/build errors.
