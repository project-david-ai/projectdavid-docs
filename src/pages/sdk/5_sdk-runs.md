---
title: Runs
category: sdk
slug: sdk-runs
lifecycle_step: create_run
nav_order: 5
---

# Runs

A run represents a single execution of an assistant against a thread. Creating a run triggers the assistant to process the thread's messages and produce a response.

## Run lifecycle

| Status | Description |
|---|---|
| `queued` | Run created, waiting to start. |
| `in_progress` | Assistant is actively processing. |
| `completed` | Assistant finished successfully. |
| `requires_action` | Assistant is waiting for tool output. |
| `cancelled` | Run was successfully cancelled. |
| `cancelling` | Cancellation requested but not yet confirmed. |
| `failed` | Run failed. See `last_error` for details. |
| `expired` | Run exceeded its time limit. |
| `incomplete` | Run ended due to token limits. |

## Create a run

```python
from projectdavid import Entity

client = Entity()

run = client.runs.create_run(
    assistant_id="asst_abc123",
    thread_id="thread_abc123"
)

print(run.id)     # run_abc123
print(run.status) # queued
```

Optional parameters:

```python
run = client.runs.create_run(
    assistant_id="asst_abc123",
    thread_id="thread_abc123",
    model="gpt-4",
    instructions="Be concise.",
    temperature=0.7,
    top_p=1.0,
)
```

## Retrieve a run

```python
run = client.runs.retrieve_run(run_id="run_abc123")
print(run.status)
```

## Cancel a run

```python
run = client.runs.cancel_run(run_id="run_abc123")
print(run.status)  # cancelling
```

## List runs in a thread

```python
runs = client.runs.list_runs(
    thread_id="thread_abc123",
    limit=20,
    order="asc"
)

for run in runs.data:
    print(run.id, run.status)
```

## Delete a run

```python
result = client.runs.delete_run(run_id="run_abc123")
```


## Notes

- Runs expire after 1 hour by default.
- `temperature` and `top_p` can be set per-run to override assistant defaults.
- `model` defaults to `gpt-4` if not specified.