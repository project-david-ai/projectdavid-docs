---
title: Container architecture
category: infrastructure
slug: infrastructure-container-map
nav_order: 1
---

# Container architecture

Core's source deployment is defined by `docker-compose.yml`.
The base stack connects the API, execution tools, persistence,
search and observability services over a shared Docker bridge.

This reference describes the base Compose definition. The
Core CLI can regenerate that definition before starting services.
Inspect the effective configuration of your checkout when diagnosing
a running deployment.

## Services

Ports below are host-to-container mappings from the supplied base
Compose file, not a recommended production exposure policy.

| Service | Responsibility | Published ports |
|---|---|---|
| `nginx` | HTTP reverse proxy | `80:80` |
| `api` | FastAPI runtime and agent orchestration | `9000:9000` |
| `sandbox` | Code and shell execution | `8000:8000` |
| `db` | MySQL relational persistence | `3307:3306` |
| `qdrant` | Vector storage and search | `6333:6333`, `6334:6334` |
| `redis` | Cache and runtime state | `6379:6379` |
| `searxng` | Web search | `8080:8080` |
| `browser` | Chromium browser service | `3000:3000` |
| `samba` | Shared file storage | `1139:139`, `1445:445` |
| `otel-collector` | OpenTelemetry collection | `4317:4317`, `4318:4318` |
| `jaeger` | Trace backend and UI | `16686:16686`, `14250:14250` |

Use Compose service names for internal connections. Host ports
are not interchangeable with container ports: MySQL is reached
through `db:3306` inside the stack and port `3307` on the host.

## Runtime connections

| Source | Destination | Purpose |
|---|---|---|
| API | `db:3306` | Relational persistence (configured through `DATABASE_URL`) |
| API | `qdrant:6333` | Vector operations |
| API | `redis:6379/0` | Redis state |
| API | `sandbox:8000` | Execution service |
| API | `browser:3000` | Browser WebSocket endpoint |
| API | `searxng:8080` | Web search |
| API | `otel-collector:4317` | OTLP traces |

These destinations reflect the API environment in Compose.
Proxy routes and telemetry forwarding are configured separately
in `docker/nginx/nginx.conf` and `docker/otel/otel-config.yaml`.

The API depends on a healthy database and six started services:
sandbox, Qdrant, Redis, browser, SearxNG and the telemetry collector.
The sandbox also waits for database health. SearxNG depends on
Redis, the collector depends on Jaeger, and nginx depends on the API.

A started container is not necessarily ready to serve requests.

## Persistent storage

| Storage | Container mount | Purpose |
|---|---|---|
| `mysql_data` | `/var/lib/mysql` | MySQL data |
| `qdrant_storage` | `/qdrant/storage` | Vector collections |
| `redis_data` | `/data` | Redis persistence directory |
| `${SHARED_PATH}` | `/app/shared_data` (API), `/samba/share` (Samba) | Shared files |

The API mounts `./src` at `/app/src`; the sandbox mounts
`./src/api/sandbox` at `/app/sandbox`. Source mounts support local
development but do not imply automatic process reload.

Configuration, secrets and shared files need separate backup
coverage in addition to database and vector-store backups.

## Inspect the running stack

From the Core repository root:

```bash
docker compose ps
docker compose logs --tail 100 api
docker compose logs --tail 100 db
```

The API entrypoint runs `alembic upgrade head` before starting
Supervisor. If startup fails, inspect the migration output before
attempting to restart or change the database.

## Deployment boundary

The source Compose file publishes database, cache, execution,
browser, storage and observability ports as well as the API.
Review host exposure and network access before deploying beyond a
trusted development environment.

The sandbox requests `SYS_ADMIN`, an unconfined seccomp profile
and `/dev/fuse`. The Samba configuration permits NT1 as its
minimum protocol. Neither these settings nor containerisation
alone establish a hardened production security boundary.

Do not expose internal services directly to untrusted networks.
Review the effective sandbox, proxy, storage and authentication
configuration for the target deployment.

## Reference

- [Project David Core](/docs/core-overview)
- [Development commands](/docs/docker_commands)
- [Database migrations](/docs/Migrations)
- [Core configuration](/docs/core-configuration)
