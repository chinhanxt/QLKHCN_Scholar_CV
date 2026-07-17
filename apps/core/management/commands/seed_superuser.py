from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = "Create an initial superuser. Skips if email already exists."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="Superuser email")
        parser.add_argument("--password", required=True, help="Superuser password")
        parser.add_argument("--username", default="admin", help="Superuser username (default: admin)")

    def handle(self, *args, **options):
        email = options["email"]
        password = options["password"]
        username = options["username"]

        if User.objects.filter(email=email).exists():
            self.stdout.write(self.style.WARNING(f"User with email '{email}' already exists. Skipping."))
            return

        User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
        )
        self.stdout.write(self.style.SUCCESS(f"Superuser '{email}' created successfully."))
