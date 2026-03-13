---
title: vLLM
category: sdk
slug: sdk-vllm
nav_order: 9
---

# vLLM

## Overview

The Project David Platform supports high-performance local inference through [vLLM](https://github.com/vllm-project/vllm). Like Ollama, no cloud API keys are required and no data leaves your infrastructure — but vLLM is designed for production-grade throughput, continuous batching, and serious GPU utilisation.

David connects to vLLM's raw `/v1/completions` endpoint directly, bypassing vLLM's own tool-call parser entirely. This means David owns the full agentic loop — tool detection, argument parsing, multi-turn state, and response streaming — regardless of which model family you load.

---

## Requirements

Ensure the following environment variables are set:

- `ENTITIES_API_KEY`: Your Entities API key.
- `BASE_URL`: Base URL of your Entities API instance (default: `http://localhost:9000`).
- `VLLM_BASE_URL`: URL of your vLLM server as seen from inside the platform (default: `http://vllm_server:8000` when running via Docker Compose).

---

## Running vLLM

### Docker (recommended)

A vLLM docker container is deployed as part of the platform stack. 



> **GPU memory note:** `--gpu-memory-utilization 0.85` is recommended if your GPU is also driving a display (e.g. a laptop). Adjust downward if you see out-of-memory errors on startup.

> **Context length note:** Keep `--max-model-len` at `8192` or higher. Values of `4096` leave too little headroom once the system prompt and conversation history are included, and vLLM will reject requests that exceed the limit.

### Docker Compose (integrated with the platform)

If you are running the full platform stack via Docker Compose, add the following to your `.env` and let the platform manage the vLLM container for you:

```env
HF_TOKEN=your_hf_token
HF_CACHE_PATH=~/.cache/huggingface
VLLM_MODEL=Qwen/Qwen2.5-3B-Instruct
```

The platform's `docker-compose.yml` already includes a `vllm` service on `my_custom_network`. Bring it up with:

```bash
docker compose up vllm -d
docker compose logs -f vllm
```

Wait for `Application startup complete` before sending requests.

---

## Verify vLLM is running

```bash
curl http://localhost:8001/v1/models
```

You should see the model ID in the response. Note it exactly — you will need it for the model string below.

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
        "vllm_base_url": "http://localhost:8001"  # 👈 Route to your vLLM server
    }
)

try:
    for chunk in sync_stream.stream_chunks(
        model="vllm/Qwen/Qwen2.5-3B-Instruct",  # 👈 Use the vllm/ prefix
        max_tokens=1024,
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

Prefix the full Hugging Face model ID with `vllm/`:

```text
vllm/Qwen/Qwen2.5-3B-Instruct
vllm/Qwen/Qwen2.5-7B-Instruct
vllm/mistralai/Mistral-7B-Instruct-v0.3
vllm/meta-llama/Llama-3.1-8B-Instruct
```

The model ID after `vllm/` must match exactly what `/v1/models` returns — it is case-sensitive.

---

## Custom remote vLLM servers

Like Ollama, the vLLM endpoint can be overridden per-request via `meta_data`. This lets you point different assistants at different vLLM instances without any platform reconfiguration:

```python
sync_stream.setup(
    ...
    meta_data={
        "vllm_base_url": "http://192.168.1.200:8001"  # 👈 Remote vLLM server
    }
)
```

---

## max_tokens

Always pass `max_tokens` explicitly. vLLM validates that `input_tokens + max_tokens ≤ max_model_len` and will return a `400` error if the combined total exceeds the server's configured context window.

A safe default for most use cases:

```python
for chunk in sync_stream.stream_chunks(
    model="vllm/Qwen/Qwen2.5-3B-Instruct",
    max_tokens=1024,
    ...
)
```

---

## Thinking models

Qwen3 and other reasoning-capable models support a chain-of-thought pass before generating a response. By default the platform disables thinking for speed. To enable it, pass `think=True` through your run metadata — reasoning tokens will be streamed separately and will not appear in the saved message content.

---

## Choosing a model

For tool calling and agentic tasks, use a model of at least 3B parameters. Smaller models (1–1.5B) tend to hallucinate instead of emitting structured tool calls. The following models are known to work well with David's raw inference pipeline:

| Model | Size | Notes |
|---|---|---|
| `Qwen/Qwen2.5-3B-Instruct` | 3B | Recommended starting point |
| `Qwen/Qwen2.5-7B-Instruct` | 7B | Better reasoning, more VRAM |
| `Qwen/Qwen3-4B` | 4B | Supports thinking mode |
| `mistralai/Mistral-7B-Instruct-v0.3` | 7B | Strong tool calling |
| `meta-llama/Llama-3.1-8B-Instruct` | 8B | Requires HF gated access |