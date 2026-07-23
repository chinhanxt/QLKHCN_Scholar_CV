# Technical Design Spec: Per-User Data Isolation & Profile Security

**Date:** 2026-07-23  
**Status:** Approved  
**Author:** Antigravity AI & Pair Programmer  

---

## 1. Overview & Problem Statement

Currently, when different user accounts (e.g. `nhangamer500@gmail.com` vs `user@example.com`) log into the User Portal, they see shared or fallback mock profile data (e.g. `Bui Quang`, `ID: dTDZjxMAAAAJ`, `4372 citations`, `PGS.TS`).

### Root Causes Identified:
1. **React Query Cache Key Collisions:** The hook `useMyProfile()` uses a static query key `['user-portal-profile']`. Switching accounts in the same browser session reuses cached data from memory without re-fetching for the newly authenticated user ID.
2. **Hardcoded Mock Fallbacks:** Front-end components (`UserProfilePage.tsx` and `UserEditProfilePage.tsx`) fall back to hardcoded strings (`'PGS.TS'`, `'Giảng viên cao cấp'`, `'Khoa Khoa học Máy tính'`, `'Đại học Quốc gia Hà Nội'`) when user profile fields are empty.
3. **Serializer Fallback Over-matching:** `ScholarProfileSerializer.get_author_detail()` attempted fuzzy matching on `user.username` against `AuthorProfile` records, incorrectly matching unrelated accounts to existing authors.

---

## 2. Technical Architecture & Component Isolation

### 2.1 Backend Architecture (`apps/scholar/api/`)

1. **Strict 1:1 `ScholarProfile` Association:**
   - `UserScholarProfileViewSet._get_or_create_profile(user)` strictly operates on `ScholarProfile.objects.get_or_create(user=user)`.
   - New profiles initialize with:
     - `scholar_url = None`, `scholar_id = None`
     - `status = ProfileStatus.DRAFT`
     - `full_name = None`, `academic_title = None`, `position = None`, `department = None`, `institution = None`
     - `total_citations = 0`, `h_index = 0`, `i10_index = 0`

2. **Serializer Isolation (`ScholarProfileSerializer`):**
   - If `obj.scholar_id` is empty/null, `author_detail` MUST return `None`.
   - Remove fuzzy matching fallback on `obj.user.username` so empty profiles do not inherit data from other authors.

### 2.2 Frontend Cache Isolation (`src/api/hooks/useUserPortal.ts` & `src/stores/auth.store.ts`)

1. **User ID Bound Query Keys:**
   - `useMyProfile()` query key updated to: `['user-portal-profile', user?.id]`
   - `useScholarPublications()` query key updated to: `['user-scholar-pubs', user?.id]`

2. **Global Auth Logout & Session Wiping:**
   - `useAuthStore.logout()` executes `queryClient.clear()` to erase memory caches on user session termination.

### 2.3 UI & Initial State Specification (`UserProfilePage.tsx` & `UserEditProfilePage.tsx`)

1. **Fresh Account Initial State (e.g. `nhangamer500@gmail.com`):**
   - **Author Name:** Displays `user.first_name + user.last_name` or `user.username` or `user.email`.
   - **Status Badge:** `✕ Chưa kết nối Google Scholar`.
   - **Fields (`Học hàm`, `Chức vụ`, `Bộ môn`, `Cơ quan`):** Displays `"Chưa cập nhật"` instead of fake preset data (`PGS.TS`).
   - **Metrics:** Displays `0` for total citations, H-index, i10-index.
   - **Publications:** Empty list / CTA to connect Scholar URL.

---

## 3. Verification Plan

1. **Multi-Account Switching Test:**
   - Log in as User A (`user@example.com` with Scholar connected). Verify Scholar ID and citations display correctly.
   - Log out.
   - Log in as User B (`nhangamer500@gmail.com` with fresh profile). Verify UI is 100% clean, displaying `nhangamer500@gmail.com` name/email, `"Chưa cập nhật"`, and `✕ Chưa kết nối Google Scholar`.
2. **Build Verification:**
   - Execute `npm run build` to ensure 0 TypeScript or build errors.
