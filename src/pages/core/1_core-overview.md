---
title: Project David Core
slug: core-overview
category: core
nav_order: 1
---

# Project David Core

Project David Core is the self-hostable runtime for model inference and agent orchestration. It exposes a common API for assistants, threads, messages, runs, tools and files, with persistent execution state and streaming responses.

Core is the source distribution. Use it to inspect, modify or contribute to the runtime. For a pre-built container deployment, use [Project David Platform](/docs/platform-overview).

## Architecture

| Layer | Responsibility |
|---|---|
| API and runtime | Resource management, inference routing, tool execution and streaming |
| Execution accounting | Recorded run and action state |
| MySQL | Persistent resource and execution records |
| Redis | Runtime coordination |
| Sandbox | Isolated code and computer execution |
| Qdrant | Vector storage and retrieval |
| File storage | Uploaded files and generated artifacts |
| SearXNG | Web search |
| Nginx | HTTP entry point |

Core orchestrates inference through supported model providers. Model hosting and GPU provisioning are separate infrastructure concerns. Running Core on your own infrastructure gives you control over its deployment and stored data; data sent to an external inference provider is subject to that provider's processing and retention policies.

## Run from source

You need Git, Docker with Compose, and a compatible Python environment. Consult the source repository for the requirements of the revision you intend to run.

```bash
git clone https://github.com/project-david-ai/projectdavid-core.git
cd projectdavid-core
pip install -e .
```

For a source checkout that exposes the Core CLI, inspect the available commands before starting the base stack:

```bash
platform-api docker-manager --help
platform-api docker-manager --mode up
```

The source CLI and the packaged Platform CLI (`pdavid`) are distinct deployment interfaces. Follow the instructions for your installed distribution and revision; do not mix their bootstrap or configuration commands.

Keep generated runtime credentials and local configuration out of version control. Use the credential management interface supported by your deployment to provision application access. Reserve administrative credentials for administrative operations.

## Connect an application

Once the runtime is running, use its configured API address and an application API key. The Python SDK and HTTP API use the same resource and inference interfaces whether the runtime is self-hosted or remotely hosted.

The [Quick Start](/docs/sdk-quick-start) demonstrates the assistant lifecycle. Substitute your deployment's base URL for the hosted API address used in its examples.

## License

Distributed under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/). Commercial use requires a separate licence. Contact [licensing@projectdavid.co.uk](mailto:licensing@projectdavid.co.uk).

## Reference

- [Core source repository](https://github.com/project-david-ai/projectdavid-core)
- [Project David Platform](/docs/platform-overview)
- [Authentication](/docs/api_keys)
- [Quick Start](/docs/sdk-quick-start)
- [Python SDK Reference](/docs/sdk-reference-client)
- [HTTP API Reference](/docs/api-reference)
