# SwiftEats Backend (NestJS Modular Monolith)

## Overview
 SwiftEats backend built with NestJS and TypeScript following a modular-monolith architecture. This repository provides a production-grade foundation with validation, linting, testing, and CI out of the box.

## Requirements
- Node.js 20+ (matches CI; see `package.json` engines)
- npm (package manager)
- Optional: Docker and kubectl for container/K8s workflows

## Project Structure
- `src/main.ts`: App bootstrap, global middleware, pipes, filters, interceptors.
- `src/app.module.ts`: Root module wiring config and feature modules.
- `src/common/`: Cross-cutting concerns
  - `constants/`, `decorators/`, `filters/`, `guards/`, `interceptors/`, `security/`, `types/`
- `src/config/`: Environment configuration and validation (see `EnvVariables`).
- `src/modules/health/`: Health checks.
- `src/modules/restaurants/`: Restaurant & Menu Catalog (in progress).
- `src/modules/auth/`, `src/modules/users/`, `src/modules/profiles/`: Auth & user domain (scaffolding; evolving).
- `test/`: Jest unit tests.

## Run Locally
1. Copy env file: `cp .env.example .env`
2. Install dependencies: `npm install`
3. Start dev server: `npm run start:dev`
4. API base path: `/api/v1` (e.g., `GET /api/v1/health`)

## Scripts
- `npm run build` — compile TypeScript
- `npm run start` — run compiled app
- `npm run start:dev` — run with watch (Hot Reload)
- `npm run start:debug` — run with debugger
- `npm run lint` — ESLint
- `npm run format` — Prettier format
- `npm test` — run unit tests
- `npm run test:watch` — watch tests
- `npm run test:cov` — test coverage
- `npm run prepare` — setup Git hooks (husky)

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

## Environment Variables
Copy `.env.example` to `.env` and set values:
- `NODE_ENV`: `development` | `test` | `production`
- `PORT`: HTTP port (default 3000)
- `JWT_SECRET` (required): secret for signing access tokens
- `JWT_EXPIRES_IN`: e.g., `15m`, `1h` (default `15m`)
- `JWT_ISSUER`: logical issuer (default `swifteats`)
- `JWT_AUDIENCE`: logical audience (default `swifteats-api`)
- `ENCRYPTION_KEY` (required): Base64-encoded 32-byte key for AES-256-GCM
- `OAUTH_GOOGLE_CLIENT_ID` / `OAUTH_GOOGLE_CLIENT_SECRET` (optional)
- `CACHE_PROVIDER`: `memory` (default) or `redis`
- `REDIS_URL`: required if `CACHE_PROVIDER=redis` (e.g., `redis://localhost:6379`)
- `REDIS_KEY_PREFIX` (optional)
- `CDN_BASE_URL` (optional)

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

## Docker Compose
To build and run the system locally using Docker Compose, follow these steps:

1. **Ensure Docker is installed**: Make sure you have Docker and Docker Compose installed on your machine.

2. **Copy the environment file**: Duplicate the example environment file and modify it as needed:
   ```bash
   cp .env.example .env
   ```

3. **Build and start the containers**: Use Docker Compose to build the images and start the containers:
   ```bash
   docker-compose up --build
   ```
   This command will build the necessary Docker images and start the containers as defined in the `docker-compose.yml` file.

4. **Verify the setup**: Once the containers are running, verify that the application is working correctly by accessing the health check endpoint:
   ```bash
   curl http://localhost:3000/api/v1/health
   ```
   You should receive a response indicating the status, uptime, and timestamp.

5. **Stopping the containers**: To stop the running containers, use:
   ```bash
   docker-compose down
   ```
   This will stop and remove the containers, networks, and volumes defined in the `docker-compose.yml` file.

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
