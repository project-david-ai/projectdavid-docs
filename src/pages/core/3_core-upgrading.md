---
title: Upgrading Core
slug: core-upgrading
category: core
nav_order: 3
---

# Upgrading Core

Project David Core is designed to upgrade safely without data loss. Database migrations run automatically on every container start — you do not need to run them manually.

---

## How Migrations Work

The API container entrypoint runs `alembic upgrade head` before starting the application server on every startup:

```bash
# init_and_run_api.sh (runs inside the container on every start)
alembic upgrade head
```

Alembic compares the current schema version against the latest migration in the `migrations/` directory and applies any pending changes. Your data is preserved — Alembic only adds or modifies schema, it does not drop tables or truncate data during a standard upgrade.

All persistent data lives in named Docker volumes:

| Volume | Contents |
|---|---|
| `mysql_data` | All assistant, thread, message, run, file, and user data |
| `qdrant_storage` | Vector store embeddings |
| `redis_data` | Queue state |
| `ollama_data` | Downloaded model weights |

Named volumes survive container rebuilds and restarts. Your data is not lost when you upgrade.

---

## Standard Upgrade — Cloned Deployment

For a deployment running from the cloned repository:

**1. Pull the latest changes.**

```bash
git pull origin main
```

**2. Rebuild and restart the stack.**

```bash
platform-api --mode up --build-before-up --force-recreate
```

Alembic runs automatically on API container startup and applies any new migrations. No further steps required.

---

## Standard Upgrade — Platform Deployment

For a deployment running via `projectdavid-platform` (pip install):

**1. Pull the latest images.**

```bash
pip install --upgrade projectdavid-platform
pdavid --mode up --force-recreate
```

Or if pulling Docker images directly:

```bash
docker compose pull
docker compose up -d --force-recreate
```

Alembic runs automatically on API container startup. No further steps required.

---

## Upgrade Options Reference

| Option | Description | When to use |
|---|---|---|
| `--force-recreate` | Recreate all containers from latest images | Standard upgrade path |
| `--build-before-up` | Rebuild images from source before starting | After pulling new source code |
| `--no-cache` | Rebuild images without Docker layer cache | When dependency changes are not being picked up |
| `--mode down` then `--mode up` | Full stop and restart | When containers are in a bad state |

---

## Checking Your Current Version

```bash
git describe --tags --abbrev=0
```

Or check the API health endpoint once the stack is running:

```bash
curl http://localhost:80/v1/health
```

---

## Handling a Failed Migration

If a migration fails on startup, the API container will exit with an error. Check the logs:

```bash
docker logs fastapi_cosmic_catalyst
```

Common causes:

| Cause | Resolution |
|---|---|
| `DATABASE_URL` not set or unreachable | Confirm the `db` container is healthy before the API starts — check `docker ps` |
| Migration conflict | Run `alembic history` inside the API container to inspect the migration chain |
| Corrupt migration state | Run `alembic current` to check the current revision |

To run migrations manually inside the API container:

```bash
docker exec -it fastapi_cosmic_catalyst alembic upgrade head
```

---

## What Does Not Survive an Upgrade

| What | Survives? | Notes |
|---|---|---|
| Database data | ✅ Yes | Stored in `mysql_data` named volume |
| Vector embeddings | ✅ Yes | Stored in `qdrant_storage` named volume |
| Uploaded files | ✅ Yes | Stored in `SHARED_PATH` volume |
| `.env` file | ✅ Yes | Never touched after initial generation |
| `docker-compose.yml` | ✅ Yes | Never regenerated if it already exists |
| Container state | ❌ No | Containers are recreated on upgrade |
| In-flight runs | ❌ No | Any runs in progress when containers stop will need to be resubmitted |

---

## Rotating Secrets After an Upgrade

If you need to rotate auto-generated secrets (e.g. after a security incident):

```bash
# Stop the stack
platform-api --mode down

# Delete the .env and docker-compose.yml to force regeneration
rm .env docker-compose.yml

# Restart — new secrets will be generated
platform-api --mode up
```

> ⚠️ Rotating secrets invalidates all existing API keys. You will need to re-provision admin credentials and reissue all user keys after rotating.

---

## Related

- [Project David Core](/docs/core-overview) — quick start and CLI reference
- [Configuration Reference](/docs/core-configuration) — environment variable reference
- [Docker Commands](/docs/docker_commands) — full orchestration command reference