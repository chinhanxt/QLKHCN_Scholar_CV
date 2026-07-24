# Batch Scholar Scraper System Design

**Date:** 2026-07-24  
**Status:** Approved  
**Author:** Pair Programming Agent & User  

---

## 1. Overview & Objectives

The **Batch Scholar Scraper System** expands the Google Scholar scraping capabilities in the QLKHCN application (`/scholar/scraper` and `/scholar/requests`). It enables administrators to process multiple user profile requests concurrently or sequentially in batch without leaving the current page or overloading Google Scholar.

### Key Goals
- **Batch Processing:** Allow admins to select and scrape multiple pending profile requests at once via a dedicated Modal in `/scholar/scraper`.
- **Parallel Execution with Rate Limit Control:** Support running up to 2–3 scholar scraping tasks concurrently using the existing Tor Proxy pool.
- **Cross-Page Enqueueing:** Allow admins on `/scholar/requests` to click "Quét hồ sơ mới" on multiple requests continuously, adding them seamlessly into the active scraping queue without page navigation.
- **Interactive Queue Dashboard & Inspection:** Provide a queue status dashboard and a dropdown selector on `/scholar/scraper` to inspect individual author profile details, scraped publications, and console logs live.

---

## 2. User Workflows

### Workflow A: Batch Enqueue from `/scholar/requests`
1. Admin visits `/scholar/requests`.
2. Pending requests display an action button: **`FileText` Quét hồ sơ mới**.
3. Clicking the button:
   - Approves the profile in the database (`status = APPROVED`).
   - Pushes the profile into the global Zustand crawler queue (`scholarQueue`).
   - Triggers the backend Celery scraping task (`scrape_author_profile_task`).
   - Displays a Toast confirmation (`🚀 Đã kích hoạt quét hồ sơ ngầm cho...`).
   - Admin remains on `/scholar/requests` (no page redirect).

### Workflow B: Batch Enqueue from `/scholar/scraper` Modal
1. Admin visits `/scholar/scraper` and clicks the **"📋 Xem yêu cầu hồ sơ (N)"** button.
2. A Modal opens displaying all pending profile requests (`PENDING` status):
   - Compares requests against local database records.
   - Badges: `🟢 Mới 100%` (not in DB) vs `🟡 Đã có trong DB` (exists, needs update).
   - Pre-selects all `Mới 100%` items by default.
   - Includes "Select All" / "Deselect All" checkboxes.
3. Admin clicks **"🚀 Kích hoạt cào hàng loạt ([N] hồ sơ đã chọn)"**:
   - Modal closes, items are added to `scholarQueue`.
   - Batch Queue Dispatcher starts executing up to 2–3 tasks concurrently.

### Workflow C: Real-Time Monitoring & Inspection
1. Admin views `/scholar/scraper`.
2. The **Queue Dashboard Panel** shows:
   - Overall progress bar (e.g. `3/5 Hồ sơ hoàn thành`).
   - Per-item status (`⏳ Đang chờ`, `🔄 Đang cào (45%)`, `✅ Hoàn thành`, `❌ Thất bại`).
3. Admin selects any author from the **Author Selector Dropdown**:
   - Bottom panel updates instantly to show that specific author's parsed profile info, publication list, and dedicated live console logs.

---

## 3. Component & State Architecture

### A. Frontend Store (`frontend/src/stores/crawler.store.ts`)
Upgrade `scholar` state from single task to a batch queue state structure:

```typescript
export interface QueueItemState {
  id: string              // Profile request UUID / Scholar ID
  scholarId: string
  userEmail: string
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILURE'
  progress: number
  taskId: string | null
  consoleLogs: string[]
  resultData?: any
}

export interface ScholarBatchQueueState {
  queue: QueueItemState[]
  activeTaskIds: string[]
  maxConcurrency: number  // Default: 2
  selectedQueueId: string | null
}
```

### B. Modal Component (`frontend/src/components/scholar/ScholarPendingRequestsModal.tsx`)
- Fetches pending profile requests using `useAdminProfiles()`.
- Checks DB existence for each item to render `🟢 Mới 100%` or `🟡 Đã có trong DB`.
- Checkboxes for item selection + Select All toggle.
- Triggers batch enqueueing upon submit.

### C. Queue Dashboard Component (`frontend/src/components/scholar/ScholarQueueDashboard.tsx`)
- Renders global batch progress bar and item status table.
- Provides controls: Pause, Resume, Clear Completed.
- Contains the **Author Inspection Selector Dropdown**.

### D. Backend Celery & Tor Integration
- Utilizes existing Celery task `scrape_author_profile_task` in `apps/scholar/tasks.py`.
- Tor Proxy rotation prevents IP rate-limiting when 2–3 concurrent tasks fetch from Google Scholar.

---

## 4. Error Handling & Edge Cases

- **Rate-Limiting / CAPTCHA:** If Google Scholar blocks an IP, Tor proxy automatically rotates. The task retries up to 3 times before setting item status to `FAILURE`.
- **Duplicate Enqueueing:** Re-clicking "Quét hồ sơ mới" for an item already in `scholarQueue` is ignored to prevent duplicate execution.
- **Page Refresh:** Queue state in `crawler.store.ts` can be persisted to `sessionStorage` so active scraping tasks remain visible if the admin reloads the browser.
