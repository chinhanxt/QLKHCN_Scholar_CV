"""
Adaptive Jitter Rate-Limiter Engine for Google Scholar Scraper.

Monitors HTTP status code responses over a rolling 5-minute window stored in Redis.
Dynamically adjusts backoff delay based on error rates (429, 403, 302, etc.) and
applies random jitter to prevent synchronized retry spikes.
"""

import logging
import random
import time
from typing import List, Tuple

from django.core.cache import cache
from apps.scholar.models import AntiBlockConfig

logger = logging.getLogger(__name__)

REDIS_HISTORY_KEY = "scholar_rate_limit_history"
WINDOW_SECONDS = 300  # 5 minutes rolling window
BLOCKING_STATUS_CODES = {302, 403, 429, 500, 502, 503, 504}


def record_request_status(status_code: int) -> None:
    """
    Records an HTTP response status code to the rolling rate limit history in Redis cache
    and increments the total request count in AntiBlockConfig.

    Args:
        status_code (int): HTTP response status code (e.g., 200, 429, 403, 302).
    """
    # 1. Increment total requests count in AntiBlockConfig singleton
    config = AntiBlockConfig.get_solo()
    config.total_requests_count += 1
    config.save(update_fields=["total_requests_count"])

    # 2. Store timestamped status entry in Redis cache
    now = time.time()
    raw_history: List[Tuple[float, int]] = cache.get(REDIS_HISTORY_KEY, [])

    # Filter entries older than WINDOW_SECONDS
    cutoff = now - WINDOW_SECONDS
    history = [entry for entry in raw_history if entry[0] >= cutoff]

    # Append new entry: (timestamp, status_code)
    history.append((now, status_code))

    # Save back to Redis cache with 300s TTL
    cache.set(REDIS_HISTORY_KEY, history, timeout=WINDOW_SECONDS)
    logger.debug("Recorded request status %d. Rolling history count: %d", status_code, len(history))


def compute_adaptive_delay() -> float:
    """
    Calculates the adaptive delay (in seconds) using error ratio over a rolling 5-minute window.
    Scales base_delay_seconds up to max_delay_seconds based on AntiBlockConfig settings
    and adds random jitter.

    Returns:
        float: Computed delay in seconds.
    """
    config = AntiBlockConfig.get_solo()
    base_delay = config.base_delay_seconds
    max_delay = config.max_delay_seconds

    if not config.adaptive_backoff_enabled:
        target_delay = base_delay
    else:
        now = time.time()
        raw_history: List[Tuple[float, int]] = cache.get(REDIS_HISTORY_KEY, [])
        cutoff = now - WINDOW_SECONDS
        history = [entry for entry in raw_history if entry[0] >= cutoff]

        if not history:
            error_ratio = 0.0
        else:
            error_count = sum(1 for _, status in history if status in BLOCKING_STATUS_CODES or status >= 400)
            error_ratio = error_count / len(history)

        target_delay = base_delay + (max_delay - base_delay) * error_ratio

    # Apply random jitter (e.g. multiplier between 0.85 and 1.15)
    jitter_factor = random.uniform(0.85, 1.15)
    delay = target_delay * jitter_factor

    # Ensure delay is clamped between base_delay * 0.8 and max_delay
    min_allowed = base_delay * 0.8
    clamped_delay = max(min_allowed, min(delay, max_delay))

    logger.debug(
        "Computed adaptive delay: %.2fs (target: %.2fs, base: %.2fs, max: %.2fs)",
        clamped_delay,
        target_delay,
        base_delay,
        max_delay,
    )
    return clamped_delay
