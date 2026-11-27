---
title: Web Search
category: sdk
slug: sdk-Web-Search
nav_exclude: true
---

# Web Search

Give an assistant access to web search and page retrieval through the runtime's web tools.

## Enable web access

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
    name='Web Research Assistant',
    model='hyperbolic/deepseek-v4-flash-0731',
    instructions='Use web sources to answer questions and identify the sources used.',
    tools=[{'type': 'web_search'}],
    web_access=True,
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
  "name": "Web Research Assistant",
  "model": "hyperbolic/deepseek-v4-flash-0731",
  "instructions": "Use web sources to answer questions and identify the sources used.",
  "tools": [
    {
      "type": "web_search"
    }
  ],
  "web_access": true
}
JSON
```

## Execute

Use the returned assistant in the [Inference](/docs/sdk-inference) workflow, with a registered provider credential. Create a thread, message and run, then consume the inference stream. A tool declaration makes the capability available; it does not guarantee that the model will invoke it.

Ask the assistant to find a current fact and identify its sources. Search and retrieval may be limited by runtime configuration, network access and upstream websites.

## Stream web activity

`WebStatusEvent` represents `web_status` events. Use its `status`, `message`, `tool` and `url` fields when supplied to display progress separately from `ContentEvent` response text. A progress event or URL alone does not establish that a claim has been verified.

For multi-step delegated investigation, see [Deep Research](/docs/sdk-deep-research).

## Reference

- [Tools](/docs/sdk-tools)
- [Assistants](/docs/sdk-assistants)
- [Streaming Protocol](/docs/sdk-stream-contract)
- [Event reference](/docs/sdk-reference-events)
