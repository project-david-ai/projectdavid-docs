---
title: Core configuration
slug: core-configuration
category: core
nav_order: 2
---

# Core configuration

Configure a source-based Core deployment using the environment and Compose configuration for the checked-out revision. For a packaged deployment, see [Platform configuration](/docs/platform-configuration).

## Local configuration

Inspect the source configuration and the effective Compose service definitions before changing settings. Keep `.env`, local overrides and generated credentials out of version control.

Use a separate development deployment with its own credentials and storage. Do not reuse production secrets or persistent volumes for development.

The source CLI and the packaged `pdavid` CLI are distinct interfaces. Use the commands supported by the installed revision; do not assume that their configuration or initialization behaviour is identical.

## Service configuration

| Setting | Responsibility |
|---|---|
| `DATABASE_URL` | Database connection used by Core |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER` | Database connection settings |
| `REDIS_URL` | Redis connection |
| `SMBCLIENT_SERVER`, `SMBCLIENT_SHARE`, `SMBCLIENT_USERNAME`, `SMBCLIENT_PORT` | File share connection |
| `SHARED_PATH` | Shared storage path |
| `ASSISTANTS_BASE_URL` | API address used by runtime components |
| `SANDBOX_SERVER_URL` | Sandbox service address |
| `DOWNLOAD_BASE_URL` | Base URL for file download links |
| `LOG_LEVEL` | Application logging |
| `AUTO_MIGRATE` | Migration setting |
| `DISABLE_FIREJAIL` | Firejail disable setting |

Check defaults, service addresses and environment variable precedence against the current source and Compose files. Addresses used within the container network may differ from addresses used by external clients. Verify the effective sandbox isolation configuration before running untrusted workloads.

## Credentials and identifiers

Preserve the configuration and key material associated with existing persistent data.

| Settings | Purpose |
|---|---|
| `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` | Database credentials |
| `SMBCLIENT_PASSWORD` | File share credential |
| `API_KEY`, `SANDBOX_AUTH_SECRET` | Internal service authentication |
| `SECRET_KEY`, `DEFAULT_SECRET_KEY`, `SIGNED_URL_SECRET`, `SEARXNG_SECRET_KEY` | Service secrets |
| `PROJECT_DAVID_CREDENTIAL_KEY`, `PROJECT_DAVID_PROVIDER_KEY_HMAC_KEY` | Credential-management key material |
| `TOOL_CODE_INTERPRETER`, `TOOL_WEB_SEARCH`, `TOOL_COMPUTER`, `TOOL_VECTOR_STORE_SEARCH` | Tool identifiers |

Treat connection strings containing passwords as secrets. Tool identifiers are not credentials, but should remain consistent with their associated runtime resources.

Use application API keys for application access. Register tenant-owned provider credentials and MCP credentials through the supported API interfaces. These are distinct from internal service credentials. See [Authentication](/docs/api_keys).

## Configuration changes

Before changing a running deployment:

1. Record the current source revision and effective deployment configuration.
2. Back up the configuration, key material and associated persistent data securely.
3. Identify every service that consumes the setting being changed.
4. Apply the change using the configuration mechanism supported by that deployment.
5. Verify service health, existing resource access and the affected functionality before accepting the change.

Configuration changes do not automatically rotate credentials in their backing services. Changing database passwords may require updating database accounts and dependent connection strings. Replacing credential-management keys without a supported migration can make stored credentials inaccessible.

## Recovery and rotation

Never delete `.env`, regenerate all secrets or remove persistent volumes to rotate credentials or recover an existing deployment.

If configuration is lost, recover the matching configuration and key material from a secure backup. If a secret is compromised, use a coordinated rotation procedure for the affected credential and verify recovery against a non-production copy first. Treat a compromised original secret as sensitive recovery material until migration and revocation are complete.

Application, provider and MCP credential rotation procedures are documented in Authentication. There is no general-purpose service-secret rotation procedure established by this guide.

## Reference

- [Project David Core](/docs/core-overview)
- [Upgrading Core](/docs/core-upgrading)
- [Platform configuration](/docs/platform-configuration)
- [Authentication](/docs/api_keys)
