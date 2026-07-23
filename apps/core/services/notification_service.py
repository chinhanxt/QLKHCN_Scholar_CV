import logging
import threading
from typing import Any

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.template.loader import render_to_string
from django.utils.html import strip_tags

from apps.core.models import Notification, NotificationCategory, NotificationType

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for creating in-app notifications and sending HTML emails asynchronously."""

    @staticmethod
    def send_email_async(
        subject: str,
        recipient_list: list[str] | str,
        template_name: str,
        context: dict[str, Any] | None = None,
        async_email: bool = True,
        from_email: str | None = None,
    ) -> None:
        """Send an HTML email. If async_email is True, sends via a background daemon thread."""
        if isinstance(recipient_list, str):
            recipient_list = [recipient_list]

        if not recipient_list:
            logger.warning("No recipients specified for email: %s", subject)
            return

        if context is None:
            context = {}

        from_email = from_email or getattr(settings, "DEFAULT_FROM_EMAIL", "webmaster@localhost")

        def _dispatch_email():
            from django.db import close_old_connections
            close_old_connections()

            try:
                host = "smtp.gmail.com"
                port = 587
                user = getattr(settings, "EMAIL_HOST_USER", "")
                password = getattr(settings, "EMAIL_HOST_PASSWORD", "")
                use_tls = True
                sender = from_email or getattr(settings, "DEFAULT_FROM_EMAIL", "Edu Ecosystem <noreply@example.com>")

                try:
                    from apps.scholar.models import AutoScanConfig
                    cfg = AutoScanConfig.get_solo()
                    if cfg.email_host:
                        host = cfg.email_host
                    if cfg.email_port:
                        port = cfg.email_port
                    if cfg.email_host_user:
                        user = cfg.email_host_user
                    if cfg.email_host_password:
                        password = cfg.email_host_password.strip()
                    if cfg.default_from_email:
                        sender = cfg.default_from_email
                except Exception:
                    pass

                if user and ("<" not in sender and "@" not in sender):
                    sender = f"{sender} <{user}>"

                if user and password and getattr(settings, "EMAIL_BACKEND", "") != "django.core.mail.backends.locmem.EmailBackend":
                    conn = get_connection(
                        backend="django.core.mail.backends.smtp.EmailBackend",
                        host=host,
                        port=port,
                        username=user,
                        password=password,
                        use_tls=use_tls,
                        timeout=10,
                    )
                else:
                    conn = get_connection()

                html_content = render_to_string(template_name, context)
                text_content = strip_tags(html_content)
                email = EmailMultiAlternatives(
                    subject=subject,
                    body=text_content,
                    from_email=sender,
                    to=recipient_list,
                    connection=conn,
                )
                email.attach_alternative(html_content, "text/html")
                email.send(fail_silently=False)
                logger.info("Email sent successfully to %s via %s:%s", recipient_list, host, port)
            except Exception as e:
                logger.error("Failed to send email to %s: %s", recipient_list, e, exc_info=True)
                if not async_email:
                    raise e
            finally:
                close_old_connections()

        if async_email:
            thread = threading.Thread(target=_dispatch_email, daemon=True)
            thread.start()
        else:
            _dispatch_email()

    @classmethod
    def notify_user_profile_approved(
        cls,
        user: Any,
        scholar_id: str,
        synced_count: int,
        total_citations: int,
        h_index: int,
        async_email: bool = True,
    ) -> Notification:
        """Create a profile approved notification and send confirmation email."""
        title = "Hồ sơ Google Scholar đã được phê duyệt"
        message = (
            f"Hồ sơ Google Scholar ({scholar_id}) của bạn đã được phê duyệt. "
            f"Đã đồng bộ {synced_count} bài báo, {total_citations} trích dẫn, H-index: {h_index}."
        )
        metadata = {
            "scholar_id": scholar_id,
            "synced_count": synced_count,
            "total_citations": total_citations,
            "h_index": h_index,
        }

        notification = Notification.objects.create(
            user=user,
            title=title,
            message=message,
            notification_type=NotificationType.PROFILE_APPROVED,
            category=NotificationCategory.SCHOLAR,
            metadata=metadata,
        )

        if user.email:
            context = {
                "user": user,
                "scholar_id": scholar_id,
                "synced_count": synced_count,
                "total_citations": total_citations,
                "h_index": h_index,
            }
            cls.send_email_async(
                subject=f"[QLKHCN] {title}",
                recipient_list=[user.email],
                template_name="emails/profile_approved.html",
                context=context,
                async_email=async_email,
            )

        return notification

    @classmethod
    def notify_user_new_publications(
        cls,
        user: Any,
        new_count: int,
        total_pubs: int,
        new_titles: list[str] | None = None,
        async_email: bool = True,
    ) -> Notification:
        """Create a new publications detected notification and send alert email."""
        new_titles = new_titles or []
        title = f"Phát hiện {new_count} bài báo khoa học mới"
        message = (
            f"Hệ thống đã phát hiện {new_count} bài báo khoa học mới thuộc hồ sơ của bạn. "
            f"Tổng số bài báo: {total_pubs}."
        )
        metadata = {
            "new_count": new_count,
            "total_pubs": total_pubs,
            "new_titles": new_titles,
        }

        notification = Notification.objects.create(
            user=user,
            title=title,
            message=message,
            notification_type=NotificationType.NEW_PUBLICATIONS_DETECTED,
            category=NotificationCategory.SCHOLAR,
            metadata=metadata,
        )

        if user.email:
            context = {
                "user": user,
                "new_count": new_count,
                "total_pubs": total_pubs,
                "new_titles": new_titles,
            }
            cls.send_email_async(
                subject=f"[QLKHCN] {title}",
                recipient_list=[user.email],
                template_name="emails/new_publications.html",
                context=context,
                async_email=async_email,
            )

        return notification

    @classmethod
    def send_test_email(cls, recipient_email: str, smtp_override: dict[str, Any] | None = None) -> None:
        """Send a test email to verify SMTP configuration."""
        from django.utils import timezone
        cls.send_email_async(
            subject="[Edu Ecosystem] Thư thử nghiệm cấu hình Email SMTP",
            recipient_list=[recipient_email],
            template_name="emails/test_email.html",
            context={"timestamp": str(timezone.now()), "user_email": recipient_email},
            async_email=False,
        )
