# Design Spec: Add Edit and Delete Actions to Publication Detail View in Profile Manager

**Date:** 2026-07-21  
**Status:** Approved  
**Target File:** `frontend/src/pages/ProfileManagerPage.tsx`  

---

## 1. Overview
In `ProfileManagerPage.tsx`, when viewing a publication's detailed panel (`<PublicationDetailPanel />`), the "Sửa bài báo" (Edit) and "Xóa bài báo" (Delete) buttons are currently missing because the `onEdit` and `onDelete` props are not passed.

This feature adds:
1. `onDelete` handler to move the publication to `deletedPublications` (Trash bin), adjust the author's total citations (`citedby`), notify via toast, and return to the list view.
2. `onEdit` handler and an **Edit Publication Dialog Modal** pre-filled with the publication details to allow modifying paper title, authors list, venue, year, citations count, SJR Q, Impact Factor, and WoS indexing.

---

## 2. Component & State Changes

### A. State in `ProfileManagerPage.tsx`
- `isEditPubModalOpen` (boolean): Controls visibility of the Edit Publication modal.
- `editingPublication` (PublicationDetail | null): Holds the publication currently being edited.
- Reuse existing `pubForm` state or dedicated `editPubForm` for holding form input values.

### B. Handlers in `ProfileManagerPage.tsx`
1. `handleDeleteSinglePub(pubId: string, e?: React.MouseEvent)`:
   - Asks confirmation via `window.confirm`.
   - Adds the target publication to `deletedPublications`.
   - Filters out the target publication from `selectedProfile.publications`.
   - Recalculates total citations for `selectedProfile`.
   - Clears `selectedPubId` (returning to the publication list).
   - Displays success toast.

2. `openEditPubModal(pub: PublicationDetail, e?: React.MouseEvent)`:
   - Sets `editingPublication` to `pub`.
   - Populates `pubForm` with values from `pub`.
   - Opens `isEditPubModalOpen`.

3. `handleSaveEditPub(e: React.FormEvent)`:
   - Updates target publication in `selectedProfile.publications`.
   - Recalculates total `citedby` for `selectedProfile`.
   - Closes modal & clears `editingPublication`.
   - Displays success toast.

### C. JSX Updates
- Pass `onEdit={(pub, e) => openEditPubModal(pub, e)}` and `onDelete={(pubId, e) => handleDeleteSinglePub(pubId, e)}` to `<PublicationDetailPanel />`.
- Render the **Edit Publication Modal** (`isEditPubModalOpen`) with fields for:
  - Title (textarea)
  - Authors list (text input)
  - Venue / Journal (text input)
  - Year & Citations (number inputs)
  - SJR Q (select: N/A, Q1, Q2, Q3, Q4)
  - Impact Factor & WoS Indexing (text inputs)

---

## 3. Self-Review & Verification Plan
- **Placeholder scan:** None.
- **Consistency:** Uses existing `PublicationDetailPanel` component interface and modal styles in `ProfileManagerPage.tsx`.
- **Scope:** Single page UI enhancement.
