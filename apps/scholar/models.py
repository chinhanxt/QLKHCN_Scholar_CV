from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.core.models.base import BaseModel

# ==============================================================================
# 1. RAW CRAWLER STAGING MODELS (To support updating crawlers in Web environment)
# ==============================================================================

# --- CLARIVATE (Web of Science) ---
class ClarivateJournal(BaseModel):
    publication_id = models.IntegerField(_("Publication ID"), unique=True)
    title = models.CharField(_("Clarivate Title"), max_length=1000)
    title_normalized = models.CharField(_("Normalized Title"), max_length=1000, db_index=True)
    issn = models.CharField(_("ISSN"), max_length=50, blank=True, null=True)
    eissn = models.CharField(_("eISSN"), max_length=50, blank=True, null=True)
    publisher = models.TextField(_("Publisher"), blank=True, null=True)
    country = models.CharField(_("Country"), max_length=250, blank=True, null=True)
    wos_core_collection = models.TextField(_("WoS Core Collection"), blank=True, null=True)
    additional_wos_indexes = models.TextField(_("Additional WoS Indexes"), blank=True, null=True)

    class Meta:
        db_table = "scholar_raw_clarivate_journals"
        ordering = ["title"]

    def __str__(self):
        return self.title


class ClarivateCrawlerProgress(BaseModel):
    page = models.IntegerField(_("Page Number"), unique=True)
    is_completed = models.BooleanField(_("Is Completed"), default=False)

    class Meta:
        db_table = "scholar_raw_clarivate_progress"


# --- SCIMAGO (SJR) ---
class ScimagoJournal(BaseModel):
    source_id = models.BigIntegerField(_("Source ID"), unique=True) # SCImago system ID
    title = models.CharField(_("SCImago Title"), max_length=1000)
    title_normalized = models.CharField(_("Normalized Title"), max_length=1000, db_index=True)
    journal_type = models.CharField(_("Journal Type"), max_length=100, blank=True, null=True)
    publisher = models.TextField(_("Publisher"), blank=True, null=True)
    country = models.CharField(_("Country"), max_length=250, blank=True, null=True)

    class Meta:
        db_table = "scholar_raw_scimago_journals"
        ordering = ["title"]

    def __str__(self):
        return self.title


class ScimagoISSN(BaseModel):
    journal = models.ForeignKey(ScimagoJournal, on_delete=models.CASCADE, related_name="raw_issns")
    issn = models.CharField(_("ISSN"), max_length=50, unique=True, db_index=True)

    class Meta:
        db_table = "scholar_raw_scimago_issns"


class ScimagoRanking(BaseModel):
    journal = models.ForeignKey(ScimagoJournal, on_delete=models.CASCADE, related_name="raw_rankings")
    year = models.IntegerField(_("Year"))
    sjr_score = models.FloatField(_("SJR Score"), blank=True, null=True)
    sjr_quartile = models.CharField(_("SJR Quartile"), max_length=10, blank=True, null=True)
    h_index = models.IntegerField(_("H-Index"), blank=True, null=True)

    class Meta:
        db_table = "scholar_raw_scimago_rankings"
        unique_together = ("journal", "year")
        ordering = ["-year"]


# --- BIOXBIO (Impact Factor) ---
class BioxbioJournal(BaseModel):
    source_id = models.IntegerField(_("Source ID"), unique=True, blank=True, null=True)
    title = models.CharField(_("BioxBio Title"), max_length=1000)
    title_normalized = models.CharField(_("Normalized Title"), max_length=1000, unique=True, db_index=True)

    class Meta:
        db_table = "scholar_raw_bioxbio_journals"
        ordering = ["title"]

    def __str__(self):
        return self.title


class BioxbioISSN(BaseModel):
    journal = models.ForeignKey(BioxbioJournal, on_delete=models.CASCADE, related_name="raw_issns")
    issn = models.CharField(_("ISSN"), max_length=50, unique=True, db_index=True)

    class Meta:
        db_table = "scholar_raw_bioxbio_issns"


class BioxbioRanking(BaseModel):
    journal = models.ForeignKey(BioxbioJournal, on_delete=models.CASCADE, related_name="raw_rankings")
    year = models.IntegerField(_("Year"))
    impact_factor = models.FloatField(_("Impact Factor"), blank=True, null=True)
    total_articles = models.IntegerField(_("Total Articles"), blank=True, null=True)
    total_cites = models.IntegerField(_("Total Citations"), blank=True, null=True)

    class Meta:
        db_table = "scholar_raw_bioxbio_rankings"
        unique_together = ("journal", "year")
        ordering = ["-year"]


class BioxbioCrawlerProgress(BaseModel):
    subject = models.CharField(_("Subject Category"), max_length=250, unique=True)
    last_completed_page = models.IntegerField(_("Last Completed Page"), default=0)
    is_completed = models.BooleanField(_("Is Completed"), default=False)

    class Meta:
        db_table = "scholar_raw_bioxbio_progress"


# ==============================================================================
# 2. INTEGRATED MASTER JOURNAL DATABASE (Clarivate Mapped)
# ==============================================================================

class Journal(BaseModel):
    """
    Unified Journal model combining Clarivate (Web of Science Core),
    SCImago (SJR, Quartile), and BioxBio (Impact Factor).
    """
    clarivate_title = models.CharField(_("Clarivate Title"), max_length=1000, blank=True, null=True)
    title_normalized = models.CharField(_("Normalized Title"), max_length=1000, db_index=True)
    is_staging = models.BooleanField(_("Is Staging"), default=False, db_index=True)
    issn = models.CharField(_("ISSN"), max_length=50, blank=True, null=True)
    eissn = models.CharField(_("eISSN"), max_length=50, blank=True, null=True)
    publisher = models.TextField(_("Publisher"), blank=True, null=True)
    country = models.CharField(_("Country"), max_length=250, blank=True, null=True)
    
    # Web of Science Details
    wos_core_collection = models.TextField(_("WoS Core Collection"), blank=True, null=True)
    additional_wos_indexes = models.TextField(_("Additional WoS Indexes"), blank=True, null=True)

    # Integrated Latest Metrics
    latest_if = models.FloatField(_("Latest Impact Factor"), blank=True, null=True)
    latest_if_year = models.IntegerField(_("Latest IF Year"), blank=True, null=True)
    latest_sjr = models.FloatField(_("Latest SJR Score"), blank=True, null=True)
    latest_sjr_year = models.IntegerField(_("Latest SJR Year"), blank=True, null=True)
    latest_quartile = models.CharField(_("Latest Quartile"), max_length=10, blank=True, null=True) # Q1, Q2, Q3, Q4
    latest_h_index = models.IntegerField(_("Latest H-Index"), blank=True, null=True)

    # Integrated mapping references
    bioxbio_match = models.CharField(_("BioxBio Match Method"), max_length=20, blank=True, null=True)
    bioxbio_journal = models.ForeignKey(BioxbioJournal, on_delete=models.SET_NULL, null=True, blank=True, related_name="mapped_journals")

    scimago_match = models.CharField(_("SCImago Match Method"), max_length=20, blank=True, null=True)
    scimago_journal = models.ForeignKey(ScimagoJournal, on_delete=models.SET_NULL, null=True, blank=True, related_name="mapped_journals")

    class Meta:
        db_table = "scholar_journals"
        verbose_name = _("Journal")
        verbose_name_plural = _("Journals")
        ordering = ["clarivate_title", "title_normalized"]

    def __str__(self):
        return self.clarivate_title or self.title_normalized


class JournalISSN(BaseModel):
    journal = models.ForeignKey(Journal, on_delete=models.CASCADE, related_name="issns", verbose_name=_("Journal"))
    issn = models.CharField(_("ISSN"), max_length=50, unique=True, db_index=True)

    class Meta:
        db_table = "scholar_journal_issns"
        verbose_name = _("Journal ISSN")
        verbose_name_plural = _("Journal ISSNs")


class JournalRanking(BaseModel):
    journal = models.ForeignKey(Journal, on_delete=models.CASCADE, related_name="rankings", verbose_name=_("Journal"))
    year = models.IntegerField(_("Year"))
    impact_factor = models.FloatField(_("Impact Factor"), blank=True, null=True)
    sjr_score = models.FloatField(_("SJR Score"), blank=True, null=True)
    sjr_quartile = models.CharField(_("SJR Quartile"), max_length=10, blank=True, null=True)
    h_index = models.IntegerField(_("Journal H-Index"), blank=True, null=True)

    class Meta:
        db_table = "scholar_journal_rankings"
        unique_together = ("journal", "year")
        ordering = ["-year"]
        verbose_name = _("Journal Ranking")
        verbose_name_plural = _("Journal Rankings")


# ==============================================================================
# 3. SAVED PROFILES DATABASE (Authors & Publications)
# ==============================================================================

class AuthorProfile(BaseModel):
    scholar_id = models.CharField(_("Scholar ID"), max_length=50, unique=True, db_index=True)
    name = models.CharField(_("Full Name"), max_length=250)
    affiliation = models.CharField(_("Affiliation"), max_length=500, blank=True, null=True)
    email_domain = models.CharField(_("Email Domain"), max_length=250, blank=True, null=True)
    citedby = models.IntegerField(_("Total Citations"), default=0)
    hindex = models.IntegerField(_("H-Index"), default=0)
    i10index = models.IntegerField(_("i10-Index"), default=0)
    interests = models.JSONField(_("Interests"), default=list, blank=True)
    
    auto_scan_enabled = models.BooleanField(_("Auto Scan Enabled"), default=True)
    last_scraped_at = models.DateTimeField(_("Last Scraped At"), null=True, blank=True)
    last_scan_status = models.CharField(_("Last Scan Status"), max_length=50, default="PENDING")
    publication_count_cached = models.IntegerField(_("Publication Count Cached"), default=0)

    class Meta:
        db_table = "scholar_authors"
        verbose_name = _("Author Profile")
        verbose_name_plural = _("Author Profiles")
        ordering = ["name"]

    def __str__(self):
        return self.name


class AutoScanConfig(models.Model):
    is_active = models.BooleanField(_("Is Active"), default=True)
    scan_interval_hours = models.IntegerField(_("Scan Interval Hours"), default=168)
    frequency_type = models.CharField(_("Frequency Type"), max_length=20, default="WEEKLY")  # DAILY, WEEKLY, MONTHLY
    preferred_hour = models.IntegerField(_("Preferred Hour"), default=2)  # 0-23 (e.g. 2:00 AM)
    preferred_minute = models.IntegerField(_("Preferred Minute"), default=0)
    preferred_weekday = models.IntegerField(_("Preferred Weekday"), default=0)  # 0=Mon, 1=Tue, ..., 6=Sun
    preferred_day_of_month = models.IntegerField(_("Preferred Day of Month"), default=1)  # 1-31
    batch_size_per_hour = models.IntegerField(_("Batch Size Per Hour"), default=8)
    delay_min_seconds = models.IntegerField(_("Delay Min Seconds"), default=8)
    delay_max_seconds = models.IntegerField(_("Delay Max Seconds"), default=15)
    cooldown_min_seconds = models.IntegerField(_("Cooldown Min Seconds"), default=45)
    cooldown_max_seconds = models.IntegerField(_("Cooldown Max Seconds"), default=90)
    current_job_status = models.CharField(_("Current Job Status"), max_length=50, default="IDLE")  # IDLE, RUNNING, COMPLETED, FAILED
    current_job_progress = models.IntegerField(_("Current Job Progress"), default=0)
    current_job_detail = models.CharField(_("Current Job Detail"), max_length=255, default="", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "scholar_auto_scan_config"
        verbose_name = _("Auto Scan Config")
        verbose_name_plural = _("Auto Scan Configs")

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj



class Publication(BaseModel):
    author = models.ForeignKey(AuthorProfile, on_delete=models.CASCADE, related_name="publications", verbose_name=_("Author"))
    title = models.TextField(_("Title"))
    authors_list = models.TextField(_("Authors List"), blank=True, null=True)
    venue = models.TextField(_("Venue/Journal"), blank=True, null=True)
    year = models.CharField(_("Year"), max_length=50, blank=True, null=True)
    citations = models.IntegerField(_("Citations Count"), default=0)
    display_order = models.IntegerField(_("Display Order"), default=0)
    cites_per_year = models.JSONField(_("Citations Per Year History"), default=dict, blank=True)

    # Matched journal values
    journal = models.ForeignKey(Journal, on_delete=models.SET_NULL, null=True, blank=True, related_name="publications", verbose_name=_("Matched Journal"))
    sjr_q = models.CharField(_("Matched SJR Quartile"), max_length=10, default="N/A")
    if_val = models.CharField(_("Matched Impact Factor"), max_length=20, default="N/A")
    wos = models.CharField(_("Matched Web of Science"), max_length=150, default="N/A")

    # Scraped metadata fields matching Google Scholar exactly
    pub_date = models.CharField(_("Publication Date"), max_length=150, blank=True, null=True)
    volume = models.CharField(_("Volume"), max_length=150, blank=True, null=True)
    issue = models.CharField(_("Issue"), max_length=150, blank=True, null=True)
    pages = models.CharField(_("Pages"), max_length=150, blank=True, null=True)
    publisher = models.CharField(_("Publisher"), max_length=500, blank=True, null=True)
    description = models.TextField(_("Description"), blank=True, null=True)
    pub_url = models.URLField(_("Publication URL"), max_length=2000, blank=True, null=True)
    eprint_url = models.URLField(_("Eprint PDF URL"), max_length=2000, blank=True, null=True)
    url_related_articles = models.CharField(_("Related Articles URL"), max_length=2000, blank=True, null=True)
    versions_count = models.CharField(_("Versions Count"), max_length=150, blank=True, null=True)
    url_all_versions = models.CharField(_("All Versions URL"), max_length=2000, blank=True, null=True)
    cites_id = models.CharField(_("Scholar Cites ID"), max_length=100, blank=True, null=True)
    url_scholar_article = models.CharField(_("Scholar Article Link"), max_length=2000, blank=True, null=True)

    class Meta:
        db_table = "scholar_publications"
        verbose_name = _("Publication")
        verbose_name_plural = _("Publications")
        ordering = ["display_order", "-year"]

    def __str__(self):
        return self.title


class CrawlHistory(BaseModel):
    task_id = models.CharField(_("Celery Task ID"), max_length=255, unique=True)
    completed_at = models.DateTimeField(_("Completed At"), null=True, blank=True)
    status = models.CharField(_("Status"), max_length=50, default='PENDING')
    is_automated = models.BooleanField(_("Is Automated"), default=False)
    
    clarivate_count = models.IntegerField(_("Clarivate Scraped"), default=0)
    scimago_count = models.IntegerField(_("SCImago Scraped"), default=0)
    bioxbio_count = models.IntegerField(_("BioxBio Scraped"), default=0)
    mapped_count = models.IntegerField(_("Mapped Journals"), default=0)
    
    clarivate_total = models.IntegerField(_("Clarivate Total"), default=0)
    scimago_total = models.IntegerField(_("SCImago Total"), default=0)
    bioxbio_total = models.IntegerField(_("BioxBio Total"), default=0)
    mapped_total = models.IntegerField(_("Mapped Total"), default=0)
    
    log_output = models.TextField(_("Console Log Output"), blank=True, default="")
    error_message = models.TextField(_("Error Message"), null=True, blank=True)

    class Meta:
        db_table = "scholar_crawl_history"
        verbose_name = _("Crawl History")
        verbose_name_plural = _("Crawl Histories")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.task_id} - {self.status}"
