# Spec Design: Scholar Profile Update Request Flow (User & Admin)

**Date:** 2026-07-24  
**Status:** Approved  
**Target Module:** `apps/scholar`, `frontend/src/pages/UserPortalPage.tsx`, `frontend/src/pages/ScholarRequestsPage.tsx`

---

## 1. Context & Objectives

Currently, when a user submits their Google Scholar URL on the User Portal (`/scholar/portal`), the system marks the profile status as `PENDING`. On the Admin Requests page (`http://localhost:5173/scholar/requests`), admins can view pending requests and approve/trigger scraping tasks.

### Requirements:
1. **User Side (`UserPortalPage.tsx` - Submit Tab)**:
   - When a user has submitted a profile request (`PENDING` or `APPROVED`), lock the `scholar_url` input field and hide the default "Gửi thông tin hồ sơ" submit button.
   - Display a new button **"Yêu cầu cập nhật"** (Request Update).
   - Clicking **"Yêu cầu cập nhật"** unlocks the input field and displays a **"Gửi yêu cầu cập nhật"** submit button (along with a "Hủy" cancel button).
   - Submitting an update sends the request to the backend with `request_type = 'UPDATE'`, and locks the input field again upon completion.

2. **Admin Side (`ScholarRequestsPage.tsx` - `http://localhost:5173/scholar/requests`)**:
   - Explicitly distinguish between initial requests and update requests.
   - Support 3 clear request states / badges:
     1. 🟢 **Hồ sơ mới** (`status == 'PENDING'` & `request_type == 'NEW'`): Initial submission.
     2. 🟡 **Yêu cầu cập nhật** (`status == 'PENDING'` & `request_type == 'UPDATE'`): Update request submission.
     3. ✅ **Đã phê duyệt** (`status == 'APPROVED'`): Approved profile.
   - Action buttons for pending items:
     - For initial submissions: **"Quét hồ sơ mới"** (Scan New Profile).
     - For update submissions: **"Quét cập nhật"** (Scan Update Profile).

---

## 2. System Architecture & Detailed Design

### 2.1 Backend Changes (`apps/scholar`)

#### 1. Data Model (`apps/scholar/models.py`)
Add `RequestType` choices and `request_type` field to `ScholarProfile`:

```python
class RequestType(models.TextChoices):
    NEW = "NEW", _("Hồ sơ mới")
    UPDATE = "UPDATE", _("Yêu cầu cập nhật")

class ScholarProfile(BaseModel):
    # ... existing fields ...
    request_type = models.CharField(
        _("Request Type"),
        max_length=20,
        choices=RequestType.choices,
        default=RequestType.NEW,
        db_index=True,
    )
```

#### 2. API ViewSet (`apps/scholar/api/views.py`)
Update `UserScholarProfileViewSet.submit_profile`:

```python
@action(detail=False, methods=["post"], url_path="profile/submit")
def submit_profile(self, request: Request) -> Response:
    profile = self._get_or_create_profile(request.user)
    serializer = ProfileSubmitSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    url = serializer.validated_data["scholar_url"]
    match = re_search(r"user=([a-zA-Z0-9_-]+)", url)
    scholar_id = match.group(1) if match else None

    profile.scholar_url = url
    profile.scholar_id = scholar_id
    
    # Determine request_type: If profile was previously approved or already had a scholar_url submitted
    if profile.approved_at or (profile.status and profile.status != ProfileStatus.DRAFT):
        profile.request_type = RequestType.UPDATE
    else:
        profile.request_type = RequestType.NEW

    profile.status = ProfileStatus.PENDING
    profile.submitted_at = timezone.now()
    profile.save()

    return Response(ScholarProfileSerializer(profile).data, status=status.HTTP_200_OK)
```

#### 3. Serializers (`apps/scholar/api/serializers.py`)
Add `request_type` and `request_type_display` to `ScholarProfileSerializer` fields:

```python
class ScholarProfileSerializer(serializers.ModelSerializer):
    request_type_display = serializers.CharField(source="get_request_type_display", read_only=True)

    class Meta:
        model = ScholarProfile
        fields = [
            # ... existing fields ...,
            "request_type",
            "request_type_display",
        ]
```

---

### 2.2 Frontend Changes

#### 1. API Hook Types (`frontend/src/api/hooks/useUserPortal.ts`)
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
  // ... existing fields ...
}
```

#### 2. User Portal Page (`frontend/src/pages/UserPortalPage.tsx`)
- Maintain local state `isEditingScholarUrl` (boolean, default `false`).
- Control input state & button rendering:
  - **Condition A (`profile.status === 'DRAFT'` or no URL submitted)**:
    - Input `scholar_url`: Enabled.
    - Submit button: **"Gửi thông tin hồ sơ"**.
  - **Condition B (`(status === 'PENDING' || status === 'APPROVED')` & `!isEditingScholarUrl`)**:
    - Input `scholar_url`: Disabled (`readOnly`/`disabled`).
    - Status Badge:
      - `PENDING` + `request_type === 'NEW'`: 🟡 **Đang chờ duyệt (Hồ sơ mới)**
      - `PENDING` + `request_type === 'UPDATE'`: 🟡 **Đang chờ duyệt (Yêu cầu cập nhật)**
      - `APPROVED`: 🟢 **Đã phê duyệt**
    - Action button: **"Yêu cầu cập nhật"** (onClick: `setIsEditingScholarUrl(true)`).
  - **Condition C (`(status === 'PENDING' || status === 'APPROVED')` & `isEditingScholarUrl === true`)**:
    - Input `scholar_url`: Enabled for editing.
    - Action buttons:
      - Button **"Hủy"**: Cancel editing (`setIsEditingScholarUrl(false)`).
      - Button **"Gửi yêu cầu cập nhật"**: Triggers `submitProfile.mutate()`. On success, set `setIsEditingScholarUrl(false)`.

#### 3. Admin Requests Page (`frontend/src/pages/ScholarRequestsPage.tsx`)
- Status tab filter & Badges:
  - Render 3 status representations in the table:
    1. 🟢 **Hồ sơ mới** (`status === 'PENDING'` & `request_type === 'NEW'`)
    2. 🟡 **Yêu cầu cập nhật** (`status === 'PENDING'` & `request_type === 'UPDATE'`)
    3. ✅ **Đã phê duyệt** (`status === 'APPROVED'`)
- Action Column:
  - If `status === 'PENDING'`:
    - `request_type === 'NEW'`: Button **"Quét hồ sơ mới"**
    - `request_type === 'UPDATE'`: Button **"Quét cập nhật"**
  - If `status === 'APPROVED'`: Badge `✓ Đã duyệt & Quét`.

---

## 3. Self-Review & Verification Plan

1. **Placeholder Check**: All model fields, view logic, and UI states are explicitly defined.
2. **Consistency Check**: Backend enum aligns with Frontend types (`NEW` / `UPDATE`).
3. **Scope Check**: Scoped tightly to `apps/scholar` and User/Admin Frontend pages.
4. **Verification Strategy**:
   - Run backend migration to add `request_type` to `scholar_profiles`.
   - Test initial submission flow on User Portal -> Verify Admin shows "Hồ sơ mới" and button "Quét hồ sơ mới".
   - Test clicking "Yêu cầu cập nhật" on User Portal -> Verify input unlocks.
   - Test submitting update -> Verify Admin shows "Yêu cầu cập nhật" and button "Quét cập nhật".
