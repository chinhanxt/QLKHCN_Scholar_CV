import pytest
from rest_framework.test import APIClient
from apps.scholar.models import AntiBlockConfig

@pytest.mark.django_db
def test_anti_block_config_api():
    client = APIClient()
    res = client.get('/api/scholar/anti-block/config/')
    assert res.status_code == 200
    assert res.data['use_tor_proxy'] is True

    patch_res = client.patch('/api/scholar/anti-block/config/', {'enable_captcha_solver': True}, format='json')
    assert patch_res.status_code == 200
    config = AntiBlockConfig.get_solo()
    assert config.enable_captcha_solver is True

@pytest.mark.django_db
def test_rotate_tor_api(monkeypatch):
    monkeypatch.setattr('apps.scholar.scholarly.tor_helper.renew_tor_ip', lambda *args, **kwargs: True)
    client = APIClient()
    res = client.post('/api/scholar/anti-block/rotate-tor/')
    assert res.status_code == 200
    assert res.data['rotated'] is True
