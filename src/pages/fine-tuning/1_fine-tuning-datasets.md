---
title: Datasets
category: fine-tuning
slug: fine-tuning-datasets
nav_order: 1
---

# Datasets

## Overview

A Dataset is a training file registered with the Sovereign Forge pipeline. Upload a `.jsonl` file, trigger background preparation to validate format and compute the train/eval split, then use the dataset ID when dispatching a training job.

Datasets are user-scoped — each user can only access their own records.

---

## Supported formats

Project David accepts datasets in **ShareGPT** or **ChatML** format. Both are handled transparently — the training pipeline normalises them at runtime.

**ShareGPT** (recommended):
```json
{"conversations": [{"from": "human", "value": "..."}, {"from": "gpt", "value": "..."}]}
```

**ChatML**:
```json
{"messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}
```

---

## What a dataset looks like

Each line in your `.jsonl` file is one training example — a complete conversation turn. The model learns by seeing many varied examples of the same domain. Repetitive or near-identical examples waste training budget; diverse, well-formed examples are what actually move the model.

Below is a representative extract showing the kind of variety a good dataset needs. Each example covers a different aspect of the same domain from a different angle:

```json
{"conversations": [{"from": "human", "value": "How do I create a new thread using the Project David SDK?"}, {"from": "gpt", "value": "Use `client.threads.create_thread()`. This returns a Thread object with an `id` field you pass to subsequent message and run calls.\n\n```python\nthread = client.threads.create_thread()\nprint(thread.id)\n```"}]}
{"conversations": [{"from": "human", "value": "What is the difference between a Run and an inference call?"}, {"from": "gpt", "value": "A Run ties an Assistant to a Thread and executes the full orchestration loop — tool calls, context assembly, streaming. A direct inference call bypasses all of that and hits the model endpoint directly. Use Runs for agentic workflows, inference calls for stateless one-shot completions."}]}
{"conversations": [{"from": "human", "value": "My run is stuck in 'requires_action' status. What does that mean?"}, {"from": "gpt", "value": "'requires_action' means the model has emitted a tool call and is waiting for your application to execute it and submit the result. Retrieve the run actions, execute each tool, then call `client.actions.submit_tool_output()` with the results to resume the run."}]}
{"conversations": [{"from": "human", "value": "How do I stream a response from an assistant?"}, {"from": "gpt", "value": "Use `SynchronousInferenceStream` from the SDK. Bind it to your run, then iterate the stream:\n\n```python\nstream = client.synchronous_inference_stream\nfor event in stream.run(thread_id=thread.id, assistant_id=assistant.id):\n    print(event.delta, end='', flush=True)\n```"}]}
{"conversations": [{"from": "human", "value": "Can I attach a file to a message?"}, {"from": "gpt", "value": "Yes. Upload the file first with `client.files.upload_file()`, then pass the returned file ID when creating the message. The assistant can reference the file during the run if the file_search tool is enabled."}]}
{"conversations": [{"from": "human", "value": "What happens if I call create_thread() twice — do I get two separate conversations?"}, {"from": "gpt", "value": "Yes. Each call to `create_thread()` creates an independent Thread with its own message history. There is no shared state between threads unless you explicitly pass context between them."}]}
{"conversations": [{"from": "human", "value": "How do I delete an assistant I no longer need?"}, {"from": "gpt", "value": "Call `client.assistants.delete_assistant(assistant_id=assistant.id)`. This removes the assistant record. Active runs on existing threads are not affected — they complete against the model configuration captured at run creation time."}]}
{"conversations": [{"from": "human", "value": "What model strings does Project David accept?"}, {"from": "gpt", "value": "Project David accepts any model identifier supported by your configured inference providers — Hyperbolic, TogetherAI, Ollama, or a local vLLM endpoint. Pass the provider's model string directly, for example `'meta-llama/Llama-3.3-70B-Instruct-Turbo'` for TogetherAI or `'llama3.1'` for Ollama."}]}
```

Notice the variety: how-to questions, conceptual distinctions, error states, code examples, edge cases, and administrative operations. A model trained on eight near-identical "how do I create X" examples learns almost nothing new after the first two.

---

## Sample size guidelines

LoRA only updates a small fraction of the model's weights — on Qwen2.5-1.5B that is roughly 1.2% of parameters. This makes it fast and VRAM-efficient, but it also means the model has limited capacity to absorb noisy or redundant data. Quality dominates quantity.

| Examples | What to expect |
|---|---|
| 25–50 | Pipeline verification only. The model will overfit the training set and generalise poorly. Use this to confirm the pipeline runs end to end, not to produce a usable adapter. |
| 100–200 | Noticeable domain shift for narrow, well-defined tasks. Suitable for a first meaningful experiment. |
| 500–1,000 | Solid fine-tune for a clearly scoped domain. Recommended starting point for production use. |
| 2,000–5,000 | Strong generalisation within the domain. Worthwhile when the domain is broad or terminology is highly specialised. |
| 5,000+ | Diminishing returns on a 1.5B parameter model. Consider a larger base model before investing in more data. |

The quickstart dataset in this documentation uses 25 examples — enough to verify the full pipeline on a laptop GPU in under two minutes. For anything beyond verification, start at 200 and evaluate before investing in more data collection.

---

## Create

Upload a `.jsonl` file and register it with the training service. The file is staged to the shared Samba hub. Returns a `DatasetRead` object containing the dataset ID.

```python
from projectdavid import Entity

client = Entity()

dataset = client.datasets.create(
    file_path="my_data.jsonl",
    name="Specialized Knowledge Base",
    fmt="jsonl",
    description="Domain-specific Q&A pairs for fine-tuning.",
)
print(f"Dataset ID: {dataset.id}")
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `file_path` | `str` | ✅ | Local path to the `.jsonl` file. |
| `name` | `str` | ✅ | Human-readable name for the dataset record. |
| `fmt` | `str` | ✅ | File format — currently `"jsonl"`. |
| `description` | `str` or `None` | — | Optional description stored on the record. |

---

## Prepare

Trigger background validation and train/eval split computation. The dataset transitions through `pending` → `active` (or `failed`). Poll `retrieve` until the status is `active` before dispatching a training job.

```python
client.datasets.prepare(dataset.id)
```

Poll until ready:

```python
import time

client.datasets.prepare(dataset.id)

while True:
    ds = client.datasets.retrieve(dataset_id=dataset.id)
    print(f"Status: {ds.status}")
    if ds.status == "active":
        print(f"✅ Ready — {ds.train_samples} train / {ds.eval_samples} eval samples")
        break
    if ds.status == "failed":
        raise Exception(f"Preparation failed: {ds}")
    time.sleep(3)
```

---

## Retrieve

Fetch a single dataset record by ID.

```python
ds = client.datasets.retrieve(dataset_id="ds_abc123")
print(ds.status)
print(ds.train_samples)
print(ds.eval_samples)
```

---

## List

Return all datasets for the current user. Optionally filter by status.

```python
# All datasets
datasets = client.datasets.list()

# Only active datasets
datasets = client.datasets.list(status="active")

for ds in datasets.data:
    print(f"{ds.id}  {ds.status}  {ds.name}")
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `status` | `str` or `None` | `None` | Filter by status: `pending`, `active`, `failed`. |
| `limit` | `int` | `50` | Maximum records to return. |

---

## Delete

Soft-delete a dataset. The record is marked deleted and excluded from future queries. The staged file on the Samba hub is not immediately removed.

```python
client.datasets.delete(dataset_id="ds_abc123")
```

---

## Dataset lifecycle

```
create → pending → [prepare] → active → [training job dispatched]
                             ↘ failed
```

A dataset in `failed` status cannot be used for training. Create a new dataset with a corrected file.

---

## Full end-to-end example

```python
import time
from projectdavid import Entity

client = Entity()

# 1. Upload and register
dataset = client.datasets.create(
    file_path="my_data.jsonl",
    name="My Fine-Tuning Dataset",
    fmt="jsonl",
)
print(f"📦 Dataset ID: {dataset.id}")

# 2. Prepare and poll
client.datasets.prepare(dataset.id)

while True:
    ds = client.datasets.retrieve(dataset_id=dataset.id)
    print(f"Status: {ds.status}")
    if ds.status == "active":
        print(f"✅ Ready — {ds.train_samples} train / {ds.eval_samples} eval")
        break
    if ds.status == "failed":
        raise Exception(f"Preparation failed: {ds}")
    time.sleep(3)

# 3. Dispatch training job (see Training Jobs)
job = client.training.create(
    dataset_id=dataset.id,
    base_model="unsloth/qwen2.5-1.5b-instruct-unsloth-bnb-4bit",
    framework="unsloth",
    config={"learning_rate": 2e-4, "num_train_epochs": 1, "lora_r": 16},
)
print(f"🔥 Job {job.id} dispatched to cluster")
```