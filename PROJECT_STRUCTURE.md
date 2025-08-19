# Project Structure

This document explains how the SwiftEats backend repository is organized and the purpose of each folder and key module.

## High-level layout

- `src/` — Application source (NestJS + TypeScript)
- `test/` — Unit tests (Jest)
- `docs/` — Product/domain docs and schemas (e.g., SQL)
- `tasks/` — Task-by-task implementation plan and progress
- `deploy/` — Kubernetes manifests for dev/stage/prod
- `.github/workflows/` — CI pipeline (lint, build, test)
- Root configs — Linting/formatting/build/tooling (ESLint, Prettier, Jest, tsconfig, Dockerfile)

## Runtime flow

- `src/main.ts` — Bootstraps Nest application.
  - Security and performance: `helmet`, `compression`.
  - Input validation: global `ValidationPipe` (whitelist, transform).
  - Cross-cutting: `LoggingInterceptor`, `HttpExceptionFilter`.
  - API base path: `${APP_CONSTANTS.API_PREFIX}/${APP_CONSTANTS.API_VERSION}` → `/api/v1`.
  - Graceful shutdown hooks enabled.
- `src/app.module.ts` — Root module wiring:
  - Loads configuration via `ConfigModule.forRoot({ isGlobal: true, validate })`.
  - Imports feature modules: `HealthModule`, `UsersModule`, `AuthModule`, `ProfilesModule`, `RestaurantsModule`.
  - Registers `RolesGuard` as global guard using `{ provide: APP_GUARD, useClass: RolesGuard }`.

## Configuration

- `src/config/`
  - `env-variables.ts` — `EnvVariables` class defines and validates environment variables (e.g., `NODE_ENV`, `PORT`, `JWT_*`, `ENCRYPTION_KEY`, `CACHE_PROVIDER`, `REDIS_*`, `CDN_BASE_URL`).
  - `validate-env.ts` — `validate()` function used by `ConfigModule` to transform and validate env vars against `EnvVariables`.
- `src/common/constants/app.constants.ts` — Centralized constants like `API_PREFIX`, `API_VERSION`, `DEFAULT_PORT`.

## Cross-cutting concerns (`src/common/`)

- `constants/` — Shared constants and enums (e.g., `roles.enum.ts`, `app.constants.ts`).
- `decorators/` — Custom decorators (future expansion).
- `filters/` — Global HTTP error handling (`HttpExceptionFilter`).
- `guards/` — Authorization guards (`RolesGuard`) applied globally.
- `interceptors/` — Cross-cutting interceptors (`LoggingInterceptor`).
- `security/` — Security helpers (future expansion).
- `types/` — Shared TypeScript types.

## Feature modules (`src/modules/`)

Each module follows NestJS conventions: `*.module.ts`, `*.controller.ts`, `*.service.ts`, plus supporting folders (e.g., `dto/`, `models/`, `repositories/`).

- `health/`
  - `health.controller.ts`, `health.service.ts`, `health.module.ts` — Liveness/readiness endpoints (`GET /api/v1/health`).

- `auth/`
  - `auth.controller.ts`, `auth.service.ts`, `auth.module.ts`.
  - `dto/` — Auth-related DTOs (`login.dto.ts`, `register.dto.ts`).
  - `strategies/` — Passport strategies (local, JWT, Google OAuth).

- `users/`
  - `users.service.ts`, `users.module.ts`, `user.model.ts` — User domain scaffolding.

- `profiles/`
  - `profiles.controller.ts`, `profiles.module.ts`, `dto/update-profile.dto.ts` — Profile management scaffolding.

- `restaurants/` — Restaurant & Menu Catalog (Task 003 In Progress)
  - `restaurants.controller.ts` — HTTP endpoints for onboarding, listing, details, menus.
  - `restaurants.service.ts` — Business logic. Injects repository and cache:
    - Repository: `RestaurantsRepository` (in-memory data and menu versioning).
    - Cache (DI token `'MenuCache'`): abstracts menu caching.
      - In-memory: `InMemoryMenuCache`.
      - Redis: `RedisMenuCache` (lazily imported).
    - CDN rewriting: uses `ConfigService` (`CDN_BASE_URL`) to rewrite relative `imageUrl` fields in menu items.
  - `repositories/restaurants.repository.ts` — Domain persistence in memory with helpers for slug lookup and menu versioning.
  - `models/` — Domain models (`restaurant.model.ts`, `menu.model.ts`).
  - `dto/` — Request/response DTOs (`create-restaurant.dto.ts`, `menu-item-input.dto.ts`, `upsert-menu.dto.ts`).
  - `cache/` — Cache interface and implementations:
    - `menu-cache.ts` — `MenuCache` interface.
    - `in-memory-menu-cache.ts` — In-process cache for menus.
    - `redis-menu-cache.ts` — Redis-based cache with versioned keys.
  - `utils/slug.util.ts` — Utility for generating/normalizing restaurant slugs.
  - `restaurants.module.ts` — Wires providers and selects cache based on configuration:
    - Provides `'MenuCache'` via factory with `ConfigService`.
    - `CACHE_PROVIDER=memory` (default) → `InMemoryMenuCache`.
    - `CACHE_PROVIDER=redis` → requires `REDIS_URL`; optional `REDIS_KEY_PREFIX` (default `se`).

## Types and ambient definitions

- `src/types/` — Ambient typings (e.g., `redis.d.ts`) and shared TS types.

## Testing

- `test/` — Jest tests organized by domain:
  - `health.controller.spec.ts`
  - `restaurants.controller.spec.ts`
  - `restaurants.service.spec.ts`
  - `auth.service.spec.ts`

## Documentation and tasks

- `docs/`
  - `catalog-schema.sql` — SQL schema draft for catalog domain.
- `tasks/`
  - Sequential task specs (`001-...` to `016-...`) plus `progress.md` tracking status.

## Deployment and operations

- `deploy/` — Kubernetes manifests
  - `namespace.yaml`, `configmap.yaml`, `deployment.yaml`, `service.yaml`.
- `.github/workflows/ci.yml` — CI pipeline: install → lint → build → test.
- `Dockerfile` — Production container image.

## Tooling and configuration (root)

- `package.json` — Scripts and dependencies.
- `tsconfig.json`, `tsconfig.build.json` — TypeScript configs.
- `jest.config.ts` — Jest configuration.
- `.eslintrc.cjs`, `.eslintignore` — ESLint.
- `.prettierrc.json`, `.prettierignore` — Prettier.
- `.husky/`, `lint-staged.config.js`, `commitlint.config.cjs` — Git hooks and conventional commits.
- `.env.example` — Example environment variables.

## Conventions

- TypeScript strict mode; avoid `any`.
- One export per file. Classes in PascalCase; variables/functions in camelCase.
- DTOs validated via `class-validator`. Prefer small, single-purpose functions.
- API base path: `/api/v1` (`APP_CONSTANTS`).
- Environments: dev/stage/prod. Secrets to be sourced from a manager (SSM/Vault) in later tasks.

## Extending the project

- Add a new domain feature by creating a module under `src/modules/<feature>/` with `*.module.ts`, `*.controller.ts`, `*.service.ts`.
- Define DTOs in `dto/` and domain models in `models/`.
- Add cross-cutting utilities under `src/common/` only if shared across modules.
- For configuration, extend `EnvVariables` and update `.env.example`. Validate via `validate()` in `validate-env.ts`.
- Add unit tests in `test/` mirroring the feature domain.
