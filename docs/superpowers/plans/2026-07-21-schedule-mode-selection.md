# Schedule Mode Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement explicit 1-out-of-3 single-choice Mode selection (`WEEKLY`, `MONTHLY`, `DAILY`) for auto-scheduler configuration with dynamic calendar date picking UI.

**Architecture:** Update `ScholarAutoSchedulerPage.tsx` frequency mode bar with radio styling. Bind mode selection to `config.frequency_type`. Render mode-specific day selection controls (Weekday pills for `WEEKLY`, 31-day grid for `MONTHLY`, Daily notice for `DAILY`).

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons (`Calendar`, `Clock`, `Zap`, `CheckCircle2`).

---

### Task 1: Update Schedule Mode Selection and Dynamic Calendar UI in ScholarAutoSchedulerPage

**Files:**
- Modify: `frontend/src/pages/ScholarAutoSchedulerPage.tsx`

- [ ] **Step 1: Render 1-of-3 Segmented Radio Mode Bar**

In `frontend/src/pages/ScholarAutoSchedulerPage.tsx`:
Render 3 mode buttons for `WEEKLY`, `MONTHLY`, `DAILY` with explicit single-choice active styling (`●` active dot, white background, shadow, border).

- [ ] **Step 2: Update Calendar Date Picker UI based on Selected Mode**

- When `frequency_type === 'WEEKLY'`: Show weekday pills (`Thứ 2` - `Chủ Nhật`) and calendar weekday highlights.
- When `frequency_type === 'MONTHLY'`: Show 31-day grid and calendar month day highlights.
- When `frequency_type === 'DAILY'`: Show daily routine info card ("⚡ Chế độ Hằng Ngày: Hệ thống sẽ tự động kích hoạt cào CV ngầm lặp lại mỗi 24 giờ vào khung giờ bên phải").

- [ ] **Step 3: Verify build & type checking**

Run: `npm run build` in `frontend` directory.
Expected: Build succeeds with 0 errors.

- [ ] **Step 4: Commit changes**

```bash
git add frontend/src/pages/ScholarAutoSchedulerPage.tsx docs/
git commit -m "feat(scholar): implement exclusive 1-of-3 schedule mode selection for auto-scheduler"
```
