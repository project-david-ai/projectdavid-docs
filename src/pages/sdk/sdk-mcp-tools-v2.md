---
title: MCP Tools
category: sdk
slug: sdk-mcp-tools
nav_order: 8
---

# MCP Tools

Project David can connect an assistant to tools exposed by a remote [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server.

The SDK keeps the normal workflow deliberately simple:

1. Register an MCP server.
2. Discover the tools it currently advertises.
3. Inspect or select the tools you want.
4. Attach those tools to an assistant.

Discovery does **not** automatically attach every tool exposed by a server. An MCP server can advertise capabilities with very different purposes and side effects, so attachment remains explicit.

## Register an MCP server

```python
from projectdavid import Entity

client = Entity()

server = client.mcp.create_server(
    name="github",
    url="https://example.com/mcp",
)
```

The returned server registration can be passed directly into discovery:

```python
tools = client.mcp.discover_tools(server)
```

You can also pass a server registration ID:

```python
tools = client.mcp.discover_tools("mcp_server_123")
```

## Discover tools

`discover_tools()` is the normal SDK entry point for MCP discovery.

```python
tools = client.mcp.discover_tools(server)
```

It automatically follows MCP pagination and returns an `McpToolCollection`.

You do not need to inspect raw response dictionaries or manually follow `next_cursor`.

```python
for tool in tools:
    print(tool.name, tool.description)
```

Each discovered tool is represented by an `McpDiscoveredTool` model.

Useful fields include:

```python
tool.name
tool.description

tool.server_id
tool.remote_name
tool.canonical_id
tool.provider_name
tool.definition
```

`tool.name` is the ergonomic form of the remote MCP tool name.

`tool.definition` contains the complete Project David function-tool definition produced from the MCP server's advertised schema.

## Work with a tool collection

`McpToolCollection` behaves like a read-only sequence:

```python
print(len(tools))

first = tools[0]

for tool in tools:
    print(tool.name)
```

It also provides helpers for common discovery tasks.

### Get one tool

```python
tool = tools.get("search.issues")

if tool is not None:
    print(tool.description)
```

`get()` returns `None` when the requested tool is not present.

### Select tools

Use `select()` when an assistant should receive only part of a server's advertised tool set:

```python
selected = tools.select(
    "search.issues",
    "get.issue",
)
```

The returned value is another `McpToolCollection`.

Selection preserves the original discovery order and does not duplicate a tool when the same name is supplied more than once.

Requesting a tool that was not discovered raises `ValueError`:

```python
selected = tools.select(
    "search.issues",
    "does.not.exist",
)
```

### Get tool names

```python
names = tools.names()
```

Example result:

```python
[
    "search.issues",
    "get.issue",
    "create.issue",
]
```

### Get function definitions

```python
definitions = tools.definitions()
```

This returns copies of the Project David function-tool definitions for the collection.

### Get canonical IDs

```python
canonical_ids = tools.canonical_ids()
```

Canonical IDs are stable Project David identities for the discovered MCP tools.

## Attach selected tools to an assistant

The recommended attachment flow is to pass discovered tool objects directly back to the SDK.

```python
tools = client.mcp.discover_tools(server)

selected = tools.select(
    "search.issues",
    "get.issue",
)

attached = client.mcp.attach_tools(
    assistant_id="assistant_123",
    tools=selected,
)
```

You do not need to repeat the MCP server ID. Each discovered tool already carries its server provenance, and `attach_tools()` derives the correct server registration automatically.

The SDK rejects:

- an empty collection;
- tools from more than one MCP server;
- values that are not discovered MCP tool models.

The underlying API still receives the remote MCP tool names expected by Project David Core.

## Explicitly attach every discovered tool

If you genuinely want every tool advertised by a server, pass the full collection explicitly:

```python
tools = client.mcp.discover_tools(server)

attached = client.mcp.attach_tools(
    assistant_id="assistant_123",
    tools=tools,
)
```

This is intentionally explicit. Calling `discover_tools()` alone never attaches tools to an assistant.

## Inspect before attaching

A useful pattern is to inspect the advertised capabilities before selecting them:

```python
tools = client.mcp.discover_tools(server)

for tool in tools:
    print(f"{tool.name}: {tool.description}")
```

Then attach only the capabilities required by the assistant:

```python
selected = tools.select(
    "search.issues",
    "get.issue",
)

client.mcp.attach_tools(
    assistant_id="assistant_123",
    tools=selected,
)
```

Do not assume that every tool exposed by one MCP server belongs to a single coherent or equally trusted capability set.

## Low-level page discovery

Most applications should use `discover_tools()`.

If you specifically need access to one discovery page at a time, use `discover_tools_page()`:

```python
page = client.mcp.discover_tools_page(server)

for tool in page.tools:
    print(tool.name)

print(page.next_cursor)
```

To request the next page manually:

```python
page = client.mcp.discover_tools_page(
    server,
    cursor=page.next_cursor,
)
```

`discover_tools_page()` returns an `McpToolDiscoveryPage`.

This low-level method exists for callers that genuinely need page-level control. Ordinary SDK usage should prefer the automatically paginated `discover_tools()` method.

## List tools already attached to an assistant

Use the assistant MCP tool listing endpoint to inspect durable MCP attachments:

```python
attached = client.mcp.list_assistant_tools(
    "assistant_123",
)

for tool in attached:
    print(tool.remote_name, tool.provider_name)
```

These are the MCP tools currently attached to the assistant, not the full set currently advertised by the remote server.

## Low-level attachment API

The SDK retains the lower-level attachment method for callers that already know the remote MCP tool names:

```python
attached = client.mcp.attach_assistant_tools(
    "assistant_123",
    server_id="mcp_server_123",
    tools=[
        "search.issues",
        "get.issue",
    ],
)
```

For normal discovery-driven workflows, prefer:

```python
tools = client.mcp.discover_tools(server)

client.mcp.attach_tools(
    assistant_id="assistant_123",
    tools=tools.select(
        "search.issues",
        "get.issue",
    ),
)
```

The higher-level form removes duplicated server information and keeps attachment coupled to actual discovery results.

## Detach MCP tools

The low-level detach method removes selected MCP tool attachments from an assistant:

```python
client.mcp.detach_assistant_tools(
    "assistant_123",
    server_id="mcp_server_123",
    tools=[
        "search.issues",
        "get.issue",
    ],
)
```

Detaching an MCP tool removes that assistant's durable attachment to the selected remote capability.

## Manage MCP server registrations

The MCP client also exposes the server management operations used by the Project David MCP API.

### List registered servers

```python
servers = client.mcp.list_servers()

for server in servers:
    print(server.id, server.name)
```

### Retrieve a server

```python
server = client.mcp.retrieve_server(
    "mcp_server_123"
)
```

### Update a server

```python
server = client.mcp.update_server(
    "mcp_server_123",
    name="github-primary",
)
```

### Delete a server

```python
client.mcp.delete_server(
    "mcp_server_123"
)
```

Deleting a server registration is a management operation and is distinct from merely detaching selected tools from one assistant.

## Complete example

```python
from projectdavid import Entity

client = Entity()

server = client.mcp.create_server(
    name="github",
    url="https://example.com/mcp",
)

tools = client.mcp.discover_tools(server)

print("Available MCP tools:")

for tool in tools:
    print(f"- {tool.name}: {tool.description}")

selected = tools.select(
    "search.issues",
    "get.issue",
)

attached = client.mcp.attach_tools(
    assistant_id="assistant_123",
    tools=selected,
)

print("Attached:")
for tool in attached:
    print(f"- {tool.remote_name}")
```

The important distinction is:

```text
MCP server
    ↓
discover_tools()
    ↓
McpToolCollection
    ↓
inspect / select
    ↓
attach_tools()
    ↓
assistant
```

Discovery tells you what the remote MCP server currently advertises.

Attachment determines which of those capabilities Project David makes available to a particular assistant.
