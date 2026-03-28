---
title: Security
slug: core-security
category: core
nav_order: 5
---

# Security

Project David Core is designed for deployment in security-sensitive environments — financial services, government, and regulated industries. This page documents the security architecture, supported versions, and the vulnerability disclosure process.

---

## Supported Versions

Security updates are provided for the latest stable release only. Ensure you are running the latest version before reporting a vulnerability.

| Version | Supported |
|---|---|
| >= 1.28.0 | ✅ |
| < 1.28.0 | ❌ |

---

## Security Architecture

### Sandbox Isolation — FireJail PTY

All code execution requested by assistants runs inside a FireJail PTY sandbox. FireJail uses Linux namespaces and seccomp-bpf syscall filtering to isolate the execution environment from the host system.

- Process isolation via Linux namespaces
- Filesystem isolation — sandboxed processes cannot access host paths
- Network isolation — outbound connections are restricted
- Syscall filtering via seccomp-bpf

The sandbox container requires elevated Linux capabilities (`SYS_ADMIN`, `/dev/fuse`) to support FireJail. These are scoped to the sandbox container only — the API container runs without elevated privileges.

> `DISABLE_FIREJAIL=true` is set by default for local development. **Set this to `false` for any production or multi-user deployment.**

---

### Signed URL File Access

File downloads are served via signed URLs with time-limited tokens. Direct filesystem access to uploaded files is not exposed through the API.

- `SIGNED_URL_SECRET` is auto-generated on first run
- Tokens are scoped to a specific file and expire after a configurable TTL
- Unsigned requests to file paths are rejected

---

### Sandbox Authentication

The sandbox service authenticates requests from the API using a shared secret:

- `SANDBOX_AUTH_SECRET` is auto-generated on first run
- The sandbox rejects any request that does not present a valid token
- The secret is never exposed through the API surface

---

### API Key Architecture

Project David uses a prefix-scoped API key system:

| Key type | Prefix | Scope |
|---|---|---|
| Admin key | `ad_` | Full platform access — provisioning users, issuing keys |
| User key | `ea_` | Standard API access — assistants, threads, runs, tools |
| Tool identifiers | `tool_` | Internal tool routing — auto-generated, not user-facing |

Admin keys are shown exactly once at bootstrap and cannot be recovered. Store them in a secrets manager, not in source code or `.env` files committed to version control.

---

### Database Security

- MySQL credentials are auto-generated at setup — no default passwords
- `MYSQL_ROOT_PASSWORD` and `MYSQL_PASSWORD` are cryptographically random
- The database container is not exposed on a public interface by default — port `3307` is bound to `127.0.0.1` in production configurations
- All database access goes through the API container — no direct external database connections

---

### Network Architecture

All external traffic routes through the nginx reverse proxy on port 80. Internal services communicate over a private Docker bridge network (`my_custom_network`) and are not directly exposed:

| Service | Internal port | External exposure |
|---|---|---|
| API | 9000 | Via nginx proxy only |
| Sandbox | 8000 | Via nginx proxy only |
| MySQL | 3306 | `127.0.0.1:3307` only |
| Redis | 6379 | Internal only |
| Qdrant | 6333/6334 | Internal only |
| SearXNG | 8080 | Internal only |

---

### Secret Management

All secrets are auto-generated on first run and stored in `.env`. The following are never set to default or weak values:

- `MYSQL_ROOT_PASSWORD`
- `MYSQL_PASSWORD`
- `SECRET_KEY`
- `DEFAULT_SECRET_KEY`
- `SIGNED_URL_SECRET`
- `SANDBOX_AUTH_SECRET`
- `SMBCLIENT_PASSWORD`
- `SEARXNG_SECRET_KEY`

`.env` is listed in `.gitignore` and must never be committed to version control.

---

### Supply Chain Security

The API container uses a two-stage pip install with hashed requirements:

- `api_reqs_hashed.txt` — stable trusted packages installed with `--require-hashes`
- `api_unhashed_reqs.txt` — packages where hash pinning is not practical

This ensures that pip will reject any package that does not match the expected hash — protecting against dependency substitution attacks.

---

### Observability

Project David Core ships with OpenTelemetry instrumentation. Traces are exported to a Jaeger instance running alongside the stack:

- Jaeger UI: `http://localhost:16686`
- All API requests are traced end-to-end
- No trace data leaves the local network by default

---

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

If you discover a security-related bug in Project David Core, report it privately. Your report will be handled with high priority.

### Disclosure Process

1. **Email:** [engineering@projectdavid.co.uk](mailto:engineering@projectdavid.co.uk)
2. **Details:** Include a summary of the issue, a proof-of-concept if possible, and the version of Core you are running
3. **Acknowledgment:** You will receive acknowledgment within 48 hours
4. **Resolution:** We will coordinate a fix and release. Please do not disclose the issue publicly until a patched version has been released

## Responsible Disclosure

Project David Core is maintained by a solo engineer. We appreciate your patience and your help in keeping the ecosystem safe for our users across 105 countries.

---

## Related

- [Project David Core](/docs/core-overview) — quick start and CLI reference
- [Configuration Reference](/docs/core-configuration) — secret management and environment variables
- [Contributing](/docs/core-contributing) — contribution guidelines