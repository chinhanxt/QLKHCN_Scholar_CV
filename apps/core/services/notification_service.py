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
        smtp_override: dict[str, Any] | None = None,
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

        if smtp_override is None:
            smtp_override = {}

        try:
            from apps.scholar.models import AutoScanConfig
            cfg = AutoScanConfig.get_solo()
            if cfg.email_host and "email_host" not in smtp_override and "EMAIL_HOST" not in smtp_override:
                smtp_override["EMAIL_HOST"] = cfg.email_host
            if cfg.email_port and "email_port" not in smtp_override and "EMAIL_PORT" not in smtp_override:
                smtp_override["EMAIL_PORT"] = cfg.email_port
            if cfg.email_host_user and "email_host_user" not in smtp_override and "EMAIL_HOST_USER" not in smtp_override:
                smtp_override["EMAIL_HOST_USER"] = cfg.email_host_user
            if cfg.email_host_password and "email_host_password" not in smtp_override and "EMAIL_HOST_PASSWORD" not in smtp_override:
                smtp_override["EMAIL_HOST_PASSWORD"] = cfg.email_host_password.strip()
            if cfg.default_from_email and "default_from_email" not in smtp_override and "DEFAULT_FROM_EMAIL" not in smtp_override:
                smtp_override["DEFAULT_FROM_EMAIL"] = cfg.default_from_email
            if "email_use_tls" not in smtp_override and "EMAIL_USE_TLS" not in smtp_override:
                smtp_override["EMAIL_USE_TLS"] = cfg.email_use_tls
        except Exception as e:
            logger.warning("Could not pre-fetch AutoScanConfig for email: %s", e)

        def _dispatch_email():
            if async_email:
                from django.db import close_old_connections
                close_old_connections()

            try:
                host = smtp_override.get("EMAIL_HOST") or smtp_override.get("email_host") or getattr(settings, "EMAIL_HOST", "smtp.gmail.com")
                port = int(smtp_override.get("EMAIL_PORT") or smtp_override.get("email_port") or getattr(settings, "EMAIL_PORT", 587))
                user = smtp_override.get("EMAIL_HOST_USER") or smtp_override.get("email_host_user") or getattr(settings, "EMAIL_HOST_USER", "")
                pwd_val = smtp_override.get("EMAIL_HOST_PASSWORD") or smtp_override.get("email_host_password") or getattr(settings, "EMAIL_HOST_PASSWORD", "")
                password = pwd_val.strip() if pwd_val else ""
                sender = smtp_override.get("DEFAULT_FROM_EMAIL") or smtp_override.get("default_from_email") or from_email or getattr(settings, "DEFAULT_FROM_EMAIL", "Scholar ☑️")
                
                use_tls = True
                if "EMAIL_USE_TLS" in smtp_override or "email_use_tls" in smtp_override:
                    use_tls = bool(smtp_override.get("EMAIL_USE_TLS", smtp_override.get("email_use_tls")))

                use_ssl = False
                if port == 465:
                    use_tls = False
                    use_ssl = True

                display_name = "Scholar ☑️"
                if sender:
                    if "<" in sender:
                        extracted = sender.split("<")[0].strip().strip('"').strip("'")
                        if extracted:
                            display_name = extracted
                    elif "@" in sender and " " not in sender:
                        pass
                    else:
                        display_name = sender.strip()

                if user:
                    sender = f"{display_name} <{user.strip()}>"
                else:
                    sender = f"{display_name} <noreply@example.com>"

                headers = {
                    "Auto-Submitted": "auto-generated",
                    "X-Auto-Response-Suppress": "All",
                    "X-Mailer": "EduEcosystem-Scholar-CV",
                }
                if user:
                    headers["Reply-To"] = user

                is_locmem = getattr(settings, "EMAIL_BACKEND", "") == "django.core.mail.backends.locmem.EmailBackend"
                if is_locmem:
                    conn = get_connection()
                elif user and password:
                    conn = get_connection(
                        backend="django.core.mail.backends.smtp.EmailBackend",
                        host=host,
                        port=port,
                        username=user,
                        password=password,
                        use_tls=use_tls,
                        use_ssl=use_ssl,
                        timeout=10,
                    )
                else:
                    missing = []
                    if not user:
                        missing.append("Tài khoản Email gửi")
                    if not password:
                        missing.append("Mật khẩu ứng dụng (App Password)")
                    err_msg = f"Chưa cấu hình {', '.join(missing)}. Vui lòng nhập và Lưu cấu hình SMTP trong Cài đặt."
                    logger.error(err_msg)
                    if not async_email:
                        raise ValueError(err_msg)
                    return

                final_subject = subject
                html_content = ""
                try:
                    from apps.scholar.models import EmailTemplate
                    tpl_obj = EmailTemplate.objects.filter(template_key=template_name, is_active=True).first()
                    if tpl_obj and tpl_obj.html_content:
                        from django.template import Template as DjangoTemplate, Context
                        html_content = DjangoTemplate(tpl_obj.html_content).render(Context(context))
                        if tpl_obj.subject and not context.get("keep_original_subject"):
                            final_subject = DjangoTemplate(tpl_obj.subject).render(Context(context))
                except Exception as tpl_err:
                    logger.warning("Could not render custom DB EmailTemplate for %s: %s", template_name, tpl_err)

                if not html_content:
                    html_content = render_to_string(template_name, context)
                text_content = strip_tags(html_content)
                email = EmailMultiAlternatives(
                    subject=final_subject,
                    body=text_content,
                    from_email=sender,
                    to=recipient_list,
                    headers=headers,
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
                if async_email:
                    from django.db import close_old_connections
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
        synced_count: int = 0,
        total_citations: int = 0,
        h_index: int = 0,
        async_email: bool = True,
    ) -> Notification:
        """Create a profile approved notification and send confirmation email."""
        if not synced_count or synced_count == 0:
            try:
                from apps.scholar.models import ScholarPublication
                synced_count = ScholarPublication.objects.filter(profile__user=user).count()
            except Exception:
                pass

        if not total_citations or not h_index:
            try:
                from apps.scholar.models import ScholarProfile
                prof = ScholarProfile.objects.filter(user=user).first()
                if prof:
                    total_citations = total_citations or prof.total_citations or 0
                    h_index = h_index or prof.h_index or 0
            except Exception:
                pass

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
                "keep_original_subject": True,
            }
            cls.send_email_async(
                subject=f"Thông báo: {title}",
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
        new_count: int = 1,
        total_pubs: int = 0,
        new_titles: list[str] | None = None,
        async_email: bool = True,
    ) -> Notification:
        """Create a new publications detected notification and send alert email."""
        new_titles = new_titles or []
        if not total_pubs or total_pubs == 0:
            try:
                from apps.scholar.models import ScholarPublication
                total_pubs = ScholarPublication.objects.filter(profile__user=user).count()
            except Exception:
                pass

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
                "keep_original_subject": True,
            }
            cls.send_email_async(
                subject=f"Thông báo: {title}",
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
        import uuid
        now_local = timezone.localtime()
        now_str = now_local.strftime("%H:%M:%S")
        code = str(uuid.uuid4())[:4].upper()
        subject = f"[Edu Ecosystem] Xác nhận Email SMTP - {now_str} (#{code})"

        cls.send_email_async(
            subject=subject,
            recipient_list=[recipient_email],
            template_name="emails/test_email.html",
            context={"timestamp": now_local.strftime("%d/%m/%Y %H:%M:%S"), "user_email": recipient_email},
            async_email=False,
            smtp_override=smtp_override,
        )
