# SwiftEats Backend (NestJS Modular Monolith)

## Overview
SwiftEats backend built with NestJS and TypeScript following a modular-monolith architecture. This repository provides a production-grade foundation with validation, linting, testing, and CI out of the box.

## Project Structure
- `src/main.ts`: App bootstrap, global middleware, pipes, filters, interceptors.
- `src/app.module.ts`: Root module with config and feature modules.
- `src/common/`: Shared cross-cutting concerns (constants, filters, interceptors).
- `src/config/`: Environment configuration (class-based validation).
- `src/modules/health/`: Health checks.
- `test/`: Jest unit tests.

## Run Locally
1. Copy env file: `cp .env.example .env`
2. Install dependencies: `npm install`
3. Start dev server: `npm run start:dev`
4. API base path: `/api/v1` (e.g., `GET /api/v1/health`)

## Scripts
- `npm run build` — compile TypeScript
- `npm run start` — run compiled app
- `npm run start:dev` — run with watch
- `npm run lint` — lint with ESLint
- `npm test` — run unit tests

## Git Workflow
- Branch naming: `feature/<short-desc>`, `fix/<short-desc>`, `chore/<short-desc>`
- Conventional commits enforced via commitlint
- Create PRs to `main`, require CI to pass (build, lint, test)

## Coding Standards
- TypeScript strict mode; avoid `any`
- One export per file; PascalCase for classes; camelCase for vars/functions
- DTOs and configuration validated with classes
- Prefer immutability and small, single-purpose functions

## CI/CD
GitHub Actions runs on PRs and pushes to `main`:
- Install -> Lint -> Build -> Test

## Health Check
- `GET /api/v1/health` returns `{ status, uptime, timestamp }`

## Catalog (Restaurants & Menus)
- `POST /api/v1/restaurants` (auth required: owner/admin) — onboard a restaurant.
- `GET /api/v1/restaurants?city=&cuisine=&open=&page=&limit=` — list restaurants with filters and pagination.
- `GET /api/v1/restaurants/:slug` — get public restaurant details.
- `GET /api/v1/restaurants/:slug/menu` — get the latest menu (with Cache-Control headers for downstream caching).
- `PUT /api/v1/restaurants/:slug/menu` (auth required: owner/admin) — upsert full menu with optional optimistic `expectedVersion`.

### Cache & CDN
- `CACHE_PROVIDER`: `memory` (default) or `redis`.
- `REDIS_URL`: required when `CACHE_PROVIDER=redis` (e.g., `redis://localhost:6379`).
- `REDIS_KEY_PREFIX`: optional prefix (default: `se`).
- `CDN_BASE_URL`: optional base URL to rewrite relative `imageUrl` in menu items, e.g., `https://cdn.example.com`.

Redis cache uses versioned keys for atomic updates:
- `<prefix>:menu:<restaurantId>:latest` → latest version number
- `<prefix>:menu:<restaurantId>:v:<version>` → serialized `MenuModel`

## Docker
- Build image:
  ```bash
  docker build -t swifteats-backend:0.1.0 .
  ```
- Run container:
  ```bash
  docker run --rm -p 3000:3000 --env PORT=3000 --name swifteats swifteats-backend:0.1.0
  # Health check
  curl http://localhost:3000/api/v1/health
  ```

## Kubernetes (dev)
Manifests are in `deploy/`. Update `image:` in `deploy/deployment.yaml` to your registry (e.g., GHCR/ECR).

```bash
kubectl apply -f deploy/namespace.yaml
kubectl apply -n swifteats-dev -f deploy/configmap.yaml
kubectl apply -n swifteats-dev -f deploy/deployment.yaml
kubectl apply -n swifteats-dev -f deploy/service.yaml

# Port-forward for local access
kubectl -n swifteats-dev port-forward svc/swifteats-backend 8080:80
curl http://localhost:8080/api/v1/health
```

Notes:
- Namespace defaults to `swifteats-dev`. Adjust as needed per environment.
- Secrets (e.g., DB creds) should come from a secret manager (SSM/Vault) in later tasks.
 - Local Node: use Node 20+ to match CI (see `package.json` engines). If you are on Node 16, expect install warnings.
# food-delivery-platform
