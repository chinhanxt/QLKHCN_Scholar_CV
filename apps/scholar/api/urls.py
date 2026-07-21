from django.urls import path
from apps.scholar.api.views import TorStatusView, BulkImportAuthorsView, AutoScanConfigView

app_name = "scholar_auto_scan"

urlpatterns = [
    path('auto-scan/tor-status/', TorStatusView.as_view(), name='tor-status'),
    path('auto-scan/bulk-import/', BulkImportAuthorsView.as_view(), name='bulk-import'),
    path('auto-scan/config/', AutoScanConfigView.as_view(), name='auto-scan-config'),
]
