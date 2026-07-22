from unittest.mock import patch
import pytest
from django.core.cache import cache
from apps.scholar.models import AntiBlockConfig
from apps.scholar.scholarly.proxy_rotator import get_next_proxy, record_proxy_failure, REDIS_FREE_PROXIES_KEY


@pytest.mark.django_db
def test_proxy_rotator_defaults_to_tor():
    """Verifies get_next_proxy returns Tor proxy by default when configured."""
    with patch(
        'apps.scholar.scholarly.tor_helper.get_tor_proxies',
        return_value={'http': 'socks5h://tor:9050', 'https': 'socks5h://tor:9050'}
    ):
        proxy = get_next_proxy()
        assert proxy is not None
        assert 'http' in proxy
        assert 'socks5h://' in proxy['http'] or 'http://' in proxy['http']


@pytest.mark.django_db
def test_record_proxy_failure_triggers_rotation():
    """Verifies recording proxy failure increments count and triggers Tor NEWNYM signal."""
    with patch('apps.scholar.scholarly.tor_helper.renew_tor_ip', return_value=True) as mock_renew:
        res = record_proxy_failure({'http': 'socks5h://tor:9050'})
        assert res is True
        mock_renew.assert_called_once()
        config = AntiBlockConfig.get_solo()
        assert config.ip_rotations_count == 1


@pytest.mark.django_db
def test_proxy_rotator_custom_proxy_priority():
    """Verifies Priority 1: custom_proxy_list is returned when configured."""
    config = AntiBlockConfig.get_solo()
    config.custom_proxy_list = 'http://1.2.3.4:8080\nhttp://5.6.7.8:8080'
    config.save()

    proxy = get_next_proxy()
    assert proxy is not None
    assert proxy['http'] in ['http://1.2.3.4:8080', 'http://5.6.7.8:8080']


@pytest.mark.django_db
def test_proxy_rotator_free_proxy_pool_priority():
    """Verifies Priority 3: Free proxy pool from Redis is returned when Tor is disabled/unavailable."""
    with patch('apps.scholar.scholarly.tor_helper.get_tor_proxies', return_value=None):
        config = AntiBlockConfig.get_solo()
        config.use_tor_proxy = False
        config.use_free_proxy_pool = True
        config.save()

        cache.set(REDIS_FREE_PROXIES_KEY, ['http://10.0.0.1:3128'], 60)
        try:
            proxy = get_next_proxy()
            assert proxy is not None
            assert proxy['http'] == 'http://10.0.0.1:3128'
        finally:
            cache.delete(REDIS_FREE_PROXIES_KEY)


@pytest.mark.django_db
def test_proxy_rotator_returns_none_when_disabled():
    """Verifies get_next_proxy returns None when all proxy sources are disabled or unavailable."""
    with patch('apps.scholar.scholarly.tor_helper.get_tor_proxies', return_value=None):
        config = AntiBlockConfig.get_solo()
        config.use_tor_proxy = False
        config.use_free_proxy_pool = False
        config.custom_proxy_list = ''
        config.save()

        proxy = get_next_proxy()
        assert proxy is None
