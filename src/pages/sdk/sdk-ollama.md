---
title: Ollama
category: sdk
slug: sdk-ollama
nav_order: 7
---

# Ollama

## Overview

The Project David Platform supports private local inference through [Ollama](https://ollama.com). No cloud API keys, no data leaving your machine — just point to Ollama in your model endpoint string when you build your inference object.

---

## Requirements

Ensure the following environment variables are set:

- `ENTITIES_API_KEY`: Your Entities API key.
- `BASE_URL`: Base URL of your Entities API instance (default: `http://localhost:9000`).

Ollama itself must be running and reachable from your platform instance. If you're running the platform in Docker, make sure Ollama is accessible at the hostname your stack expects (e.g. `http://ollama:11434`). If you haven't set up Ollama yet, the [Ollama quickstart](https://github.com/ollama/ollama/blob/main/README.md#quickstart) is the fastest way to get going.

---

## Streaming a response

```python
import os
from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv()

client = Entity(
    base_url=os.getenv("BASE_URL", "http://localhost:9000"),
    api_key=os.getenv("ENTITIES_API_KEY")
)

# --- your thread / assistant / message / run setup here ---

sync_stream = client.synchronous_inference_stream
sync_stream.setup(
    user_id=user_id,
    thread_id=thread.id,
    assistant_id=assistant.id,
    message_id=message.id,
    run_id=run.id,
    api_key="ollama"       # see note on API keys below
)

try:
    for chunk in sync_stream.stream_chunks(
        model="ollama/qwen3:4b",  # use the ollama/ prefix in the model string
        timeout_per_chunk=60.0,
        suppress_fc=True,
    ):
        content = chunk.get("content", "")
        if content:
            print(content, end="", flush=True)
    print("\n--- End of Stream ---")
except Exception as e:
    print(f"Stream Error: {e}")
```

---

## API key

Ollama is not a cloud-gated product so there's no real API key involved. You still need to pass *something* in the `api_key` field — use the string `"ollama"`. The platform uses this value to route your request to the correct backend, not to authenticate with a third-party service.

---

## Model string format

Prefix the Ollama model name with `ollama/` in your `stream_chunks` call:

```
ollama/qwen3:4b
ollama/llama3:8b
ollama/mistral:latest
```

Any model you have pulled locally via `ollama pull <model>` can be used here. The full list of available models is at [ollama.com/library](https://ollama.com/library).

---

## Thinking models

Some Ollama models (e.g. `qwen3`) support a chain-of-thought reasoning pass before generating a response. By default the platform disables this for speed. If you want to enable it, set `think=True` when configuring your assistant or pass it through the run metadata — reasoning tokens will be streamed separately and won't appear in the saved message content.