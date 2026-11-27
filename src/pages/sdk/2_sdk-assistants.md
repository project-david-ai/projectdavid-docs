---
title: Assistants
category: sdk
slug: sdk-assistants
lifecycle_step: create_assistant
nav_order: 2
---

# Assistants

An Assistant is a persistent configuration for an AI agent: its model,
instructions and capabilities. Reuse its ID across conversations instead of
creating a new Assistant for each request.

| Resource | Responsibility |
|---|---|
| Assistant | Model, instructions and capabilities |
| Thread | Conversation context |
| Run | An individual execution |

## Configure

Complete [Authentication](/docs/api_keys) first. Run the following examples
in the same Python session or Bash session.

```python interface=python
import os

from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv()

client = Entity(
    base_url=os.getenv("PROJECTDAVID_BASE_URL", "https://api.projectdavid.co.uk"),
    api_key=os.environ["PROJECTDAVID_API_KEY"],
)
```

```bash interface=curl
BASE_URL="${PROJECTDAVID_BASE_URL:-https://api.projectdavid.co.uk}"
set -o pipefail
```

## Create an assistant

Choose a provider-qualified model and define the instructions that guide the
assistant's behaviour.

```python interface=python
assistant = client.assistants.create_assistant(
    name="Network Assistant",
    model="hyperbolic/deepseek-v4-flash-0731",
    instructions="You are a precise network engineering assistant.",
)

assistant_id = assistant.id
print(assistant_id)
```

```curl interface=curl
ASSISTANT_ID=$(curl -fsS "$BASE_URL/v1/assistants" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Network Assistant",
    "model": "hyperbolic/deepseek-v4-flash-0731",
    "instructions": "You are a precise network engineering assistant."
  }' | jq -er '.id')

printf '%s\n' "$ASSISTANT_ID"
```

Core derives ownership from the authenticated API key. No user ID is required
when creating an assistant. Store the returned assistant ID for later use.

Creating an assistant does not execute inference. Provider credentials are
selected separately when executing a run.

## Retrieve an assistant

```python interface=python
assistant = client.assistants.retrieve_assistant(assistant_id)
print(assistant.model, assistant.instructions)
```

```curl interface=curl
curl -fsS "$BASE_URL/v1/assistants/$ASSISTANT_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  | jq '{model, instructions}'
```

## List assistants

```python interface=python
for item in client.assistants.list():
    print(item.id, item.name)
```

```curl interface=curl
curl -fsS "$BASE_URL/v1/assistants" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  | jq '.[] | {id, name}'
```

The API lists assistants associated with the authenticated user.

## Update an assistant

Send the fields you want to change. The assistant retains its identity.

```python interface=python
assistant = client.assistants.update_assistant(
    assistant_id=assistant_id,
    name="Network Troubleshooter",
    instructions="Diagnose network faults using the evidence provided.",
)
```

```curl interface=curl
curl -fsS -X PUT "$BASE_URL/v1/assistants/$ASSISTANT_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Network Troubleshooter",
    "instructions": "Diagnose network faults using the evidence provided."
  }'
```

The model can also be changed through the update operation. Use a model supported
by the intended inference provider.

## Inference parameters

Configure generation settings on creation or update.

| Parameter | Default | Valid values |
|---|---|---|
| `temperature` | `1.0` | `0.0`–`2.0` |
| `top_p` | `1.0` | `0.0`–`1.0` |
| `max_tokens` | `null` | Positive integer or `null` |

`temperature` controls sampling variability. `top_p` limits the probability
mass considered during sampling. `max_tokens` limits generated tokens per
inference pass; `null` leaves the limit to the provider defaults.

```python interface=python
assistant = client.assistants.update_assistant(
    assistant_id=assistant_id,
    temperature=0.2,
    max_tokens=2048,
)
```

```curl interface=curl
curl -fsS -X PUT "$BASE_URL/v1/assistants/$ASSISTANT_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"temperature":0.2,"max_tokens":2048}'
```

Assistant settings are stored configuration. Run creation can supply its own
model and sampling parameters, and providers may impose additional limits.
When a specific sampling configuration is required, set it explicitly on the Run
as well. Lower temperature does not guarantee deterministic output.

## Configure capabilities

An assistant can be configured for different execution capabilities.

| Field | Purpose |
|---|---|
| `tools` | Tool definitions, including application-defined functions |
| `tool_resources` | Resources used by tools |
| `web_access` | Enable web access |
| `agent_mode` | Enable autonomous execution |
| `max_turns` | Limit execution iterations |
| `deep_research` | Enable deep research |

For example, declare a local function that an application can execute when
requested by the model.

```python interface=python
assistant = client.assistants.update_assistant(
    assistant_id=assistant_id,
    tools=[{
        "type": "function",
        "function": {
            "name": "get_device_status",
            "description": "Retrieve the status of a network device.",
            "parameters": {
                "type": "object",
                "properties": {
                    "hostname": {"type": "string"},
                },
                "required": ["hostname"],
            },
        },
    }],
)
```

```curl interface=curl
curl -fsS -X PUT "$BASE_URL/v1/assistants/$ASSISTANT_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_device_status",
        "description": "Retrieve the status of a network device.",
        "parameters": {
          "type": "object",
          "properties": {
            "hostname": {"type": "string"}
          },
          "required": ["hostname"]
        }
      }
    }]
  }'
```

When updating tools, supply the complete intended tool list. A function definition
is a declaration, not executable code. Your application implements the function
and returns its result during execution.

Registered MCP tools and vector stores have separate resource management
interfaces; see their references below.

## Use an assistant

Pass the assistant ID when creating a Run against a Thread. Reuse the same
assistant for subsequent runs without repeating its configuration.

See [Quick Start](/docs/sdk-quick-start) for the complete streaming lifecycle.

## Delete an assistant

When the assistant is no longer needed, delete it. Do not run this example if
you intend to keep using the assistant created above.

```python interface=python
client.assistants.delete_assistant(assistant_id, permanent=False)
```

```curl interface=curl
curl -fsS -X DELETE \
  "$BASE_URL/v1/assistants/$ASSISTANT_ID?permanent=false" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY"
```

Deletion is soft by default. The HTTP API returns `204 No Content` on success;
the SDK returns a deletion result. Setting `permanent=True` in Python or
`permanent=true` in the HTTP query requests irreversible deletion.

## Reference

- [Assistants SDK Reference](/docs/sdk-reference-assistants)
- [Runs SDK Reference](/docs/sdk-reference-runs)
- [MCP SDK Reference](/docs/sdk-reference-mcp)
- [Vector Stores SDK Reference](/docs/sdk-reference-vector-stores)
- [HTTP API Reference](/docs/api-reference)
