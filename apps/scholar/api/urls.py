from django.urls import path
from rest_framework.routers import DefaultRouter
from apps.scholar.api.views import (
    TorStatusView, StartTorServiceView, BulkImportAuthorsView, 
    AutoScanConfigView, TriggerAuthorsScanView,
    AntiBlockConfigView, RotateTorView,
    UserScholarProfileViewSet, AdminScholarApprovalViewSet,
    EmailSettingsView, TestEmailView,
    EmailTemplateListView, EmailTemplateDetailView, EmailTemplateResetView,
    EmailTemplatePreviewView, EmailTemplateSendTestView,
)

app_name = "scholar_auto_scan"

router = DefaultRouter()
router.register(r"me", UserScholarProfileViewSet, basename="user-scholar-me")
router.register(r"admin/profiles", AdminScholarApprovalViewSet, basename="admin-scholar-profiles")

urlpatterns = [
    path('auto-scan/tor-status/', TorStatusView.as_view(), name='tor-status'),
    path('auto-scan/start-tor/', StartTorServiceView.as_view(), name='start-tor'),
    path('auto-scan/bulk-import/', BulkImportAuthorsView.as_view(), name='bulk-import'),
    path('auto-scan/config/', AutoScanConfigView.as_view(), name='auto-scan-config'),
    path('auto-scan/trigger-authors/', TriggerAuthorsScanView.as_view(), name='trigger-authors'),
    path('anti-block/config/', AntiBlockConfigView.as_view(), name='anti-block-config'),
    path('anti-block/rotate-tor/', RotateTorView.as_view(), name='rotate-tor'),
    path('crawlers/email-settings/', EmailSettingsView.as_view(), name='email-settings'),
    path('crawlers/test-email/', TestEmailView.as_view(), name='test-email'),
    path('crawlers/email-templates/', EmailTemplateListView.as_view(), name='email-templates-list'),
    path('crawlers/email-templates/<str:template_key>/', EmailTemplateDetailView.as_view(), name='email-templates-detail'),
    path('crawlers/email-templates/<str:template_key>/reset/', EmailTemplateResetView.as_view(), name='email-templates-reset'),
    path('crawlers/email-templates/<str:template_key>/preview/', EmailTemplatePreviewView.as_view(), name='email-templates-preview'),
    path('crawlers/email-templates/<str:template_key>/send-test/', EmailTemplateSendTestView.as_view(), name='email-templates-send-test'),
] + router.urls


