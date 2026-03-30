---
title: Inference
category: sdk
slug: sdk-inference
lifecycle_step: stream_events
nav_order: 6
---

# Inference

Inference is the stage where an assistant processes a thread and generates a response. The SDK provides a synchronous streaming interface that handles SSE, event mapping, and tool call interception transparently.

## Basic streaming example

```python
import os
from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv()

client = Entity(
    base_url=os.getenv("BASE_URL", "http://localhost:9000"),
    api_key=os.getenv("ENTITIES_API_KEY")
)

API_KEY = os.getenv("HYPERBOLIC_API_KEY")
MODEL   = "hyperbolic/deepseek-ai/DeepSeek-V3-0324"

# Setup
assistant = client.assistants.create_assistant(
    name="my-assistant",
    instructions="You are a helpful assistant."
)
thread  = client.threads.create_thread()
message = client.messages.create_message(
    thread_id=thread.id,
    assistant_id=assistant.id,
    role="user",
    content="Explain a black hole in pure mathematical terms."
)
run = client.runs.create_run(
    assistant_id=assistant.id,
    thread_id=thread.id
)

# Stream
sync_stream = SynchronousInferenceStream.for_request(
    inference=client.inference,
    runs_client=client.runs,
    actions_client=client.actions,
    messages_client=client.messages,
    assistants_client=client.assistants,
)
sync_stream.setup(
    thread_id=thread.id,
    assistant_id=assistant.id,
    message_id=message.id,
    run_id=run.id,
    api_key=API_KEY
)

for chunk in sync_stream.stream_chunks(model=MODEL, timeout_per_chunk=60.0):
    content = chunk.get("content", "")
    if content:
        print(content, end="", flush=True)
```

## Typed event streaming

For richer control, use `stream_events` instead of `stream_chunks`. This yields typed event objects rather than raw dicts.

```python
from projectdavid.events import ContentEvent, ToolCallRequestEvent, ReasoningEvent

for event in sync_stream.stream_events(model=MODEL):

    if isinstance(event, ContentEvent):
        print(event.content, end="", flush=True)

    elif isinstance(event, ReasoningEvent):
        print(f"[thinking] {event.content}")

    elif isinstance(event, ToolCallRequestEvent):
        print(f"[tool call] {event.tool_name}({event.args})")
```

## Event types

| Event | Description |
|---|---|
| `ContentEvent` | Assistant text output. |
| `ReasoningEvent` | Internal thinking tokens (extended thinking models). |
| `ToolCallRequestEvent` | Assistant requested a tool call. |
| `ScratchpadEvent` | Supervisor scratchpad update from a worker agent. |
| `ResearchStatusEvent` | Deep research progress update. |
| `WebStatusEvent` | Web search status update. |
| `CodeStatusEvent` | Code interpreter status update. |
| `ShellStatusEvent` | Shell session status update. |
| `EngineerStatusEvent` | Network engineering tool status. |
| `CodeExecutionGeneratedFileEvent` | File produced by code interpreter. |
| `ComputerGeneratedFileEvent` | File produced by computer use. |
| `ToolInterceptEvent` | Tool call intercepted before execution. |
| `DecisionEvent` | Supervisor decision token. |
| `PlanEvent` | Supervisor plan token. |

## Thread safety

`SynchronousInferenceStream` must be instantiated fresh per request. Do not cache or share an instance across concurrent requests — `setup()` overwrites internal state.

```python
# Correct — new instance per request
stream = SynchronousInferenceStream.for_request(
    inference=client.inference,
    runs_client=client.runs,
    actions_client=client.actions,
    messages_client=client.messages,
    assistants_client=client.assistants,
)
```

## Notes

- `stream_chunks` yields raw dicts. `stream_events` yields typed objects.
- Tool call validation runs automatically in `stream_events`. Invalid calls are intercepted and submitted as error tool output without propagating to the caller.
- `api_key` in `setup()` is the LLM provider key, not the platform key. The platform key is set on the `Entity` client at initialization.