---
title: vLLM
category: admin
slug: admin-vllm
nav_order: 3
---

# vLLM & Sovereign Forge Cluster

## Overview

Project David uses vLLM as its GPU-powered inference engine for running open-weight models locally and across distributed clusters. vLLM is designed for production-grade throughput — it handles continuous batching, efficient KV cache management, and LoRA adapter loading so the platform can serve fine-tuned models alongside base models without restarting or reconfiguring anything.

### Powered by Ray Serve

The vLLM integration runs through Ray Serve, a scalable model serving framework built on the Ray distributed computing platform. Rather than running vLLM as a standalone server process, each model deployment is wrapped as a Ray Serve application. This gives the deployment manager the ability to start, stop, and health-check individual model deployments independently without affecting anything else running on the cluster.

The deeper benefit is scalability. Ray Serve is cluster-aware. As you add GPU nodes to your infrastructure, the same deployment system that manages a single GPU today can distribute inference across an entire fleet tomorrow. Horizontally, Ray Serve can run multiple replicas of the same model across different nodes to handle more concurrent requests. Both strategies are managed by the same deployment manager with no changes required to your application code.

---

## Prerequisites

Before starting the vLLM inference stack, ensure the following are in place on every node that will participate in the cluster.

**NVIDIA GPU**

The amount of VRAM available on your GPU determines which models you can serve:

| VRAM | Viable models |
|---|---|
| 8 GB | Quantised 1.5B to 7B models (4-bit) |
| 16 GB | Quantised 7B to 13B models, full-precision 7B |
| 24 GB | Quantised 34B models, full-precision 13B |
| 40 GB | Quantised 70B models, full-precision 34B |
| 80 GB (A100 / H100) | Full-precision 70B, quantised 180B+ |

**NVIDIA drivers**

The host machine must have NVIDIA drivers installed. The inference worker container handles all GPU container configuration internally — you only need the host driver present so Docker can pass the GPU through.

```bash
nvidia-smi
```

Consumer cards (RTX series) require a minimum driver version of 525. Data centre cards should use the latest production branch driver from NVIDIA.

**Docker Compose**

Version 2.17 or later is required for the `deploy.resources` GPU reservation syntax.

```bash
docker compose version
```

**HuggingFace account and token**

Base model weights are downloaded from HuggingFace on first activation. Set your token in `.env`:

```bash
pdavid configure --set HF_TOKEN=hf_your_token_here
```

Some models — including the Llama 3 family — are gated and require you to accept the model licence on the HuggingFace model page before your token grants download access. A 401 error during activation is almost always a missing licence acceptance rather than a bad token.

For airgapped deployments, weights must be pre-cached in `HF_CACHE_PATH` before the stack starts. Set `HF_HUB_OFFLINE=1` to prevent any outbound network requests.

---

## Single Node Deployment

A single-node deployment is the standard starting point. One machine acts as the Ray HEAD node, owns the GPU, runs Ray Serve, and hosts the InferenceReconciler that watches for models to activate.

### Starting the stack

```bash
pdavid --mode up --training
```

This starts three additional services on top of the base stack:

- `inference-worker` — the Ray HEAD node. Owns the GPU, runs Ray Serve, hosts the deployment manager.
- `training-worker` — handles fine-tuning job execution via Redis. Does not participate in Ray.
- `training-api` — the REST API for training jobs and the model registry.

On first run the inference worker image needs to be pulled. It is approximately 27 GB due to the CUDA, PyTorch, and vLLM stack it contains. Pull explicitly before starting:

```bash
pdavid --mode up --training --pull
```

Once Ray initialises you will see the following in the inference worker logs:

```
Ray HEAD started — dashboard: http://localhost:80/ray/
Ray Serve started on port 8000
InferenceReconciler active — polling every 20s
```

The inference stack is running but idle. No model is loaded and no GPU memory is allocated. Models load on demand when you activate a deployment through the registry.

### Verifying the stack

```bash
pdavid --mode logs --follow --services inference-worker
```

The Ray dashboard is available at `http://localhost:80/ray/` and shows cluster resources, active deployments, and replica health.

### Stopping the stack

```bash
pdavid --mode down_only
```

---

## Cluster Deployment

For multi-node deployments, scale-out patterns, Tailscale networking, RunPod workers, and airgapped configurations, see the dedicated [Sovereign Cluster](/docs/admin-sovereign-cluster) guide. That document covers everything from adding a second GPU node to building a fully airgapped inference mesh.

---

## Inference Hot Path

All completions requests route through a dedicated Rust binary — `pd_router` — that sits between nginx and the FastAPI application. This is not a configuration option or an opt-in feature. It starts automatically with the base stack and is transparent to operators and SDK users alike.

### Why it exists

Python's Global Interpreter Lock means that streaming SSE responses through FastAPI introduces contention at high concurrency — each chunk acquisition briefly blocks the interpreter. For a single user on a development machine this is invisible. For a platform serving multiple concurrent inference streams it becomes a bottleneck.

`pd_router` owns the connection pool for `/v1/completions` and handles SSE framing entirely in Rust, outside the GIL. Chunks from the inference backend pass through the DeltaNormalizer and SSE framer — both also implemented in Rust — before being streamed to the client. The FastAPI application handles orchestration and state; Rust handles the bytes.

### What the hot path looks like

```
Client
  └── nginx (/v1/completions)
        └── pd_router :9100 (Rust — connection pool, SSE framing)
              └── FastAPI :9000 (orchestration, tool routing, state)
                    └── Ray Serve (vLLM inference)
                          └── DeltaNormalizer (Rust)
                                └── SSE framer (Rust)
```

All other routes — thread management, file uploads, assistant configuration, tool calls — pass through FastAPI directly. The Rust hot path is scoped exclusively to the completions streaming endpoint.

### Verifying the router is healthy

```bash
docker exec nginx_proxy wget -qO- http://router:9100/_router/health
```

A healthy router returns `ok`. If the router is down, completions requests will fail. Other API operations are unaffected.

### Checking router logs

```bash
pdavid --mode logs --follow --services router
```

The router logs at `INFO` level by default. Each request that passes through is logged with latency. If you see a high volume of connection errors here, check that the FastAPI container is healthy first — the router is a passthrough and will reflect upstream failures.

---

## HuggingFace Model Management

### How the cache works

The HuggingFace cache lives on the host machine at the path defined by `HF_CACHE_PATH` in your `.env`. The inference worker container mounts this path at `/root/.cache/huggingface`. vLLM reads weights from that mount.

Default cache locations:

| Platform | Default path |
|---|---|
| Linux | `~/.cache/huggingface` |
| macOS | `~/.cache/huggingface` |
| Windows | `%USERPROFILE%\.cache\huggingface` |

To use a different location:

```bash
pdavid configure --set HF_CACHE_PATH=/mnt/fast_nvme/huggingface
```

Restart the stack after changing this path.

### Downloading weights

The simplest approach is to let the platform handle it on first activation. As long as `HF_TOKEN` is set and the host has internet access, the inference worker will pull weights from HuggingFace automatically.

To pre-download weights before activation:

```bash
huggingface-cli download Qwen/Qwen2.5-7B-Instruct
```

Or programmatically:

```python
from huggingface_hub import snapshot_download

snapshot_download(
    repo_id="Qwen/Qwen2.5-7B-Instruct",
    cache_dir="/path/to/your/HF_CACHE_PATH",
)
```

### Storage requirements

| Model | Precision | Approximate size |
|---|---|---|
| 1.5B | 4-bit quantised | ~1 GB |
| 7B | 4-bit quantised | ~4 GB |
| 7B | float16 | ~14 GB |
| 13B | 4-bit quantised | ~7 GB |
| 34B | 4-bit quantised | ~18 GB |
| 70B | 4-bit quantised | ~38 GB |
| 70B | float16 | ~140 GB |

Fine-tuned LoRA adapters share the base model weights. Only the adapter files — typically a few hundred MB — are additional.

---

## Registering and Activating Models

Registration, activation, cache management, and Ray cluster inspection are covered in the dedicated [Model Activation](/docs/admin-model-activation) guide. That document walks through the full sequence — from registering a base model through to activating fine-tuned LoRA adapters — along with the `pdavid cache` and `pdavid ray` commands for managing the inference worker from the CLI.

---

## GPU Memory Configuration

Every deployment is allocated a fixed proportion of total GPU VRAM at startup, controlled by `gpu_memory_utilization`. This determines how much memory vLLM can use across weights, activation memory, and the KV cache.

The default is `0.50` — 50% of available VRAM. This is deliberately conservative, leaving headroom for the operating system, CUDA runtime, and Ray.

```python
result = admin_client.models.activate_base(
    base_model_id=registered.id,
    gpu_memory_utilization=0.85,
)
```

| `gpu_memory_utilization` | Available on 8 GB GPU | Recommended for |
|---|---|---|
| `0.50` | 4.00 GB | Default, shared GPU, development |
| `0.70` | 5.60 GB | Dedicated inference, moderate load |
| `0.85` | 6.80 GB | Production, high concurrency |
| `0.90` | 7.20 GB | Maximum — monitor for OOM |

The deployment manager clamps this value to `[0.10, 0.95]`. The KV cache allocation — what remains after weights and activation memory — directly determines how many concurrent requests and how long a context the deployment can service. A KV cache below ~0.5 GiB will struggle with anything beyond short single-turn requests.

An OOM during CUDA graph capture produces this log signature:

```
torch.OutOfMemoryError: CUDA out of memory.
Consider decreasing gpu_memory_utilization or switching to eager mode.
```

Deactivate the deployment and reactivate with a lower value. `0.40` is a reasonable floor for consumer cards running quantised models.

---

## Supported Model Families

| Family | Example models | Tool calling |
|---|---|---|
| Qwen | Qwen2.5-1.5B/7B/14B/32B/72B-Instruct | Yes |
| Llama 3 | Llama-3.1-8B/70B/405B-Instruct | Yes |
| Mistral | Mistral-7B-Instruct-v0.3, Mixtral-8x7B | Yes |
| DeepSeek | DeepSeek-V2/V3/R1 | Yes |
| Phi | Phi-3/3.5-mini/medium-instruct | Yes |
| Gemma | Gemma-2-2B/9B/27B-Instruct | Yes |
| GPT-OSS | Falcon, GPT-J, GPT-NeoX | Partial |

The `family` field on registration drives prompt template selection. If omitted or unrecognised, the platform falls back to the Qwen template. For most instruct-tuned models this produces acceptable output, but tool calling reliability will be lower than with the correct template.

### Recommended models by VRAM budget

| VRAM | Model | Family | Quantisation |
|---|---|---|---|
| 8 GB | Qwen2.5-1.5B-Instruct | qwen | unsloth 4-bit |
| 8 GB | Qwen2.5-7B-Instruct | qwen | unsloth 4-bit |
| 8 GB | Mistral-7B-Instruct-v0.3 | mistral | unsloth 4-bit |
| 16 GB | Qwen2.5-14B-Instruct | qwen | unsloth 4-bit |
| 24 GB | Qwen2.5-32B-Instruct | qwen | unsloth 4-bit |
| 40 GB | Llama-3.1-70B-Instruct | llama | unsloth 4-bit |
| 80 GB+ | Llama-3.1-405B-Instruct | llama | 4-bit sharded |

Unsloth quantised variants are recommended for consumer and prosumer hardware. The full HuggingFace paths follow the pattern `unsloth/<model-name>-bnb-4bit`.

---

For registering and activating models, see [Model Activation](/docs/admin-model-activation).
For cluster deployment, scale-out, and networking, see [Sovereign Cluster](/docs/admin-sovereign-cluster).
For the full Sovereign Forge training pipeline, see [Sovereign Forge](/docs/sovereign-forge).