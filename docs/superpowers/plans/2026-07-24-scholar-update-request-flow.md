# Scholar Profile Update Request Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "Request Update" flow for Google Scholar user profiles and distinguish initial requests from update requests in both Backend API and Admin Requests interface.

**Architecture:** Add a `request_type` field (`NEW` / `UPDATE`) to `ScholarProfile` model. On the Frontend User Portal (`UserPortalPage.tsx`), lock input fields upon submission and provide an explicit "Yêu cầu cập nhật" action to unlock and re-submit. On the Admin Requests page (`ScholarRequestsPage.tsx`), render 3 distinct status badges and context-aware scanning buttons ("Quét hồ sơ mới" vs "Quét cập nhật").

**Tech Stack:** Python 3, Django, Django REST Framework, TypeScript, React 18, React Query (TanStack Query), Tailwind CSS, Lucide Icons.

---

## File Structure

- **Backend**:
  - `apps/scholar/models.py`: Add `RequestType` choices enum & `request_type` model field to `ScholarProfile`.
  - `apps/scholar/api/serializers.py`: Expose `request_type` and `request_type_display` in `ScholarProfileSerializer`.
  - `apps/scholar/api/views.py`: Update `UserScholarProfileViewSet.submit_profile` to auto-detect initial submission (`NEW`) vs update submission (`UPDATE`).
  - `apps/scholar/tests/test_permissions_and_portal.py`: Unit tests for `request_type` behavior.

- **Frontend**:
  - `frontend/src/api/hooks/useUserPortal.ts`: Update `ScholarProfile` TypeScript interface.
  - `frontend/src/pages/UserPortalPage.tsx`: Implement form lock, `isEditingScholarUrl` toggle state, status badges, and "Yêu cầu cập nhật" action buttons.
  - `frontend/src/pages/ScholarRequestsPage.tsx`: Render 3 status representations ("Hồ sơ mới", "Yêu cầu cập nhật", "Đã phê duyệt") and dynamic action buttons ("Quét hồ sơ mới" vs "Quét cập nhật").

---

### Task 1: Backend Data Model & Serializer Updates

**Files:**
- Modify: `apps/scholar/models.py:545-575`
- Modify: `apps/scholar/api/serializers.py:165-190`
- Modify: `apps/scholar/api/views.py:945-965`
- Test: `apps/scholar/tests/test_permissions_and_portal.py`

- [ ] **Step 1: Write failing unit test for `request_type`**

Edit `apps/scholar/tests/test_permissions_and_portal.py` to add `test_submit_profile_request_type`:

```python
def test_submit_profile_request_type(self):
    """
    Verify initial submit sets request_type to NEW, and subsequent submit sets request_type to UPDATE.
    """
    user = User.objects.create_user(email="testrequesttype@example.com", password="password123")
    self.client.force_authenticate(user=user)

    # Initial submit -> request_type should be NEW
    res = self.client.post("/api/v1/scholar/me/profile/submit/", {"scholar_url": "https://scholar.google.com/citations?user=SCHOLAR_USER_1"})
    self.assertEqual(res.status_code, 200)
    self.assertEqual(res.data["request_type"], "NEW")

    # Re-submit after approval or initial submission -> request_type should be UPDATE
    res2 = self.client.post("/api/v1/scholar/me/profile/submit/", {"scholar_url": "https://scholar.google.com/citations?user=SCHOLAR_USER_1"})
    self.assertEqual(res2.status_code, 200)
    self.assertEqual(res2.data["request_type"], "UPDATE")
```

- [ ] **Step 2: Run test to verify it fails**

Run command:
```bash
python manage.py test apps.scholar.tests.test_permissions_and_portal.UserPortalTests.test_submit_profile_request_type
```
Expected: FAIL (KeyError or AttributeError: 'request_type' missing).

- [ ] **Step 3: Update `ScholarProfile` model in `apps/scholar/models.py`**

In `apps/scholar/models.py`, add `RequestType` class and `request_type` field:

```python
class RequestType(models.TextChoices):
    NEW = "NEW", _("Hồ sơ mới")
    UPDATE = "UPDATE", _("Yêu cầu cập nhật")


class ScholarProfile(BaseModel):
    user = models.OneToOneField(
        "users.User",
        on_delete=models.CASCADE,
        related_name="scholar_profile",
        verbose_name=_("User"),
    )
    scholar_url = models.URLField(
        _("Scholar URL"), max_length=500, blank=True, null=True
    )
    scholar_id = models.CharField(
        _("Scholar ID"), max_length=100, blank=True, null=True
    )
    status = models.CharField(
        _("Status"),
        max_length=20,
        choices=ProfileStatus.choices,
        default=ProfileStatus.DRAFT,
        db_index=True,
    )
    request_type = models.CharField(
        _("Request Type"),
        max_length=20,
        choices=RequestType.choices,
        default=RequestType.NEW,
        db_index=True,
    )
    submitted_at = models.DateTimeField(_("Submitted At"), blank=True, null=True)
```

- [ ] **Step 4: Update `ScholarProfileSerializer` in `apps/scholar/api/serializers.py`**

In `apps/scholar/api/serializers.py`, add `request_type` and `request_type_display`:

```python
class ScholarProfileSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    request_type_display = serializers.CharField(source="get_request_type_display", read_only=True)
    publications = ScholarPublicationSerializer(many=True, read_only=True)
    author_detail = serializers.SerializerMethodField()

    class Meta:
        model = ScholarProfile
        fields = [
            "id",
            "user_email",
            "scholar_url",
            "scholar_id",
            "status",
            "status_display",
            "request_type",
            "request_type_display",
            "submitted_at",
            "approved_at",
            "total_citations",
            "h_index",
            "i10_index",
            "full_name",
            "academic_title",
            "position",
            "department",
            "institution",
            "publications",
            "author_detail",
        ]
```

- [ ] **Step 5: Update `submit_profile` endpoint in `apps/scholar/api/views.py`**

In `apps/scholar/api/views.py`, update `submit_profile` logic:

```python
    @action(detail=False, methods=["post"], url_path="profile/submit")
    def submit_profile(self, request: Request) -> Response:
        """
        Gửi hoặc yêu cầu cập nhật liên kết hồ sơ Google Scholar để chờ duyệt.
        """
        profile = self._get_or_create_profile(request.user)
        serializer = ProfileSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        url = serializer.validated_data["scholar_url"]
        match = re_search(r"user=([a-zA-Z0-9_-]+)", url)
        scholar_id = match.group(1) if match else None

        # Determine request_type: UPDATE if profile was previously approved or already submitted before DRAFT
        if profile.approved_at or (profile.status and profile.status != ProfileStatus.DRAFT) or profile.scholar_url:
            profile.request_type = RequestType.UPDATE
        else:
            profile.request_type = RequestType.NEW

        profile.scholar_url = url
        profile.scholar_id = scholar_id
        profile.status = ProfileStatus.PENDING
        profile.submitted_at = timezone.now()
        profile.save()

        return Response(ScholarProfileSerializer(profile).data, status=status.HTTP_200_OK)
```

- [ ] **Step 6: Make Django Migrations and Run Tests**

Run commands:
```bash
python manage.py makemigrations scholar
python manage.py migrate
python manage.py test apps.scholar.tests.test_permissions_and_portal
```
Expected: All tests PASS cleanly.

- [ ] **Step 7: Commit Task 1**

```bash
git add apps/scholar/models.py apps/scholar/migrations/ apps/scholar/api/serializers.py apps/scholar/api/views.py apps/scholar/tests/test_permissions_and_portal.py
git commit -m "feat(scholar): add request_type field to ScholarProfile model and API"
```

---

### Task 2: Frontend Types & User Portal Update Request Form (`UserPortalPage.tsx`)

**Files:**
- Modify: `frontend/src/api/hooks/useUserPortal.ts:16-36`
- Modify: `frontend/src/pages/UserPortalPage.tsx:700-755`

- [ ] **Step 1: Update `ScholarProfile` interface in `frontend/src/api/hooks/useUserPortal.ts`**

Update `ScholarProfile` interface:

```typescript
export interface ScholarProfile {
  id: string
  user_email?: string
  scholar_url: string | null
  scholar_id: string | null
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'
  status_display: string
  request_type?: 'NEW' | 'UPDATE'
  request_type_display?: string
  submitted_at: string | null
  approved_at: string | null
  total_citations: number
  h_index: number
  i10_index: number
  full_name?: string
  academic_title?: string
  position?: string
  department?: string
  institution?: string
  publications: ScholarPublication[]
  author_detail?: AuthorProfileDetail | null
}
```

- [ ] **Step 2: Add `isEditingScholarUrl` state & toggle handling in `UserPortalPage.tsx`**

In `frontend/src/pages/UserPortalPage.tsx`:
Add state near top of `UserPortalPage` component:
```typescript
const [isEditingScholarUrl, setIsEditingScholarUrl] = useState(false)
```

Update `onSubmitScholarUrl`:
```typescript
const onSubmitScholarUrl = (values: SubmitValues) => {
  submitProfile.mutate(values, {
    onSuccess: () => {
      toast.success(
        profile?.status === 'APPROVED' || profile?.scholar_url
          ? 'Đã gửi yêu cầu cập nhật hồ sơ Google Scholar thành công!'
          : 'Đã gửi thông tin liên kết Google Scholar thành công!'
      )
      setIsEditingScholarUrl(false)
      setActiveTab('submit')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Gửi thông tin thất bại')),
  })
}
```

- [ ] **Step 3: Render locked form, status badges, and action buttons in `UserPortalPage.tsx`**

Update Tab 2 (`activeTab === 'submit'`) block in `UserPortalPage.tsx`:

```tsx
      {/* Tab 2: Submit Google Scholar Profile */}
      {activeTab === 'submit' && (
        <Card className="p-6 rounded-2xl border border-slate-200 bg-white space-y-6 max-w-2xl mx-auto shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-blue-600" /> Hồ sơ Google Scholar
            </h3>
            {profile?.status === 'PENDING' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="h-3.5 w-3.5" />
                {profile?.request_type === 'UPDATE'
                  ? 'Đang chờ duyệt cập nhật'
                  : 'Đang chờ duyệt hồ sơ mới'}
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
                disabled={
                  (profile?.status === 'PENDING' || profile?.status === 'APPROVED') &&
                  !isEditingScholarUrl
                }
                className="h-11 rounded-xl text-sm font-mono disabled:bg-slate-50 disabled:text-slate-600 disabled:border-slate-200"
              />
              {errors.scholar_url && <p className="text-xs text-red-600">{errors.scholar_url.message}</p>}
              <p className="text-[11px] text-slate-400">
                Ví dụ cấu trúc URL hợp lệ: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">https://scholar.google.com/citations?user=AHHDABDaaaaJ</code>
              </p>
            </div>

            <ScholarGuide defaultOpen={false} className="mt-2" />

            {/* Action Buttons Logic */}
            {profile?.scholar_url && (profile.status === 'PENDING' || profile.status === 'APPROVED') && !isEditingScholarUrl ? (
              <Button
                type="button"
                onClick={() => setIsEditingScholarUrl(true)}
                className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <FileText className="h-4 w-4" /> Yêu cầu cập nhật
              </Button>
            ) : isEditingScholarUrl ? (
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditingScholarUrl(false)}
                  className="w-1/3 h-11 rounded-xl text-xs font-semibold"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={submitProfile.isPending}
                  className="w-2/3 h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs cursor-pointer"
                >
                  {submitProfile.isPending && <Spinner className="mr-2" />}
                  Gửi yêu cầu cập nhật
                </Button>
              </div>
            ) : (
              <Button
                type="submit"
                disabled={submitProfile.isPending}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs cursor-pointer"
              >
                {submitProfile.isPending && <Spinner className="mr-2" />}
                Gửi thông tin hồ sơ
              </Button>
            )}
          </form>
        </Card>
      )}
```

- [ ] **Step 4: Verify Frontend Build**

Run command:
```bash
npm --prefix frontend run build
```
Expected: Build succeeds with 0 errors.

- [ ] **Step 5: Commit Task 2**

```bash
git add frontend/src/api/hooks/useUserPortal.ts frontend/src/pages/UserPortalPage.tsx
git commit -m "feat(frontend): implement request update form flow on user portal"
```

---

### Task 3: Admin Requests Page Status & Action Updates (`ScholarRequestsPage.tsx`)

**Files:**
- Modify: `frontend/src/pages/ScholarRequestsPage.tsx:208-255`

- [ ] **Step 1: Update Table Status Badges and Action Buttons in `ScholarRequestsPage.tsx`**

In `frontend/src/pages/ScholarRequestsPage.tsx`, update TD for status & TD for actions:

Import `RefreshCw` from `lucide-react`:
```typescript
import {
  Clock,
  CheckCircle2,
  ExternalLink,
  Search,
  FileText,
  RefreshCw,
} from 'lucide-react'
```

Update `status` column TD:
```tsx
                  <TD className="py-3.5 px-4">
                    {p.status === 'PENDING' ? (
                      p.request_type === 'UPDATE' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200/80">
                          <RefreshCw className="h-3.5 w-3.5 text-amber-600 animate-spin-slow" /> Yêu cầu cập nhật
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200/80">
                          <Clock className="h-3.5 w-3.5 text-blue-600" /> Hồ sơ mới
                        </span>
                      )
                    ) : p.status === 'APPROVED' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/80">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Đã phê duyệt
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200">
                        Chưa gửi
                      </span>
                    )}
                  </TD>
```

Update `actions` column TD:
```tsx
                  <TD className="py-3.5 px-4 text-right">
                    {p.status === 'PENDING' ? (
                      <Button
                        size="sm"
                        onClick={() => handleScanNewProfile(p)}
                        disabled={scanningId !== null}
                        className={`h-8 px-3.5 text-xs text-white font-semibold rounded-lg cursor-pointer flex items-center gap-1.5 ml-auto shadow-2xs disabled:opacity-50 ${
                          p.request_type === 'UPDATE'
                            ? 'bg-amber-600 hover:bg-amber-700'
                            : 'bg-[#005b9a] hover:bg-[#00487a]'
                        }`}
                      >
                        {scanningId === p.id ? (
                          <>
                            <Spinner className="h-3.5 w-3.5 text-white" />
                            <span>Đang kích hoạt...</span>
                          </>
                        ) : p.request_type === 'UPDATE' ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>Quét cập nhật</span>
                          </>
                        ) : (
                          <>
                            <FileText className="h-3.5 w-3.5" />
                            <span>Quét hồ sơ mới</span>
                          </>
                        )}
                      </Button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                        ✓ Đã duyệt & Quét
                      </span>
                    )}
                  </TD>
```

- [ ] **Step 2: Run Full Verification Suite**

Run commands:
```bash
python manage.py test apps.scholar.tests
npm --prefix frontend run build
```
Expected: All backend unit tests PASS and frontend bundle builds cleanly.

- [ ] **Step 3: Commit Task 3**

```bash
git add frontend/src/pages/ScholarRequestsPage.tsx
git commit -m "feat(admin): differentiate new profile vs update request status and action buttons"
```

---

## Self-Review Checklist

1. **Spec coverage:** 
   - Lock input on submit? Yes (`disabled` attribute).
   - "Yêu cầu cập nhật" button? Yes (`isEditingScholarUrl` state).
   - Backend `request_type`? Yes (`RequestType` model enum & API).
   - Admin 3 states & buttons ("Quét hồ sơ mới" / "Quét cập nhật")? Yes.
2. **Placeholder scan:** No placeholders or vague TODOs found.
3. **Type consistency:** `request_type` is consistently defined as `'NEW' | 'UPDATE'` across backend model, serializer, and frontend interfaces.
