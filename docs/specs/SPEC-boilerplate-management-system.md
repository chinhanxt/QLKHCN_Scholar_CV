# SPEC: Django Management System Boilerplate

> Version: 1.0
> Date: 2026-03-22
> Status: Draft

---

## 1. Overview & Goals

### Mục tiêu
Xây dựng boilerplate Django hoàn chỉnh, generic (không gắn domain cụ thể), sẵn sàng cho việc phát triển nhanh các hệ thống quản lý. Code base phải:

- **Nhanh chóng khởi tạo**: Developer clone về, chạy Docker Compose, bắt đầu viết business logic ngay
- **Dễ mở rộng**: Thêm app mới chỉ cần tạo trong `apps/`, kế thừa base models/mixins
- **Hiệu năng cao**: Pagination, caching, async tasks đã được cấu hình sẵn
- **Sẵn sàng production**: Logging, health checks, security headers, audit trail đầy đủ

### Đối tượng sử dụng
- Team phát triển Django muốn có foundation chất lượng cho management systems
- Đã quen Django cơ bản, từng dùng Cookiecutter Django 1-2 lần

### Kiến trúc tổng quan
- **Single-tenant**: Mỗi tổ chức deploy riêng instance
- **Monolith**: Django monolith với API layer, không microservices
- **2 môi trường**: Local (development) + Production

---

## 2. Tech Stack

### Core
| Package | Version | Mục đích |
|---|---|---|
| Python | 3.12+ | Runtime |
| Django | 5.1+ | Web framework |
| djangorestframework | 3.15+ | REST API |
| django-unfold | latest | Admin UI |
| PostgreSQL | 16+ | Database |
| Redis | 7+ | Cache + Message broker |
| Celery | 5.4+ | Background tasks |
| django-celery-beat | latest | Periodic tasks scheduler |

### Authentication
| Package | Mục đích |
|---|---|
| djangorestframework-simplejwt | JWT auth cho API |
| Django session auth | Session auth cho Admin UI |

### API & Documentation
| Package | Mục đích |
|---|---|
| drf-spectacular | OpenAPI 3.0 schema + Swagger UI + ReDoc |
| django-filter | Filtering cho API endpoints |
| django-cors-headers | CORS configuration |

### Observability
| Package | Mục đích |
|---|---|
| django-structlog | Structured JSON logging |
| django-health-check | Health check endpoints (DB, Redis, Celery) |

### Audit & Data
| Package | Mục đích |
|---|---|
| django-auditlog | Audit trail cho model changes |

### Real-time
| Package | Mục đích |
|---|---|
| channels | Django Channels WebSocket support |
| channels-redis | Redis channel layer backend |

### Development & Testing
| Package | Mục đích |
|---|---|
| pytest-django | Test runner |
| factory-boy | Test data factories |
| Ruff | Linter + formatter |
| pre-commit | Git hooks |
| django-extensions | Development utilities |
| django-debug-toolbar | Debug toolbar (local only) |
| Mailpit | Local email testing |

### Infrastructure
| Tool | Mục đích |
|---|---|
| Docker + Docker Compose | Containerization |
| Gunicorn | WSGI server (production) |
| Daphne | ASGI server (Channels, production) |

---

## 3. Project Structure

```
edu-ecosystem/
├── config/                          # Django project config
│   ├── settings/
│   │   ├── base.py                  # Shared settings
│   │   ├── local.py                 # Development settings
│   │   └── production.py            # Production settings
│   ├── urls.py                      # Root URL config
│   ├── wsgi.py
│   ├── asgi.py                      # ASGI config (Channels)
│   ├── celery_app.py                # Celery application
│   └── api_router.py               # API URL router
│
├── apps/                            # Django applications
│   ├── core/                        # Base models, mixins, utilities
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── base.py              # BaseModel (UUID, timestamps)
│   │   │   ├── soft_delete.py       # SoftDeleteModel, SoftDeleteManager
│   │   │   └── mixins.py            # AuditMixin, các mixins khác
│   │   ├── management/
│   │   │   └── commands/
│   │   │       ├── seed_groups.py   # Seed RBAC groups + permissions
│   │   │       └── seed_superuser.py # Create initial superuser
│   │   ├── middleware/
│   │   │   ├── request_log.py       # Request/response logging
│   │   │   └── current_user.py      # Thread-local current user
│   │   ├── permissions.py           # Custom DRF permissions
│   │   ├── pagination.py            # Custom pagination classes
│   │   ├── throttling.py            # Throttle configurations
│   │   ├── views.py                 # Health check views
│   │   ├── tasks.py                 # Base Celery task classes
│   │   └── utils.py                 # Shared utilities
│   │
│   └── users/                       # User management
│       ├── models.py                # Custom User model
│       ├── admin.py                 # Unfold admin config
│       ├── api/
│       │   ├── serializers.py       # User serializers
│       │   └── views.py             # Auth + User API views
│       ├── factories.py             # Factory Boy factories
│       ├── tests/
│       │   ├── test_models.py
│       │   ├── test_api.py
│       │   └── test_admin.py
│       └── urls.py
│
├── locale/                          # i18n translation files
│   ├── vi/LC_MESSAGES/
│   └── en/LC_MESSAGES/
│
├── docs/
│   └── specs/                       # Specification documents
│
├── requirements/
│   ├── base.txt                     # Shared dependencies
│   ├── local.txt                    # Dev dependencies
│   └── production.txt               # Prod dependencies
│
├── compose/                         # Docker configs
│   ├── local/
│   │   └── django/
│   │       ├── Dockerfile
│   │       └── start
│   └── production/
│       └── django/
│           ├── Dockerfile
│           └── start
│
├── docker-compose.local.yml
├── docker-compose.production.yml
├── manage.py
├── pyproject.toml                   # Ruff config, project metadata
├── .pre-commit-config.yaml
├── .env.example                     # Environment variables template
└── README.md
```

---

## 4. Authentication & Authorization

### 4.1 Dual Auth Strategy

| Context | Method | Library |
|---|---|---|
| API (mobile, SPA, external) | JWT (Bearer token) | SimpleJWT |
| Admin UI (browser) | Django Session | Django built-in |

### 4.2 JWT Configuration

```python
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "ROTATE_REFRESH_TOKENS": False,        # Long-lived, không rotate
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}
```

### 4.3 API Auth Endpoints

```
POST /api/v1/auth/login/           # Lấy access + refresh token
POST /api/v1/auth/refresh/         # Refresh access token
POST /api/v1/auth/logout/          # Invalidate session (admin)
POST /api/v1/auth/change-password/ # Đổi mật khẩu
GET  /api/v1/auth/me/              # Thông tin user hiện tại
```

### 4.4 RBAC Design (Module-Level)

Sử dụng Django's built-in permission system:

**Permission format**: `app_label.action_modelname`
- VD: `users.add_user`, `users.change_user`, `users.delete_user`, `users.view_user`

**Groups** (role presets):
```python
GROUPS = {
    "admin": {
        "description": "Full system access",
        "permissions": "__all__",  # All permissions
    },
    "manager": {
        "description": "Manage data, no system config",
        "permissions": [
            "users.view_user",
            # Thêm permissions cho từng app
        ],
    },
    "staff": {
        "description": "View and basic edit",
        "permissions": [
            "users.view_user",
        ],
    },
    "viewer": {
        "description": "Read-only access",
        "permissions": [
            # Chỉ view permissions
        ],
    },
}
```

**Cách sử dụng trong API views**:
```python
from rest_framework.permissions import DjangoModelPermissions

class SomeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, DjangoModelPermissions]
```

**Cách sử dụng trong Admin (Unfold)**:
Django admin tự động check permissions dựa trên `has_view_permission`, `has_change_permission`, etc.

### 4.5 User Model

```python
class User(AbstractUser):
    """
    Custom User model.
    Sử dụng email làm username field cho login.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        db_table = "users"
        verbose_name = "User"
        verbose_name_plural = "Users"
```

---

## 5. Base Models & Mixins

### 5.1 BaseModel (tất cả models kế thừa từ đây)

```python
class BaseModel(models.Model):
    """Base model với UUID primary key và timestamps."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]
```

### 5.2 SoftDeleteModel

```python
class SoftDeleteManager(models.Manager):
    """Manager chỉ trả về records chưa bị xóa."""
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)

class AllObjectsManager(models.Manager):
    """Manager trả về tất cả records kể cả đã xóa."""
    pass

class SoftDeleteModel(BaseModel):
    """Model hỗ trợ soft delete."""
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    objects = SoftDeleteManager()
    all_objects = AllObjectsManager()

    class Meta:
        abstract = True

    def soft_delete(self, user=None):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.deleted_by = user
        self.save(update_fields=["is_deleted", "deleted_at", "deleted_by"])

    def restore(self):
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.save(update_fields=["is_deleted", "deleted_at", "deleted_by"])
```

### 5.3 Audit Trail

Sử dụng `django-auditlog` để tự động ghi lại mọi thay đổi trên model:

```python
from auditlog.registry import auditlog

class MyModel(SoftDeleteModel):
    name = models.CharField(max_length=255)
    # ...

auditlog.register(MyModel)
```

Audit log tự động ghi:
- Ai thay đổi (user)
- Thay đổi gì (field name, old value, new value)
- Thời điểm thay đổi
- Action (create/update/delete)

### 5.4 Mixin pattern cho apps mới

```python
# Ví dụ: app mới chỉ cần kế thừa
from apps.core.models.soft_delete import SoftDeleteModel

class Product(SoftDeleteModel):
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        # UUID pk, created_at, updated_at, soft_delete đã có sẵn
        verbose_name = "Product"
```

---

## 6. API Design

### 6.1 URL Structure

```
/api/v1/                    # API version 1
/api/v1/auth/               # Authentication endpoints
/api/v1/users/              # User CRUD
/api/v1/schema/             # OpenAPI schema (JSON)
/api/v1/docs/               # Swagger UI
/api/v1/redoc/              # ReDoc
```

**Versioning implementation**:
```python
# config/api_router.py
from django.urls import include, path

app_name = "api"

urlpatterns = [
    path("v1/", include("config.api_v1_urls")),
]

# config/api_v1_urls.py
urlpatterns = [
    path("auth/", include("apps.users.urls")),
    path("users/", include("apps.users.api_urls")),
    # Thêm app mới ở đây
]
```

### 6.2 DRF Configuration

```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/day",
        "user": "1000/day",
    },
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}
```

### 6.3 Pagination

```python
class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
```

### 6.4 API Response Format

Sử dụng DRF default format (không wrap trong envelope):

```json
// Success (list)
{
    "count": 100,
    "next": "http://api/v1/users/?page=2",
    "previous": null,
    "results": [...]
}

// Success (detail)
{"id": "uuid", "email": "user@example.com", ...}

// Error
{"detail": "Not found."}

// Validation error
{"email": ["This field is required."], "name": ["Max 255 characters."]}
```

### 6.5 drf-spectacular Configuration

```python
SPECTACULAR_SETTINGS = {
    "TITLE": "Management System API",
    "DESCRIPTION": "API documentation",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": "/api/v[0-9]",
    "COMPONENT_SPLIT_REQUEST": True,
}
```

---

## 7. Celery & Background Tasks

### 7.1 Celery Configuration

```python
# config/celery_app.py
import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")

app = Celery("edu_ecosystem")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
```

```python
# settings/base.py
CELERY_BROKER_URL = env("REDIS_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = CELERY_BROKER_URL
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "Asia/Ho_Chi_Minh"
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes hard limit
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60  # 25 minutes soft limit
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"
```

### 7.2 Base Task Class

```python
# apps/core/tasks.py
from celery import Task
import structlog

logger = structlog.get_logger(__name__)

class BaseTask(Task):
    """Base task với logging và error handling."""
    autoretry_for = (Exception,)
    retry_backoff = True
    retry_backoff_max = 600  # 10 minutes max
    retry_jitter = True
    max_retries = 3

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error("task_failed", task=self.name, task_id=task_id, error=str(exc))
        super().on_failure(exc, task_id, args, kwargs, einfo)

    def on_success(self, retval, task_id, args, kwargs):
        logger.info("task_succeeded", task=self.name, task_id=task_id)
        super().on_success(retval, task_id, args, kwargs)
```

### 7.3 Task Patterns

**Email tasks**:
```python
@app.task(base=BaseTask, rate_limit="10/m")
def send_email_task(subject, to_email, template_name, context):
    # Send email logic
    pass
```

**Report/Export tasks** (long-running):
```python
@app.task(base=BaseTask, time_limit=3600, soft_time_limit=3000)
def generate_report_task(report_type, filters, user_id):
    # Generate report, save to file
    pass
```

**Periodic tasks** (via Celery Beat + django-celery-beat):
- Cleanup expired sessions: daily
- Cleanup soft-deleted records (> 30 days): weekly
- Health check notifications: every 5 minutes (optional)

---

## 8. Admin UI (Django Unfold)

### 8.1 Configuration

```python
# settings/base.py
INSTALLED_APPS = [
    "unfold",
    "unfold.contrib.filters",
    "unfold.contrib.forms",
    "django.contrib.admin",
    # ...
]

UNFOLD = {
    "SITE_TITLE": "Management System",
    "SITE_HEADER": "Management System",
    "SITE_URL": "/",
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": True,
    "SIDEBAR": {
        "show_search": True,
        "show_all_applications": False,
        "navigation": [
            {
                "title": "Authentication",
                "separator": True,
                "items": [
                    {
                        "title": "Users",
                        "icon": "person",
                        "link": "admin:users_user_changelist",
                        "permission": lambda request: request.user.has_perm("users.view_user"),
                    },
                    {
                        "title": "Groups",
                        "icon": "group",
                        "link": "admin:auth_group_changelist",
                        "permission": lambda request: request.user.has_perm("auth.view_group"),
                    },
                ],
            },
            {
                "title": "System",
                "separator": True,
                "items": [
                    {
                        "title": "Periodic Tasks",
                        "icon": "schedule",
                        "link": "admin:django_celery_beat_periodictask_changelist",
                    },
                    {
                        "title": "Audit Logs",
                        "icon": "history",
                        "link": "admin:auditlog_logentry_changelist",
                    },
                ],
            },
        ],
    },
}
```

### 8.2 Base ModelAdmin

```python
# apps/core/admin.py
from unfold.admin import ModelAdmin

class BaseModelAdmin(ModelAdmin):
    """Base admin class cho tất cả models."""
    readonly_fields = ("id", "created_at", "updated_at")
    list_per_page = 25
    save_on_top = True

class SoftDeleteModelAdmin(BaseModelAdmin):
    """Admin class cho soft-delete models."""
    readonly_fields = ("id", "created_at", "updated_at", "is_deleted", "deleted_at", "deleted_by")

    def get_queryset(self, request):
        return self.model.all_objects.all()

    def delete_model(self, request, obj):
        obj.soft_delete(user=request.user)

    def delete_queryset(self, request, queryset):
        queryset.update(
            is_deleted=True,
            deleted_at=timezone.now(),
            deleted_by=request.user,
        )
```

### 8.3 User Admin

```python
from unfold.admin import ModelAdmin
from unfold.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm

@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm
    list_display = ("email", "username", "is_active", "is_staff", "created_at")
    list_filter = ("is_active", "is_staff", "is_superuser", "groups")
    search_fields = ("email", "username", "first_name", "last_name")
    ordering = ("-created_at",)
```

---

## 9. Logging & Observability

### 9.1 Structured Logging (django-structlog)

```python
# settings/base.py
import structlog

MIDDLEWARE = [
    "django_structlog.middlewares.RequestMiddleware",
    # ... other middleware
]

DJANGO_STRUCTLOG_COMMAND_LOGGING_ENABLED = True

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": structlog.stdlib.ProcessorFormatter,
            "processor": structlog.dev.ConsoleRenderer(),  # local
            # "processor": structlog.processors.JSONRenderer(),  # production
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {"level": "INFO"},
        "django.db.backends": {"level": "WARNING"},
        "celery": {"level": "INFO"},
    },
}
```

### 9.2 Health Check Endpoints

```python
# settings/base.py
INSTALLED_APPS += [
    "health_check",
    "health_check.db",
    "health_check.cache",
    "health_check.contrib.celery",
    "health_check.contrib.redis",
]

# config/urls.py
urlpatterns = [
    path("health/", include("health_check.urls")),
]
```

**Endpoints**:
- `GET /health/` — HTML status page
- `GET /health/?format=json` — JSON response cho monitoring tools

### 9.3 Request Logging Middleware

Mỗi request được log với:
- `request_id` (UUID, auto-generated)
- `user_id`
- `method`, `path`
- `status_code`
- `duration_ms`
- `ip_address`

---

## 10. Docker & Deployment

### 10.1 Docker Compose (Local)

Services:
- **django**: Web server (runserver cho local)
- **postgres**: PostgreSQL 16
- **redis**: Redis 7
- **celeryworker**: Celery worker
- **celerybeat**: Celery Beat scheduler
- **mailpit**: Email testing UI (port 8025)

### 10.2 Docker Compose (Production)

Services:
- **django**: Gunicorn + Daphne (for Channels)
- **postgres**: PostgreSQL 16
- **redis**: Redis 7
- **celeryworker**: Celery worker
- **celerybeat**: Celery Beat scheduler

### 10.3 Environment Variables (.env)

```bash
# Django
DJANGO_SETTINGS_MODULE=config.settings.local
DJANGO_SECRET_KEY=change-me-in-production
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/dbname

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
ACCESS_TOKEN_LIFETIME_MINUTES=30
REFRESH_TOKEN_LIFETIME_DAYS=14

# Email
EMAIL_HOST=localhost
EMAIL_PORT=1025

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080

# Security
DJANGO_SECURE_SSL_REDIRECT=False
DJANGO_SECURE_HSTS_SECONDS=0
```

---

## 11. Code Quality & Testing

### 11.1 Ruff Configuration (pyproject.toml)

```toml
[tool.ruff]
target-version = "py312"
line-length = 119

[tool.ruff.lint]
select = [
    "F",    # pyflakes
    "E",    # pycodestyle errors
    "W",    # pycodestyle warnings
    "I",    # isort
    "N",    # pep8-naming
    "UP",   # pyupgrade
    "B",    # flake8-bugbear
    "DJ",   # flake8-django
]
ignore = ["E501"]

[tool.ruff.lint.isort]
known-first-party = ["apps", "config"]
```

### 11.2 Pre-commit (.pre-commit-config.yaml)

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
```

### 11.3 Pytest Configuration

```toml
# pyproject.toml
[tool.pytest.ini_options]
DJANGO_SETTINGS_MODULE = "config.settings.test"
python_files = ["test_*.py"]
addopts = [
    "--strict-markers",
    "--reuse-db",
    "-ra",
]
```

### 11.4 Test Settings

```python
# config/settings/test.py
from .local import *  # noqa

# Faster password hashing for tests
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# In-memory email
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Celery eager mode (synchronous)
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
```

### 11.5 Factory Pattern

```python
# apps/users/factories.py
import factory
from apps.users.models import User

class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        django_get_or_create = ("email",)

    username = factory.Sequence(lambda n: f"user{n}")
    email = factory.LazyAttribute(lambda o: f"{o.username}@example.com")
    password = factory.PostGenerationMethodCall("set_password", "testpass123")
    is_active = True

class AdminFactory(UserFactory):
    is_staff = True
    is_superuser = True
```

### 11.6 Sample Tests

```python
# apps/users/tests/test_api.py
import pytest
from rest_framework.test import APIClient
from apps.users.factories import UserFactory

@pytest.mark.django_db
class TestAuthAPI:
    def setup_method(self):
        self.client = APIClient()
        self.user = UserFactory()

    def test_login_success(self):
        response = self.client.post("/api/v1/auth/login/", {
            "email": self.user.email,
            "password": "testpass123",
        })
        assert response.status_code == 200
        assert "access" in response.data
        assert "refresh" in response.data

    def test_login_wrong_password(self):
        response = self.client.post("/api/v1/auth/login/", {
            "email": self.user.email,
            "password": "wrongpass",
        })
        assert response.status_code == 401

    def test_me_authenticated(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/v1/auth/me/")
        assert response.status_code == 200
        assert response.data["email"] == self.user.email

    def test_me_unauthenticated(self):
        response = self.client.get("/api/v1/auth/me/")
        assert response.status_code == 401
```

---

## 12. Internationalization (i18n)

### 12.1 Settings

```python
LANGUAGE_CODE = "vi"
LANGUAGES = [
    ("vi", "Tiếng Việt"),
    ("en", "English"),
]
USE_I18N = True
USE_L10N = True
LOCALE_PATHS = [BASE_DIR / "locale"]
```

### 12.2 Middleware

```python
MIDDLEWARE = [
    # ...
    "django.middleware.locale.LocaleMiddleware",
    # ...
]
```

### 12.3 Usage

```python
from django.utils.translation import gettext_lazy as _

class MyModel(SoftDeleteModel):
    name = models.CharField(_("Name"), max_length=255)

    class Meta:
        verbose_name = _("My Model")
        verbose_name_plural = _("My Models")
```

---

## 13. Django Channels

### 13.1 Configuration

```python
# settings/base.py
INSTALLED_APPS += ["channels"]

ASGI_APPLICATION = "config.asgi.application"

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [env("REDIS_URL", default="redis://localhost:6379/0")],
        },
    },
}
```

### 13.2 ASGI Setup

```python
# config/asgi.py
import os
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    # "websocket": URLRouter([...]),  # Uncomment khi cần WebSocket
})
```

Channels chỉ được cấu hình sẵn, chưa có consumer cụ thể. Khi cần WebSocket, developer thêm consumer và routing vào app tương ứng.

---

## 14. Data Seeding

### 14.1 Management Commands

**seed_groups**: Tạo/cập nhật RBAC groups và permissions
```bash
python manage.py seed_groups
```
- Idempotent: chạy nhiều lần không tạo duplicate
- Đọc config từ dictionary trong code (dễ version control)
- Output: tên group + số permissions được assign

**seed_superuser**: Tạo superuser ban đầu
```bash
python manage.py seed_superuser --email admin@example.com --password admin123
```
- Skip nếu email đã tồn tại
- Dùng cho initial deployment và CI/CD

### 14.2 Post-deploy Checklist

```bash
# 1. Run migrations
python manage.py migrate

# 2. Seed groups/permissions
python manage.py seed_groups

# 3. Create superuser
python manage.py seed_superuser --email admin@example.com --password <secure-password>

# 4. Collect static files (production)
python manage.py collectstatic --noinput
```

---

## 15. Security

### 15.1 CORS (django-cors-headers)

```python
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = env.bool("CORS_ALLOW_ALL_ORIGINS", default=False)  # True only in local
```

### 15.2 Security Headers (Production)

```python
# settings/production.py
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
```

### 15.3 Rate Limiting

DRF built-in throttling (đã cấu hình ở section 6.2):
- Anonymous: 100 requests/day
- Authenticated: 1000 requests/day
- Custom per-view throttle khi cần

---

## 16. Cookiecutter Django Options

Khi generate project, sử dụng các options sau:

```
project_name: edu_ecosystem
project_slug: edu_ecosystem
description: Django Management System Boilerplate
author_name: <your-name>
domain_name: example.com
email: <your-email>
version: 0.1.0
open_source_license: Not open source
timezone: Asia/Ho_Chi_Minh
windows: n
editor: None
use_docker: y
postgresql_version: 16
cloud_provider: None
mail_service: Other SMTP
use_async: n
use_drf: y
frontend_pipeline: None
use_celery: y
use_mailpit: y
use_sentry: n
use_whitenoise: y
use_heroku: n
ci_tool: None
keep_local_envs_in_vcs: y
debug: n
```

**Sau khi generate, cần thêm thủ công**:
1. Django Unfold
2. SimpleJWT
3. drf-spectacular
4. django-cors-headers
5. django-filter
6. django-structlog
7. django-health-check
8. django-auditlog
9. Django Channels + channels-redis
10. django-celery-beat
11. Restructure sang `apps/` directory

---

## Appendix: Quick Start Guide

```bash
# 1. Clone repo
git clone <repo-url>
cd edu-ecosystem

# 2. Build & start containers
docker compose -f docker-compose.local.yml up --build -d

# 3. Run migrations
docker compose -f docker-compose.local.yml run --rm django python manage.py migrate

# 4. Seed data
docker compose -f docker-compose.local.yml run --rm django python manage.py seed_groups
docker compose -f docker-compose.local.yml run --rm django python manage.py seed_superuser --email admin@example.com --password admin123

# 5. Access
# Admin UI: http://localhost:8000/admin/
# API Docs: http://localhost:8000/api/v1/docs/
# Mailpit:  http://localhost:8025/
# Health:   http://localhost:8000/health/
```

---

## Appendix: Thêm App Mới (Developer Guide)

```bash
# 1. Tạo app
mkdir -p apps/products
python manage.py startapp products apps/products

# 2. Cập nhật apps.py
class ProductsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.products"
    verbose_name = "Products"

# 3. Model kế thừa SoftDeleteModel
from apps.core.models import SoftDeleteModel

class Product(SoftDeleteModel):
    name = models.CharField(max_length=255)
    # UUID pk, timestamps, soft delete tự động có sẵn

# 4. Register audit log
from auditlog.registry import auditlog
auditlog.register(Product)

# 5. Admin dùng SoftDeleteModelAdmin
from apps.core.admin import SoftDeleteModelAdmin

@admin.register(Product)
class ProductAdmin(SoftDeleteModelAdmin):
    list_display = ("name", "created_at", "is_deleted")

# 6. API dùng DjangoModelPermissions
class ProductViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, DjangoModelPermissions]
    # RBAC tự động check dựa trên group permissions

# 7. Thêm vào INSTALLED_APPS và api_v1_urls.py
```
