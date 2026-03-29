---
title: Quick Start
category: sdk
slug: sdk-quick-start
nav_order: 1
# nav_exclude: true
---

# Quick Start

The Project David SDK gives you a familiar Assistants-style interface — Assistants,
Threads, Messages, Runs — that works with any model on any infrastructure. This
guide gets you from zero to a streaming response in under 5 minutes.

---

## Prerequisites

```bash
pip install projectdavid python-dotenv
```

You need a running Project David instance. If you do not have one yet:

- **Fastest path** — [Project David Platform](/docs/platform-overview) — `pip install projectdavid-platform && pdavid --mode up`
- **From source** — [Project David Core](/docs/core-overview)

Create a `.env` file with your credentials:

```bash
BASE_URL=http://localhost:80          # URL of your running platform instance
ENTITIES_API_KEY=ea_your_user_key    # Issued after bootstrapping
ENTITIES_USER_ID=user_your_id        # Your user ID
PROVIDER_API_KEY=your_provider_key   # Only needed for hosted providers
```

---

## Event-Driven Stream

The event-driven interface is the recommended approach for all new implementations.
It separates reasoning from content events, provides access to Level 2 and Level 3
agentic capabilities, and gives your application clean hooks for every stage of
the inference lifecycle.

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

# 1. Create an assistant
assistant = client.assistants.create_assistant(
    name="my_assistant",
    instructions="You are a helpful AI assistant.",
)

# 2. Open a thread
thread = client.threads.create_thread()

# 3. Add a message
message = client.messages.create_message(
    thread_id=thread.id,
    role="user",
    content="Explain the difference between TCP and UDP in one paragraph.",
    assistant_id=assistant.id,
)

# 4. Create a run
run = client.runs.create_run(
    assistant_id=assistant.id,
    thread_id=thread.id,
)

# 5. Stream the response
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

For a full list of supported providers and model IDs, see the
[Model Compatibility Report](/docs/providers-Model-Compatibility-Report).

---

## Local Inference with Ollama

No API key required. Run any model on your own hardware — fully air-gapped,
no data leaves your infrastructure.

Start Ollama with your platform:

```bash
pdavid --mode up --ollama
```

Then pull a model:

```bash
docker exec -it ollama ollama pull qwen2.5:7b
```

```python
import os
from dotenv import load_dotenv
from projectdavid import Entity
from projectdavid.events import ContentEvent

load_dotenv()

client = Entity(
    base_url=os.getenv("BASE_URL"),
    api_key=os.getenv("ENTITIES_API_KEY"),
)

assistant = client.assistants.create_assistant(
    name="local_assistant",
    instructions="You are a helpful AI assistant running on local hardware.",
)

thread = client.threads.create_thread()

message = client.messages.create_message(
    thread_id=thread.id,
    role="user",
    content="What is the capital of France?",
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
    api_key=None,  # No API key needed for local inference
)

for event in stream.stream_events(model="qwen2.5:7b"):
    if isinstance(event, ContentEvent):
        print(event.content, end="", flush=True)
```

---

## What Just Happened

Every interaction follows the same five-step pattern:

| Step | What it does |
|---|---|
| `create_assistant` | Defines the AI's identity and instructions |
| `create_thread` | Opens a conversation context |
| `create_message` | Adds a user message to the thread |
| `create_run` | Triggers the assistant to process the thread |
| `stream_events` | Streams the response token by token |

This pattern is consistent across every provider, every model, and every capability
level — from a simple chat response to a multi-agent deep research run.

---

## Next Steps

- [Assistants](/docs/sdk-assistants) — create, update, and manage assistants
- [Threads & Messages](/docs/sdk-threads) — conversation management
- [Runs](/docs/sdk-runs) — run lifecycle and status
- [Tools](/docs/sdk-tools) — code interpreter, web search, file search
- [Providers](/docs/providers) — full provider and model reference
- [Stream Contract](/docs/sdk-stream-contract) — complete event type reference