---
title: Model Activation
category: admin
slug: admin-model-activation
nav_order: 4
---

# Model Activation

Model activation is a two-step process. Registration and activation are deliberately separate operations. Registration is cheap and stateless, activation is the expensive GPU operation. Understanding the distinction matters when you are managing a catalog of models across a cluster.

---

## Step 1 — Registration

Registration adds a model to the platform catalog. Nothing happens on the GPU. No weights are downloaded. No memory is allocated. The operation writes a record to the database and returns immediately.

Registration is idempotent. Registering the same HuggingFace model ID twice returns the existing record without error. This means you can safely call `register()` at the top of any activation script without checking whether the model already exists.

What registration does store:

- The HuggingFace model ID (`hf_model_id`) — this is the canonical reference used by the inference resolver
- A human-readable name and family label — used for routing and prompt template selection
- A parameter count — metadata only, used for display and capacity planning

The returned `bm_...` ID is the platform's internal identifier for this base model. You will use it to drive activation.

---

## Step 2 — Activation

Activation is where the GPU work happens. When you call `activate_base()` or `activate_fine_tuned()`, the platform creates a Ray Serve deployment that loads the model weights onto the next available GPU in the cluster.

Concretely, this is what happens in sequence:

**1. The deployment record is written**

The platform writes a deployment record with `status=deploying`. The InferenceReconciler picks this up on its next poll cycle (every 20 seconds) and submits the Ray Serve application.

**2. Weights are pulled from the HuggingFace cache**

vLLM reads the model weights from the local HuggingFace cache (`HF_CACHE_PATH`). If the weights are not cached, they are downloaded from HuggingFace before loading. This is the step most likely to take a long time on first activation — a 4-bit quantised 7B model is approximately 4 GB.

**3. Layers are loaded onto the GPU**

vLLM loads the model layers into VRAM. For quantised models, BitsAndBytes handles decompression during loading. The amount of VRAM consumed by weights is fixed at this point and does not change during inference.

**4. The KV cache is allocated**

After weights are loaded, vLLM allocates the KV (key-value) cache from the remaining available VRAM. The KV cache is what allows the model to handle concurrent requests and long contexts. A larger KV cache means more concurrent requests can be served without queuing.

**5. CUDA graph capture**

vLLM captures CUDA execution graphs for the most common sequence lengths. This is a one-time cost that significantly reduces per-request latency at inference time. It takes 15 to 30 seconds and will trigger a Ray Serve health check warning — this is expected and not an error.

**6. The deployment is marked active**

Once Ray Serve reports the application as healthy, the InferenceReconciler updates the deployment record to `status=active`. The model is now reachable at its internal route and will accept inference requests.

Total time from activation call to ready state is typically 60 to 120 seconds for a quantised 7B model on an 8 GB GPU.

---

## Base Model Activation

```python
import os

from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv("../../.tests.env")

admin_client = Entity(
    api_key=os.getenv("DEV_PROJECT_DAVID_CORE_ADMIN_KEY"),
    base_url="http://localhost:80",
)

# -------------------------------------------------------------
# Register base model in the catalog (admin, idempotent)
# -------------------------------------------------------------
registered = admin_client.registry.register(
    hf_model_id="unsloth/qwen2.5-1.5b-instruct-unsloth-bnb-4bit",
    name="Qwen2.5 1.5B Instruct (Unsloth 4bit)",
    family="qwen",
    parameter_count="1.5B",
)
print(f"📦 Base model registered: {registered.id}")

# -------------------------------------------------------------
# Activate base model — accepts bm_... ID or raw HF path
# -------------------------------------------------------------
print(f"🎯 Activating base model: {registered.id}")
result = admin_client.deployments.activate_base(registered.id)
print(f"✅ Result: {result}")

# Confirm
deployments = admin_client.deployments.list()
print(f"📋 Active deployments: {deployments}")
```

Follow activation progress in the inference worker logs:

```bash
pdavid --mode logs --follow --services inference-worker
```

A healthy activation produces this sequence:

```
🚢 Deploying via Ray Serve: vllm_dep_... model=unsloth/qwen2.5-1.5b-instruct-unsloth-bnb-4bit
Loading weights with BitsAndBytes quantization...
Model loading took 1.49GiB and 36.02 seconds
KV Cache: 2542 CUDA blocks — maximum concurrency: 19.86x at 2048 tokens
Capturing CUDA graph shapes: 100%|██████████| 35/35
Graph capturing finished in 16 secs, took 0.62 GiB
Application 'vllm_dep_...' is ready at http://0.0.0.0:8000/vllm_dep_...
✅ Ray Serve deployment active: vllm_dep_...
```

---

## Fine-Tuned Model Activation

Activating a fine-tuned model requires the base model to be registered first. vLLM loads the base weights once and attaches the LoRA adapter on top. The adapter adds no meaningful VRAM overhead — the base model and the fine-tuned adapter share the same GPU memory footprint.

This means a single vLLM instance can serve multiple fine-tuned adapters simultaneously from one base model, switching adapters dynamically per request.

```python
import os

from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv("../../.tests.env")

# ---------------------------------------------
# This is provided by the user after
# a successful fine-tuning run
# ---------------------------------------------
FINE_TUNED_MODEL_ID = "ftm_J00AOhrZSqLZx5pEdV9EJK"

# ----------------------------------------
# Confirm existence of fine-tuned adapters
# Fine-tuned models are user scoped
# ----------------------------------------
client = Entity(
    api_key=os.getenv("DEV_PROJECT_DAVID_CORE_TEST_USER_KEY"),
)

model = client.models.retrieve(FINE_TUNED_MODEL_ID)
print(model)

# ----------------------------------------
# Model activations are admin scoped
# ----------------------------------------
admin_client = Entity(
    api_key=os.getenv("DEV_PROJECT_DAVID_CORE_ADMIN_KEY"),
)

# -------------------------------------------------------------
# Register base model in the catalog (admin, idempotent)
# -------------------------------------------------------------
registered = admin_client.registry.register(
    hf_model_id="unsloth/qwen2.5-1.5b-instruct-unsloth-bnb-4bit",
    name="Qwen2.5 1.5B Instruct (Unsloth 4bit)",
    family="qwen",
    parameter_count="1.5B",
)
print(f"📦 Base model registered: {registered.id}")

# -------------------------------------------------------------
# Activate the fine-tuned model
# -------------------------------------------------------------
print(f"🎯 Activating fine-tuned model: {FINE_TUNED_MODEL_ID}")
result = admin_client.deployments.activate_fine_tuned(FINE_TUNED_MODEL_ID)
print(f"✅ Result: {result}")

# -------------------------------------------------------------
# Confirm active deployments
# -------------------------------------------------------------
deployments = admin_client.deployments.list()
print(f"📋 Active deployments: {deployments}")
```

---

## Dual Inference from a Single Deployment

When a fine-tuned model is activated, vLLM serves two inference routes from the same GPU:

| Route | Model parameter | What it serves |
|---|---|---|
| Base model | `unsloth/qwen2.5-1.5b-instruct-unsloth-bnb-4bit` | Raw backbone, no adapter |
| Fine-tuned adapter | `ftm_J00AOhrZSqLZx5pEdV9EJK` | LoRA adapter on top of base |

Both routes share the same base weights in VRAM. The adapter is swapped in dynamically per request. This has two practical implications.

First, you can compare base and fine-tuned behaviour on identical prompts by switching the `model` parameter in your inference call, with no additional deployment required.

Second, an admin can register a single base model and serve multiple fine-tuned adapters from the same vLLM instance simultaneously, subject to the `--max-lora-rank` and `--max-cpu-loras` configuration on the deployment.

---

## Cache Management

The `pdavid cache` command manages the HuggingFace model cache inside the inference worker container without you having to shell in manually. All operations run through `docker exec` against the target node.

This is particularly important for airgapped deployments, where a missing model will fail at activation time rather than downloading automatically, and for multi-node clusters where different nodes may have different cache states.

### Listing cached models

```bash
# Scan the default inference worker
pdavid cache --list

# Target a specific worker node
pdavid cache --list --node inference_worker_2
```

Running `pdavid cache` with no flags defaults to `--list`.

Output:

```
  HuggingFace cache - inference_worker
============================================================
REPO ID                                          SIZE     LAST ACCESSED
unsloth/qwen2.5-1.5b-instruct-unsloth-bnb-4bit  1.5G     2 days ago

Done in 0.0s. Scanned 1 repo(s) for a total of 1.5G.
```

### Checking disk usage

```bash
pdavid cache --disk-usage
```

Prints the total cache size and a per-model breakdown. Useful before downloading large models to confirm there is sufficient space.

### Downloading weights

Download a model into the cache before activation. This avoids the weight download happening at activation time, which blocks the deployment from progressing until the download completes.

```bash
pdavid cache --download unsloth/qwen2.5-1.5b-instruct-unsloth-bnb-4bit

# On a specific worker node
pdavid cache --download unsloth/qwen2.5-1.5b-instruct-unsloth-bnb-4bit --node inference_worker_2
```

For gated models such as the Llama 3 family, ensure `HF_TOKEN` is set in `.env` and that you have accepted the model licence on the HuggingFace model page. A 401 error during download is almost always a missing licence acceptance rather than a bad token.

### Deleting a cached model

```bash
pdavid cache --delete unsloth/qwen2.5-1.5b-instruct-unsloth-bnb-4bit
```

The command asks for confirmation before removing anything. Deletion is permanent — the weights will need to be re-downloaded if you activate the model again. Deactivate any running deployment for the model before deleting its cache.

### Targeting a specific node

All cache commands accept `--node` to target any named inference worker container. This is useful for multi-node clusters where you need to verify or manage cache state on a specific machine independently.

```bash
pdavid cache --list --node inference_worker_2
pdavid cache --download unsloth/qwen2.5-7b-instruct-unsloth-bnb-4bit --node inference_worker_2
pdavid cache --disk-usage --node inference_worker_2
```

If a model is active but returning errors, checking the cache on each node tells you whether the weights are actually present where Ray scheduled the deployment.

---

## Ray Cluster Management

The `pdavid ray` command gives you visibility into the Ray cluster and Ray Serve deployments without leaving the terminal or opening the dashboard. All operations run through `docker exec` against the target inference worker container.

Running `pdavid ray` with no flags defaults to `--status`.

### Cluster status

```bash
pdavid ray --status
```

Prints cluster resource totals and what is currently available — GPU count, CPU, memory. The fastest way to confirm the cluster is up and what capacity is free before triggering an activation.

### Active deployments

```bash
pdavid ray --deployments
```

Lists every active Ray Serve application by name and status. Deployment names follow the `vllm_dep_...` pattern. Use this to confirm an activation completed, identify a stuck deployment, or find the name of a deployment you want to kill.

### GPU memory usage

```bash
pdavid ray --gpu
```

Runs `nvidia-smi` inside the inference worker and returns a concise summary per GPU:

```
NVIDIA GeForce RTX 4060, 4821, 3274, 8192, 62
```

Name, used MB, free MB, total MB, utilisation %. Useful for understanding how much VRAM a running deployment is holding before activating another model, or confirming VRAM was released after deactivation.

### Ray dashboard

```bash
pdavid ray --dashboard
```

Prints the dashboard URL. The dashboard provides a full graphical view of cluster nodes, resource utilisation, active Serve deployments, and replica health.

### Killing a deployment

```bash
pdavid ray --kill vllm_dep_WwY4uagFG1wDImm93xQ7qf
```

Tears down a specific Ray Serve application by name and immediately releases the GPU memory it was holding. The command asks for confirmation before proceeding.

This is the clean fix for GPU contention — if an old deployment is blocking a new activation because it holds the GPU, kill it by name rather than restarting the entire stack. Get the deployment name from `pdavid ray --deployments` first, then verify the GPU is free with `pdavid ray --gpu` after.

### Targeting a specific node

All ray commands accept `--node` to target a specific inference worker container:

```bash
pdavid ray --status --node inference_worker_2
pdavid ray --deployments --node inference_worker_2
pdavid ray --gpu --node inference_worker_2
```

---

## Deactivation

```python
# Deactivate a specific deployment
admin_client.deployments.deactivate(deployment_id="dep_...")

# Release all GPU memory immediately
admin_client.deployments.deactivate_all()
```

Deactivation tears down the Ray Serve application and frees all VRAM held by that deployment. The model remains in the catalog and can be reactivated at any time without re-registering.

---

For GPU memory configuration and concurrent request capacity, see [vLLM](/docs/admin-vllm).  
For the full fine-tuning pipeline that produces `ftm_...` IDs, see [Sovereign Forge](/docs/sovereign-forge).