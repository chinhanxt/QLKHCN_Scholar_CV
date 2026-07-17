from factory import Faker
from factory import LazyAttribute
from factory import Sequence
from factory import post_generation
from factory.django import DjangoModelFactory

from apps.users.models import User


class UserFactory(DjangoModelFactory):
    username = Sequence(lambda n: f"user{n}")
    email = LazyAttribute(lambda o: f"{o.username}@example.com")
    first_name = Faker("first_name")
    last_name = Faker("last_name")
    is_active = True

    @post_generation
    def password(self, create, extracted, **kwargs):
        password = extracted or "testpass123"
        self.set_password(password)
        if create:
            self.save()

    class Meta:
        model = User
        django_get_or_create = ("email",)
        skip_postgeneration_save = True


class AdminFactory(UserFactory):
    is_staff = True
    is_superuser = True
