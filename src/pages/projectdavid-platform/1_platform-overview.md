---
title: Project David Platform
slug: platform-overview
category: projectdavid-platform
nav_order: 1
---

# Project David Platform

Deploy Project David on your own infrastructure using pre-built container images. The `projectdavid-platform` package provides the `pdavid` CLI, which manages the runtime through Docker Compose.

[Project David Core](/docs/core-overview) is the runtime and source distribution. Platform is its packaged deployment interface. Neither requires you to manage model weights or GPU scheduling to use a supported hosted inference provider.

## Deployment

You need Docker with Compose, Python 3.10 or later, sufficient resources for the services you deploy, and a valid Platform licence. The base deployment does not require a local GPU.

From a dedicated, empty runtime directory:

```bash
pip install projectdavid-platform
pdavid --mode up
```

Follow [Self-hosted Setup](/docs/boot_strap_guide) for complete installation, licence requirements, admin bootstrap and application access.

## Runtime

The runtime directory holds the deployment configuration, generated credentials and local runtime state. Its location is resolved in this order:

1. Explicit `--runtime-dir` option.
2. `PDAVID_RUNTIME_HOME` environment variable.
3. Current working directory.

Use the same runtime directory for subsequent operations. Protect the `.env` file and back up persistent storage separately. Runtime configuration may be reconciled when the installed package changes; do not assume generated files are immutable.

## Connect an application

A self-hosted deployment exposes the same resource and inference interfaces as the hosted API. Use your deployment's API base URL and a dedicated application API key. Administrative credentials are reserved for administrative operations.

Model inference is routed through supported providers. Self-hosting gives you control over the runtime and its stored data, but requests sent to external providers remain subject to their processing and retention policies. Self-hosting alone does not imply air-gapped operation or regulatory compliance.

## Upgrade

Review release changes and back up persistent data, credentials and deployment configuration before upgrading. From the existing runtime directory:

```bash
pip install --upgrade projectdavid-platform
pdavid --mode up --pull
```

The first command upgrades the deployment package; the second starts the stack with an image pull. Verify service health and application access after the upgrade. Do not remove volumes as part of a routine upgrade.

## Licence

Platform startup requires a valid commercial licence. Project David Core is distributed under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/). Commercial use requires a separate licence. Contact [licensing@projectdavid.co.uk](mailto:licensing@projectdavid.co.uk).

## Reference

- [Self-hosted Setup](/docs/boot_strap_guide)
- [Platform Commands](/docs/boot_strap_guide#runtime-management)
- [Configuration Reference](/docs/platform-configuration)
- [Project David Core](/docs/core-overview)
- [Authentication](/docs/api_keys)
- [Quick Start](/docs/sdk-quick-start)
