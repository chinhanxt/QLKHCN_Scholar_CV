# Google Scholar Anti-Blocking Suite (3-Layer Defense) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a robust, 3-layer anti-blocking system featuring Tor Proxy + Free Public Proxy Pool rotators, Automated Google CAPTCHA Solving API integration, and Adaptive Jitter Rate-Limiting for Google Scholar scraping.

**Architecture:** 
- **Layer 1:** Multi-channel dynamic proxy rotator (`socks5h://tor:9050` with Tor `NEWNYM` circuit rotation + Redis-backed free proxy pool).
- **Layer 2:** Automatic Google CAPTCHA detection and solving via 2Captcha / Anti-Captcha APIs with session token injection.
- **Layer 3:** Adaptive Exponential Jitter Rate-Limiter that monitors HTTP 429 errors in real-time and dynamically scales request delays.

**Tech Stack:** Python 3.13, Django 5.1, Celery Beat, Redis, Requests/PySocks, React, TypeScript, TailwindCSS.

---

## File Structure & Dependencies

- **Backend Models:** `apps/scholar/models.py` (Add `AntiBlockConfig` singleton model)
- **Layer 1 Proxy Engine:** `apps/scholar/scholarly/proxy_rotator.py` (Tor SOCKS5 + Free Proxy Redis Pool)
- **Layer 2 CAPTCHA Solver:** `apps/scholar/scholarly/captcha_solver.py` (Detector + 2Captcha / Anti-Captcha integration)
- **Layer 3 Adaptive Rate-Limiter:** `apps/scholar/scholarly/adaptive_limiter.py` (429 Error monitor + Jitter calculator)
- **Backend API & Tasks:** `apps/scholar/api/views.py`, `apps/scholar/tasks.py`
- **Frontend Control Component:** `frontend/src/components/scholar/AntiBlockControlModal.tsx`
- **Frontend Page Integration:** `frontend/src/pages/ScholarAutoSchedulerPage.tsx`

---

### Task 1: Create AntiBlockConfig Singleton Model & Unit Tests

**Files:**
- Create: `apps/scholar/tests/test_anti_block_config.py`
- Modify: `apps/scholar/models.py`

- [ ] **Step 1: Write failing test for AntiBlockConfig singleton model**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose -f docker-compose.local.yml exec -T django pytest apps/scholar/tests/test_anti_block_config.py -v`
Expected: FAIL with "ImportError: cannot import name AntiBlockConfig"

- [ ] **Step 3: Implement AntiBlockConfig model in models.py**

Add to `apps/scholar/models.py`:

```python
class AntiBlockConfig(models.Model):
    use_tor_proxy = models.BooleanField(default=True)
    use_free_proxy_pool = models.BooleanField(default=True)
    custom_proxy_list = models.TextField(blank=True, default='')

    enable_captcha_solver = models.BooleanField(default=False)
    captcha_provider = models.CharField(max_length=50, default='2captcha')
    captcha_api_key = models.CharField(max_length=255, blank=True, default='')

    max_retries_per_request = models.IntegerField(default=5)
    adaptive_backoff_enabled = models.BooleanField(default=True)
    base_delay_seconds = models.FloatField(default=1.0)
    max_delay_seconds = models.FloatField(default=15.0)

    total_requests_count = models.IntegerField(default=0)
    captcha_encountered_count = models.IntegerField(default=0)
    captcha_solved_count = models.IntegerField(default=0)
    ip_rotations_count = models.IntegerField(default=0)

    class Meta:
        verbose_name = 'Anti-Block Config'

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj
```

- [ ] **Step 4: Create and apply Django migrations**

Run: `docker compose -f docker-compose.local.yml exec -T django python manage.py makemigrations scholar && docker compose -f docker-compose.local.yml exec -T django python manage.py migrate`

- [ ] **Step 5: Run test to verify it passes**

Run: `docker compose -f docker-compose.local.yml exec -T django pytest apps/scholar/tests/test_anti_block_config.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/scholar/models.py apps/scholar/tests/test_anti_block_config.py apps/scholar/migrations/
git commit -m "feat: add AntiBlockConfig singleton model and test"
```

---

### Task 2: Implement Multi-Channel Proxy Rotator (Tor + Free Proxy Pool)

**Files:**
- Create: `apps/scholar/scholarly/proxy_rotator.py`
- Create: `apps/scholar/tests/test_proxy_rotator.py`
- Modify: `apps/scholar/scholarly/tor_helper.py`

- [ ] **Step 1: Write failing unit test for proxy_rotator**

```python
import pytest
from apps.scholar.scholarly.proxy_rotator import get_next_proxy, record_proxy_failure

@pytest.mark.django_db
def test_proxy_rotator_defaults_to_tor():
    proxy = get_next_proxy()
    assert proxy is not None
    assert 'http' in proxy
    assert 'socks5h://' in proxy['http'] or 'http://' in proxy['http']

@pytest.mark.django_db
def test_record_proxy_failure_triggers_rotation(mocker):
    mock_renew = mocker.patch('apps.scholar.scholarly.tor_helper.renew_tor_ip', return_value=True)
    res = record_proxy_failure({'http': 'socks5h://tor:9050'})
    assert res is True
    mock_renew.assert_called_once()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose -f docker-compose.local.yml exec -T django pytest apps/scholar/tests/test_proxy_rotator.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'apps.scholar.scholarly.proxy_rotator'"

- [ ] **Step 3: Implement proxy_rotator.py**

Create `apps/scholar/scholarly/proxy_rotator.py`:

```python
import random
import logging
from django.core.cache import cache
from apps.scholar.models import AntiBlockConfig
from apps.scholar.scholarly.tor_helper import get_tor_proxies, renew_tor_ip

logger = logging.getLogger(__name__)

REDIS_FREE_PROXIES_KEY = "scholar_free_proxies"

def get_next_proxy():
    config = AntiBlockConfig.get_solo()

    # Priority 1: User-entered custom proxies
    if config.custom_proxy_list.strip():
        custom_proxies = [p.strip() for p in config.custom_proxy_list.split('\n') if p.strip()]
        if custom_proxies:
            chosen = random.choice(custom_proxies)
            if not chosen.startswith(('http://', 'https://', 'socks5://', 'socks5h://')):
                chosen = f"http://{chosen}"
            return {'http': chosen, 'https': chosen}

    # Priority 2: Tor Proxy
    if config.use_tor_proxy:
        tor_proxies = get_tor_proxies()
        if tor_proxies:
            return tor_proxies

    # Priority 3: Free Public Proxy Pool from Redis
    if config.use_free_proxy_pool:
        free_proxies = cache.get(REDIS_FREE_PROXIES_KEY, [])
        if free_proxies:
            chosen = random.choice(free_proxies)
            return {'http': chosen, 'https': chosen}

    return None


def record_proxy_failure(proxy_dict):
    config = AntiBlockConfig.get_solo()
    config.ip_rotations_count += 1
    config.save(update_fields=['ip_rotations_count'])

    if proxy_dict and 'socks5' in proxy_dict.get('http', ''):
        logger.info("Proxy Rotator: Rate limit hit on Tor Proxy. Triggering Tor NEWNYM signal...")
        return renew_tor_ip()

    return True
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose -f docker-compose.local.yml exec -T django pytest apps/scholar/tests/test_proxy_rotator.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/scholar/scholarly/proxy_rotator.py apps/scholar/tests/test_proxy_rotator.py
git commit -m "feat: add multi-channel proxy rotator with Tor and Redis free pool"
```

---

### Task 3: Implement Automated CAPTCHA Solver Engine

**Files:**
- Create: `apps/scholar/scholarly/captcha_solver.py`
- Create: `apps/scholar/tests/test_captcha_solver.py`

- [ ] **Step 1: Write failing unit test for captcha_solver**

```python
import pytest
from apps.scholar.scholarly.captcha_solver import is_captcha_response, solve_google_captcha

def test_is_captcha_response_detection():
    html_with_captcha = '<form action="/sorry/index" id="captcha-form" data-sitekey="6LfwuzsUAAAAABc123">'
    assert is_captcha_response(302, html_with_captcha, "https://scholar.google.com/sorry/index") is True
    
    html_normal = '<html><body><h1>Scholar Profile</h1></body></html>'
    assert is_captcha_response(200, html_normal, "https://scholar.google.com/citations") is False

@pytest.mark.django_db
def test_solve_google_captcha_without_api_key():
    token = solve_google_captcha("https://scholar.google.com/sorry/index", "6LfwuzsUAAAAABc123")
    assert token is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose -f docker-compose.local.yml exec -T django pytest apps/scholar/tests/test_captcha_solver.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'apps.scholar.scholarly.captcha_solver'"

- [ ] **Step 3: Implement captcha_solver.py**

Create `apps/scholar/scholarly/captcha_solver.py`:

```python
import re
import time
import requests
import logging
from apps.scholar.models import AntiBlockConfig

logger = logging.getLogger(__name__)

def is_captcha_response(status_code, html_text, response_url):
    if status_code in (302, 429) and '/sorry/index' in response_url:
        return True
    if 'g-recaptcha' in html_text or 'captcha-form' in html_text or 'data-sitekey' in html_text:
        return True
    return False

def extract_sitekey(html_text):
    match = re.search(r'data-sitekey=["\']([^"\']+)["\']', html_text)
    if match:
        return match.group(1)
    return "6LfwuzsUAAAAABc123"

def solve_google_captcha(page_url, sitekey):
    config = AntiBlockConfig.get_solo()
    if not config.enable_captcha_solver or not config.captcha_api_key.strip():
        logger.warning("CAPTCHA Solver disabled or missing API key.")
        return None

    config.captcha_encountered_count += 1
    config.save(update_fields=['captcha_encountered_count'])

    api_key = config.captcha_api_key.strip()
    provider = config.captcha_provider

    if provider == '2captcha':
        try:
            req_url = f"http://2captcha.com/in.php?key={api_key}&method=userrecaptcha&googlekey={sitekey}&pageurl={page_url}&json=1"
            r = requests.get(req_url, timeout=10).json()
            if r.get('status') != 1:
                logger.error(f"2Captcha request error: {r.get('request')}")
                return None
            
            request_id = r.get('request')
            res_url = f"http://2captcha.com/res.php?key={api_key}&action=get&id={request_id}&json=1"

            for _ in range(12):
                time.sleep(5)
                res = requests.get(res_url, timeout=10).json()
                if res.get('status') == 1:
                    token = res.get('request')
                    config.captcha_solved_count += 1
                    config.save(update_fields=['captcha_solved_count'])
                    logger.info("2Captcha solved successfully.")
                    return token
                if res.get('request') != 'CAPCHA_NOT_READY':
                    logger.error(f"2Captcha error during polling: {res.get('request')}")
                    break
        except Exception as e:
            logger.error(f"Failed to communicate with 2Captcha API: {e}")

    return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose -f docker-compose.local.yml exec -T django pytest apps/scholar/tests/test_captcha_solver.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/scholar/scholarly/captcha_solver.py apps/scholar/tests/test_captcha_solver.py
git commit -m "feat: add automatic Google CAPTCHA solver module for 2Captcha API"
```

---

### Task 4: Implement Adaptive Jitter Rate-Limiter Engine

**Files:**
- Create: `apps/scholar/scholarly/adaptive_limiter.py`
- Create: `apps/scholar/tests/test_adaptive_limiter.py`

- [ ] **Step 1: Write failing unit test for adaptive_limiter**

```python
import pytest
from apps.scholar.scholarly.adaptive_limiter import compute_adaptive_delay, record_request_status

@pytest.mark.django_db
def test_compute_adaptive_delay_baseline():
    delay = compute_adaptive_delay()
    assert 0.8 <= delay <= 15.0

@pytest.mark.django_db
def test_adaptive_delay_increases_on_errors():
    for _ in range(5):
        record_request_status(429)
    delay_error = compute_adaptive_delay()
    
    for _ in range(10):
        record_request_status(200)
    delay_normal = compute_adaptive_delay()

    assert delay_error >= delay_normal
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose -f docker-compose.local.yml exec -T django pytest apps/scholar/tests/test_adaptive_limiter.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'apps.scholar.scholarly.adaptive_limiter'"

- [ ] **Step 3: Implement adaptive_limiter.py**

Create `apps/scholar/scholarly/adaptive_limiter.py`:

```python
import time
import random
import logging
from django.core.cache import cache
from apps.scholar.models import AntiBlockConfig

logger = logging.getLogger(__name__)

ERROR_HISTORY_KEY = "scholar_rate_limit_history"

def record_request_status(status_code):
    config = AntiBlockConfig.get_solo()
    config.total_requests_count += 1
    config.save(update_fields=['total_requests_count'])

    history = cache.get(ERROR_HISTORY_KEY, [])
    now = time.time()
    history = [t for t in history if now - t['time'] < 300]
    
    is_error = status_code in (429, 403, 302)
    history.append({'time': now, 'error': is_error})
    cache.set(ERROR_HISTORY_KEY, history, 300)

def compute_adaptive_delay():
    config = AntiBlockConfig.get_solo()
    base_delay = config.base_delay_seconds
    max_delay = config.max_delay_seconds

    if not config.adaptive_backoff_enabled:
        return base_delay + random.uniform(0.1, 0.5)

    history = cache.get(ERROR_HISTORY_KEY, [])
    if not history:
        return base_delay + random.uniform(0.1, 0.5)

    recent_errors = sum(1 for item in history if item['error'])
    total_recent = len(history)

    error_ratio = recent_errors / float(total_recent) if total_recent > 0 else 0.0
    
    scaled_delay = base_delay * (1.0 + error_ratio * 4.0)
    jitter = random.uniform(0.1, 0.8)
    
    final_delay = min(scaled_delay + jitter, max_delay)
    return round(final_delay, 2)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose -f docker-compose.local.yml exec -T django pytest apps/scholar/tests/test_adaptive_limiter.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/scholar/scholarly/adaptive_limiter.py apps/scholar/tests/test_adaptive_limiter.py
git commit -m "feat: add adaptive exponential jitter rate-limiter engine"
```

---

### Task 5: Implement Backend API Endpoints & Free Proxy Fetcher Celery Task

**Files:**
- Modify: `apps/scholar/api/views.py`
- Modify: `apps/scholar/api/serializers.py`
- Modify: `apps/scholar/tasks.py`
- Test: `apps/scholar/tests/test_anti_block_api.py`

- [ ] **Step 1: Write failing API integration test**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose -f docker-compose.local.yml exec -T django pytest apps/scholar/tests/test_anti_block_api.py -v`
Expected: FAIL with "404 Not Found"

- [ ] **Step 3: Add Serializers & Views in apps/scholar/api/**

Add `AntiBlockConfigSerializer` to `apps/scholar/api/serializers.py`:

```python
class AntiBlockConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = AntiBlockConfig
        fields = '__all__'
```

Add `AntiBlockConfigView` and `RotateTorView` to `apps/scholar/api/views.py`:

```python
class AntiBlockConfigView(APIView):
    def get(self, request):
        config = AntiBlockConfig.get_solo()
        serializer = AntiBlockConfigSerializer(config)
        return Response(serializer.data)

    def patch(self, request):
        config = AntiBlockConfig.get_solo()
        serializer = AntiBlockConfigSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class RotateTorView(APIView):
    def post(self, request):
        from apps.scholar.scholarly.tor_helper import renew_tor_ip
        success = renew_tor_ip()
        return Response({'status': 'success' if success else 'failed', 'rotated': success})
```

Register URLs in `apps/scholar/api/urls.py` or Router:
- `/api/scholar/anti-block/config/`
- `/api/scholar/anti-block/rotate-tor/`

Add Periodic Task `refresh_free_proxy_pool_task` in `apps/scholar/tasks.py`:

```python
@shared_task
def refresh_free_proxy_pool_task():
    import requests
    from django.core.cache import cache
    try:
        r = requests.get("https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt", timeout=10)
        if r.status_code == 200:
            proxies = [f"http://{line.strip()}" for line in r.text.split('\n') if line.strip()][:50]
            cache.set("scholar_free_proxies", proxies, 1800)
            logger.info(f"Refreshed {len(proxies)} free proxies into Redis cache.")
    except Exception as e:
        logger.error(f"Failed to refresh free proxy pool: {e}")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose -f docker-compose.local.yml exec -T django pytest apps/scholar/tests/test_anti_block_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/scholar/api/views.py apps/scholar/api/serializers.py apps/scholar/tasks.py apps/scholar/tests/test_anti_block_api.py
git commit -m "feat: add AntiBlock APIs and background free proxy pool refresher task"
```

---

### Task 6: Implement Frontend AntiBlockControlModal Component & Integrate into Auto-Scheduler Page

**Files:**
- Create: `frontend/src/components/scholar/AntiBlockControlModal.tsx`
- Modify: `frontend/src/pages/ScholarAutoSchedulerPage.tsx`
- Modify: `frontend/src/api/endpoints/scholar.ts`

- [ ] **Step 1: Add API client methods to scholar.ts**

Add to `frontend/src/api/endpoints/scholar.ts`:

```typescript
export const antiBlockApi = {
  getConfig: () => apiClient.get('/scholar/anti-block/config/'),
  updateConfig: (data: any) => apiClient.patch('/scholar/anti-block/config/', data),
  rotateTor: () => apiClient.post('/scholar/anti-block/rotate-tor/'),
}
```

- [ ] **Step 2: Create AntiBlockControlModal.tsx component**

Create `frontend/src/components/scholar/AntiBlockControlModal.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { ShieldAlert, RefreshCw, Key, Server, Cpu, Check } from 'lucide-react'
import { antiBlockApi } from '@/api/endpoints/scholar'
import toast from 'react-hot-toast'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function AntiBlockControlModal({ isOpen, onClose }: Props) {
  const [config, setConfig] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [rotating, setRotating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      antiBlockApi.getConfig().then((res) => setConfig(res.data))
    }
  }, [isOpen])

  if (!isOpen || !config) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      await antiBlockApi.updateConfig(config)
      toast.success('Đã cập nhật cấu hình hệ thống kháng chặn!')
      onClose()
    } catch {
      toast.error('Lỗi khi lưu cấu hình kháng chặn.')
    } finally {
      setSaving(false)
    }
  }

  const handleRotateTor = async () => {
    setRotating(true)
    try {
      const res = await antiBlockApi.rotateTor()
      if (res.data.rotated) {
        toast.success('Đã xoay Nút Tor Exit Node mới thành công!')
        setConfig((prev: any) => ({ ...prev, ip_rotations_count: prev.ip_rotations_count + 1 }))
      } else {
        toast.error('Xoay IP Tor thất bại. Hãy kiểm tra Tor container.')
      }
    } finally {
      setRotating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Cấu Hình Kháng Chặn Google Scholar (3 Lớp)</h3>
              <p className="text-xs text-slate-500">Quản lý Tor Proxy, Free Proxy Pool & Tự động Giải CAPTCHA</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Lớp 1: Proxy */}
          <div className="p-4 border border-slate-200 rounded-xl space-y-3 bg-slate-50/50">
            <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-600" /> Lớp 1: Multi-Channel Proxy Rotator
            </h4>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Docker Tor SOCKS5 Gateway (Miễn phí)</span>
              <input
                type="checkbox"
                checked={config.use_tor_proxy}
                onChange={(e) => setConfig({ ...config, use_tor_proxy: e.target.checked })}
                className="h-4 w-4 text-blue-600 rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Free Public Proxy Pool Dự Phòng</span>
              <input
                type="checkbox"
                checked={config.use_free_proxy_pool}
                onChange={(e) => setConfig({ ...config, use_free_proxy_pool: e.target.checked })}
                className="h-4 w-4 text-blue-600 rounded"
              />
            </div>
            <button
              onClick={handleRotateTor}
              disabled={rotating}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 pt-1"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${rotating ? 'animate-spin' : ''}`} /> Xoay Nút Tor Ngay (NEWNYM Signal)
            </button>
          </div>

          {/* Lớp 2: CAPTCHA */}
          <div className="p-4 border border-slate-200 rounded-xl space-y-3 bg-slate-50/50">
            <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
              <Key className="h-4 w-4 text-emerald-600" /> Lớp 2: Tự Động Giải Google CAPTCHA
            </h4>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Kích hoạt Tự Động Giải CAPTCHA</span>
              <input
                type="checkbox"
                checked={config.enable_captcha_solver}
                onChange={(e) => setConfig({ ...config, enable_captcha_solver: e.target.checked })}
                className="h-4 w-4 text-emerald-600 rounded"
              />
            </div>
            {config.enable_captcha_solver && (
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-slate-600">API Key (2Captcha / Anti-Captcha)</label>
                <input
                  type="password"
                  value={config.captcha_api_key}
                  onChange={(e) => setConfig({ ...config, captcha_api_key: e.target.value })}
                  placeholder="Nhập 2Captcha API Key..."
                  className="w-full text-xs p-2.5 border rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Lớp 3: Rate Limit */}
          <div className="p-4 border border-slate-200 rounded-xl space-y-3 bg-slate-50/50">
            <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
              <Cpu className="h-4 w-4 text-amber-600" /> Lớp 3: Adaptive Rate-Limiting Jitter
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600">Delay Cơ Sở (s)</label>
                <input
                  type="number"
                  step="0.1"
                  value={config.base_delay_seconds}
                  onChange={(e) => setConfig({ ...config, base_delay_seconds: parseFloat(e.target.value) || 1.0 })}
                  className="w-full text-xs p-2.5 border rounded-lg mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">Delay Tối Đa (s)</label>
                <input
                  type="number"
                  step="0.5"
                  value={config.max_delay_seconds}
                  onChange={(e) => setConfig({ ...config, max_delay_seconds: parseFloat(e.target.value) || 15.0 })}
                  className="w-full text-xs p-2.5 border rounded-lg mt-1"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-xs text-slate-500 font-medium">
            Request: {config.total_requests_count} • IP Tor: {config.ip_rotations_count} • Captchas: {config.captcha_solved_count}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
              Hủy
            </button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5">
              <Check className="h-4 w-4" /> Lưu Cấu Hình
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Integrate AntiBlockControlModal into ScholarAutoSchedulerPage.tsx**

Add "Hệ Thống Kháng Chặn (3 Lớp)" button in `ScholarAutoSchedulerPage.tsx` next to Tor Control Widget, and render `<AntiBlockControlModal />`.

- [ ] **Step 4: Test frontend compilation & build**

Run: `npx tsc --noEmit` and `npm run build` in `frontend/`.
Expected: 0 errors, successful build.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/scholar/AntiBlockControlModal.tsx frontend/src/pages/ScholarAutoSchedulerPage.tsx frontend/src/api/endpoints/scholar.ts
git commit -m "feat: add AntiBlockControlModal component and integrate into ScholarAutoSchedulerPage"
```

---

## Verification & Execution Checklists

1. Run `pytest apps/scholar/tests/` to verify all 6 unit/integration test suites pass cleanly.
2. Run `npm run build` in `frontend/` to confirm production build succeeds.
3. Test Tor Rotation button and Anti-Blocking settings modal in browser at `http://localhost:5173/scholar/auto-scheduler`.
