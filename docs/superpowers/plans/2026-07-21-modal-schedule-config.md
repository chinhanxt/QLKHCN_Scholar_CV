# Compact Main Cards & Floating Schedule Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine top section on `/scholar/auto-scheduler` into 2 compact, content-fitted cards side-by-side, moving interactive calendar & clock controls into a floating popup modal.

**Architecture:** Update `ScholarAutoSchedulerPage.tsx`:
1. Add `isScheduleModalOpen` state.
2. Render 2 compact cards on top (`grid-cols-1 md:grid-cols-2 gap-5`).
3. Render `isScheduleModalOpen` Floating Modal Dialog with 3-Mode Selection, October 2023 calendar style (`bg-[#4F46E5] rounded-xl active day`), Analog Clock, and Throttling inputs.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons (`ShieldAlert`, `Settings`, `Calendar`, `Clock`, `X`, `ChevronLeft`, `ChevronRight`).

---

### Task 1: Refine Top Cards and Build Floating Schedule Config Modal in ScholarAutoSchedulerPage

**Files:**
- Modify: `frontend/src/pages/ScholarAutoSchedulerPage.tsx`

- [ ] **Step 1: Add Modal State `isScheduleModalOpen`**

In `frontend/src/pages/ScholarAutoSchedulerPage.tsx`:
```typescript
const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
```

- [ ] **Step 2: Build Compact Tor Proxy Card (Content-Fitted Height)**

Header status (`● ONLINE`), Exit IP, SOCKS5 9050 & Control Port 9051 badges, and `🔄 Đổi IP Tor` button. No blank space below.

- [ ] **Step 3: Build Compact Auto-Scan Schedule Summary Card**

Header toggle `Kích hoạt`, active schedule summary badge, and `⚙️ Cấu Hình Thời Gian Quét` button opening `setIsScheduleModalOpen(true)`.

- [ ] **Step 4: Build Floating Schedule Config Modal Dialog**

Render `isScheduleModalOpen` floating modal with:
- 3 Mode Radio selector (Weekly, Monthly, Daily).
- October 2023 style calendar with `bg-[#4F46E5] rounded-xl` active day badge.
- Analog Clock & time picker.
- Throttling inputs (`CV/Giờ`, `Delay Min`, `Delay Max`).
- Footer `Hủy` and `Lưu Cấu Hình` buttons.

- [ ] **Step 5: Verify build & type checking**

Run: `npm run build` in `frontend` directory.
Expected: Build succeeds with 0 errors.

- [ ] **Step 6: Commit changes**

```bash
git add frontend/src/pages/ScholarAutoSchedulerPage.tsx docs/
git commit -m "feat(scholar): convert schedule config into floating modal and compact top cards"
```
