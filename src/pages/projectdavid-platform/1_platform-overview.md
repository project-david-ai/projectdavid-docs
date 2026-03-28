---
title: Project David Platform
slug: platform-overview
category: projectdavid-platform
nav_order: 1
---

# Project David Platform

> This guide is for operators who want the fastest path to a running sovereign AI stack. No source code required. If you want to run from source or contribute to the codebase, see [Project David Core](/docs/core-overview) instead.

`projectdavid-platform` is the containerised deployment of Project David Core. It pulls pre-built Docker images from Docker Hub and brings up the complete sovereign AI infrastructure stack with a single command.

---

## Architecture

![Project David Stack](https://raw.githubusercontent.com/project-david-ai/projectdavid-platform/master/assets/svg/projectdavid-stack.svg)

> The platform deploys the same stack as Core. The difference is the deployment path — pip install instead of git clone.

---

## Prerequisites

- Docker with Docker Compose plugin
- Python 3.10+
- 8GB RAM minimum (16GB recommended for GPU inference)
- NVIDIA GPU + [nvidia-container-toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) for GPU inference (optional)

---

## Quick Start

**1. Install the platform package.**

```bash
pip install projectdavid-platform
```

**2. Start the stack.**

```bash
pdavid --mode up
```

On first run the platform generates a `.env` file with all secrets and a `docker-compose.yml` wired to those secrets. Both files are created once and never overwritten on subsequent runs.

**3. Provision your admin credentials.**

```bash
pdavid bootstrap-admin
```

Expected output:

```
================================================================
  Bootstrap complete.
  ADMIN_API_KEY : ad_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  Store this key securely — it will not be shown again.
================================================================
```

> Store this key immediately. It is shown exactly once.

**4. Provision your first user.**

```python
import os
from projectdavid import Entity

client = Entity(api_key=os.getenv("ADMIN_API_KEY"))

new_user = client.users.create_user(
    full_name="Kevin Flynn",
    email="flynn@encom.com",
    is_admin=False,
)

api_key = client.keys.create_key_for_user(
    target_user_id=new_user.id,
    key_name="production"
)
print(api_key.plain_key)
```

> Do not use the admin key for general API calls. Issue dedicated user keys for all application access.

---

## Stack Modes

### Base stack

```bash
pdavid --mode up
```

Starts the core platform — API, database, sandbox, vector search, web search, observability.

### With GPU inference

```bash
# Ollama only
pdavid --mode up --ollama

# vLLM only (static inference server)
pdavid --mode up --vllm

# Both Ollama and vLLM
pdavid --mode up --gpu
```

Requires NVIDIA GPU and nvidia-container-toolkit.

### With Sovereign Forge (training pipeline)

```bash
# Training stack + Ray cluster
pdavid --mode up --training

# Training + static vLLM inference server
pdavid --mode up --training --vllm

# Full sovereign stack — GPU inference + training
pdavid --mode up --gpu --training
```

---

## CLI Reference

### Stack management

| Command | Description |
|---|---|
| `pdavid --mode up` | Start the stack (default) |
| `pdavid --mode up --pull` | Pull latest images before starting |
| `pdavid --mode down_only` | Stop the stack |
| `pdavid --mode up --down` | Stop then restart |
| `pdavid --mode logs --follow` | Tail all service logs |
| `pdavid --mode logs --services api --tail 100` | Tail specific service logs |
| `pdavid --mode build` | Build images only |
| `pdavid --mode both` | Build then start |

### Service targeting

| Command | Description |
|---|---|
| `pdavid --mode up --services api db qdrant` | Start specific services only |
| `pdavid --mode up --exclude samba` | Start all services except samba |

### Stack options

| Option | Description |
|---|---|
| `--force-recreate` | Recreate all containers |
| `--pull` | Pull latest images before starting |
| `--build-before-up` | Build before starting |
| `--no-cache` | Build without Docker layer cache |
| `--attached` / `-a` | Run in foreground |
| `--down` | Stop before starting |
| `--clear-volumes` / `-v` | Remove volumes on down |
| `--verbose` | Enable debug logging |

### Log options

| Option | Description |
|---|---|
| `--follow` / `-f` | Follow log output |
| `--tail N` | Show last N lines |
| `--timestamps` / `-t` | Show timestamps |
| `--no-log-prefix` | Omit service name prefix |

### Danger

| Command | Description |
|---|---|
| `pdavid --nuke` | Destroy all stack data — requires typed confirmation |

---

## Configuration

### Setting variables

```bash
# Set a single variable
pdavid configure --set HF_TOKEN=hf_abc123

# Set multiple variables
pdavid configure --set VLLM_MODEL=Qwen/Qwen2.5-VL-7B-Instruct
pdavid configure --set TRAINING_PROFILE=standard

# Interactive mode
pdavid configure --interactive
```

### Common configuration examples

```bash
# HuggingFace token — required for gated models
pdavid configure --set HF_TOKEN=hf_abc123

# Switch vLLM model
pdavid configure --set VLLM_MODEL=Qwen/Qwen2.5-VL-7B-Instruct

# Set training profile (laptop | standard | high_end)
pdavid configure --set TRAINING_PROFILE=standard

# Join an existing Ray cluster
pdavid configure --set RAY_ADDRESS=ray://192.168.1.10:10001
```

### Training profiles

| Profile | Use case |
|---|---|
| `laptop` | Conservative VRAM, small batch sizes — RTX 3060 class and below |
| `standard` | Balanced defaults — RTX 3080 / 4070 class |
| `high_end` | Maximum throughput — 24GB+ VRAM (RTX 3090, 4090, A100) |

---

## Upgrading

When a new version of the platform is available, the CLI will notify you on the next run:

```
============================================================
  Platform update detected
============================================================
  Installed : 1.92.0
  Running   : 1.91.0

  To apply the update and pull the latest container images:

    pdavid --mode up --pull

  Your data and secrets are not affected.
============================================================
```

To upgrade:

```bash
pip install --upgrade projectdavid-platform
pdavid --mode up --pull
```

Your data lives in named Docker volumes and is not affected by upgrades. Database migrations run automatically on container start.

---

## Scale-Out — Adding a Second GPU Node

To add a remote GPU node to the Ray cluster:

**On the remote machine:**

```bash
pip install projectdavid-platform
pdavid configure --set RAY_ADDRESS=ray://<head_ip>:10001
docker compose -f docker-compose.yml -f docker-compose.training.yml up -d training-worker
```

Ray discovers the node automatically. No code changes required.

---

## Related

- [Project David Core](/docs/core-overview) — run from source, contribute to the codebase
- [SDK Quick Start](/docs/1_sdk-quick-start) — build your first assistant
- [Platform Commands](/docs/projectdavid-platform-commands) — full command reference
- [Configuration Reference](/docs/core-configuration) — environment variable reference

---

## License

Distributed under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/).
Commercial use requires a separate licence — contact [engineering@projectdavid.co.uk](mailto:engineering@projectdavid.co.uk).