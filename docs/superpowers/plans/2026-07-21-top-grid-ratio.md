# Top Grid 1/3 - 2/3 Ratio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change top section layout ratio on `/scholar/auto-scheduler` to 1/3 width for Tor Proxy Gateway and 2/3 width for Schedule Configuration.

**Architecture:** Update `ScholarAutoSchedulerPage.tsx` top section grid wrapper and column span classes.

**Tech Stack:** React, TypeScript, Tailwind CSS.

---

### Task 1: Update Grid Ratio to 1/3 (Tor Proxy) and 2/3 (Schedule Config) in ScholarAutoSchedulerPage

**Files:**
- Modify: `frontend/src/pages/ScholarAutoSchedulerPage.tsx`

- [ ] **Step 1: Update Top Section Grid Wrapper to `lg:grid-cols-3`**

In `frontend/src/pages/ScholarAutoSchedulerPage.tsx`:
Update grid container:
```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
```

- [ ] **Step 2: Set Tor Proxy Gateway Card to `lg:col-span-1`**

```tsx
<Card className="lg:col-span-1 p-5 rounded-3xl bg-white border border-slate-200/80 shadow-md space-y-4 flex flex-col justify-between">
```
Format port badges vertically or in a 1-column grid if needed to fit 1/3 column smoothly.

- [ ] **Step 3: Set Schedule Config Card to `lg:col-span-2`**

```tsx
<Card className="lg:col-span-2 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-md space-y-5">
```

- [ ] **Step 4: Verify build & type checking**

Run: `npm run build` in `frontend` directory.
Expected: Build succeeds with 0 errors.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/pages/ScholarAutoSchedulerPage.tsx docs/
git commit -m "feat(scholar): update top grid layout to 1/3 ratio for Tor Proxy and 2/3 ratio for Schedule Config"
```
