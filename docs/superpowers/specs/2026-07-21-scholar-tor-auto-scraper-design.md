# Design Specification: Background Google Scholar Auto-Scraper with Tor Proxy, Fast Smart Check & Control Dashboard

- **Date:** 2026-07-21
- **Status:** Approved & Updated with Dedicated Control Dashboard Requirement
- **Authors:** Antigravity & User Pair

---

## 1. Executive Summary

This design specification details the complete architecture for an automated, background-scheduled Google Scholar CV scraper designed for bulk author profile indexing (>200 publications per CV, multiple CVs) without incurring IP bans or CAPTCHA blocks from Google Scholar.

To prevent clutter and simplify control, a **Dedicated Control Tab/Page (`/scholar/auto-scheduler`)** will be created in the Frontend. The primary engineering focus remains on an ultra-optimized Backend pipeline featuring:
1. **Tor Proxy Sidecar (`dperson/torproxy`)** in Docker Compose for 100% free, anonymized, multi-hop IP routing and instant IP rotation (`NEWNYM` signal).
2. **Fast Smart Check Algorithm**: Executes a single light-fetch HTTP request per author profile to inspect publication counts and top publication titles against local database cache, bypassing full processing in 1 request when no updates exist.
3. **Human-like Batching & Delays**: Mimics human browsing behavior with randomized delays between publication pages (8–15s), cooldown periods between CVs (45–90s), and hourly quotas.
4. **Celery Beat Scheduling & Dashboard Control**: Automated background queue execution with dedicated UI for bulk CV import, Tor status monitoring, manual IP rotation, schedule configuration, and live job logs.

---

## 2. Infrastructure & System Architecture

### 2.1 Docker Compose Services (`docker-compose.yml`)

A `tor` service is added as a sidecar container in `docker-compose.yml`:

```yaml
services:
  # Existing services: web, db, redis, celery_worker
  
  tor:
    image: dperson/torproxy:latest
    container_name: scholar_tor_proxy
    restart: always
    environment:
      - PASSWORD=scholar_secret_control_pass
    command: -p "scholar_secret_control_pass"
    ports:
      - "9050:9050"   # SOCKS5 Proxy Port
      - "9051:9051"   # Control Port (NEWNYM signal)
    networks:
      - app_net
```

### 2.2 Tor IP Rotator Module ([tor_helper.py](file:///home/chinhan/Downloads/init-django-project-main/apps/scholar/scholarly/tor_helper.py))

A helper module manages Tor IP rotation by issuing socket commands to Tor's ControlPort (`9051`):

```python
import socket
import time
import logging

logger = logging.getLogger(__name__)

def renew_tor_ip(control_host='tor', control_port=9051, password='scholar_secret_control_pass'):
    """Sends NEWNYM signal to Tor ControlPort to switch exit node IP."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.connect((control_host, control_port))
            s.sendall(f'AUTHENTICATE "{password}"\r\n'.encode())
            response = s.recv(1024).decode()
            if "250 OK" in response:
                s.sendall(b'SIGNAL NEWNYM\r\n')
                response = s.recv(1024).decode()
                if "250 OK" in response:
                    logger.info("Tor IP changed successfully (NEWNYM signal accepted).")
                    time.sleep(8)  # Allow Tor circuit rebuild time
                    return True
    except Exception as e:
        logger.error(f"Failed to renew Tor IP: {e}")
    return False
```

---

## 3. Data Model Schema Updates ([apps/scholar/models.py](file:///home/chinhan/Downloads/init-django-project-main/apps/scholar/models.py))

The `AuthorProfile` model and a new `AutoScanConfig` model are extended:

- `AuthorProfile`:
  - `auto_scan_enabled`: `BooleanField(default=True)` - Toggles background scanning for the author.
  - `last_scraped_at`: `DateTimeField(null=True, blank=True)` - Timestamp of the last successful scan/check.
  - `last_scan_status`: `CharField(max_length=50, default='PENDING')` - Status (`UP_TO_DATE`, `UPDATED`, `FAILED_CAPTCHA`, `IN_PROGRESS`).
  - `publication_count_cached`: `IntegerField(default=0)` - Quick comparison field for Fast Smart Check.

- `AutoScanConfig` (Singleton Configuration Model):
  - `is_active`: `BooleanField(default=True)` - Master switch for Celery Beat auto-scan.
  - `scan_interval_hours`: `IntegerField(default=24)` - Interval between scans.
  - `batch_size_per_hour`: `IntegerField(default=8)` - Maximum CVs scanned per hour.
  - `delay_min_seconds`: `IntegerField(default=8)`
  - `delay_max_seconds`: `IntegerField(default=15)`
  - `cooldown_min_seconds`: `IntegerField(default=45)`
  - `cooldown_max_seconds`: `IntegerField(default=90)`

---

## 4. Dedicated Control Tab & Backend APIs

### 4.1 Frontend Page: `ScholarAutoSchedulerPage.tsx` (`/scholar/auto-scheduler`)

A dedicated dashboard tab containing:
1. **Bulk Import Card:** Textarea & File Upload (CSV/TXT) to import multiple Google Scholar URLs or Author IDs in bulk.
2. **Tor Proxy Widget:** Shows live Tor Proxy status (Online/Offline, current Exit IP) and a manual **"Rotate IP (NEWNYM)"** button.
3. **Auto-Scan Settings Form:** Adjust scan frequency, batch size per hour, and delay parameters.
4. **Live Job Monitor & History Table:** Displays progress, last scan time, status badges (`UP_TO_DATE` in green, `UPDATED` in blue, `FAILED` in red), skipped vs. updated publication metrics.

### 4.2 Control API Endpoints ([apps/scholar/api/views.py](file:///home/chinhan/Downloads/init-django-project-main/apps/scholar/api/views.py))

- `POST /api/scholar/auto-scan/bulk-import/` - Ingest list of Scholar IDs/URLs for auto-scanning.
- `GET /api/scholar/auto-scan/tor-status/` - Check Tor status and current exit IP.
- `POST /api/scholar/auto-scan/rotate-ip/` - Trigger manual Tor `NEWNYM` IP renewal.
- `GET /api/scholar/auto-scan/config/` & `PATCH /api/scholar/auto-scan/config/` - Retrieve & update scheduler config.
- `GET /api/scholar/auto-scan/logs/` - Retrieve scan execution logs and metrics.

---

## 5. Core Scraper Workflow & Smart Check Logic

### 5.1 Fast Smart Check Workflow

```
+-------------------------------------------------------------+
|                 Celery Scheduled Task                       |
|           scrape_author_cv_smart_task(author_id)            |
+-------------------------------------------------------------+
                              |
                              v
             [Setup Tor Proxy SOCKS5: tor:9050]
                              |
                              v
             [Fetch Profile Page 1 (pagesize=100)]
                              |
                              v
      +-------------------------------+-------------------------------+
      |                                                               |
      v                                                               v
[Count & Titles Match DB?]                                 [New Publications Detected?]
      |                                                               |
      v                                                               v
[No New Pubs Found]                                        [Filter Unsaved Pubs Only]
  - Update last_scraped_at                                   - Ingest & Save to DB
  - Set status = 'UP_TO_DATE'                                - Apply 8-15s delay per page
  - Cooldown 45-90s                                          - Renew Tor IP (NEWNYM)
  - Complete Task (Cost: 1 Request!)                         - Complete Task
```

### 5.2 Human-like Delays & Rate Limits

1. **Per-Page Delay:** `time.sleep(random.uniform(delay_min, delay_max))` (default 8–15s).
2. **Per-CV Cooldown:** `time.sleep(random.uniform(cooldown_min, cooldown_max))` (default 45–90s).
3. **Hourly Quota:** Configurable via `batch_size_per_hour` (default 8 CVs/hour).

---

## 6. Anti-Ban Circuit & Error Handling

When Google Scholar returns HTTP `429 Too Many Requests`, `403 Forbidden`, or CAPTCHA redirects:
1. Log warning and set `last_scan_status = 'FAILED_CAPTCHA'`.
2. Trigger `renew_tor_ip()`.
3. Re-queue task via Celery `self.retry(countdown=random.randint(30, 60))`.
4. Real host IP is never exposed.

---

## 7. Testing & Validation Plan

1. **Tor Proxy Integration Test:** Verify socket authentication and `NEWNYM` signal rotation on `tor:9051`.
2. **Fast Smart Check Unit Test:** Mock Google Scholar profile responses to confirm 1-request skip behavior when publication count/titles match.
3. **Bulk Import & API Test:** Verify bulk import endpoint and configuration updates.
4. **End-to-End Scrape Test:** Run `scrape_author_cv_smart_task` in Docker Compose environment and monitor logs & IP changes.
