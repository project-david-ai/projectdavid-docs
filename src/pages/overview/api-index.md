---
title: Overview
category: overview
slug: api-index
---

# Project David

Project David is a stateful AI runtime for building and operating agents.
It manages conversation state, model inference, tool execution and streaming
through a unified API.

The API uses familiar assistant, thread, message and run primitives.
Use the hosted service or deploy the runtime on your own infrastructure.

## Capabilities

- Persistent assistants, conversations and run history.
- Inference across supported model providers.
- Built-in tools, application-defined functions and remote MCP tools.
- File storage, vector search and scratchpads.
- Execution accounting and run-level observability.

Self-hosting gives you control over the runtime and its stored state.
Data sent to external inference providers or remote tools remains subject
to those services' processing and retention policies.

## Components

| Component | Purpose |
|---|---|
| [Python SDK](/docs/sdk-reference-client) | Build applications using the Project David API. |
| [Core](/docs/core-overview) | Run and extend the agent execution engine. |
| [Platform](/docs/platform-overview) | Deploy and manage the runtime using the Platform CLI. |

## Reference

- [Quickstart](/docs/sdk-quick-start)
- [Authentication](/docs/api_keys)
- [API reference](/docs/api-reference)
- [Self-hosted setup](/docs/boot_strap_guide)
- [GitHub](https://github.com/project-david-ai)
