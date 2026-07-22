import pytest

from apps.users.models import User

from .factories import UserFactory


@pytest.mark.django_db
class TestUserModel:
    def test_create_user(self):
        user = UserFactory()
        assert user.pk is not None
        assert user.is_active is True
        assert user.is_staff is False

    def test_email_is_unique(self):
        UserFactory(email="test@example.com")
        with pytest.raises(Exception):  # noqa: B017
            User.objects.create(email="test@example.com", username="other")

    def test_str_returns_email(self):
        user = UserFactory(email="hello@test.com")
        assert str(user) == "hello@test.com"

    def test_username_field_is_email(self):
        assert User.USERNAME_FIELD == "email"
