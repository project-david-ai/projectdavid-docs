---
title: Configuration Reference
slug: platform-configuration
category: projectdavid-platform
nav_order: 2
---

# Configuration Reference

Project David Platform manages all configuration through a `.env` file generated automatically on first run. You never need to edit this file directly — the `pdavid configure` command handles all updates safely.

---

## How Configuration Works

On first run, `pdavid --mode up` generates a `.env` file in your working directory containing all secrets and defaults. Subsequent runs load this file — secrets are never regenerated unless you delete `.env` and start fresh.

To update a variable after initial setup:

```bash
# Set a single variable
pdavid configure --set HF_TOKEN=hf_abc123

# Set multiple variables
pdavid configure --set VLLM_MODEL=Qwen/Qwen2.5-VL-7B-Instruct
pdavid configure --set TRAINING_PROFILE=standard

# Interactive mode — prompts for all user-supplied variables
pdavid configure --interactive
```

> Never edit auto-generated secrets manually. If you need to rotate credentials, see the [rotation section](#rotating-secrets) below.

---

## Variable Categories

### Auto-Generated — Never Set Manually

These variables are cryptographically generated on first run. They are written to `.env` once and never changed unless you explicitly rotate them.

| Variable | Purpose |
|---|---|
| `SIGNED_URL_SECRET` | Signed URL generation secret |
| `API_KEY` | Internal API key — prefixed `ea_` |
| `MYSQL_ROOT_PASSWORD` | MySQL root password |
| `MYSQL_PASSWORD` | MySQL application user password |
| `SECRET_KEY` | Application signing key |
| `DEFAULT_SECRET_KEY` | Default fallback signing key |
| `SANDBOX_AUTH_SECRET` | Sandbox authentication secret |
| `SMBCLIENT_PASSWORD` | Samba share password |
| `SEARXNG_SECRET_KEY` | SearXNG instance secret |
| `TOOL_CODE_INTERPRETER` | Stable tool identifier — prefixed `tool_` |
| `TOOL_WEB_SEARCH` | Stable tool identifier — prefixed `tool_` |
| `TOOL_COMPUTER` | Stable tool identifier — prefixed `tool_` |
| `TOOL_VECTOR_STORE_SEARCH` | Stable tool identifier — prefixed `tool_` |

> Tool identifiers are stable across restarts. Only replace them if you need consistent IDs across a fresh reinstall and have persisted them in a database.

---

### Admin Key — Bootstrap Only

`ADMIN_API_KEY` is not generated at init. It is generated and written to `.env` only when you explicitly run:

```bash
pdavid bootstrap-admin
```

This is intentional — it prevents an admin key from existing before the stack is running and the operator is present to record it. The key is shown exactly once and cannot be recovered from the platform.

---

### User Supplied — Set After First Run

These variables are left blank by default. The stack starts without them but related features are unavailable until they are set.

| Variable | Description | How to set |
|---|---|---|
| `HF_TOKEN` | HuggingFace personal access token — required for downloading gated models via vLLM or the training stack | `pdavid configure --set HF_TOKEN=hf_abc123` |
| `HF_CACHE_PATH` | Local path where HuggingFace model weights are cached — auto-resolved to `~/.cache/huggingface` if left blank | `pdavid configure --set HF_CACHE_PATH=/path/to/cache` |

---

### Inference Provider Keys — Optional

Leave blank if you are not using these providers.

| Variable | Provider | How to set |
|---|---|---|
| `TOGETHER_API_KEY` | TogetherAI | `pdavid configure --set TOGETHER_API_KEY=...` |
| `HYPERBOLIC_API_KEY` | Hyperbolic | `pdavid configure --set HYPERBOLIC_API_KEY=...` |
| `DEEP_SEEK_API_KEY` | DeepSeek | `pdavid configure --set DEEP_SEEK_API_KEY=...` |
| `ADMIN_API_KEY` | Set after bootstrapping — see Quick Start | `pdavid bootstrap-admin` |
| `ENTITIES_API_KEY` | SDK user key | Issued via SDK after bootstrapping |
| `ENTITIES_USER_ID` | SDK user ID | Issued via SDK after bootstrapping |

---

### Base URLs

All public-facing routes go through the nginx reverse proxy on port 80. These defaults work for local and single-node deployments and should only be changed when deploying behind a custom domain or load balancer.

| Variable | Default | Description |
|---|---|---|
| `ASSISTANTS_BASE_URL` | `http://localhost:80` | Public API base URL |
| `SANDBOX_SERVER_URL` | `http://sandbox:8000` | Internal sandbox URL |
| `DOWNLOAD_BASE_URL` | `http://localhost:80/v1/files/download` | File download base URL |
| `HYPERBOLIC_BASE_URL` | `https://api.hyperbolic.xyz/v1` | Hyperbolic API endpoint |
| `TOGETHER_BASE_URL` | `https://api.together.xyz/v1` | TogetherAI API endpoint |
| `OLLAMA_BASE_URL` | `http://ollama:11434` | Internal Ollama endpoint |

---

### Database Configuration

These are constructed automatically from individual components on first run. Do not edit them manually.

| Variable | Description |
|---|---|
| `DATABASE_URL` | Internal container connection string — used by the API container |
| `SPECIAL_DB_URL` | Host-side connection string — used for migrations and bootstrap |
| `MYSQL_DATABASE` | Database name — default `entities_db` |
| `MYSQL_USER` | Application database user — default `api_user` |
| `MYSQL_HOST` | Internal container hostname — default `db` |
| `MYSQL_PORT` | Internal container port — default `3306` (host-mapped to `3307`) |
| `REDIS_URL` | Redis connection string — default `redis://redis:6379/0` |

---

### AI Model Configuration

| Variable | Default | Description |
|---|---|---|
| `VLLM_MODEL` | `Qwen/Qwen2.5-VL-3B-Instruct` | Model loaded by the vLLM service on startup |
| `VLLM_EXTRA_FLAGS` | *(blank)* | Extra flags passed to the vLLM command |

To switch models:

```bash
pdavid configure --set VLLM_MODEL=Qwen/Qwen2.5-VL-7B-Instruct
pdavid --mode up --force-recreate --vllm
```

---

### Training Stack

The training stack is opt-in — started with `pdavid --mode up --training`.

| Variable | Default | Description |
|---|---|---|
| `TRAINING_PROFILE` | `laptop` | Resource allocation profile |
| `RAY_ADDRESS` | *(blank)* | Leave blank to start as Ray head node. Set to `ray://<head_ip>:10001` to join an existing cluster |
| `RAY_DASHBOARD_PORT` | `8265` | Ray dashboard port — `http://localhost:8265` |

**Training profiles:**

| Profile | Use case |
|---|---|
| `laptop` | Conservative VRAM, small batch sizes — RTX 3060 class and below |
| `standard` | Balanced defaults — RTX 3080 / 4070 class |
| `high_end` | Maximum throughput — 24GB+ VRAM (RTX 3090, 4090, A100) |

```bash
pdavid configure --set TRAINING_PROFILE=standard
```

---

### Platform Settings

| Variable | Default | Description |
|---|---|---|
| `SHARED_PATH` | `~/projectdavid_share` (auto-resolved per OS) | Shared volume path for uploads, datasets, and model adapters |
| `AUTO_MIGRATE` | `1` | Run Alembic migrations automatically on API startup |
| `DISABLE_FIREJAIL` | `true` | Disable FireJail sandbox isolation — set to `false` for production |
| `LOG_LEVEL` | `INFO` | Application log level — `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `PYTHONUNBUFFERED` | `1` | Ensures Python log output is not buffered |
| `PDAVID_VERSION` | Auto-resolved | Tracks installed package version for upgrade notices — do not edit |

---

### Samba File Share

| Variable | Default | Description |
|---|---|---|
| `SMBCLIENT_SERVER` | `samba_server` | Samba container hostname |
| `SMBCLIENT_SHARE` | `cosmic_share` | Share name |
| `SMBCLIENT_USERNAME` | `samba_user` | Samba username |
| `SMBCLIENT_PORT` | `445` | Samba port |
| `SAMBA_USERID` | `1000` | Host UID for file ownership — match your host user |
| `SAMBA_GROUPID` | `1000` | Host GID for file ownership — match your host group |

---

### Admin Configuration

| Variable | Default | Description |
|---|---|---|
| `ADMIN_USER_EMAIL` | `admin@example.com` | Default admin email — change before bootstrapping |
| `ADMIN_USER_ID` | *(blank)* | Populated after bootstrapping |
| `ADMIN_KEY_PREFIX` | *(blank)* | Populated after bootstrapping |

---

## Rotating Secrets

### Safe to rotate on a live stack

Variables not in the dangerous or requires-down categories can be updated and applied with a simple recreate:

```bash
pdavid configure --set VARIABLE=value
pdavid --mode up --force-recreate
```

### Requires a full restart

These variables require the stack to be stopped and restarted to take effect:

```bash
pdavid configure --set SECRET_KEY=<new_value>
pdavid --mode down_only
pdavid --mode up
```

Variables requiring a full restart: `SECRET_KEY`, `DEFAULT_SECRET_KEY`, `SIGNED_URL_SECRET`, `SANDBOX_AUTH_SECRET`, `SEARXNG_SECRET_KEY`, `ADMIN_API_KEY`.

### Dangerous rotation — data implications

These variables are tied to encrypted or hashed data. Rotating them on a live stack will break access to existing data:

```bash
# Back up your data first, then:
pdavid --mode down_only --clear-volumes
pdavid --mode up
```

Variables with data implications: `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `SMBCLIENT_PASSWORD`.

> ⚠️ Rotating database passwords invalidates the existing database connection. All data in `mysql_data` volume will be inaccessible until the password is consistent between the `.env` file and the database. Only rotate these if you are also recreating the database volume.

---

## Related

- [Platform Overview](/docs/platform-overview) — quick start and stack modes
- [Upgrading Platform](/docs/platform-upgrading) — upgrade path and data safety
- [Core Configuration Reference](/docs/core-configuration) — core-specific variables