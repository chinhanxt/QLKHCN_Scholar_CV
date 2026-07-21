# Design Spec: Auto-Scheduler Real-Time Execution Log System & Data Control Panel

**Date:** 2026-07-21  
**Status:** Approved  
**Target File:** `frontend/src/pages/ScholarAutoSchedulerPage.tsx`  

---

## 1. Overview
The **Scholar Auto Scheduler & Tor Control** page (`/scholar/auto-scheduler`) handles automated background author CV scanning, bulk imports, Tor SOCKS5 proxy rotation, and schedule configurations. 

This feature introduces a **Real-Time Execution Log System & Data Control Panel** on `/scholar/auto-scheduler` that records, categorizes, and displays all activities, data updates, and background scan results with clear visual distinction.

---

## 2. Log Data Model & Categories

### A. AutoSchedulerLogEntry Interface
```typescript
export interface AutoSchedulerLogEntry {
  id: string
  timestamp: string // HH:mm:ss DD/MM/YYYY
  category: 'IMPORT' | 'SCAN' | 'TOR' | 'CONFIG' | 'SYSTEM'
  level: 'SUCCESS' | 'INFO' | 'UPDATE' | 'WARN' | 'ERROR'
  action: string // e.g. "Bulk Import", "Fast Smart Check", "Tor IP Rotate", "Config Update"
  target?: string // Author name or Scholar ID or system component
  details: string // Description of what ran & what updated
}
```

### B. Categories & Color-Coded Badges
- `IMPORT` (`#005b9a` blue): Bulk author CV import & validation.
- `SCAN` (`#7c3aed` purple / `#2563eb` blue): Fast Smart Check, background scan triggers, author status updates.
- `TOR` (`#4f46e5` indigo): Tor Proxy startup, IP rotation (NEWNYM signal), IP renewal confirmation.
- `CONFIG` (`#0f172a` slate): Schedule frequency, batch size, delay/cooldown updates.
- `SYSTEM` (`#64748b` gray): Initialization, system status refresh.

---

## 3. UI Component Architecture

### Log Console Component Layout
In `ScholarAutoSchedulerPage.tsx`:
1. **Log Panel Container Card**:
   - Header with Terminal/Activity icon, log counter, and live status indicator ("● LIVE LOGGING").
   - Filter controls:
     - Search input (filter by keyword/author).
     - Category filter tabs (`All`, `Scan CV`, `Import`, `Tor Proxy`, `Config`).
     - Level filter select (`All Levels`, `Success`, `Update`, `Warning`, `Error`).
     - Action buttons: `Clear Logs`, `Export Log (TXT/JSON)`, `Auto-Scroll Toggle`.
   - Scrollable Terminal-style Log Box:
     - Fixed height (e.g. 380px) with custom scrollbar.
     - Dark slate styling (`bg-slate-950 text-slate-100 font-mono text-xs`).
     - Each line includes: Timestamp badge, Category tag, Level badge, Action/Target name, and Detail message.
2. **Log Trigger Hooks**:
   - Automatic logging when user performs actions (Bulk import, IP rotation, Config update, Manual scan trigger).
   - Automated status monitoring logs when background job status (`config.current_job_status` or author status) changes during polling.
3. **Persistence**:
   - Store log entries in `localStorage` (`auto_scheduler_logs`) up to 200 entries to maintain history across page refreshes.

---

## 4. Verification & Testing Plan
- Execute actions (rotate IP, update config, import IDs, trigger scan).
- Verify log entries are generated with correct category, level, timestamp, and details.
- Test filtering by category, level, and search keyword.
- Verify log persistence in `localStorage` across page reloads.
- Run `npm run build` to confirm TypeScript compilation.
