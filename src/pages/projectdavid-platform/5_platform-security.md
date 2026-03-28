---
title: Security
slug: platform-security
category: projectdavid-platform
nav_order: 5
---

# Security

Project David Platform is designed for deployment in security-sensitive environments — financial services, government, and regulated industries. This page documents the security architecture, supported versions, and the vulnerability disclosure process.

---

## Supported Versions

Security updates are provided for the latest stable release only. Ensure you are running the latest version before reporting a vulnerability.

| Version | Supported |
|---|---|
| >= 1.91.0 | ✅ |
| < 1.91.0 | ❌ |

---

## Security Architecture

### Secret Generation

All secrets are cryptographically generated on first run by the platform orchestrator. No default, weak, or placeholder values are ever written to `.env`. The following are always generated fresh:

- `MYSQL_ROOT_PASSWORD` — MySQL root password
- `MYSQL_PASSWORD` — MySQL application user password
- `SECRET_KEY` — Application signing key
- `DEFAULT_SECRET_KEY` — Default fallback signing key
- `SIGNED_URL_SECRET` — Signed URL generation secret
- `SANDBOX_AUTH_SECRET` — Sandbox authentication secret
- `SMBCLIENT_PASSWORD` — Samba share password
- `SEARXNG_SECRET_KEY` — SearXNG instance secret

The platform validates all secrets on every startup and will refuse to start if any are blank or set to known insecure values.

`.env` is listed in `.dockerignore` — secrets are never copied into Docker images.

---

### Admin Key Bootstrap

`ADMIN_API_KEY` is not generated at init. It is written to `.env` only when you explicitly run:

```bash
pdavid bootstrap-admin
```

This is intentional — no admin key exists until an operator is present to record it. The key is shown exactly once and cannot be recovered from the platform.

> Store the admin key in a secrets manager immediately after bootstrap. Do not use it for general API calls — issue dedicated user keys for all application access.

---

### Sandbox Isolation — FireJail PTY

All code execution runs inside a FireJail PTY sandbox. FireJail uses Linux namespaces and seccomp-bpf syscall filtering to isolate execution from the host.

- Process isolation via Linux namespaces
- Filesystem isolation — sandboxed processes cannot access host paths
- Syscall filtering via seccomp-bpf

> `DISABLE_FIREJAIL=true` is the default for ease of initial setup. **Set this to `false` for any production or multi-user deployment:**

```bash
pdavid configure --set DISABLE_FIREJAIL=false
pdavid --mode up --force-recreate
```

---

### Signed URL File Access

File downloads are served via signed, time-limited tokens. Direct filesystem access to uploaded files is not exposed through the API.

- `SIGNED_URL_SECRET` is auto-generated on first run
- Tokens are scoped to a specific file and expire after a configurable TTL
- Unsigned requests to file paths are rejected

---

### Sandbox Authentication

The sandbox service authenticates all requests from the API using a shared secret:

- `SANDBOX_AUTH_SECRET` is auto-generated on first run
- The sandbox rejects any request that does not present a valid token
- The secret is never exposed through the API surface

---

### API Key Architecture

| Key type | Prefix | Scope |
|---|---|---|
| Admin key | `ad_` | Full platform access — provisioning users, issuing keys |
| User key | `ea_` | Standard API access — assistants, threads, runs, tools |
| Tool identifiers | `tool_` | Internal tool routing — auto-generated, not user-facing |

---

### Network Architecture

All external traffic routes through the nginx reverse proxy on port 80. Internal services communicate over a private Docker bridge network and are not directly exposed:

| Service | Internal port | External exposure |
|---|---|---|
| API | 9000 | Via nginx proxy only |
| Sandbox | 8000 | Via nginx proxy only |
| MySQL | 3306 | `127.0.0.1:3307` only |
| Redis | 6379 | Internal only |
| Qdrant | 6333/6334 | Internal only |
| SearXNG | 8080 | Internal only |

---

### Database Security

- All MySQL credentials are cryptographically generated — no default passwords
- The database container is not exposed on a public interface by default
- All database access goes through the API container — no direct external connections

---

### The Nuke Command

`pdavid --nuke` destroys all stack data including volumes. It requires explicit typed confirmation before executing:

```
Type 'confirm nuke' to proceed:
```

This cannot be triggered accidentally via a flag or script without human interaction. It is provided for operators who need a clean slate and understand the consequences.

---

### Observability

Project David Platform ships with OpenTelemetry instrumentation. Traces are exported to a Jaeger instance running alongside the stack:

- Jaeger UI: `http://localhost:16686`
- All API requests are traced end-to-end
- No trace data leaves the local network by default

---

### Supply Chain Security

Platform pulls pre-built Docker images from Docker Hub under the `thanosprime` namespace. All images are built by the Gold Standard CI pipeline from the projectdavid-core repository:

- Every push to `main` triggers a fresh build and push
- Images are tagged with semantic version, SHA, and `latest`
- Hadolint lints all Dockerfiles on every CI run

To verify which image version you are running:

```bash
docker images | grep thanosprime
```

To pin to a specific verified image version rather than `latest`, see [Pinning to a Specific Version](/docs/platform-upgrading#pinning-to-a-specific-version).

---

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

If you discover a security-related bug in Project David Platform, report it privately. Your report will be handled with high priority.

### Disclosure Process

1. **Email:** [engineering@projectdavid.co.uk](mailto:engineering@projectdavid.co.uk)
2. **Details:** Include a summary of the issue, a proof-of-concept if possible, and the version of the platform you are running (`pip show projectdavid-platform`)
3. **Acknowledgment:** You will receive acknowledgment within 48 hours
4. **Resolution:** We will coordinate a fix and release. Please do not disclose the issue publicly until a patched version has been released

## Responsible Disclosure

Project David Platform is maintained by a solo engineer. We appreciate your patience and your help in keeping the ecosystem safe for our users across 105 countries.

---

## Related

- [Platform Overview](/docs/platform-overview) — quick start and stack modes
- [Configuration Reference](/docs/platform-configuration) — secret management and environment variables
- [Core Security](/docs/core-security) — security documentation for source deployments