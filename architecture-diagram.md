```mermaid
graph TD;
    Client[Client (Web or Mobile)] -->|API Request| APIGateway[API Gateway (Ingress/Service in Kubernetes)];
    APIGateway -->|Routes Request| NestJSApp[NestJS App (Single Pod)];
    NestJSApp -->|Delegates to| Controllers[Controllers (Health, Auth, Users, Profiles, Restaurants)];
    Controllers -->|Executes| Services[Services (Business Logic)];
    Services -->|Uses| Repositories[Repositories (Persistence Abstraction)];
    Repositories -->|Reads/Writes| PostgreSQL[(PostgreSQL)];
    Services -->|Caches| Redis[(Redis)];
    Services -->|Caches| InMemory[(In-Memory Cache)];
    Client -->|CDN Request| CDNRewriter[CDN Rewriter];
    NestJSApp -->|Cross-cutting Concerns| CrossCutting[Cross-cutting Concerns];
    CrossCutting -->|Includes| Validation[Validation Pipe];
    CrossCutting -->|Includes| ErrorHandling[Exception Filter];
    CrossCutting -->|Includes| Logging[Logging Interceptor];
    CrossCutting -->|Includes| RolesGuard[Roles Guard];
    NestJSApp -->|Logs| Console[Console Logs];
    NestJSApp -->|Probes| Health[Health Module];
    NestJSApp -->|Runs in| Docker[Docker Container];
    Docker -->|Orchestrated by| Kubernetes[Kubernetes];
```
