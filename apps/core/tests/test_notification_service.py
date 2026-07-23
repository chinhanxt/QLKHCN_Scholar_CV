import time
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
        async_email=False,
    )

    notif = Notification.objects.filter(user=user).first()
    assert notif is not None
    assert notif.notification_type == "PROFILE_APPROVED"
    assert notif.metadata["synced_count"] == 7

    assert len(mail.outbox) == 1
    assert "user@example.com" in mail.outbox[0].to


@pytest.mark.django_db
def test_notify_user_new_publications():
    user = User.objects.create_user(username="pub_user", email="pubuser@example.com", password="pass")

    NotificationService.notify_user_new_publications(
        user=user,
        new_count=2,
        total_pubs=10,
        new_titles=["Paper A", "Paper B"],
        async_email=False,
    )

    notif = Notification.objects.filter(user=user).first()
    assert notif is not None
    assert notif.notification_type == "NEW_PUBLICATIONS_DETECTED"
    assert notif.metadata["new_count"] == 2

    assert len(mail.outbox) == 1
    assert "pubuser@example.com" in mail.outbox[0].to


@pytest.mark.django_db
def test_send_email_async_thread():
    user = User.objects.create_user(username="async_user", email="async@example.com", password="pass")

    NotificationService.send_email_async(
        subject="Test Async Email",
        recipient_list=["async@example.com"],
        template_name="emails/test_email.html",
        context={"user": user, "message": "Test message content"},
        async_email=True,
    )

    # Wait briefly for thread to finish
    time.sleep(0.5)

    assert len(mail.outbox) == 1
    assert "async@example.com" in mail.outbox[0].to
    assert "Test Async Email" in mail.outbox[0].subject
