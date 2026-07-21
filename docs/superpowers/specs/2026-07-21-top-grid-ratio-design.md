# Design Spec: 1/3 - 2/3 Grid Layout Ratio for Top Section

**Date:** 2026-07-21  
**Status:** Approved  
**Target File:** `frontend/src/pages/ScholarAutoSchedulerPage.tsx`  

---

## 1. Overview
Adjust the top section grid ratio on `/scholar/auto-scheduler` from 50%-50% (`lg:grid-cols-2`) to **1/3 - 2/3 (`lg:grid-cols-3`)**:
- Left Column (`lg:col-span-1` / 1/3 width): **Trạng Thái Tor Proxy Gateway Card**
- Right Column (`lg:col-span-2` / 2/3 width): **Cấu Hình Lịch Auto-Scan Card**

---

## 2. Component Layout Specifications

### A. Main Container Grid
- Outer Container: `grid grid-cols-1 lg:grid-cols-3 gap-6`.

### B. Tor Proxy Gateway Card (1/3 Width)
- Column Span: `lg:col-span-1`.
- Content Layout: Vertical stack matching 1/3 width.
  - Header: Icon + Title "Tor Proxy", Status Pill (`● ONLINE`).
  - IP Badge: `Exit IP: 185.xxx.xxx.xxx`.
  - Port Badges Stack/Grid: SOCKS5 9050 & Control 9051.
  - Action Button: `🔄 Kích Hoạt Đổi IP Tor (SOCKS5: 9050 • Control: 9051)`.

### C. Schedule Config Card (2/3 Width)
- Column Span: `lg:col-span-2`.
- Content Layout: Expanded width for 3-Mode Radio Selector, Calendar Widget (Select Date), Analog Clock Widget (Set Time), throttling inputs, and pastel confirm button.

---

## 3. Verification & Testing Plan
- Test responsive breakpoints (mobile full-width stacked `col-span-1`, desktop 1/3 - 2/3 ratio).
- Run `npm run build` to verify 0 errors.
