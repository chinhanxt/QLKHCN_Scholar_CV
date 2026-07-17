from django.contrib.auth.models import Group
from django.contrib.auth.models import Permission
from django.core.management.base import BaseCommand


GROUPS_PERMISSIONS = {
    "admin": {
        "description": "Full system access",
        "permissions": "__all__",
    },
    "manager": {
        "description": "Manage data, no system config",
        "permissions": [
            "users.view_user",
            "users.add_user",
            "users.change_user",
        ],
    },
    "staff": {
        "description": "View and basic edit",
        "permissions": [
            "users.view_user",
        ],
    },
    "viewer": {
        "description": "Read-only access",
        "permissions": [
            "users.view_user",
        ],
    },
}


class Command(BaseCommand):
    help = "Seed RBAC groups and permissions. Idempotent — safe to run multiple times."

    def handle(self, *args, **options):
        all_permissions = Permission.objects.all()

        for group_name, config in GROUPS_PERMISSIONS.items():
            group, created = Group.objects.get_or_create(name=group_name)
            action = "Created" if created else "Updated"

            if config["permissions"] == "__all__":
                group.permissions.set(all_permissions)
                perm_count = all_permissions.count()
            else:
                perms = []
                for perm_codename in config["permissions"]:
                    app_label, codename = perm_codename.split(".")
                    try:
                        perm = Permission.objects.get(
                            content_type__app_label=app_label,
                            codename=codename,
                        )
                        perms.append(perm)
                    except Permission.DoesNotExist:
                        self.stderr.write(
                            self.style.WARNING(f"  Permission not found: {perm_codename}")
                        )
                group.permissions.set(perms)
                perm_count = len(perms)

            self.stdout.write(
                self.style.SUCCESS(f"  {action} group '{group_name}' with {perm_count} permissions")
            )

        self.stdout.write(self.style.SUCCESS("Done seeding groups."))
