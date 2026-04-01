---
title: Model Activation
category: admin
slug: admin-model-activation
nav_order: 1
---

# Model Activation

Model activation is the process of deploying a locally hosted model to the inference cluster so it can serve requests. Activation applies only to vLLM-backed models. Cloud providers (Hyperbolic, TogetherAI, etc.) do not require activation.

Activation is **admin-scoped**. A standard user API key cannot activate or deactivate models. Model retrieval and listing are user-scoped.

---

## Concepts

### Base models and fine-tuned models

A **base model** is a HuggingFace model registered in the catalog. It is the backbone that vLLM loads into GPU memory.

A **fine-tuned model** is a LoRA adapter produced by a Sovereign Forge training run. It sits on top of a base model and costs no additional VRAM — vLLM loads the base weights once and swaps adapters per request.

When you activate a fine-tuned model, the platform resolves its base model automatically and deploys both together as a single vLLM instance. This means **two inference routes become available from the same GPU**:

```
{"model": "unsloth/qwen2.5-1.5b-instruct-unsloth-bnb-4bit", ...}  # base backbone
{"model": "ftm_G05BERHAEvSRr2KTyUqWIJ", ...}                      # LoRA adapter
```

Users can compare base versus fine-tuned behaviour on identical prompts by switching the `model` parameter. No additional deployment is required.

### Activation is asynchronous

Calling `activate()` returns immediately with `status: "deploying"`. The actual vLLM process starts within ≤20 seconds as the `InferenceReconciler` picks up the deployment record on its next poll cycle. Plan for this lag in any automation that depends on the model being live.

---

## Register a base model

Before activating, the base model must exist in the catalog. Registration is idempotent; calling it again returns the existing record.

```python
from projectdavid import Entity

admin_client = Entity(api_key="your-admin-api-key")

registered = admin_client.registry.register(
    hf_model_id="unsloth/qwen2.5-1.5b-instruct-unsloth-bnb-4bit",
    name="Qwen2.5 1.5B Instruct (Unsloth 4bit)",
    family="qwen",
    parameter_count="1.5B",
)

print(registered.id)  # bm_JkKzqsbqGJ4cB4dYqdDebm
```

Hold on to the returned `bm_...` ID — you need it for base model activation and deactivation.

---

## Activate a fine-tuned model

Fine-tuned model IDs (`ftm_...`) are produced by training jobs and are user-scoped. Retrieve one first to confirm it exists before activating.

```python
from projectdavid import Entity

# Retrieval is user-scoped
client = Entity(api_key="user-api-key")
model = client.models.retrieve("ftm_G05BERHAEvSRr2KTyUqWIJ")
print(model.id)

# Activation is admin-scoped
admin_client = Entity(api_key="your-admin-api-key")
result = admin_client.models.activate("ftm_G05BERHAEvSRr2KTyUqWIJ")
print(result)
# status='deploying' model_id='ftm_...' node='node_...' tensor_parallel_size=1
# next_step='InferenceReconciler will deploy via Ray Serve on next poll.'
```

---

## Activate a base model (no LoRA)

Use this when you want to serve the backbone directly without any fine-tuned adapter.

```python
result = admin_client.models.activate_base("bm_JkKzqsbqGJ4cB4dYqdDebm")
print(result)
# status='deploying_standard' model_id='bm_...' node='node_...'
```

---

## Deactivate a fine-tuned model

Surgically shuts down a specific fine-tuned model deployment and releases its GPU reservation.

```python
result = admin_client.models.deactivate("ftm_G05BERHAEvSRr2KTyUqWIJ")
print(result)
# {'status': 'deactivated', 'model_id': 'ftm_...'}
```

---

## Deactivate a base model

```python
result = admin_client.models.deactivate_base("bm_JkKzqsbqGJ4cB4dYqdDebm")
print(result)
# {'status': 'deactivated', 'base_model_id': 'bm_...'}
```

---

## Emergency stop — deactivate all

Clears every active deployment and returns the cluster to an idle state. Use this when you need a clean slate or before a maintenance window.

```python
result = admin_client.models.deactivate_all()
print(result)
# {'status': 'success', 'message': 'Cluster resources released.'}
```

---

## Multi-GPU sharding

For models that exceed single-GPU VRAM, pass `tensor_parallel_size` to shard across multiple GPUs.

```python
result = admin_client.models.activate(
    "ftm_G05BERHAEvSRr2KTyUqWIJ",
    tensor_parallel_size=2,
)
```

The value must not exceed the number of GPUs available on the target node. The default is `1`.

---

## Node pinning

To target a specific GPU node in a multi-node mesh, pass `node_id`.

```python
result = admin_client.models.activate(
    "ftm_G05BERHAEvSRr2KTyUqWIJ",
    node_id="node_cf5c0889e2fb",
)
```

If omitted, the platform selects the most resource-rich available node automatically.

---

## Notes

- Only one deployment is active at a time per cluster. Calling `activate()` automatically deactivates any existing deployment before creating the new one.
- Activation only applies to locally hosted vLLM models. Cloud provider models (OpenAI, Anthropic, Hyperbolic, etc.) are always available and do not require activation.
- The `deactivate_all()` call is the correct way to release GPU resources before submitting a training job on a single-GPU machine.