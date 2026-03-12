---
title: Ollama
category: sdk
slug: sdk-ollama
nav_order: 8
---

# Ollama

## Overview

The Project David Platform supports private local inference through [Ollama](https://ollama.com). No cloud API keys, no data leaving your machine — just point to Ollama in your model endpoint string.

---

## Requirements

Ensure the following environment variables are set:

- `ENTITIES_API_KEY`: Your Entities API key.
- `BASE_URL`: Base URL of your Entities API instance (default: `http://localhost:9000`).

Ollama itself must be running and reachable from your platform instance. If you haven't set up Ollama yet, the [Ollama quickstart](https://github.com/ollama/ollama/blob/main/README.md#quickstart) is the fastest way to get going.

---

## Custom Remote Ollama Servers

By default, the platform looks for Ollama at `http://localhost:11434` (or your configured `OLLAMA_BASE_URL` environment variable). 

If your development machine is separate from your Ollama server, you can dynamically override the Ollama URL **per-request** by passing `ollama_base_url` into the stream setup's `meta_data`. 

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
    thread_id="your_thread_id",
    assistant_id="your_assistant_id",
    message_id="your_message_id",
    run_id="your_run_id",
    meta_data={
        "ollama_base_url": "http://192.168.1.150:11434"  # 👈 Route to a remote Ollama server dynamically
    }
)

try:
    for chunk in sync_stream.stream_chunks(
        model="ollama/qwen3:4b",  # 👈 Use the ollama/ prefix
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

## Model string format

Prefix the Ollama model name with `ollama/` in your `stream_chunks` call:

```text
ollama/qwen3:4b
ollama/llama3:8b
ollama/mistral:latest
```

Any model you have pulled locally via `ollama pull <model>` can be used here. 

---




## Thinking models

Some Ollama models (e.g. `qwen3`) support a chain-of-thought reasoning pass before generating a response. By default the platform disables this for speed. If you want to enable it, set `think=True` when configuring your assistant or pass it through the run metadata — reasoning tokens will be streamed separately and won't appear in the saved message content.
