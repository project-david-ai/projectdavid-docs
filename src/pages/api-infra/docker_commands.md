# Docker Commands Reference

This document captures all supported Docker orchestration commands used in the `entities` system via the `platform-api` CLI.

---

## General Startup


**Install the local package.**

```bash
pip install -e .
```


### Default Startup (build & up)




```bash
platform-api docker-manager --mode both
```

### Bring Up Without Rebuilding

```bash
platform-api docker-manager --mode up
```

### Run with Ollama (Optional Local LLMs)

```bash
platform-api docker-manager --mode up --with-ollama
```

With GPU passthrough:

```bash
platform-api docker-manager --mode up --with-ollama --ollama-gpu
```

---

## Docker Lifecycle Commands

| Action                        | Command |
|-------------------------------|---------|
| **Bring up containers**       | `platform-api docker-manager --mode up` |
| **Build Docker images**       | `platform-api docker-manager --mode build` |
| **Build & bring up**          | `platform-api docker-manager --mode both` |
| **No-cache build**            | `platform-api docker-manager --mode build --no-cache` |
| **No-cache build & up**       | `platform-api docker-manager --mode both --no-cache` |
| **Clear volumes & restart**   | `platform-api docker-manager --mode up --clear-volumes` |
| **Stop containers**           | `platform-api docker-manager --down` |
| **Stop & clear all data**     | `platform-api docker-manager --down --clear-volumes` |
| **Debug cache/docker health** | `platform-api docker-manager --debug-cache` |

---

## Build Specific Services

| Service                 | Command |
|-------------------------|---------|
| **Main API**            | `platform-api docker-manager --mode build --services api` |
| **Database (MySQL)**    | `platform-api docker-manager --mode build --services db` |
| **Vector DB (Qdrant)**  | `platform-api docker-manager --mode build --services qdrant` |
| **Sandbox**             | `platform-api docker-manager --mode build --services sandbox` |
| **File Server (Samba)** | `platform-api docker-manager --mode build --services samba` |

---

## Logging

| Action                                              | Command |
|-----------------------------------------------------|---------|
| View all logs (last 100 lines)                      | `platform-api docker-manager --mode logs --tail 100` |
| Follow logs for all services                        | `platform-api docker-manager --mode logs --follow` |
| Follow logs for specific services with timestamps   | `platform-api docker-manager --mode logs --follow --timestamps --services api db` |
| View logs without service name prefix               | `platform-api docker-manager --mode logs --tail 200 --no-log-prefix` |
| Save logs to file (shell redirection)               | `platform-api docker-manager --mode logs --tail 1000 > output.log` |
| Follow logs for a single service                    | `platform-api docker-manager --mode logs --follow --services otel-collector` |
| Save all logs to file                               | `platform-api docker-manager --mode logs > docker_logs.log` |
| Save last 1000 lines to file                        | `platform-api docker-manager --mode logs --tail 1000 > docker_logs.log` |
| Save logs with timestamps to file                   | `platform-api docker-manager --mode logs --timestamps > docker_logs.log` |
| Save logs for specific services to file             | `platform-api docker-manager --mode logs --services api otel-collector > docker_logs.log` |
| Append to existing file                             | `platform-api docker-manager --mode logs --tail 500 >> docker_logs.log` |