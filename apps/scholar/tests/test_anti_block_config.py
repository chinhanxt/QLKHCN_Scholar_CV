import pytest
from apps.scholar.models import AntiBlockConfig


@pytest.mark.django_db
def test_anti_block_config_get_solo():
    """Test that get_solo creates and returns the singleton AntiBlockConfig with expected default field values."""
    config = AntiBlockConfig.get_solo()
    assert config.use_tor_proxy is True
    assert config.use_free_proxy_pool is True
    assert config.custom_proxy_list == ''
    assert config.enable_captcha_solver is False
    assert config.captcha_provider == '2captcha'
    assert config.captcha_api_key == ''
    assert config.max_retries_per_request == 5
    assert config.adaptive_backoff_enabled is True
    assert config.base_delay_seconds == 1.0
    assert config.max_delay_seconds == 15.0
    assert config.total_requests_count == 0
    assert config.captcha_encountered_count == 0
    assert config.captcha_solved_count == 0
    assert config.ip_rotations_count == 0


@pytest.mark.django_db
def test_anti_block_config_str():
    """Test string representation of AntiBlockConfig."""
    config = AntiBlockConfig.get_solo()
    assert str(config) == "Anti-Block Configuration"


@pytest.mark.django_db
def test_anti_block_config_singleton_behavior():
    """Test that calling get_solo multiple times returns the same instance and maintains a single DB record."""
    config1 = AntiBlockConfig.get_solo()
    config2 = AntiBlockConfig.get_solo()
    assert config1 == config2
    assert AntiBlockConfig.objects.count() == 1


@pytest.mark.django_db
def test_anti_block_config_update_persistence():
    """Test that updates to AntiBlockConfig attributes persist correctly across get_solo calls."""
    config = AntiBlockConfig.get_solo()
    config.max_retries_per_request = 10
    config.save()

    updated_config = AntiBlockConfig.get_solo()
    assert updated_config.max_retries_per_request == 10

