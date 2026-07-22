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


@pytest.mark.django_db
def test_solve_google_captcha_without_api_key():
    token = solve_google_captcha("https://scholar.google.com/sorry/index", "6LfwuzsUAAAAABc123")
    assert token is None
