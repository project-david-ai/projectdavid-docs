---
title: Runs
category: sdk
slug: sdk-runs
lifecycle_step: create_run
nav_order: 5
---

# Runs

A Run records an individual execution of an Assistant against a Thread.
Creating a Run queues the execution record; it does not start model inference.
Start inference separately using the Run's ID and resolved model.

## Configure

Complete [Authentication](/docs/api_keys), create an [Assistant](/docs/sdk-assistants)
and a [Thread](/docs/sdk-threads), and add a user [Message](/docs/sdk-messages).
Set `PROJECTDAVID_ASSISTANT_ID` and `PROJECTDAVID_THREAD_ID` to the resource IDs.
Use the same authenticated account and keep the examples in the same Python or
Bash session. The cURL examples require `jq` and `uuidgen`.

```python interface=python
import os

from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv()

client = Entity(
    base_url=os.getenv("PROJECTDAVID_BASE_URL", "https://api.projectdavid.co.uk"),
    api_key=os.environ["PROJECTDAVID_API_KEY"],
)

assistant_id = os.environ["PROJECTDAVID_ASSISTANT_ID"]
thread_id = os.environ["PROJECTDAVID_THREAD_ID"]
```

```bash interface=curl
BASE_URL="${PROJECTDAVID_BASE_URL:-https://api.projectdavid.co.uk}"
ASSISTANT_ID="${PROJECTDAVID_ASSISTANT_ID:?Set the assistant ID}"
THREAD_ID="${PROJECTDAVID_THREAD_ID:?Set the thread ID}"
set -o pipefail
```

## Create a run

```python interface=python
run = client.runs.create_run(
    assistant_id=assistant_id,
    thread_id=thread_id,
    temperature=0.7,
    top_p=0.9,
)

run_id = run.id
print(run_id, run.model, run.status)
```

```curl interface=curl
NOW=$(date +%s)
RUN=$(jq -n \
  --arg id "run_$(uuidgen | tr -d '-')" \
  --arg assistant "$ASSISTANT_ID" --arg thread "$THREAD_ID" \
  --argjson now "$NOW" --argjson expires "$((NOW + 3600))" \
  '{id:$id,assistant_id:$assistant,thread_id:$thread,
    instructions:"",created_at:$now,expires_at:$expires,
    temperature:0.7,top_p:0.9}' \
  | curl -fsS "$BASE_URL/v1/runs" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" \
      -H 'Content-Type: application/json' \
      --data-binary @-)

RUN_ID=$(jq -er '.id' <<< "$RUN")
jq '{id,model,status}' <<< "$RUN"
```

Core assigns the Run ID, ownership, creation time and initial `queued` status.
The HTTP request schema requires an ID and timestamps, even though Core assigns
its own values. Always use the returned ID and timestamps.

A Thread can have only one non-terminal Run at a time. Creating another Run
on that Thread returns HTTP 409 until the existing Run reaches a terminal state.
Different Threads can execute independently.

## Run configuration

| Field | Behaviour |
|---|---|
| `model` | Omit to inherit the Assistant model; a non-blank override selects another model. |
| `instructions` | Non-empty instructions replace the Assistant instructions for this Run. |
| `temperature` | Run sampling parameter. |
| `top_p` | Run nucleus sampling parameter. |
| `meta_data` | Application-defined metadata stored on the Run. |

Set sampling parameters explicitly when equivalent behaviour across interfaces
is required. The SDK defaults to `temperature=1.0` and `top_p=1.0`, while the
HTTP request schema defaults to `0.7` and `0.9` respectively. Omitting them does
not guarantee inheritance from the Assistant.

Core resolves the model when creating the Run. Use the returned `run.model`
(or the HTTP response's `model` field) when starting inference. Changing the
Assistant's model later does not change that stored selection.

## Start inference

Pass the Run ID, Assistant ID, Thread ID, user Message ID and applicable
provider credential to the inference interface. Follow the
[Quick Start](/docs/sdk-quick-start) for the complete streaming workflow.

Create a new Message and Run for each subsequent user interaction. Reuse the
Assistant and Thread after the preceding Run has finished.

## Retrieve a run

```python interface=python
run = client.runs.retrieve_run(run_id=run_id)
print(run.status, run.last_error)
```

```curl interface=curl
curl -fsS "$BASE_URL/v1/runs/$RUN_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY"
```

The Run record exposes its execution status, timestamps, error information
and associated actions when available.

## Run lifecycle

| Status | Meaning |
|---|---|
| `queued` | Run created and awaiting execution. |
| `in_progress` | Execution underway. |
| `action_required` | Execution requires an action. |
| `pending`, `processing`, `retrying` | Other non-terminal execution states. |
| `completed` | Execution finished successfully. |
| `failed` | Execution failed; inspect `last_error` when available. |
| `cancelled` | Run cancelled. |
| `expired` | Run marked as expired. |

The terminal states are `completed`, `failed`, `cancelled` and `expired`.
Core sets an initial expiry timestamp one hour after creation. The timestamp
alone does not establish that execution will terminate precisely at that time.

## List runs

Retrieve recent executions for a Thread.

```python interface=python
runs = client.runs.list_runs(
    thread_id=thread_id,
    limit=20,
    order="desc",
)

for item in runs.data:
    print(item.id, item.status)
```

```curl interface=curl
curl -fsS "$BASE_URL/v1/threads/$THREAD_ID/runs?limit=20&order=desc" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY"
```

To inspect recent Runs across the authenticated account:

```python interface=python
runs = client.runs.list_all_runs(limit=20, order="desc")

for item in runs.data:
    print(item.id, item.thread_id, item.status)
```

```curl interface=curl
curl -fsS "$BASE_URL/v1/runs?limit=20&order=desc" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY"
```

Both operations accept a limit from 1 to 100 and ascending or descending
creation-time ordering. The response contains `data`, `first_id`, `last_id`
and `has_more`. These two endpoints do not accept a continuation cursor.

## Cancel a run

Only cancel a Run you intend to stop, while it is still non-terminal.

```python interface=python
run = client.runs.cancel_run(run_id=run_id)
print(run.status)
```

```curl interface=curl
curl -fsS -X POST "$BASE_URL/v1/runs/$RUN_ID/cancel" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY"
```

Successful cancellation records the `cancelled` state. Cancelling an already
terminal Run returns HTTP 400. Cancellation does not imply that previously
executed external tool effects have been reversed.

## Reference

- [Runs reference](/docs/sdk-reference-runs)
- [Streaming reference](/docs/sdk-reference-streaming)
- [Execution accounting](/docs/sdk-reference-execution-accounting)
- [HTTP API reference](/docs/api-reference)
