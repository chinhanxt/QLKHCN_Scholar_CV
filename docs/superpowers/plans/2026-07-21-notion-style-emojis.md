# Notion-Style Emoji Icons Clean Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all heavy colorful background icon container boxes and Lucide SVG icons across `ScholarAutoSchedulerPage.tsx`, replacing them with minimal Notion-style emoji icons.

**Architecture:** Update `ScholarAutoSchedulerPage.tsx`:
1. Remove heavy colored icon containers (`p-2 rounded-xl bg-...`).
2. Replace SVG icons with clean Notion emojis (`📥`, `🛡️`, `🔌`, `⚡`, `⚙️`, `📋`, `📊`, `🔄`, `🗑️`, `💾`, `✖`).
3. Ensure layout remains ultra-clean and minimalist.

**Tech Stack:** React, TypeScript, Tailwind CSS.

---

### Task 1: Replace SVG Icon Boxes with Notion-Style Emojis in ScholarAutoSchedulerPage

**Files:**
- Modify: `frontend/src/pages/ScholarAutoSchedulerPage.tsx`

- [ ] **Step 1: Replace icons in Bulk Import CV Card**
Header title `📥 Nhập Danh Sách Hồ Sơ CV Tác Giả` (remove `Upload` icon box). Buttons `📋 Nhật Ký` and `🔄 Làm mới`.

- [ ] **Step 2: Replace icons in Tor Proxy Gateway Card**
Header title `🛡️ Tor Proxy Gateway` (remove `ShieldAlert` icon box). Port labels `🔌 SOCKS5 Proxy` & `⚡ Control Port`. Button `🔄 Đổi IP Tor Ngẫu Nhiên (9050 • 9051)`.

- [ ] **Step 3: Replace icons in Schedule Summary Card**
Header title `⚙️ Cấu Hình Lịch Auto-Scan` (remove `Settings` icon box). Button `⚙️ Cấu Hình Thời Gian Quét`.

- [ ] **Step 4: Replace icons in Author Status Table Card**
Header title `📊 Trạng Thái Tự Động Quét CV Tác Giả` (remove `List` icon box). Buttons `⚡ Quét Ngay Tác Giả Đã Chọn` & `🔄 Quét lại`.

- [ ] **Step 5: Replace icons in Log & Schedule Modals**
Replace modal headers, tabs, and action buttons with clean Notion emojis.

- [ ] **Step 6: Verify build & type checking**

Run: `npm run build` in `frontend` directory.
Expected: Build succeeds with 0 errors.

- [ ] **Step 7: Commit changes**

```bash
git add frontend/src/pages/ScholarAutoSchedulerPage.tsx docs/
git commit -m "feat(scholar): replace heavy SVG icon boxes with clean Notion-style emojis"
```
