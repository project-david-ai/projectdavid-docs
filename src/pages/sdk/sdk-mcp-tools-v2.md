---
title: MCP Tools
category: sdk
slug: sdk-mcp-tools
nav_order: 8
---

# MCP Tools

Connect an assistant to a remote [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
server using Streamable HTTP. Register the server, discover its tools and
attach only the capabilities the assistant needs. Discovery alone does not
make tools available to an assistant.

## Configure

Complete [Authentication](/docs/api_keys) and create an
[Assistant](/docs/sdk-assistants). Set `PROJECTDAVID_ASSISTANT_ID` to its ID
and `MCP_SERVER_URL` to your server's MCP endpoint. If the server requires
bearer authentication, set `MCP_BEARER_TOKEN` in your environment as well.
The cURL examples use Bash and `jq`; export the environment variables
before running them.

```python interface=python
import os

from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv()

client = Entity(
    base_url=os.getenv("PROJECTDAVID_BASE_URL", "https://api.projectdavid.co.uk"),
    api_key=os.environ["PROJECTDAVID_API_KEY"],
)
assistant_id = os.environ["PROJECTDAVID_ASSISTANT_ID"]
```

```curl interface=curl
set -euo pipefail
BASE_URL="${PROJECTDAVID_BASE_URL:-https://api.projectdavid.co.uk}"
ASSISTANT_ID="${PROJECTDAVID_ASSISTANT_ID:?Set the assistant ID}"
: "${PROJECTDAVID_API_KEY:?Set the Project David API key}"
: "${MCP_SERVER_URL:?Set the MCP server URL}"
```

## Register a server

Authentication is associated with the registration, not each tool call.
The server URL must be reachable from Core. Registration supports no
remote authentication or a bearer token; the response exposes `auth_type`,
not the token. Keep remote credentials separate from the Project David API key.

```python interface=python
server = client.mcp.create_server(
    name="Knowledge tools",
    url=os.environ["MCP_SERVER_URL"],
    bearer_token=os.getenv("MCP_BEARER_TOKEN") or None,
)
server_id = server.id
print(server_id, server.auth_type)
```

```curl interface=curl
SERVER=$(jq -n '
  {name:"Knowledge tools",url:env.MCP_SERVER_URL}
  + (if (env.MCP_BEARER_TOKEN // "") != ""
     then {auth:{type:"bearer",token:env.MCP_BEARER_TOKEN}}
     else {} end)' \
  | curl -fsS "$BASE_URL/v1/mcp/servers" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" \
      -H "Content-Type: application/json" --data-binary @-)
SERVER_ID=$(jq -er '.id' <<< "$SERVER")
jq '{id,auth_type}' <<< "$SERVER"
```

Reuse the returned server ID for subsequent operations rather than creating
another registration for every Run.

## Discover tools

The SDK returns a `McpToolCollection`, following pagination automatically.
Raw HTTP returns one page with `tools` and an optional `next_cursor`.
The following examples collect and inspect all pages, with a 100-page limit
and repeated-cursor detection.

```python interface=python
tools = client.mcp.discover_tools(server_id)
for tool in tools:
    print(tool.name, tool.description)
```

```curl interface=curl
discover_tools() {
  local page cursor seen='[]' i
  local -a query=()
  for ((i=0; i<100; i++)); do
    page=$(curl -fsS -G "$BASE_URL/v1/mcp/servers/$SERVER_ID/tools" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" "${query[@]}") || return 1
    jq -c '.tools[]' <<< "$page" || return 1
    if jq -e '.next_cursor == null' <<< "$page" >/dev/null; then
      return 0
    fi
    cursor=$(jq -er '.next_cursor' <<< "$page") || return 1
    if jq -e --arg c "$cursor" 'index($c) != null' <<< "$seen" >/dev/null; then
      echo "Repeated MCP discovery cursor" >&2
      return 1
    fi
    seen=$(jq -c --arg c "$cursor" '. + [$c]' <<< "$seen") || return 1
    query=(--data-urlencode "cursor=$cursor")
  done
  echo "MCP discovery exceeded 100 pages" >&2
  return 1
}

DISCOVERED=$(discover_tools | jq -s '.')
jq -r '.[] | [.remote_name, (.definition.function.description // "")] | @tsv' \
  <<< "$DISCOVERED"
```

Use the advertised remote name when selecting tools. A discovery record
also exposes `server_id`, `canonical_id`, `provider_name` and the function
`definition`. The SDK's `name` property aliases `remote_name`.

For explicit page control, use `discover_tools_page(server_id, cursor=...)`.

## Attach selected tools

Inspect the advertised schemas and side effects before granting access.
Set `MCP_TOOL_NAME` to a tool name from discovery. In Python, `select()`
accepts multiple names and rejects unknown names. `attach_tools()` derives
the server ID from the selected objects; each attachment request must
contain tools from one server only.

```python interface=python
tool_name = os.environ["MCP_TOOL_NAME"]
selected = tools.select(tool_name)

attached = client.mcp.attach_tools(
    assistant_id=assistant_id,
    tools=selected,
)
for tool in attached:
    print(tool.remote_name, tool.provider_name)
```

```curl interface=curl
TOOL_NAME="${MCP_TOOL_NAME:?Set a discovered remote tool name}"
jq -e --arg name "$TOOL_NAME" \
  'any(.[]; .remote_name == $name)' <<< "$DISCOVERED" >/dev/null

jq -n --arg server "$SERVER_ID" --arg name "$TOOL_NAME" \
  '{server_id:$server,tools:[$name]}' \
  | curl -fsS "$BASE_URL/v1/assistants/$ASSISTANT_ID/mcp-tools" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" \
      -H "Content-Type: application/json" --data-binary @-
```

The HTTP attachment body contains remote tool names, not provider names or
function definitions. Do not copy discovered schemas into the assistant's
ordinary function array as a substitute for creating MCP attachments.

## Inspect attachments

Attachments are distinct from the server's current discovery results.
List them to see the remote capabilities associated with the assistant.

```python interface=python
for tool in client.mcp.list_assistant_tools(assistant_id):
    print(tool.registration_id, tool.remote_name, tool.enabled)
```

```curl interface=curl
curl -fsS "$BASE_URL/v1/assistants/$ASSISTANT_ID/mcp-tools" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  | jq '.[] | {registration_id,remote_name,enabled}'
```

## Execute

Use the configured assistant in the normal [Inference](/docs/sdk-inference)
workflow with a tool-capable model. Project David routes attached MCP tools
to their registered server. Application-local function handlers are a
separate integration described in [Function calling](/docs/function-calling-and-tool-execution).
The remote bearer token does not need to be supplied again in the inference
request.

## Rotate the credential

For a bearer-authenticated registration, set `NEW_MCP_BEARER_TOKEN` to the
replacement token. Rotation updates the existing registration without
creating a new server ID. Verify discovery after rotation.

```python interface=python
server = client.mcp.rotate_server_credential(
    server_id,
    bearer_token=os.environ["NEW_MCP_BEARER_TOKEN"],
)
client.mcp.discover_tools(server)
```

```curl interface=curl
: "${NEW_MCP_BEARER_TOKEN:?Set the replacement bearer token}"
jq -n '{type:"bearer",token:env.NEW_MCP_BEARER_TOKEN}' \
  | curl -fsS -X PUT "$BASE_URL/v1/mcp/servers/$SERVER_ID/credential" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" \
      -H "Content-Type: application/json" --data-binary @-

# Verify with the discovery helper defined above.
DISCOVERED=$(discover_tools | jq -s '.')
```

## Detach tools

Remove the selected capabilities from this assistant without deleting the
server registration.

```python interface=python
client.mcp.detach_assistant_tools(
    assistant_id,
    server_id=server_id,
    tools=[tool_name],
)
```

```curl interface=curl
jq -n --arg server "$SERVER_ID" --arg name "$TOOL_NAME" \
  '{server_id:$server,tools:[$name]}' \
  | curl -fsS -X DELETE "$BASE_URL/v1/assistants/$ASSISTANT_ID/mcp-tools" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" \
      -H "Content-Type: application/json" --data-binary @-
```

## Manage registrations

| Operation | Python SDK | HTTP API |
|---|---|---|
| List | `client.mcp.list_servers()` | `GET /v1/mcp/servers` |
| Retrieve | `client.mcp.retrieve_server(server_id)` | `GET /v1/mcp/servers/{server_id}` |
| Update | `client.mcp.update_server(server_id, ...)` | `PATCH /v1/mcp/servers/{server_id}` |
| Delete | `client.mcp.delete_server(server_id)` | `DELETE /v1/mcp/servers/{server_id}` |

Update supports `name`, `timeout_seconds` and `enabled`. Use the separate
credential rotation operation to replace a bearer token. Deleting a server
registration is distinct from detaching a tool; review its use across
assistants before deleting it.

## Reference

- [MCP SDK Reference](/docs/sdk-reference-mcp)
- [Authentication](/docs/api_keys)
- [Inference](/docs/sdk-inference)
- [HTTP API Reference](/docs/api-reference)
