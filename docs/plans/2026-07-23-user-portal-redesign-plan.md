# User Portal Redesign & Scholar Profile Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the User Portal into a polished 4-tab interface (Profile Overview, Detailed Scholar Data, Update Profile with Smart URL Submission, and Account Settings) with direct external links to live Google Scholar profiles.

**Architecture:** React 19 + TypeScript + React Router v7 + TanStack Query + Tailwind CSS v4 on frontend, connecting to Django DRF user portal endpoints.

**Tech Stack:** React 19, TypeScript, React Router v7, TanStack Query, Lucide React, Sonner, Tailwind CSS.

---

### File Structure & Responsibility Map

- `frontend/src/components/layout/UserLayout.tsx`: Updates User Sidebar navigation menu items for 4 tabs: Profile (`/user/profile`), Detailed Scholar (`/user/scholar`), Edit Profile (`/user/edit-profile`), Settings (`/user/settings`).
- `frontend/src/routes.tsx`: Maps `/user/profile`, `/user/scholar`, `/user/edit-profile`, `/user/settings` and redirects `/user/portal` to `/user/profile`.
- `frontend/src/pages/UserProfilePage.tsx`: Tab 1 page component. Displays academic profile summary, Scholar connection card with direct external link & button to navigate to Tab 2, and education history.
- `frontend/src/pages/UserScholarPage.tsx`: Tab 2 page component. Displays scraped Scholar analytics (citations, h-index, i10-index), direct link to live Google Scholar profile, and publications table.
- `frontend/src/pages/UserEditProfilePage.tsx`: Tab 3 page component. Smart Scholar URL submission card with client-side regex extraction preview (`user=XXXXX`) and compact NAFOSTED CV form.
- `frontend/src/pages/UserSettingsPage.tsx`: Tab 4 page component. Account details and change password form.

---

### Task 1: Update Navigation & Routes (`UserLayout.tsx` & `routes.tsx`)

**Files:**
- Modify: `frontend/src/components/layout/UserLayout.tsx`
- Modify: `frontend/src/routes.tsx`

- [ ] **Step 1: Update `UserSidebar` menu items in `UserLayout.tsx`**

In `frontend/src/components/layout/UserLayout.tsx`, update the `menuItems` list to match the 4 new tabs:

```tsx
const menuItems = [
  { icon: User, label: 'Thông tin cá nhân', path: '/user/profile' },
  { icon: GraduationCap, label: 'Hồ sơ Scholar chi tiết', path: '/user/scholar' },
  { icon: FileEdit, label: 'Cập nhật thông tin', path: '/user/edit-profile' },
  { icon: Settings, label: 'Cài đặt tài khoản', path: '/user/settings' },
]
```

- [ ] **Step 2: Register routes in `routes.tsx`**

In `frontend/src/routes.tsx`, import `UserProfilePage`, `UserScholarPage`, `UserEditProfilePage`, `UserSettingsPage` and add routes:

```tsx
{
  path: 'user',
  element: (
    <RequireAuth>
      <UserLayout />
    </RequireAuth>
  ),
  children: [
    { path: '', element: <Navigate to="/user/profile" replace /> },
    { path: 'portal', element: <Navigate to="/user/profile" replace /> },
    { path: 'profile', element: <UserProfilePage /> },
    { path: 'scholar', element: <UserScholarPage /> },
    { path: 'edit-profile', element: <UserEditProfilePage /> },
    { path: 'settings', element: <UserSettingsPage /> },
  ],
}
```

- [ ] **Step 3: Commit navigation updates**

```bash
git add src/components/layout/UserLayout.tsx src/routes.tsx
git commit -m "feat(user-portal): update sidebar navigation and routes for 4 user tabs"
```

---

### Task 2: Create Tab 1 - Personal Profile Page (`UserProfilePage.tsx`)

**Files:**
- Create: `frontend/src/pages/UserProfilePage.tsx`

- [ ] **Step 1: Create `UserProfilePage.tsx` component**

Implement `UserProfilePage.tsx` with:
- Academic Profile Header Card (Full Name, Title, Department, Institution, Email).
- Google Scholar Connection Status Card:
  - If `status === 'APPROVED'` or profile details exist:
    - Green badge `Đã liên kết Google Scholar`.
    - Stats summary (Citations, H-index, i10-index).
    - Direct external link button to `https://scholar.google.com/citations?user=<scholar_id>` (Target `_blank`).
    - Internal CTA button "Xem Hồ Sơ Scholar Chi Tiết ➔" (`onClick={() => navigate('/user/scholar')}`).
  - If `status === 'PENDING'`:
    - Amber badge `Đang chờ Admin duyệt`.
  - If no link / draft:
    - Slate badge + Button "Gửi Link Google Scholar Ngay" (`onClick={() => navigate('/user/edit-profile')}`).
- Education history & Research topics section.

- [ ] **Step 2: Verify component rendering**

Verify `UserProfilePage.tsx` compiles without TypeScript errors.

- [ ] **Step 3: Commit Tab 1**

```bash
git add src/pages/UserProfilePage.tsx
git commit -m "feat(user-portal): implement Tab 1 UserProfilePage component"
```

---

### Task 3: Create Tab 2 - Detailed Scholar Analytics & Publications (`UserScholarPage.tsx`)

**Files:**
- Create: `frontend/src/pages/UserScholarPage.tsx`

- [ ] **Step 1: Create `UserScholarPage.tsx` component**

Implement `UserScholarPage.tsx` with:
- Top Header Bar with title and prominent direct external link: **"Mở trang Google Scholar gốc ↗"** (`https://scholar.google.com/citations?user=<scholar_id>`).
- 4 Stat Cards: Total Papers, Citations, H-Index, i10-Index.
- Publications search bar & year filter.
- Publications Data Table (Paper Title, Authors, Journal/Publisher, Year, Citations, ISI/Scopus badges).

- [ ] **Step 2: Commit Tab 2**

```bash
git add src/pages/UserScholarPage.tsx
git commit -m "feat(user-portal): implement Tab 2 UserScholarPage component with direct Scholar link"
```

---

### Task 4: Create Tab 3 - Update Profile & Smart Scholar URL Submission (`UserEditProfilePage.tsx`)

**Files:**
- Create: `frontend/src/pages/UserEditProfilePage.tsx`

- [ ] **Step 1: Create `UserEditProfilePage.tsx` component**

Implement `UserEditProfilePage.tsx` with:
- **Smart Scholar URL Submission Card:**
  - URL text input.
  - Client-side regex parser extracting `user=([a-zA-Z0-9_-]+)`.
  - Live validation preview card showing extracted `Scholar ID`, green check mark, and button to test URL in browser `Mở thử trên Google Scholar ↗`.
  - Submit button to POST request to Admin.
- **NAFOSTED Scientific Profile Form:**
  - Edit Full Name, Title (PGS.TS, TS, ThS...), Administrative Position, Department, Institution.
  - Edit Research Areas (tags).
  - Manage Education History (Add/Remove rows: Degree, School, Major, Years).

- [ ] **Step 2: Commit Tab 3**

```bash
git add src/pages/UserEditProfilePage.tsx
git commit -m "feat(user-portal): implement Tab 3 UserEditProfilePage component with smart URL preview"
```

---

### Task 5: Create Tab 4 - Account Settings (`UserSettingsPage.tsx`)

**Files:**
- Create: `frontend/src/pages/UserSettingsPage.tsx`

- [ ] **Step 1: Create `UserSettingsPage.tsx` component**

Implement `UserSettingsPage.tsx` with:
- Profile info card (Email, User ID, Role).
- Change Password Form (Current password, new password, confirm new password).
- Logout action.

- [ ] **Step 2: Commit Tab 4**

```bash
git add src/pages/UserSettingsPage.tsx
git commit -m "feat(user-portal): implement Tab 4 UserSettingsPage component"
```

---

### Task 6: Build Verification & Final Sanity Check

**Files:**
- Test build output in `frontend/`

- [ ] **Step 1: Run production build**

Run: `npm run build` in `frontend/`
Expected output: Build completes with 0 errors.

- [ ] **Step 2: Commit final changes & docs**

```bash
git add docs/plans/2026-07-23-user-portal-redesign-plan.md
git commit -m "docs: finalize user portal redesign plan and spec"
```
