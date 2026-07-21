# Design Spec: Unified Scholar Publication Components Across Scraper and Profile Manager

**Date:** 2026-07-21  
**Status:** Approved  
**Target Goal:** Achieve 100% structural, visual, and metadata parity between the Scholar Scraper page (`/scholar/scraper`) and the Profile Manager page (`/scholar/profiles`).

---

## 1. Background & Rationale

Currently, scraped publication data displayed on the **Scholar Scraper** page (`http://localhost:5173/scholar/scraper`) includes rich metadata (authors formatted with Google Scholar initials, volume, issue, pages, publisher, abstract, PDF/URL links, SJR Quartiles, Impact Factor, Web of Science indexing, citation history chart, and Google Scholar action links).

However, when viewing saved profiles in the **Profile Manager** page (`http://localhost:5173/scholar/profiles`), the publication list and detail views were rendered using simplified templates that omitted some metadata fields or rendered author lists without shortening.

To ensure consistency, all publication list tables and detailed publication panels must be extracted into shared components so that scraped data looks and functions identically whether viewed live during scraping or accessed later from saved profile storage.

---

## 2. Architecture & Component Decomposition

We will create two reusable components under `frontend/src/components/scholar/`:

```
frontend/src/components/scholar/
├── PublicationDetailPanel.tsx
└── PublicationTableList.tsx
```

### 2.1 `PublicationDetailPanel.tsx`
This component handles the full detailed view when a user clicks on any publication item.

* **Props**:
  - `publication`: `PublicationDetail` (The selected publication object)
  - `authorName`: `string` (Name of the profile owner)
  - `onBack`: `() => void` (Handler to close detail view and return to table list)
  - `onEdit?`: `(pub: PublicationDetail, e: React.MouseEvent) => void` (Optional edit handler)
  - `onDelete?`: `(pubId: string, e: React.MouseEvent) => void` (Optional delete handler)

* **Sections Rendered**:
  1. **Navigation & Action Header**:
     - `← Quay lại danh sách` button
     - Author Profile Badge (`Hồ sơ tác giả: [authorName]`)
     - Action buttons (`Sửa bài báo`, `Xóa bài báo`) if handlers provided.
  2. **Publication Title Card**:
     - Large bold title (`text-[#2563EB]`).
  3. **Information & Ranks Grid (2-Column Layout)**:
     - **Card 1 - Thông tin xuất bản**:
       - Tác giả (`authors_list`)
       - Ngày xuất bản / Năm (`pub_date` or `year`)
       - Tạp chí / Nơi xuất bản (`venue`)
       - Tập (Volume), Số (Issue), Trang (Pages)
       - Nhà xuất bản (`publisher`)
       - Tổng trích dẫn (`citations`)
       - Liên kết (`pub_url`, `eprint_url`)
     - **Card 2 - Phân hạng & Chỉ số khoa học**:
       - SJR Quartile (Q1 green, Q2 amber, Q3 blue, Q4 slate, N/A)
       - Impact Factor (`IF: [val]`, purple badge)
       - Web of Science (`WoS: [val]`, rose badge)
  4. **Abstract / Description Card**:
     - Displays `description` (abstract text) with clean whitespace handling.
  5. **Citation History Chart Card**:
     - Bar chart rendering annual citation breakdown (`cites_per_year`) with permanently visible count badges above each bar.
  6. **Google Scholar Action Links Card**:
     - Direct links for Cited-by query (`scholar?cites=...`), Related articles (`scholar?q=related:...`), and All versions (`scholar?cluster=...`).

---

### 2.2 `PublicationTableList.tsx`
This component handles rendering the table of publications with filtering, sorting, selection, and action controls.

* **Props**:
  - `publications`: `PublicationDetail[]`
  - `selectedPubIds`: `string[]`
  - `onSelectPub`: `(pub: PublicationDetail) => void`
  - `onToggleSelectPub`: `(pubId: string, e: React.ChangeEvent<HTMLInputElement>) => void`
  - `onToggleSelectAll`: `() => void`
  - `onAddPub?`: `() => void`
  - `onOpenTrash?`: `() => void`
  - `onExport?`: `() => void`
  - `yearFilter`: `string`
  - `setYearFilter`: `(val: string) => void`
  - `quartileFilter`: `string`
  - `setQuartileFilter`: `(val: string) => void`
  - `sortBy`: `string`
  - `setSortBy`: `(val: string) => void`

* **Sections Rendered**:
  1. **Filter & Action Toolbar**:
     - Keyword search input field
     - Year dropdown filter
     - Quartile dropdown filter (Q1, Q2, Q3, Q4, N/A, All)
     - Sort dropdown (Citations desc/asc, Year desc/asc, Title asc/desc)
     - `Xuất Excel` export button
  2. **Table Header**:
     - Bulk selection checkbox
     - `TIÊU ĐỀ` header + `+` (Add publication) & Trash bin action buttons
     - `TRÍCH DẪN` header (clickable sort)
     - `NĂM` header (clickable sort)
  3. **Table Body Rows**:
     - Row Checkbox (stops event propagation)
     - **Title & Metadata Column**:
       - Title (bold blue text, leading-snug)
       - Shortened Authors list (`VL Feigin, BA Stark, CO Johnson, ...`) using `getShortenedAuthors` helper
       - Venue snippet (venue, volume, issue, pages in clean italic text)
       - Inline Badges for SJR (Q1-Q4), Impact Factor, Web of Science
     - **Citations Column**: Bold right-aligned citation count
     - **Year Column**: Right-aligned publication year

---

## 3. Integration Plan

1. Create `@/components/scholar/PublicationDetailPanel.tsx`.
2. Create `@/components/scholar/PublicationTableList.tsx`.
3. Refactor `frontend/src/pages/ScholarScraperPage.tsx` to use `PublicationDetailPanel` and `PublicationTableList`.
4. Refactor `frontend/src/pages/ProfileManagerPage.tsx` to use `PublicationDetailPanel` and `PublicationTableList`.
5. Run TypeScript build verification (`npm run build`).

---

## 4. Verification Criteria

- [x] Both Scraper page (`/scholar/scraper`) and Profile Manager page (`/scholar/profiles`) use identical shared components.
- [x] Author lists on main table views are truncated to Google Scholar initials format (`VL Feigin, BA Stark, CO Johnson, ...`).
- [x] Full publication details (volume, issue, pages, publisher, description, links, citation history chart, rank badges) are visible in the detail view on both pages.
- [x] Zero TypeScript or compilation errors.
