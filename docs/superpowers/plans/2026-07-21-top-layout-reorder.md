# Top Layout Reordering & Compact Log Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dark top banner, move Bulk Import CV card to top of page with compact Log button, and order 2 status cards underneath.

**Architecture:** Update `ScholarAutoSchedulerPage.tsx` layout sequence:
1. Remove dark hero banner.
2. Render Bulk Import CV card as top card, containing `📋 Nhật Ký ({logs.length})` and `🔄 Làm mới` in header.
3. Render Tor Proxy Gateway & Schedule Summary cards as 2nd row (`grid-cols-1 md:grid-cols-2`).
4. Render Author Table card as 3rd row.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons (`Upload`, `FileText`, `RefreshCw`, `ShieldAlert`, `Settings`).

---

### Task 1: Reorder Layout Sequence and Add Compact Log Button in ScholarAutoSchedulerPage

**Files:**
- Modify: `frontend/src/pages/ScholarAutoSchedulerPage.tsx`

- [ ] **Step 1: Remove top dark hero banner**

In `frontend/src/pages/ScholarAutoSchedulerPage.tsx`:
Delete the dark hero banner `<div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900...">`.

- [ ] **Step 2: Position Bulk Import CV Card at Top with Compact Log Button**

Render Bulk Import CV Card as the first card on the page.
Header right actions:
- Compact Log Button:
  ```tsx
  <button
    onClick={() => setIsLogModalOpen(true)}
    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 border border-slate-200 cursor-pointer transition-all shadow-3xs"
  >
    <FileText className="h-3.5 w-3.5 text-[#005b9a]" />
    <span>Nhật Ký</span>
    <span className="bg-[#005b9a] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
      {logs.length}
    </span>
  </button>
  ```
- Compact Refresh Button:
  ```tsx
  <button
    onClick={() => { fetchTorStatus(); fetchConfig(); fetchAuthors(); }}
    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 border border-slate-200 cursor-pointer transition-all shadow-3xs"
  >
    <RefreshCw className="h-3.5 w-3.5 text-slate-600" />
    <span>Làm mới</span>
  </button>
  ```

- [ ] **Step 3: Render Tor Proxy & Schedule Summary Cards in 2nd Row (`grid-cols-1 md:grid-cols-2 gap-5`)**

Render Tor Proxy Gateway Card & Auto-Scan Schedule Summary Card side-by-side with content-fitted height.

- [ ] **Step 4: Verify build & type checking**

Run: `npm run build` in `frontend` directory.
Expected: Build succeeds with 0 errors.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/pages/ScholarAutoSchedulerPage.tsx docs/
git commit -m "feat(scholar): move bulk import card to top, remove dark banner, and compact log button"
```
