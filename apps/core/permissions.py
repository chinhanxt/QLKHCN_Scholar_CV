from typing import Any

from rest_framework.permissions import BasePermission
from rest_framework.permissions import DjangoModelPermissions
from rest_framework.request import Request
from rest_framework.views import APIView


class FullDjangoModelPermissions(DjangoModelPermissions):
    """Extends DjangoModelPermissions to also require view permission."""

    perms_map = {
        "GET": ["%(app_label)s.view_%(model_name)s"],
        "OPTIONS": [],
        "HEAD": [],
        "POST": ["%(app_label)s.add_%(model_name)s"],
        "PUT": ["%(app_label)s.change_%(model_name)s"],
        "PATCH": ["%(app_label)s.change_%(model_name)s"],
        "DELETE": ["%(app_label)s.delete_%(model_name)s"],
    }


class IsAdminUser(BasePermission):
    """Allows access only to admin users (is_staff or is_superuser)."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_staff or request.user.is_superuser),
        )


class IsProfileOwner(BasePermission):
    """Allows access only to the owner of the profile or admin users."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_staff or request.user.is_superuser:
            return True
        return getattr(obj, "user", obj) == request.user

