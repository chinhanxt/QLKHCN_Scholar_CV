# Edu Ecosystem — Frontend (React SPA)

React 19 + Vite + TypeScript + Tailwind v4 + TanStack Query + Axios. The single
user-facing UI for the project — Django Admin is for backend maintenance only.

## Stack
- **React 19**, **Vite**, **TypeScript**
- **Tailwind CSS v4** (`@tailwindcss/vite`)
- **TanStack Query** + **Axios** (server state, JWT auth with auto-refresh)
- **react-router-dom v7** (routing + protected routes)
- **zustand** (auth/client state, persisted)
- **react-hook-form** + **zod** (forms & validation)
- **sonner** (toasts), **lucide-react** (icons)

## Develop
```bash
npm install
npm run dev        # http://localhost:5173  (proxies /api -> :8000)
```
Run the Django backend in parallel: `uv run python manage.py runserver`.

## Build / lint
```bash
npm run build
npm run lint
```

## Auth contract (this backend)
- `POST /api/v1/auth/login/`  -> `{ access, refresh }` (login with **email** + password)
- `POST /api/v1/auth/refresh/` -> `{ access }`
- `GET  /api/v1/auth/me/`      -> current user
- `GET/PATCH /api/v1/users/`   -> users list & update

## Structure
```
src/
  api/         axios client (JWT refresh) + endpoints/ + hooks/
  components/  ui/ (shadcn-style) + layout/ + ProtectedRoute
  lib/         query-client, utils (cn), api-error
  pages/       LoginPage, DashboardPage, UsersPage
  stores/      auth.store (zustand persist)
  types/       API models (mirror DRF serializers)
  routes.tsx   router; App.tsx providers
```

## Adding a feature (convention)
1. Backend: serializer + ViewSet + permissions + tests, registered in `config/api_router.py`.
2. Frontend: `api/endpoints/<x>.ts` -> `api/hooks/use<X>.ts` -> `pages/<X>Page.tsx` -> add route.
