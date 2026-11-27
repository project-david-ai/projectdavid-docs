---
title: Quick Start
category: sdk
slug: sdk-quick-start
nav_order: 1
---

# Quick Start

Create an assistant and stream your first response with Project David.

## Install

```bash interface=python
# Requires Python 3.10 or later.
pip install projectdavid
```

```bash interface=curl
# Run the examples in Bash with cURL, jq and uuidgen installed.
curl --version
jq --version
command -v uuidgen
```

## Configure

Obtain a Project David API key from the [Dashboard](https://platform.projectdavid.co.uk)
and an inference provider API key from Hyperbolic.

```dotenv interface=python
# Save as .env beside quickstart.py. Keep it out of version control.
PROJECTDAVID_API_KEY=your_project_david_api_key
PROVIDER_API_KEY=your_hyperbolic_api_key
```

```bash interface=curl
# Set these variables in your Bash session.
export PROJECTDAVID_API_KEY='your_project_david_api_key'
export PROVIDER_API_KEY='your_hyperbolic_api_key'
```

The Project David API key authenticates your application.
The provider API key authorizes model inference.

## Stream a response

```python interface=python
# Save as quickstart.py and run: python quickstart.py
import os

from dotenv import load_dotenv
from projectdavid import Entity
from projectdavid.events import ContentEvent

load_dotenv()

client = Entity(
    base_url="https://api.projectdavid.co.uk",
    api_key=os.environ["PROJECTDAVID_API_KEY"],
)

provider_key = client.provider_keys.create(
    provider="hyperbolic",
    api_key=os.environ["PROVIDER_API_KEY"],
    name="Quickstart",
)

# 1. Create an assistant.
assistant = client.assistants.create_assistant(
    name="Quickstart Assistant",
    model="hyperbolic/deepseek-v4-flash-0731",
    instructions="You are a helpful AI assistant.",
)

# 2. Create a thread.
thread = client.threads.create_thread()

# 3. Add a message.
message = client.messages.create_message(
    thread_id=thread.id,
    assistant_id=assistant.id,
    role="user",
    content="Explain the difference between TCP and UDP.",
)

# 4. Create a run.
run = client.runs.create_run(
    assistant_id=assistant.id,
    thread_id=thread.id,
)

# 5. Stream the response.
stream = client.synchronous_inference_stream
stream.setup(
    thread_id=thread.id,
    assistant_id=assistant.id,
    message_id=message.id,
    run_id=run.id,
    provider_key_id=provider_key.id,
)

for event in stream.stream_events(model=run.model):
    if isinstance(event, ContentEvent):
        print(event.content, end="", flush=True)

print()

completed_run = client.runs.retrieve_run(run.id)
print(f"Run status: {completed_run.status}")
```

```curl interface=curl
# Save as quickstart.sh and run: bash quickstart.sh
set -euo pipefail
BASE_URL="https://api.projectdavid.co.uk"
MODEL="hyperbolic/deepseek-v4-flash-0731"

post() {
  curl -fsS "$BASE_URL$1" \
    -H "X-API-Key: $PROJECTDAVID_API_KEY" \
    -H 'Content-Type: application/json' \
    --data-binary @-
}

# Register the provider credential.
PROVIDER_KEY_ID=$(jq -n \
  '{provider:"hyperbolic",api_key:env.PROVIDER_API_KEY,name:"Quickstart"}' \
  | post /v1/provider-keys | jq -er '.id')

# 1. Create an assistant.
ASSISTANT_ID=$(jq -n --arg model "$MODEL" \
  '{name:"Quickstart Assistant",model:$model,instructions:"You are a helpful AI assistant."}' \
  | post /v1/assistants | jq -er '.id')

# 2. Create a thread.
THREAD_ID=$(printf '{}' | post /v1/threads | jq -er '.id')

# 3. Add a message.
MESSAGE_ID=$(jq -n --arg thread "$THREAD_ID" --arg assistant "$ASSISTANT_ID" \
  '{thread_id:$thread,assistant_id:$assistant,role:"user",content:"Explain the difference between TCP and UDP."}' \
  | post /v1/messages | jq -er '.id')

# 4. Create a run. The HTTP API requires an ID and timestamps.
NOW=$(date +%s)
RUN=$(jq -n \
  --arg id "run_$(uuidgen | tr -d '-')" \
  --arg thread "$THREAD_ID" --arg assistant "$ASSISTANT_ID" \
  --argjson now "$NOW" --argjson expires "$((NOW + 3600))" \
  '{id:$id,thread_id:$thread,assistant_id:$assistant,instructions:"",created_at:$now,expires_at:$expires,temperature:1,top_p:1}' \
  | post /v1/runs)
RUN_ID=$(jq -er '.id' <<< "$RUN")
MODEL=$(jq -er '.model' <<< "$RUN")

# 5. Stream the raw server-sent events (SSE).
jq -n --arg model "$MODEL" --arg thread "$THREAD_ID" \
  --arg message "$MESSAGE_ID" --arg run "$RUN_ID" \
  --arg assistant "$ASSISTANT_ID" --arg key "$PROVIDER_KEY_ID" \
  '{model:$model,thread_id:$thread,message_id:$message,run_id:$run,assistant_id:$assistant,provider_key_id:$key,stream:true}' \
  | curl -fsSN "$BASE_URL/v1/completions" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" \
      -H 'Content-Type: application/json' \
      --data-binary @-

curl -fsS "$BASE_URL/v1/runs/$RUN_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" | jq -r '.status'
```

The SDK exposes typed events and prints the assistant's content. The cURL example
prints the raw SSE stream. Both use the same Core resources and registered
provider credential. The final Run status should be `completed`.

## The lifecycle

| Resource | Responsibility |
|---|---|
| Assistant | Model, instructions and capabilities |
| Thread | Persistent conversation context |
| Message | Conversation input or output |
| Run | An individual execution |
| Stream | Real-time execution events |

Reuse the Assistant and Thread when continuing a conversation. Create a new
Message and Run for each new interaction.

## Registered provider keys

Store the registered provider key ID for subsequent requests. You do not need to
submit the raw provider API key for every inference request.

See [Provider Keys](/docs/sdk-reference-provider-keys) for credential management.

## Reference

- [Python SDK Reference](/docs/sdk-reference-client)
- [HTTP API Reference](/docs/api-reference)

## Self-hosting

To run Project David on your own infrastructure, see the [Platform overview](/docs/platform-overview).
