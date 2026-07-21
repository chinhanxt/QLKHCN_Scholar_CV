# Design Spec: Exclusive 3-Mode Schedule Frequency Selection

**Date:** 2026-07-21  
**Status:** Approved  
**Target File:** `frontend/src/pages/ScholarAutoSchedulerPage.tsx`  

---

## 1. Overview
Refine the **Cấu Hình Lịch Auto-Scan** section on `/scholar/auto-scheduler` so that the 3 schedule frequencies (`WEEKLY`, `MONTHLY`, `DAILY`) operate as an **exclusive 1-out-of-3 single choice Mode selection**. 

Dynamic Behavior per Mode:
1. **Mode `WEEKLY` (Hằng Tuần):** Allows picking a specific weekday (Thứ 2 to Chủ Nhật).
2. **Mode `MONTHLY` (Hằng Tháng):** Allows picking a specific day of the month (Ngày 1 to 31).
3. **Mode `DAILY` (Hằng Ngày):** Bypasses date picking (shows "Chạy tự động hằng ngày (Mỗi 24 giờ)") and focuses directly on the execution hour slot.

---

## 2. Component Design Specifications

### A. Segmented Radio Mode Bar (Chọn 1 trong 3 Mode)
- 3 Segmented Radio Mode Buttons:
  - 📅 **Hằng Tuần (WEEKLY)**
  - 🗓️ **Hằng Tháng (MONTHLY)**
  - ⚡ **Hằng Ngày (DAILY)**
- Visual Active Indicator: Selected mode gets a distinct active border, white/indigo background, radio dot `●`, and bold title.

### B. Dynamic Interactive Calendar & Date Picker
- **In `WEEKLY` Mode:**
  - Shows weekday navigation and pill selector (Thứ 2, Thứ 3... Chủ Nhật).
  - Clicking any date on the calendar selects its day of the week (`preferred_weekday`).
- **In `MONTHLY` Mode:**
  - Shows 31-day month grid.
  - Clicking any date sets `preferred_day_of_month` (1 to 31).
- **In `DAILY` Mode:**
  - Displays a clean info card: `⚡ Chế độ Hằng Ngày: Tự động chạy cào CV lặp lại mỗi 24 giờ vào khung giờ đã chọn.`
  - Disables specific date selection since the job runs every day.

### C. Visual Analog Clock & Hour Picker
- Retains SVG Analog Clock Widget and Hour Slot grid (`preferred_hour`).

---

## 3. Verification & Testing Plan
- Test switching between the 3 modes (`WEEKLY`, `MONTHLY`, `DAILY`).
- Verify calendar date picker updates `preferred_weekday` in WEEKLY mode and `preferred_day_of_month` in MONTHLY mode.
- Verify DAILY mode shows daily schedule notice.
- Run `npm run build` to verify 0 errors.
