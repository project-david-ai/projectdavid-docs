---
title: Upgrading Platform
slug: platform-upgrading
category: projectdavid-platform
nav_order: 3
---

# Upgrading Platform

Project David Platform distributes the deployment CLI and configuration templates separately from the runtime container images. Updating one does not necessarily update the other.

| Component | Upgrade command |
|---|---|
| Platform package | `pip install --upgrade projectdavid-platform` |
| Runtime images | `pdavid --mode up --pull` |

Check release compatibility before upgrading either component independently.

## Before upgrading

Use the same Python environment and runtime directory as the existing deployment. If you normally select the runtime with `--runtime-dir` or `PDAVID_RUNTIME_HOME`, retain that selection.

- Review the release changes and schedule a maintenance window. Allow active runs to finish and pause new submissions.
- Back up the runtime directory, including `.env`, instance identity, Compose configuration and any local overrides. Protect the backup as sensitive credential material.
- Take consistent backups of the database, vector store and uploaded file storage. Include any other persistent mounts used by your deployment, including storage outside the runtime directory.
- Record the installed package version and the image IDs or registry digests of the running containers. Verify that the backups can be restored.

## Upgrade

From the existing runtime directory, with the intended Python environment active:

```bash
pip install --upgrade projectdavid-platform
pdavid --mode up --pull
```

The first command updates the CLI and bundled templates. The second invokes Docker Compose with `up --pull always`, refreshing images referenced by the effective Compose configuration and starting the stack. Compose can recreate containers when images or configuration change.

Platform reconciles generated environment defaults and can layer updated packaged Compose definitions over existing configuration. Retaining local files does not guarantee that their effective settings remain unchanged.

The ordinary startup upgrade notice compares the installed package version with `PDAVID_VERSION` and updates that marker before Compose startup. It is not an image-availability check or proof that the runtime upgrade succeeded.

## Verify the deployment

Check the package version, running containers and service logs:

```bash
pip show projectdavid-platform
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
pdavid --mode logs --services api --tail 100
```

`docker ps` lists running containers across the Docker host; identify those belonging to your deployment. The displayed image reference is not necessarily immutable. To inspect the actual image ID, substitute the relevant container name below:

```bash
docker inspect --format '{{.Image}}' "$API_CONTAINER"
```

Set `API_CONTAINER` to the name of your API container from the preceding listing.

Check the API health endpoint, using your own deployment URL if different:

```bash
curl -fsS http://localhost:80/v1/health
```

Inspect the response and logs, then use an existing application key to verify resource access and a representative inference request. Health alone does not establish successful migrations, inference availability or complete data integrity. Resume traffic only after these checks pass.

## Persistent state and migrations

Routine upgrades do not explicitly request volume deletion. Container-local state and active connections may be lost when services are recreated. Persistent database records, vectors and files depend on preserving the correct storage mounts and credentials.

Database schema changes may accompany a runtime update. Review migration errors in the API logs before accepting the deployment. Do not assume a container starting successfully proves every migration is complete or reversible.

Never use `--clear-volumes` or `--nuke` during a routine upgrade or rollback. These are destructive operations, not recovery procedures.

## Recovery

If a deployment fails verification, keep traffic paused and inspect the service logs. If necessary, stop the stack without removing volumes:

```bash
pdavid --mode down_only
```

A previous package version can be reinstalled from your recorded release, provided it is available:

```bash
pip install "projectdavid-platform==$PREVIOUS_PLATFORM_VERSION"
```

Set `PREVIOUS_PLATFORM_VERSION` to the exact previously installed version before running this command.

Reinstalling the package alone does not restore previous container images, Compose settings or database schemas. A complete rollback requires compatible image versions, deployment configuration, credentials and persistent state. Restore them using a tested recovery procedure appropriate to the release.

Do not assume that editing a single image tag in the local Compose file pins the entire deployment: reconciliation overlays can affect the effective image references. A general-purpose version-pinning and rollback workflow is not established by these commands.

## Reference

- [Platform Overview](/docs/platform-overview)
- [Self-hosted Setup](/docs/boot_strap_guide)
- [Configuration Reference](/docs/platform-configuration)
- [Platform Commands](/docs/boot_strap_guide#runtime-management)
- [Core Upgrading](/docs/core-upgrading)
