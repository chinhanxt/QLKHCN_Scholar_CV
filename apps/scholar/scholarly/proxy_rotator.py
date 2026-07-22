"""
Multi-Channel Dynamic Proxy Rotator module for Google Scholar scraper.
Provides prioritized selection across:
  1. Custom proxy list (user configured)
  2. Docker Tor SOCKS5 Proxy Gateway
  3. Free Public Proxy Pool cached in Redis
"""

import random
import logging
from typing import Optional, Dict

from django.core.cache import cache
from apps.scholar.models import AntiBlockConfig
from apps.scholar.scholarly import tor_helper

logger = logging.getLogger(__name__)

REDIS_FREE_PROXIES_KEY = "scholar_free_proxies"


def get_next_proxy() -> Optional[Dict[str, str]]:
    """
    Selects and returns the next proxy dictionary for requests library, based on priority settings:
    Priority 1: User-entered custom proxy list in AntiBlockConfig
    Priority 2: Tor SOCKS5 proxy via tor_helper.get_tor_proxies()
    Priority 3: Redis-cached free proxy pool

    Returns:
        Dict[str, str] containing 'http' and 'https' proxy URLs, or None if no proxies available/enabled.
    """
    config = AntiBlockConfig.get_solo()

    # Priority 1: User-entered custom proxies
    if config.custom_proxy_list and config.custom_proxy_list.strip():
        custom_proxies = [
            p.strip() for p in config.custom_proxy_list.replace(',', '\n').split('\n') if p.strip()
        ]
        if custom_proxies:
            chosen = random.choice(custom_proxies)
            if not chosen.startswith(('http://', 'https://', 'socks5://', 'socks5h://')):
                chosen = f"http://{chosen}"
            return {'http': chosen, 'https': chosen}

    # Priority 2: Tor Proxy
    if config.use_tor_proxy:
        tor_proxies = tor_helper.get_tor_proxies()
        if tor_proxies:
            return tor_proxies

    # Priority 3: Free Public Proxy Pool from Redis
    if config.use_free_proxy_pool:
        free_proxies = cache.get(REDIS_FREE_PROXIES_KEY, [])
        if free_proxies:
            chosen = random.choice(free_proxies)
            if not chosen.startswith(('http://', 'https://', 'socks5://', 'socks5h://')):
                chosen = f"http://{chosen}"
            return {'http': chosen, 'https': chosen}

    return None


def record_proxy_failure(proxy_dict: Optional[Dict[str, str]] = None) -> bool:
    """
    Records a proxy failure or rate limit hit. Increments ip_rotations_count in AntiBlockConfig.
    If the proxy was a Tor proxy (or proxy_dict contains socks5/tor), triggers a Tor NEWNYM signal to rotate IP.

    Args:
        proxy_dict: Optional proxy dictionary that failed.

    Returns:
        bool: True if rotation succeeded or was recorded, False if rotation failed.
    """
    config = AntiBlockConfig.get_solo()
    config.ip_rotations_count += 1
    config.save(update_fields=['ip_rotations_count'])

    http_proxy = (proxy_dict.get('http', '') if proxy_dict else '') or ''
    if not proxy_dict or 'socks5' in http_proxy or 'tor' in http_proxy:
        logger.info("Proxy Rotator: Rate limit hit on Tor Proxy. Triggering Tor NEWNYM signal...")
        return tor_helper.renew_tor_ip()

    return True
