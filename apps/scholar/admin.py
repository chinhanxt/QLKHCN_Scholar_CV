from django.contrib import admin
from apps.core.admin import BaseModelAdmin
from .models import Journal, JournalISSN, JournalRanking, AuthorProfile, Publication


@admin.register(Journal)
class JournalAdmin(BaseModelAdmin):
    list_display = ("clarivate_title", "issn", "eissn", "latest_if", "latest_sjr", "latest_quartile", "wos_core_collection")
    search_fields = ("clarivate_title", "title_normalized", "issn", "eissn", "publisher")
    list_filter = ("latest_quartile", "latest_if_year", "latest_sjr_year", "wos_core_collection", "country")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(JournalISSN)
class JournalISSNAdmin(BaseModelAdmin):
    list_display = ("issn", "journal")
    search_fields = ("issn", "journal__clarivate_title", "journal__title_normalized")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(JournalRanking)
class JournalRankingAdmin(BaseModelAdmin):
    list_display = ("journal", "year", "impact_factor", "sjr_score", "sjr_quartile", "h_index")
    search_fields = ("journal__clarivate_title", "journal__title_normalized")
    list_filter = ("year", "sjr_quartile")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(AuthorProfile)
class AuthorProfileAdmin(BaseModelAdmin):
    list_display = ("name", "scholar_id", "affiliation", "citedby", "hindex", "i10index")
    search_fields = ("name", "scholar_id", "affiliation")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(Publication)
class PublicationAdmin(BaseModelAdmin):
    list_display = ("title", "author", "year", "citations", "sjr_q", "if_val", "wos")
    search_fields = ("title", "author__name", "venue")
    list_filter = ("year", "sjr_q", "wos")
    readonly_fields = ("id", "created_at", "updated_at")
