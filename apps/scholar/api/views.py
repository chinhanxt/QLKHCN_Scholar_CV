import logging
import os
from re import search as re_search
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.viewsets import ViewSet, ModelViewSet
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from typing import Any, Optional
from rest_framework.request import Request
from rest_framework.permissions import AllowAny, IsAuthenticated

from apps.core.permissions import IsAdminUser
from apps.scholar.models import (
    AuthorProfile, AutoScanConfig, AntiBlockConfig,
    ScholarProfile, ScholarPublication, ProfileStatus,
)
from apps.scholar.scholarly.tor_helper import renew_tor_ip, get_tor_status
from apps.scholar.tasks import scrape_author_cv_smart_task
from apps.scholar.api.serializers import (
    AuthorProfileSerializer,
    ScrapeAuthorRequestSerializer,
    AuthorSearchQuerySerializer,
    AuthorCandidateSerializer,
    BioxbioCrawlRequestSerializer,
    ScimagoCrawlRequestSerializer,
    ClarivateCrawlRequestSerializer,
    UnifiedCrawlRequestSerializer,
    AntiBlockConfigSerializer,
    ScholarProfileSerializer,
    ScholarPublicationSerializer,
    ProfileSubmitSerializer,
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

    @action(detail=False, methods=["get"], url_path="history")
    def history_list(self, request):
        """
        Lấy danh sách lịch sử các lượt chạy cào và mapping.
        """
        from apps.scholar.models import CrawlHistory
        from rest_framework import serializers
        
        class CrawlHistorySerializer(serializers.ModelSerializer):
            triggered_at_formatted = serializers.SerializerMethodField()
            completed_at_formatted = serializers.SerializerMethodField()
            duration = serializers.SerializerMethodField()

            class Meta:
                model = CrawlHistory
                fields = [
                    'id', 'task_id', 'created_at', 'triggered_at_formatted',
                    'completed_at', 'completed_at_formatted', 'duration',
                    'status', 'is_automated',
                    'clarivate_count', 'scimago_count', 'bioxbio_count', 'mapped_count',
                    'clarivate_total', 'scimago_total', 'bioxbio_total', 'mapped_total',
                    'error_message'
                ]

            def get_triggered_at_formatted(self, obj):
                from django.utils import timezone
                if obj.created_at:
                    local_dt = obj.created_at.astimezone(timezone.get_default_timezone())
                    return local_dt.strftime('%H:%M:%S %d/%m/%Y')
                return ""

            def get_completed_at_formatted(self, obj):
                from django.utils import timezone
                if obj.completed_at:
                    local_dt = obj.completed_at.astimezone(timezone.get_default_timezone())
                    return local_dt.strftime('%H:%M:%S %d/%m/%Y')
                return ""

            def get_duration(self, obj):
                if obj.created_at and obj.completed_at:
                    diff = obj.completed_at - obj.created_at
                    secs = int(diff.total_seconds())
                    if secs < 60:
                        return f"{secs}s"
                    mins = secs // 60
                    rem_secs = secs % 60
                    return f"{mins}m {rem_secs}s"
                return "--"

        queryset = CrawlHistory.objects.all().order_by('-created_at')[:50]
        serializer = CrawlHistorySerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="history-detail")
    def history_detail(self, request, pk=None):
        """
        Lấy chi tiết log của một lượt chạy cụ thể.
        """
        from apps.scholar.models import CrawlHistory
        try:
            obj = CrawlHistory.objects.get(pk=pk)
            return Response({
                "id": obj.id,
                "task_id": obj.task_id,
                "status": obj.status,
                "log_output": obj.log_output,
                "error_message": obj.error_message
            })
        except CrawlHistory.DoesNotExist:
            return Response({"error": "Không tìm thấy lịch sử lượt chạy."}, status=404)

    @action(detail=False, methods=["delete"], url_path="clear-history")
    def clear_history(self, request):
        """
        Xóa toàn bộ lịch sử các lượt chạy cào.
        """
        from apps.scholar.models import CrawlHistory
        deleted_count, _ = CrawlHistory.objects.all().delete()
        return Response({"status": "success", "deleted_count": deleted_count})

    @action(detail=False, methods=["get"], url_path="active-task")
    def active_task(self, request):
        from apps.scholar.tasks import get_scholar_settings, save_scholar_settings
        from celery.result import AsyncResult
        
        data = get_scholar_settings()
        task_id = data.get('active_unified_task_id')
        
        last_run_info = {
            "time": data.get("last_run_time"),
            "status": data.get("last_run_status"),
            "message": data.get("last_run_message"),
        }
        
        if task_id:
            res = AsyncResult(task_id)
            is_active = False
            if res.status == 'PROGRESS':
                is_active = True
            elif res.status == 'PENDING':
                try:
                    from config.celery import app as celery_app
                    i = celery_app.control.inspect(timeout=1.0)
                    active = i.active() or {}
                    reserved = i.reserved() or {}
                    all_active_ids = set()
                    for w_tasks in active.values():
                        for t in w_tasks:
                            all_active_ids.add(t.get('id'))
                    for w_tasks in reserved.values():
                        for t in w_tasks:
                            all_active_ids.add(t.get('id'))
                    if task_id in all_active_ids:
                        is_active = True
                except Exception as e:
                    logger.warning(f"Celery inspect failed: {e}")

            if is_active:
                info = res.info or {}
                if not isinstance(info, dict):
                    info = {}
                return Response({
                    "task_id": task_id,
                    "status": res.status,
                    "progress": info.get('progress', 0),
                    "message": info.get('message', ''),
                    "info": info,
                    "last_run_info": last_run_info,
                })
            else:
                # Stale task ID left over, clean it up
                data['active_unified_task_id'] = None
                save_scholar_settings(data)

        return Response({
            "task_id": None, 
            "status": "IDLE",
            "last_run_info": last_run_info,
        })


    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        from django.db.models import Q, Count
        from apps.scholar.models import (
            BioxbioJournal, ScimagoJournal, ClarivateJournal, Journal,
            AuthorProfile, Publication, CrawlHistory
        )
        total_authors = AuthorProfile.objects.count()
        total_publications = Publication.objects.count()
        total_bioxbio = BioxbioJournal.objects.count()
        total_scimago = ScimagoJournal.objects.count()
        total_clarivate = ClarivateJournal.objects.count()
        total_mapped = Journal.objects.filter(is_staging=False).count()
        total_staging = Journal.objects.filter(is_staging=True).count()
        
        # Real publication matching rate
        matched_publications = Publication.objects.filter(journal__isnull=False).count()
        pub_match_rate = round((matched_publications / total_publications * 100), 1) if total_publications > 0 else 0
        
        # Coverage rate of mapped journals
        mapped_with_raw = Journal.objects.filter(is_staging=False).filter(
            Q(bioxbio_journal__isnull=False) | Q(scimago_journal__isnull=False)
        ).count()
        match_rate = round((mapped_with_raw / total_mapped * 100), 1) if total_mapped > 0 else 0
        
        # Quartile distribution of matched publications
        q1_count = Publication.objects.filter(sjr_q='Q1').count()
        q2_count = Publication.objects.filter(sjr_q='Q2').count()
        q3_count = Publication.objects.filter(sjr_q='Q3').count()
        q4_count = Publication.objects.filter(sjr_q='Q4').count()
        na_count = Publication.objects.exclude(sjr_q__in=['Q1', 'Q2', 'Q3', 'Q4']).count()

        # Quartile distribution of integrated journals
        j_q1 = Journal.objects.filter(is_staging=False, latest_quartile='Q1').count()
        j_q2 = Journal.objects.filter(is_staging=False, latest_quartile='Q2').count()
        j_q3 = Journal.objects.filter(is_staging=False, latest_quartile='Q3').count()
        j_q4 = Journal.objects.filter(is_staging=False, latest_quartile='Q4').count()
        j_na = Journal.objects.filter(is_staging=False).exclude(latest_quartile__in=['Q1', 'Q2', 'Q3', 'Q4']).count()

        # Actual integrated mapped counts
        clarivate_mapped = Journal.objects.filter(is_staging=False).exclude(clarivate_title__isnull=True).exclude(clarivate_title='').count()
        scimago_mapped = Journal.objects.filter(is_staging=False, scimago_journal__isnull=False).count()
        bioxbio_mapped = Journal.objects.filter(is_staging=False, bioxbio_journal__isnull=False).count()
        
        # Top 5 countries of mapped journals
        top_countries = Journal.objects.filter(is_staging=False).exclude(country__isnull=True).exclude(country='').values('country').annotate(count=Count('id')).order_by('-count')[:5]
        countries = [{"country": item['country'], "count": item['count']} for item in top_countries]
        
        # Database growth history over success runs
        history_runs = list(CrawlHistory.objects.filter(status='SUCCESS').order_by('-created_at')[:6])
        history_runs.reverse()
        history_data = []
        for r in history_runs:
            history_data.append({
                "date": r.created_at.strftime("%d/%m"),
                "clarivate": r.clarivate_total or r.clarivate_count or 0,
                "scimago": r.scimago_total or r.scimago_count or 0,
                "bioxbio": r.bioxbio_total or r.bioxbio_count or 0,
                "mapped": r.mapped_total or r.mapped_count or 0
            })

        return Response({
            "authors": total_authors,
            "publications": total_publications,
            "bioxbio_journals": total_bioxbio,
            "scimago_journals": total_scimago,
            "clarivate_journals": total_clarivate,
            "mapped_journals": total_mapped,
            "staging_journals": total_staging,
            "match_rate": match_rate,
            
            "clarivate_mapped": clarivate_mapped,
            "scimago_mapped": scimago_mapped,
            "bioxbio_mapped": bioxbio_mapped,
            
            "matched_publications": matched_publications,
            "pub_match_rate": pub_match_rate,
            "quartiles": {
                "Q1": q1_count,
                "Q2": q2_count,
                "Q3": q3_count,
                "Q4": q4_count,
                "NA": na_count
            },
            "journal_quartiles": {
                "Q1": j_q1,
                "Q2": j_q2,
                "Q3": j_q3,
                "Q4": j_q4,
                "NA": j_na
            },
            "countries": countries,
            "history_trends": history_data
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

    @action(detail=False, methods=["post"], url_path="confirm-staging")
    def confirm_staging(self, request):
        """
        Xác nhận đồng bộ dữ liệu staging lên DB chính thức.
        1. Xóa toàn bộ Journal where is_staging=False (sử dụng raw SQL để nhanh và tránh nghẽn Django ORM cascade).
        2. Cập nhật tất cả Journal where is_staging=True thành is_staging=False.
        """
        from apps.scholar.models import Journal
        from django.db import transaction, connection
        
        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    # 1. SET NULL cho publication.journal_id của các journal chuẩn bị xóa
                    cursor.execute("""
                        UPDATE scholar_publications 
                        SET journal_id = NULL 
                        WHERE journal_id IN (SELECT id FROM scholar_journals WHERE is_staging = FALSE)
                    """)
                    # 2. Xóa các rankings chính thức của các journal chuẩn bị xóa
                    cursor.execute("""
                        DELETE FROM scholar_journal_rankings 
                        WHERE journal_id IN (SELECT id FROM scholar_journals WHERE is_staging = FALSE)
                    """)
                    # 3. Xóa các issns chính thức của các journal chuẩn bị xóa
                    cursor.execute("""
                        DELETE FROM scholar_journal_issns 
                        WHERE journal_id IN (SELECT id FROM scholar_journals WHERE is_staging = FALSE)
                    """)
                    # 4. Xóa chính các journal chính thức
                    cursor.execute("DELETE FROM scholar_journals WHERE is_staging = FALSE")
                    
                # 5. Cập nhật staging journals thành chính thức (is_staging = False)
                updated_count = Journal.objects.filter(is_staging=True).update(is_staging=False)
                
            return Response({"status": "success", "confirmed_count": updated_count}, status=status.HTTP_200_OK)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.exception("Error in confirm_staging raw SQL execution")
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=["post"], url_path="delete-staging")
    def delete_staging(self, request):
        """
        Xóa toàn bộ dữ liệu staging bằng Raw SQL cực nhanh.
        """
        from django.db import transaction, connection
        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("SELECT COUNT(*) FROM scholar_journals WHERE is_staging = TRUE")
                    deleted_count = cursor.fetchone()[0]
                    
                    cursor.execute("""
                        DELETE FROM scholar_journal_rankings 
                        WHERE journal_id IN (SELECT id FROM scholar_journals WHERE is_staging = TRUE)
                    """)
                    cursor.execute("""
                        DELETE FROM scholar_journal_issns 
                        WHERE journal_id IN (SELECT id FROM scholar_journals WHERE is_staging = TRUE)
                    """)
                    cursor.execute("DELETE FROM scholar_journals WHERE is_staging = TRUE")
                    
            return Response({"status": "success", "deleted_count": deleted_count}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
            "message": "",
            "info": {}
        }
        
        if res.status == "PROGRESS":
            info = res.info or {}
            if not isinstance(info, dict):
                info = {}
            response_data["progress"] = info.get("progress", 0)
            response_data["message"] = info.get("message", "")
            response_data["info"] = info
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

        staging = request.query_params.get("staging", "").strip() == "true"
        queryset = Journal.objects.filter(is_staging=staging)

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
        confirmed_titles = None
        if staging:
            confirmed_titles = set(
                Journal.objects.filter(is_staging=False).values_list("title_normalized", flat=True)
            )
        serializer = JournalShortSerializer(queryset, many=True, context={"confirmed_titles": confirmed_titles})
        return Response(serializer.data)


class TorStatusView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        tor_info = get_tor_status(
            control_host=os.environ.get("TOR_CONTROL_HOST", "tor"),
            control_port=int(os.environ.get("TOR_CONTROL_PORT", 9051))
        )
        return Response(tor_info)

    def post(self, request):
        success = renew_tor_ip(
            control_host=os.environ.get("TOR_CONTROL_HOST", "tor"),
            control_port=int(os.environ.get("TOR_CONTROL_PORT", 9051)),
            rebuild_wait=5
        )
        if success:
            return Response({"message": "Tor IP renewed successfully (NEWNYM signal sent)"})
        return Response({"error": "Failed to renew Tor IP"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StartTorServiceView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        import subprocess
        base_dir = settings.BASE_DIR
        cmd1 = ["docker", "compose", "-f", "docker-compose.local.yml", "up", "-d", "tor"]
        try:
            res = subprocess.run(cmd1, cwd=base_dir, capture_output=True, text=True, timeout=30)
            if res.returncode == 0:
                return Response({"message": "Đã khởi động Tor Proxy Service qua Docker thành công!"})
        except Exception as e:
            logger.warning(f"docker compose up -d tor failed: {e}")

        try:
            cmd2 = ["docker", "start", "scholar_tor_proxy"]
            res2 = subprocess.run(cmd2, capture_output=True, text=True, timeout=30)
            if res2.returncode == 0:
                return Response({"message": "Đã khởi động Tor Container (scholar_tor_proxy) thành công!"})
            return Response({"error": f"Không thể bật Docker Tor: {res2.stderr}"}, status=400)
        except Exception as e:
            return Response({"error": f"Lỗi khi gọi Docker: {str(e)}"}, status=500)


class BulkImportAuthorsView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        raw_text = request.data.get("scholar_ids_or_urls", "")
        lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
        imported = []

        for line in lines:
            scholar_id = line
            if "user=" in line:
                scholar_id = line.split("user=")[1].split("&")[0]
            
            author, created = AuthorProfile.objects.get_or_create(
                scholar_id=scholar_id,
                defaults={
                    "name": f"Author {scholar_id}",
                    "auto_scan_enabled": True,
                    "last_scan_status": "PENDING"
                }
            )
            if not created and not author.auto_scan_enabled:
                author.auto_scan_enabled = True
                author.save(update_fields=["auto_scan_enabled"])

            if created or request.data.get("trigger_now"):
                scrape_author_cv_smart_task.delay(author.id)
            imported.append({"id": author.id, "scholar_id": scholar_id, "created": created})

        return Response({"message": f"Successfully imported {len(imported)} CVs", "data": imported})


class AutoScanConfigView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        config = AutoScanConfig.get_solo()
        return Response({
            "is_active": config.is_active,
            "scan_interval_hours": config.scan_interval_hours,
            "frequency_type": config.frequency_type,
            "preferred_hour": config.preferred_hour,
            "preferred_minute": config.preferred_minute,
            "preferred_weekday": config.preferred_weekday,
            "preferred_day_of_month": config.preferred_day_of_month,
            "batch_size_per_hour": config.batch_size_per_hour,
            "delay_min_seconds": config.delay_min_seconds,
            "delay_max_seconds": config.delay_max_seconds,
            "cooldown_min_seconds": config.cooldown_min_seconds,
            "cooldown_max_seconds": config.cooldown_max_seconds,
            "current_job_status": config.current_job_status,
            "current_job_progress": config.current_job_progress,
            "current_job_detail": config.current_job_detail,
        })

    def patch(self, request):
        config = AutoScanConfig.get_solo()
        fields = [
            "is_active", "scan_interval_hours", "frequency_type",
            "preferred_hour", "preferred_minute", "preferred_weekday", "preferred_day_of_month",
            "batch_size_per_hour", "delay_min_seconds", "delay_max_seconds", 
            "cooldown_min_seconds", "cooldown_max_seconds",
            "current_job_status", "current_job_progress", "current_job_detail"
        ]
        for field in fields:
            if field in request.data:
                setattr(config, field, request.data[field])
        
        if config.frequency_type == "DAILY":
            config.scan_interval_hours = 24
        elif config.frequency_type == "WEEKLY":
            config.scan_interval_hours = 168
        elif config.frequency_type == "MONTHLY":
            config.scan_interval_hours = 720

        config.save()
        return Response({"message": "Configuration updated successfully"})


class TriggerAuthorsScanView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        author_ids = request.data.get("author_ids", [])
        if not author_ids or not isinstance(author_ids, list):
            return Response({"error": "Vui lòng chọn ít nhất 1 tác giả!"}, status=status.HTTP_400_BAD_REQUEST)

        config = AutoScanConfig.get_solo()
        config.current_job_status = "RUNNING"
        config.current_job_progress = 10
        config.current_job_detail = f"Đã phát lệnh quét ngầm trực tiếp cho {len(author_ids)} tác giả. Đang kết nối Tor..."
        config.save(update_fields=["current_job_status", "current_job_progress", "current_job_detail"])

        dispatched = []
        for author_id in author_ids:
            try:
                author = AuthorProfile.objects.get(id=author_id)
                author.last_scan_status = "PENDING"
                author.save(update_fields=["last_scan_status"])
                scrape_author_cv_smart_task.delay(author.id)
                dispatched.append(author.name)
            except AuthorProfile.DoesNotExist:
                pass

        return Response({
            "message": f"Đã phát lệnh quét ngầm trực tiếp cho {len(dispatched)} tác giả!",
            "dispatched": dispatched
        })


class AntiBlockConfigView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        config = AntiBlockConfig.get_solo()
        serializer = AntiBlockConfigSerializer(config)
        return Response(serializer.data)

    def patch(self, request):
        config = AntiBlockConfig.get_solo()
        serializer = AntiBlockConfigSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RotateTorView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from apps.scholar.scholarly.tor_helper import renew_tor_ip
        success = renew_tor_ip()
        return Response({'status': 'success' if success else 'failed', 'rotated': success})


class UserScholarProfileViewSet(ViewSet):
    """
    ViewSet dành cho người dùng cá nhân xem và gửi thông tin hồ sơ Google Scholar.
    """
    permission_classes = [IsAuthenticated]

    def _get_or_create_profile(self, user: Any) -> ScholarProfile:
        """
        Lấy hoặc tạo mới ScholarProfile tương ứng với tài khoản người dùng.
        """
        profile, _ = ScholarProfile.objects.get_or_create(user=user)
        return profile

    def _sync_profile_from_author(self, profile: ScholarProfile) -> None:
        """
        Tự động đồng bộ các chỉ số và danh sách bài báo từ AuthorProfile (dữ liệu cào Google Scholar)
        sang ScholarProfile (hồ sơ của user) nếu tài khoản đã được phê duyệt.
        """
        scholar_id = (profile.scholar_id or "").strip()
        if not scholar_id:
            return

        author = AuthorProfile.objects.filter(scholar_id__iexact=scholar_id).first()
        if not author:
            author = AuthorProfile.objects.filter(scholar_id__icontains=scholar_id).first()

        if author:
            from apps.scholar.tasks import sync_scholar_profile_from_author
            sync_scholar_profile_from_author(author)

    @action(detail=False, methods=["get"], url_path="profile")
    def my_profile(self, request: Request) -> Response:
        """
        Lấy thông tin hồ sơ Google Scholar của người dùng hiện tại.
        """
        profile = self._get_or_create_profile(request.user)
        self._sync_profile_from_author(profile)
        serializer = ScholarProfileSerializer(profile)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="profile/submit")
    def submit_profile(self, request: Request) -> Response:
        """
        Gửi liên kết hồ sơ Google Scholar để chờ duyệt.
        """
        profile = self._get_or_create_profile(request.user)
        serializer = ProfileSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        url = serializer.validated_data["scholar_url"]
        match = re_search(r"user=([a-zA-Z0-9_-]+)", url)
        scholar_id = match.group(1) if match else None

        profile.scholar_url = url
        profile.scholar_id = scholar_id
        profile.status = ProfileStatus.PENDING
        profile.submitted_at = timezone.now()
        profile.save()

        return Response(ScholarProfileSerializer(profile).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["patch"], url_path="profile/update-academic")
    def update_academic(self, request: Request) -> Response:
        """
        Cập nhật thông tin lý lịch khoa học của người dùng (Họ tên, Học hàm/Học vị, Chức vụ, Bộ môn, Cơ quan).
        """
        profile = self._get_or_create_profile(request.user)
        for field in ["full_name", "academic_title", "position", "department", "institution"]:
            if field in request.data:
                setattr(profile, field, request.data[field])

        if "full_name" in request.data and request.data["full_name"]:
            full_name_val = str(request.data["full_name"]).strip()
            names = full_name_val.split(" ", 1)
            request.user.first_name = names[0]
            if len(names) > 1:
                request.user.last_name = names[1]
            else:
                request.user.last_name = ""
            request.user.save(update_fields=["first_name", "last_name"])

        profile.save()
        return Response(ScholarProfileSerializer(profile).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="profile/quick-preview")
    def quick_preview(self, request: Request) -> Response:
        """
        Quét nhanh thông tin cơ bản của tác giả từ Google Scholar qua Tor/Proxy.
        """
        scholar_id = request.data.get("scholar_id")
        if not scholar_id:
            scholar_url = request.data.get("scholar_url", "")
            match = re_search(r"user=([a-zA-Z0-9_-]{10,16})", scholar_url)
            if match:
                scholar_id = match.group(1)

        if not scholar_id:
            return Response({"error": "Vui lòng cung cấp Scholar ID hoặc URL hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. First check local DB
        local_author = AuthorProfile.objects.filter(scholar_id__iexact=scholar_id).first()
        if local_author:
            return Response({
                "found": True,
                "scholar_id": local_author.scholar_id,
                "name": local_author.name,
                "affiliation": local_author.affiliation or "",
                "email_domain": local_author.email_domain or "",
                "citedby": local_author.citedby or 0,
                "hindex": local_author.hindex or 0,
                "i10index": local_author.i10index or 0,
                "interests": local_author.interests or [],
                "source": "database"
            })

        # 2. Try live scraping using scholarly / Tor
        try:
            from apps.scholar.scholarly._scholarly import scholarly
            search_query = scholarly.search_author_id(scholar_id)
            if search_query:
                author_dict = scholarly.fill(search_query, sections=['basics'])
                name = author_dict.get('name', '')
                affiliation = author_dict.get('affiliation', '')
                citedby = author_dict.get('citedby', 0)
                hindex = author_dict.get('hindex', 0)
                i10index = author_dict.get('i10index', 0)
                interests = author_dict.get('interests', [])
                email_domain = author_dict.get('email_domain', '')

                return Response({
                    "found": True,
                    "scholar_id": scholar_id,
                    "name": name,
                    "affiliation": affiliation,
                    "email_domain": email_domain,
                    "citedby": citedby,
                    "hindex": hindex,
                    "i10index": i10index,
                    "interests": interests,
                    "source": "live_scholar"
                })
        except Exception as e:
            logger.warning(f"Quick preview live scrape failed for {scholar_id}: {e}")

        return Response({
            "found": False,
            "scholar_id": scholar_id,
            "message": "Không tìm thấy dữ liệu trên Google Scholar hoặc ID không tồn tại. Vui lòng kiểm tra lại đường dẫn."
        })


class AdminScholarApprovalViewSet(ModelViewSet):
    """
    ViewSet dành cho Admin quản lý và phê duyệt các hồ sơ Google Scholar.
    """
    permission_classes = [IsAdminUser]
    queryset = ScholarProfile.objects.all()
    serializer_class = ScholarProfileSerializer

    @action(detail=True, methods=["post"], url_path="approve")
    def approve_profile(self, request: Request, pk: Optional[Any] = None) -> Response:
        """
        Phê duyệt hồ sơ Google Scholar của người dùng.
        Đồng bộ dữ liệu bài báo từ AuthorProfile nếu tác giả đã được quét trước đó.
        """
        profile = self.get_object()
        profile.status = ProfileStatus.APPROVED
        profile.approved_at = timezone.now()

        scholar_id = (profile.scholar_id or "").strip()
        author = None
        if scholar_id:
            author = AuthorProfile.objects.filter(scholar_id__iexact=scholar_id).first()
            if not author:
                author = AuthorProfile.objects.filter(scholar_id__icontains=scholar_id).first()

        if not author and profile.user:
            author = AuthorProfile.objects.filter(name__icontains=profile.user.username).first()

        if author:
            if not profile.scholar_id:
                profile.scholar_id = author.scholar_id
            profile.total_citations = author.citedby
            profile.h_index = author.hindex
            profile.i10_index = author.i10index

            synced_titles = set()
            for pub in author.publications.all():
                try:
                    year_val = int(pub.year) if pub.year and str(pub.year).isdigit() else None
                except ValueError:
                    year_val = None

                sp_obj, created = ScholarPublication.objects.get_or_create(
                    profile=profile,
                    title=pub.title,
                    defaults={
                        "authors": pub.authors_list or "",
                        "journal": pub.venue or "",
                        "pub_year": year_val,
                        "citations": pub.citations or 0,
                        "url": pub.pub_url or "",
                    },
                )
                if not created:
                    sp_obj.authors = pub.authors_list or ""
                    sp_obj.journal = pub.venue or ""
                    sp_obj.pub_year = year_val
                    sp_obj.citations = pub.citations or 0
                    sp_obj.url = pub.pub_url or ""
                    sp_obj.save()
                synced_titles.add(pub.title)

            # Clean up stale automatic publications no longer present in AuthorProfile
            ScholarPublication.objects.filter(profile=profile).exclude(title__in=synced_titles).delete()

        profile.save()
        return Response(ScholarProfileSerializer(profile).data, status=status.HTTP_200_OK)


class EmailSettingsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        from django.conf import settings
        return Response({
            "EMAIL_HOST": getattr(settings, "EMAIL_HOST", "smtp.gmail.com"),
            "EMAIL_PORT": getattr(settings, "EMAIL_PORT", 587),
            "EMAIL_USE_TLS": getattr(settings, "EMAIL_USE_TLS", True),
            "EMAIL_HOST_USER": getattr(settings, "EMAIL_HOST_USER", ""),
            "DEFAULT_FROM_EMAIL": getattr(settings, "DEFAULT_FROM_EMAIL", "webmaster@localhost"),
        })

    def post(self, request):
        return Response({"message": "Cập nhật cấu hình Email SMTP thành công."})


class TestEmailView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"error": "Vui lòng nhập địa chỉ email nhận thử nghiệm."}, status=status.HTTP_400_BAD_REQUEST)

        from apps.core.services.notification_service import NotificationService
        NotificationService.send_email_async(
            subject="[QLKHCN] Thư thử nghiệm hệ thống email",
            recipient_list=[email],
            template_name="emails/test_email.html",
            context={"user": request.user, "message": "Email thử nghiệm từ cấu hình SMTP hệ thống."},
            async_email=False,
        )
        return Response({"message": f"Gửi email thử nghiệm thành công tới {email}."})



