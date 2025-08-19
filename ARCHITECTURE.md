# Architecture

SwiftEats backend is a modular monolith built with NestJS and TypeScript. The design emphasizes clear domain boundaries, high developer velocity, strong runtime safety, and a practical path to scale. This document explains the architecture, justifies the choices, and outlines how components collaborate in runtime and delivery.

## Goals and scope

- Deliver a production-ready API for a food delivery platform with clear domain modules.
- Optimize common read paths (catalog and menus) with caching and versioning.
- Maintain simplicity (single deployable) while enabling future modularization.
- Enforce consistency via configuration validation, coding standards, and CI.
- Operate reliably across dev, stage, and prod with containerized runtime and Kubernetes.

## Architectural pattern and rationale

- Pattern: Modular Monolith (NestJS)
  - Single deployable unit that contains multiple well-defined domain modules.
  - Shared cross-cutting concerns (validation, guards, filters, interceptors) applied consistently.
- Why this over microservices initially
  - Lower operational complexity: one codebase, one deployment pipeline, simple local dev.
  - Easier to refactor domain boundaries early while requirements evolve.
  - Avoids premature network boundaries and distributed system pitfalls.
- Evolution path
  - Modules are designed with clear interfaces and DI, allowing extraction into services if needed (for example, catalog as a separate service) without wholesale rewrite.

## Domain boundaries and responsibilities

- Health: Liveness and readiness endpoints.
- Auth: Authentication flows (local, JWT, optional OAuth), token issuance and verification.
- Users: Core user model and user-related services.
- Profiles: Profile management on top of the user domain.
- Restaurants (Catalog): Restaurant onboarding, discovery, and menu lifecycle with versioned menus and cache-first reads.
- Common (cross-cutting): Constants, decorators, filters, guards, interceptors, security helpers, shared types, configuration.

## Component overview and communication flows

- Client requests target the API base path /api/v1 and are routed to feature controllers.
- Controllers coordinate with services, which encapsulate business logic and interact with repositories and caches.
- Cache-first reads are used for menu queries; database (or in-memory store during early phases) acts as the source of truth.
- Configuration is centralized and validated at startup; environment selection drives cache choice and operational settings.

Diagram (textual):

- Client (Web or Mobile)
  -> API Gateway (Ingress/Service in Kubernetes)
  -> NestJS App (Single Pod with multiple replicas)
  -> Controllers (Health, Auth, Users, Profiles, Restaurants)
  -> Services (Business Logic)
  -> Repositories (Persistence abstraction)
  -> Primary Storage: PostgreSQL (planned; schema defined)
  -> Read Cache: Redis (preferred) or In-Memory (default)
  -> CDN Rewriter: optional URL rewriting for menu media
  -> Cross-cutting: Validation Pipe, Exception Filter, Logging Interceptor, Roles Guard
- Observability: Console logs (for now), readiness/liveness probes via Health module
- Platform: Docker container orchestrated by Kubernetes (dev/stage/prod)

## Data architecture

- Primary database: PostgreSQL (schema drafted for catalog domain)
  - Restaurants stored with read-optimized fields and indexes for common filters.
  - Menu versions append-only to support atomic publish, rollback, and cache invalidation via version bumps.
  - Latest menu view or query pattern supports DB fallback when cache misses occur.
- Identifiers: UUIDs for entities; slugs for SEO-friendly lookups in the catalog.

## Caching strategy

- Purpose: Accelerate read-heavy menu queries and reduce load on the primary database.
- Read path: Cache-first by restaurant identifier and version; latest version pointer key resolves to versioned payload.
- Write path: On menu upsert, bump version, persist new snapshot, then update latest pointer and invalidate previous cache as needed.
- Providers: In-memory cache for development; Redis for shared, production-grade caching.
- CDN rewriting: Optional transformation of relative image URLs to an external CDN base to optimize client delivery.

## Security architecture

- Authentication: JWT for stateless API access; optional social OAuth for login flows.
- Authorization: Role-based guard applied globally to protect administrative and owner endpoints.
- Input validation: Central, strict validation for DTOs to enforce schema and prevent malformed requests.
- Secrets management: Environment variables for now; migration to a secret manager (SSM/Vault) planned for production maturity.
- Transport: Deployed behind secure ingress; TLS termination managed at the platform or gateway layer.

## Cross-cutting concerns

- Configuration: Strongly typed env validation at startup; fail-fast on invalid configuration.
- Error handling: Global HTTP exception filter to normalize error responses.
- Logging: Console logging initially; structured logging and correlation IDs can be added without disrupting module code.
- Performance: Compression and sensible defaults at the framework layer; caching for hot paths.

## Operational architecture

- Runtime: Docker container running Node.js 20+
- Orchestration: Kubernetes deployments with separate namespaces per environment.
- Networking: Cluster Service and Ingress expose the API; readiness and liveness probes for health.
- CI/CD: GitHub Actions pipeline enforces lint, build, and test on every change to main and pull requests.
- Environments: Development, staging, production with environment-specific configuration and manifests.

## Technology justification

- NestJS and TypeScript
  - Strong modularity, DI, and testability; aligns with domain-driven module boundaries.
  - TypeScript strict mode improves runtime safety and developer productivity.
- PostgreSQL
  - Mature relational database with strong indexing and transactional guarantees; well-suited for catalog queries and append-only menu versioning.
- Redis
  - High-performance, low-latency read cache enabling versioned, atomic menu delivery and fast catalog responses.
- Docker and Kubernetes
  - Standardized runtime and horizontal scaling via replicas; clear separation of concerns between build and runtime.
- GitHub Actions
  - Reliable, maintainable CI for lint, build, and test; supports branch protection and conventional commits.
- Jest, ESLint, Prettier
  - Testing and quality gates that reinforce maintainability and consistent code style across the codebase.

## Trade-offs and non-goals

- Not microservices-first: Reduces initial complexity but centralizes scaling dimensions; mitigated by module boundaries and cache usage.
- Eventing and streaming are out of scope initially: Can be introduced later for asynchronous flows (for example, analytics, menu publish events).
- Observability is minimal by design at this phase: Incrementally add metrics, tracing, and structured logs as the system matures.

## Future evolution

- Extract catalog or auth into independently deployable services if domain and scale warrant.
- Introduce background workers for heavy tasks (for example, image processing, analytics aggregation).
- Implement structured logging, request tracing, and metrics dashboards.
- Migrate secrets to a managed secret store and adopt a formal configuration hierarchy.
