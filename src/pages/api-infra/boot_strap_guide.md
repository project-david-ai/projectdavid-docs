---
title: Self-hosted setup
category: projectdavid-platform
slug: boot_strap_guide
nav_order: 0
---

# Self-hosted setup

Deploy Project David using the Platform CLI.

## Prerequisites

- Python
- Docker with Docker Compose
- A valid Platform licence

GPU hardware is not required for the base stack.

## Install

```bash
pip install projectdavid-platform
```

## Start the runtime

Create a dedicated directory for your runtime.

```bash
mkdir projectdavid-runtime
cd projectdavid-runtime

pdavid --mode up
```

Platform prepares the runtime configuration, generates
initial secrets and starts the Docker services.

The runtime directory holds your configuration and
persistent runtime state. Run subsequent Platform
commands from this directory.

## Bootstrap the administrator

```bash
pdavid bootstrap-admin
```

Core creates the administrator credential and Platform
persists it in the runtime `.env` file as `ADMIN_API_KEY`.

The bootstrap result identifies the administrator and
reports whether a new key was created.

If an administrator already exists, Platform attempts
to reuse the existing credential.

No manual database configuration or direct bootstrap
script invocation is required for a standard installation.

## Verify the runtime

```curl
curl -fsS http://localhost:80/v1/health
```

The health endpoint reports the runtime's availability.

## Connect an application

Install the Python SDK if your application uses Python.

```bash
pip install projectdavid
```

Provision a non-administrative API key for your application
and store it in the application's environment.

```dotenv
PROJECTDAVID_API_KEY=your_application_api_key
```

Connect to your local instance.

```python interface=python
import os

from projectdavid import Entity

client = Entity(
    base_url="http://localhost:80",
    api_key=os.environ["PROJECTDAVID_API_KEY"],
)
```

```curl interface=curl
curl -fsS http://localhost:80/v1/assistants \
  -H "X-API-Key: $PROJECTDAVID_API_KEY"
```

Follow the [Quick Start](/docs/sdk-quick-start)
using your local API base URL.

## Runtime directory

Platform resolves the runtime directory in the following
order:

| Priority | Source |
|---|---|
| 1 | `--runtime-dir` |
| 2 | `PDAVID_RUNTIME_HOME` |
| 3 | Current working directory |

To operate an existing runtime from another directory:

```bash
pdavid --runtime-dir ./projectdavid-runtime --mode up
```

Use the same runtime directory for startup, configuration
and administrator provisioning.

## Automated provisioning

Local deployment orchestrators can request a structured
bootstrap result and a separate credential handoff.

```bash
pdavid bootstrap-admin --json --credential-file ./admin-credential.json
```

The credential file receives the administrator credential.
The plaintext credential is omitted from the returned
command result when credential handoff is enabled.

Treat the credential file as a secret.

## Credential recovery

Platform does not silently replace an existing administrator
credential when its original plaintext is unavailable
or its prefix does not match Core's bootstrap result.

Restore the original credential from a secure backup
or perform an authorized credential rotation.

If Platform detects an existing runtime identity but
the runtime `.env` file is missing, startup is refused
to prevent the accidental replacement of secrets.

Restore the original configuration before attempting
to restart the runtime.

Do not delete persistent volumes or regenerate secrets
as a credential recovery procedure.

## Runtime management

| Operation | Command |
|---|---|
| Start | `pdavid --mode up` |
| Stop | `pdavid --mode down_only` |
| Update images | `pdavid --mode up --pull` |
| Follow logs | `pdavid --mode logs --follow` |
| Administrator bootstrap | `pdavid bootstrap-admin` |
| Configure | `pdavid configure --interactive` |

## Security

Protect the runtime configuration, credential files and
backups. Treat initial startup output as sensitive.

Use non-administrative credentials for application access.
Never commit runtime secrets to source control.

## Reference

- [Quick Start](/docs/sdk-quick-start)
- [Authentication](/docs/api_keys)
- [API Reference](/docs/api-reference)