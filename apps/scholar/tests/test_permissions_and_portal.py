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
