# Auto-Scheduler Log System & Data Control Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Real-Time Execution Log Console & Data Control Panel on `/scholar/auto-scheduler` to track, categorize, and display all actions and background scan updates with clear visual distinction.

**Architecture:** Define `AutoSchedulerLogEntry` state & `localStorage` persistence in `ScholarAutoSchedulerPage.tsx`. Add `addSchedulerLog` helper to log all user actions (bulk import, Tor rotation, config updates, author scan triggers) and auto-monitored status updates. Build a terminal-styled log console UI component with search, category/level filtering, live auto-scroll, clear logs, and file export options.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons (`Terminal`, `Filter`, `Trash2`, `Download`, `Search`, `Pause`, `Play`, `CheckCircle2`, `AlertTriangle`, `Info`).

---

### Task 1: Add Log State, Types, and Helper Functions in ScholarAutoSchedulerPage

**Files:**
- Modify: `frontend/src/pages/ScholarAutoSchedulerPage.tsx`

- [ ] **Step 1: Define `AutoSchedulerLogEntry` type and state variables**

In `frontend/src/pages/ScholarAutoSchedulerPage.tsx`:
Add log data types and state:
```typescript
export interface AutoSchedulerLogEntry {
  id: string
  timestamp: string
  category: 'IMPORT' | 'SCAN' | 'TOR' | 'CONFIG' | 'SYSTEM'
  level: 'SUCCESS' | 'INFO' | 'UPDATE' | 'WARN' | 'ERROR'
  action: string
  target?: string
  details: string
}
```

Add log state in `ScholarAutoSchedulerPage`:
```typescript
const [logs, setLogs] = useState<AutoSchedulerLogEntry[]>(() => {
  const saved = localStorage.getItem('auto_scheduler_logs')
  if (saved) {
    try { return JSON.parse(saved) } catch (e) { return [] }
  }
  return [
    {
      id: 'init_1',
      timestamp: new Date().toLocaleString('vi-VN'),
      category: 'SYSTEM',
      level: 'INFO',
      action: 'Khởi tạo hệ thống',
      target: 'Auto-Scheduler',
      details: 'Đã tải xong bảng điều khiển cào dữ liệu tự động CV & Tor Control'
    }
  ]
})
const [logSearch, setLogSearch] = useState('')
const [logCategoryFilter, setLogCategoryFilter] = useState<string>('ALL')
const [logLevelFilter, setLogLevelFilter] = useState<string>('ALL')
const [isAutoScroll, setIsAutoScroll] = useState(true)
```

- [ ] **Step 2: Add `addSchedulerLog` function & `localStorage` sync**

Add `addSchedulerLog` function:
```typescript
const addSchedulerLog = (
  category: 'IMPORT' | 'SCAN' | 'TOR' | 'CONFIG' | 'SYSTEM',
  level: 'SUCCESS' | 'INFO' | 'UPDATE' | 'WARN' | 'ERROR',
  action: string,
  details: string,
  target?: string
) => {
  const newEntry: AutoSchedulerLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toLocaleString('vi-VN'),
    category,
    level,
    action,
    target,
    details
  }
  setLogs(prev => {
    const updated = [newEntry, ...prev].slice(0, 300)
    localStorage.setItem('auto_scheduler_logs', JSON.stringify(updated))
    return updated
  })
}
```

- [ ] **Step 3: Integrate `addSchedulerLog` into existing handlers**

Add log calls in:
- `handleRotateIp`: `addSchedulerLog('TOR', 'INFO', 'Đổi IP Tor', 'Gửi tín hiệu NEWNYM tới Tor Control Port 9051...')` and on success/failure.
- `handleStartTor`: `addSchedulerLog('TOR', 'INFO', 'Khởi chạy Tor Container', 'Gửi lệnh start Tor Proxy Container...')`.
- `handleSaveConfig`: `addSchedulerLog('CONFIG', 'SUCCESS', 'Cấu hình Lịch Hẹn Giờ', `Cập nhật tần suất: ${config.frequency_type}, Hạn ngạch: ${config.batch_size_per_hour} CV/giờ`)`.
- `handleBulkImport`: `addSchedulerLog('IMPORT', 'SUCCESS', 'Import CV Hàng Loạt', `Đã nhập danh sách CV tác giả. Nội dung: "${bulkText.substring(0, 60)}..."`)`.
- `handleTriggerScan`: `addSchedulerLog('SCAN', 'INFO', 'Phát Lệnh Quét Ngầm', `Bắt đầu quét trực tiếp cho ${ids.length} tác giả (ID: ${ids.join(', ')})`)`.

- [ ] **Step 4: Build Log Console UI Component & Render on Page**

Add the Log Console section in JSX under "Trạng Thái Tự Động Quét CV Tác Giả" Card.
Include:
- Category & Level Filter tabs.
- Search input for logs.
- Auto-scroll, Clear logs, and Export file buttons.
- Styled terminal container (`bg-slate-950 text-slate-100 font-mono`).

- [ ] **Step 5: Verify build & type checking**

Run: `npm run build` in `frontend` directory.
Expected: Build succeeds with 0 errors.

- [ ] **Step 6: Commit changes**

```bash
git add frontend/src/pages/ScholarAutoSchedulerPage.tsx docs/
git commit -m "feat(scholar): add real-time execution log system to auto-scheduler page"
```
