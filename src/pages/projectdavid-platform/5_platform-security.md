---
title: Security
slug: platform-security
category: projectdavid-platform
nav_order: 5
---

# Security

Self-hosting Project David gives operators control over the runtime, its storage and network exposure. Operators remain responsible for securing the deployment, reviewing tool permissions and assessing the data sent to external services.

## Supported versions

Security updates are provided for the latest stable release. Keep the Platform package and runtime images on compatible, maintained releases. See [Upgrading Platform](/docs/platform-upgrading).

Report vulnerabilities even if you first encounter them on an older release. Include the affected versions in your report.

## Credentials

Platform generates service credentials when initializing a runtime directory, including database passwords, signing secrets, sandbox authentication material and credential-management keys. The startup validator rejects a defined set of empty or known insecure values; it is not a comprehensive secret-strength or configuration audit.

Protect the runtime `.env`, its backups and any credential handoff files. Restrict access to the deployment account and authorized administrators. Do not commit these files, include them in container images, or disclose them in logs or support reports. Platform creates a `.dockerignore` excluding `.env` files if one does not already exist; verify existing ignore rules and source-control exclusions separately.

If `.env` is missing but the runtime instance identity remains, Platform refuses to generate a replacement. Recover the original configuration and credentials. Do not reset persistent storage to recover a key.

For generated settings and rotation limitations, see [Configuration Reference](/docs/platform-configuration).

## API access

The Core authentication dependency validates application API keys supplied in the `X-API-Key` header against active credentials and checks their expiry when configured.

| Credential | Purpose |
|---|---|
| Administrator API key | Administrative operations and provisioning |
| Application API key | API access within the authenticated user's authorized scope |
| Registered provider key | Authentication to an inference provider on behalf of its owner |
| MCP credential | Authentication to a registered remote MCP server |

`pdavid bootstrap-admin` obtains the administrator credential from Core and persists it in the runtime `.env`. Normal CLI output reports the key prefix rather than the plaintext. JSON output without a credential handoff file may include the full key; treat it as sensitive.

Use dedicated application credentials for normal workloads. Protected service-key status does not by itself grant cross-user privileges. Manage application, provider and MCP credentials through their respective API interfaces, not by replacing arbitrary values in `.env`.

## Files and downloads

Signed download URLs contain a file identifier, expiry and signature. Core verifies the signature and expiry before serving the file. Issuing a new signed URL requires an authenticated caller authorized to access the file.

A signed URL is a bearer credential: the download request does not require an API key. Anyone possessing a valid link may be able to retrieve its contents. Use short expiry periods, HTTPS and controlled distribution; avoid logging complete URLs.

Soft deletion must not be treated as immediate access revocation. Existing signed links may remain usable, and the authenticated Base64 retrieval interface is a separate access path. See [Files](/docs/sdk-files) for the current file lifecycle contract.

## Execution and network isolation

The Platform configuration generator defaults `DISABLE_FIREJAIL` to `true`. Do not assume Firejail is active or that all tool execution is isolated from the host. Before allowing untrusted code or multi-user workloads, verify the effective sandbox configuration, container privileges, mounted paths, authentication and network restrictions. Setting a configuration variable alone is not evidence of an effective isolation boundary.

The following are deployment requirements, not guarantees of the packaged defaults:

- Use HTTPS for remote API access, signed downloads and externally accessible tool connections.
- Restrict inbound traffic to required interfaces. Inspect the effective Compose configuration and actual Docker port bindings; keep databases, caches, storage, sandbox and observability endpoints off public networks unless explicitly required and secured.
- Restrict tool permissions and outbound connectivity according to the workload. Review local function handlers and remote MCP capabilities before allowing an assistant to use them.
- Treat traces, logs and execution records as potentially sensitive data. Restrict access and verify retention, redaction and export settings.

External inference providers, web search services and remote MCP servers may receive application data. Review their processing and retention policies before enabling them for sensitive workloads. Self-hosting does not by itself establish air-gapped operation or regulatory compliance.

## Maintenance and recovery

Keep a restorable backup of persistent data, configuration and associated key material. Review image provenance and release compatibility before upgrades; record the actual deployed image IDs or digests, not just the package version or a mutable image tag.

Do not use `--clear-volumes` or `--nuke` for ordinary maintenance, upgrades or credential recovery. The current `--nuke` implementation runs Compose teardown with volume removal followed by `docker system prune -a --volumes --force`. This is host-wide Docker cleanup and can affect unrelated workloads and unused storage. Its typed confirmation is not a security boundary.

## Reporting a vulnerability

Report security issues privately to [engineering@projectdavid.co.uk](mailto:engineering@projectdavid.co.uk). Do not open a public issue containing exploit details or credentials.

Include the affected Platform package version, runtime image identities where available, a description of the impact, and safe reproduction steps. Remove customer data, credentials and signed URLs from the report.

The project aims to acknowledge reports within 48 hours and coordinate remediation and disclosure with the reporter.

## Reference

- [Self-hosted Setup](/docs/boot_strap_guide)
- [Configuration Reference](/docs/platform-configuration)
- [Authentication](/docs/api_keys)
- [Upgrading Platform](/docs/platform-upgrading)
- [Core Security](/docs/core-security)
