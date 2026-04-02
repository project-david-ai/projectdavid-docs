---
title: Project David Core
slug: core-overview
category: core
nav_order: 1
---

# Project David Core

> This guide is for engineers who want to run Project David from source, contribute to the codebase, or deploy custom builds. For the fastest path to a running stack, see [Project David Platform](/docs/platform-overview) instead.

Project David Core is the runtime engine of the sovereign AI stack: a full-scale, containerised LLM orchestration platform built around the same primitives as the OpenAI Assistants API: **Assistants, Threads, Messages, Runs, and Tools**, without the lock-in.

- **Provider agnostic:** Hyperbolic, TogetherAI, Ollama, or any OpenAI-compatible endpoint
- **Every model:** hosted APIs today, local weights via Sovereign Forge tomorrow
- **Your infrastructure:** fully self-hostable, GDPR compliant, security audited
- **Production grade:** sandboxed code execution (FireJail PTY), multi-agent delegation, file serving with signed URLs, real-time streaming

---

## Why Project David?

| | OpenAI Assistants API | LangChain | Project David |
|---|---|---|---|
| Assistants / Threads / Runs primitives | ✅ | ❌ | ✅ |
| Provider agnostic | ❌ | Partial | ✅ |
| Local model support | ❌ | Partial | ✅ |
| Raw weights to orchestration | ❌ | ❌ | ✅ |
| Sandboxed code execution | ✅ Black box | ❌ | ✅ FireJail PTY |
| Multi-agent delegation | Limited | ❌ | ✅ |
| Self-hostable | ❌ | ✅ | ✅ |
| GDPR compliant | ❌ | N/A | ✅ |
| Security audited | N/A | N/A | ✅ |
| Open source | ❌ | ✅ | ✅ |

---

## Architecture

![Project David Stack](https://raw.githubusercontent.com/project-david-ai/projectdavid-platform/master/assets/svg/projectdavid-stack.svg)

> The same stack runs whether deployed via Core (source) or Platform (containerised). The difference is the deployment path, not the infrastructure.

---

## Prerequisites

- Git
- Docker and Docker Compose
- Python 3.10+
- 8 GB RAM minimum (16 GB recommended for GPU inference)

---

## Quick Start

**1. Clone the repository.**

```bash
git clone https://github.com/project-david-ai/projectdavid-core.git
cd projectdavid-core
```

**2. Install the local package.**

```bash
pip install -e .
```

**3. Build and start the Docker stack.**

```bash
platform-api docker-manager --mode up
```

> On first run, Project David generates a `.env` file containing unique locally-generated secrets: database passwords, signing keys, and service credentials. This file is never committed to version control. The Docker Compose stack is fully wired to these secrets automatically.

**4. Update configuration variables.**

```bash
# Set a single variable
platform-api docker-manager configure --set HF_TOKEN=hf_abc123

# Interactive mode
platform-api docker-manager configure --interactive
```

**5. Provision your admin credentials.**

```bash
platform-api docker-manager bootstrap-admin
```

Or with an explicit database URL:

```bash
platform-api docker-manager bootstrap-admin \
  --db-url "mysql+pymysql://api_user:password@localhost:3307/entities_db"
```

Expected output:

```
================================================================
  ✓  Admin API Key Generated
================================================================
  Email   : admin@example.com
  User ID : user_abc123...
  API KEY : ad_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
----------------------------------------------------------------
  This key will NOT be shown again.
================================================================
```

> Store this key immediately. It is shown exactly once and cannot be recovered.

---

## Lost Your Admin Key?

Admin keys are shown exactly once and are not stored in plain text. If you have lost yours, you must delete the existing key record and regenerate it.

**1. Connect to the running MySQL container.**

```bash
docker exec -it my_mysql_cosmic_catalyst mysql -u api_user -p entities_db
```

**2. Find the existing admin key prefix.**

```sql
SELECT prefix, key_name, created_at FROM api_keys;
```

**3. Delete the existing admin key.**

```sql
DELETE FROM api_keys WHERE prefix = 'ad_xxxxx';
EXIT;
```

**4. Re-run bootstrap-admin to generate a new key.**

```bash
platform-api docker-manager bootstrap-admin
```

The new key will be printed once. Copy it immediately.

> This operation only deletes the API key record. It does not delete the admin user or any associated data.

---

**6. Provision your first user.**

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
platform-api docker-manager --mode up
```

Starts the core platform: API, database, sandbox, vector search, web search, and observability.

### With Ollama

```bash
platform-api docker-manager --mode up --ollama
```

Starts the Ollama local inference server alongside the base stack. Requires NVIDIA GPU and nvidia-container-toolkit.

### With Sovereign Forge

```bash
# Training pipeline and Ray-managed vLLM inference
platform-api docker-manager --mode up --training

# Sovereign Forge plus Ollama
platform-api docker-manager --mode up --training --ollama
```

The `--training` flag starts three additional containers: `training-api`, `training-worker`, and `inference-worker`.

`inference-worker` is the Ray HEAD node. It owns the GPU, runs Ray Serve, and hosts the `InferenceReconciler`. All vLLM inference is managed here via Ray Serve deployments. The `InferenceReconciler` polls the `inference_deployments` table every 20 seconds and reconciles Ray Serve state accordingly. Models become available at `http://inference_worker:8000/vllm_dep_{deployment_id}`.

`training-worker` is a Redis-driven subprocess runner. It pops jobs from the `training_jobs` queue and executes them as subprocesses using Unsloth. It does not participate in the Ray cluster.

> On single-GPU machines, training and inference cannot run simultaneously. Call `models.deactivate_all()` via the SDK before submitting a training job, then reactivate after training completes.

Requires NVIDIA GPU and nvidia-container-toolkit.

---

## How Inference Deployments Work

When `--training` is active, the `InferenceReconciler` inside `inference-worker` runs continuously. Every 20 seconds it queries the `inference_deployments` table and reconciles Ray Serve state:

- If a deployment is marked `pending` and no corresponding Ray Serve app exists, the reconciler calls `serve.run(VLLMDeployment)` to deploy the model.
- If a Ray Serve app exists but has no corresponding database record, the reconciler tears it down and releases the GPU reservation.

Deployments are driven entirely by SDK calls, not CLI flags. See [Model Activation](/docs/admin-model-activation) for the full lifecycle.

---

## CLI Reference

| Option | Description |
|---|---|
| `--mode up` | Start the stack (default) |
| `--mode down_only` | Stop the stack |
| `--mode build` | Build images only |
| `--mode both` | Build then start |
| `--mode logs` | Show service logs |
| `--training` | Start Sovereign Forge: training-api, training-worker, inference-worker. Requires NVIDIA GPU |
| `--ollama` | Start Ollama local inference. Requires NVIDIA GPU |
| `--no-cache` | Force rebuild without Docker cache |
| `--build-before-up` | Build images before starting |
| `--force-recreate` | Recreate all containers |
| `--nuke` | Destroy all stack data. Requires typed confirmation |
| `--services` | Start specific services only |
| `--exclude` / `-x` | Exclude specific services |
| `--down` | Stop before starting |
| `--clear-volumes` / `-v` | Remove volumes on down |
| `--attached` / `-a` | Run in foreground |
| `--follow` / `-f` | Follow log output |
| `--tail` | Number of log lines to tail |
| `--timestamps` / `-t` | Show timestamps in logs |
| `--no-log-prefix` | Omit service name prefix in logs |
| `--tag` | Tag built images with a custom label |
| `--parallel` | Build images in parallel |
| `--verbose` / `--debug` | Enable debug logging |
| `--debug-cache` | Run Docker cache diagnostics |

---

## CLI vs Platform CLI

Project David intentionally uses two distinct CLI entry points:

| CLI | Entry point | Layer |
|---|---|---|
| Core | `platform-api docker-manager` | Source deployment, running from cloned repo |
| Platform | `pdavid` | Container deployment, running from pip-installed platform package |

This distinction is deliberate. When a developer runs `platform-api docker-manager` they are operating directly on the core runtime. When they run `pdavid` they are operating the containerised platform layer. There is no ambiguity about which layer is being managed.

---

## Services

Project David Core comprises the following services, orchestrated via Docker Compose:

| Service | Role |
|---|---|
| api | REST API: assistants, threads, runs, tools, inference routing |
| db | MySQL 8.0: persistent storage for all entities and state |
| redis | Async job broker: run queue, streaming, training job queue |
| sandbox | FireJail PTY: isolated code execution |
| qdrant | Vector search: file search and RAG |
| ollama | Local GPU inference via Ollama. Profile: ai |
| training-api | Fine-tuning REST API: datasets, jobs, model activation. Profile: training |
| training-worker | Redis-driven subprocess trainer. Profile: training |
| inference-worker | Ray HEAD node: Ray Serve, VLLMDeployment, InferenceReconciler. Profile: training |
| samba | Shared file store: datasets and LoRA adapters |
| searxng | Web search for agent tool integration |
| nginx | Reverse proxy, single public entry point on port 80 |

---

## Related

- [Project David Platform](/docs/platform-overview): containerised deployment, no source required
- [SDK Quick Start](/docs/sdk-quick-start): build your first assistant once the stack is running
- [Model Activation](/docs/admin-model-activation): deploy a locally hosted model for inference
- [Ray and the inference worker](/docs/admin-ray-inference): dashboard navigation and log interpretation

---

## License

Distributed under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/).
Commercial use requires a separate licence. Contact [licensing@projectdavid.co.uk](mailto:licensing@projectdavid.co.uk).