# SwiftEats Docker Compose Setup

This document provides instructions on how to use the Docker Compose configuration for the SwiftEats food delivery platform.

## Overview

The Docker Compose file includes the following components:

### Core Services
- **API**: The main NestJS application
- **PostgreSQL**: Main database with PostGIS extension for geospatial data
- **PostgreSQL Replica**: Secondary database for high availability
- **Redis**: For caching, rate limiting, and message queues
- **Bull Dashboard**: UI for monitoring background jobs

### Observability Stack
- **Prometheus**: Metrics collection and storage
- **AlertManager**: Alert handling and notifications
- **Grafana**: Metrics visualization and dashboards
- **Elasticsearch**: Log storage and indexing
- **Logstash**: Log processing pipeline
- **Kibana**: Log visualization and analysis
- **Jaeger**: Distributed tracing

## Prerequisites

- Docker Engine (20.10+)
- Docker Compose (2.0+)
- At least 4GB of RAM allocated to Docker

## Getting Started

1. Create a `.env` file in the project root (you can copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

2. Start all services:
   ```bash
   docker-compose up -d
   ```

3. Start only core services (without observability stack):
   ```bash
   docker-compose up -d api postgres postgres_replica redis bull_dashboard
   ```

4. View logs from a specific service:
   ```bash
   docker-compose logs -f api
   ```

## Service Access

| Service | URL | Description |
|---------|-----|-------------|
| API | http://localhost:3000 | Main application API |
| WebSocket | ws://localhost:3001 | Real-time location updates |
| Bull Dashboard | http://localhost:3002 | Background job monitoring |
| Grafana | http://localhost:3003 | Metrics dashboards (admin/admin) |
| PostgreSQL | localhost:5432 | Main database |
| PostgreSQL Replica | localhost:5433 | Secondary database |
| Redis | localhost:6379 | Cache and message broker |
| Prometheus | http://localhost:9090 | Metrics storage |
| AlertManager | http://localhost:9093 | Alert management |
| Elasticsearch | http://localhost:9200 | Log storage |
| Kibana | http://localhost:5601 | Log visualization |
| Jaeger UI | http://localhost:16686 | Distributed tracing |

## Data Persistence

All data is persisted using Docker volumes:
- `postgres_data`: PostgreSQL database files
- `postgres_replica_data`: PostgreSQL replica database files
- `redis_data`: Redis data
- `prometheus_data`: Prometheus time-series data
- `alertmanager_data`: AlertManager data
- `grafana_data`: Grafana dashboards and settings
- `elasticsearch_data`: Elasticsearch indices

## Environment Variables

The Docker Compose file uses environment variables from your `.env` file. Key variables include:

- `NODE_ENV`: Application environment (development, production)
- `PORT`: API port (default: 3000)
- `WS_PORT`: WebSocket port (default: 3001)
- `PG_USER`: PostgreSQL username
- `PG_PASSWORD`: PostgreSQL password
- `PG_DATABASE`: PostgreSQL database name

## Scaling

To scale specific services:

```bash
docker-compose up -d --scale api=3
```

## Troubleshooting

### Service Won't Start
Check logs for errors:
```bash
docker-compose logs [service_name]
```

### Database Connection Issues
Ensure PostgreSQL is running and accessible:
```bash
docker-compose exec postgres pg_isready -U postgresnew
```

### Redis Connection Issues
Check Redis connectivity:
```bash
docker-compose exec redis redis-cli ping
```

## Maintenance

### Backup Database
```bash
docker-compose exec postgres pg_dump -U postgresnew -d swifteats > backup.sql
```

### Restore Database
```bash
cat backup.sql | docker-compose exec -T postgres psql -U postgresnew -d swifteats
```

### Clean Up
Remove all containers, networks, and volumes:
```bash
docker-compose down -v
```
