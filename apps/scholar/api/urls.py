from django.urls import path
from apps.scholar.api.views import (
    TorStatusView, StartTorServiceView, BulkImportAuthorsView, 
    AutoScanConfigView, TriggerAuthorsScanView,
    AntiBlockConfigView, RotateTorView,
)

app_name = "scholar_auto_scan"

urlpatterns = [
    path('auto-scan/tor-status/', TorStatusView.as_view(), name='tor-status'),
    path('auto-scan/start-tor/', StartTorServiceView.as_view(), name='start-tor'),
    path('auto-scan/bulk-import/', BulkImportAuthorsView.as_view(), name='bulk-import'),
    path('auto-scan/config/', AutoScanConfigView.as_view(), name='auto-scan-config'),
    path('auto-scan/trigger-authors/', TriggerAuthorsScanView.as_view(), name='trigger-authors'),
    path('anti-block/config/', AntiBlockConfigView.as_view(), name='anti-block-config'),
    path('anti-block/rotate-tor/', RotateTorView.as_view(), name='rotate-tor'),
]

