# Design Spec: Accurate Google Scholar Citation & 5-Year Metrics Synchronization

## Overview
This design spec addresses discrepancies between official Google Scholar profile citation statistics and the data stored/displayed in the system. 
Specifically, the system previously lacked 5-year metrics (`citedby5y`, `hindex5y`, `i10index5y`) in the `AuthorProfile` database model and relied on placeholder formulas (`hindex - 1`, `citedby * 0.84`) on the frontend. Additionally, the sidebar citation chart was calculated on-the-fly by summing individual paper citations rather than rendering the official profile-level yearly citation timeline from Google Scholar.

## Proposed Changes

### 1. Database Schema (`apps/scholar/models.py`)
Add 4 new fields to `AuthorProfile`:
- `citedby5y` (`models.IntegerField(default=0)`): Total citations in the last 5 years.
- `hindex5y` (`models.IntegerField(default=0)`): h-index in the last 5 years.
- `i10index5y` (`models.IntegerField(default=0)`): i10-index in the last 5 years.
- `cites_per_year` (`models.JSONField(default=dict, blank=True)`): Author-level yearly citation breakdown dictionary (e.g. `{"2019": 120, "2020": 350, ...}`).

Generate and run a Django database migration (`0014_add_author_5year_metrics.py`).

### 2. Backend Scraper & Tasks (`apps/scholar/tasks.py`)
Update `scrape_author_cv_smart_task`:
- Extract `citedby5y`, `hindex5y`, `i10index5y`, and `cites_per_year` from the `author` dict returned by `scholarly` (`AuthorParser`).
- Save these fields into `AuthorProfile.objects.update_or_create(...)` defaults.

### 3. API Layer (`apps/scholar/api/serializers.py` & `frontend/src/api/endpoints/scholar.ts`)
- Update `AuthorProfileDetailSerializer` in `serializers.py` to include: `citedby5y`, `hindex5y`, `i10index5y`, `cites_per_year`.
- Update `AuthorProfileDetail` TypeScript interface in `scholar.ts` to include optional or required fields:
  ```typescript
  citedby5y: number
  hindex5y: number
  i10index5y: number
  cites_per_year: Record<string, number>
  ```

### 4. Frontend UI Components (`ScholarScraperPage.tsx` & `ProfileManagerPage.tsx`)
- Remove placeholder formulas in the "Trích dẫn bởi" comparison table:
  - Replace `{Math.round(profile.citedby * 0.84)}` with `{profile.citedby5y ?? 0}`.
  - Replace `{Math.max(1, profile.hindex - 1)}` with `{profile.hindex5y ?? 0}`.
  - Replace `{Math.max(0, profile.i10index - 1)}` with `{profile.i10index5y ?? 0}`.
- Update sidebar citation histogram chart:
  - Render bars using `profile.cites_per_year` (official author-level citation timeline from Google Scholar).
- Update Excel Export generator to include both "Tất cả" and "Từ <Year>" 5-year metrics accurately in Sheet 1 (Overview).

## Verification Plan

### Database & Scraper Tests
1. Run Django migration `python manage.py migrate`.
2. Trigger author profile scrape for a test scholar ID (e.g., `vlowI28AAAAJ`).
3. Verify that `AuthorProfile` DB row contains exact `citedby5y`, `hindex5y`, `i10index5y`, and `cites_per_year`.

### Frontend Verification
1. Inspect profile UI page for scholar.
2. Confirm the 2-column table matches official Google Scholar numbers (All vs Since 5 Years).
3. Confirm citation bar chart matches Google Scholar histogram bars.
4. Run `npm --prefix frontend run build` to verify clean TypeScript compilation.
