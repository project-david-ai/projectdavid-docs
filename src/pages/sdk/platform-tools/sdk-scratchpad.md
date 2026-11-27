---
title: Scratchpad tool
category: sdk
slug: sdk-scratch-pad
nav_order: 7.2
---

# Scratchpad tool

Give an assistant working memory for planning and incremental findings. This is the model-facing tool, not the application-facing Scratchpads resource API.

## Enable the tool

Complete [Authentication](/docs/api_keys) first. The examples create an assistant; they do not execute inference. Use a model and runtime that support the capability.

```python interface=python
import os

from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv()

client = Entity(
    base_url=os.getenv("PROJECTDAVID_BASE_URL", "https://api.projectdavid.co.uk"),
    api_key=os.environ["PROJECTDAVID_API_KEY"],
)

assistant = client.assistants.create_assistant(
    name='Planning Assistant',
    model='hyperbolic/deepseek-v4-flash-0731',
    instructions='Use the scratchpad to record a plan and incremental findings.',
    tools=[{'type': 'scratch_pad'}],
)
print(assistant.id)
```

```curl interface=curl
BASE_URL="${PROJECTDAVID_BASE_URL:-https://api.projectdavid.co.uk}"
BASE_URL="${BASE_URL%/}"
: "${PROJECTDAVID_API_KEY:?Set your API key}"

curl -fsS "$BASE_URL/v1/assistants" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON'
{
  "name": "Planning Assistant",
  "model": "hyperbolic/deepseek-v4-flash-0731",
  "instructions": "Use the scratchpad to record a plan and incremental findings.",
  "tools": [
    {
      "type": "scratch_pad"
    }
  ]
}
JSON
```

## Execute

Use the returned assistant in the [Inference](/docs/sdk-inference) workflow, with a registered provider credential. Create a thread, message and run, then consume the inference stream. A tool declaration makes the capability available; it does not guarantee that the model will invoke it.

## Operations

| Model-facing operation | Purpose |
|---|---|
| `read_scratchpad` | Read current working state |
| `update_scratchpad` | Replace or revise the working body |
| `append_scratchpad` | Add an entry without replacing the working body |

In delegated research, participants can use shared working state. Scratchpad entries are model-generated working material, not independently verified evidence or an immutable audit log.

## Stream activity

The raw event discriminator is `scratchpad_status`; the SDK maps it to `ScratchpadEvent`. Route these events separately from assistant text.

| Field | Purpose |
|---|---|
| `run_id` | Run associated with the SDK stream |
| `operation` | Read, update or append |
| `state` | Operation lifecycle state |
| `activity`, `tool` | Optional progress description and tool name |
| `entry`, `content` | Optional scratchpad data |
| `assistant_id` | Acting assistant when provided |

Use the structured fields rather than parsing the activity string or emoji prefixes. Fields may be absent, and consumers should not assume every operation emits an identical sequence of events.

Applications that need to retrieve or modify canonical thread scratchpads directly should use [Scratchpads](/docs/sdk-scratchpad).

## Reference

- [Tools](/docs/sdk-tools)
- [Assistants](/docs/sdk-assistants)
- [Streaming Protocol](/docs/sdk-stream-contract)
- [Event reference](/docs/sdk-reference-events)
- [Scratchpads SDK Reference](/docs/sdk-reference-scratchpads)
