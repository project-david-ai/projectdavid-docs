---
title: Model Activation
category: admin
slug: admin-model-activation
nav_order: 1
---


# Model Activation

Model activation loads and provisions your model of choice onto a GPU. Local models are powered by vLLM, which handles token generation, and Ray Serve, which handles GPU cluster management.

Activation is admin-scoped. Standard user API keys cannot activate or deactivate models.

---

## Prerequisites

Before you can activate a model, the model weights need to be present on an inference worker node. vLLM loads directly from the HuggingFace cache on disk; if the weights aren't there, activation will fail.

By default, the base API is the head end of an opt-in high performance [GPU cluster](/docs/admin-sovereign-cluster).

### Check what's already cached

```bash
docker exec inference_worker huggingface-cli scan-cache
```

To see disk usage per model:

```bash
docker exec inference_worker du -sh /root/.cache/huggingface/hub/models--*
```

### Download model weights

Use the HuggingFace CLI directly inside the inference worker container:

```bash
docker exec inference_worker huggingface-cli download Qwen/Qwen2.5-VL-3B-Instruct-AWQ
```

The weights land in `/root/.cache/huggingface/hub/` and are immediately available for activation.

For gated models, pass your token:

```bash
docker exec -e HUGGING_FACE_HUB_TOKEN=hf_your_token inference_worker \
  huggingface-cli download meta-llama/Llama-3.2-11B-Vision-Instruct
```

To store your token persistently so you don't have to pass it on every command:

```bash
pdavid configure --set HF_TOKEN=hf_your_token
```

Public models download without a token.

### Quick inspection commands

Check the cache directory directly:

```bash
docker exec inference_worker ls /root/.cache/huggingface/hub/
```

Check GPU memory before activation:

```bash
docker exec inference_worker nvidia-smi
```

---

## Finding models

Browse available model weights on the [HuggingFace model hub](https://huggingface.co/models). Filter by task, architecture, or quantization format. For vLLM on consumer GPUs, look for AWQ or GPTQ quantized variants — they carry the quantization format in the model name, for example `Qwen2.5-VL-3B-Instruct-AWQ`.

---

# Model Registration

Before a model can be activated, it must exist in the model catalog. Registration links a HuggingFace model ID to a catalog record that the platform uses to resolve the model at deploy time.

Registration is idempotent. Calling it again with the same `hf_model_id` returns the existing record without creating a duplicate.

```python
import os
from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv(".tests.env")

admin_client = Entity(api_key=os.getenv("DEV_PROJECT_DAVID_CORE_ADMIN_KEY"))

registered = admin_client.registry.register(
    hf_model_id="Qwen/Qwen2.5-VL-3B-Instruct-AWQ",
    name="Qwen2.5 VL 3B Instruct AWQ",
    family="qwen",
    parameter_count="3B",
    is_multimodal=True,
)

print(registered.id)  # bm_...
```

The returned object has a `bm_...` prefixed ID. Hold on to it — you will pass it directly to `activate_base()`.

### Parameters

`hf_model_id` is the HuggingFace repo path. This must match exactly what you downloaded into the cache.

`name` is a human-readable label shown in listings.

`family` groups models by architecture. Accepted values include `qwen`, `llama`, `mistral`, `phi`, `gemma`, and `deepseek`. This is used internally for chat template resolution.

`parameter_count` is a label string. Use `"3B"`, `"7B"`, `"72B"` etc.

`is_multimodal` flags the model as a vision model. Set this to `True` for any model that accepts image inputs.

---

### Listing the catalog

```python
catalog = admin_client.registry.list()
for model in catalog.items:
    print(model.id, model.name)
```

---

### Retrieving a specific model

```python
model = admin_client.registry.retrieve("bm_JkKzqsbqGJ4cB4dYqdDebm")
print(model.hf_model_id)
```

You can also retrieve by HuggingFace path:

```python
model = admin_client.registry.retrieve("Qwen/Qwen2.5-VL-3B-Instruct-AWQ")
```

---

### Deregistering a model

```python
admin_client.registry.deregister("bm_JkKzqsbqGJ4cB4dYqdDebm")
```

Deregistration is admin-only. It removes the catalog record but does not delete the weights from the HuggingFace cache.

---

# Model Activation

Activation schedules a registered model for deployment on the inference cluster. The call returns immediately. The `InferenceReconciler` picks up the new deployment record on its next poll cycle and starts the vLLM process via Ray Serve. Allow up to 20 seconds for the model to be live.

To confirm the model is running after activation:

```bash
pdavid ray --deployments
```

Or check the database directly:

```bash
pdavid db --status
```

Only one deployment is active at a time per cluster node. Activating a new model clears the existing one first.

---

## Activating a base model

```python
import os
from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv(".tests.env")

admin_client = Entity(api_key=os.getenv("DEV_PROJECT_DAVID_CORE_ADMIN_KEY"))

result = admin_client.deployments.activate_base(
    base_model_id="bm_JkKzqsbqGJ4cB4dYqdDebm",
    gpu_memory_utilization=0.65,
    max_model_len=4096,
    quantization="awq",
    dtype="float16",
)

print(result.deployment_id)
print(result.serve_route)
```

`activate_base` accepts either a `bm_...` catalog ID or a raw HuggingFace path. The server resolves HF paths to catalog IDs automatically.

`result.serve_route` is the internal URL the inference worker exposes for this deployment. This is the value you pass as `vllm_base_url` in your inference requests.

### Parameters

`base_model_id` is required. Everything else is optional — omit any field to fall back to the node-level environment defaults in `docker-compose.yml`.

`gpu_memory_utilization` controls what fraction of GPU VRAM vLLM may allocate for weights and KV cache. Valid range is `0.10` to `0.95`. The platform default is `0.50` — a conservative baseline that is safe on 8GB cards without profiling. Push it higher once you know your model's weight footprint.

> **OOM warning.** Always pass `gpu_memory_utilization` explicitly. Omitting it on a bare activation falls back to the platform default of `0.50`. For most AWQ models on 8GB this is fine, but if you are loading a larger model or multiple adapters, size your allocation accordingly before activating. If an activation gets stuck or the process crashes on startup, run `pdavid db --nuke-deployments` to clear the record and start fresh.

`max_model_len` sets the maximum sequence length in tokens, covering both prompt and completion. Larger values consume more KV cache VRAM. For a 3B AWQ model on 8GB, `4096` is a reliable starting point.

`quantization` sets the quantization scheme. Pass `"awq"` for AWQ models, `"gptq"` for GPTQ, `"awq_marlin"` for the faster Marlin-optimised AWQ kernel. Omit for full precision.

`dtype` sets the compute dtype. Use `"float16"` for most GPU setups. `"bfloat16"` is available on Ampere and newer but vLLM will cast it down to float16 on some quant configurations.

`enforce_eager` disables CUDA graph capture. This slows inference but is useful when debugging OOM crashes during initialisation. Leave it unset in production.

`max_num_seqs` caps the number of concurrent sequences vLLM will process. Useful for vision models where each image consumes significant KV cache slots.

`tensor_parallel_size` shards the model across multiple GPUs. Default is `1`. Must not exceed the number of GPUs on the target node.

`target_node_id` pins the deployment to a specific node in a multi-node mesh. Omit to let the platform select automatically.

### A note on hyperparameters

Model hyperparameters tend to be idiosyncratic. Beyond a certain tolerance, an activation is liable to fail if the correct hyperparameters are not passed in. Visit the HuggingFace model card and author documentation for guidance on optimal settings for your specific model.

The table below covers three well-tested models and their confirmed working settings on consumer-grade hardware.

| Model | quantization | dtype | gpu_memory_utilization | max_model_len | mm_processor_kwargs | limit_mm_per_prompt |
|---|---|---|---|---|---|---|
| `Qwen/Qwen2.5-VL-3B-Instruct-AWQ` | `awq` | `float16` | `0.65` | `4096` | `{"min_pixels": 3136, "max_pixels": 50176}` | `{"image": 2}` |
| `Qwen/Qwen2.5-VL-7B-Instruct-AWQ` | `awq` | `float16` | `0.90` | `2048` | `{"min_pixels": 3136, "max_pixels": 50176}` | `{"image": 1}` |
| `meta-llama/Llama-3.2-11B-Vision-Instruct-GPTQ` | `gptq` | `float16` | `0.90` | `4096` | `{}` | `{"image": 1}` |

Model cards:
- [Qwen/Qwen2.5-VL-3B-Instruct-AWQ](https://huggingface.co/Qwen/Qwen2.5-VL-3B-Instruct-AWQ)
- [Qwen/Qwen2.5-VL-7B-Instruct-AWQ](https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct-AWQ)
- [meta-llama/Llama-3.2-11B-Vision-Instruct](https://huggingface.co/meta-llama/Llama-3.2-11B-Vision-Instruct)

---

### Vision models

Vision models require two additional parameters to prevent runaway token counts from high-resolution images.

`limit_mm_per_prompt` caps the number of images per request. Pass `{"image": 1}` or `{"image": 2}` depending on your use case.

`mm_processor_kwargs` sets processor-level resolution caps. These are passed directly to the vLLM multimodal processor at engine init and control how many tokens each image generates.

```python
result = admin_client.deployments.activate_base(
    base_model_id="bm_JkKzqsbqGJ4cB4dYqdDebm",
    gpu_memory_utilization=0.65,
    max_model_len=4096,
    quantization="awq",
    dtype="float16",
    mm_processor_kwargs={
        "min_pixels": 4 * 28 * 28,   # 3,136
        "max_pixels": 64 * 28 * 28,  # 50,176
    },
    limit_mm_per_prompt={"image": 2},
)
```

The pixel caps are model-family specific. For Qwen2.5-VL, `max_pixels=50176` produces roughly 64 vision tokens per image and fits comfortably within a 4096 token context on 8GB VRAM.

---

## Activating a fine-tuned model

Fine-tuned models are LoRA adapters produced by a training run. Activating one deploys the base model backbone with the adapter loaded. Both routes become available from the same GPU reservation.

```python
result = admin_client.deployments.activate_fine_tuned(
    model_id="ftm_G05BERHAEvSRr2KTyUqWIJ",
    gpu_memory_utilization=0.90,
    max_model_len=4096,
    quantization="awq",
    dtype="float16",
)
```

All hyperparam fields are identical to `activate_base`. The platform resolves the base model from the fine-tuned model record automatically.

---

## Updating a live deployment

You can patch a running deployment without reactivating it. Only the fields you pass are written — everything else retains its current value. The reconciler picks up the change on its next poll cycle.

```python
admin_client.deployments.update(
    deployment_id="dep_abc123",
    max_model_len=8192,
    gpu_memory_utilization=0.85,
    mm_processor_kwargs={
        "min_pixels": 4 * 28 * 28,
        "max_pixels": 64 * 28 * 28,
    },
)
```

---

## Listing active deployments

```python
deployments = admin_client.deployments.list()
for dep in deployments.items:
    print(dep.deployment_id, dep.status, dep.base_model_id)
```

---

## Deactivating a deployment

Surgically remove a single base model deployment:

```python
admin_client.deployments.deactivate_base("bm_JkKzqsbqGJ4cB4dYqdDebm")
```

Or by HuggingFace path:

```python
admin_client.deployments.deactivate_base("Qwen/Qwen2.5-VL-3B-Instruct-AWQ")
```

Deactivate a fine-tuned model:

```python
admin_client.deployments.deactivate_fine_tuned("ftm_G05BERHAEvSRr2KTyUqWIJ")
```

Full cluster reset — releases all GPU reservations:

```python
admin_client.deployments.deactivate_all()
```

Use `deactivate_all()` before submitting a training job on a single-GPU machine.

---

# Putting It Together

Registration and activation are two separate steps, but they chain naturally. Register the model once to get a catalog ID, then pass that ID to activate. The full flow looks like this:

```python
import os
from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv(".tests.env")

admin_client = Entity(api_key=os.getenv("DEV_PROJECT_DAVID_CORE_ADMIN_KEY"))

# Step 1 — Register the model in the catalog (idempotent)
registered = admin_client.registry.register(
    hf_model_id="Qwen/Qwen2.5-VL-3B-Instruct-AWQ",
    name="Qwen2.5 VL 3B Instruct AWQ",
    family="qwen",
    parameter_count="3B",
    is_multimodal=True,
)

# Step 2 — Activate using the returned bm_... ID
result = admin_client.deployments.activate_base(
    base_model_id=registered.id,
    gpu_memory_utilization=0.65,
    max_model_len=4096,
    quantization="awq",
    dtype="float16",
    mm_processor_kwargs={
        "min_pixels": 4 * 28 * 28,   # 3,136
        "max_pixels": 64 * 28 * 28,  # 50,176
    },
    limit_mm_per_prompt={"image": 2},
)

print(result)

# Confirm
deployments = admin_client.deployments.list()
print(deployments)
```

`registry.register` is idempotent — running this script a second time returns the existing catalog record rather than creating a duplicate. The `bm_...` ID is stable across runs, so you can safely keep this script as your activation entry point.