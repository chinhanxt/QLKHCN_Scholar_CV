import pytest
from rest_framework.test import APIClient

from .factories import UserFactory


@pytest.mark.django_db
class TestAuthAPI:
    def setup_method(self):
        self.client = APIClient()
        self.user = UserFactory()

    def test_login_success(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.user.email, "password": "testpass123"},
        )
        assert response.status_code == 200
        assert "access" in response.data
        assert "refresh" in response.data

    def test_login_wrong_password(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.user.email, "password": "wrongpass"},
        )
        assert response.status_code == 401

    def test_me_authenticated(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/v1/auth/me/")
        assert response.status_code == 200
        assert response.data["email"] == self.user.email

    def test_me_unauthenticated(self):
        response = self.client.get("/api/v1/auth/me/")
        assert response.status_code == 401

    def test_change_password(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/v1/auth/change-password/",
            {"old_password": "testpass123", "new_password": "newSecurePass123!"},
        )
        assert response.status_code == 200
        self.user.refresh_from_db()
        assert self.user.check_password("newSecurePass123!")

    def test_token_refresh(self):
        login_response = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.user.email, "password": "testpass123"},
        )
        refresh_token = login_response.data["refresh"]
        response = self.client.post(
            "/api/v1/auth/refresh/",
            {"refresh": refresh_token},
        )
        assert response.status_code == 200
        assert "access" in response.data
