import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from apps.scholar.models import AuthorProfile
from apps.scholar.api.serializers import (
    AuthorProfileSerializer,
    ScrapeAuthorRequestSerializer,
    AuthorSearchQuerySerializer,
    AuthorCandidateSerializer,
    BioxbioCrawlRequestSerializer,
    ScimagoCrawlRequestSerializer,
    ClarivateCrawlRequestSerializer,
    UnifiedCrawlRequestSerializer,
)

logger = logging.getLogger(__name__)


class AuthorViewSet(viewsets.ModelViewSet):
    queryset = AuthorProfile.objects.all().prefetch_related("publications__journal")
    serializer_class = AuthorProfileSerializer
    permission_classes = [AllowAny]
    lookup_field = "scholar_id"

    @action(detail=False, methods=["post"], url_path="scrape")
    def scrape(self, request):
        """
        Triggers a Celery task to scrape author profile from Google Scholar.
        POST payload: { "author_id": "z8H-N7gAAAAJ", "limit": 10, "detailed": false }
        """
        serializer = ScrapeAuthorRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        author_id = serializer.validated_data["author_id"]
        limit = serializer.validated_data["limit"]
        detailed = serializer.validated_data.get("detailed", False)

        # Trigger Celery background task
        from apps.scholar.tasks import scrape_author_profile_task
        task = scrape_author_profile_task.delay(author_id, limit, detailed)

        return Response({
            "task_id": task.id,
            "status": "PENDING"
        }, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=["get"], url_path="task-status/(?P<task_id>[^/.]+)")
    def task_status(self, request, task_id=None):
        """
        Checks the status/progress of a Celery scrape task.
        """
        from celery.result import AsyncResult
        res = AsyncResult(task_id)

        response_data = {
            "task_id": task_id,
        }

        try:
            status_str = res.status
            response_data["status"] = status_str

            if status_str == "PROGRESS":
                info = res.info or {}
                response_data["progress"] = info.get("progress", 0)
                response_data["message"] = info.get("message", "")
            elif status_str == "SUCCESS":
                response_data["progress"] = 100
                response_data["message"] = "Cào dữ liệu hoàn thành thành công!"
                response_data["result"] = res.result
            elif status_str == "FAILURE":
                response_data["progress"] = 0
                try:
                    err_val = str(res.result)
                except Exception:
                    err_val = "Lỗi trong quá trình cào."
                response_data["message"] = f"Lỗi cào dữ liệu: {err_val}"
            else:
                response_data["progress"] = 0
                response_data["message"] = "Đang chờ thực hiện trong hàng đợi..."
        except Exception as e:
            logger.warning(f"Failed to decode Celery task status for {task_id}: {e}")
            response_data["status"] = "FAILURE"
            response_data["progress"] = 0
            response_data["message"] = "Tác vụ thất bại hoặc lỗi kết nối hệ thống."

        return Response(response_data)


    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        """
        Searches authors on Google Scholar by name (synchronous candidate list lookup).
        GET query parameters: ?q=Author+Name
        """
        serializer = AuthorSearchQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        query = serializer.validated_data["q"]

        from apps.scholar.tasks import setup_scholarly_proxy
        try:
            scholarly_instance = setup_scholarly_proxy()
            search_query = scholarly_instance.search_author(query)
            candidates = []
            
            # Fetch up to top 10 candidates
            for _ in range(10):
                try:
                    cand = next(search_query)
                    interests = cand.get("interests", [])
                    if not isinstance(interests, list):
                        interests = []
                    candidates.append({
                        "scholar_id": cand.get("scholar_id") or cand.get("id"),
                        "name": cand.get("name", "Unknown"),
                        "affiliation": cand.get("affiliation", ""),
                        "citedby": cand.get("citedby", 0),
                        "interests": interests,
                    })
                except StopIteration:
                    break

            candidate_serializer = AuthorCandidateSerializer(candidates, many=True)
            return Response(candidate_serializer.data)
        except Exception as e:
            logger.exception("Google Scholar author search failed")
            return Response(
                {"error": f"Lỗi tìm kiếm tác giả: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CrawlerViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]

    @action(detail=False, methods=["get", "post"], url_path="settings")
    def manage_settings(self, request):
        from apps.scholar.tasks import get_scholar_settings, save_scholar_settings
        if request.method == "POST":
            success = save_scholar_settings(request.data)
            if success:
                return Response({"status": "success", "message": "Cập nhật cấu hình thành công."})
            return Response({"status": "error", "message": "Không thể lưu cấu hình."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        data = get_scholar_settings()
        return Response(data)

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        from django.db.models import Q
        from apps.scholar.models import (
            BioxbioJournal, ScimagoJournal, ClarivateJournal, Journal,
            AuthorProfile, Publication
        )
        total_authors = AuthorProfile.objects.count()
        total_publications = Publication.objects.count()
        total_bioxbio = BioxbioJournal.objects.count()
        total_scimago = ScimagoJournal.objects.count()
        total_clarivate = ClarivateJournal.objects.count()
        total_mapped = Journal.objects.count()
        
        mapped_with_raw = Journal.objects.filter(
            Q(bioxbio_journal__isnull=False) | Q(scimago_journal__isnull=False)
        ).count()
        match_rate = round((mapped_with_raw / total_mapped * 100), 1) if total_mapped > 0 else 0
        
        return Response({
            "authors": total_authors,
            "publications": total_publications,
            "bioxbio_journals": total_bioxbio,
            "scimago_journals": total_scimago,
            "clarivate_journals": total_clarivate,
            "mapped_journals": total_mapped,
            "match_rate": match_rate
        })

    @action(detail=False, methods=["post"], url_path="bioxbio")
    def bioxbio(self, request):
        """
        Trigger BioxBio crawling task.
        """
        serializer = BioxbioCrawlRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        from apps.scholar.tasks import crawl_bioxbio_task
        task = crawl_bioxbio_task.delay(
            start_url=serializer.validated_data.get("start_url", "https://www.bioxbio.com/"),
            max_workers=serializer.validated_data.get("max_workers", 10),
            delay=serializer.validated_data.get("delay", 2.0)
        )
        return Response({"task_id": task.id, "status": "PENDING"}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=["post"], url_path="scimago")
    def scimago(self, request):
        """
        Trigger SCImago crawling task.
        """
        serializer = ScimagoCrawlRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        from apps.scholar.tasks import crawl_scimago_task
        task = crawl_scimago_task.delay(
            years=serializer.validated_data.get("years"),
            max_workers=serializer.validated_data.get("max_workers", 5),
            delay=serializer.validated_data.get("delay", 1.0)
        )
        return Response({"task_id": task.id, "status": "PENDING"}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=["post"], url_path="clarivate")
    def clarivate(self, request):
        """
        Trigger Clarivate crawling task.
        """
        serializer = ClarivateCrawlRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        from apps.scholar.tasks import crawl_clarivate_task
        task = crawl_clarivate_task.delay(
            max_pages=serializer.validated_data.get("max_pages"),
            max_workers=serializer.validated_data.get("max_workers", 3),
            delay=serializer.validated_data.get("delay", 1.5)
        )
        return Response({"task_id": task.id, "status": "PENDING"}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=["post"], url_path="integrate")
    def integrate(self, request):
        """
        Trigger Score Integrator / double matching task.
        """
        from apps.scholar.tasks import integrate_scores_task
        task = integrate_scores_task.delay()
        return Response({"task_id": task.id, "status": "PENDING"}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=["post"], url_path="unified")
    def unified(self, request):
        """
        Kích hoạt toàn bộ pipeline: cào song song (Clarivate + SCImago + BioxBio)
        rồi tự động chạy mapping khi cả 3 luồng hoàn tất.
        """
        serializer = UnifiedCrawlRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        from apps.scholar.tasks import crawl_and_integrate_all_task
        task = crawl_and_integrate_all_task.delay(
            scimago_years=d.get('scimago_years'),
            scimago_start_url=d.get('scimago_start_url', 'https://www.scimagojr.com/journalrank.php'),
            clarivate_max_pages=d.get('clarivate_max_pages'),
            clarivate_start_url=d.get('clarivate_start_url', 'https://mjl.clarivate.com/api/mjl/jprof/public/rank-search'),
            clarivate_workers=d.get('clarivate_workers', 3),
            clarivate_delay=d.get('clarivate_delay', 1.5),
            scimago_workers=d.get('scimago_workers', 5),
            scimago_delay=d.get('scimago_delay', 1.0),
            bioxbio_start_url=d.get('bioxbio_start_url', 'https://www.bioxbio.com/journal/'),
            bioxbio_max_pages=d.get('bioxbio_max_pages'),
            bioxbio_workers=d.get('bioxbio_workers', 10),
            bioxbio_delay=d.get('bioxbio_delay', 2.0),
        )
        return Response({"task_id": task.id, "status": "PENDING"}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=["get"], url_path="status/(?P<task_id>[^/.]+)")
    def status_check(self, request, task_id=None):
        """
        Check progress status of any crawler/integrator task.
        """
        from celery.result import AsyncResult
        res = AsyncResult(task_id)
        response_data = {
            "task_id": task_id,
            "status": res.status,
            "progress": 0,
            "message": ""
        }
        
        if res.status == "PROGRESS":
            info = res.info or {}
            response_data["progress"] = info.get("progress", 0)
            response_data["message"] = info.get("message", "")
        elif res.status == "SUCCESS":
            response_data["progress"] = 100
            response_data["message"] = "Tác vụ chạy hoàn tất thành công!"
            response_data["result"] = res.result
        elif res.status == "FAILURE":
            response_data["progress"] = 0
            response_data["message"] = f"Tác vụ thất bại: {str(res.result)}"
        else:
            response_data["progress"] = 0
            response_data["message"] = "Đang chờ trong hàng đợi..."
            
        return Response(response_data)

    @action(detail=False, methods=["get"], url_path="bioxbio-data")
    def bioxbio_data(self, request):
        from django.db.models import Q
        from apps.scholar.models import BioxbioJournal
        from apps.scholar.api.serializers import BioxbioJournalSerializer

        queryset = BioxbioJournal.objects.all().prefetch_related("raw_issns", "raw_rankings")

        q = request.query_params.get("q", "").strip()
        if q:
            queryset = queryset.filter(
                Q(title__icontains=q) |
                Q(raw_issns__issn__icontains=q)
            )

        year = request.query_params.get("year", "").strip()
        if year:
            queryset = queryset.filter(raw_rankings__year=year)

        if q or year:
            queryset = queryset.distinct()

        queryset = queryset[:100]
        serializer = BioxbioJournalSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="scimago-data")
    def scimago_data(self, request):
        from django.db.models import Q
        from apps.scholar.models import ScimagoJournal
        from apps.scholar.api.serializers import ScimagoJournalSerializer

        queryset = ScimagoJournal.objects.all().prefetch_related("raw_issns", "raw_rankings")

        q = request.query_params.get("q", "").strip()
        if q:
            queryset = queryset.filter(
                Q(title__icontains=q) |
                Q(raw_issns__issn__icontains=q) |
                Q(publisher__icontains=q) |
                Q(country__icontains=q)
            )

        year = request.query_params.get("year", "").strip()
        if year:
            queryset = queryset.filter(raw_rankings__year=year)

        quartile = request.query_params.get("quartile", "").strip()
        if quartile:
            queryset = queryset.filter(raw_rankings__sjr_quartile__iexact=quartile)
        else:
            if not q:
                queryset = queryset.filter(raw_rankings__sjr_quartile__in=["Q1", "Q2", "Q3", "Q4"])

        if q or year or quartile or (not quartile and not q):
            queryset = queryset.distinct()

        queryset = queryset[:100]
        serializer = ScimagoJournalSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="clarivate-data")
    def clarivate_data(self, request):
        from django.db.models import Q
        from apps.scholar.models import ClarivateJournal
        from apps.scholar.api.serializers import ClarivateJournalSerializer

        queryset = ClarivateJournal.objects.all()

        q = request.query_params.get("q", "").strip()
        if q:
            queryset = queryset.filter(
                Q(title__icontains=q) |
                Q(issn__icontains=q) |
                Q(eissn__icontains=q) |
                Q(publisher__icontains=q) |
                Q(country__icontains=q)
            )

        wos_index = request.query_params.get("wos_index", "").strip()
        if wos_index:
            queryset = queryset.filter(wos_core_collection__icontains=wos_index)

        queryset = queryset[:100]
        serializer = ClarivateJournalSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="mapped-data")
    def mapped_data(self, request):
        from django.db.models import Q
        from apps.scholar.models import Journal
        from apps.scholar.api.serializers import JournalShortSerializer

        queryset = Journal.objects.all()

        q = request.query_params.get("q", "").strip()
        if q:
            queryset = queryset.filter(
                Q(clarivate_title__icontains=q) |
                Q(title_normalized__icontains=q) |
                Q(issn__icontains=q) |
                Q(eissn__icontains=q) |
                Q(publisher__icontains=q) |
                Q(country__icontains=q)
            )

        wos_index = request.query_params.get("wos_index", "").strip()
        if wos_index:
            queryset = queryset.filter(wos_core_collection__icontains=wos_index)

        quartile = request.query_params.get("quartile", "").strip()
        if quartile:
            queryset = queryset.filter(latest_quartile__iexact=quartile)
        else:
            if not q:
                queryset = queryset.filter(latest_quartile__in=["Q1", "Q2", "Q3", "Q4"])

        mapped_only = request.query_params.get("mapped_only", "").strip() == "true"
        if mapped_only:
            queryset = queryset.filter(
                Q(bioxbio_journal__isnull=False) | Q(scimago_journal__isnull=False)
            )

        queryset = queryset[:100]
        serializer = JournalShortSerializer(queryset, many=True)
        return Response(serializer.data)




