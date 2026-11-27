---
title: Training Jobs
category: fine-tuning
slug: fine-tuning-training-jobs
nav_order: 2
---

# Training Jobs

## Overview

A Training Job dispatches a fine-tuning run to the Sovereign Forge cluster. The cluster validates the request, schedules the job onto an available GPU node via Redis, runs LoRA training against your prepared dataset, and writes the resulting adapter weights to the shared Samba hub.

Jobs are user-scoped. Dispatch is asynchronous — `create()` returns immediately and you poll for status, or use the built-in `wait_for_completion()` helper.

---

## Create

Submit a training job against a prepared dataset. Returns a `TrainingJobRead` object with the job ID you use to track progress.

The `config` argument accepts either a plain dict or a typed `TrainingConfig` instance. The typed object is recommended — you get IDE autocomplete and local Pydantic validation before the HTTP round-trip.

```python
from projectdavid import Entity
from projectdavid_common import ValidationInterface

client = Entity()
validator = ValidationInterface()

job = client.training.create(
    dataset_id="ds_abc123",
    base_model="unsloth/qwen2.5-1.5b-instruct-unsloth-bnb-4bit",
    framework="unsloth",
    config=validator.TrainingConfig(
        profile="laptop",
        max_steps=10,
    ),
)
print(f"Job ID: {job.id}")
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `dataset_id` | `str` | ✅ | ID of an `active` dataset. Preparation must be complete before dispatch. |
| `base_model` | `str` | ✅ | HuggingFace model identifier. Must already be present in the node's HuggingFace cache — the cluster will not trigger a remote download. |
| `framework` | `str` | — | Training backend. One of `"unsloth"`, `"axolotl"`. Defaults to `"axolotl"`. |
| `config` | `TrainingConfig`, `dict`, or `None` | — | Training hyperparameters. See config reference below. |

### Pre-dispatch checks

Before the job is queued, the training service runs three guards. Each rejects the request with a specific HTTP status so the failure is unambiguous on the client side.

| Status | Cause | Resolution |
|---|---|---|
| `400` | Dataset is not in `active` status | Wait for `prepare()` to finish, or fix and re-upload if it ended in `failed`. |
| `400` | Base model is not present in the node's HuggingFace cache | Ask your cluster operator to pre-cache the model. The cluster will not trigger a remote download. |
| `507` | Insufficient free disk on the worker (`SHARED_PATH` or `SCRATCH_PATH`) | Free up space on the cluster, or adjust `MIN_SAMBA_FREE_GB` / `MIN_SCRATCH_FREE_GB` env vars on the worker. |

The 507 response includes a structured detail body listing each path that failed the check, the observed free space, and the threshold:

```json
{
  "error": "Insufficient storage for training job",
  "failures": [
    {"path": "/tmp", "free_gb": 2.5, "required_gb": 10.0, "reason": "below threshold"}
  ],
  "hint": "Free up space on the listed paths, or adjust MIN_SAMBA_FREE_GB / MIN_SCRATCH_FREE_GB env vars."
}
```

These are pre-dispatch — none of them consume queue time or GPU time. A 507 today is far cheaper than a mid-run SMB write failure an hour into training.

---

## TrainingConfig reference

Every field is optional. Resolution order at job-create time is:

```
BASE_DEFAULTS → PROFILES[profile] (if profile set) → user field overrides
```

The fully-resolved dict is written to `TrainingJob.config` and is the sole source of truth for the worker and trainer. After creation, retrieve the job to see the resolved config exactly as the trainer will use it.

### Profiles

The `profile` field selects a hardware preset. Only the profile-scoped fields below are overridden by the preset; everything else falls through from `BASE_DEFAULTS`.

| Profile | Target hardware |
|---|---|
| `laptop` | VRAM-frugal — e.g. RTX 4060 Laptop 8 GB. Long-horizon runs at small batch + accumulation. |
| `standard` | Desktop or small-cloud GPU — e.g. RTX 4090 24 GB. Default shape. |

Profile-scoped values:

| Field | `laptop` | `standard` |
|---|---|---|
| `max_seq_length` | 1024 | 2048 |
| `per_device_train_batch_size` | 1 | 2 |
| `gradient_accumulation_steps` | 8 | 4 |
| `max_steps` | 12500 | 60 |
| `optim` | `adamw_8bit` | `adamw_8bit` |

Omitting `profile` is equivalent to selecting `standard` for these fields.

### Base defaults

These values apply unless overridden by either a profile or an explicit field on your config. They cover SFTConfig and PEFT settings that are not per-profile concerns.

| Field | Default | Description |
|---|---|---|
| `learning_rate` | `2e-4` | Optimizer learning rate. Values above `1e-2` usually diverge. |
| `num_train_epochs` | `3` | Full passes over the dataset. Ignored if `max_steps` is set. |
| `warmup_steps` | `2` | Linear LR warmup steps at the start of training. |
| `weight_decay` | `0.01` | L2 regularization strength. |
| `lr_scheduler_type` | `linear` | One of `linear`, `cosine`, `constant`, `constant_with_warmup`. |
| `seed` | `3407` | RNG seed. Used by both SFTConfig and PEFT model init for full determinism. |
| `logging_steps` | `50` | How often to emit progress metrics. Lower = more DB writes. |
| `lora_r` | `32` | LoRA rank. Higher = more expressive adapter, larger file. Typical: 8, 16, 32, 64. |
| `lora_alpha` | `32` | LoRA alpha scaling. Defaults to `lora_r` if unset (standard PEFT convention). |
| `lora_dropout` | `0.0` | Dropout applied to LoRA layers during training. |
| `bias` | `none` | Which biases to train. One of `none`, `all`, `lora_only`. `none` is standard for LoRA fine-tuning. |

### LoRA target modules

The `target_modules` field selects which projection matrices in the base model receive LoRA adapters. Module names must match the underlying transformer — these seven cover the standard attention + MLP projections present in Qwen 2/3, Llama 2/3, Mistral, and most decoder-only families.

| Module | Role |
|---|---|
| `q_proj` | Query projection (attention) |
| `k_proj` | Key projection (attention) |
| `v_proj` | Value projection (attention) |
| `o_proj` | Output projection (attention) |
| `gate_proj` | Gated MLP input |
| `up_proj` | MLP up-projection |
| `down_proj` | MLP down-projection |

Omitting `target_modules` applies LoRA to all seven (the full-coverage default). Common narrower choices:

```python
# Attention only — smaller adapter, faster, slightly less expressive
config = validator.TrainingConfig(
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
)

# Q/V only — minimal adapter footprint, often sufficient for stylistic tuning
config = validator.TrainingConfig(
    target_modules=["q_proj", "v_proj"],
)
```

> **Note** — architecture-aware validation (rejecting `target_modules` that don't exist on the chosen `base_model`) is not yet enforced. The schema validates membership in the allowed set; the trainer will fail at load time if a name is valid in the schema but absent on the model.

### Bounds

All numeric fields enforce sane bounds. The schema rejects requests outside these ranges before they leave your machine:

| Field | Min | Max |
|---|---|---|
| `lora_r` | 1 | 128 |
| `lora_alpha` | 1 | 256 |
| `lora_dropout` | 0.0 | 0.5 |
| `learning_rate` | > 0 | 0.01 |
| `num_train_epochs` | 1 | 10 |
| `max_steps` | 1 | 1,000,000 |
| `warmup_steps` | 0 | 10,000 |
| `weight_decay` | 0.0 | 1.0 |
| `seed` | 0 | 2³¹ − 1 |
| `logging_steps` | 1 | 10,000 |
| `max_seq_length` | 128 | 32,768 |
| `per_device_train_batch_size` | 1 | 64 |
| `gradient_accumulation_steps` | 1 | 256 |

---

## Inspecting the resolved config

After dispatch, retrieve the job to see exactly what the trainer will use. The `_profile` provenance key records which profile, if any, was applied.

```python
job = client.training.create(
    dataset_id=ds.id,
    base_model="unsloth/qwen2.5-1.5b-instruct-unsloth-bnb-4bit",
    framework="unsloth",
    config=validator.TrainingConfig(profile="laptop", max_steps=10),
)

resolved = client.training.retrieve(job.id).config
print(resolved)
```

Example resolved config from a laptop-profile dispatch:

```json
{
  "_profile": "laptop",
  "bias": "none",
  "gradient_accumulation_steps": 8,
  "learning_rate": 0.0002,
  "logging_steps": 50,
  "lora_alpha": 32,
  "lora_dropout": 0.0,
  "lora_r": 32,
  "lr_scheduler_type": "linear",
  "max_seq_length": 1024,
  "max_steps": 10,
  "num_train_epochs": 3,
  "optim": "adamw_8bit",
  "per_device_train_batch_size": 1,
  "seed": 3407,
  "warmup_steps": 2,
  "weight_decay": 0.01
}
```

---

## Retrieve

Fetch the current state of a training job. Use this to poll for completion or inspect the resolved config.

```python
job = client.training.retrieve(job_id="job_abc123")
print(job.status)
print(job.output_path)
print(job.metrics)
```

### Job status values

| Status | Meaning |
|---|---|
| `queued` | Job is in the Redis queue waiting for a GPU node to claim it. |
| `in_progress` | A node has claimed the job and training is running. |
| `cancelling` | A cancel request was issued for an in-progress job. The worker is unwinding the subprocess. |
| `cancelled` | Job was cancelled before completion. Partial artifacts are discarded. |
| `completed` | Training finished successfully. Adapter weights are at `output_path`. |
| `failed` | Training failed. Inspect `last_error` for the reason. |

### Live metrics

While a job is in progress the worker emits a `metrics` snapshot every `logging_steps` steps. The shape is:

```json
{
  "step": 6,
  "total_steps": 10,
  "loss": 0.9983,
  "learning_rate": 0.000125
}
```

`metrics` is `None` until the first emission lands. Use `wait_for_completion(on_progress=...)` to react to fresh snapshots automatically — see below.

---

## Wait for completion

Block until the job reaches a terminal state. Two optional callbacks:

- `on_progress(metrics)` fires only when a new metrics snapshot arrives (detected by a change in the `step` field). Use this for live training dynamics.
- `on_poll(job)` fires on every poll cycle, regardless of whether metrics changed. Use this as a heartbeat between metric emissions.

```python
def show_progress(m):
    step = m.get("step")
    total = m.get("total_steps")
    loss = m.get("loss")
    lr = m.get("learning_rate")
    print(f"  step={step}/{total} loss={loss} lr={lr}")

def heartbeat(j):
    print(f"  [{j.status.upper()}] output={j.output_path or '—'}")

final_job = client.training.wait_for_completion(
    job.id,
    on_progress=show_progress,
    on_poll=heartbeat,
    poll_interval=3.0,
)

if final_job.status == "completed":
    print(f"\n✨ Training complete — adapters at: {final_job.output_path}")
else:
    print(f"\n❌ Job ended with status: {final_job.status}")
    if final_job.last_error:
        print(f"   Error: {final_job.last_error}")
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `job_id` | `str` | — | Job to wait on. |
| `on_progress` | `callable` or `None` | `None` | Called with `metrics` dict when a new step lands. Exceptions are logged and swallowed — they will not break polling. |
| `on_poll` | `callable` or `None` | `None` | Called with the full `TrainingJobRead` on every poll tick. Same exception handling. |
| `poll_interval` | `float` | `10.0` | Seconds between polls. |
| `timeout` | `float` | `7200.0` | Raises `TimeoutError` if the job has not reached a terminal state in this many seconds. |

`wait_for_completion` does not raise on `failed` or `cancelled` — both are returned to the caller, since a failed job is often still interesting (`last_error`, partial `metrics`).

Example output from a short laptop-profile run:

```
🔥 Job job_Zmqvvx7I0Xe2VV7iXsngDH dispatched to cluster

⏳ Waiting for job to complete...

  [IN_PROGRESS] output=—
  [IN_PROGRESS] output=—
  step=2/10 loss=1.8275 lr=0.0001
  [IN_PROGRESS] output=—
  step=4/10 loss=1.3593 lr=0.000175
  [IN_PROGRESS] output=—
  step=6/10 loss=0.9983 lr=0.000125
  [IN_PROGRESS] output=—
  step=8/10 loss=0.7673 lr=7.5e-05
  [IN_PROGRESS] output=—
  step=10/10 loss=0.7548 lr=2.5e-05
  [IN_PROGRESS] output=—

✨ Training complete — adapters at: models/ftm_MkubiklMm9hs4TAl05mvkm
```

The heartbeat lines appear on every 3-second poll tick; progress lines appear only when a new `step` lands. On a laptop GPU with the `laptop` profile and 25 examples, expect 3–5 minutes from dispatch to completion.

---

## Cancel

Cancel a queued or in-progress training job. Idempotent — calling `cancel()` on a job in a terminal state returns the current status without error.

```python
result = client.training.cancel(job_id="job_abc123")
print(result.status)
print(result.message)
```

Cancellation behaviour by current status:

| Current status | Result |
|---|---|
| `queued` | Flips immediately to `cancelled`. The worker checks DB status when it claims the job and skips cancelled work. |
| `in_progress` | Flips to `cancelling` and signals the worker via Redis. The worker initiates a two-stage subprocess shutdown (SIGTERM → grace period → SIGKILL) and the job lands in `cancelled` when unwind completes — typically within 30 seconds. Poll `retrieve()` to observe the transition. |
| `cancelling` | Idempotent — cancel already in progress. |
| `cancelled` | Idempotent — already cancelled. |
| `completed` | Idempotent — nothing to cancel. |
| `failed` | Idempotent — nothing to cancel. |

Partial training artifacts are discarded on cancellation. The dataset is not affected.

---

## Peek queue

Inspect the Redis queue for pending jobs belonging to your user. Useful for confirming a job was enqueued before a node has claimed it.

```python
queue = client.training.peek_queue()
print(f"Total in queue: {queue.total_in_queue}")
for item in queue.data:
    print(f"  {item.job_id}")
```

This endpoint only returns jobs scoped to the authenticated user — it is not possible to observe other users' queue entries.

---

## After training completes

When the job reaches `completed`, the adapter weights are stored at the path shown in `output_path`. The fine-tuned model is not automatically activated for inference — it must be registered and deployed by an administrator.

The fine-tuned model ID is embedded in the `output_path`. In the example above:

```
output_path: models/ftm_MkubiklMm9hs4TAl05mvkm
```

The ID is `ftm_MkubiklMm9hs4TAl05mvkm` — keep this. You will need it when requesting activation.

**Hosted Project David** — email [engineering@projectdavid.co.uk](mailto:engineering@projectdavid.co.uk) with your fine-tuned model ID and request that it be activated on your account.

**Self-hosted deployment** — contact your cluster administrator with the same ID. They will register the adapter in the model registry and activate it for inference routing.

---

## Full end-to-end example

```python
import os
from projectdavid import Entity
from projectdavid_common import ValidationInterface

client = Entity(api_key=os.getenv("PROJECT_DAVID_API_KEY"))
validator = ValidationInterface()

# 1. Upload and register dataset
dataset = client.datasets.create(
    file_path="my_data.jsonl",
    name="My Fine-Tuning Dataset",
    fmt="sharegpt",
)
print(f"📦 Dataset ID: {dataset.id}")

# 2. Wait for preparation
ds = client.datasets.wait_until_ready(dataset.id)
print(f"✅ Dataset ready — {ds.train_samples} train / {ds.eval_samples} eval")

# 3. Dispatch training job
job = client.training.create(
    dataset_id=dataset.id,
    base_model="unsloth/qwen2.5-1.5b-instruct-unsloth-bnb-4bit",
    framework="unsloth",
    config=validator.TrainingConfig(
        profile="laptop",
        max_steps=10,
        learning_rate=2e-4,
    ),
)
print(f"🔥 Job {job.id} dispatched to cluster")

# 4. Wait for completion with live progress
def show_progress(m):
    print(f"  step={m.get('step')}/{m.get('total_steps')} "
          f"loss={m.get('loss')} lr={m.get('learning_rate')}")

def heartbeat(j):
    print(f"  [{j.status.upper()}] output={j.output_path or '—'}")

final_job = client.training.wait_for_completion(
    job.id,
    on_progress=show_progress,
    on_poll=heartbeat,
    poll_interval=3.0,
)

# 5. Report
if final_job.status == "completed":
    print(f"\n✨ Training complete — adapters at: {final_job.output_path}")
else:
    print(f"\n❌ Job ended with status: {final_job.status}")
    if final_job.last_error:
        print(f"   Error: {final_job.last_error}")
```