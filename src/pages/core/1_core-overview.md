---
title: Project David Core
slug: core-overview
category: core
nav_order: 1
---

# Project David Core

> This guide is for engineers who want to run Project David from source, contribute to the codebase, or deploy custom builds. If you want the fastest path to a running stack, see [Project David Platform](/docs/platform-overview) instead.

Project David Core is the runtime engine of the sovereign AI stack — a full-scale, containerised LLM orchestration platform built around the same primitives as the OpenAI Assistants API: **Assistants, Threads, Messages, Runs, and Tools** — without the lock-in.

- **Provider agnostic** — Hyperbolic, TogetherAI, Ollama, or any OpenAI-compatible endpoint
- **Every model** — hosted APIs today, local weights via Sovereign Forge tomorrow
- **Your infrastructure** — fully self-hostable, GDPR compliant, security audited
- **Production grade** — sandboxed code execution (FireJail PTY), multi-agent delegation, file serving with signed URLs, real-time streaming

---

## Why Project David?

| | OpenAI Assistants API | LangChain | Project David |
|---|---|---|---|
| Assistants / Threads / Runs primitives | ✅ | ❌ | ✅ |
| Provider agnostic | ❌ | Partial | ✅ |
| Local model support | ❌ | Partial | ✅ |
| Raw weights → orchestration | ❌ | ❌ | ✅ |
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
- 8GB RAM minimum (16GB recommended for GPU inference)

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

> On first run, Project David generates a `.env` file containing unique locally-generated secrets — database passwords, signing keys, and service credentials. This file is never committed to version control. The Docker Compose stack is fully wired to these secrets automatically.

The `docker-manager` subcommand exposes a full suite of orchestration options:

| Option | Description |
|---|---|
| `--mode up` | Start the stack (default) |
| `--mode down_only` | Stop the stack |
| `--mode build` | Build images only |
| `--mode both` | Build then start |
| `--mode logs` | Show service logs |
| `--with-ollama` | Start external Ollama container |
| `--ollama-gpu` | Enable GPU passthrough for Ollama |
| `--no-cache` | Force rebuild without Docker cache |
| `--build-before-up` | Build images before starting |
| `--force-recreate` | Recreate all containers |
| `--nuke` | Destroy all stack data — requires typed confirmation |
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

> This operation only deletes the API key record — it does not delete the admin user or any associated data.

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

## CLI vs Platform CLI

Project David intentionally uses two distinct CLI entry points:

| CLI | Entry point | Layer |
|---|---|---|
| Core | `platform-api docker-manager` | Source deployment — running from cloned repo |
| Platform | `pdavid` | Container deployment — running from pip-installed platform package |

This distinction is deliberate. When a developer runs `platform-api docker-manager` they know they are operating directly on the core runtime. When they run `pdavid` they are operating the containerised platform layer. There is no ambiguity about which layer is being managed.

---

## Services

Project David Core comprises the following services, all orchestrated via Docker Compose:

| Service | Role |
|---|---|
| API server | REST API — assistants, threads, runs, tools, inference |
| MySQL | Persistent storage — all entities and state |
| Redis | Async job broker — run queue and streaming |
| Sandbox | FireJail PTY — isolated code execution |
| Qdrant | Vector search — file search and RAG |
| Ollama | Local GPU inference — runs models on your hardware |
| vLLM | High-throughput inference — fine-tuned model serving |
| Samba | Shared file store — datasets and model adapters |
| SearXNG | Web search — agent tool integration |

---

## Related

- [Project David Platform](/docs/platform-overview) — containerised deployment, no source required
- [SDK Quick Start](/docs/sdk-quick-start) — build your first assistant once the stack is running

---

## License

Distributed under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/).
Commercial use requires a separate licence — contact [licensing@projectdavid.co.uk](mailto:licensing@projectdavid.co.uk).