import pytest
from unittest.mock import patch
from django.contrib.auth import get_user_model
from apps.scholar.models import ScholarProfile, AuthorProfile, ProfileStatus, Publication
from apps.core.models import Notification

User = get_user_model()


@pytest.mark.django_db
def test_notification_triggered_on_admin_approve():
    user = User.objects.create_user(username="approveuser", email="approve@example.com", password="pass")
    profile = ScholarProfile.objects.create(user=user, scholar_id="vIowI28AAAAJ", status=ProfileStatus.PENDING)
    AuthorProfile.objects.create(scholar_id="vIowI28AAAAJ", name="Chí Nhân", citedby=10)

    from apps.scholar.api.views import AdminScholarApprovalViewSet
    from rest_framework.test import APIRequestFactory

    factory = APIRequestFactory()
    request = factory.post(f"/api/v1/scholar/portal/{profile.id}/approve/")
    request.user = User.objects.create_user(username="adminuser", is_staff=True)

    view = AdminScholarApprovalViewSet.as_view({"post": "approve_profile"})
    
    with patch("apps.core.services.notification_service.NotificationService.send_email_async"):
        res = view(request, pk=profile.id)

    assert res.status_code == 200
    notif = Notification.objects.filter(user=user).first()
    assert notif is not None
    assert notif.notification_type == "PROFILE_APPROVED"


@pytest.mark.django_db
def test_notification_triggered_on_smart_check_new_papers():
    user = User.objects.create_user(username="scanuser", email="scanuser@example.com", password="pass")
    profile = ScholarProfile.objects.create(user=user, scholar_id="vIowI28AAAAJ", status=ProfileStatus.APPROVED)
    author = AuthorProfile.objects.create(scholar_id="vIowI28AAAAJ", name="Chí Nhân", citedby=10)
    
    # Existing publication
    Publication.objects.create(author=author, title="Old Paper 1")

    mock_online_author = {
        "scholar_id": "vIowI28AAAAJ",
        "name": "Chí Nhân",
        "citedby": 15,
        "hindex": 2,
        "i10index": 1,
        "publications": [
            {"bib": {"title": "Old Paper 1", "author": "Chí Nhân"}, "num_citations": 5},
            {"bib": {"title": "Brand New Article 2", "author": "Chí Nhân"}, "num_citations": 0}
        ]
    }

    from apps.scholar.tasks import scrape_author_cv_smart_task

    with patch("apps.scholar.scholarly.scholarly.search_author_id", return_value={"scholar_id": "vIowI28AAAAJ"}), \
         patch("apps.scholar.scholarly.scholarly.fill", return_value=mock_online_author), \
         patch("apps.scholar.scholarly.tor_helper.setup_tor_proxy_with_fallback"), \
         patch("apps.core.services.notification_service.NotificationService.send_email_async"), \
         patch("time.sleep"):

        res = scrape_author_cv_smart_task(author.id)

    assert res["status"] == "success"
    assert res["new_publications_added"] == 1
    
    notif = Notification.objects.filter(user=user).first()
    assert notif is not None
    assert notif.notification_type == "NEW_PUBLICATIONS_DETECTED"
    assert notif.metadata["new_count"] == 1
