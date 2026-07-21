# Implementation Plan: Unified Scholar Publication Components Across Scraper and Profile Manager

**Date:** 2026-07-21  
**Spec Document:** [2026-07-21-unified-scholar-publication-components-design.md](file:///home/chinhan/Downloads/init-django-project-main/docs/superpowers/specs/2026-07-21-unified-scholar-publication-components-design.md)  
**Goal:** Extract shared `PublicationTableList` and `PublicationDetailPanel` components and apply them to both `ScholarScraperPage.tsx` (`/scholar/scraper`) and `ProfileManagerPage.tsx` (`/scholar/profiles`).

---

## Task Breakdown

### Task 1: Create `PublicationDetailPanel.tsx`
- **Path**: `frontend/src/components/scholar/PublicationDetailPanel.tsx`
- **Description**: Create component for displaying the full detailed publication panel.
- **Key Features**:
  - Header with Back button, Author profile badge (`Hồ sơ tác giả: [name]`), and Edit/Delete buttons (if handlers provided).
  - Large title card.
  - 2-Column Grid:
    - **Publishing Details Card**: Venue, Pub Date/Year, Volume, Issue, Pages, Publisher, Citations count, Original article link, PDF download link.
    - **Scientific Ranks Card**: SJR Quartile (Q1 green, Q2 amber, Q3 blue, Q4 slate, N/A), Impact Factor badge (`IF: 109.000`), Web of Science badge (`WoS: SCIE`).
  - Abstract / Description card (if abstract text exists).
  - Annual Citation History Histogram SVG/Bar chart.
  - Google Scholar action links (Cited-by, Related articles, All versions).

### Task 2: Create `PublicationTableList.tsx`
- **Path**: `frontend/src/components/scholar/PublicationTableList.tsx`
- **Description**: Create component for rendering publication table with search/filters/toolbar.
- **Key Features**:
  - Filter Bar: Search input, Year dropdown, Quartile dropdown (Q1, Q2, Q3, Q4, N/A, All), Sort dropdown, Export Excel button.
  - Table Columns: Checkbox/STT | TIÊU ĐỀ & TÁC GIẢ | TRÍCH DẪN | NĂM.
  - Title in bold blue (`#2563EB`).
  - Authors list formatted with `getShortenedAuthors` (`VL Feigin, BA Stark, CO Johnson, ...`).
  - Venue, Volume, Issue, Pages formatted in clean italic text.
  - Inline badges for SJR (Q1-Q4), Impact Factor, Web of Science.
  - Citations count in bold blue text.

### Task 3: Integrate into `ScholarScraperPage.tsx`
- **Path**: `frontend/src/pages/ScholarScraperPage.tsx`
- **Description**: Replace custom publication list table and detail view JSX with the shared `PublicationTableList` and `PublicationDetailPanel` components.

### Task 4: Integrate into `ProfileManagerPage.tsx`
- **Path**: `frontend/src/pages/ProfileManagerPage.tsx`
- **Description**: Replace custom publication list table and detail view JSX with the shared `PublicationTableList` and `PublicationDetailPanel` components.

### Task 5: Verification & Build Check
- Run `npm run build` in `frontend/` to ensure zero TypeScript and compilation errors.
- Confirm both pages match 100% in design, metadata fields, badges, and layout.

---

## Execution Steps

1. Create directory `frontend/src/components/scholar/`.
2. Write `PublicationDetailPanel.tsx`.
3. Write `PublicationTableList.tsx`.
4. Update `ScholarScraperPage.tsx`.
5. Update `ProfileManagerPage.tsx`.
6. Run `npm run build` and verify.
