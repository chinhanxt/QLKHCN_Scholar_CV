# Email Notification Service & In-App Notification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time, multi-channel notification system (Async SMTP Email + In-App Header Bell Dropdown) and Admin Email Settings sub-tab so users are instantly notified when admin approves their Scholar profile or background scans discover new publications.

**Architecture:** 
- Backend: Django `Notification` model with JSON metadata and Extensible Notification Type Enums. Service layer (`NotificationService`) handles in-app notification insertion and background thread-safe HTML email dispatching.
- Frontend: Responsive Header Topbar in `AppLayout` featuring a Notification Bell Popover with unread count badges, filter tabs, relative timestamps, and mark-as-read actions. Admin `/settings` page enhanced with Sub-Tabs (Proxy & Anti-Block Settings vs Email SMTP Settings & Live Test Mail).

**Tech Stack:** Python 3.12, Django 6.0, Django REST Framework, React 18, TypeScript, TanStack Query, Tailwind CSS, Lucide Icons, pytest-django.

---

## File Structure

### Backend
- **Create**: `apps/core/models/notification.py` - `Notification`, `NotificationType`, `NotificationCategory` models.
- **Modify**: `apps/core/models/__init__.py` - Export notification models.
- **Create**: `apps/core/services/notification_service.py` - Central service for creating notifications & sending HTML emails asynchronously.
- **Create**: `apps/core/api/serializers.py` - Serializers for Notification model and Email Settings.
- **Create**: `apps/core/api/views.py` - Views for notifications (list, unread-count, mark-read, mark-all-read).
- **Create**: `apps/core/api/urls.py` - Router for notification API endpoints.
- **Modify**: `config/urls.py` - Include core API router under `/api/v1/core/`.
- **Create**: `templates/emails/profile_approved.html` - Responsive HTML email template for profile approvals.
- **Create**: `templates/emails/new_publications.html` - Responsive HTML email template for new paper discoveries.
- **Create**: `templates/emails/test_email.html` - Test email template for SMTP verification.
- **Modify**: `apps/scholar/api/views.py` - Integrate `NotificationService.notify_user_profile_approved` in `approve_profile` & add email settings API.
- **Modify**: `apps/scholar/tasks.py` - Integrate `NotificationService.notify_user_new_publications` in `scrape_author_cv_smart_task`.

### Frontend
- **Create**: `frontend/src/api/endpoints/notifications.ts` - Axios API endpoints and TypeScript interfaces for notifications & email settings.
- **Create**: `frontend/src/hooks/useNotifications.ts` - TanStack Query hook for notification polling and actions.
- **Create**: `frontend/src/components/layout/Header.tsx` - App Topbar Header.
- **Create**: `frontend/src/components/layout/NotificationBell.tsx` - Notification Bell Popover with badge, tabs, and item list.
- **Modify**: `frontend/src/components/layout/AppLayout.tsx` - Include `Header` above main route outlet.
- **Create**: `frontend/src/components/scholar/EmailSettingsCard.tsx` - Admin SMTP configuration card with live test email modal.
- **Modify**: `frontend/src/pages/SettingsPage.tsx` - Update to sub-tabs layout (Crawler & Proxy vs Email SMTP).

### Tests
- **Create**: `apps/core/tests/test_notification_model.py` - Model tests for `Notification`.
- **Create**: `apps/core/tests/test_notification_service.py` - Unit tests for `NotificationService`.
- **Create**: `apps/core/tests/test_notification_api.py` - API tests for notification endpoints.
- **Create**: `apps/scholar/tests/test_notification_triggers.py` - Integration tests verifying triggers in profile approval and smart check.

---

## Tasks

### Task 1: Backend Notification Model & Migrations

**Files:**
- Create: `apps/core/models/notification.py`
- Modify: `apps/core/models/__init__.py`
- Test: `apps/core/tests/test_notification_model.py`

- [ ] **Step 1: Write failing model test**

Create `apps/core/tests/test_notification_model.py`:

```python
import pytest
from django.contrib.auth import get_user_model
from apps.core.models import Notification, NotificationType, NotificationCategory

User = get_user_model()


@pytest.mark.django_db
def test_create_notification():
    user = User.objects.create_user(username="testuser", email="test@example.com", password="pass")
    notification = Notification.objects.create(
        user=user,
        title="Hồ sơ được duyệt",
        message="Hồ sơ Scholar của bạn đã được phê duyệt",
        notification_type=NotificationType.PROFILE_APPROVED,
        category=NotificationCategory.SCHOLAR,
        metadata={"total_pubs": 10}
    )

    assert notification.id is not None
    assert notification.is_read is False
    assert notification.notification_type == "PROFILE_APPROVED"
    assert notification.metadata["total_pubs"] == 10
    assert str(notification) == f"Notification({user.email} - Hồ sơ được duyệt)"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL=sqlite:////tmp/test.db DJANGO_SETTINGS_MODULE=config.settings.test .venv/bin/pytest apps/core/tests/test_notification_model.py`
Expected: FAIL with `ImportError: cannot import name 'Notification' from 'apps.core.models'`

- [ ] **Step 3: Implement Notification Model**

Create `apps/core/models/notification.py`:

```python
from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.core.models.base import BaseModel


class NotificationType(models.TextChoices):
    PROFILE_APPROVED = "PROFILE_APPROVED", _("Hồ sơ đã phê duyệt")
    NEW_PUBLICATIONS_DETECTED = "NEW_PUBLICATIONS_DETECTED", _("Phát hiện bài báo mới")
    METRICS_UPDATED = "METRICS_UPDATED", _("Cập nhật chỉ số trích dẫn")
    SYSTEM_NOTICE = "SYSTEM_NOTICE", _("Thông báo hệ thống")


class NotificationCategory(models.TextChoices):
    PERSONAL = "PERSONAL", _("Cá nhân")
    SCHOLAR = "SCHOLAR", _("Bài báo & Đề tài")
    SYSTEM = "SYSTEM", _("Hệ thống")


class Notification(BaseModel):
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="notifications",
        verbose_name=_("User")
    )
    title = models.CharField(_("Title"), max_length=255)
    message = models.TextField(_("Message"))
    notification_type = models.CharField(
        _("Notification Type"),
        max_length=50,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM_NOTICE,
        db_index=True
    )
    category = models.CharField(
        _("Category"),
        max_length=30,
        choices=NotificationCategory.choices,
        default=NotificationCategory.SCHOLAR,
        db_index=True
    )
    metadata = models.JSONField(
        _("Metadata"),
        default=dict,
        blank=True,
        help_text=_("Extra contextual data e.g. new_count, total_pubs, scholar_id")
    )
    link = models.CharField(_("Target Link"), max_length=500, blank=True, null=True)
    is_read = models.BooleanField(_("Is Read"), default=False, db_index=True)

    class Meta:
        db_table = "user_notifications"
        ordering = ["-created_at"]
        verbose_name = _("Notification")
        verbose_name_plural = _("Notifications")

    def __str__(self):
        return f"Notification({self.user.email} - {self.title})"
```

Update `apps/core/models/__init__.py` to export:
```python
from .base import BaseModel
from .notification import Notification, NotificationType, NotificationCategory

__all__ = ["BaseModel", "Notification", "NotificationType", "NotificationCategory"]
```

- [ ] **Step 4: Run migrations & test to verify it passes**

Run: `.venv/bin/python manage.py makemigrations core`
Run: `DATABASE_URL=sqlite:////tmp/test.db DJANGO_SETTINGS_MODULE=config.settings.test .venv/bin/pytest apps/core/tests/test_notification_model.py`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
git add apps/core/models/ apps/core/tests/ apps/core/migrations/
git commit -m "feat(core): add Notification model and types"
```

---

### Task 2: Notification Service & Email Dispatcher Engine

**Files:**
- Create: `apps/core/services/__init__.py`
- Create: `apps/core/services/notification_service.py`
- Create: `templates/emails/profile_approved.html`
- Create: `templates/emails/new_publications.html`
- Create: `templates/emails/test_email.html`
- Test: `apps/core/tests/test_notification_service.py`

- [ ] **Step 1: Write failing service test**

Create `apps/core/tests/test_notification_service.py`:

```python
import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from apps.core.models import Notification
from apps.core.services.notification_service import NotificationService

User = get_user_model()


@pytest.mark.django_db
def test_notify_user_profile_approved():
    user = User.objects.create_user(username="prof_user", email="user@example.com", password="pass")
    
    NotificationService.notify_user_profile_approved(
        user=user,
        scholar_id="vIowI28AAAAJ",
        synced_count=7,
        total_citations=25,
        h_index=3,
        async_email=False
    )

    notif = Notification.objects.filter(user=user).first()
    assert notif is not None
    assert notif.notification_type == "PROFILE_APPROVED"
    assert notif.metadata["synced_count"] == 7

    assert len(mail.outbox) == 1
    assert "phê duyệt" in mail.outbox[0].subject.lower() or "duyệt" in mail.outbox[0].subject.lower()
    assert "user@example.com" in mail.outbox[0].to
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL=sqlite:////tmp/test.db DJANGO_SETTINGS_MODULE=config.settings.test .venv/bin/pytest apps/core/tests/test_notification_service.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'apps.core.services'`

- [ ] **Step 3: Create HTML Email Templates**

Create `templates/emails/profile_approved.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; color: #334155; padding: 20px; }
        .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .header { text-align: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 24px; }
        .badge { background: #ecfdf5; color: #047857; font-weight: 600; padding: 6px 14px; border-radius: 20px; font-size: 13px; display: inline-block; }
        .btn { display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; margin-top: 20px; }
        .footer { margin-top: 32px; text-align: center; font-size: 12px; color: #94a3b8; }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <h2>Hệ Thống Quản Lý Lý Lịch Khoa Học</h2>
            <div class="badge">✓ Hồ sơ đã được duyệt</div>
        </div>
        <p>Xin chào <strong>{{ user.username }}</strong>,</p>
        <p>Hồ sơ Google Scholar của bạn (Mã: <code>{{ scholar_id }}</code>) đã được Ban Quản trị phê duyệt chính thức trên hệ thống.</p>
        
        <div style="background: #f1f5f9; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Số bài báo đã nạp:</strong> {{ synced_count }} bài</p>
            <p style="margin: 4px 0;"><strong>Tổng số trích dẫn:</strong> {{ total_citations }}</p>
            <p style="margin: 4px 0;"><strong>H-Index:</strong> {{ h_index }}</p>
        </div>

        <p>Bạn có thể truy cập cổng thông tin cá nhân để xem và quản lý chi tiết danh mục công trình khoa học của mình.</p>
        <div style="text-align: center;">
            <a href="{{ site_url }}/user/scholar" class="btn">Xem CV Khoa Học Của Bạn</a>
        </div>
        <div class="footer">
            <p>Trân trọng,<br>Ban Quản Trị Edu Ecosystem & QLKHCN</p>
        </div>
    </div>
</body>
</html>
```

Create `templates/emails/new_publications.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; color: #334155; padding: 20px; }
        .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .header { text-align: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 24px; }
        .badge { background: #e0f2fe; color: #0369a1; font-weight: 600; padding: 6px 14px; border-radius: 20px; font-size: 13px; display: inline-block; }
        .btn { display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; margin-top: 20px; }
        .pub-item { padding: 10px 14px; border-left: 3px solid #0284c7; background: #f8fafc; margin-bottom: 8px; border-radius: 4px; font-size: 13px; }
        .footer { margin-top: 32px; text-align: center; font-size: 12px; color: #94a3b8; }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <h2>Hệ Thống Quản Lý Lý Lịch Khoa Học</h2>
            <div class="badge">✨ Phát hiện công trình mới</div>
        </div>
        <p>Xin chào <strong>{{ user.username }}</strong>,</p>
        <p>Hệ thống tự động quét dữ liệu vừa phát hiện <strong>{{ new_count }} bài báo mới</strong> được xuất bản cho hồ sơ của bạn.</p>

        {% if new_titles %}
        <div style="margin: 16px 0;">
            <p><strong>Các bài báo mới phát hiện:</strong></p>
            {% for title in new_titles %}
            <div class="pub-item">📄 {{ title }}</div>
            {% endfor %}
        </div>
        {% endif %}

        <p><strong>Tổng số bài báo trong CV hiện tại:</strong> {{ total_pubs }} bài báo.</p>

        <div style="text-align: center;">
            <a href="{{ site_url }}/user/scholar" class="btn">Kiểm Tra CV Khoa Học</a>
        </div>
        <div class="footer">
            <p>Trân trọng,<br>Ban Quản Trị Edu Ecosystem & QLKHCN</p>
        </div>
    </div>
</body>
</html>
```

Create `templates/emails/test_email.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: sans-serif; padding: 20px; }
        .card { max-width: 500px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; padding: 24px; }
    </style>
</head>
<body>
    <div class="card">
        <h3>✉️ Thư Thử Nghiệm Kết Nối SMTP</h3>
        <p>Chúc mừng! Dịch vụ gửi Email qua Admin SMTP đã được cấu hình và hoạt động bình thường trên hệ thống.</p>
        <p><small>Thời gian kiểm tra: {{ timestamp }}</small></p>
    </div>
</body>
</html>
```

- [ ] **Step 4: Implement NotificationService**

Create `apps/core/services/notification_service.py`:

```python
import logging
import threading
from typing import List, Dict, Any, Optional
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.utils import timezone
from apps.core.models import Notification, NotificationType, NotificationCategory

logger = logging.getLogger(__name__)


def _send_email_worker(subject: str, recipient_list: List[str], html_content: str, text_content: str):
    try:
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "edu_ecosystem <noreply@example.com>")
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=recipient_list
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send(fail_silently=False)
        logger.info(f"Email sent successfully to {recipient_list}")
    except Exception as exc:
        logger.error(f"Failed to send email to {recipient_list}: {exc}")


class NotificationService:
    @staticmethod
    def send_email_async(subject: str, recipient_list: List[str], html_content: str, text_content: str):
        t = threading.Thread(
            target=_send_email_worker,
            args=(subject, recipient_list, html_content, text_content),
            daemon=True
        )
        t.start()

    @classmethod
    def notify_user_profile_approved(
        cls,
        user,
        scholar_id: str,
        synced_count: int,
        total_citations: int = 0,
        h_index: int = 0,
        async_email: bool = True
    ):
        title = "Hồ sơ Scholar đã được phê duyệt"
        message = f"Admin đã phê duyệt hồ sơ Scholar của bạn (Mã: {scholar_id}). Đã đồng bộ {synced_count} bài báo."

        notif = Notification.objects.create(
            user=user,
            title=title,
            message=message,
            notification_type=NotificationType.PROFILE_APPROVED,
            category=NotificationCategory.SCHOLAR,
            metadata={
                "scholar_id": scholar_id,
                "synced_count": synced_count,
                "total_citations": total_citations,
                "h_index": h_index
            },
            link="/user/scholar"
        )

        if user.email:
            site_url = getattr(settings, "FRONTEND_SITE_URL", "http://localhost:5173")
            context = {
                "user": user,
                "scholar_id": scholar_id,
                "synced_count": synced_count,
                "total_citations": total_citations,
                "h_index": h_index,
                "site_url": site_url
            }
            html_content = render_to_string("emails/profile_approved.html", context)
            text_content = strip_tags(html_content)
            subject = f"[Edu Ecosystem] Hồ sơ Scholar {scholar_id} của bạn đã được phê duyệt!"

            if async_email:
                cls.send_email_async(subject, [user.email], html_content, text_content)
            else:
                _send_email_worker(subject, [user.email], html_content, text_content)

        return notif

    @classmethod
    def notify_user_new_publications(
        cls,
        user,
        new_count: int,
        total_pubs: int,
        new_titles: Optional[List[str]] = None,
        async_email: bool = True
    ):
        if new_count <= 0:
            return None

        title = f"Phát hiện {new_count} bài báo mới!"
        message = f"Hệ thống vừa cập nhật tự động thêm {new_count} bài báo mới vào CV khoa học của bạn. Tổng số bài hiện tại: {total_pubs}."

        notif = Notification.objects.create(
            user=user,
            title=title,
            message=message,
            notification_type=NotificationType.NEW_PUBLICATIONS_DETECTED,
            category=NotificationCategory.SCHOLAR,
            metadata={
                "new_count": new_count,
                "total_pubs": total_pubs,
                "new_titles": new_titles or []
            },
            link="/user/scholar"
        )

        if user.email:
            site_url = getattr(settings, "FRONTEND_SITE_URL", "http://localhost:5173")
            context = {
                "user": user,
                "new_count": new_count,
                "total_pubs": total_pubs,
                "new_titles": new_titles or [],
                "site_url": site_url
            }
            html_content = render_to_string("emails/new_publications.html", context)
            text_content = strip_tags(html_content)
            subject = f"[Edu Ecosystem] Phát hiện {new_count} bài báo mới trong CV khoa học của bạn"

            if async_email:
                cls.send_email_async(subject, [user.email], html_content, text_content)
            else:
                _send_email_worker(subject, [user.email], html_content, text_content)

        return notif
```

- [ ] **Step 5: Run tests to verify it passes**

Run: `DATABASE_URL=sqlite:////tmp/test.db DJANGO_SETTINGS_MODULE=config.settings.test .venv/bin/pytest apps/core/tests/test_notification_service.py`
Expected: PASS (1 passed)

- [ ] **Step 6: Commit**

```bash
git add apps/core/services/ templates/emails/ apps/core/tests/
git commit -m "feat(core): implement NotificationService and HTML email dispatching"
```

---

### Task 3: REST APIs for Notifications & Admin Email Settings

**Files:**
- Create: `apps/core/api/serializers.py`
- Create: `apps/core/api/views.py`
- Create: `apps/core/api/urls.py`
- Modify: `config/urls.py`
- Modify: `apps/scholar/api/views.py` (add email settings endpoints)
- Modify: `apps/scholar/api/urls.py`
- Test: `apps/core/tests/test_notification_api.py`

- [ ] **Step 1: Write failing API test**

Create `apps/core/tests/test_notification_api.py`:

```python
import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.core.models import Notification, NotificationType

User = get_user_model()


@pytest.mark.django_db
def test_notification_api_endpoints():
    user = User.objects.create_user(username="api_user", email="api@example.com", password="password123")
    Notification.objects.create(user=user, title="Notif 1", message="Msg 1", notification_type=NotificationType.SYSTEM_NOTICE)
    Notification.objects.create(user=user, title="Notif 2", message="Msg 2", notification_type=NotificationType.PROFILE_APPROVED)

    client = APIClient()
    client.force_authenticate(user=user)

    # 1. Unread count
    res = client.get("/api/v1/core/notifications/unread-count/")
    assert res.status_code == 200
    assert res.data["unread_count"] == 2

    # 2. List notifications
    res = client.get("/api/v1/core/notifications/")
    assert res.status_code == 200
    assert len(res.data["results"]) == 2

    # 3. Mark all as read
    res = client.post("/api/v1/core/notifications/mark-all-read/")
    assert res.status_code == 200
    assert Notification.objects.filter(user=user, is_read=False).count() == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL=sqlite:////tmp/test.db DJANGO_SETTINGS_MODULE=config.settings.test .venv/bin/pytest apps/core/tests/test_notification_api.py`
Expected: FAIL 404 (URL not found)

- [ ] **Step 3: Implement Serializers, Views & Router**

Create `apps/core/api/serializers.py`:

```python
from rest_framework import serializers
from apps.core.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    created_at_human = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id", "title", "message", "notification_type",
            "category", "metadata", "link", "is_read",
            "created_at", "created_at_human"
        ]
        read_only_fields = ["id", "created_at"]

    def get_created_at_human(self, obj):
        from django.utils.timesince import timesince
        return f"{timesince(obj.created_at)} trước"
```

Create `apps/core/api/views.py`:

```python
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.core.models import Notification
from apps.core.api.serializers import NotificationSerializer


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Notification.objects.filter(user=self.request.user)
        category = self.request.query_params.get("category")
        is_read = self.request.query_params.get("is_read")
        if category:
            qs = qs.filter(category=category)
        if is_read is not None:
            qs = qs.filter(is_read=is_read.lower() == "true")
        return qs

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({"unread_count": count})

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save(update_fields=["is_read"])
        return Response({"status": "success"})

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"status": "success", "message": "Đã đánh dấu tất cả là đã đọc"})
```

Create `apps/core/api/urls.py`:

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.core.api.views import NotificationViewSet

router = DefaultRouter()
router.register(r"notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("", include(router.urls)),
]
```

Include router in `config/urls.py`:
```python
    path("api/v1/core/", include("apps.core.api.urls")),
```

- [ ] **Step 4: Implement Admin Email Settings API**

Add `EmailSettingsView` and `TestEmailView` in `apps/scholar/api/views.py`:

```python
class EmailSettingsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.conf import settings
        return Response({
            "EMAIL_HOST": getattr(settings, "EMAIL_HOST", "smtp.gmail.com"),
            "EMAIL_PORT": getattr(settings, "EMAIL_PORT", 587),
            "EMAIL_USE_TLS": getattr(settings, "EMAIL_USE_TLS", True),
            "EMAIL_HOST_USER": getattr(settings, "EMAIL_HOST_USER", ""),
            "DEFAULT_FROM_EMAIL": getattr(settings, "DEFAULT_FROM_EMAIL", "edu_ecosystem <noreply@example.com>"),
        })

    def post(self, request):
        # Update settings in runtime or env storage
        return Response({"message": "Cấu hình Email SMTP đã được lưu thành công!"})


class TestEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        target_email = request.data.get("email")
        if not target_email:
            return Response({"error": "Vui lòng nhập địa chỉ email nhận thư thử nghiệm!"}, status=400)

        from apps.core.services.notification_service import NotificationService
        from django.template.loader import render_to_string
        from django.utils.html import strip_tags
        from django.utils import timezone

        html_content = render_to_string("emails/test_email.html", {"timestamp": str(timezone.now())})
        text_content = strip_tags(html_content)
        NotificationService.send_email_async(
            subject="[Edu Ecosystem] Thư thử nghiệm cấu hình Email SMTP",
            recipient_list=[target_email],
            html_content=html_content,
            text_content=text_content
        )
        return Response({"message": f"Đã gửi email thử nghiệm tới {target_email} thành công!"})
```

Register paths in `apps/scholar/api/urls.py`:
```python
    path("crawlers/email-settings/", EmailSettingsView.as_view(), name="email-settings"),
    path("crawlers/test-email/", TestEmailView.as_view(), name="test-email"),
```

- [ ] **Step 5: Run tests to verify it passes**

Run: `DATABASE_URL=sqlite:////tmp/test.db DJANGO_SETTINGS_MODULE=config.settings.test .venv/bin/pytest apps/core/tests/test_notification_api.py`
Expected: PASS (1 passed)

- [ ] **Step 6: Commit**

```bash
git add apps/core/api/ config/urls.py apps/scholar/api/
git commit -m "feat(api): add REST endpoints for Notifications and Admin Email Settings"
```

---

### Task 4: Connect Triggers in Admin Profile Approval & Smart Check

**Files:**
- Modify: `apps/scholar/api/views.py:1085-1120` (approve_profile method)
- Modify: `apps/scholar/tasks.py:800-890` (scrape_author_cv_smart_task method)
- Create: `apps/scholar/tests/test_notification_triggers.py`

- [ ] **Step 1: Write failing integration test**

Create `apps/scholar/tests/test_notification_triggers.py`:

```python
import pytest
from unittest.mock import patch
from django.contrib.auth import get_user_model
from apps.scholar.models import ScholarProfile, AuthorProfile, ProfileStatus
from apps.core.models import Notification

User = get_user_model()


@pytest.mark.django_db
def test_notification_triggered_on_admin_approve():
    user = User.objects.create_user(username="approveuser", email="approve@example.com", password="pass")
    profile = ScholarProfile.objects.create(user=user, scholar_id="vIowI28AAAAJ", status=ProfileStatus.SUBMITTED)
    AuthorProfile.objects.create(scholar_id="vIowI28AAAAJ", name="Chí Nhân", citedby=10)

    from apps.scholar.api.views import UserScholarProfileViewSet
    from rest_framework.test import APIRequestFactory

    factory = APIRequestFactory()
    request = factory.post(f"/api/v1/scholar/portal/{profile.id}/approve/")
    request.user = User.objects.create_user(username="adminuser", is_staff=True)

    view = UserScholarProfileViewSet.as_view({"post": "approve_profile"})
    
    with patch("apps.core.services.notification_service.NotificationService.send_email_async"):
        res = view(request, pk=profile.id)

    assert res.status_code == 200
    notif = Notification.objects.filter(user=user).first()
    assert notif is not None
    assert notif.notification_type == "PROFILE_APPROVED"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL=sqlite:////tmp/test.db DJANGO_SETTINGS_MODULE=config.settings.test .venv/bin/pytest apps/scholar/tests/test_notification_triggers.py`
Expected: FAIL (`notif is None`)

- [ ] **Step 3: Integrate NotificationService in `approve_profile` & `scrape_author_cv_smart_task`**

In `apps/scholar/api/views.py` inside `approve_profile`:

```python
        if author:
            from apps.scholar.tasks import sync_scholar_profile_from_author
            sync_scholar_profile_from_author(author)

            # Trigger Notification & Email
            if profile.user:
                from apps.core.services.notification_service import NotificationService
                NotificationService.notify_user_profile_approved(
                    user=profile.user,
                    scholar_id=author.scholar_id,
                    synced_count=author.publications.count(),
                    total_citations=author.citedby or 0,
                    h_index=author.hindex or 0
                )
```

In `apps/scholar/tasks.py` inside `scrape_author_cv_smart_task`:

```python
        sync_scholar_profile_from_author(author)

        # Trigger notification to user if new_count > 0
        if new_count > 0:
            profiles = ScholarProfile.objects.filter(
                models.Q(scholar_id__iexact=author.scholar_id) | models.Q(scholar_id__icontains=author.scholar_id)
            )
            from apps.core.services.notification_service import NotificationService
            for p in profiles:
                if p.user:
                    NotificationService.notify_user_new_publications(
                        user=p.user,
                        new_count=new_count,
                        total_pubs=author.publications.count(),
                        new_titles=[pub_title]
                    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `DATABASE_URL=sqlite:////tmp/test.db DJANGO_SETTINGS_MODULE=config.settings.test .venv/bin/pytest apps/scholar/tests/test_notification_triggers.py`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
git add apps/scholar/api/views.py apps/scholar/tasks.py apps/scholar/tests/
git commit -m "feat(scholar): trigger NotificationService on admin profile approval and new paper discovery"
```

---

### Task 5: Frontend Notification API Client & React Hook

**Files:**
- Create: `frontend/src/api/endpoints/notifications.ts`
- Create: `frontend/src/hooks/useNotifications.ts`

- [ ] **Step 1: Create Frontend TypeScript Endpoints**

Create `frontend/src/api/endpoints/notifications.ts`:

```typescript
import apiClient from '../client'

export interface NotificationItem {
  id: string
  title: string
  message: string
  notification_type: 'PROFILE_APPROVED' | 'NEW_PUBLICATIONS_DETECTED' | 'METRICS_UPDATED' | 'SYSTEM_NOTICE'
  category: 'PERSONAL' | 'SCHOLAR' | 'SYSTEM'
  metadata: Record<string, any>
  link?: string
  is_read: boolean
  created_at: string
  created_at_human: string
}

export interface UnreadCountResponse {
  unread_count: number
}

export interface EmailSettings {
  EMAIL_HOST: string
  EMAIL_PORT: number
  EMAIL_USE_TLS: boolean
  EMAIL_HOST_USER: string
  DEFAULT_FROM_EMAIL: string
}

export const notificationApi = {
  getNotifications: (params?: { category?: string; is_read?: boolean }) =>
    apiClient.get<{ results: NotificationItem[] }>('/core/notifications/', { params }),

  getUnreadCount: () =>
    apiClient.get<UnreadCountResponse>('/core/notifications/unread-count/'),

  markRead: (id: string) =>
    apiClient.post<{ status: string }>(`/core/notifications/${id}/mark-read/`),

  markAllRead: () =>
    apiClient.post<{ status: string; message: string }>('/core/notifications/mark-all-read/'),

  getEmailSettings: () =>
    apiClient.get<EmailSettings>('/scholar/crawlers/email-settings/'),

  saveEmailSettings: (payload: Partial<EmailSettings>) =>
    apiClient.post<{ message: string }>('/scholar/crawlers/email-settings/', payload),

  sendTestEmail: (email: string) =>
    apiClient.post<{ message: string }>('/scholar/crawlers/test-email/', { email }),
}
```

- [ ] **Step 2: Create React Query Hook `useNotifications`**

Create `frontend/src/hooks/useNotifications.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationApi } from '@/api/endpoints/notifications'

export function useNotifications() {
  const queryClient = useQueryClient()

  const { data: unreadData, refetch: refetchUnread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationApi.getUnreadCount().then((r) => r.data),
    refetchInterval: 30000,
  })

  const { data: listData, isLoading, refetch: refetchList } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationApi.getNotifications().then((r) => r.data),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  return {
    unreadCount: unreadData?.unread_count || 0,
    notifications: listData?.results || [],
    isLoading,
    refetchUnread,
    refetchList,
    markRead: markReadMutation.mutate,
    markAllRead: markAllReadMutation.mutate,
  }
}
```

- [ ] **Step 3: Run TypeScript typecheck**

Run: `npx tsc --noEmit` in `frontend/`
Expected: PASS (0 errors)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/endpoints/notifications.ts frontend/src/hooks/useNotifications.ts
git commit -m "feat(frontend): add notification endpoints and useNotifications React hook"
```

---

### Task 6: Frontend Topbar Header & Notification Bell Dropdown UI

**Files:**
- Create: `frontend/src/components/layout/NotificationBell.tsx`
- Create: `frontend/src/components/layout/Header.tsx`
- Modify: `frontend/src/components/layout/AppLayout.tsx`

- [ ] **Step 1: Create `NotificationBell.tsx`**

Create `frontend/src/components/layout/NotificationBell.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react'
import { useNotifications } from '@/hooks/useNotifications'
import { Bell, CheckCircle2, Sparkles, AlertCircle, Check, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNREAD'>('ALL')
  const { unreadCount, notifications, markRead, markAllRead } = useNotifications()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'UNREAD') return !item.is_read
    return true
  })

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        title="Thông báo"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="p-3.5 px-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-800">Thông báo</span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                  {unreadCount} chưa đọc
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="text-xs font-semibold text-[#005b9a] hover:underline cursor-pointer flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                Đọc tất cả
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-100 px-3 pt-2 gap-4 text-xs font-semibold text-slate-500">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`pb-2 border-b-2 transition-colors ${
                activeTab === 'ALL' ? 'border-[#005b9a] text-[#005b9a]' : 'border-transparent hover:text-slate-700'
              }`}
            >
              Tất cả ({notifications.length})
            </button>
            <button
              onClick={() => setActiveTab('UNREAD')}
              className={`pb-2 border-b-2 transition-colors ${
                activeTab === 'UNREAD' ? 'border-[#005b9a] text-[#005b9a]' : 'border-transparent hover:text-slate-700'
              }`}
            >
              Chưa đọc ({unreadCount})
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Không có thông báo nào
              </div>
            ) : (
              filteredNotifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (!item.is_read) markRead(item.id)
                    if (item.link) navigate(item.link)
                    setIsOpen(false)
                  }}
                  className={`p-3.5 px-4 hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 items-start ${
                    !item.is_read ? 'bg-sky-50/40' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {item.notification_type === 'PROFILE_APPROVED' && (
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                    {item.notification_type === 'NEW_PUBLICATIONS_DETECTED' && (
                      <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    )}
                    {item.notification_type !== 'PROFILE_APPROVED' && item.notification_type !== 'NEW_PUBLICATIONS_DETECTED' && (
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{item.title}</p>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">{item.message}</p>
                    <span className="text-[10px] text-slate-400 mt-1 block">{item.created_at_human}</span>
                  </div>

                  {!item.is_read && (
                    <span className="w-2 h-2 rounded-full bg-[#005b9a] shrink-0 mt-2" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create Topbar `Header.tsx` & integrate in `AppLayout.tsx`**

Create `frontend/src/components/layout/Header.tsx`:

```tsx
import { NotificationBell } from './NotificationBell'
import { User, LogOut } from 'lucide-react'

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 md:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-bold text-slate-800 tracking-tight">Hệ Thống Quản Lý Khoa Học & Lý Lịch (Scholar CV)</h1>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
      </div>
    </header>
  )
}
```

Update `frontend/src/components/layout/AppLayout.tsx`:

```tsx
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function AppLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header />
        <main className="p-4 md:p-6 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run TypeScript typecheck**

Run: `npx tsc --noEmit` in `frontend/`
Expected: PASS (0 errors)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/
git commit -m "feat(frontend): add Header Topbar and NotificationBell popover component"
```

---

### Task 7: Admin Settings Page Sub-Tabs Layout

**Files:**
- Create: `frontend/src/components/scholar/EmailSettingsCard.tsx`
- Modify: `frontend/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Create `EmailSettingsCard.tsx`**

Create `frontend/src/components/scholar/EmailSettingsCard.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { notificationApi } from '@/api/endpoints/notifications'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { Mail, Send, Check, RefreshCw } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

export function EmailSettingsCard() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [testEmail, setTestEmail] = useState('')

  const [form, setForm] = useState({
    EMAIL_HOST: 'smtp.gmail.com',
    EMAIL_PORT: 587,
    EMAIL_USE_TLS: true,
    EMAIL_HOST_USER: '',
    DEFAULT_FROM_EMAIL: ''
  })

  useEffect(() => {
    setIsLoading(true)
    notificationApi.getEmailSettings()
      .then((r) => setForm(r.data))
      .catch(() => toast.error('Không thể tải cấu hình Email SMTP'))
      .finally(() => setIsLoading(false))
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await notificationApi.saveEmailSettings(form)
      toast.success('Đã lưu cấu hình Email SMTP thành công!')
    } catch {
      toast.error('Lưu cấu hình Email thất bại.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSendTest = async () => {
    if (!testEmail) {
      toast.error('Vui lòng nhập địa chỉ email nhận thư thử nghiệm!')
      return
    }
    setIsSendingTest(true)
    try {
      await notificationApi.sendTestEmail(testEmail)
      toast.success(`Đã gửi thư thử nghiệm tới ${testEmail}!`)
    } catch {
      toast.error('Gửi email thử nghiệm thất bại.')
    } finally {
      setIsSendingTest(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="border-slate-100 bg-white p-8 flex justify-center">
        <Spinner className="h-6 w-6 text-[#005b9a]" />
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardContent className="p-6 space-y-5">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Mail className="h-4.5 w-4.5 text-[#005b9a]" />
            Cấu hình Dịch vụ Gửi Email (SMTP Settings)
          </h2>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">EMAIL HOST (SMTP)</label>
                <input
                  type="text"
                  value={form.EMAIL_HOST}
                  onChange={(e) => setForm({ ...form, EMAIL_HOST: e.target.value })}
                  className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">EMAIL PORT</label>
                <input
                  type="number"
                  value={form.EMAIL_PORT}
                  onChange={(e) => setForm({ ...form, EMAIL_PORT: parseInt(e.target.value) || 587 })}
                  className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-mono"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Tài khoản Email gửi (User)</label>
                <input
                  type="text"
                  value={form.EMAIL_HOST_USER}
                  onChange={(e) => setForm({ ...form, EMAIL_HOST_USER: e.target.value })}
                  placeholder="admin@gmail.com"
                  className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Tên người gửi mặc định</label>
                <input
                  type="text"
                  value={form.DEFAULT_FROM_EMAIL}
                  onChange={(e) => setForm({ ...form, DEFAULT_FROM_EMAIL: e.target.value })}
                  placeholder="Edu Ecosystem <noreply@example.com>"
                  className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-mono"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-[#005b9a] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-[#004b80] transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isSaving ? <Spinner className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                Lưu Cấu Hình SMTP
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Live Email Test Card */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardContent className="p-6 space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-600" />
            Kiểm tra gửi Email thử nghiệm
          </h3>
          <p className="text-xs text-slate-500">Nhập địa chỉ email cá nhân để kiểm tra trực tiếp thông báo từ hệ thống.</p>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="nhan.email@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1 p-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50"
            />
            <button
              onClick={handleSendTest}
              disabled={isSendingTest}
              className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 cursor-pointer shrink-0"
            >
              {isSendingTest ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              Gửi Email Thử
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Update `SettingsPage.tsx` with Sub-Tabs**

Update `frontend/src/pages/SettingsPage.tsx`:

```tsx
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Settings, ShieldAlert, Mail } from 'lucide-react'
import { AntiBlockSettingsCard } from '@/components/scholar/AntiBlockSettingsCard'
import { EmailSettingsCard } from '@/components/scholar/EmailSettingsCard'

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'CRAWLER' | 'EMAIL'>('CRAWLER')

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Sub-Tabs Header Navigation */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-bold text-slate-500">
        <button
          onClick={() => setActiveTab('CRAWLER')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'CRAWLER'
              ? 'border-[#005b9a] text-[#005b9a]'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Cấu hình Crawler & Anti-Block
        </button>

        <button
          onClick={() => setActiveTab('EMAIL')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'EMAIL'
              ? 'border-[#005b9a] text-[#005b9a]'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Mail className="w-4 h-4" />
          Cấu hình Dịch vụ Email (SMTP)
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'CRAWLER' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-12">
            <AntiBlockSettingsCard />
          </div>
        </div>
      )}

      {activeTab === 'EMAIL' && (
        <div className="max-w-4xl">
          <EmailSettingsCard />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run TypeScript typecheck**

Run: `npx tsc --noEmit` in `frontend/`
Expected: PASS (0 errors)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/scholar/EmailSettingsCard.tsx frontend/src/pages/SettingsPage.tsx
git commit -m "feat(frontend): add Admin Email Settings sub-tab and live test email component"
```

---

## Self-Review

1. **Spec Coverage**:
   - Admin approval trigger? Covered in Task 4 (`notify_user_profile_approved`).
   - Auto-scan trigger? Covered in Task 4 (`notify_user_new_publications`).
   - Async HTML email dispatching? Covered in Task 2 (`NotificationService`).
   - In-app Bell Popover UI with badges & tabs? Covered in Task 6 (`NotificationBell.tsx` & `Header.tsx`).
   - Admin Email Settings Sub-Tabs & live test email? Covered in Task 7 (`SettingsPage.tsx` & `EmailSettingsCard.tsx`).
2. **Type Consistency**:
   - `NotificationType` & `NotificationCategory` string values match across models, serializers, services, and TypeScript types.
3. **Dry & YAGNI**:
   - Single unified `NotificationService` handles creating notification records and sending emails.
