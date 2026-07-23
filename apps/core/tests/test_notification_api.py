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


@pytest.mark.django_db
def test_admin_email_settings_and_test_email():
    admin = User.objects.create_user(username="admin_user", email="admin@example.com", password="password123", is_staff=True)
    client = APIClient()
    client.force_authenticate(user=admin)

    res = client.get("/api/v1/scholar/crawlers/email-settings/")
    assert res.status_code == 200
    assert "EMAIL_HOST" in res.data

    res = client.post("/api/v1/scholar/crawlers/test-email/", {"email": "target@example.com"})
    assert res.status_code == 200
    assert "thành công" in res.data["message"].lower()
