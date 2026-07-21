# Auto-Scheduler Floating Modal Log System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the log system in `/scholar/auto-scheduler` into a **Floating Modal Dialog (Form nổi)** with a **Light Theme (Màn trắng)** and **100% Vietnamese localization**.

**Architecture:** Replace the dark inline terminal console with an `isLogModalOpen` floating modal. Implement `AutoSchedulerLogEntry` with Vietnamese categories (`CÀO_CV`, `NHẬP_CV`, `PROXY_TOR`, `CẤU_HÌNH`, `HỆ_THỐNG`) and levels (`THÀNH_CÔNG`, `BÁO_LỖI`, `CẢNH_BÁO`, `THÔNG_TIN`). Add header button to launch the modal.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons (`FileText`, `X`, `Search`, `Trash2`, `Download`, `Filter`).

---

### Task 1: Refactor Log System to Floating Modal with Light Theme and Vietnamese Localization

**Files:**
- Modify: `frontend/src/pages/ScholarAutoSchedulerPage.tsx`

- [ ] **Step 1: Update Types & State in ScholarAutoSchedulerPage**

Update `AutoSchedulerLogEntry` interface:
```typescript
export interface AutoSchedulerLogEntry {
  id: string
  timestamp: string
  category: 'CÀO_CV' | 'NHẬP_CV' | 'PROXY_TOR' | 'CẤU_HÌNH' | 'HỆ_THỐNG'
  level: 'THÀNH_CÔNG' | 'BÁO_LỖI' | 'CẢNH_BÁO' | 'THÔNG_TIN'
  action: string
  target?: string
  details: string
}
```

Add modal state:
```typescript
const [isLogModalOpen, setIsLogModalOpen] = useState(false)
```

- [ ] **Step 2: Update `addSchedulerLog` and handlers to Vietnamese**

Update `addSchedulerLog` to log events in Vietnamese with Vietnamese category and level strings.

- [ ] **Step 3: Add `📋 Xem Nhật Ký Cào Dữ Liệu` button in Header Action Bar**

Add button near "Làm mới" in top header:
```tsx
<button
  onClick={() => setIsLogModalOpen(true)}
  className="px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-3xs"
>
  <FileText className="h-4 w-4 text-[#005b9a]" />
  <span>Xem Nhật Ký Cào Dữ Liệu</span>
  <span className="bg-[#e6f0f7] text-[#005b9a] text-[10px] font-bold px-2 py-0.5 rounded-full">
    {logs.length}
  </span>
</button>
```

- [ ] **Step 4: Build Light Theme Floating Log Modal (`isLogModalOpen`)**

Render modal with:
- Backdrop: `fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-xs flex items-center justify-center p-4`.
- Box: `bg-white border border-[#E5E7EB] rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden`.
- Header: "Nhật Ký Hoạt Động & Kết Quả Quét CV", Close button (`X`).
- Filters bar: Search input, Category filter, Level filter.
- Log list: White cards with light color badges (`THÀNH_CÔNG`=green, `BÁO_LỖI`=red, `CẢNH_BÁO`=amber, `THÔNG_TIN`=blue).
- Footer: Export button, Clear button, Close button.

- [ ] **Step 5: Verify build & type checking**

Run: `npm run build` in `frontend` directory.
Expected: Build succeeds with 0 errors.

- [ ] **Step 6: Commit changes**

```bash
git add frontend/src/pages/ScholarAutoSchedulerPage.tsx docs/
git commit -m "feat(scholar): convert auto-scheduler log system to floating light modal with full Vietnamese localization"
```
