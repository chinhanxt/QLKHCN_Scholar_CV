# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Django management system boilerplate (Cookiecutter Django-based) with DRF API, Celery task queue, Django Channels (WebSocket-ready), and Unfold admin UI. Python 3.13, Django 5.1+, PostgreSQL, Redis.

## IMPORTANT: Architecture constraint — frontend-first, NOT admin-driven

This project is a **backend (API) + React SPA frontend**. Django Admin is for backend developer/superuser maintenance ONLY — never the primary user interface.

- **DO NOT** build end-user features, workflows, or business operations through Django Admin / Unfold. Admin is not a substitute for the product UI.
- **Every user-facing feature MUST be delivered as**: a DRF REST API endpoint on the backend (`apps/*`, registered in `config/api_router.py`) **consumed by a React SPA frontend**.
- When asked to "add a feature / screen / management page", implement it as: (1) backend serializer + ViewSet + permissions + tests, then (2) the corresponding React SPA page calling that API. Do not implement it as a custom Django Admin page or Unfold customization.
- Keep registering models in `admin.py` only for internal data inspection by superusers; do not put product logic there.

## Common Commands

```bash
# Run dev server (local, without Docker)
uv run python manage.py runserver

# Run all tests
uv run pytest

# Run a single test file or specific test
uv run pytest apps/users/tests/test_api.py
uv run pytest apps/users/tests/test_api.py::TestUserAPI::test_list -k "test_list"

# Lint and format
uv run ruff check .
uv run ruff check --fix .
uv run ruff format .

# Type checking
uv run mypy edu_ecosystem

# Django management
uv run python manage.py makemigrations
uv run python manage.py migrate
uv run python manage.py createsuperuser
uv run python manage.py seed_groups      # Seed RBAC groups/permissions
uv run python manage.py seed_superuser --email=x --password=y

# Docker workflow (uses justfile, defaults to docker-compose.local.yml)
just up        # Start all containers
just down      # Stop containers
just logs      # View logs
just manage <command>  # Run manage.py inside container

# Celery (run from project root)
uv run celery -A config.celery_app worker -l info
uv run celery -A config.celery_app beat

# E2E tests (Playwright, requires running server on :8000)
cd e2e && npx playwright test

# Frontend (React SPA — the user-facing UI; see "Architecture constraint" above)
cd frontend && npm install
cd frontend && npm run dev      # http://localhost:5173, proxies /api -> :8000
cd frontend && npm run build    # tsc -b && vite build
cd frontend && npm run lint
```

## Frontend (React SPA)

Lives in `frontend/`. Stack: **React 19 + Vite + TypeScript + Tailwind v4 + TanStack Query + Axios + react-router-dom v7 + zustand + react-hook-form + zod + sonner**. Talks to the API via the Vite dev proxy (`/api` → `:8000`), JWT auth (login with **email**) with auto-refresh in `src/api/client.ts`.

- Structure: `src/api/` (axios client + `endpoints/` + `hooks/`), `src/components/` (`ui/` shadcn-style + `layout/` + `ProtectedRoute`), `src/lib/`, `src/pages/`, `src/stores/auth.store.ts`, `src/types/` (mirror DRF serializers), `routes.tsx`, `App.tsx`.
- **Runs locally, NOT in Docker**: only the backend (Django, Postgres, Redis, Celery) runs in Docker. The SPA runs on the host via Vite so adding an npm dependency never requires rebuilding/restarting a container. Workflow: `make up` (start backend on `:8000`), then `make front` (= `cd frontend && npm run dev`, serves `:5173`). First time / after pulling deps: `make front-install`. Vite proxies `/api` → `http://localhost:8000` (default in `vite.config.ts`; the `VITE_PROXY_TARGET` env var is only for non-default targets).
- **Convention to add a feature**: backend (serializer + ViewSet + permissions + tests, registered in `config/api_router.py`) → `api/endpoints/<x>.ts` → `api/hooks/use<X>.ts` → `pages/<X>Page.tsx` → add route in `routes.tsx`.

## Architecture

### Settings hierarchy
`config/settings/base.py` → extended by `local.py`, `production.py`, `test.py`. The `manage.py` defaults to `config.settings.local`; pytest uses `config.settings.test` (set via `--ds` in pyproject.toml).

### App structure
Apps live in `apps/` and are registered as `apps.core`, `apps.users`, etc. in `INSTALLED_APPS`. The `edu_ecosystem/` directory holds project-level files: templates, static assets, media, conftest, and site migrations (`contrib/`).

### Key conventions
- **Models**: Inherit from `apps.core.models.BaseModel` (UUID PK, `created_at`/`updated_at` timestamps) or `SoftDeleteModel` (adds soft-delete with `is_deleted`, `deleted_at`, `deleted_by`). SoftDeleteModel uses a filtered default manager (`objects`) — use `all_objects` to include deleted records.
- **User model**: `apps.users.models.User` extends `AbstractUser` with UUID PK, `email` as `USERNAME_FIELD`.
- **API pattern**: ViewSets registered on `config/api_router.py` via DRF's `DefaultRouter`. All endpoints under `/api/v1/`. Auth is JWT (`Bearer` token) via SimpleJWT. Pagination via `apps.core.pagination.StandardPagination`.
- **Permissions**: `apps.core.permissions.FullDjangoModelPermissions` adds view-permission enforcement (unlike default DRF `DjangoModelPermissions` which allows unauthenticated GET).
- **RBAC**: Groups seeded via `seed_groups` management command. Four roles: admin (all perms), manager, staff, viewer.
- **Current user access**: `apps.core.middleware.current_user.get_current_user()` provides thread-local access to the request user (for use in models/signals outside request context).

### API URLs
- Auth: `/api/v1/auth/login/`, `/api/v1/auth/refresh/`, `/api/v1/auth/me/`, `/api/v1/auth/change-password/`
- Resources: `/api/v1/users/`
- Docs: `/api/v1/docs/` (Swagger), `/api/v1/redoc/`
- Health: `/health/`
- Admin: `/admin/`

### Test setup
- pytest + pytest-django with `--reuse-db` and `--import-mode=importlib`
- Fixtures in `edu_ecosystem/conftest.py` (auto-uses tmpdir for `MEDIA_ROOT`)
- Factories use `factory_boy` (e.g., `apps/users/tests/factories.py`)
- Test settings use MD5 hasher (fast), in-memory email backend, eager Celery, in-memory channel layer

### Env configuration
- Uses `django-environ`; `.env` file read only when `DJANGO_READ_DOT_ENV_FILE=True`
- Docker env files: `.envs/.local/.django` and `.envs/.local/.postgres`
- See `.env.example` for all env vars

### Linting
Ruff with extensive rule set configured in `pyproject.toml`. Migrations and `staticfiles/` excluded. Pre-commit hooks include ruff, djLint (templates), django-upgrade, pyproject-fmt.

### i18n
Vietnamese (`vi`) primary, English secondary. Locale files in `locale/`. Timezone: `Asia/Ho_Chi_Minh`.
