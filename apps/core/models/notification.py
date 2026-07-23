from django.db import models
from django.utils.translation import gettext_lazy as _

from .base import BaseModel


class NotificationType(models.TextChoices):
    """Enumeration of system notification types."""

    PROFILE_APPROVED = "PROFILE_APPROVED", _("Hồ sơ đã phê duyệt")
    NEW_PUBLICATIONS_DETECTED = "NEW_PUBLICATIONS_DETECTED", _("Phát hiện bài báo mới")
    METRICS_UPDATED = "METRICS_UPDATED", _("Cập nhật chỉ số trích dẫn")
    SYSTEM_NOTICE = "SYSTEM_NOTICE", _("Thông báo hệ thống")


class NotificationCategory(models.TextChoices):
    """Enumeration of notification categories."""

    PERSONAL = "PERSONAL", _("Cá nhân")
    SCHOLAR = "SCHOLAR", _("Bài báo & Đề tài")
    SYSTEM = "SYSTEM", _("Hệ thống")


class Notification(BaseModel):
    """Model representing user notifications in the system."""

    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="notifications",
        verbose_name=_("User"),
    )
    title = models.CharField(_("Title"), max_length=255)
    message = models.TextField(_("Message"))
    notification_type = models.CharField(
        _("Notification Type"),
        max_length=50,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM_NOTICE,
        db_index=True,
    )
    category = models.CharField(
        _("Category"),
        max_length=30,
        choices=NotificationCategory.choices,
        default=NotificationCategory.SCHOLAR,
        db_index=True,
    )
    metadata = models.JSONField(
        _("Metadata"),
        default=dict,
        blank=True,
        help_text=_("Extra contextual data e.g. new_count, total_pubs, scholar_id"),
    )
    link = models.CharField(_("Target Link"), max_length=500, default="", blank=True)
    is_read = models.BooleanField(_("Is Read"), default=False, db_index=True)

    class Meta:
        db_table = "user_notifications"
        ordering = ["-created_at"]
        verbose_name = _("Notification")
        verbose_name_plural = _("Notifications")
        indexes = [
            models.Index(fields=["user", "is_read", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"Notification({self.user.email} - {self.title})"

