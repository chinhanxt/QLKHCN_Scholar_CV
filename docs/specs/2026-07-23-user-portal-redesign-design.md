# Design Spec: User Portal Redesign & Scholar Profile Integration

**Date:** 2026-07-23
**Target System:** User Portal (`/user/*` routes)
**Author:** Antigravity AI Pair Programmer

---

## 1. Overview & Goals

Redesign the end-user experience of the platform, moving away from admin-centric workflows to provide a dedicated, polished 4-tab User Portal. The goal is to streamline personal scientific profiles (based on a refined, non-redundant NAFOSTED CV template), showcase full Google Scholar scraped publications & analytics, enable effortless Scholar URL submission to Admin with real-time validation, and provide account settings.

### Key Requirements
1. **User Focus Only:** Zero changes to Admin management views.
2. **Direct Google Scholar External Links:** Every view showing Scholar profile data includes a direct external link (with icon) leading to the live `scholar.google.com/citations?user=...` profile.
3. **Smart Scholar URL Submission:** Client-side URL regex validation & Scholar ID extraction preview (`user=XXXXX`) when submitting/updating Scholar URL to Admin.
4. **Clean NAFOSTED Academic Profile:** Refined personal details, omitting redundant NAFOSTED fields (bank account numbers, tax IDs, detailed fixed phone/fax numbers) while keeping academic essentials (Degrees, Titles, Affiliation, Research Areas, Education History).

---

## 2. Information Architecture & Navigation

The User Sidebar navigation consists of 4 clear tabs:

| Tab Name | Route | Icon | Purpose |
| :--- | :--- | :--- | :--- |
| **Thông tin cá nhân** | `/user/profile` | `User` | Academic CV overview, Scholar connection status & direct link to Tab 2 |
| **Hồ sơ Scholar chi tiết** | `/user/scholar` | `GraduationCap` / `BookOpen` | Full scraped Google Scholar stats, publication table & external link |
| **Cập nhật thông tin** | `/user/edit-profile` | `Edit` / `FileEdit` | Edit academic profile & Smart Google Scholar URL submission card |
| **Cài đặt tài khoản** | `/user/settings` | `Settings` | Change password, account credentials & session management |

---

## 3. Detailed Tab Specifications

### Tab 1: Thông tin cá nhân (`/user/profile`)
- **Header Card:** User Avatar, Full Name, Title/Degree (e.g. PGS.TS, Tiến sĩ), Department/Faculty, Organization, Primary Email.
- **Google Scholar Connection Status Card:**
  - **Status: APPROVED / SCAPED:**
    - Green badge `Đã liên kết Google Scholar`.
    - Key metrics summary: Citations, H-Index, i10-Index.
    - External Link button: "Mở trang Google Scholar gốc ↗" (links directly to `https://scholar.google.com/citations?user=<scholar_id>`).
    - Internal navigation button: "Xem Hồ Sơ Scholar Chi Tiết ➔" (navigates to Tab 2 `/user/scholar`).
  - **Status: PENDING:**
    - Amber badge `Đang chờ Admin duyệt`.
    - Message showing submission timestamp & link to Tab 3 to update URL if needed.
  - **Status: DRAFT / NONE:**
    - Slate badge `Chưa liên kết Google Scholar`.
    - Quick CTA button "Gửi Link Google Scholar Ngay" (navigates to Tab 3 `/user/edit-profile`).
- **Academic Qualifications & Experience Section:**
  - **Quá trình đào tạo:** Table/List of degrees (Degree level, Institution, Major, Graduation year).
  - **Hướng nghiên cứu chính:** Styled tags/pills for primary research topics.

### Tab 2: Hồ sơ Scholar chi tiết (`/user/scholar`)
- **Header Bar:** Profile Title with direct external button: **"Mở trang Google Scholar gốc ↗"**.
- **Metrics Grid (4 Modern Stat Cards):**
  - Total Publications (Bài báo)
  - Total Citations (Trích dẫn)
  - H-Index
  - i10-Index
- **Publications Table Component:**
  - Search input (by paper title, venue, year).
  - Filter dropdowns (Year, ISI/Scopus quartile tags).
  - Table columns: Paper Title (with external link if available), Authors, Journal/Conference, Publication Year, Citation Count, Quartile/Indexing Badges.

### Tab 3: Cập nhật thông tin (`/user/edit-profile`)
- **Card 1: Smart Google Scholar URL Submission Form:**
  - Input field for dán Google Scholar URL (`https://scholar.google.com/citations?user=...`).
  - Real-time client-side JS regex parser:
    - Validates URL format.
    - Extracts `Scholar ID` (e.g. `vIowI28AAAAJ`).
    - Renders a live preview card with extracted ID, green check status, and test link button "Mở thử trên Google Scholar ↗".
  - Action button: **"Gửi Yêu Cầu Phê Duyệt Đến Admin"**.
- **Card 2: Compact NAFOSTED Scientific Profile Form:**
  - Full Name, Title (PGS.TS, TS, ThS...), Department, Organization.
  - Research Interests (comma-separated tags).
  - Education History Manager (Dynamic add/edit/delete rows: Degree Level, Institution, Major, Year Range).

### Tab 4: Cài đặt tài khoản (`/user/settings`)
- Account Profile details (Email, User ID, Role).
- Change Password Form (Current password, new password, confirm new password).
- Logout action.

---

## 4. Error Handling & API Integration

- **Endpoints Used:**
  - `GET /api/scholar/user-portal/my-profile/` - Fetches user profile & approval request status.
  - `POST /api/scholar/user-portal/submit-request/` - Submits/updates Google Scholar URL.
  - `PUT /api/scholar/user-portal/my-profile/` - Updates scientific CV info.
  - `POST /api/auth/password/change/` - Changes user password.
- Toast notifications for all async submit actions.

---

## 5. Verification & Acceptance Criteria
- User navigation between 4 tabs works seamlessly.
- Direct external link to `scholar.google.com/citations?user=...` is present and functional in both Tab 1 and Tab 2.
- Scholar URL submission auto-extracts Scholar ID and validates input.
- Production build (`npm run build`) completes cleanly.
