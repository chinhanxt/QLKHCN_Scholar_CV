import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework.test import APIClient, APIRequestFactory

from apps.core.permissions import IsAdminUser
from apps.core.permissions import IsProfileOwner
from apps.scholar.models import ScholarProfile
from apps.scholar.models import ScholarPublication

User = get_user_model()


class DummyProfile:
    def __init__(self, user):
        self.user = user


@pytest.mark.django_db
def test_is_admin_user_permission():
    factory = APIRequestFactory()
    permission = IsAdminUser()

    anon_user = AnonymousUser()
    normal_user = User.objects.create_user(
        email="user@example.com",
        username="user1",
        password="password123",  # noqa: S106
    )
    staff_user = User.objects.create_user(
        email="staff@example.com",
        username="staff1",
        password="password123",  # noqa: S106
        is_staff=True,
    )
    admin_user = User.objects.create_superuser(
        email="admin@example.com",
        username="admin1",
        password="password123",  # noqa: S106
    )

    # Request by unauthenticated user
    request_anon = factory.get("/")
    request_anon.user = anon_user
    assert permission.has_permission(request_anon, None) is False

    # Request by normal user
    request_user = factory.get("/")
    request_user.user = normal_user
    assert permission.has_permission(request_user, None) is False

    # Request by staff user
    request_staff = factory.get("/")
    request_staff.user = staff_user
    assert permission.has_permission(request_staff, None) is True

    # Request by admin user (superuser)
    request_admin = factory.get("/")
    request_admin.user = admin_user
    assert permission.has_permission(request_admin, None) is True


@pytest.mark.django_db
def test_is_profile_owner_permission():
    factory = APIRequestFactory()
    permission = IsProfileOwner()

    anon_user = AnonymousUser()
    owner_user = User.objects.create_user(
        email="owner@example.com",
        username="owner1",
        password="password123",  # noqa: S106
    )
    other_user = User.objects.create_user(
        email="other@example.com",
        username="other1",
        password="password123",  # noqa: S106
    )
    staff_user = User.objects.create_user(
        email="staff@example.com",
        username="staff1",
        password="password123",  # noqa: S106
        is_staff=True,
    )
    admin_user = User.objects.create_superuser(
        email="admin@example.com",
        username="admin1",
        password="password123",  # noqa: S106
    )

    profile_obj = DummyProfile(user=owner_user)

    # 1. Unauthenticated access (False)
    request_anon = factory.get("/")
    request_anon.user = anon_user
    assert permission.has_permission(request_anon, None) is False
    assert permission.has_object_permission(request_anon, None, profile_obj) is False
    assert permission.has_object_permission(request_anon, None, owner_user) is False

    # 2. Owner access (True) - tests obj.user == request.user AND obj == request.user
    request_owner = factory.get("/")
    request_owner.user = owner_user
    assert permission.has_permission(request_owner, None) is True
    assert permission.has_object_permission(request_owner, None, profile_obj) is True
    assert permission.has_object_permission(request_owner, None, owner_user) is True

    # 3. Non-owner access (False for has_object_permission)
    request_other = factory.get("/")
    request_other.user = other_user
    assert permission.has_permission(request_other, None) is True
    assert permission.has_object_permission(request_other, None, profile_obj) is False
    assert permission.has_object_permission(request_other, None, owner_user) is False

    # 4. Admin access (True)
    request_staff = factory.get("/")
    request_staff.user = staff_user
    assert permission.has_permission(request_staff, None) is True
    assert permission.has_object_permission(request_staff, None, profile_obj) is True
    assert permission.has_object_permission(request_staff, None, owner_user) is True

    request_admin = factory.get("/")
    request_admin.user = admin_user
    assert permission.has_permission(request_admin, None) is True
    assert permission.has_object_permission(request_admin, None, profile_obj) is True
    assert permission.has_object_permission(request_admin, None, owner_user) is True


@pytest.mark.django_db
def test_scholar_profile_and_publication_creation():
    user = User.objects.create_user(
        email="scholar_user@example.com",
        username="scholar1",
        password="password123",  # noqa: S106
    )
    profile = ScholarProfile.objects.create(
        user=user,
        scholar_url=("https://scholar.google.com/citations?user=AHHDABDaaaaJ"),
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


@pytest.mark.django_db
def test_user_portal_profile_submission_and_get():
    user = User.objects.create_user(email="portal_user@example.com", username="puser1", password="password123")  # noqa: S106
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

