import pytest
from apps.scholar.scholarly.adaptive_limiter import compute_adaptive_delay, record_request_status

@pytest.mark.django_db
def test_compute_adaptive_delay_baseline():
    """Verifies compute_adaptive_delay returns baseline delay with jitter."""
    delay = compute_adaptive_delay()
    assert 0.8 <= delay <= 15.0

@pytest.mark.django_db
def test_adaptive_delay_increases_on_errors():
    """Verifies rate-limiter increases delay when 429/403/302 errors occur in rolling window."""
    for _ in range(5):
        record_request_status(429)
    delay_error = compute_adaptive_delay()
    
    for _ in range(10):
        record_request_status(200)
    delay_normal = compute_adaptive_delay()

    assert delay_error >= delay_normal
