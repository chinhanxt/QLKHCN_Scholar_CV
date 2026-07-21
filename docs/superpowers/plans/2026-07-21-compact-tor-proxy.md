# Compact Tor Proxy Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Tor Proxy Gateway card into an ultra-compact card with clear 2-port display (SOCKS5 9050 & Control 9051) on `/scholar/auto-scheduler`.

**Architecture:** Update `ScholarAutoSchedulerPage.tsx` Tor Proxy card component.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons (`ShieldAlert`, `RefreshCw`, `Power`, `Server`, `Zap`).

---

### Task 1: Redesign Tor Proxy Gateway Card into Compact Format with Integrated 2-Port Button

**Files:**
- Modify: `frontend/src/pages/ScholarAutoSchedulerPage.tsx`

- [ ] **Step 1: Replace bulky multi-hop diagram with compact 2-port bar**

In `frontend/src/pages/ScholarAutoSchedulerPage.tsx`:
Replace lines 686-804 with a compact card layout:
- Header: Title, Icon, Status Pill (`● ONLINE` / `○ OFF`), IP Badge (`Exit IP: 185.xxx`).
- 2-Port Badges: `SOCKS5: 9050` and `Control Port: 9051`.
- Combined Action Button: `🔄 Kích Hoạt Đổi IP Tor (SOCKS5: 9050 • Control: 9051)`.

- [ ] **Step 2: Verify build & type checking**

Run: `npm run build` in `frontend` directory.
Expected: Build succeeds with 0 errors.

- [ ] **Step 3: Commit changes**

```bash
git add frontend/src/pages/ScholarAutoSchedulerPage.tsx docs/
git commit -m "feat(scholar): redesign Tor Proxy Gateway card into compact format displaying 2 ports"
```
