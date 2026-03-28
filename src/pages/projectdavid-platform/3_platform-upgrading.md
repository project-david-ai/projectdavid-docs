---
title: Upgrading Platform
slug: platform-upgrading
category: projectdavid-platform
nav_order: 3
---

# Upgrading Platform

Project David Platform has two independent upgrade tracks. Understanding the distinction is important — they are separate things and can be updated independently.

---

## The Two Upgrade Tracks

| Track | What it upgrades | How |
|---|---|---|
| **Python package** | The `pdavid` CLI, orchestrator, bundled compose files, and packaging logic | `pip install --upgrade projectdavid-platform` |
| **Docker images** | The runtime containers — API server, sandbox, training worker | `pdavid --mode up --pull` |

These are independent. You can upgrade the package without pulling new images, and you can pull new images without upgrading the package. They are versioned separately and released on different schedules.

---

## Track 1 — Python Package Upgrade

The Python package contains the `pdavid` CLI, the orchestrator logic, and the bundled compose file templates. Upgrading it gives you new CLI flags, bug fixes to the orchestration layer, and updated compose templates.

```bash
pip install --upgrade projectdavid-platform
```

After upgrading the package, the CLI will notify you on the next run if new Docker images are also available:

```
============================================================
  Platform update detected
============================================================
  Installed : 1.92.0
  Running   : 1.91.0

  New features and fixes are available.
  What's new: https://github.com/project-david-ai/platform/blob/master/CHANGELOG.md

  To apply the update and pull the latest container images:

    pdavid --mode up --pull

  Your data and secrets are not affected.
============================================================
```

The notice fires once per upgrade and does not repeat. It never pulls images automatically — you decide when to apply the Docker image update.

To check the installed package version:

```bash
pip show projectdavid-platform | grep Version
```

---

## Track 2 — Docker Image Upgrade

The Docker images contain the runtime — the API server, sandbox, and training worker. Upgrading them gives you new API features, inference improvements, and bug fixes to the core runtime.

```bash
pdavid --mode up --pull
```

The `--pull` flag tells Docker Compose to pull the latest `:latest` tagged images from Docker Hub before starting the stack. Your data and secrets are not affected.

To check which images are currently running:

```bash
docker images | grep thanosprime
```

To check the running stack version:

```bash
cat .env | grep PDAVID_VERSION
curl http://localhost:80/v1/health
```

---

## Upgrading Both Tracks Together

The most common upgrade path — new package and new images at the same time:

```bash
# 1. Upgrade the package
pip install --upgrade projectdavid-platform

# 2. Pull latest images and recreate containers
pdavid --mode up --pull
```

---

## How Data is Protected

All persistent data lives in named Docker volumes. These survive both upgrade tracks:

| Volume | Contents |
|---|---|
| `mysql_data` | All assistant, thread, message, run, file, and user data |
| `qdrant_storage` | Vector store embeddings |
| `redis_data` | Queue state |
| `ollama_data` | Downloaded model weights |

Named volumes are only removed if you explicitly pass `--clear-volumes`:

```bash
# This destroys data — only run if you intend to start fresh
pdavid --mode down_only --clear-volumes
```

---

## How Migrations Work

The API container runs `alembic upgrade head` automatically on every startup. Alembic applies any pending schema changes and leaves existing data untouched.

You do not need to run migrations manually. If the API container starts successfully, migrations have passed.

To check migration status if something goes wrong:

```bash
docker exec -it fastapi_cosmic_catalyst alembic current
docker exec -it fastapi_cosmic_catalyst alembic history
```

---

## Upgrade Options Reference

| Command | When to use |
|---|---|
| `pdavid --mode up --pull` | Pull latest Docker images and recreate containers |
| `pdavid --mode up --force-recreate` | Force container recreation without pulling new images |
| `pdavid --mode up --pull --force-recreate` | Pull latest images and force full recreation |
| `pdavid --mode down_only` then `pdavid --mode up --pull` | Full stop and restart — when containers are in a bad state |

---

## What Does and Does Not Survive an Upgrade

| What | Survives? | Notes |
|---|---|---|
| Database data | ✅ Yes | `mysql_data` named volume |
| Vector embeddings | ✅ Yes | `qdrant_storage` named volume |
| Uploaded files | ✅ Yes | `SHARED_PATH` volume |
| `.env` file | ✅ Yes | Never touched after initial generation |
| Local compose file edits | ✅ Yes | Platform never overwrites existing files |
| Container state | ❌ No | Containers are recreated on upgrade |
| In-flight runs | ❌ No | Runs in progress when containers stop must be resubmitted |
| HuggingFace model cache | ✅ Yes | `HF_CACHE_PATH` is a host path mount — survives everything |

---

## Pinning to a Specific Version

The platform always pulls `:latest` Docker images by default. If you need to pin to a specific release for stability or compliance reasons, edit `docker-compose.yml` in your working directory:

```yaml
services:
  api:
    image: thanosprime/projectdavid-core-api:1.28.1  # pin to specific version
```

> Local edits to compose files are preserved — the platform never overwrites files that already exist in your working directory.

---

## Rolling Back

**Rolling back the Docker images:**

```bash
# Pin to previous image version in docker-compose.yml, then:
pdavid --mode up --force-recreate
```

**Rolling back the Python package:**

```bash
pip install projectdavid-platform==<previous_version>
```

Both can be rolled back independently.

---

## Related

- [Platform Overview](/docs/platform-overview) — quick start and stack modes
- [Configuration Reference](/docs/platform-configuration) — environment variable reference
- [Core Upgrading](/docs/core-upgrading) — upgrade guide for source deployments