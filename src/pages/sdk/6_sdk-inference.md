---
title: Inference
category: sdk
slug: sdk-inference
lifecycle_step: stream_events
nav_order: 6
---

# Inference

Inference executes a Run against its Thread. Creating a Run alone does not
start model execution.

| Mode | Use |
|---|---|
| Streaming | Deliver events as execution progresses. |
| Buffered | Wait for a complete response. |
| Stateless | Generate a response without conversation resources. |

## Configure

Complete [Authentication](/docs/api_keys) and register a provider credential
for the model you intend to use. For stateful inference, create an Assistant,
Thread, user Message and queued Run as shown in the
[Quick Start](/docs/sdk-quick-start).

Set `PROJECTDAVID_RUN_ID`, `PROJECTDAVID_MESSAGE_ID` and
`PROJECTDAVID_PROVIDER_KEY_ID` to the corresponding identifiers.
Use resources belonging to the authenticated account. The cURL examples use
Bash and `jq`.

```python interface=python
import os

from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv()

client = Entity(
    base_url=os.getenv("PROJECTDAVID_BASE_URL", "https://api.projectdavid.co.uk"),
    api_key=os.environ["PROJECTDAVID_API_KEY"],
)

run = client.runs.retrieve_run(os.environ["PROJECTDAVID_RUN_ID"])
message_id = os.environ["PROJECTDAVID_MESSAGE_ID"]
provider_key_id = os.environ["PROJECTDAVID_PROVIDER_KEY_ID"]
```

```curl interface=curl
set -euo pipefail
BASE_URL="${PROJECTDAVID_BASE_URL:-https://api.projectdavid.co.uk}"
RUN_ID="${PROJECTDAVID_RUN_ID:?Set the run ID}"
MESSAGE_ID="${PROJECTDAVID_MESSAGE_ID:?Set the message ID}"
PROVIDER_KEY_ID="${PROJECTDAVID_PROVIDER_KEY_ID:?Set the provider key ID}"

RUN=$(curl -fsS "$BASE_URL/v1/runs/$RUN_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY")

MODEL=$(jq -er '.model' <<< "$RUN")
THREAD_ID=$(jq -er '.thread_id' <<< "$RUN")
ASSISTANT_ID=$(jq -er '.assistant_id' <<< "$RUN")
```

The Run's stored model determines model selection. Use that model when
requesting inference rather than selecting a different one at streaming time.
The Project David API key authenticates the request; `provider_key_id`
selects the registered inference credential.

## Stream a response

Use the SDK's typed event interface or consume raw server-sent events (SSE)
over HTTP. This example assumes an Assistant that does not require
application-executed function calls.

```python interface=python
from projectdavid.events import ContentEvent

stream = client.synchronous_inference_stream
stream.setup(
    thread_id=run.thread_id,
    assistant_id=run.assistant_id,
    message_id=message_id,
    run_id=run.id,
    provider_key_id=provider_key_id,
)

for event in stream.stream_events(model=run.model):
    if isinstance(event, ContentEvent):
        print(event.content, end="", flush=True)

print()
```

```curl interface=curl
jq -n --arg model "$MODEL" --arg thread "$THREAD_ID" \
  --arg message "$MESSAGE_ID" --arg run "$RUN_ID" \
  --arg assistant "$ASSISTANT_ID" --arg key "$PROVIDER_KEY_ID" \
  '{model:$model,thread_id:$thread,message_id:$message,
    run_id:$run,assistant_id:$assistant,provider_key_id:$key,stream:true}' \
  | curl -fsSN "$BASE_URL/v1/completions" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" \
      -H 'Content-Type: application/json' \
      --data-binary @-
```

The SDK maps incoming chunks to typed events. The HTTP example displays the
raw SSE frames. Raw HTTP consumers must implement their own event processing
and any required client-side tool continuation.

Keep the stream wrapper in a local variable: each access to
`client.synchronous_inference_stream` creates a new wrapper. Do not share a
configured wrapper across concurrent requests. For lower-level dictionary
chunks, use `stream_chunks()` instead of `stream_events()`; the former does
not perform the typed event handling and suppresses `call_arguments` chunks
by default.

## Buffer a response

As an alternative to streaming, request a complete response. Use a fresh
queued Run and its corresponding user Message: do not execute the streaming
and buffered examples sequentially against the same Run.

```python interface=python
completion = client.inference.create_completion_sync(
    model=run.model,
    thread_id=run.thread_id,
    message_id=message_id,
    run_id=run.id,
    assistant_id=run.assistant_id,
    provider_key_id=provider_key_id,
)

print(completion["choices"][0]["message"]["content"])
```

```curl interface=curl
jq -n --arg model "$MODEL" --arg thread "$THREAD_ID" \
  --arg message "$MESSAGE_ID" --arg run "$RUN_ID" \
  --arg assistant "$ASSISTANT_ID" --arg key "$PROVIDER_KEY_ID" \
  '{model:$model,thread_id:$thread,message_id:$message,
    run_id:$run,assistant_id:$assistant,provider_key_id:$key,stream:false}' \
  | curl -fsS "$BASE_URL/v1/completions" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" \
      -H 'Content-Type: application/json' \
      --data-binary @- \
  | jq -er 'if .type == "error" then error("Inference failed") else .content end'
```

Buffered delivery still executes the stateful workflow. The SDK assembles a
completion-style dictionary; Core returns its own buffered response object.
The SDK's assembled `usage` fields are placeholders, not measured token usage.
Use streaming for application-executed tools that require event handling.

## Check execution status

The end of a stream or receipt of a buffered response is not proof that the
Run completed successfully. Retrieve the Run to inspect its recorded status.

```python interface=python
result = client.runs.retrieve_run(run.id)
print(result.status)
print(result.last_error)
```

```curl interface=curl
curl -fsS "$BASE_URL/v1/runs/$RUN_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  | jq '{status,last_error}'
```

See [Runs](/docs/sdk-runs) for lifecycle states and cancellation. After a
transport interruption, inspect the existing Run before attempting another
execution. Do not assume that a disconnected stream cancelled the Run.

## Stateless completion

For bounded text generation without Assistant, Thread, Message or Run IDs,
use stateless completion. Supply exactly one of `prompt` or `messages`.
Stateless requests are buffered, not streamed.

The following examples use a direct Hyperbolic provider credential. Set
`PROVIDER_API_KEY` in your environment before running them.

```python interface=python
completion = client.inference.create_stateless_completion(
    model="hyperbolic/deepseek-v4-flash-0731",
    prompt="Summarize the purpose of TCP in one sentence.",
    provider_api_key=os.environ["PROVIDER_API_KEY"],
    max_tokens=128,
    temperature=0.2,
    top_p=1.0,
)

print(completion["choices"][0]["text"])
```

```curl interface=curl
jq -n \
  '{model:"hyperbolic/deepseek-v4-flash-0731",
    prompt:"Summarize the purpose of TCP in one sentence.",
    api_key:env.PROVIDER_API_KEY,max_tokens:128,temperature:0.2,
    top_p:1,stream:false,stateless:true}' \
  | curl -fsS "$BASE_URL/v1/completions" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" \
      -H 'Content-Type: application/json' \
      --data-binary @- \
  | jq -er '.choices[0].text'
```

The HTTP stateless request schema also supports `provider_key_id` in place of
`api_key`. The current SDK's `create_stateless_completion()` does not expose
that argument. Do not pass both credential forms in the same request.

For stateful requests, prefer registered credentials. Direct provider keys
are passed as `api_key` to the stateful SDK setup or HTTP body, not as the
Project David authentication header. For inference configured without BYOK,
omit both provider credential fields.

## Reference

- [Inference](/docs/sdk-reference-inference)
- [Streaming](/docs/sdk-reference-streaming)
- [Streaming events](/docs/sdk-reference-events)
- [Provider keys](/docs/sdk-reference-provider-keys)
- [HTTP API Reference](/docs/api-reference)
