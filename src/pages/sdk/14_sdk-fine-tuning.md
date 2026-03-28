---
title: Fine-Tuning
category: sdk
slug: sdk-fine-tuning
nav_order: 3
---

# Fine-Tuning

## Overview

The ProjectDavid Fine-Tuning pipeline allows you to create custom-tailored models using your own data. The process involves three distinct stages: registering your dataset, preparing it for training, and executing the training job on a GPU-enabled worker.

---

[![Project David](https://raw.githubusercontent.com/project-david-ai/projectdavid_docs/master/src/assets/svg/projectdavid-forge.svg)](https://github.com/project-david-ai/projectdavid_docs)




### Full Pipeline Operation

```python
from projectdavid import Entity
import time

client = Entity()

# 1. Upload and Register a Dataset
# Supported formats: jsonl, chatml, alpaca, sharegpt
dataset = client.datasets.create(
    file_path="my_training_data.jsonl",
    name="Customer Support Dialect",
    fmt="jsonl",
    description="Fine-tuning Llama-3.2 for specific support tone."
)

# 2. Prepare the Dataset
# This triggers background validation and train/eval splitting.
client.datasets.prepare(dataset.id)

# Wait for 'active' status before proceeding
while True:
    dataset = client.datasets.retrieve(dataset.id)
    if dataset.status == "active":
        print("Dataset ready for training.")
        break
    time.sleep(2)

# 3. Submit a Training Job
# Choose a base model and framework (unsloth or axolotl).
job = client.training.create(
    dataset_id=dataset.id,
    base_model="unsloth/Llama-3.2-1B-Instruct",
    framework="unsloth",
    config={
        "learning_rate": 2e-4,
        "num_train_epochs": 3,
        "lora_r": 16
    }
)
print(f"Training job queued: {job.id}")

# 4. Monitor Job Progress
while True:
    job = client.training.retrieve(job.id)
    print(f"Current Status: {job.status}")
    if job.status in ["completed", "failed"]:
        break
    time.sleep(10)
```