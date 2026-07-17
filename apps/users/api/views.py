from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.mixins import ListModelMixin
from rest_framework.mixins import RetrieveModelMixin
from rest_framework.mixins import UpdateModelMixin
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.core.permissions import FullDjangoModelPermissions

from .serializers import ChangePasswordSerializer
from .serializers import UserListSerializer
from .serializers import UserSerializer

User = get_user_model()


class UserViewSet(RetrieveModelMixin, UpdateModelMixin, ListModelMixin, GenericViewSet):
    """User API viewset."""

    queryset = User.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated, FullDjangoModelPermissions]

    def get_serializer_class(self):
        if self.action == "list":
            return UserListSerializer
        return UserSerializer


class AuthViewSet(GenericViewSet):
    """Auth-related endpoints beyond JWT token obtain/refresh."""

    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    @action(detail=False, methods=["get"])
    def me(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="change-password")
    def change_password(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"detail": "Password updated successfully."}, status=status.HTTP_200_OK)
