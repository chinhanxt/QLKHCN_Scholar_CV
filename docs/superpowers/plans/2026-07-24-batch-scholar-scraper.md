# Batch Scholar Scraper System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a batch scraping queue system on `/scholar/scraper` and `/scholar/requests` that processes multiple user profile requests concurrently (up to 2–3 in parallel) with live progress tracking, pending requests modal, and single-author inspection selector.

**Architecture:** Extend Zustand store (`crawler.store.ts`) with a multi-task `scholarQueue` state and an automated concurrent queue dispatcher. Create a pending request modal with DB comparison badges and a queue dashboard panel on `/scholar/scraper`, and wire up `/scholar/requests` for seamless background batch enqueueing.

**Tech Stack:** React, TypeScript, Zustand, Tailwind CSS, Lucide Icons, Django REST Framework, Celery.

---

### Task 1: Extend Crawler Zustand Store for Batch Queue Management

**Files:**
- Modify: `frontend/src/stores/crawler.store.ts`

- [ ] **Step 1: Inspect existing crawler.store.ts**

Run: `cat frontend/src/stores/crawler.store.ts`
Expected: View current state structure.

- [ ] **Step 2: Add QueueItemState and ScholarBatchQueueState interfaces**

Update `frontend/src/stores/crawler.store.ts`:

```typescript
export interface QueueItemState {
  id: string
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
  maxConcurrency: number
  selectedQueueId: string | null
}
```

Add methods `addToScholarQueue`, `updateScholarQueueItem`, `setSelectedQueueId`, `removeFromScholarQueue` to `CrawlerStoreState`.

- [ ] **Step 3: Test TypeScript build**

Run: `npm run build` in `frontend/`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/stores/crawler.store.ts
git commit -m "feat(store): add batch queue state to crawler store"
```

---

### Task 2: Create Pending Requests Selection Modal Component

**Files:**
- Create: `frontend/src/components/scholar/ScholarPendingRequestsModal.tsx`

- [ ] **Step 1: Create ScholarPendingRequestsModal component**

Create `frontend/src/components/scholar/ScholarPendingRequestsModal.tsx` with:
- Accessible `Dialog` wrapper.
- `useAdminProfiles()` query to fetch pending items.
- Item DB existence comparison check (`🟢 Mới 100%` vs `🟡 Đã có trong DB`).
- Checkboxes + Select All / Deselect All.
- Action button: `Kích hoạt cào hàng loạt ([N] hồ sơ)`.

- [ ] **Step 2: Verify component build**

Run: `npx tsc --noEmit` in `frontend/`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/scholar/ScholarPendingRequestsModal.tsx
git commit -m "feat(components): create ScholarPendingRequestsModal component"
```

---

### Task 3: Create Queue Dashboard & Inspection Selector Component

**Files:**
- Create: `frontend/src/components/scholar/ScholarQueueDashboard.tsx`

- [ ] **Step 1: Create ScholarQueueDashboard component**

Create `frontend/src/components/scholar/ScholarQueueDashboard.tsx` with:
- Global Progress Bar (`[N]/[Total] Hồ sơ đã hoàn thành`).
- Queue Items Table showing Scholar ID, Email, Status (`⏳ Đang chờ`, `🔄 Đang cào (X%)`, `✅ Hoàn thành`, `❌ Thất bại`), Progress bar per item.
- Author Selection Dropdown allowing admin to choose which author profile to inspect live in the detail view below.

- [ ] **Step 2: Verify component build**

Run: `npx tsc --noEmit` in `frontend/`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/scholar/ScholarQueueDashboard.tsx
git commit -m "feat(components): create ScholarQueueDashboard component"
```

---

### Task 4: Integrate Batch Scraper & Auto-Queue Dispatcher into ScholarScraperPage

**Files:**
- Modify: `frontend/src/pages/ScholarScraperPage.tsx`

- [ ] **Step 1: Add "Xem yêu cầu hồ sơ" modal button to toolbar**

In `ScholarScraperPage.tsx`, render `<Button>` to trigger `ScholarPendingRequestsModal`.

- [ ] **Step 2: Implement auto-queue dispatcher effect**

In `ScholarScraperPage.tsx`, add an `useEffect` queue dispatcher:
- Checks `scholarQueue` items with status `PENDING`.
- If `activeTaskIds.length < maxConcurrency` (2), picks the next pending item, calls `scholarApi.scrapeAuthor(item.scholarId, 0)`, and updates status to `RUNNING` with `taskId`.
- Polls status for all active `activeTaskIds` concurrently.

- [ ] **Step 3: Render ScholarQueueDashboard and dropdown selector**

Render `ScholarQueueDashboard` at the top of `ScholarScraperPage.tsx`.

- [ ] **Step 4: Verify build**

Run: `npm run build` in `frontend/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ScholarScraperPage.tsx
git commit -m "feat(scraper): integrate batch queue dispatcher and modal in ScholarScraperPage"
```

---

### Task 5: Wire up Multi-Enqueue in ScholarRequestsPage

**Files:**
- Modify: `frontend/src/pages/ScholarRequestsPage.tsx`

- [ ] **Step 1: Update handleScanNewProfile in ScholarRequestsPage.tsx**

Ensure clicking "Quét hồ sơ mới" pushes the item into `scholarQueue` in `crawler.store.ts` and triggers backend task without redirecting.

- [ ] **Step 2: Full build verification**

Run: `npm run build` in `frontend/`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ScholarRequestsPage.tsx
git commit -m "feat(requests): enable continuous background batch enqueueing from ScholarRequestsPage"
```
