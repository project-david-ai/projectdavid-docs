---
title: Quick Start
category: sdk
slug: sdk-quick-start
nav_order: 1
---

# Quick Start

## Synchronous Stream

> The synchronous streaming interface is considered legacy. It will continue to function, but the event-driven interface is recommended for all new implementations.

For a full list of supported model endpoint IDs, see the [Model Compatibility Report](/docs/providers-Model-Compatibility-Report).

```python
import os
from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv()

client = Entity(
    base_url=os.getenv("BASE_URL"),
    api_key=os.getenv("ENTITIES_API_KEY"),
)

assistant = client.assistants.create_assistant(
    name="my_assistant",
    instructions="You are a helpful AI assistant.",
)

thread = client.threads.create_thread()

message = client.messages.create_message(
    thread_id=thread.id,
    role="user",
    content="Tell me about the latest trends in AI.",
    assistant_id=assistant.id,
)

run = client.runs.create_run(
    assistant_id=assistant.id,
    thread_id=thread.id,
)

stream = client.synchronous_inference_stream
stream.setup(
    user_id=os.getenv("ENTITIES_USER_ID"),
    thread_id=thread.id,
    assistant_id=assistant.id,
    message_id=message.id,
    run_id=run.id,
    api_key=os.getenv("PROVIDER_API_KEY"),
)

for chunk in stream.stream_chunks(
    provider="Hyperbolic",
    model="hyperbolic/deepseek-ai/DeepSeek-V3-0324",
    timeout_per_chunk=15.0,
):
    content = chunk.get("content", "")
    if content:
        print(content, end="", flush=True)
```

## Event-driven Stream

> The event-driven interface is the recommended approach. It provides access to
> Level 2 and Level 3 agentic capabilities and separates reasoning from content events,
> allowing each to be handled independently before rendering in your application.

Swap `PROVIDER` and `MODEL` for any entry from the [Model Compatibility Report](/docs/providers-Model-Compatibility-Report).

```python
import os
from dotenv import load_dotenv
from projectdavid import Entity
from projectdavid.events import ContentEvent, ReasoningEvent

load_dotenv()

client = Entity(
    base_url=os.getenv("BASE_URL"),
    api_key=os.getenv("ENTITIES_API_KEY"),
)

PROVIDER = "Hyperbolic"
MODEL    = "hyperbolic/deepseek-ai/DeepSeek-V3"

assistant = client.assistants.create_assistant(
    name="my_assistant",
    instructions="You are a helpful AI assistant.",
)

thread = client.threads.create_thread()

message = client.messages.create_message(
    thread_id=thread.id,
    role="user",
    content="Explain the difference between TCP and UDP in one paragraph.",
    assistant_id=assistant.id,
)

run = client.runs.create_run(
    assistant_id=assistant.id,
    thread_id=thread.id,
)

stream = client.synchronous_inference_stream
stream.setup(
    user_id=os.getenv("ENTITIES_USER_ID"),
    thread_id=thread.id,
    assistant_id=assistant.id,
    message_id=message.id,
    run_id=run.id,
    api_key=os.getenv("PROVIDER_API_KEY"),
)

current_mode = None

for event in stream.stream_events(model=MODEL):

    if isinstance(event, ReasoningEvent):
        if current_mode != "reasoning":
            print("\n[Reasoning]: ", end="")
            current_mode = "reasoning"
        print(event.content, end="", flush=True)

    elif isinstance(event, ContentEvent):
        if current_mode != "content":
            print("\n\n[Response]: ", end="")
            current_mode = "content"
        print(event.content, end="", flush=True)
```