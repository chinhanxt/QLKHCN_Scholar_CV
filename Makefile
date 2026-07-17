COMPOSE_FILE := docker-compose.local.yml
DC := docker compose -f $(COMPOSE_FILE)
RUN := $(DC) run --rm django
MANAGE := $(RUN) python manage.py

.PHONY: help build up down restart logs ps prune \
	front front-install dev \
	migrate makemigrations shell dbshell \
	createsuperuser seed seed-groups seed-superuser \
	test test-v lint format pre-commit \
	manage collectstatic messages compilemessages \
	e2e reset-password

## —— Docker ——————————————————————————————————————————————

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## Build all Docker images
	$(DC) build

up: ## Start backend containers (Django :8000, Postgres, Redis, Celery...)
	$(DC) up -d --remove-orphans

front-install: ## Install frontend npm dependencies (run on the host)
	cd frontend && npm install

front: ## Run the React SPA locally on the host (Vite dev server :5173)
	cd frontend && npm run dev

dev: up ## Start backend (Docker) + frontend (local Vite) in one command
	@echo "Backend up on :8000 — starting frontend on :5173 (Ctrl-C stops frontend; backend keeps running, use 'make down' to stop it)"
	cd frontend && npm run dev

down: ## Stop all containers
	$(DC) down

restart: down up ## Restart all containers

logs: ## Tail container logs (use s=django for specific service)
	$(DC) logs -f $(s)

ps: ## Show running containers
	$(DC) ps

prune: ## Remove containers and volumes (DESTRUCTIVE)
	$(DC) down -v --remove-orphans

## —— Django ——————————————————————————————————————————————

migrate: ## Run database migrations
	$(MANAGE) migrate

makemigrations: ## Create new migrations
	$(MANAGE) makemigrations

shell: ## Open Django shell
	$(MANAGE) shell

dbshell: ## Open database shell
	$(MANAGE) dbshell

manage: ## Run manage.py command (use cmd="command args")
	$(MANAGE) $(cmd)

collectstatic: ## Collect static files
	$(MANAGE) collectstatic --noinput

messages: ## Extract translation strings
	$(MANAGE) makemessages -l vi -l en

compilemessages: ## Compile translation files
	$(MANAGE) compilemessages

## —— Auth & Seeding ——————————————————————————————————————

createsuperuser: ## Create superuser interactively
	$(MANAGE) createsuperuser

seed: seed-groups seed-superuser ## Seed groups + superuser

seed-groups: ## Seed RBAC groups and permissions
	$(MANAGE) seed_groups

seed-superuser: ## Create default superuser (admin@example.com / admin123)
	$(MANAGE) seed_superuser --email admin@example.com --password admin123

reset-password: ## Reset admin password (use email=x pw=y)
	$(MANAGE) shell -c "from django.contrib.auth import get_user_model; u=get_user_model().objects.get(email='$(email)'); u.set_password('$(pw)'); u.save(); print('OK')"

## —— Testing —————————————————————————————————————————————

test: ## Run pytest
	$(RUN) pytest

test-v: ## Run pytest verbose
	$(RUN) pytest -v

e2e: ## Run Playwright e2e tests
	cd e2e && npx playwright test --config=playwright.config.ts

## —— Code Quality ————————————————————————————————————————

lint: ## Run Ruff linter
	$(RUN) ruff check .

format: ## Run Ruff formatter
	$(RUN) ruff format .

pre-commit: ## Run pre-commit on all files
	pre-commit run --all-files

## —— Quick Start —————————————————————————————————————————

init: build up migrate seed ## Full project init (build + up + migrate + seed)
