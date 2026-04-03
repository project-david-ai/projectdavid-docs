---
title: vLLM
category: admin
slug: admin-vllm
nav_order: 3
---

# vLLM

## Overview

Project David uses vLLM as its GPU powered local  inference engine for running open-weight models locally. vLLM is designed for production-grade throughput;  it handles continuous batching, efficient KV cache management, and LoRA adapter loading so that the platform can serve fine-tuned models alongside base models without restarting or reconfiguring anything.

#### Powered by Ray Serve

Our vLLM integration runs through Ray Serve, a scalable model serving framework built on the Ray distributed computing platform. Rather than running vLLM as a standalone server process, we wrap each model deployment as a Ray Serve application. This gives the deployment manager the ability to start, stop, and health-check individual model deployments independently without affecting anything else running on the cluster.
The deeper benefit is scalability. Ray Serve is cluster-aware, which means as you add GPU nodes to your infrastructure, the same deployment system that manages a single GPU today can distribute inference across an entire fleet tomorrow. Horizontally, Ray Serve can run multiple replicas of the same model across different nodes to handle more concurrent requests. Vertically, it can shard a single large model across multiple GPUs simultaneously when the model is too large to fit on one card. Both scaling strategies are managed by the same deployment manager, with no changes required to your application code


---



## Architecture


![Ray Serve vLLM architecture](/vllm-ray-serve-architecture.svg)
---





## Prerequisites

Before starting the vLLM inference stack, make sure the following are in place on the host machine.

**NVIDIA GPU**

The amount of VRAM available on your GPU determines which models you can serve. As a general guide:

| VRAM | Viable models |
|---|---|
| 8 GB | Quantised 1.5B to 7B models (4-bit) |
| 16 GB | Quantised 7B to 13B models, full-precision 7B |
| 24 GB | Quantised 34B models, full-precision 13B |
| 40 GB | Quantised 70B models, full-precision 34B |
| 80 GB (A100 / H100) | Full-precision 70B, quantised 180B+ |
| Multi-GPU | Models exceeding single-card VRAM via tensor parallelism |

For multi-GPU setups, Project David's deployment manager can shard a single model across multiple cards automatically using Ray Serve's tensor parallelism support. Each GPU must have the model weights accessible locally — see the multi-node deployment guide for details.

**NVIDIA drivers**

The host machine must have NVIDIA drivers installed. The inference worker container handles all GPU container configuration internally — you only need the host driver present so Docker can pass the GPU through.

Verify with:

```bash
nvidia-smi
```

If this returns a table showing your GPU and driver version, you are good to proceed. Consumer cards (RTX series) require a minimum driver version of 525. Data centre cards (A100, H100, L40S) should use the latest production branch driver available from NVIDIA.

If drivers are not installed, follow the [NVIDIA driver installation guide](https://www.nvidia.com/Download/index.aspx) for your platform and OS.

**Network interconnect (multi-GPU and multi-node)**

For tensor parallelism across multiple GPUs on the same node, CUDA peer-to-peer access is sufficient. For tensor parallelism across multiple nodes, NCCL requires a high-bandwidth network interconnect. The following table gives practical guidance:

| Interconnect | Max viable configuration |
|---|---|
| PCIe (same node) | TP=2 to TP=4, models up to ~70B |
| NVLink (same node) | TP=4 to TP=8, models up to 180B+ |
| 10 GbE (cross-node) | TP=2, models up to ~34B |
| 25 GbE (cross-node) | TP=4, models up to ~70B |
| InfiniBand / RoCE | TP=8+, frontier models (405B+) |

Standard gigabit ethernet is not sufficient for cross-node tensor parallelism. NCCL all-reduce operations between GPUs during each forward pass will dominate latency and make inference impractically slow.

**Docker Compose**

Version 2.17 or later is required for the `deploy.resources` GPU reservation syntax used in the compose file.

```bash
docker compose version
```

**HuggingFace account and token**

Base model weights are downloaded from HuggingFace on first activation. You need a HuggingFace account and a personal access token with read access. Set it in your `.env`:

```bash
HF_TOKEN=hf_your_token_here
```

Some models — including the Llama 3 family — are gated and require you to accept the model licence on the HuggingFace model page before your token will grant download access. Attempting to activate a gated model without accepting the licence will result in a 401 error during weight download.

For airgapped deployments, weights must be pre-cached in `HF_CACHE_PATH` before the stack is started. The deployment manager will not attempt any outbound network requests if `HF_HUB_OFFLINE=1` is set in the environment.



---

## Starting the inference stack

The vLLM inference stack is part of the Sovereign Forge profile and can be started through either the Project David platform CLI (`pdavid`) or the core CLI (`platform-api docker-manager`). Both manage the same underlying stack — use whichever matches your installation.

**Start the stack**

With the platform CLI:

```bash
pdavid --mode up --training
```

With the core CLI:

```bash
platform-api docker-manager --mode up --training
```

This starts three additional services on top of the base stack:

- `inference-worker` — the Ray HEAD node. This container owns the GPU, runs Ray Serve, and hosts the deployment manager that watches for models to activate. This is where vLLM runs.
- `training-worker` — handles training job execution via Redis. Does not use Ray.
- `training-api` — the REST API for training jobs and the model registry.

The base stack (API, database, Redis, nginx, sandbox, and supporting services) starts automatically if it is not already running.

**First run**

On first run the `inference-worker` image needs to be pulled. It is approximately 27 GB due to the CUDA, PyTorch, and vLLM stack it contains. Allow time for the pull to complete before expecting the container to be healthy.

To pull the latest images explicitly before starting:

```bash
pdavid --mode up --training --pull
```

Once pulled, Ray initialises and Ray Serve starts. You will see the following in the inference worker logs when the node is ready:

```
Ray HEAD started — dashboard: http://localhost:8265
Ray Serve started on port 8000
InferenceReconciler active — polling every 20s
```

At this point the inference stack is running but idle — no model is loaded and no GPU memory is allocated. Models are loaded on demand when you activate a deployment through the registry.

**Verify the stack is healthy**

```bash
pdavid --mode logs --follow --services inference-worker
```

Or with the core CLI:

```bash
platform-api docker-manager --mode logs --follow --services inference-worker
```

The Ray dashboard is also available at `http://localhost:8265` and shows cluster resources, active deployments, and replica health.

**Stopping the stack**

```bash
pdavid --mode down_only --training
```

Or with the core CLI:

```bash
platform-api docker-manager --mode down_only --training
```

To stop everything including the base stack:

```bash
pdavid --mode down_only
```

---

## HuggingFace model cache

Project David does not download model weights at inference time. When you activate a deployment, the inference worker loads weights from the local HuggingFace cache on disk. If the weights are not already cached, the worker will attempt to download them from HuggingFace on first activation — but in airgapped environments this will fail by design.

Understanding how the cache works will save you from the most common activation failures.

**How the cache maps to the container**

The HuggingFace cache lives on your host machine at the path defined by `HF_CACHE_PATH` in your `.env`. The inference worker container mounts this path at `/root/.cache/huggingface` inside the container. vLLM reads weights from that mount.

The default cache location is resolved automatically for your platform on first run:

| Platform | Default path |
|---|---|
| Linux | `~/.cache/huggingface` |
| macOS | `~/.cache/huggingface` |
| Windows | `%USERPROFILE%\.cache\huggingface` |

To use a different location:

```bash
pdavid configure --set HF_CACHE_PATH=/mnt/fast_nvme/huggingface
```

Or with the core CLI:

```bash
platform-api docker-manager configure --set HF_CACHE_PATH=/mnt/fast_nvme/huggingface
```

Then restart the stack for the new mount path to take effect.

**What must be in the cache**

The cache must contain the complete model directory for every base model you intend to serve. A complete model directory includes the model weights, tokenizer files, and configuration files. For a typical Qwen2.5 model the directory looks like:

```
~/.cache/huggingface/hub/
  models--Qwen--Qwen2.5-7B-Instruct/
    snapshots/
      <commit-hash>/
        config.json
        tokenizer.json
        tokenizer_config.json
        model.safetensors          ← weights (single file for smaller models)
        model-00001-of-00004.safetensors  ← or sharded for larger ones
        model-00002-of-00004.safetensors
        ...
```

If any of these files are missing, vLLM will fail during the profile run that happens on activation and the deployment will show as unhealthy.

**Downloading weights**

The simplest way to populate the cache is to let the platform handle it on first activation. As long as `HF_TOKEN` is set and the host has internet access, the inference worker will pull the weights from HuggingFace automatically when the deployment is first activated.

To set your token if you have not already:

```bash
pdavid configure --set HF_TOKEN=hf_your_token_here
```

For gated models — including the Llama 3 family, Mistral instruct variants, and others — you must also accept the model licence on the HuggingFace model page before your token will grant download access. A 401 error during activation is almost always a missing licence acceptance rather than a bad token.

**Pre-downloading weights (recommended)**

For production deployments and airgapped environments, pre-downloading weights before starting the stack is strongly recommended. This avoids long activation timeouts and ensures the deployment manager does not need outbound network access.

Use the HuggingFace CLI on the host machine:

```bash
pip install huggingface_hub
huggingface-cli login
huggingface-cli download Qwen/Qwen2.5-7B-Instruct
```

Or download programmatically:

```python
from huggingface_hub import snapshot_download

snapshot_download(
    repo_id="Qwen/Qwen2.5-7B-Instruct",
    cache_dir="/path/to/your/HF_CACHE_PATH",
)
```

The download writes directly into the HuggingFace cache structure that vLLM expects — no reorganisation needed.

**Airgapped deployments**

For fully airgapped environments, set the following in your `.env` to prevent the inference worker from attempting any outbound requests:

```bash
pdavid configure --set HF_HUB_OFFLINE=1
```

With `HF_HUB_OFFLINE=1` set, vLLM will only load from cache and will immediately fail if weights are not present rather than hanging on a network timeout. Weights must be pre-populated in `HF_CACHE_PATH` before the stack is started.

**Storage requirements**

Model weights can be large. Plan disk space accordingly:

| Model | Precision | Approximate size on disk |
|---|---|---|
| 1.5B | 4-bit quantised | ~1 GB |
| 7B | 4-bit quantised | ~4 GB |
| 7B | float16 | ~14 GB |
| 13B | 4-bit quantised | ~7 GB |
| 34B | 4-bit quantised | ~18 GB |
| 70B | 4-bit quantised | ~38 GB |
| 70B | float16 | ~140 GB |

For multi-model deployments, each base model requires its own cache entry. Fine-tuned models share the base model weights — only the LoRA adapter files (typically a few hundred MB) are additional.


---



## Registering and activating a base model

Before a model can serve inference requests it must go through two steps: registration and activation. These are separate operations with different permission requirements and different effects on the cluster.

**Registration** adds a model to the catalog. It is a metadata operation — no GPU resources are allocated and no weights are loaded. Registration is idempotent: registering the same HuggingFace model ID twice returns the existing record rather than creating a duplicate.

**Activation** takes a registered model and deploys it to the GPU. The deployment manager creates a Ray Serve application, loads the weights from the local HuggingFace cache, and makes the model available for inference. This is where VRAM is allocated.

Registration requires admin credentials. Activation also requires admin credentials. Regular users can run inference against any active model but cannot register or activate models themselves.

### Step 1 — Register the base model

```python
import os
from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv()

admin_client = Entity(
    base_url=os.getenv("BASE_URL", "http://localhost:80"),
    api_key=os.getenv("ADMIN_API_KEY"),
)

registered = admin_client.registry.register(
    hf_model_id="Qwen/Qwen2.5-7B-Instruct",
    name="Qwen2.5 7B Instruct",
    family="qwen",
    parameter_count="7B",
)

print(f"Registered: {registered.id}")
```

The registry assigns a `bm_...` prefixed ID to the model. This ID is what the deployment manager uses internally to resolve the HuggingFace path when creating a deployment. You can also register quantised variants from the Unsloth or TheBloke collections by passing their full HuggingFace path:

```python
registered = admin_client.registry.register(
    hf_model_id="unsloth/Qwen2.5-7B-Instruct-bnb-4bit",
    name="Qwen2.5 7B Instruct (Unsloth 4bit)",
    family="qwen",
    parameter_count="7B",
)
```

To list all registered models:

```python
catalog = admin_client.registry.list()
for model in catalog.items:
    print(f"{model.id}  {model.hf_model_id}")
```

### Step 2 — Activate the model

```python
result = admin_client.models.activate_base(
    base_model_id=registered.id,
)
print(result)
```

Activation is asynchronous. The API call returns immediately after creating the deployment record — the actual weight loading and Ray Serve startup happen in the background. The deployment manager polls the database every 20 seconds and will pick up the new record on its next cycle.

Follow the startup in the inference worker logs:

```bash
pdavid --mode logs --follow --services inference-worker
```

Or with the core CLI:

```bash
platform-api docker-manager --mode logs --follow --services inference-worker
```

### What healthy activation looks like

Activation goes through three distinct phases. Each produces recognisable log output — knowing what to expect at each phase makes it straightforward to distinguish a healthy startup from a hang.

**Phase 1 — Weight loading**

The deployment manager picks up the activation record and starts the Ray Serve deployment. vLLM loads the model weights from the local HuggingFace cache:

```
🚢 Deploying via Ray Serve: vllm_dep_... model=Qwen/Qwen2.5-7B-Instruct tp=1 gpu_mem_util=0.50
Loading weights with BitsAndBytes quantization. May take a while ...
Loading safetensors checkpoint shards: 100% Completed | 1/1 [00:19<00:00, 19.13s/it]

Model loading took 1.4869 GiB and 36.017670 seconds
the current vLLM instance can use total_gpu_memory (8.00GiB) x gpu_memory_utilization (0.50) = 4.00GiB
model weights take 1.49GiB; non_torch_memory takes 0.03GiB; PyTorch activation peak memory takes 1.39GiB; the rest of the memory reserved for KV Cache is 1.09GiB.
# cuda blocks: 2542, # CPU blocks: 9362
Maximum concurrency for 2048 tokens per request: 19.86x
```

The memory profiling summary is useful — it tells you exactly how VRAM is being divided between weights, activation memory, and the KV cache that services concurrent requests. If the KV cache allocation is very small (under ~0.5 GiB) the model will struggle with longer contexts and higher concurrency.

**Phase 2 — CUDA graph capture**

vLLM captures CUDA execution graphs for each batch size it expects to serve. This is the longest part of startup and typically takes 15 to 30 seconds:

```
Capturing CUDA graph shapes:   0%|          | 0/35
Capturing CUDA graph shapes:  29%|██▊       | 10/35
Capturing CUDA graph shapes:  57%|█████▋    | 20/35
Capturing CUDA graph shapes:  86%|████████▌ | 30/35
Capturing CUDA graph shapes: 100%|██████████| 35/35

Graph capturing finished in 16 secs, took 0.62 GiB
init engine (profile, create kv cache, warmup model) took 19.04 seconds
```

During this phase Ray Serve will emit a warning that the replica has taken more than 30 seconds to initialise:

```
Deployment 'vllm_dep_...' has 1 replicas that have taken more than 30s to initialize.
This may be caused by a slow __init__ or reconfigure method.
```

This warning is expected and can be safely ignored. It fires because Ray's default health check timeout is shorter than the time CUDA graph capture takes on most GPUs. The deployment is healthy and will complete.

**Phase 3 — Ready**

Once graph capture completes the deployment comes online and the deployment manager updates the database:

```
Application 'vllm_dep_...' is ready at http://0.0.0.0:8000/vllm_dep_...
Deployed app 'vllm_dep_...' successfully.
✅ Ray Serve deployment active: vllm_dep_... (gpu_mem_util=0.50)
```

The model is now serving inference. Total time from activation call to ready is typically 60 to 120 seconds for a quantised 7B model on an 8 GB GPU, depending on cache read speed.

**First inference request**

Once active, the inference worker logs confirm each request:

```
Added request req_...
POST /vllm_dep_... 200 2409.1ms
Finished request req_...
```

The `Avg generation throughput` metric reported every 5 seconds during generation shows tokens per second. For a quantised 1.5B model on an 8 GB card you can expect approximately 80 to 125 tokens per second.

### Multi-GPU activation

For models that exceed single-GPU VRAM, pass `tensor_parallel_size` to shard the model across multiple GPUs:

```python
result = admin_client.models.activate_base(
    base_model_id=registered.id,
    tensor_parallel_size=2,
)
```

The deployment manager creates a Ray Serve placement group spanning the requested number of GPUs. All participating GPUs must have the model weights cached locally. See the multi-node deployment guide for hardware requirements.

### Deactivating a model

Deactivation tears down the Ray Serve deployment and releases VRAM. The model remains in the registry and can be reactivated at any time.

```python
admin_client.models.deactivate_base(base_model_id=registered.id)
```

To release all GPU memory immediately regardless of what is running:

```python
admin_client.models.deactivate_all()
```

### Running inference against the activated model

Once the deployment is active, any user can run inference against it using the model's HuggingFace path prefixed with `vllm/`:

```python
user_client = Entity(
    base_url=os.getenv("BASE_URL", "http://localhost:80"),
    api_key=os.getenv("ENTITIES_API_KEY"),
)

assistant = user_client.assistants.create_assistant(
    name="My Assistant",
    instructions="You are a helpful assistant.",
    model="vllm/Qwen/Qwen2.5-7B-Instruct",
)
```

The platform's mesh resolver finds the active deployment for that model ID automatically — no endpoint configuration required in your application code.

---

For activating fine-tuned LoRA models, see [Model Activation](/docs/admin-model-activation).


## GPU memory configuration

Every deployment is allocated a fixed proportion of total GPU VRAM at startup, controlled by the `gpu_memory_utilization` setting. This value determines how much of the GPU's total memory vLLM is allowed to use across weights, activation memory, and the KV cache that services concurrent requests.

The default is `0.50` — 50% of available VRAM. This is deliberately conservative. On an 8 GB card that gives vLLM 4 GB to work with, which is sufficient for quantised models in the 1.5B to 7B range while leaving headroom for the operating system, CUDA runtime, and Ray's own memory overhead.

**Reading the memory breakdown from logs**

The memory profiling summary logged during Phase 1 of activation tells you exactly how the allocated VRAM is being used:

```
total_gpu_memory (8.00GiB) x gpu_memory_utilization (0.50) = 4.00GiB
model weights take 1.49GiB
non_torch_memory takes 0.03GiB
PyTorch activation peak memory takes 1.39GiB
the rest of the memory reserved for KV Cache is 1.09GiB
```

The KV cache is what services concurrent requests and long contexts. A KV cache of 1.09 GiB on this deployment yields 2542 CUDA blocks and supports approximately 19 concurrent requests at 2048 tokens each. If the KV cache allocation is below ~0.5 GiB the deployment will struggle with anything beyond short single-turn requests.

**When to raise `gpu_memory_utilization`**

If your GPU is dedicated to inference and nothing else is competing for VRAM, raising the value gives vLLM more KV cache and improves concurrency and context length support:

| `gpu_memory_utilization` | Available on 8 GB GPU | Recommended for |
|---|---|---|
| `0.50` | 4.00 GB | Default, shared GPU, development |
| `0.70` | 5.60 GB | Dedicated inference, moderate load |
| `0.85` | 6.80 GB | Production, high concurrency |
| `0.90` | 7.20 GB | Maximum, monitor closely for OOM |

To change the value, set it explicitly when activating:

```python
result = admin_client.models.activate_base(
    base_model_id=registered.id,
    gpu_memory_utilization=0.85,
)
```

**When to lower it**

Lower `gpu_memory_utilization` if you see out-of-memory errors during CUDA graph capture or if you are running multiple deployments on the same GPU simultaneously. The log signature for an OOM during capture is:

```
torch.OutOfMemoryError: CUDA out of memory.
If out-of-memory error occurs during cudagraph capture,
consider decreasing gpu_memory_utilization or switching to eager mode.
```

If you hit this, deactivate the deployment and reactivate with a lower value. `0.40` is a reasonable floor for most consumer cards running quantised models.

**Hard limits**

The deployment manager clamps `gpu_memory_utilization` to the range `[0.10, 0.95]`. Values outside this range are rejected at activation time. Setting a value above `0.95` risks leaving insufficient memory for CUDA runtime operations and will cause unpredictable failures.



## Supported model families

Project David maintains a chat template registry that handles prompt formatting for each model family automatically. When you activate a model, the platform detects the model family from the registered `family` field and selects the correct renderer — you do not need to configure prompt templates manually.

The following model families are supported:

| Family | Example models | Template | Tool calling | Notes |
|---|---|---|---|---|
| Qwen | Qwen2.5-1.5B/7B/14B/32B/72B-Instruct | Qwen ChatML | Yes | Default fallback for unknown families. Recommended starting point. |
| Llama 3 | Llama-3.1-8B/70B/405B-Instruct | Llama 3 instruct | Yes | Gated on HuggingFace — licence acceptance required. |
| Mistral | Mistral-7B-Instruct-v0.3, Mixtral-8x7B | Mistral instruct | Yes | Strong tool calling. v0.1/v0.2 variants use a slightly different template. |
| DeepSeek | DeepSeek-V2/V3/R1 | DeepSeek chat | Yes | R1 reasoning tokens are streamed separately and not saved to message content. |
| Phi | Phi-3/3.5-mini/medium-instruct | Phi instruct | Yes | Microsoft family. Phi-3.5-MoE supported. |
| Gemma | Gemma-2-2B/9B/27B-Instruct | Gemma instruct | Yes | Google family. Gemma 1 variants use a different template — register as a separate family. |
| GPT-OSS | Falcon, GPT-J, GPT-NeoX, Cerebras | GPT completion | Partial | Completion-style format. Tool calling support is limited compared to instruct-tuned families. |
| Moonshot / Kimi | Moonshot-v1, Kimi variants | Kimi chat | Yes | Uses `<\|system\|>`, `<\|user\|>`, `<\|assistant\|>` token format. |

**Registering with the correct family**

The `family` field on registration drives template selection. Use lowercase and match the values in the table above:

```python
admin_client.registry.register(
    hf_model_id="meta-llama/Llama-3.1-8B-Instruct",
    name="Llama 3.1 8B Instruct",
    family="llama",
    parameter_count="8B",
)
```

If `family` is omitted or does not match a known renderer, the platform falls back to the Qwen template. For most instruct-tuned models this produces acceptable output, but tool calling reliability will be lower than with the correct template.

**Recommended models by VRAM budget**

| VRAM | Recommended model | Family | Quantisation |
|---|---|---|---|
| 8 GB | Qwen2.5-1.5B-Instruct | qwen | unsloth 4-bit |
| 8 GB | Qwen2.5-7B-Instruct | qwen | unsloth 4-bit |
| 8 GB | Mistral-7B-Instruct-v0.3 | mistral | unsloth 4-bit |
| 16 GB | Qwen2.5-14B-Instruct | qwen | unsloth 4-bit |
| 16 GB | Phi-3.5-mini-instruct | phi | unsloth 4-bit |
| 24 GB | Qwen2.5-32B-Instruct | qwen | unsloth 4-bit |
| 24 GB | Gemma-2-27B-Instruct | gemma | unsloth 4-bit |
| 40 GB | Llama-3.1-70B-Instruct | llama | unsloth 4-bit |
| 40 GB | DeepSeek-V3 | deepseek | unsloth 4-bit |
| 80 GB+ | Llama-3.1-405B-Instruct | llama | 4-bit sharded |
| Multi-GPU | Any 70B+ model | any | TP=2 or higher |

Unsloth quantised variants are recommended for consumer and prosumer hardware. They use BitsAndBytes 4-bit quantisation and are pre-validated against vLLM's loader. The full HuggingFace paths follow the pattern `unsloth/<model-name>-bnb-4bit`.

**A note on multimodal models**

Models with vision capabilities — including Qwen2.5-VL and LLaVA variants — can be registered with `is_multimodal=True`. Text-only inference works identically to standard models. Multimodal inference support (image inputs through the API) is on the roadmap and will be documented when available.


















