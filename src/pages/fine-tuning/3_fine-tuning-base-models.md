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

> **Note on the registry vs the HF cache** — the registry is the supported discovery surface for fine-tuning. The cluster's HuggingFace cache and the registry are kept in sync by the operator. If you need a model that is not listed, contact your administrator and request it be downloaded and registered before dispatching a training job.

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

### Response fields

Each entry in `models.items` is a `BaseModelRead` record:

| Field | Type | Description |
|---|---|---|
| `id` | `str` | Prefixed catalog ID (`bm_...`). |
| `name` | `str` | Human-readable display name. |
| `family` | `str` or `None` | Model family — `qwen`, `llama`, `mistral`, etc. |
| `parameter_count` | `str` or `None` | Parameter count string — `1.5B`, `7B`, `70B`, etc. |
| `is_multimodal` | `bool` | `True` if the model accepts image inputs alongside text. |
| `endpoint` | `str` or `None` | HuggingFace model path. Pass this to `training.create()` as `base_model`. |
| `created_at` | `int` | Unix timestamp of registration. |

The list response also exposes pagination metadata at the top level:

| Field | Description |
|---|---|
| `items` | Page of `BaseModelRead` records. |
| `total` | Total number of registered base models. |
| `limit` | Page size used for this response. |
| `offset` | Offset used for this response. |

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | `int` | `50` | Maximum records to return. |
| `offset` | `int` | `0` | Pagination offset. |

### Filtering for fine-tunable entries

The `endpoint` field is optional in the schema. An entry with `endpoint=None` is a deployment-only registration and cannot be passed to `training.create()`. When using the registry to pick a fine-tuning target, filter to entries where `endpoint` is set:

```python
fine_tunable = [m for m in models.items if m.endpoint is not None]
```

---

## Using the result

Pass `endpoint` directly to `training.create()` (see [Training Jobs](/docs/fine-tuning-training-jobs)) as the `base_model` argument:

```python
from projectdavid_common import ValidationInterface

validator = ValidationInterface()

models = client.registry.list()

# Pick the first fine-tunable model
fine_tunable = [m for m in models.items if m.endpoint is not None]
base_model = fine_tunable[0].endpoint

job = client.training.create(
    dataset_id=dataset.id,
    base_model=base_model,
    framework="unsloth",
    config=validator.TrainingConfig(
        profile="laptop",
        max_steps=10,
    ),
)
print(f"Job {job.id} dispatched using {base_model}")
```

For details on the registration, deletion, deployment, and activation lifecycle, see the **Admin** section of these docs — those operations are administrator-scoped.