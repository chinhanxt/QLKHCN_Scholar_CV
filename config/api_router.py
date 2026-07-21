from django.urls import include
from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.views import TokenRefreshView

from apps.users.api.views import AuthViewSet
from apps.users.api.views import UserViewSet
from apps.scholar.api.views import AuthorViewSet, CrawlerViewSet

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("scholar/authors", AuthorViewSet, basename="scholar-authors")
router.register("scholar/crawlers", CrawlerViewSet, basename="scholar-crawlers")


auth_urlpatterns = [
    path("login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", AuthViewSet.as_view({"get": "me"}), name="auth_me"),
    path("change-password/", AuthViewSet.as_view({"post": "change_password"}), name="auth_change_password"),
]

app_name = "api"

urlpatterns = [
    path("v1/auth/", include((auth_urlpatterns, "auth"))),
    path("v1/scholar/", include("apps.scholar.api.urls")),
    path("v1/", include(router.urls)),
]

