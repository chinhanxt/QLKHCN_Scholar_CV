from rest_framework import serializers
from apps.scholar.models import (
    AuthorProfile, Publication, Journal,
    BioxbioJournal, BioxbioRanking, ScimagoJournal, ScimagoRanking, ClarivateJournal
)


class JournalShortSerializer(serializers.ModelSerializer):
    is_new = serializers.SerializerMethodField()

    class Meta:
        model = Journal
        fields = [
            "id",
            "clarivate_title",
            "title_normalized",
            "issn",
            "eissn",
            "publisher",
            "country",
            "latest_if",
            "latest_if_year",
            "latest_sjr",
            "latest_sjr_year",
            "latest_quartile",
            "latest_h_index",
            "wos_core_collection",
            "bioxbio_match",
            "scimago_match",
            "is_new",
        ]

    def get_is_new(self, obj):
        confirmed_titles = self.context.get("confirmed_titles")
        if confirmed_titles is not None:
            return obj.title_normalized not in confirmed_titles
        return False



class PublicationSerializer(serializers.ModelSerializer):
    journal = JournalShortSerializer(read_only=True)

    class Meta:
        model = Publication
        fields = [
            "id",
            "title",
            "authors_list",
            "venue",
            "year",
            "citations",
            "display_order",
            "cites_per_year",
            "journal",
            "sjr_q",
            "if_val",
            "wos",
        ]


class AuthorProfileSerializer(serializers.ModelSerializer):
    publications = PublicationSerializer(many=True, read_only=True)

    class Meta:
        model = AuthorProfile
        fields = [
            "id",
            "scholar_id",
            "name",
            "affiliation",
            "citedby",
            "hindex",
            "i10index",
            "interests",
            "publications",
            "created_at",
            "updated_at",
        ]


class ScrapeAuthorRequestSerializer(serializers.Serializer):
    author_id = serializers.CharField(max_length=50, required=True)
    limit = serializers.IntegerField(default=100, min_value=0, max_value=5000)
    detailed = serializers.BooleanField(default=False, required=False)


class AuthorSearchQuerySerializer(serializers.Serializer):
    q = serializers.CharField(min_length=2, required=True)


class AuthorCandidateSerializer(serializers.Serializer):
    scholar_id = serializers.CharField()
    name = serializers.CharField()
    affiliation = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    citedby = serializers.IntegerField(required=False, default=0)
    interests = serializers.ListField(child=serializers.CharField(), required=False, default=list)


class BioxbioCrawlRequestSerializer(serializers.Serializer):
    start_url = serializers.URLField(default="https://www.bioxbio.com/")
    max_workers = serializers.IntegerField(default=10, min_value=1, max_value=30)
    delay = serializers.FloatField(default=2.0, min_value=0.1, max_value=10.0)


class ScimagoCrawlRequestSerializer(serializers.Serializer):
    years = serializers.ListField(child=serializers.IntegerField(), required=False)
    max_workers = serializers.IntegerField(default=5, min_value=1, max_value=30)
    delay = serializers.FloatField(default=1.0, min_value=0.1, max_value=10.0)


class ClarivateCrawlRequestSerializer(serializers.Serializer):
    max_pages = serializers.IntegerField(required=False, allow_null=True)
    max_workers = serializers.IntegerField(default=3, min_value=1, max_value=30)
    delay = serializers.FloatField(default=1.5, min_value=0.1, max_value=10.0)


class BioxbioRankingSerializer(serializers.ModelSerializer):
    class Meta:
        model = BioxbioRanking
        fields = ["year", "impact_factor", "total_articles", "total_cites"]


class BioxbioJournalSerializer(serializers.ModelSerializer):
    issns = serializers.SerializerMethodField()
    rankings = BioxbioRankingSerializer(many=True, read_only=True, source="raw_rankings")

    class Meta:
        model = BioxbioJournal
        fields = ["id", "source_id", "title", "title_normalized", "issns", "rankings"]

    def get_issns(self, obj):
        return [item.issn for item in obj.raw_issns.all()]


class ScimagoRankingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScimagoRanking
        fields = ["year", "sjr_score", "sjr_quartile", "h_index"]


class ScimagoJournalSerializer(serializers.ModelSerializer):
    issns = serializers.SerializerMethodField()
    rankings = ScimagoRankingSerializer(many=True, read_only=True, source="raw_rankings")

    class Meta:
        model = ScimagoJournal
        fields = [
            "id",
            "source_id",
            "title",
            "title_normalized",
            "journal_type",
            "publisher",
            "country",
            "issns",
            "rankings",
        ]

    def get_issns(self, obj):
        return [item.issn for item in obj.raw_issns.all()]


class ClarivateJournalSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClarivateJournal
        fields = [
            "id",
            "publication_id",
            "title",
            "title_normalized",
            "issn",
            "eissn",
            "publisher",
            "country",
            "wos_core_collection",
            "additional_wos_indexes",
        ]


class UnifiedCrawlRequestSerializer(serializers.Serializer):
    # SCImago
    scimago_start_url = serializers.URLField(default="https://www.scimagojr.com/journalrank.php")
    scimago_years = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_null=True,
        help_text="Danh sách năm cần cào (trống = toàn bộ từ 1999)"
    )
    scimago_workers = serializers.IntegerField(default=5, min_value=1, max_value=20)
    scimago_delay   = serializers.FloatField(default=1.0, min_value=0.1, max_value=10.0)

    # Clarivate
    clarivate_start_url = serializers.URLField(default="https://mjl.clarivate.com/api/mjl/jprof/public/rank-search")
    clarivate_max_pages = serializers.IntegerField(required=False, allow_null=True,
        help_text="Giới hạn trang (trống = tất cả)")
    clarivate_workers   = serializers.IntegerField(default=3, min_value=1, max_value=10)
    clarivate_delay     = serializers.FloatField(default=1.5, min_value=0.1, max_value=10.0)

    # BioxBio
    bioxbio_start_url = serializers.URLField(default="https://www.bioxbio.com/journal/")
    bioxbio_max_pages = serializers.IntegerField(required=False, allow_null=True,
        help_text="Giới hạn trang (trống = tất cả)")
    bioxbio_workers   = serializers.IntegerField(default=10, min_value=1, max_value=30)
    bioxbio_delay     = serializers.FloatField(default=2.0, min_value=0.1, max_value=10.0)





