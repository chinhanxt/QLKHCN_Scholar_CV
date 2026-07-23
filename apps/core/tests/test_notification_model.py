import pytest
from django.contrib.auth import get_user_model

from apps.core.models import Notification, NotificationCategory, NotificationType

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
        metadata={"total_pubs": 10},
    )

    assert notification.id is not None
    assert notification.is_read is False
    assert notification.notification_type == "PROFILE_APPROVED"
    assert notification.metadata["total_pubs"] == 10
    assert str(notification) == f"Notification({user.email} - Hồ sơ được duyệt)"


@pytest.mark.django_db
def test_notification_default_values():
    user = User.objects.create_user(username="defaultuser", email="default@example.com", password="pass")
    notification = Notification.objects.create(
        user=user,
        title="Default Title",
        message="Default Message",
    )

    assert notification.notification_type == NotificationType.SYSTEM_NOTICE
    assert notification.category == NotificationCategory.SCHOLAR
    assert notification.metadata == {}
    assert notification.link == ""
    assert notification.is_read is False


@pytest.mark.django_db
def test_notification_composite_index_query():
    user = User.objects.create_user(username="queryuser", email="query@example.com", password="pass")

    n1 = Notification.objects.create(user=user, title="N1", message="M1", is_read=False)
    n2 = Notification.objects.create(user=user, title="N2", message="M2", is_read=True)
    n3 = Notification.objects.create(user=user, title="N3", message="M3", is_read=False)

    unread_notifications = list(
        Notification.objects.filter(user=user, is_read=False).order_by("-created_at")
    )

    assert len(unread_notifications) == 2
    assert unread_notifications[0] == n3
    assert unread_notifications[1] == n1

