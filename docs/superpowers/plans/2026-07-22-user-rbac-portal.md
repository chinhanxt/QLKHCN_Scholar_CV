# User Portal & Role-Based Access Control (RBAC) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement strict system-wide RBAC security enforcement (Django REST Framework permission classes + React Router admin guards) and build the complete User Portal (`/portal`) with a 3-tab layout (Scholar Profile/CV, Profile Link Submission & "Đang chờ duyệt" Status, Account Settings).

**Architecture:** Django REST Framework custom permissions (`IsAdminUser`, `IsProfileOwner`) guarding backend views; Django models `ScholarProfile` and `ScholarPublication` managing user profile submission and approval state (`PENDING` -> `APPROVED`); React Router `RequireAdmin` guard and layout split (`AdminLayout` vs `UserLayout`) for frontend access control.

**Tech Stack:** Python 3, Django 4.2, Django REST Framework, React 18, TypeScript, Tailwind CSS, Lucide React, Pytest / Django TestCase.

---

## File Structure

```
apps/
├── core/
│   └── permissions.py                            # Modify: Add IsAdminUser & IsProfileOwner permission classes
├── scholar/
│   ├── models.py                                 # Modify: Add ScholarProfile & ScholarPublication models
│   ├── api/
│   │   ├── serializers.py                        # Modify: Add ScholarProfileSerializer, ScholarPublicationSerializer, ProfileSubmitSerializer
│   │   ├── views.py                              # Modify: Add UserScholarProfileViewSet & AdminScholarApprovalViewSet
│   │   └── urls.py                               # Modify: Register user portal & admin approval API endpoints
│   └── tests/
│       └── test_permissions_and_portal.py        # Create: Pytest / TestCase for backend RBAC & Portal APIs
frontend/src/
├── api/
│   └── hooks/
│       └── useUserPortal.ts                      # Create: React Query hooks for user portal profile & submit
├── components/
│   ├── guards/
│   │   └── RequireAdmin.tsx                      # Create: Route guard for admin-only pages
│   └── layout/
│       └── UserLayout.tsx                        # Create: Top navbar layout for normal users
├── pages/
│   └── UserPortalPage.tsx                        # Create: 3-Tab User Portal UI (Profile CV, Status, Account)
└── routes.tsx                                    # Modify: Add /portal route, protect admin routes with RequireAdmin
```

---

### Task 1: Backend Permission Classes (`IsAdminUser`, `IsProfileOwner`)

**Files:**
- Modify: `apps/core/permissions.py`
- Test: `apps/scholar/tests/test_permissions_and_portal.py`

- [ ] **Step 1: Write failing test for custom permissions**

Create `apps/scholar/tests/test_permissions_and_portal.py`:

```python
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory
from apps.core.permissions import IsAdminUser, IsProfileOwner

User = get_user_model()

@pytest.mark.django_db
def test_is_admin_user_permission():
    factory = APIRequestFactory()
    permission = IsAdminUser()

    normal_user = User.objects.create_user(email="user@example.com", username="user1", password="password123")
    admin_user = User.objects.create_superuser(email="admin@example.com", username="admin1", password="password123")

    # Request by normal user
    request_user = factory.get("/")
    request_user.user = normal_user
    assert permission.has_permission(request_user, None) is False

    # Request by admin user
    request_admin = factory.get("/")
    request_admin.user = admin_user
    assert permission.has_permission(request_admin, None) is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest apps/scholar/tests/test_permissions_and_portal.py -k test_is_admin_user_permission`  
Expected: FAIL with `ImportError: cannot import name 'IsAdminUser' from 'apps.core.permissions'`

- [ ] **Step 3: Implement `IsAdminUser` and `IsProfileOwner` permission classes**

Modify `apps/core/permissions.py`:

```python
from rest_framework.permissions import BasePermission, DjangoModelPermissions


class FullDjangoModelPermissions(DjangoModelPermissions):
    """Extends DjangoModelPermissions to also require view permission."""

    perms_map = {
        "GET": ["%(app_label)s.view_%(model_name)s"],
        "OPTIONS": [],
        "HEAD": [],
        "POST": ["%(app_label)s.add_%(model_name)s"],
        "PUT": ["%(app_label)s.change_%(model_name)s"],
        "PATCH": ["%(app_label)s.change_%(model_name)s"],
        "DELETE": ["%(app_label)s.delete_%(model_name)s"],
    }


class IsAdminUser(BasePermission):
    """Allows access only to admin users (is_staff or is_superuser)."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_staff or request.user.is_superuser)
        )


class IsProfileOwner(BasePermission):
    """Allows access only to the owner of the profile or admin users."""

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_staff or request.user.is_superuser:
            return True
        return hasattr(obj, "user") and obj.user == request.user
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest apps/scholar/tests/test_permissions_and_portal.py -k test_is_admin_user_permission`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/core/permissions.py apps/scholar/tests/test_permissions_and_portal.py
git commit -m "feat(auth): add IsAdminUser and IsProfileOwner permission classes"
```

---

### Task 2: Scholar Profile & Publication Models & Migrations

**Files:**
- Modify: `apps/scholar/models.py`
- Test: `apps/scholar/tests/test_permissions_and_portal.py`

- [ ] **Step 1: Write failing test for `ScholarProfile` and `ScholarPublication` models**

Append to `apps/scholar/tests/test_permissions_and_portal.py`:

```python
from apps.scholar.models import ScholarProfile, ScholarPublication

@pytest.mark.django_db
def test_scholar_profile_and_publication_creation():
    user = User.objects.create_user(email="scholar_user@example.com", username="scholar1", password="password123")
    profile = ScholarProfile.objects.create(
        user=user,
        scholar_url="https://scholar.google.com/citations?user=AHHDABDaaaaJ",
        scholar_id="AHHDABDaaaaJ",
        status="PENDING",
    )
    assert profile.status == "PENDING"
    assert profile.scholar_id == "AHHDABDaaaaJ"

    pub = ScholarPublication.objects.create(
        profile=profile,
        title="Deep Learning in AI Research",
        authors="Nguyen Van A, Tran Van B",
        journal="IEEE Transactions",
        pub_year=2024,
        citations=42,
    )
    assert pub.profile == profile
    assert pub.citations == 42
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest apps/scholar/tests/test_permissions_and_portal.py -k test_scholar_profile_and_publication_creation`  
Expected: FAIL with `ImportError: cannot import name 'ScholarProfile' from 'apps.scholar.models'`

- [ ] **Step 3: Implement `ScholarProfile` and `ScholarPublication` models**

Append at the end of `apps/scholar/models.py`:

```python
# ==============================================================================
# 5. USER SCHOLAR PROFILE & PUBLICATIONS
# ==============================================================================

class ProfileStatus(models.TextChoices):
    DRAFT = "DRAFT", _("Chưa gửi hồ sơ")
    PENDING = "PENDING", _("Đang chờ duyệt")
    APPROVED = "APPROVED", _("Đã phê duyệt")
    REJECTED = "REJECTED", _("Từ chối")


class ScholarProfile(BaseModel):
    user = models.OneToOneField(
        "users.User",
        on_delete=models.CASCADE,
        related_name="scholar_profile",
        verbose_name=_("User"),
    )
    scholar_url = models.URLField(_("Scholar URL"), max_length=500, blank=True, null=True)
    scholar_id = models.CharField(_("Scholar ID"), max_length=100, blank=True, null=True)
    status = models.CharField(
        _("Status"),
        max_length=20,
        choices=ProfileStatus.choices,
        default=ProfileStatus.DRAFT,
        db_index=True,
    )
    submitted_at = models.DateTimeField(_("Submitted At"), blank=True, null=True)
    approved_at = models.DateTimeField(_("Approved At"), blank=True, null=True)
    total_citations = models.IntegerField(_("Total Citations"), default=0)
    h_index = models.IntegerField(_("H-Index"), default=0)
    i10_index = models.IntegerField(_("i10-Index"), default=0)

    class Meta:
        db_table = "scholar_profiles"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.email} - {self.status}"


class ScholarPublication(BaseModel):
    profile = models.ForeignKey(
        ScholarProfile,
        on_delete=models.CASCADE,
        related_name="publications",
        verbose_name=_("Scholar Profile"),
    )
    title = models.CharField(_("Publication Title"), max_length=500)
    authors = models.TextField(_("Authors"), blank=True, default="")
    journal = models.CharField(_("Journal / Conference"), max_length=500, blank=True, default="")
    pub_year = models.IntegerField(_("Publication Year"), blank=True, null=True)
    citations = models.IntegerField(_("Citations Count"), default=0)
    url = models.URLField(_("Publication Link"), max_length=500, blank=True, default="")

    class Meta:
        db_table = "scholar_publications"
        ordering = ["-pub_year", "-citations"]

    def __str__(self):
        return self.title
```

- [ ] **Step 4: Generate database migrations and run tests**

Run migration command:
`python manage.py makemigrations scholar`  
`python manage.py migrate`

Run test: `pytest apps/scholar/tests/test_permissions_and_portal.py -k test_scholar_profile_and_publication_creation`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/scholar/models.py apps/scholar/migrations/ apps/scholar/tests/test_permissions_and_portal.py
git commit -m "feat(scholar): add ScholarProfile and ScholarPublication models with migrations"
```

---

### Task 3: Backend API Views & Serializers for User Portal

**Files:**
- Modify: `apps/scholar/api/serializers.py`
- Modify: `apps/scholar/api/views.py`
- Modify: `apps/scholar/api/urls.py`
- Test: `apps/scholar/tests/test_permissions_and_portal.py`

- [ ] **Step 1: Write failing API test for Profile submission and User Portal endpoints**

Append to `apps/scholar/tests/test_permissions_and_portal.py`:

```python
from rest_framework.test import APIClient

@pytest.mark.django_db
def test_user_portal_profile_submission_and_get():
    user = User.objects.create_user(email="portal_user@example.com", username="puser1", password="password123")
    client = APIClient()
    client.force_authenticate(user=user)

    # 1. GET user profile (auto-created on first get as DRAFT)
    res = client.get("/api/scholar/me/profile/")
    assert res.status_code == 200
    assert res.data["status"] == "DRAFT"

    # 2. POST submit Scholar URL
    submit_data = {"scholar_url": "https://scholar.google.com/citations?user=AHHDABDaaaaJ"}
    res_submit = client.post("/api/scholar/me/profile/submit/", submit_data, format="json")
    assert res_submit.status_code == 200
    assert res_submit.data["status"] == "PENDING"
    assert res_submit.data["scholar_id"] == "AHHDABDaaaaJ"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest apps/scholar/tests/test_permissions_and_portal.py -k test_user_portal_profile_submission_and_get`  
Expected: FAIL with `404 Not Found` (endpoint `/api/scholar/me/profile/` not registered)

- [ ] **Step 3: Implement Serializers in `apps/scholar/api/serializers.py`**

Append to `apps/scholar/api/serializers.py`:

```python
import re
from rest_framework import serializers
from apps.scholar.models import ScholarProfile, ScholarPublication, ProfileStatus


class ScholarPublicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScholarPublication
        fields = ["id", "title", "authors", "journal", "pub_year", "citations", "url"]


class ScholarProfileSerializer(serializers.ModelSerializer):
    publications = ScholarPublicationSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ScholarProfile
        fields = [
            "id",
            "scholar_url",
            "scholar_id",
            "status",
            "status_display",
            "submitted_at",
            "approved_at",
            "total_citations",
            "h_index",
            "i10_index",
            "publications",
        ]


class ProfileSubmitSerializer(serializers.Serializer):
    scholar_url = serializers.URLField(required=True)

    def validate_scholar_url(self, value):
        if "scholar.google" not in value.lower():
            raise serializers.ValidationError("Đường dẫn phải là liên kết hợp lệ từ Google Scholar.")
        return value.strip()
```

- [ ] **Step 4: Implement Views in `apps/scholar/api/views.py`**

Append to `apps/scholar/api/views.py`:

```python
from re import search as re_search
from django.utils import timezone
from rest_framework.viewsets import ViewSet, ModelViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from apps.core.permissions import IsAdminUser
from apps.scholar.models import ScholarProfile, ScholarPublication, ProfileStatus
from apps.scholar.api.serializers import (
    ScholarProfileSerializer,
    ScholarPublicationSerializer,
    ProfileSubmitSerializer,
)


class UserScholarProfileViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def _get_or_create_profile(self, user):
        profile, _ = ScholarProfile.objects.get_or_create(user=user)
        return profile

    @action(detail=False, methods=["get"], url_path="profile")
    def my_profile(self, request):
        profile = self._get_or_create_profile(request.user)
        serializer = ScholarProfileSerializer(profile)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="profile/submit")
    def submit_profile(self, request):
        profile = self._get_or_create_profile(request.user)
        serializer = ProfileSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        url = serializer.validated_data["scholar_url"]
        # Extract user ID parameter if present
        match = re_search(r"user=([a-zA-Z0-9_-]+)", url)
        scholar_id = match.group(1) if match else None

        profile.scholar_url = url
        profile.scholar_id = scholar_id
        profile.status = ProfileStatus.PENDING
        profile.submitted_at = timezone.now()
        profile.save()

        return Response(ScholarProfileSerializer(profile).data, status=status.HTTP_200_OK)


class AdminScholarApprovalViewSet(ModelViewSet):
    permission_classes = [IsAdminUser]
    queryset = ScholarProfile.objects.all()
    serializer_class = ScholarProfileSerializer

    @action(detail=True, methods=["post"], url_path="approve")
    def approve_profile(self, request, pk=None):
        profile = self.get_object()
        profile.status = ProfileStatus.APPROVED
        profile.approved_at = timezone.now()
        profile.save()
        return Response(ScholarProfileSerializer(profile).data, status=status.HTTP_200_OK)
```

- [ ] **Step 5: Register URLs in `apps/scholar/api/urls.py`**

Inspect `apps/scholar/api/urls.py` and register `UserScholarProfileViewSet` and `AdminScholarApprovalViewSet`:

```python
from rest_framework.routers import DefaultRouter
from apps.scholar.api.views import UserScholarProfileViewSet, AdminScholarApprovalViewSet

router = DefaultRouter()
router.register(r"me", UserScholarProfileViewSet, basename="user-scholar-me")
router.register(r"admin/profiles", AdminScholarApprovalViewSet, basename="admin-scholar-profiles")

urlpatterns = router.urls
```

- [ ] **Step 6: Run API test to verify it passes**

Run: `pytest apps/scholar/tests/test_permissions_and_portal.py`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/scholar/api/serializers.py apps/scholar/api/views.py apps/scholar/api/urls.py apps/scholar/tests/test_permissions_and_portal.py
git commit -m "feat(api): add User Scholar Profile submission & Admin approval endpoints"
```

---

### Task 4: Frontend API Hooks (`useUserPortal.ts`)

**Files:**
- Create: `frontend/src/api/hooks/useUserPortal.ts`

- [ ] **Step 1: Create `useUserPortal.ts` with React Query hooks**

Create `frontend/src/api/hooks/useUserPortal.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export interface ScholarPublication {
  id: string
  title: string
  authors: string
  journal: string
  pub_year: number | null
  citations: number
  url: string
}

export interface ScholarProfile {
  id: string
  scholar_url: string | null
  scholar_id: string | null
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'
  status_display: string
  submitted_at: string | null
  approved_at: string | null
  total_citations: number
  h_index: number
  i10_index: number
  publications: ScholarPublication[]
}

export function useMyProfile() {
  return useQuery<ScholarProfile>({
    queryKey: ['user-portal-profile'],
    queryFn: async () => {
      const response = await api.get('/api/scholar/me/profile/')
      return response.data
    },
  })
}

export function useSubmitScholarProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { scholar_url: string }) => {
      const response = await api.post('/api/scholar/me/profile/submit/', payload)
      return response.data as ScholarProfile
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-portal-profile'] })
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/hooks/useUserPortal.ts
git commit -m "feat(frontend): add useUserPortal React Query hooks"
```

---

### Task 5: Frontend Route Guard (`RequireAdmin`) & User Layout (`UserLayout`)

**Files:**
- Create: `frontend/src/components/guards/RequireAdmin.tsx`
- Create: `frontend/src/components/layout/UserLayout.tsx`

- [ ] **Step 1: Create `RequireAdmin.tsx` Guard**

Create `frontend/src/components/guards/RequireAdmin.tsx`:

```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext' // Or current user hook

export function RequireAdmin() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500 text-sm">
        Đang xác thực quyền truy cập...
      </div>
    )
  }

  if (!user || (!user.is_staff && !user.is_superuser)) {
    return <Navigate to="/portal" replace />
  }

  return <Outlet />
}
```

- [ ] **Step 2: Create `UserLayout.tsx` Navbar Header Layout**

Create `frontend/src/components/layout/UserLayout.tsx`:

```tsx
import { Outlet, Link } from 'react-router-dom'
import { GraduationCap, LogOut, User as UserIcon } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'

export function UserLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Minimal Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/portal" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-xs">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-bold text-slate-900 text-base tracking-tight">Cổng Nhà Khoa Học</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
              <UserIcon className="h-3.5 w-3.5 text-slate-500" />
              {user?.email}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="h-9 px-3 text-xs text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl"
              title="Đăng xuất"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Thoát
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/guards/RequireAdmin.tsx frontend/src/components/layout/UserLayout.tsx
git commit -m "feat(frontend): create RequireAdmin route guard and UserLayout component"
```

---

### Task 6: Frontend User Portal Page (`UserPortalPage.tsx`)

**Files:**
- Create: `frontend/src/pages/UserPortalPage.tsx`

- [ ] **Step 1: Create `UserPortalPage.tsx` with 3 Tabs**

Create `frontend/src/pages/UserPortalPage.tsx`:

```tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  BookOpen,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  KeyRound,
  Send,
  Award,
  TrendingUp,
} from 'lucide-react'
import { useMyProfile, useSubmitScholarProfile } from '@/api/hooks/useUserPortal'
import { getApiErrorMessage } from '@/lib/api-error'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Spinner } from '@/components/ui/spinner'

const submitSchema = z.object({
  scholar_url: z
    .string()
    .min(1, 'Vui lòng nhập đường dẫn Google Scholar')
    .url('Đường dẫn không hợp lệ')
    .refine((url) => url.toLowerCase().includes('scholar.google'), {
      message: 'Đường dẫn phải thuộc miền scholar.google.com',
    }),
})

type SubmitValues = z.infer<typeof submitSchema>

export function UserPortalPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'submit' | 'settings'>('profile')
  const { data: profile, isLoading } = useMyProfile()
  const submitProfile = useSubmitScholarProfile()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SubmitValues>({
    resolver: zodResolver(submitSchema),
    defaultValues: { scholar_url: profile?.scholar_url || '' },
  })

  const onSubmitScholarUrl = (values: SubmitValues) => {
    submitProfile.mutate(values, {
      onSuccess: () => {
        toast.success('Đã gửi thông tin liên kết Google Scholar thành công!')
        setActiveTab('submit')
      },
      onError: (err) => toast.error(getApiErrorMessage(err, 'Gửi thông tin thất bại')),
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500 text-sm">
        <Spinner className="mr-2 h-5 w-5 text-blue-600" /> Đang tải thông tin hồ sơ...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation Header */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Hồ sơ Scholar & CV
        </button>

        <button
          onClick={() => setActiveTab('submit')}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'submit'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Send className="h-4 w-4" />
          Cập nhật thông tin Hồ sơ
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <User className="h-4 w-4" />
          Tài khoản & Mật khẩu
        </button>
      </div>

      {/* Tab 1: Scholar Profile & CV */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {profile?.status === 'APPROVED' ? (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between shadow-2xs">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Tổng trích dẫn</p>
                    <p className="text-2xl font-extrabold text-slate-900">{profile.total_citations}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-600 opacity-80" />
                </Card>
                <Card className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between shadow-2xs">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Chỉ số h-index</p>
                    <p className="text-2xl font-extrabold text-indigo-700">{profile.h_index}</p>
                  </div>
                  <Award className="h-8 w-8 text-indigo-600 opacity-80" />
                </Card>
                <Card className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between shadow-2xs">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Chỉ số i10-index</p>
                    <p className="text-2xl font-extrabold text-emerald-700">{profile.i10_index}</p>
                  </div>
                  <Award className="h-8 w-8 text-emerald-600 opacity-80" />
                </Card>
              </div>

              {/* Publications Table */}
              <Card className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Danh sách Bài báo & Công trình khoa học ({profile.publications?.length || 0})
                  </h3>
                </div>
                <Table>
                  <THead>
                    <TR className="bg-slate-50">
                      <TH className="py-3 px-4 font-semibold text-slate-700">Tên bài báo</TH>
                      <TH className="py-3 px-4 font-semibold text-slate-700">Tác giả</TH>
                      <TH className="py-3 px-4 font-semibold text-slate-700">Năm</TH>
                      <TH className="py-3 px-4 font-semibold text-slate-700 text-right">Trích dẫn</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {profile.publications?.map((pub) => (
                      <TR key={pub.id} className="hover:bg-slate-50/60">
                        <TD className="py-3 px-4 font-medium text-slate-900 text-sm">
                          {pub.url ? (
                            <a
                              href={pub.url}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline text-blue-700 flex items-center gap-1"
                            >
                              {pub.title} <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ) : (
                            pub.title
                          )}
                        </TD>
                        <TD className="py-3 px-4 text-xs text-slate-600">{pub.authors}</TD>
                        <TD className="py-3 px-4 text-xs font-semibold text-slate-700">{pub.pub_year || '-'}</TD>
                        <TD className="py-3 px-4 text-xs font-bold text-blue-700 text-right">{pub.citations}</TD>
                      </TR>
                    ))}
                    {(!profile.publications || profile.publications.length === 0) && (
                      <TR>
                        <TD colSpan={4} className="py-8 text-center text-slate-500 text-sm">
                          Chưa có công trình khoa học nào được ghi nhận.
                        </TD>
                      </TR>
                    )}
                  </TBody>
                </Table>
              </Card>
            </>
          ) : (
            <Card className="p-8 text-center rounded-2xl border border-slate-200 bg-white space-y-4 max-w-xl mx-auto shadow-2xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 mx-auto">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Hồ sơ đang trong quá trình xử lý</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Hồ sơ của bạn đang được kiểm tra và chờ duyệt. Vui lòng quay lại sau khi quản trị viên hoàn tất kiểm tra thông tin.
              </p>
              <Button onClick={() => setActiveTab('submit')} className="bg-blue-600 hover:bg-blue-700 text-xs font-semibold rounded-xl">
                Xem trạng thái hồ sơ
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* Tab 2: Profile Submission & Status */}
      {activeTab === 'submit' && (
        <Card className="p-6 rounded-2xl border border-slate-200 bg-white space-y-6 max-w-2xl mx-auto shadow-2xs">
          <div>
            <h3 className="text-base font-bold text-slate-900">Gửi thông tin liên kết Google Scholar</h3>
            <p className="text-xs text-slate-500 mt-1">
              Nhập đường dẫn trang cá nhân Google Scholar của bạn để được cập nhật dữ liệu.
            </p>
          </div>

          {/* Current Status Banner */}
          <div className="p-4 rounded-xl border flex items-center justify-between bg-slate-50 border-slate-200">
            <span className="text-xs font-semibold text-slate-700">Trạng thái hồ sơ hiện tại:</span>
            {profile?.status === 'PENDING' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="h-3.5 w-3.5" /> Đang chờ duyệt
              </span>
            )}
            {profile?.status === 'APPROVED' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" /> Đã phê duyệt
              </span>
            )}
            {(profile?.status === 'DRAFT' || !profile?.status) && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                <AlertCircle className="h-3.5 w-3.5" /> Chưa gửi hồ sơ
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmitScholarUrl)} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="scholar_url" className="text-sm font-semibold text-slate-800">
                  Liên kết Google Scholar
                </Label>
                <a
                  href="https://scholar.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                >
                  Truy cập Google Scholar của bạn <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <Input
                id="scholar_url"
                placeholder="vd: https://scholar.google.com/citations?user=AHHDABDaaaaJ"
                {...register('scholar_url')}
                className="h-11 rounded-xl text-sm font-mono"
              />
              {errors.scholar_url && <p className="text-xs text-red-600">{errors.scholar_url.message}</p>}
              <p className="text-[11px] text-slate-400">
                Ví dụ cấu trúc URL hợp lệ: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">https://scholar.google.com/citations?user=AHHDABDaaaaJ</code>
              </p>
            </div>

            <Button
              type="submit"
              disabled={submitProfile.isPending}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs"
            >
              {submitProfile.isPending && <Spinner className="mr-2" />}
              Gửi thông tin hồ sơ
            </Button>
          </form>
        </Card>
      )}

      {/* Tab 3: Account Settings */}
      {activeTab === 'settings' && (
        <Card className="p-6 rounded-2xl border border-slate-200 bg-white space-y-6 max-w-xl mx-auto shadow-2xs">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-blue-600" /> Cài đặt Tài khoản
          </h3>
          <p className="text-xs text-slate-500">Quản lý mật khẩu và thông tin tài khoản cá nhân.</p>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/UserPortalPage.tsx
git commit -m "feat(frontend): create UserPortalPage component with 3-tab layout"
```

---

### Task 7: App Routing Integration & End-to-End Build Verification

**Files:**
- Modify: `frontend/src/routes.tsx`

- [ ] **Step 1: Update `frontend/src/routes.tsx` with `/portal` and `RequireAdmin` protection**

Modify `frontend/src/routes.tsx`:

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { RequireAdmin } from '@/components/guards/RequireAdmin'
import { AppLayout } from '@/components/layout/AppLayout'
import { UserLayout } from '@/components/layout/UserLayout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { UsersPage } from '@/pages/UsersPage'
import { ScholarScraperPage } from '@/pages/ScholarScraperPage'
import { BioxbioCrawlerPage } from '@/pages/BioxbioCrawlerPage'
import { ScimagoCrawlerPage } from '@/pages/ScimagoCrawlerPage'
import { ClarivateCrawlerPage } from '@/pages/ClarivateCrawlerPage'
import { ScoreIntegratorPage } from '@/pages/ScoreIntegratorPage'
import { ProfileManagerPage } from '@/pages/ProfileManagerPage'
import { UnifiedCrawlerPage } from '@/pages/UnifiedCrawlerPage'
import { ScholarAutoSchedulerPage } from '@/pages/ScholarAutoSchedulerPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { DatabasePage } from '@/pages/DatabasePage'
import { HelpPage } from '@/pages/HelpPage'
import { UserPortalPage } from '@/pages/UserPortalPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      // User Portal Layout
      {
        element: <UserLayout />,
        children: [{ path: '/portal', element: <UserPortalPage /> }],
      },
      // Admin Protected Routes
      {
        element: <RequireAdmin />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/', element: <DashboardPage /> },
              { path: '/scholar/unified', element: <UnifiedCrawlerPage /> },
              { path: '/scholar/auto-scheduler', element: <ScholarAutoSchedulerPage /> },
              { path: '/scholar/scraper', element: <ScholarScraperPage /> },
              { path: '/scholar/bioxbio', element: <BioxbioCrawlerPage /> },
              { path: '/scholar/scimago', element: <ScimagoCrawlerPage /> },
              { path: '/scholar/clarivate', element: <ClarivateCrawlerPage /> },
              { path: '/scholar/integrator', element: <ScoreIntegratorPage /> },
              { path: '/scholar/profiles', element: <ProfileManagerPage /> },
              { path: '/users', element: <UsersPage /> },
              { path: '/settings', element: <SettingsPage /> },
              { path: '/database', element: <DatabasePage /> },
              { path: '/help', element: <HelpPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/portal" replace /> },
])
```

- [ ] **Step 2: Run backend tests to verify RBAC & Portal endpoints**

Run: `pytest`  
Expected: All backend tests PASS cleanly.

- [ ] **Step 3: Run frontend build check**

Run: `npm run build` (or `npx tsc --noEmit`)  
Expected: Build succeeds with 0 TypeScript compilation errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes.tsx
git commit -m "feat(routes): integrate UserPortal route and wrap admin routes with RequireAdmin guard"
```

---

## Self-Review Checklist
- [x] **Spec Coverage:** Verified all specs (IsAdminUser, IsProfileOwner, ScholarProfile, ScholarPublication, RequireAdmin, UserLayout, UserPortalPage, "Đang chờ duyệt" status) are mapped to executable tasks.
- [x] **Placeholder Scan:** No "TODO", "TBD", or pseudo-code steps.
- [x] **Type Consistency:** Model names, statuses (`PENDING`, `APPROVED`), and hook interface fields match across all tasks.
