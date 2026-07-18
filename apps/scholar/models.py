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
    citedby = models.IntegerField(_("Total Citations"), default=0)
    hindex = models.IntegerField(_("H-Index"), default=0)
    i10index = models.IntegerField(_("i10-Index"), default=0)
    interests = models.JSONField(_("Interests"), default=list, blank=True)
    
    class Meta:
        db_table = "scholar_authors"
        verbose_name = _("Author Profile")
        verbose_name_plural = _("Author Profiles")
        ordering = ["name"]

    def __str__(self):
        return self.name


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

    class Meta:
        db_table = "scholar_publications"
        verbose_name = _("Publication")
        verbose_name_plural = _("Publications")
        ordering = ["display_order", "-year"]

    def __str__(self):
        return self.title
