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

SDK consumers receive pre-parsed typed event objects via the async iterator. The
line-splitting and JSON parsing step is handled by the SDK. Each event object maps
to one of the dataclasses defined in `projectdavid.events`.

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

---

## Event Type Reference

| Type discriminator          | SDK class                        | Category          |
|-----------------------------|----------------------------------|-------------------|
| `content`                   | `ContentEvent`                   | Core streaming    |
| `reasoning`                 | `ReasoningEvent`                 | Core streaming    |
| `decision`                  | `DecisionEvent`                  | Core streaming    |
| `plan`                      | `PlanEvent`                      | Core streaming    |
| `tool_call_manifest`        | `ToolCallRequestEvent`           | Tool lifecycle    |
| `tool_intercept`            | `ToolInterceptEvent`             | Tool lifecycle    |
| `web_status`                | `WebStatusEvent`                 | Tool status       |
| `research_status`           | `ResearchStatusEvent`            | Tool status       |
| `engineer_status`           | `EngineerStatusEvent`            | Tool status       |
| `code_status`               | `CodeStatusEvent`                | Tool status       |
| `shell_status`              | `ShellStatusEvent`               | Tool status       |
| `scratchpad_status`         | `ScratchpadEvent`                | Memory            |
| `hot_code`                  | `HotCodeEvent`                   | Code interpreter  |
| `code_output`               | `CodeExecutionOutputEvent`       | Code interpreter  |
| `computer_output`           | `ComputerExecutionOutputEvent`   | Computer tool     |
| `generated_file`            | `CodeExecutionGeneratedFileEvent`| File output       |
| `computer_generated_file`   | `ComputerGeneratedFileEvent`     | File output       |

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

---

### `reasoning`

Internal chain-of-thought text produced before the final response. Emitted by
reasoning-capable models (DeepSeek R1/V3). Consumers may display this in a
collapsed or secondary UI element.

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

### `decision`

A structural JSON decision payload from the assistant. Emitted when the model
produces a tool call decision in JSON form. Consumers typically do not render
this directly — it is consumed by the orchestration layer.

```json
{
  "type": "decision",
  "run_id": "abc123",
  "content": "{\"tool\": \"perform_web_search\", \"arguments\": {...}}"
}
```

| Field     | Type   | Description        |
|-----------|--------|--------------------|
| `content` | string | Raw JSON decision string. |

---

### `plan`

A strategic planning delta emitted by Level 3 agentic reasoning. Contains the
assistant's planning text before tool dispatch. Consumers may display this in a
plan/thinking panel.

```json
{
  "type": "plan",
  "run_id": "abc123",
  "content": "I will first search for the latest figures, then..."
}
```

| Field     | Type   | Description        |
|-----------|--------|--------------------|
| `content` | string | Planning text chunk. |

---

### `tool_call_manifest`

Emitted when a tool invocation is fully accumulated and ready for execution.
In the SDK this is a `ToolCallRequestEvent` with an `.execute()` method.

```json
{
  "type": "tool_call_manifest",
  "run_id": "abc123",
  "tool": "perform_web_search",
  "args": {"query": "latest AI news"},
  "action_id": "act_xyz",
  "tool_call_id": "call_abc"
}
```

| Field          | Type   | Required | Description                                      |
|----------------|--------|----------|--------------------------------------------------|
| `tool`         | string | yes      | Tool name being invoked.                         |
| `args`         | object | yes      | Tool arguments.                                  |
| `action_id`    | string | no       | Platform action ID for tracking.                 |
| `tool_call_id` | string | no       | ID linking the tool call to the dialogue history.|

---

### `tool_intercept`

Emitted during multi-agent delegation when a consumer tool call is intercepted
and handed to the SDK consumer for execution. The consumer must call
`.execute_intercepted()` to complete the tool execution and submit the result
back to the platform.

```json
{
  "type": "tool_intercept",
  "run_id": "abc123",
  "tool_name": "my_custom_tool",
  "args": {"param": "value"},
  "action_id": "act_xyz",
  "tool_call_id": "call_abc",
  "thread_id": "thread_xyz",
  "origin_run_id": "run_parent",
  "origin_assistant_id": "asst_supervisor"
}
```

| Field                 | Type   | Required | Description                                             |
|-----------------------|--------|----------|---------------------------------------------------------|
| `tool_name`           | string | yes      | Name of the tool to execute.                            |
| `args`                | object | yes      | Tool arguments.                                         |
| `action_id`           | string | no       | Platform action ID.                                     |
| `tool_call_id`        | string | no       | Dialogue history link ID.                               |
| `thread_id`           | string | no       | Thread context for the intercept.                       |
| `origin_run_id`       | string | no       | Run ID of the originating (supervisor) agent.           |
| `origin_assistant_id` | string | no       | Assistant ID of the originating agent — required for `.execute_intercepted()`. |

---

### `web_status`

A lifecycle event from web tool execution. Used to drive web search status
indicators in the UI.

```json
{
  "type": "web_status",
  "run_id": "abc123",
  "status": "complete",
  "tool": "perform_web_search",
  "message": "Search complete."
}
```

| Field     | Type   | Required | Description                                              |
|-----------|--------|----------|----------------------------------------------------------|
| `status`  | string | yes      | See [Status Values](#status-values).                     |
| `tool`    | string | no       | Tool name if this event is tool-scoped.                  |
| `message` | string | no       | Human-readable description.                              |

---

### `research_status`

A user-visible progress update during deep research or delegation tool execution.

```json
{
  "type": "research_status",
  "run_id": "abc123",
  "activity": "Delegating research task to worker agent...",
  "tool": "delegate_research_task",
  "state": "in_progress"
}
```

| Field      | Type   | Required | Description                                          |
|------------|--------|----------|------------------------------------------------------|
| `activity` | string | yes      | Human-readable description of the current operation. |
| `tool`     | string | no       | Tool name if this event is tool-scoped.              |
| `state`    | string | no       | See [Status Values](#status-values). Default `in_progress`. |

---

### `engineer_status`

A lifecycle update from the Network Engineer tools.

```json
{
  "type": "engineer_status",
  "run_id": "abc123",
  "activity": "Executing network command on device...",
  "tool": "execute_network_command",
  "state": "in_progress"
}
```

| Field      | Type   | Required | Description                                          |
|------------|--------|----------|------------------------------------------------------|
| `activity` | string | yes      | Human-readable status description.                   |
| `tool`     | string | no       | Tool name.                                           |
| `state`    | string | no       | See [Status Values](#status-values). Default `in_progress`. |

---

### `code_status`

Code interpreter lifecycle update. Distinct from `research_status` so the
frontend can route it independently.

```json
{
  "type": "code_status",
  "run_id": "abc123",
  "activity": "Executing code in sandbox...",
  "state": "in_progress",
  "tool": "code_interpreter"
}
```

| Field      | Type   | Required | Description                                          |
|------------|--------|----------|------------------------------------------------------|
| `activity` | string | yes      | Human-readable status description.                   |
| `state`    | string | yes      | See [Status Values](#status-values).                 |
| `tool`     | string | no       | Tool name.                                           |

---

### `shell_status`

Shell / computer tool lifecycle update. Mirrors `code_status` exactly but with
a different type discriminator so the frontend can route it independently.

```json
{
  "type": "shell_status",
  "run_id": "abc123",
  "activity": "Running shell command...",
  "state": "in_progress",
  "tool": "computer"
}
```

| Field      | Type   | Required | Description                                          |
|------------|--------|----------|------------------------------------------------------|
| `activity` | string | yes      | Human-readable status description.                   |
| `state`    | string | yes      | See [Status Values](#status-values).                 |
| `tool`     | string | no       | Tool name.                                           |

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
  "entry": "📌 GOAL: Find Q3 revenue figures\nENTITIES: Acme Corp",
  "assistant_id": "asst_abc123"
}
```

| Field          | Type   | Required | Description                                                    |
|----------------|--------|----------|----------------------------------------------------------------|
| `operation`    | string | yes      | One of `read`, `append`, `update`.                             |
| `state`        | string | yes      | See [Status Values](#status-values).                           |
| `tool`         | string | no       | Tool name that triggered this scratchpad event.                |
| `activity`     | string | no       | Human-readable status label — includes `assistant_id`.         |
| `entry`        | string | no       | Full scratchpad entry content for display.                     |
| `assistant_id` | string | no       | ID of the assistant that performed the operation.              |

> The `activity` field includes the `assistant_id` in parentheses — e.g.
> `"📖 Reading scratchpad (asst_abc123)..."`. This allows consumers to track
> which agent (Supervisor vs Worker) is accessing memory in multi-agent scenarios.

> **No field remapping required.** Fields are emitted with their final names.

#### Strategy Entry Prefixes

| Prefix | Meaning             |
|--------|---------------------|
| `📌`   | New strategy entry  |
| `✅`   | Completed step      |
| `🔄`   | Revised strategy    |
| `❓`   | Open question       |
| `⚠️`   | Warning / issue     |
| `☠️`   | Dead end / abort    |

---

### `hot_code`

A chunk of code being written by the model in real time, before execution.
Streamed line by line.

```json
{
  "type": "hot_code",
  "run_id": "abc123",
  "content": "import pandas as pd\n"
}
```

---

### `code_output`

Stdout / stderr output from the code sandbox after execution.

```json
{
  "type": "code_output",
  "run_id": "abc123",
  "content": "   name  value\n0  foo   1\n"
}
```

---

### `computer_output`

PTY text output from the shell / computer execution tool.

```json
{
  "type": "computer_output",
  "run_id": "abc123",
  "content": "$ ls -la\ntotal 24\n..."
}
```

---

### `generated_file`

A file produced by the code interpreter during execution.

```json
{
  "type": "generated_file",
  "run_id": "abc123",
  "filename": "report.pdf",
  "mime_type": "application/pdf",
  "file_id": "file_xyz",
  "url": "https://...",
  "base64_data": null
}
```

| Field         | Type   | Required | Description                              |
|---------------|--------|----------|------------------------------------------|
| `filename`    | string | yes      | Original filename.                       |
| `mime_type`   | string | yes      | MIME type of the file.                   |
| `file_id`     | string | yes      | Stable identifier for deduplication.     |
| `url`         | string | no       | Signed download URL.                     |
| `base64_data` | string | no       | Base64-encoded content if no URL.        |

---

### `computer_generated_file`

A file generated inside a computer shell session and uploaded to the file server.
Mirrors `generated_file` but carries shell-specific context.

```json
{
  "type": "computer_generated_file",
  "run_id": "abc123",
  "filename": "output.csv",
  "mime_type": "text/csv",
  "file_id": "file_xyz",
  "url": "https://...",
  "base64_data": null,
  "context": "session_end"
}
```

| Field         | Type   | Required | Description                                                          |
|---------------|--------|----------|----------------------------------------------------------------------|
| `filename`    | string | yes      | Original filename.                                                   |
| `mime_type`   | string | yes      | MIME type — guessed from filename, fallback `application/octet-stream`. |
| `file_id`     | string | yes      | Platform file server ID.                                             |
| `url`         | string | no       | Signed download URL.                                                 |
| `base64_data` | string | no       | Always `null` for shell files — served via URL only.                 |
| `context`     | string | no       | Harvest trigger: `explicit_harvest`, `idle_timeout`, or `session_end`. |

---

## Status Values

| Backend value        | Normalized UI value | Meaning                        |
|----------------------|---------------------|--------------------------------|
| `started`            | `in_progress`       | Operation has begun.           |
| `running`            | `in_progress`       | Operation is ongoing.          |
| `in_progress`        | `in_progress`       | Operation is ongoing.          |
| `complete`           | `success`           | Operation finished cleanly.    |
| `completed`          | `success`           | Operation finished cleanly.    |
| `done`               | `success`           | Operation finished cleanly.    |
| `success`            | `success`           | Operation finished cleanly.    |
| `failed`             | `error`             | Operation failed.              |
| `error`              | `error`             | Operation failed.              |
| `inference_complete` | `success`           | Full run is complete.          |

---

## Scratchpad Bleed Filter

The backend occasionally emits scratchpad operation status labels as `type:'content'`
events. These are implementation artifacts and must be swallowed by consumers.

The bleed strings include the `assistant_id` in parentheses. **Match on prefix,
not exact string.**

Filter any `content` event whose text starts with one of these prefixes:

```
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

> Apply this filter *after* checking for scratchpad entry prefixes
> (`📌 ✅ 🔄 ❓ ⚠️ ☠️`). Legitimate scratchpad entries that happen to contain
> bleed strings must not be swallowed.

---

## Consumer Routing Order

When a `type:'content'` event arrives, consumers must evaluate in this exact order:

1. **Scratchpad entry start?** — does the text begin with `📌 ✅ 🔄 ❓ ⚠️ ☠️`?
   → accumulate into scratchpad buffer, `return`
2. **Mid scratchpad block?** — is an accumulation currently open?
   → append to buffer, `return`
3. **Legacy WebStatusEvent string?** — does the text start with `WebStatusEvent(`?
   → parse and route to status component, `return`
4. **Bleed string?** — does the text match any prefix in the filter list above?
   → swallow silently, `return`
5. **Default** → render as chat content

---

## Web Tool Scroll Contract

The backend enforces the following constraints on `scroll_web_page`:

- **Search-first gate:** `scroll_web_page` on any page beyond page 0 is blocked
  until `search_web_page` has been called on the same URL in the current session.
- **Hard scroll limit:** A maximum of **3** `scroll_web_page` calls are permitted
  per URL per run.

When either constraint is violated the tool returns a `type:'content'` event
containing a `🛑` prefixed error message. Consumers should display this as normal
assistant content.

---

## Versioning

This contract is currently **unversioned**. Breaking changes will be noted in the
SDK changelog. A `version` field may be added to the envelope in a future release.