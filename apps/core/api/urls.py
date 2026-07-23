from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.core.api.views import NotificationViewSet

app_name = "core_api"

router = DefaultRouter()
router.register(r"notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("", include(router.urls)),
]
