---
title: Base models
category: fine-tuning
slug: fine-tuning-base-models
nav_order: 3
---

# Base models

## Overview

Before dispatching a fine-tuning job, you need to know which base models are available on the cluster. The registry exposes the catalog of models that have been downloaded and cached on the cluster's GPU nodes — only these models can be used as a starting point for fine-tuning.

Attempting to fine-tune against a model that is not in the registry will cause the training job to fail. Always call `list()` first to confirm the model you intend to use is available.

---

## List

Returns the catalog of base models registered on the cluster.

```python
from projectdavid import Entity

client = Entity()

models = client.registry.list()

for m in models.items:
    print(f"{m.id}  {m.name}  {m.parameter_count}  {m.endpoint}")
```

Example output:

```
bm_4KVRO2DfxBOhe  Qwen2.5 1.5B Instruct (Unsloth 4bit)  1.5B  unsloth/qwen2.5-1.5b-instruct-unsloth-bnb-4bit
```

| Field | Description |
|---|---|
| `id` | Prefixed catalog ID (`bm_...`). |
| `name` | Human-readable display name. |
| `family` | Model family — `qwen`, `llama`, `mistral`, etc. |
| `parameter_count` | Parameter count string — `1.5B`, `7B`, `70B`, etc. |
| `is_multimodal` | `True` if the model accepts image inputs alongside text. |
| `endpoint` | HuggingFace model path — pass this to `training.create()` as `base_model`. |
| `created_at` | Unix timestamp of registration. |

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | `int` | `50` | Maximum records to return. |
| `offset` | `int` | `0` | Pagination offset. |

---

## Using the result

Pass `endpoint` directly to `training.create()` as the `base_model` argument:

```python
models = client.registry.list()

# Pick the first available model
base_model = models.items[0].endpoint

job = client.training.create(
    dataset_id=dataset.id,
    base_model=base_model,
    framework="unsloth",
    config={"learning_rate": 2e-4, "num_train_epochs": 1, "lora_r": 16},
)
print(f"Job {job.id} dispatched using {base_model}")
```

> **Note** — the registry only contains models that have been explicitly registered by a cluster administrator. If the model you need is not listed, contact your administrator and request it be downloaded and registered before dispatching a training job.