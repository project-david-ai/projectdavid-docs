---
title: Scratch Pad
category: sdk
slug: sdk-scratch-pad
nav_order: 8
---

# /Scratch Pad

The `scratch_pad` platform tool provides the assistant with shared working memory for planning, coordination, and research state during an inference run.

It is particularly useful for Deep Research and multi-agent workflows, where a supervisor and delegated workers need to read and update the same working state.

The platform tool exposes three model-facing operations:

```text
read_scratchpad
update_scratchpad
append_scratchpad
```

These are runtime tools. They are distinct from the first-class `ScratchpadsClient` resource API, which allows an SDK consumer to directly manage canonical Scratchpad resources.

```python
import os

from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv()

# ------------------------------------------------------------------
# 0. SDK init + env
# ------------------------------------------------------------------

client = Entity(
    api_key=os.getenv("PROJECTDAVID_API_KEY"),
)


# ------------------------------------------------------------------
# 1. Insert scratch_pad into your assistant's tools definition
#    by using its placeholder definition in the tools array.
#    The full tool definitions are orchestrated at runtime.
# ------------------------------------------------------------------

assistant = client.assistants.create_assistant(
    name="test_assistant",
    model="gpt-oss-120b",
    instructions=(
        "You are a helpful AI assistant. "
        "Use the scratchpad to maintain your working plan and verified findings."
    ),
    tools=[
        {"type": "scratch_pad"},
    ],
)

print(assistant.id)
```

## Runtime Tools

When `scratch_pad` is enabled on an assistant, the runtime makes the following tool operations available to the model.

### `read_scratchpad`

Reads the current shared Scratchpad state.

Conceptually:

```text
read_scratchpad()
```

The tool is used when the assistant needs to inspect the current working plan, previously recorded findings, coordination markers, or entries written by another agent.

Typical uses include:

```text
- Recover the current research strategy
- Inspect previously verified findings
- Read state written by a supervisor
- Read state written by a delegated worker
- Coordinate dependent worker tasks
```

In a multi-agent Deep Research workflow, delegated workers can read the same Scratchpad used by the supervisor.

---

### `update_scratchpad`

Replaces or updates the Scratchpad's current working body.

Conceptually:

```text
update_scratchpad(content)
```

This is typically used for larger state transitions such as establishing or revising the active research strategy.

For example:

```text
📌 [STRATEGY]

Goal:
Verify two technical claims from primary sources.

Sequence:
1. Research source A
2. Record verified result
3. Delegate source B
4. Compare findings
```

`update_scratchpad` is appropriate when the assistant needs to rewrite the current working state rather than add a discrete entry.

---

### `append_scratchpad`

Appends a new entry to the Scratchpad without replacing the existing working state.

Conceptually:

```text
append_scratchpad(entry)
```

This is useful for incremental findings and coordination records.

For example:

```text
✅ [VERIFIED] Python virtual environments are created with:

python -m venv <directory>

Source:
https://docs.python.org/3/library/venv.html
```

or:

```text
🔄 [PENDING] Worker B assigned HTTP server documentation verification.
```

Typical uses include:

```text
- Verified research findings
- Pending tasks
- Worker claims
- Source URLs
- Cross-agent coordination markers
- Warnings and dead ends
```

---

## Shared Multi-Agent State

The Scratch Pad is shared across the relevant research workflow.

A supervisor can write state:

```text
Supervisor
    │
    └── update_scratchpad(...)
```

A delegated worker can then read it:

```text
Worker A
    │
    └── read_scratchpad()
```

and append its result:

```text
Worker A
    │
    └── append_scratchpad(...)
```

The supervisor can subsequently observe that worker-written state:

```text
Supervisor
    │
    └── read_scratchpad()
```

A second worker can also read the accumulated state:

```text
Worker B
    │
    └── read_scratchpad()
```

This enables coordination through shared working memory without requiring the
supervisor to copy the Scratchpad contents into each delegated worker prompt.

A typical Deep Research flow therefore looks like:

```text
Supervisor
    │
    ├── update_scratchpad(strategy)
    │
    ├── delegate Worker A
    │       │
    │       ├── read_scratchpad()
    │       ├── research
    │       └── append_scratchpad(result)
    │
    ├── read_scratchpad()
    │
    ├── delegate Worker B
    │       │
    │       ├── read_scratchpad()
    │       ├── research
    │       └── append_scratchpad(result)
    │
    └── read_scratchpad()
```

---

## Streaming

Scratch Pad activity is exposed as a first-class streaming event.

The SDK deserializes these events as:

```python
ScratchpadEvent
```

The wire type is:

```text
scratchpad_status
```

A Scratchpad operation normally emits lifecycle events as it progresses.

### Operation Started

For example, when the assistant begins reading the Scratchpad:

```json
{
  "type": "scratchpad_status",
  "run_id": "run_abc123",
  "operation": "read",
  "state": "in_progress",
  "activity": "📖 Reading scratchpad (asst_abc123)...",
  "tool": "read_scratchpad",
  "entry": null,
  "content": null,
  "assistant_id": "asst_abc123"
}
```

### Successful Read

The resulting Scratchpad content is then emitted:

```json
{
  "type": "scratchpad_status",
  "run_id": "run_abc123",
  "operation": "read",
  "state": "success",
  "activity": null,
  "tool": null,
  "entry": "--- 📝 RESEARCH SCRATCHPAD ---\n\nWORKING BODY\n------------\n...",
  "content": null,
  "assistant_id": "asst_abc123"
}
```

### Operation Completed

The lifecycle concludes with:

```json
{
  "type": "scratchpad_status",
  "run_id": "run_abc123",
  "operation": "read",
  "state": "completed",
  "activity": "📖 Scratchpad read by asst_abc123.",
  "tool": "read_scratchpad",
  "entry": null,
  "content": null,
  "assistant_id": "asst_abc123"
}
```

The same lifecycle applies to:

```text
read
update
append
```

---

## `ScratchpadEvent`

The SDK representation is:

```python
@dataclass
class ScratchpadEvent(StreamEvent):
    operation: str
    state: str
    activity: Optional[str] = None
    tool: Optional[str] = None
    entry: Optional[str] = None
    content: Optional[str] = None
    assistant_id: Optional[str] = None
```

The corresponding stream fields are:

| Field | Type | Description |
|---|---|---|
| `run_id` | string | Parent inference run ID |
| `operation` | string | `read`, `update`, or `append` |
| `state` | string | Lifecycle state |
| `activity` | string/null | Human-readable activity description |
| `tool` | string/null | Runtime Scratchpad tool |
| `entry` | string/null | Scratchpad data returned or written |
| `content` | string/null | Additional content when supplied |
| `assistant_id` | string/null | Assistant that performed the operation |

Typical states are:

```text
in_progress
success
completed
error
```

---

## Delegated Worker Streaming

Delegated research workers run inside Core using their own internal Project David SDK stream.

Without a relay, Scratchpad events produced by those workers would only be visible to that internal worker stream.

`DelegationMixin` therefore intercepts worker `ScratchpadEvent` objects and relays them back onto the parent inference stream.

Conceptually:

```text
External SDK
    │
    ▼
Supervisor stream
    │
    ▼
DelegationMixin
    │
    ▼
Worker SDK stream
    │
    └── ScratchpadEvent
             │
             ▼
       DelegationMixin
             │
             └── relay as scratchpad_status
                        │
                        ▼
                  Parent stream
                        │
                        ▼
                  External SDK
```

This means the external SDK can observe both supervisor and worker Scratchpad activity through the same inference stream.

For example:

```json
{
  "type": "scratchpad_status",
  "run_id": "run_parent_abc123",
  "operation": "append",
  "state": "success",
  "entry": "✅ [VERIFIED] Worker A completed source verification.",
  "assistant_id": "asst_worker_xyz"
}
```

The event carries the **parent run ID**, while `assistant_id` identifies the actual worker that performed the Scratchpad operation.

This allows consumers to display a single coherent research stream while still distinguishing which agent accessed or modified shared memory.

---

## Scratchpad Entry Conventions

Deep Research commonly uses structured prefixes for Scratchpad entries.

```text
📌  Strategy / goal
✅  Completed or verified result
🔄  Pending or revised work
❓  Open question
⚠️  Warning or issue
☠️  Dead end / abort
```

For example:

```text
📌 [STRATEGY]
Verify the Python venv command using official documentation.
```

```text
🔄 [PENDING]
Worker A researching the Python virtual environment command.
```

```text
✅ [VERIFIED]
python -m venv tutorial-env

Source:
https://docs.python.org/3/tutorial/venv.html
```

These prefixes are conventions used by the research runtime and can also be used
by frontend consumers as secondary presentation hints.

---

## Frontend Routing

`scratchpad_status` is a first-class event type.

Consumers should route it directly to the Scratchpad or research activity UI.

It should **not** be displayed as normal assistant chat content.

Recommended routing:

```text
scratchpad_status
    │
    └── Scratchpad UI / Deep Research activity view

content
    │
    └── Assistant chat response
```

For example:

```python
if isinstance(event, ScratchpadEvent):
    render_scratchpad_event(event)
    return
```

Consumers should use the explicit `assistant_id` field when they need to identify
which agent performed the operation.

Do not attempt to extract the assistant ID from the human-readable `activity`
string.

---

## Scratch Pad vs ScratchpadsClient

The platform tool and resource client serve different layers.

| Interface | Purpose |
|---|---|
| `{"type": "scratch_pad"}` | Enables model-facing Scratchpad tools at runtime |
| `read_scratchpad` | Model reads shared working memory |
| `update_scratchpad` | Model replaces/revises current working state |
| `append_scratchpad` | Model appends a working-memory entry |
| `ScratchpadsClient` | Application-facing canonical Scratchpad resource API |

The platform tool is intended for assistant/runtime orchestration.

The SDK resource client is intended for direct application access to Scratchpad resources.

They share the same Scratchpad domain but should not be treated as interchangeable APIs.