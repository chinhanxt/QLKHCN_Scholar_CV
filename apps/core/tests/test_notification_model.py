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
