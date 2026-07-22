# Design Specification: Google Scholar Anti-Blocking Suite (3-Layer Defense)

- **Date:** 2026-07-22
- **Status:** Approved
- **Authors:** Antigravity & User Pair

---

## 1. Executive Summary

This design specification details the full 3-layer anti-blocking architecture designed to ensure zero downtime, zero IP bans, and 100% request completion when scraping Google Scholar at scale (>200 publications per profile across multiple authors).

The core focus is an ultra-resilient, self-healing proxy pipeline with special emphasis on **Layer 1: Tor + Free Proxy Rotator**, backed by **Layer 2: Automated CAPTCHA Solving Engine** and **Layer 3: Adaptive Jitter Rate-Limiter**.

---

## 2. Architecture Overview & Fallback Strategy

```
+-----------------------------------------------------------------------------------+
|                        Celery Scraper Worker Request                              |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| LAYER 3: Adaptive Jitter Rate-Limiter & Exponential Backoff Engine                |
| - Computes optimal delay based on real-time 429 rate & target server health       |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| LAYER 1: Multi-Channel Dynamic Proxy Rotator                                      |
| 1. Primary: Docker Tor SOCKS5 Gateway (tor:9050 with instant socket check)        |
| 2. Secondary: Free Public Proxy Pool (Scraped & validated live in background)     |
| 3. Optional: User-defined Custom/Residential Proxy Pool                           |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| HTTP Request Executed (requests / scholarly)                                      |
+-----------------------------------------------------------------------------------+
     |                                    |                                    |
     v (200 OK)                           v (429/403 Rate Limit)               v (302 Google CAPTCHA)
+------------------+          +-------------------------+          +--------------------------+
| Return HTML      |          | Send Tor SIGNAL NEWNYM  |          | LAYER 2: CAPTCHA Solver  |
| Process Profile  |          | Rotate Tor Exit Node &  |          | Extract sitekey, solve   |
+------------------+          | fallback to Free Pool   |          | via 2Captcha/AntiCaptcha |
                              +-------------------------+          | & inject cookies         |
                                                                   +--------------------------+
```

---

## 3. Detailed Component Specifications

### 3.1 Layer 1: Tor + Free Public Proxy Rotator Engine (`apps/scholar/scholarly/proxy_rotator.py`)

- **Docker Tor SOCKS5 Integration (`socks5h://tor:9050`):**
  - Uses `socks5h` protocol ensuring all DNS lookups occur over Tor to prevent IP leaks.
  - Automatically verifies socket connectivity prior to request dispatch.
  - On HTTP 429/403 or CAPTCHA trigger, immediately issues socket command `SIGNAL NEWNYM` to Tor ControlPort `9051` to rotate the worldwide exit node.

- **Free Public Proxy Pool Engine:**
  - Background Celery periodic task fetches fresh public proxy lists from high-reliability free proxy endpoints.
  - Asynchronously validates proxies against Google Scholar (`https://scholar.google.com`) every 15 minutes.
  - Maintains an in-memory validated proxy queue in Redis (`scholar_free_proxies`).
  - Seamlessly bridges requests if Tor exit nodes experience localized slowdowns or temporary blocking.

- **Custom/Residential Proxy Override:**
  - Allows users to enter custom HTTP/HTTPS/SOCKS5 proxies via UI.
  - Custom proxies take highest priority if provided, falling back to Tor + Free Pool if unconfigured.

---

### 3.2 Layer 2: Automatic Google CAPTCHA Solver Engine (`apps/scholar/scholarly/captcha_solver.py`)

- **Detection & Extraction:**
  - Intercepts HTTP 302 redirects to `https://scholar.google.com/sorry/index?continue=...`.
  - Parses HTML to detect Google ReCAPTCHA v2 / v3 iframe or sitekey (`data-sitekey="..."`).

- **External Solver API Integration (2Captcha / Anti-Captcha):**
  - Submits target URL and `sitekey` to 2Captcha or Anti-Captcha API endpoint.
  - Polls solver result with exponential backoff (checking every 5 seconds, max timeout 60s).
  - Retrieves `g-recaptcha-response` token.

- **Session Cookie Injection:**
  - Injects solution token into request headers/cookies.
  - Retries original request seamlessly without failing the Celery task.

---

### 3.3 Layer 3: Adaptive Jitter Rate-Limiter (`apps/scholar/scholarly/adaptive_limiter.py`)

- **Real-Time 429 Monitor:**
  - Tracks rolling 5-minute error rate (ratio of 429/403 responses vs 200 OK).
  - Dynamically calculates delay factor.
  - Standard base delay: `0.1s - 1.5s`.
  - Max delay under heavy rate-limiting: `15.0s`.

- **Randomized Jitter:**
  - Adds Gaussian/uniform random jitter to prevent predictable request frequency patterns that trigger Google rate limit detectors.

---

## 4. Database Schema & Data Models ([apps/scholar/models.py](file:///home/chinhan/Downloads/init-django-project-main/apps/scholar/models.py))

A singleton configuration model `AntiBlockConfig` stores all suite settings:

```python
class AntiBlockConfig(models.Model):
    # Layer 1: Proxy Settings
    use_tor_proxy = models.BooleanField(default=True)
    use_free_proxy_pool = models.BooleanField(default=True)
    custom_proxy_list = models.TextField(blank=True, default='')

    # Layer 2: CAPTCHA Solver Settings
    enable_captcha_solver = models.BooleanField(default=False)
    captcha_provider = models.CharField(max_length=50, default='2captcha')
    captcha_api_key = models.CharField(max_length=255, blank=True, default='')

    # Layer 3: Adaptive Rate Limiting
    max_retries_per_request = models.IntegerField(default=5)
    adaptive_backoff_enabled = models.BooleanField(default=True)
    base_delay_seconds = models.FloatField(default=1.0)
    max_delay_seconds = models.FloatField(default=15.0)

    # Real-time Metrics
    total_requests_count = models.IntegerField(default=0)
    captcha_encountered_count = models.IntegerField(default=0)
    captcha_solved_count = models.IntegerField(default=0)
    ip_rotations_count = models.IntegerField(default=0)
```

---

## 5. UI Control Panel Specifications

Integrated into `/scholar/auto-scheduler` as a dedicated **Anti-Blocking Suite Control Card & Modal**:
- Toggle switches for Tor Proxy, Free Proxy Pool, and CAPTCHA Solver.
- API Key input field for 2Captcha / Anti-Captcha with "Check Balance" button.
- Custom Proxy textarea with "Test Proxies" button.
- Real-time stat counters: Total Requests, IP Rotations, CAPTCHAs Solved, Current Delay Multiplier.

---

## 6. Verification & Test Plan

1. **Tor & Free Proxy Failover Test:**
   - Simulate a blocked IP response and verify `renew_tor_ip()` sends `SIGNAL NEWNYM` to port 9051.
   - Verify fallback to Redis-backed Free Proxy pool when Tor is temporarily disconnected.
2. **CAPTCHA Solving Flow Test:**
   - Mock a Google `/sorry/` CAPTCHA response page and verify sitekey extraction + API token submission.
3. **Adaptive Backoff Test:**
   - Simulate 3 consecutive 429 errors and verify delay dynamically scales up before resetting on success.
