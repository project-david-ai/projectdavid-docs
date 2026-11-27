---
title: Development commands
category: api-infra
slug: docker_commands
nav_order: 2
---

# Development commands

Use the Core CLI to build and run the source checkout.
For the packaged distribution, see [Self-hosted setup](/docs/boot_strap_guide).

Run these commands from the Core repository root, on the Docker
host, with the Core CLI installed in your active Python environment.
Docker and Docker Compose are required.

## CLI

```bash
platform-api docker-manager --help
```

The implementation is in `src/api/entities_api/cli/docker_manager.py`.
The command operates on `docker-compose.yml` and invokes the
development Compose generator before dispatching lifecycle actions.

## Start and build

```bash
platform-api docker-manager --mode both
```

This builds services with build definitions and starts the base stack.

| Operation | Command |
|---|---|
| Start | `platform-api docker-manager --mode up` |
| Build | `platform-api docker-manager --mode build` |
| Build and start | `platform-api docker-manager --mode both` |
| Build API image | `platform-api docker-manager --mode build --services api` |
| Rebuild without cache | `platform-api docker-manager --mode build --no-cache` |
| Recreate containers | `platform-api docker-manager --mode up --force-recreate` |
| Stop | `platform-api docker-manager --mode down_only` |

Starting services can create containers and initialize persistent
state. Review the target checkout and its configuration before
running a lifecycle command.

The CLI generates `.env` when missing and backfills missing
environment entries from `.env.example` and its persistent-key
generators. Existing configuration is not guaranteed to remain
byte-for-byte unchanged.

Never delete `.env` or persistent volumes to resolve a startup
failure in an existing deployment.

## Inspect and troubleshoot

For inspection of an existing stack, use Docker Compose directly:

```bash
docker compose ps
docker compose logs --tail 100 api
docker compose logs --follow api
```

The equivalent CLI log operations are:

```bash
platform-api docker-manager --mode logs --tail 100
platform-api docker-manager --mode logs --follow --services api
```

Prefer direct Compose inspection when you do not want the Core CLI
to regenerate configuration or backfill environment variables.

The API source is bind-mounted in the base Compose definition.
For local source changes, verify whether the running process
needs a restart before rebuilding an image. A bind mount alone
does not guarantee that a process reloads changed Python code.

## Configuration

For an existing `.env`, the CLI accepts explicit configuration
updates:

```bash
platform-api docker-manager configure --set LOG_LEVEL=DEBUG
```

This updates the file; it does not coordinate service credentials
or apply changes to running containers. Review the affected
services before recreating them.

Do not use `configure` as a general secret-rotation mechanism.
Avoid placing credentials in command history or logs.

## Administrator provisioning

Once the API service is running, the Core CLI can invoke the
administrator bootstrap script inside the API container.

```bash
platform-api docker-manager bootstrap-admin
```

The CLI requires a database URL and a running API service.
Handle bootstrap output as sensitive and do not assume that a
previous plaintext credential can be recovered.

## Destructive operations

Volume removal deletes persistent state. The CLI's nuke operation
also performs a Docker system-wide prune, which can affect
unrelated projects on the same host.

Neither operation is part of routine development, upgrade or
credential recovery.

## Reference

- [Project David Core](/docs/core-overview)
- [Container architecture](/docs/infrastructure-container-map)
- [Core configuration](/docs/core-configuration)
- [Database migrations](/docs/Migrations)
- [Upgrading Core](/docs/core-upgrading)
