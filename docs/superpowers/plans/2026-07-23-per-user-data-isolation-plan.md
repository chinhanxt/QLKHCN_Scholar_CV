# Per-User Data Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure 100% per-user data isolation in the User Portal across backend API, DRF serializers, React Query caching, and frontend profile components.

**Architecture:** Bind all frontend React Query hooks to `user?.id`, wipe query cache on logout, remove serializer fallback fuzzy matching on username when `scholar_id` is empty, and eliminate hardcoded mock fallback strings in frontend UI components.

**Tech Stack:** React 18, React Query (TanStack Query v5), TypeScript, Lucide React, Django 4.2 REST Framework, PostgreSQL.

---

### Task 1: Isolate Serializer & Backend API (`apps/scholar/api/serializers.py`)

**Files:**
- Modify: `apps/scholar/api/serializers.py:277-299`

- [ ] **Step 1: Inspect `ScholarProfileSerializer.get_author_detail`**

Inspect lines 277-299 of `apps/scholar/api/serializers.py`.

- [ ] **Step 2: Update `get_author_detail` to return `None` when `scholar_id` is empty**

```python
    def get_author_detail(self, obj):
        scholar_id = (obj.scholar_id or "").strip()
        if not scholar_id:
            return None

        author = AuthorProfile.objects.filter(scholar_id__iexact=scholar_id).prefetch_related("publications").first()
        if not author:
            author = AuthorProfile.objects.filter(scholar_id__icontains=scholar_id).prefetch_related("publications").first()
        if not author:
            for a in AuthorProfile.objects.all().prefetch_related("publications"):
                if scholar_id in a.scholar_id or a.scholar_id in scholar_id:
                    author = a
                    break
        if author:
            return AuthorProfileDetailSerializer(author).data

        return None
```

- [ ] **Step 3: Test backend response for user without Scholar ID**

Run: `docker exec edu_ecosystem_local_django python manage.py shell -c "from apps.scholar.api.serializers import ScholarProfileSerializer; from apps.scholar.models import ScholarProfile; p = ScholarProfile(user_id=None); print(ScholarProfileSerializer(p).data['author_detail'])"`
Expected: `None`

- [ ] **Step 4: Commit backend serializer isolation**

```bash
git add apps/scholar/api/serializers.py
git commit -m "fix(scholar): return null author_detail if scholar_id is empty to prevent cross-user data bleed"
```

---

### Task 2: Isolate React Query Cache Keys & Wiping Cache on Logout (`frontend/src/api/hooks/useUserPortal.ts` & `frontend/src/stores/auth.store.ts`)

**Files:**
- Modify: `frontend/src/api/hooks/useUserPortal.ts`
- Modify: `frontend/src/stores/auth.store.ts`

- [ ] **Step 1: Update `useMyProfile` and `useScholarPublications` to include `user?.id` in `queryKey`**

In `frontend/src/api/hooks/useUserPortal.ts`:
```typescript
import { useAuthStore } from '@/stores/auth.store'

export function useMyProfile() {
  const user = useAuthStore((s) => s.user)
  return useQuery<ScholarProfile>({
    queryKey: ['user-portal-profile', user?.id],
    queryFn: async () => {
      const response = await api.get('/scholar/me/profile/')
      return response.data
    },
    enabled: Boolean(user?.id),
  })
}
```

- [ ] **Step 2: Update `useAuthStore.logout()` to wipe React Query Cache**

In `frontend/src/stores/auth.store.ts`:
Import `queryClient` or clear `localStorage` / `queryClient.clear()` on logout:
```typescript
import { queryClient } from '@/lib/query-client' // or QueryClient instance

logout: () => {
  queryClient.clear()
  set({ user: null, token: null, isAuthenticated: false })
  localStorage.removeItem('auth-storage')
}
```

- [ ] **Step 3: Commit cache isolation**

```bash
git add frontend/src/api/hooks/useUserPortal.ts frontend/src/stores/auth.store.ts
git commit -m "feat(auth): bind React Query cache keys to user.id and wipe cache on logout"
```

---

### Task 3: Clean UI Empty-State & Remove Hardcoded Mock Fallbacks (`frontend/src/pages/UserProfilePage.tsx` & `frontend/src/pages/UserEditProfilePage.tsx`)

**Files:**
- Modify: `frontend/src/pages/UserProfilePage.tsx`
- Modify: `frontend/src/pages/UserEditProfilePage.tsx`

- [ ] **Step 1: Remove hardcoded default fallbacks in `UserProfilePage.tsx`**

In `frontend/src/pages/UserProfilePage.tsx`:
```typescript
  const academicTitle = profile?.academic_title || 'Chưa cập nhật'
  const position = profile?.position || 'Chưa cập nhật'
  const department = profile?.department || 'Chưa cập nhật'
  const email = user?.email || profile?.user_email || 'Chưa cập nhật'
  const affiliation = profile?.institution || profile?.author_detail?.affiliation || 'Chưa cập nhật'
```

- [ ] **Step 2: Remove hardcoded default fallbacks in `UserEditProfilePage.tsx`**

In `frontend/src/pages/UserEditProfilePage.tsx`:
```typescript
  useEffect(() => {
    if (profile?.scholar_url) {
      setScholarUrl(profile.scholar_url)
    }
    setFullName(
      profile?.full_name ||
      [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
      profile?.author_detail?.name ||
      user?.username ||
      ''
    )
    setAcademicTitle(profile?.academic_title || '')
    setPosition(profile?.position || '')
    setDepartment(profile?.department || '')
    setInstitution(profile?.institution || profile?.author_detail?.affiliation || '')
  }, [profile, user])
```

- [ ] **Step 3: Commit UI clean empty-state updates**

```bash
git add frontend/src/pages/UserProfilePage.tsx frontend/src/pages/UserEditProfilePage.tsx
git commit -m "style(user-portal): replace hardcoded mock strings with clean empty-state placeholders"
```

---

### Task 4: Production Build & Multi-Account Isolation Verification

**Files:**
- Test: Frontend build & backend query check

- [ ] **Step 1: Run frontend production build**

Run: `npm run build` in `frontend/` directory.
Expected: `built in X.XXs` with 0 errors.

- [ ] **Step 2: Run verification script on Django backend**

Run: `docker exec edu_ecosystem_local_django python manage.py shell -c "from apps.scholar.models import ScholarProfile; print('Total Scholar Profiles:', ScholarProfile.objects.count())"`
Expected: Success with 0 errors.

- [ ] **Step 3: Final Commit**

```bash
git add .
git commit -m "chore: complete per-user data isolation verification"
```
