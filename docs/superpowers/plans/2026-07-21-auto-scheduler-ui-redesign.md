# Auto-Scheduler Visual UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/scholar/auto-scheduler` with elevated visual aesthetics (Soft Neumorphic & Modern Light Theme, interactive Day/Hour selectors, Tor Multi-Hop Relay diagram, rebranded Bulk Importer), while preserving 100% of existing functionality.

**Architecture:** Update `ScholarAutoSchedulerPage.tsx` layout and JSX components. Replace standard select inputs for Schedule Config with visual Weekday/Day/Hour pill button selectors. Enhance Tor Proxy Status Card with connection map diagram and NEWNYM control. Rebrand Bulk Importer with format badges and detected count. Maintain existing author table with `User` icon avatars.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons (`Cpu`, `ShieldAlert`, `Settings`, `Upload`, `User`, `RefreshCw`, `Play`, `CheckCircle`, `XCircle`, `Clock`, `Power`, `FileText`, `Sparkles`, `Globe`, `ArrowRight`).

---

### Task 1: Redesign ScholarAutoSchedulerPage Components

**Files:**
- Modify: `frontend/src/pages/ScholarAutoSchedulerPage.tsx`

- [ ] **Step 1: Enhance Header Banner & Navigation Buttons**

Update page title section with soft gradients, sub-title, and action buttons (`📋 Xem Nhật Ký Cào Dữ Liệu` and `🔄 Làm mới`).

- [ ] **Step 2: Redesign Tor Proxy Status Card**

In `ScholarAutoSchedulerPage.tsx`:
- Render header status pill (`ONLINE` / `DISCONNECTED`).
- Add visual Tor Multi-Hop Relay Diagram:
  `[Web Server] ➔ [Tor Relay 1] ➔ [Tor Relay 2] ➔ [Exit Node IP] ➔ [Google Scholar]`
- Add Port Info Cards (SOCKS5 9050, Control 9051).
- Action buttons: "Đổi IP Tor Ngẫu Nhiên Ngay (NEWNYM)" (Indigo gradient button) & "Khởi Động Tor Container" (if offline).

- [ ] **Step 3: Redesign Schedule Configuration Card with Visual Day & Hour Selectors**

In `ScholarAutoSchedulerPage.tsx`:
- Frequency Tabs: 📅 `Hằng Tuần` | 🗓️ `Hằng Tháng` | ⚡ `Hằng Ngày`.
- Interactive Day Selector:
  - Weekly: 7 Pill buttons (`Thứ 2` to `Chủ Nhật`).
  - Monthly: 31 Grid buttons (`1` to `31`).
- Interactive Hour Slot Selector:
  - 24 Hour slot buttons (00:00 to 23:00) with time period badges (Đêm, Sáng, Trưa, Chiều, Tối).
- Quota & Delay inputs in clean cards.
- Button: "Lưu Cấu Hình Hẹn Giờ".

- [ ] **Step 4: Redesign Bulk Import CV Card**

In `ScholarAutoSchedulerPage.tsx`:
- Title: `📥 Nhập Danh Sách Hồ Sơ CV Tác Giả`.
- Format instruction chips (`ID: q81c5sAAAAAJ`, `URL: https://scholar.google.com/citations?user=...`).
- Monospace textarea with live counter (`Đã phát hiện X ID/URL`).
- Button: `🚀 Nhập CV & Kích Hoạt Quét Ngay`.

- [ ] **Step 5: Redesign Author Status Table**

In `ScholarAutoSchedulerPage.tsx`:
- Retain `User` icon for author avatars.
- Soft rounded status pills (`UPDATED`, `UP_TO_DATE`, `FAILED_CAPTCHA`, `PENDING`).
- Row action button "Quét lại" & Bulk scan trigger button.

- [ ] **Step 6: Verify build & type checking**

Run: `npm run build` in `frontend` directory.
Expected: Build succeeds with 0 errors.

- [ ] **Step 7: Commit changes**

```bash
git add frontend/src/pages/ScholarAutoSchedulerPage.tsx docs/
git commit -m "feat(scholar): elevate auto-scheduler UI aesthetics with visual calendar pickers and relay diagrams"
```
