"""Google CAPTCHA solver module integrating 2Captcha API for handling anti-bot challenges."""

import logging
import re
import time
import requests
from django.utils.translation import gettext_lazy as _

from apps.scholar.models import AntiBlockConfig

logger = logging.getLogger(__name__)


def is_captcha_response(status_code: int, html_text: str, response_url: str) -> bool:
    """Detect if a response from Google Scholar contains a CAPTCHA challenge."""
    if status_code in (302, 429) and "/sorry/index" in response_url:
        return True
    if "g-recaptcha" in html_text or "captcha-form" in html_text or "data-sitekey" in html_text:
        return True
    return False


def extract_sitekey(html_text: str) -> str:
    """Extract reCAPTCHA sitekey from Google Scholar CAPTCHA page HTML."""
    match = re.search(r'data-sitekey=["\']([^"\']+)["\']', html_text)
    if match:
        return match.group(1)
    return "6LfwuzsUAAAAABc123"


def solve_google_captcha(page_url: str, sitekey: str) -> str | None:
    """Solve Google CAPTCHA using the configured third-party solver service (e.g. 2Captcha)."""
    config = AntiBlockConfig.get_solo()
    if not config.enable_captcha_solver or not config.captcha_api_key.strip():
        logger.warning(_("CAPTCHA Solver disabled or missing API key."))
        return None

    config.captcha_encountered_count += 1
    config.save(update_fields=["captcha_encountered_count"])

    api_key = config.captcha_api_key.strip()
    provider = config.captcha_provider

    if provider == "2captcha":
        try:
            req_url = (
                f"http://2captcha.com/in.php?key={api_key}"
                f"&method=userrecaptcha&googlekey={sitekey}&pageurl={page_url}&json=1"
            )
            r = requests.get(req_url, timeout=10).json()
            if r.get("status") != 1:
                logger.error(_("2Captcha request error: %s"), r.get("request"))
                return None

            request_id = r.get("request")
            res_url = f"http://2captcha.com/res.php?key={api_key}&action=get&id={request_id}&json=1"

            for attempt in range(12):
                time.sleep(5)
                res = requests.get(res_url, timeout=10).json()
                if res.get("status") == 1:
                    token = res.get("request")
                    config.captcha_solved_count += 1
                    config.save(update_fields=["captcha_solved_count"])
                    logger.info(_("2Captcha solved successfully."))
                    return token
                if res.get("request") != "CAPCHA_NOT_READY":
                    logger.error(_("2Captcha error during polling: %s"), res.get("request"))
                    break
        except Exception as e:
            logger.error(_("Failed to communicate with 2Captcha API: %s"), e)

    return None
