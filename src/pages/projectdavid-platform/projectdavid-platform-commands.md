---
title: Project David Platform CLI Commands
category: projectdavid-platform
slug: projectdavid-platform-commands
nav_order: 1
---


# pdavid command reference

This document covers all supported commands for the `projectdavid-platform` CLI.

---

## Installation

```bash
pip install projectdavid-platform
```

Local development install:

```bash
pip install -e .
```

---

## General startup

### Default startup

```bash
pdavid --mode up
```

### Start with GPU services (vLLM)

Requires an Nvidia GPU and `nvidia-container-toolkit` installed on the host.

```bash
pdavid --mode up --gpu
```

### Force recreate all containers

```bash
pdavid --mode up --force-recreate
```

### Bring down before starting

```bash
pdavid --mode up --down
```

### Bring down, clear all volumes, and restart

```bash
pdavid --mode up --down --clear-volumes
```

---

## Docker lifecycle commands

| Action | Command |
|---|---|
| Bring up containers | `pdavid --mode up` |
| Bring up with GPU services | `pdavid --mode up --gpu` |
| Build images only | `pdavid --mode build` |
| Build then bring up | `pdavid --mode both` |
| No-cache build | `pdavid --mode build --no-cache` |
| No-cache build and up | `pdavid --mode both --no-cache` |
| Parallel build | `pdavid --mode build --parallel` |
| Force recreate containers | `pdavid --mode up --force-recreate` |
| Stop containers | `pdavid --mode down_only` |
| Stop and clear all volumes | `pdavid --mode down_only --clear-volumes` |
| Run in foreground (attached) | `pdavid --mode up --attached` |

---

## Targeting specific services

Start only selected services:

```bash
pdavid --mode up --services api db qdrant
```

Build a specific service:

```bash
pdavid --mode build --services api
```

Exclude services from startup:

```bash
pdavid --mode up --exclude ollama
pdavid --mode up --exclude ollama --exclude jaeger
```

---

## Services reference

| Service | Description |
|---|---|
| `api` | FastAPI orchestration backend |
| `sandbox` | Secure code execution environment |
| `db` | MySQL 8.0 — relational persistence |
| `qdrant` | Vector database |
| `redis` | Cache and message broker |
| `searxng` | Self-hosted web search |
| `browser` | Headless Chromium for web agent tooling |
| `otel-collector` | OpenTelemetry telemetry collection |
| `jaeger` | Distributed tracing UI |
| `samba` | File sharing for uploaded documents |
| `ollama` | Local LLM inference |
| `nginx` | Reverse proxy — single public entry point on port 80 |
| `vllm` | GPU inference (opt-in, requires `--gpu`) |

---

## Logging

| Action | Command |
|---|---|
| View all logs | `pdavid --mode logs` |
| Follow all logs | `pdavid --mode logs --follow` |
| Follow with timestamps | `pdavid --mode logs --follow --timestamps` |
| Last N lines | `pdavid --mode logs --tail 100` |
| Follow specific services | `pdavid --mode logs --follow --services api nginx` |
| Follow single service | `pdavid --mode logs --follow --services api` |
| No service name prefix | `pdavid --mode logs --tail 200 --no-log-prefix` |
| Save all logs to file | `pdavid --mode logs > docker_logs.log` |
| Save last 1000 lines to file | `pdavid --mode logs --tail 1000 > docker_logs.log` |
| Save with timestamps to file | `pdavid --mode logs --timestamps > docker_logs.log` |
| Save specific services to file | `pdavid --mode logs --services api nginx > docker_logs.log` |
| Append to existing file | `pdavid --mode logs --tail 500 >> docker_logs.log` |

---

## Configuration

Update a variable in `.env` without regenerating secrets:

```bash
pdavid configure --set HF_TOKEN=hf_abc123
pdavid configure --set VLLM_MODEL=Qwen/Qwen2.5-VL-7B-Instruct
```

Interactive configuration prompt:

```bash
pdavid configure --interactive
```

> Note: Rotating `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, or `SMBCLIENT_PASSWORD`
> on a live stack requires a full down and volume clear. The CLI will warn you if
> the variable you are setting requires this.

---

## Provisioning

Bootstrap the default admin user (stack must be running first):

```bash
pdavid bootstrap-admin
```

This provisions the admin user and prints a one-time `ADMIN_API_KEY`. Copy it immediately — it will not be shown again. Once bootstrapped, all further user management is done via the API using the `projectdavid` SDK or direct API calls.

---

## Danger zone

Destroy all stack data system-wide. Requires interactive confirmation. Cannot be undone.

```bash
pdavid --nuke
```

---

## Environment variables

| Variable | Description |
|---|---|
| `PDAVID_NO_UPDATE_CHECK=1` | Disable container version check on startup. Useful for air-gapped environments or CI. |

---

## Upgrade

```bash
pip install --upgrade projectdavid-platform
pdavid --mode up --force-recreate
```

The orchestrator writes `PDAVID_VERSION` to `.env` automatically on each run. The compose file uses this to pin owned image tags (`api`, `sandbox`) to the installed package version. Running `--force-recreate` after an upgrade pulls the new images and recreates the containers.