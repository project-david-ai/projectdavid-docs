---
title: Deep Research
category: sdk
slug: sdk-deep-research
nav_exclude: true
---

# Deep Research

Use delegated research for tasks requiring multiple searches, evidence gathering and synthesis. It can involve multiple inference passes rather than a single response.

## Enable Deep Research

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
    name='Research Assistant',
    model='hyperbolic/deepseek-v4-flash-0731',
    instructions='Investigate the question using available sources. Distinguish verified evidence from uncertainty.',
    tools=[{'type': 'web_search'}],
    deep_research=True,
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
  "name": "Research Assistant",
  "model": "hyperbolic/deepseek-v4-flash-0731",
  "instructions": "Investigate the question using available sources. Distinguish verified evidence from uncertainty.",
  "tools": [
    {
      "type": "web_search"
    }
  ],
  "deep_research": true
}
JSON
```

## Execute

Use the returned assistant in the [Inference](/docs/sdk-inference) workflow, with a registered provider credential. Create a thread, message and run, then consume the inference stream. A tool declaration makes the capability available; it does not guarantee that the model will invoke it.

Use a research-capable model. Allow for additional latency and provider usage. The resulting report is model-generated; verify consequential claims against their sources.

## Disable Deep Research

The flag is an assistant setting. Update it before creating the next run; this is not cancellation of an active run. Continue with the client and assistant created above. For HTTP, set `ASSISTANT_ID` to the ID returned by the create request.

```python interface=python
assistant = client.assistants.update_assistant(
    assistant_id=assistant.id,
    deep_research=False,
)
```

```curl interface=curl
curl -fsS -X PUT "$BASE_URL/v1/assistants/$ASSISTANT_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"deep_research":false}'
```

Other tool and web-access settings are separate from this flag.

## Stream research activity

| Raw event type | Python SDK event |
|---|---|
| `research_status` | `ResearchStatusEvent` |
| `web_status` | `WebStatusEvent` |
| `scratchpad_status` | `ScratchpadEvent` |
| `content` | `ContentEvent` |

Route progress independently of response text. Where supplied, use the scratchpad event's `assistant_id` to distinguish participating agents. Retrieve the Run to verify its final state rather than inferring completion from a progress message.

## Reference

- [Tools](/docs/sdk-tools)
- [Assistants](/docs/sdk-assistants)
- [Streaming Protocol](/docs/sdk-stream-contract)
- [Event reference](/docs/sdk-reference-events)
- [Scratchpad tool](/docs/sdk-scratch-pad)
