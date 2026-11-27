---
title: Tools
category: sdk
slug: sdk-tools
nav_order: 7
---

# Tools

Tools extend an assistant beyond text generation. The integration you choose
determines where the requested operation is executed.

| Integration | Execution |
|---|---|
| Platform tools | Project David runtime |
| Local functions | Your application |
| MCP tools | Registered remote MCP server |

## Platform tools

| Capability | Purpose |
|---|---|
| [Computer](/docs/sdk-computer) | Interact with a containerised Linux environment. |
| [Web search](/docs/sdk-web-search) | Search and retrieve web content. |
| [Deep research](/docs/sdk-deep-research) | Gather evidence and synthesise findings across multiple inference passes. |
| [File search](/docs/sdk-file-search) | Retrieve relevant content from vector stores. |
| [Code interpreter](/docs/sdk-code-interpreter) | Execute Python and produce files in a sandbox. |

Configure the assistant for the capabilities it needs. Some capabilities use
assistant settings or associated resources in addition to tool declarations.
Availability depends on the runtime configuration and inference model.

See each capability guide for its configuration and execution requirements.

## Local functions

Define a function schema in the assistant's `tools` array using
`client.assistants.create_assistant()` or `client.assistants.update_assistant()`.
The corresponding HTTP operations are `POST /v1/assistants` and
`PUT /v1/assistants/{assistant_id}`.

A schema declares the function name, description and argument structure;
it does not register executable application code. During inference, your
application handles the requested function call, validates and authorizes
its arguments, executes the operation and submits the result.

See [Function calling](/docs/function-calling-and-tool-execution)
for the execution and continuation workflow.

## MCP tools

Use MCP to connect an assistant to tools exposed by a remote Model Context
Protocol server. Register the server, discover its tools and attach only
the tools the assistant needs.

| Operation | Python SDK | HTTP API |
|---|---|---|
| Register | `client.mcp.create_server()` | `POST /v1/mcp/servers` |
| Discover | `client.mcp.discover_tools()` | `GET /v1/mcp/servers/{server_id}/tools` |
| Attach | `client.mcp.attach_assistant_tools()` | `POST /v1/assistants/{assistant_id}/mcp-tools` |

MCP attachments retain their registered server association. Do not treat a
remote MCP tool as an application-local function merely by copying its schema
into the assistant's `tools` array.

Manage server credentials separately from application authentication.
See [Authentication](/docs/api_keys) and the MCP reference for the registration,
attachment and credential management interfaces.

## Reference

- [Assistants](/docs/sdk-assistants)
- [Function calling](/docs/function-calling-and-tool-execution)
- [MCP SDK Reference](/docs/sdk-reference-mcp)
- [Actions SDK Reference](/docs/sdk-reference-actions)
- [HTTP API Reference](/docs/api-reference)
