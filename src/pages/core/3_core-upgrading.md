---
title: Upgrading Core
slug: core-upgrading
category: core
nav_order: 3
---

# Upgrading Core

This guide covers source-based Core deployments. For deployments installed through `projectdavid-platform`, follow [Upgrading Platform](/docs/platform-upgrading).

## Before upgrading

Review the target revision, dependency changes, Compose configuration and migration history. Record the existing source revision:

```bash
git status --short
git rev-parse HEAD
```

Preserve local changes before switching revisions. For a running deployment, schedule maintenance, pause new submissions and allow active runs to finish.

Create and verify consistent backups of:

- Database records, vector storage and uploaded or generated files.
- Runtime configuration, credentials, local overrides and deployment identity files, where present.
- Any other persistent storage used by the deployment, including bind mounts outside the checkout.

Record the current container image IDs and configuration needed to reproduce the deployment. Test the upgrade and recovery procedure against a non-production copy before applying it to persistent workloads.

## Update the source deployment

Fetch the intended revision and review its changes before integrating them into the deployment checkout.

```bash
git fetch origin
```

Use the build and startup commands supported by the target revision of Core. If the checkout exposes the source CLI, inspect its available options:

```bash
platform-api docker-manager --help
```

Do not substitute packaged Platform commands for source deployment commands. Preserve the deployment's existing project identity, configuration and storage mounts. Container recreation can interrupt active runs and discard container-local state.

## Database migrations

Core uses Alembic migrations to manage database schema changes. Review the target revision's `migrations/versions/` directory and API startup script to determine how migrations are applied.

Do not assume that all migrations are additive, automatic or reversible. A migration can modify or remove data, and a failed migration can leave partially applied changes. Validate the upgrade on a database copy before running it against the original.

## Verify the deployment

From the existing deployment's Compose context, using the same project and configuration selection as startup:

```bash
docker compose ps
docker compose logs --tail 100 api
```

Use the actual API service name if your Compose configuration differs.

Check the API health endpoint at the configured base URL. For a local deployment using the default HTTP entry point:

```bash
curl -fsS http://localhost:80/v1/health
```

Inspect migration results and service logs. Verify access to existing resources using an application key and exercise the affected functionality, including representative inference and tool execution where relevant. A successful health check alone does not establish schema integrity or successful inference.

Resume traffic only after verification passes.

## Failed upgrades and recovery

If startup or verification fails, keep traffic paused. Preserve logs and the failed deployment state while investigating. Inspect the migration history and database revision using the appropriate Alembic environment for that deployment.

Do not blindly rerun a failed migration, stamp a revision or downgrade a database. Determine which changes were applied and use a tested recovery procedure. Restoring an earlier source revision or image alone does not restore a compatible database schema.

A complete rollback may require the previous source revision, image versions, configuration, credentials and a consistent persistent-data backup. Account for any writes made after the backup before restoring it.

Never delete `.env`, Compose configuration or persistent volumes as part of routine upgrade or rollback. Preserve credential encryption and signing key material. Credential rotation is a separate operation; see [Core configuration](/docs/core-configuration).

## Reference

- [Project David Core](/docs/core-overview)
- [Core configuration](/docs/core-configuration)
- [Upgrading Platform](/docs/platform-upgrading)
