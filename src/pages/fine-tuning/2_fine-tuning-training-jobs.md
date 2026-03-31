---
title: Training Jobs
category: fine-tuning
slug: fine-tuning-training-jobs
nav_order: 2
---

# Training Jobs

## Overview

A Training Job dispatches a fine-tuning run to the Sovereign Forge cluster. The cluster schedules the job across available GPU nodes via Ray, runs Unsloth LoRA training against your prepared dataset, and writes the resulting adapter weights to the shared Samba hub.

Jobs are user-scoped. The training pipeline runs asynchronously — dispatch returns immediately and you poll for status.

---

## Create

Submit a training job against a prepared dataset. Returns a `TrainingJobRead` object with the job ID you use to track progress.

```python
from projectdavid import Entity

client = Entity()

job = client.training.create(
    dataset_id="ds_abc123",
    base_model="unsloth/qwen2.5-1.5b-instruct-unsloth-bnb-4bit",
    framework="unsloth",
    config={
        "learning_rate": 2e-4,
        "num_train_epochs": 1,
        "lora_r": 16,
    },
)
print(f"Job ID: {job.id}")
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `dataset_id` | `str` | ✅ | ID of an `active` dataset. Preparation must be complete before dispatch. |
| `base_model` | `str` | ✅ | HuggingFace model identifier. Must already be present in the node's HuggingFace cache — the cluster will not trigger a remote download. |
| `framework` | `str` | — | Training backend. Currently `"unsloth"`. Defaults to `"unsloth"`. |
| `config` | `dict` or `None` | — | Training hyperparameters. See config reference below. |

### Config reference

| Key | Type | Default | Description |
|---|---|---|---|
| `learning_rate` | `float` | `2e-4` | AdamW learning rate. |
| `num_train_epochs` | `int` | `1` | Number of passes over the dataset. Ignored when `max_steps` is set by the server profile. |
| `lora_r` | `int` | `16` | LoRA rank. Higher values increase adapter capacity and VRAM usage. |

> **Note on base models** — the cluster will not pull models from HuggingFace at job time. The model must already exist in the node's HuggingFace cache (`HF_CACHE_PATH`). Attempting to use an uncached model will cause the job to fail at the training subprocess stage. Contact your cluster operator to confirm which models are available, or use the registry client to list registered base models.

---

## Retrieve

Fetch the current state of a training job. Use this to poll for completion.

```python
job = client.training.retrieve(job_id="job_abc123")
print(job.status)
print(job.output_path)
```

### Job status values

| Status | Meaning |
|---|---|
| `pending` | Job is queued in Redis waiting for a GPU node to claim it. |
| `in_progress` | A node has claimed the job and training is running. |
| `completed` | Training finished successfully. Adapter weights are at `output_path`. |
| `failed` | Training failed. Check `last_error` for the failure reason. |
| `cancelled` | Job was cancelled before a node claimed it. |

### Polling for completion

```python
import time

TERMINAL_STATES = {"completed", "failed", "cancelled"}

while True:
    job = client.training.retrieve(job_id=job.id)

    print(
        f"  [{job.status.upper()}] "
        f"started={job.started_at or '—'} "
        f"output={job.output_path or '—'}"
    )

    if job.status in TERMINAL_STATES:
        if job.status == "completed":
            print(f"\n✨ Training complete — adapters at: {job.output_path}")
        else:
            print(f"\n❌ Job ended with status: {job.status}")
            if hasattr(job, "last_error") and job.last_error:
                print(f"   Error: {job.last_error}")
        break

    time.sleep(10)
```

Expected output:

```
🔥 Job job_S7pyp24zDkbZ6JWx2aYUNt dispatched to cluster

⏳ Polling job status...

  [PENDING] started=— output=—
  [IN_PROGRESS] started=1774914730 output=—
  [IN_PROGRESS] started=1774914730 output=—
  [IN_PROGRESS] started=1774914730 output=—
  [COMPLETED] started=1774914730 output=models/ftm_6jDonYJbYQYLwTTfXKirma

✨ Training complete — adapters at: models/ftm_6jDonYJbYQYLwTTfXKirma
```

The `IN_PROGRESS` lines repeat on each 10-second poll tick while training runs. On a laptop GPU with the `laptop` profile and 25 examples, expect 3–5 minutes of `IN_PROGRESS` ticks before completion.

---

## After training completes

When the job reaches `completed` the adapter weights are stored at the path shown in `output_path`. The model is not automatically activated for inference — it must be registered and deployed by an administrator.

The fine-tuned model ID is embedded in the `output_path`. In the example above:
```
output_path: models/ftm_6jDonYJbYQYLwTTfXKirma
```

The ID is `ftm_6jDonYJbYQYLwTTfXKirma` — keep this, you will need it when requesting activation.

**Hosted Project David** — email [engineering@projectdavid.co.uk](mailto:engineering@projectdavid.co.uk) with your fine-tuned model ID (e.g. `ftm_6jDonYJbYQYLwTTfXKirma`) and request that it be activated on your account.

**Self-hosted deployment** — contact your cluster administrator with the same ID. They will register the adapter in the model registry and activate it for inference routing.
---

## Peek queue

Inspect the current Redis queue for pending jobs belonging to your user. Useful for confirming a job was enqueued before a node has claimed it.

```python
queue = client.training.peek_queue()
for item in queue.jobs:
    print(f"{item.job_id}  queued_at={item.queued_at}")
```

This endpoint only returns jobs scoped to the authenticated user — it is not possible to observe other users' queue entries.

---

## Training profiles

The cluster applies a hardware profile at training time based on the `TRAINING_PROFILE` environment variable set on the worker node. The profile controls sequence length, batch size, and optimizer choice. Individual job configs are applied on top of the profile defaults.

| Profile | Sequence length | Batch size | Optimizer | Target hardware |
|---|---|---|---|---|
| `laptop` | 1024 | 1 (8 accumulation steps) | `adamw_8bit` | RTX 3060 class and below |
| `standard` | 2048 | 2 (4 accumulation steps) | `adamw_8bit` | RTX 3080 / 4070 class |

The profile is set by the cluster operator, not the user. If you are operating your own node, set `TRAINING_PROFILE` in your `.env` before starting the training stack.

---

## Full end-to-end example

```python
import time
from projectdavid import Entity

client = Entity()

# 1. Upload and register dataset
dataset = client.datasets.create(
    file_path="my_data.jsonl",
    name="My Fine-Tuning Dataset",
    fmt="jsonl",
)
print(f"📦 Dataset ID: {dataset.id}")

# 2. Prepare and poll until active
client.datasets.prepare(dataset.id)

while True:
    ds = client.datasets.retrieve(dataset_id=dataset.id)
    print(f"Dataset status: {ds.status}")
    if ds.status == "active":
        print(f"✅ Ready — {ds.train_samples} train / {ds.eval_samples} eval")
        break
    if ds.status == "failed":
        raise Exception(f"Preparation failed: {ds}")
    time.sleep(3)

# 3. Dispatch training job
job = client.training.create(
    dataset_id=dataset.id,
    base_model="unsloth/qwen2.5-1.5b-instruct-unsloth-bnb-4bit",
    framework="unsloth",
    config={"learning_rate": 2e-4, "num_train_epochs": 1, "lora_r": 16},
)
print(f"🔥 Job {job.id} dispatched to cluster")

# 4. Poll for completion
print("\n⏳ Polling job status...\n")

TERMINAL_STATES = {"completed", "failed", "cancelled"}

while True:
    job = client.training.retrieve(job_id=job.id)

    print(
        f"  [{job.status.upper()}] "
        f"started={job.started_at or '—'} "
        f"output={job.output_path or '—'}"
    )

    if job.status in TERMINAL_STATES:
        if job.status == "completed":
            print(f"\n✨ Training complete — adapters at: {job.output_path}")
        else:
            print(f"\n❌ Job ended with status: {job.status}")
            if hasattr(job, "last_error") and job.last_error:
                print(f"   Error: {job.last_error}")
        break

    time.sleep(10)
```