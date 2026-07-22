import pytest
from apps.scholar.scholarly.captcha_solver import (
    is_captcha_response,
    extract_sitekey,
    solve_google_captcha,
)


def test_is_captcha_response_detection():
    html_with_captcha = '<form action="/sorry/index" id="captcha-form" data-sitekey="6LfwuzsUAAAAABc123">'
    assert is_captcha_response(302, html_with_captcha, "https://scholar.google.com/sorry/index") is True

    html_normal = '<html><body><h1>Scholar Profile</h1></body></html>'
    assert is_captcha_response(200, html_normal, "https://scholar.google.com/citations") is False


def test_extract_sitekey():
    html_with_key = '<div class="g-recaptcha" data-sitekey="6Lxyz999ABC"></div>'
    assert extract_sitekey(html_with_key) == "6Lxyz999ABC"


def test_extract_sitekey_missing():
    html_without_key = '<html><body>No sitekey present</body></html>'
    assert extract_sitekey(html_without_key) == ""


@pytest.mark.django_db
def test_solve_google_captcha_without_api_key():
    token = solve_google_captcha("https://scholar.google.com/sorry/index", "6LfwuzsUAAAAABc123")
    assert token is None


from unittest.mock import patch, MagicMock


@pytest.fixture
def mocker():
    class MockerFixture:
        def patch(self, *args, **kwargs):
            patcher = patch(*args, **kwargs)
            return patcher.start()

    m = MockerFixture()
    yield m
    patch.stopall()


@pytest.mark.django_db
def test_solve_google_captcha_success():
    from apps.scholar.models import AntiBlockConfig

    config = AntiBlockConfig.get_solo()
    config.enable_captcha_solver = True
    config.captcha_api_key = "test_api_key"
    config.captcha_provider = "2captcha"
    config.save()

    mock_response_in = MagicMock()
    mock_response_in.json.return_value = {"status": 1, "request": "12345"}
    mock_response_res = MagicMock()
    mock_response_res.json.return_value = {"status": 1, "request": "OK_TOKEN_123"}

    with patch("requests.get", side_effect=[mock_response_in, mock_response_res]), \
         patch("time.sleep", return_value=None):
        token = solve_google_captcha("https://scholar.google.com/sorry/index", "6LfwuzsUAAAAABc123")
        assert token == "OK_TOKEN_123"

    config.refresh_from_db()
    assert config.captcha_encountered_count == 1
    assert config.captcha_solved_count == 1


@pytest.mark.django_db
def test_solve_google_captcha_2captcha_error(mocker):
    from apps.scholar.models import AntiBlockConfig

    config = AntiBlockConfig.get_solo()
    config.enable_captcha_solver = True
    config.captcha_api_key = "test_api_key"
    config.captcha_provider = "2captcha"
    config.save()

    mock_get = mocker.patch("requests.get")
    mock_get.return_value.json.return_value = {"status": 0, "request": "ERROR_ZERO_BALANCE"}

    token = solve_google_captcha("https://scholar.google.com/sorry/index", "6LfwuzsUAAAAABc123")
    assert token is None



