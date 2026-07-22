import pytest
from apps.scholar.models import AntiBlockConfig

@pytest.mark.django_db
def test_anti_block_config_get_solo():
    config = AntiBlockConfig.get_solo()
    assert config.use_tor_proxy is True
    assert config.use_free_proxy_pool is True
    assert config.enable_captcha_solver is False
    assert config.captcha_provider == '2captcha'
    assert config.base_delay_seconds == 1.0
