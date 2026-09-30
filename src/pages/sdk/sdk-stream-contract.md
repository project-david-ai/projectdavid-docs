---
title: Stream Contract
category: sdk
slug: sdk-stream-contract
nav_order: 16
---

# Event Contract — Streaming Protocol

This document defines the event types emitted by the platform over the streaming
response channel. It is the authoritative reference for SDK consumers and frontend
integrators. Both sides — backend emitter and frontend consumer — are bound by the
shapes described here.

---

## Transport

Events are delivered as a **newline-delimited JSON stream** (NDJSON). Each line is
a self-contained JSON object. Consumers must parse line-by-line and must tolerate
blank lines, which should be skipped silently.

Some clients may receive pre-parsed objects directly (e.g. via the SDK's async
iterator). In that case the line-splitting and JSON parsing step is handled by
the SDK and consumers receive plain objects.

---

## Envelope

Every event has at minimum:

```json
{
  "type": "<event_type>",
  "run_id": "<uuid>"
}
```

| Field    | Type   | Required | Description                                 |
|----------|--------|----------|---------------------------------------------|
| `type`   | string | yes      | Discriminator field. See event types below. |
| `run_id` | string | yes      | Identifies the active inference run.        |

All other fields are type-specific and documented per event below.

---

## Event Types

### `content`

A chunk of assistant response text. Consumers should concatenate these in order
to build the final message.

```json
{
  "type": "content",
  "run_id": "abc123",
  "content": "Here is the answer to your question..."
}
```

| Field     | Type   | Description              |
|-----------|--------|--------------------------|
| `content` | string | Partial or full text chunk. |

> **Note:** Some `content` events carry internal status labels from backend mixins.
> These are implementation bleed and should be filtered by the consumer.
> See [Scratchpad Bleed Filter](#scratchpad-bleed-filter).

---

### `reasoning`

Internal chain-of-thought text produced before the final response. Consumers may
display this in a collapsed or secondary UI element.

```json
{
  "type": "reasoning",
  "run_id": "abc123",
  "content": "The user is asking about..."
}
```

| Field     | Type   | Description        |
|-----------|--------|--------------------|
| `content` | string | Reasoning text chunk. |

---

### `status`

A lifecycle or tool progress event. Used to drive status indicators in the UI.

```json
{
  "type": "status",
  "run_id": "abc123",
  "status": "started",
  "tool": "perform_web_search",
  "message": "Querying search engine..."
}
```

| Field     | Type   | Required | Description                                              |
|-----------|--------|----------|----------------------------------------------------------|
| `status`  | string | yes      | See [Status Values](#status-values).                     |
| `tool`    | string | no       | Tool name if this event is tool-scoped.                  |
| `message` | string | no       | Human-readable description of the current operation.     |

#### Status Values

| Backend value        | Normalized UI value | Meaning                        |
|----------------------|---------------------|--------------------------------|
| `started`            | `in_progress`       | Operation has begun.           |
| `running`            | `in_progress`       | Operation is ongoing.          |
| `complete`           | `success`           | Operation finished cleanly.    |
| `completed`          | `success`           | Operation finished cleanly.    |
| `done`               | `success`           | Operation finished cleanly.    |
| `failed`             | `error`             | Operation failed.              |
| `error`              | `error`             | Operation failed.              |
| `inference_complete` | `success`           | Full run is complete.          |

---

### `web_status`

A first-class lifecycle event emitted by web research tools.

The SDK deserializes this event as `WebStatusEvent`. It is emitted for web tools
including:

- `perform_web_search`
- `read_web_page`
- `search_web_page`
- `scroll_web_page`

```json
{
  "type": "web_status",
  "run_id": "abc123",
  "status": "running",
  "tool": "read_web_page",
  "message": "Reading: https://example.com/..."
}
```

| Field     | Type   | Required | Description                                          |
|-----------|--------|----------|------------------------------------------------------|
| `status`  | string | yes      | Web tool lifecycle state.                            |
| `tool`    | string | no       | Web tool responsible for the event.                  |
| `message` | string | no       | Human-readable description of the current operation. |

Observed lifecycle values include:

| Value     | Meaning                                                  |
|-----------|----------------------------------------------------------|
| `running` | Web operation is in progress.                            |
| `success` | Operation completed successfully.                        |
| `warning` | Recoverable web/tool condition occurred.                 |
| `error`   | Web operation encountered an error.                      |

A `warning` or individual web-tool `error` does not by itself necessarily mean
the entire inference or delegated research task has failed. Research workers may
recover by using another query, source, or tool path.

Consumers should route `web_status` directly to the web-search status UI. It
must not be rendered as assistant chat content.

---

### `activity`

A higher-level orchestration event describing agent or tool activity. Used to
drive the deep research / activity status component.

```json
{
  "type": "activity",
  "run_id": "abc123",
  "tool": "delegate_to_worker",
  "state": "in_progress",
  "activity": "Delegating research task to worker agent..."
}
```

| Field      | Type   | Required | Description                                          |
|------------|--------|----------|------------------------------------------------------|
| `tool`     | string | yes      | Name of the tool or agent component.                 |
| `state`    | string | yes      | Same vocabulary as [Status Values](#status-values).  |
| `activity` | string | no       | Human-readable description of the activity.          |

---

### `scratchpad_status`

An update to the agent's internal scratchpad / working memory. Consumers should
route these exclusively to the scratchpad UI component — never to the chat bubble.

```json
{
  "type": "scratchpad_status",
  "run_id": "abc123",
  "operation": "append",
  "state": "success",
  "tool": "append_scratchpad",
  "activity": "📝 Appending to scratchpad (asst_abc123)...",
  "entry": "📌 GOAL: Find Q3 revenue figures\nENTITIES: Acme Corp\nTOOL CHAIN: perform_web_search → read_web_page",
  "assistant_id": "asst_abc123"
}
```

| Field          | Type   | Required | Description                                                    |
|----------------|--------|----------|----------------------------------------------------------------|
| `operation`    | string | yes      | One of `read`, `append`, `update`.                             |
| `state`        | string | yes      | Same vocabulary as [Status Values](#status-values).            |
| `tool`         | string | no       | Tool name that triggered this scratchpad event.                |
| `activity`     | string | no       | Human-readable status label — includes `assistant_id`.         |
| `entry`        | string | no       | Full scratchpad entry content for display.                     |
| `assistant_id` | string | no       | ID of the assistant that performed the operation.              |

> **Note:** The `activity` field includes the `assistant_id` in parentheses — e.g.
> `"📖 Reading scratchpad (asst_abc123)..."`. This is intentional — it allows
> consumers to track which agent (Supervisor vs Worker) is accessing memory in
> multi-agent delegation scenarios. Consumers should treat this as a display string
> and not attempt to parse the `assistant_id` out of it.

> **No field remapping required.** Fields are emitted with their final names.
> `state` does not need to be renamed to `status` on the consumer side.

#### Strategy Entry Prefixes

Scratchpad entries always begin with one of these emoji, which consumers can use
as a secondary detection signal:

| Prefix | Meaning             |
|--------|---------------------|
| `📌`   | New strategy entry  |
| `✅`   | Completed step      |
| `🔄`   | Revised strategy    |
| `❓`   | Open question       |
| `⚠️`   | Warning / issue     |
| `☠️`   | Dead end / abort    |

---

## Delegated Worker Event Relay

Deep Research workers execute as ephemeral assistants inside the Core runtime.

Each delegated worker has its own thread, run, and Project David SDK inference
stream. The external caller's SDK is therefore **not directly connected to the
worker's stream**.

The delegation layer acts as an event relay between the worker's internal stream
and the parent inference stream:

```text
External SDK
    │
    ▼
Parent / Supervisor inference stream
    │
    ▼
DelegationMixin
    │
    ├── creates ephemeral worker
    ├── creates ephemeral thread/run
    ├── creates internal Project David SDK client
    │
    ▼
Worker inference stream
    │
    ├── ScratchpadEvent
    ├── WebStatusEvent
    ├── ContentEvent
    ├── ReasoningEvent
    └── internal tool/lifecycle events
    │
    ▼
DelegationMixin relay
    │
    ▼
Parent stream
    │
    ▼
External SDK
```

This relay allows consumers of the **single parent stream** to observe relevant
worker activity without connecting directly to ephemeral worker runs.

### Relayed Event Classes

The delegation layer currently exposes worker activity according to the following
contract:

| Worker event/activity | Parent stream representation | Behaviour |
|-----------------------|------------------------------|-----------|
| `ScratchpadEvent` | `scratchpad_status` | Explicitly relayed |
| `WebStatusEvent` | `web_status` | Explicitly relayed |
| Worker content | `content` | Repackaged as delegation content |
| Worker reasoning | `reasoning` | Repackaged as delegation reasoning |
| Delegation lifecycle | `research_status` | Synthesized by `DelegationMixin` |
| Worker raw tool-call payloads | not exposed directly | Consumed internally |
| Generic worker lifecycle/status events | not exposed directly unless explicitly relayed | Consumed internally |

### Parent Run Identity

Relayed worker events are rebound to the **parent run ID**.

For example, a worker may internally emit:

```json
{
  "type": "web_status",
  "run_id": "worker_run_xyz",
  "status": "running",
  "tool": "read_web_page",
  "message": "Reading: https://docs.python.org/..."
}
```

The parent stream receives:

```json
{
  "type": "web_status",
  "run_id": "parent_run_abc",
  "status": "running",
  "tool": "read_web_page",
  "message": "Reading: https://docs.python.org/..."
}
```

Consumers therefore do not need to subscribe to or correlate ephemeral worker
run IDs in order to display worker activity.

The parent `run_id` remains the stable stream identity.

### Scratchpad Relay

Worker `ScratchpadEvent` objects are intercepted by `DelegationMixin` and
re-emitted as `scratchpad_status`.

The relay preserves the useful worker-specific fields:

```json
{
  "type": "scratchpad_status",
  "run_id": "parent_run_abc",
  "operation": "append",
  "state": "success",
  "tool": "append_scratchpad",
  "activity": "📝 Appending to scratchpad (asst_worker123)...",
  "entry": "✅ [VERIFIED] ...",
  "assistant_id": "asst_worker123"
}
```

This allows the consumer to observe scratchpad activity performed by delegated
workers while still treating the event as part of the parent run.

The `assistant_id` continues to identify the actual assistant that performed the
scratchpad operation.

### Web Status Relay

Worker `WebStatusEvent` objects are intercepted by `DelegationMixin` and
re-emitted as normal `web_status` events.

Example:

```json
{
  "type": "web_status",
  "run_id": "parent_run_abc",
  "status": "running",
  "tool": "perform_web_search",
  "message": "Querying SearxNG: 'python official documentation'..."
}
```

No special consumer-side worker event class is required.

The external SDK receives the relayed event through the ordinary stream parser
and deserializes it as the existing `WebStatusEvent`.

The same mechanism applies to:

```text
perform_web_search
read_web_page
search_web_page
scroll_web_page
```

including their `running`, `success`, `warning`, and `error` lifecycle states.

### Worker Content and Reasoning

Worker content and reasoning are not forwarded as raw child event objects.

`DelegationMixin` extracts the worker stream's content/reasoning and emits parent
delegation chunks which are subsequently surfaced to consumers as ordinary
`ContentEvent` and `ReasoningEvent` objects.

Conceptually:

```text
Worker ContentEvent
        │
        ▼
DelegationMixin
        │
        ▼
delegation content chunk
        │
        ▼
Parent ContentEvent
```

and:

```text
Worker ReasoningEvent
        │
        ▼
DelegationMixin
        │
        ▼
delegation reasoning chunk
        │
        ▼
Parent ReasoningEvent
```

Consumers therefore do not need separate handling for worker text.

### Research Status Is Synthesized

`ResearchStatusEvent` entries surrounding delegation are generated by
`DelegationMixin` itself rather than copied from the child worker stream.

Typical lifecycle:

```text
Initializing delegation worker...
Worker active. Streaming...
Worker stream finished. Finalizing payload...
Delegation complete.
```

These events describe the **delegation operation as a whole** and use:

```json
{
  "type": "research_status",
  "run_id": "parent_run_abc",
  "tool": "delegate_research_task",
  "state": "in_progress",
  "activity": "Worker active. Streaming..."
}
```

The final state is normally:

```json
{
  "type": "research_status",
  "run_id": "parent_run_abc",
  "tool": "delegate_research_task",
  "state": "completed",
  "activity": "Delegation complete."
}
```

or an error equivalent when delegation fails.

### Raw Tool Calls Remain Internal

The relay intentionally does **not** expose the delegated worker's raw
`ToolCallRequestEvent` / tool-call payloads to the external caller.

Research tools are Core-owned. The worker executes those tools inside its own
runtime and the delegation layer consumes the corresponding tool-call mechanics.

This preserves the boundary:

```text
External caller
    │
    └── observes lifecycle/status/output

Core worker
    │
    └── owns and executes research tools
```

The external client should therefore observe:

```text
ResearchStatusEvent
ScratchpadEvent
WebStatusEvent
ContentEvent
ReasoningEvent
```

but should **not** be required to execute delegated worker web or scratchpad
tools itself.

### Relay Ordering

Events are relayed synchronously in the order they are observed from the worker
stream.

A typical delegated research sequence may therefore appear as:

```text
ResearchStatusEvent   Initializing delegation worker...
ResearchStatusEvent   Worker active. Streaming...

ScratchpadEvent       read / in_progress
ScratchpadEvent       read / success
ScratchpadEvent       read / completed

WebStatusEvent        perform_web_search / running
WebStatusEvent        perform_web_search / warning

ScratchpadEvent       append / in_progress
ScratchpadEvent       append / success
ScratchpadEvent       append / completed

WebStatusEvent        read_web_page / running
WebStatusEvent        read_web_page / success

WebStatusEvent        search_web_page / running
WebStatusEvent        search_web_page / success

ContentEvent          Worker completion text...

ResearchStatusEvent   Worker stream finished. Finalizing payload...
ResearchStatusEvent   Delegation complete.
```

Consumers may use this ordering to construct a live Deep Research activity view.

They must not assume that every web tool ends in `success`: recoverable
`warning` or `error` states may be followed by another research attempt.

### Relay Consumer Rule

Consumers should treat relayed events identically to equivalent events produced
directly by the parent assistant.

Do **not** introduce a separate "worker web status" or "worker scratchpad status"
wire type.

The relay deliberately preserves the existing public event contract:

```text
scratchpad_status
web_status
content
reasoning
research_status
```

The fact that an event originated inside a delegated worker is an orchestration
detail, not a separate transport protocol.

---

### `tool_call_start` / `tool_call_manifest`

Emitted when a tool invocation begins. Consumers use this to show a tool-in-progress
indicator before results arrive.

```json
{
  "type": "tool_call_start",
  "run_id": "abc123",
  "tool": "read_web_page"
}
```

| Field  | Type   | Description          |
|--------|--------|----------------------|
| `tool` | string | Name of the tool being invoked. |

Routing rules for consumers:

| Tool category    | Examples                                                                          | Route to           |
|------------------|-----------------------------------------------------------------------------------|--------------------|
| Web tools        | `perform_web_search`, `read_web_page`, `scroll_web_page`, `search_web_page`       | WebSearchStatus    |
| Scratchpad tools | `read_scratchpad`, `update_scratchpad`, `append_scratchpad`                       | Swallow silently   |
| Delegation tools | `delegate_research_task`, `delegate_engineer_task`                                | DeepResearchStatus |
| Everything else  | Custom consumer tools                                                             | DeepResearchStatus |

> **Delegated worker note:** Raw worker tool-call manifests are consumed internally
> by Core and are not normally relayed to the parent client. Worker web activity is
> exposed through `web_status`; worker scratchpad activity is exposed through
> `scratchpad_status`.

---

### `error`

A terminal error event. The run cannot continue.

```json
{
  "type": "error",
  "run_id": "abc123",
  "error": "Tool execution timed out."
}
```

| Field   | Type   | Description            |
|---------|--------|------------------------|
| `error` | string | Human-readable error message. |

---

### `generated_file` / `code_interpreter_file`

A file produced by the assistant during code execution or generation.

```json
{
  "type": "generated_file",
  "run_id": "abc123",
  "filename": "report.pdf",
  "mime_type": "application/pdf",
  "file_id": "file_xyz",
  "url": "https://...",
  "base64": "<optional base64 data>"
}
```

| Field       | Type   | Required | Description                              |
|-------------|--------|----------|------------------------------------------|
| `filename`  | string | yes      | Original filename.                       |
| `mime_type` | string | yes      | MIME type of the file.                   |
| `file_id`   | string | yes      | Stable identifier for deduplication.     |
| `url`       | string | no       | Download URL if available.               |
| `base64`    | string | no       | Base64-encoded file content if no URL.   |

---

### `hot_code`

A chunk of code being written by the code interpreter, streamed line by line.

```json
{
  "type": "hot_code",
  "run_id": "abc123",
  "content": "import pandas as pd\n"
}
```

---

### `hot_code_output` / `computer_output`

Output produced by executed code.

```json
{
  "type": "hot_code_output",
  "run_id": "abc123",
  "content": "   name  value\n0  foo   1\n"
}
```

---

## Scratchpad Bleed Filter

The backend occasionally emits scratchpad operation status labels as `type:'content'`
events. These are implementation artifacts and must be swallowed by consumers —
they should never appear in the chat bubble or any status component.

Unlike earlier versions of this contract, the bleed strings now include the
`assistant_id` in parentheses. **Match on prefix, not exact string.**

Filter any `content` event whose text starts with one of these prefixes:

```text
📖 Reading scratchpad (
📖 Scratchpad read by
✏️ Updating scratchpad (
✏️ Scratchpad updated by
📝 Appending to scratchpad (
📝 Scratchpad entry written by
Accessing memory (
Memory synchronized by
Scratchpad error:
Validation error:
```

> **Important:** Apply this filter *after* checking for scratchpad entry prefixes
> (`📌 ✅ 🔄 ❓ ⚠️ ☠️`). Legitimate scratchpad entries that happen to contain
> bleed strings must not be swallowed. See routing order below.

---

## Consumer Routing Order

Consumers should route first-class typed events before applying any legacy
content-string heuristics.

Recommended order:

1. **`type:'scratchpad_status'`?**
   → route directly to the scratchpad component, `return`
2. **`type:'web_status'`?**
   → route directly to the web-search status component, `return`
3. **`type:'research_status'` / orchestration status?**
   → route to the Deep Research status component, `return`
4. **Other non-content typed event?**
   → route according to its event contract
5. **`type:'content'` scratchpad entry start?**
   → does text begin with `📌 ✅ 🔄 ❓ ⚠️ ☠️`?
   → accumulate into scratchpad buffer, `return`
6. **Mid scratchpad block?**
   → is an accumulation currently open?
   → append to buffer, `return`
7. **Legacy `WebStatusEvent(...)` string?**
   → parse and route to status component, `return`
8. **Bleed string?**
   → does the text match any prefix in the filter list above?
   → swallow silently, `return`
9. **Default**
   → render as chat content

> **Important:** `web_status` is now a first-class stream event, including when it
> originated from a delegated research worker. Parsing `WebStatusEvent(...)` out of
> content is retained only as a backwards-compatibility path for legacy emitters.

---

## Web Tool Scroll Contract

The backend enforces the following constraints on `scroll_web_page` to prevent
unbounded scroll loops:

- **Search-first gate:** `scroll_web_page` on any page beyond page 0 is blocked
  until `search_web_page` has been called on the same URL in the current session.
- **Hard scroll limit:** A maximum of **3** `scroll_web_page` calls are permitted
  per URL per run. Calls beyond this limit return a blocking instruction rather
  than page content.

When either constraint is violated the tool returns a `type:'content'` event
containing a `🛑` prefixed error message with recovery instructions. Consumers
should display this as normal assistant content.

---

## Versioning

This contract is currently **unversioned**. Breaking changes will be noted in the
SDK changelog. A `version` field may be added to the envelope in a future release.
