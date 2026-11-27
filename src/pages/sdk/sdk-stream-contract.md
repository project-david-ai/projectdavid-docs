---
title: Streaming protocol
category: sdk
slug: sdk-stream-contract
nav_order: 16
---

# Streaming protocol

Inference delivers response text, tool requests, progress and generated files
through a single event stream. The HTTP wire format and the Python SDK's typed
events are related, but are not interchangeable.

## Transport

`POST /v1/completions` with `stream: true` delivers server-sent events (SSE).
Each JSON data payload is carried on a `data:` line, not as a bare NDJSON record.
For example:

```text
data: {"type":"content","run_id":"run_example","content":"Hello"}

data: {"type":"content","run_id":"run_example","content":" world"}

```

The SDK skips non-data lines and stops reading on `data: [DONE]` or stream
exhaustion. Do not require a `[DONE]` marker to be present. Neither a marker
nor a closed connection establishes successful Run completion.

## Consume a stream

Use an existing queued Run, its user Message and a registered provider key.
See [Inference](/docs/sdk-inference) for the execution setup. Set
`PROJECTDAVID_API_KEY`, `PROJECTDAVID_RUN_ID`, `PROJECTDAVID_MESSAGE_ID` and
`PROJECTDAVID_PROVIDER_KEY_ID` in your environment. The cURL examples use Bash
and `jq`.

These examples observe a Run without application-executed function calls.
Use a fresh Run when trying the alternative interface.

```python interface=python
import os
from projectdavid import Entity
from projectdavid.events import ContentEvent, ToolCallRequestEvent

client = Entity(
    base_url=os.getenv("PROJECTDAVID_BASE_URL", "https://api.projectdavid.co.uk"),
    api_key=os.environ["PROJECTDAVID_API_KEY"],
)
run = client.runs.retrieve_run(os.environ["PROJECTDAVID_RUN_ID"])
stream = client.synchronous_inference_stream
stream.setup(
    thread_id=run.thread_id,
    assistant_id=run.assistant_id,
    message_id=os.environ["PROJECTDAVID_MESSAGE_ID"],
    run_id=run.id,
    provider_key_id=os.environ["PROJECTDAVID_PROVIDER_KEY_ID"],
)

for event in stream.stream_events(model=run.model):
    if isinstance(event, ContentEvent):
        print(event.content, end="", flush=True)
    elif isinstance(event, ToolCallRequestEvent):
        raise RuntimeError("Application tool handler required")
    else:
        # Route typed progress, reasoning and file events separately.
        print(f"\n[{type(event).__name__}]")
print()
```

```curl interface=curl
set -euo pipefail
BASE_URL="${PROJECTDAVID_BASE_URL:-https://api.projectdavid.co.uk}"
RUN_ID="${PROJECTDAVID_RUN_ID:?Set the run ID}"
RUN=$(curl -fsS "$BASE_URL/v1/runs/$RUN_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY")

jq -n --argjson run "$RUN" \
  '{model:$run.model,thread_id:$run.thread_id,
    assistant_id:$run.assistant_id,run_id:$run.id,
    message_id:env.PROJECTDAVID_MESSAGE_ID,
    provider_key_id:env.PROJECTDAVID_PROVIDER_KEY_ID,stream:true}' \
  | curl -fsSN "$BASE_URL/v1/completions" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" \
      -H 'Content-Type: application/json' \
      --data-binary @- \
  | while IFS= read -r line; do
      line=${line%$'\r'}
      [[ "$line" == data:* ]] || continue
      data=${line#data:}
      data=${data# }
      [[ "$data" == '[DONE]' ]] && break
      jq -c . <<< "$data"
    done
```

The cURL example exposes raw JSON payloads; it does not perform SDK
normalization or execute tools. It handles the single-line JSON data frames
used by the current SDK parser, not arbitrary multi-line SSE payloads.
Avoid logging raw events containing sensitive application data in production.

For local function dispatch and continuation, see
[Function Calling](/docs/function-calling-and-tool-execution).

## Event representations

The following table describes the raw chunk types recognized by the current
SDK mapper and their corresponding Python classes. For nested chunks, the
raw type refers to the inner payload after unwrapping.

| Raw `type` | Python event | Consumer responsibility |
|---|---|---|
| `content` | `ContentEvent` | Accumulate response text. |
| `reasoning` | `ReasoningEvent` | Separate model reasoning output. |
| `decision` | `DecisionEvent` | Route structural decision payloads. |
| `plan` | `PlanEvent` | Route planning output. |
| `tool_call_manifest` | `ToolCallRequestEvent` | Dispatch application tools. |
| `tool_intercept` | `ToolInterceptEvent` | Handle delegated tool interception explicitly. |
| `web_status` | `WebStatusEvent` | Web tool progress. |
| `research_status` | `ResearchStatusEvent` | Research progress. |
| `scratchpad_status` | `ScratchpadEvent` | Scratchpad activity. |
| `engineer_status` | `EngineerStatusEvent` | Engineering tool progress. |
| `code_status` | `CodeStatusEvent` | Code execution progress. |
| `shell_status` | `ShellStatusEvent` | Computer session progress. |
| `hot_code` | `HotCodeEvent` | Code being generated. |
| `hot_code_output` | `CodeExecutionOutputEvent` | Code execution output. |
| `computer_output`, `shell_output`, `shell_error` | `ComputerExecutionOutputEvent` | Bare computer/shell output. |
| `code_interpreter_file` | `CodeExecutionGeneratedFileEvent` | Generated file. |
| `computer_file` | `ComputerGeneratedFileEvent` | Computer session file. |
| `error` | `WebStatusEvent` (`status="failed"`) | Report failure; inspect Run state. |

The SDK does not map generic `status`, `activity` or `tool_call_start` chunks
to typed events in the supplied implementation. Unknown types are skipped
by `stream_events()`. Use `stream_chunks()` when lower-level inspection is
required; pass `suppress_fc=False` to include `call_arguments` chunks.

Do not treat this mapping as an exhaustive inventory of all Core emitters.
The [generated event reference](/docs/sdk-reference-events) documents
Python fields and serialization.

## Payloads

### Text and progress

Text events carry a `content` string. Preserve whitespace and concatenate
response deltas in arrival order. Keep reasoning, plans and decisions
separate from final response text.

Progress events have distinct field conventions:

| Event family | Fields |
|---|---|
| Web | `status`, `message`, `tool`; optional `tool_call_id`, `origin_run_id`, `url`, `favicon` |
| Research, engineering, code, shell | `activity`, `state`, `tool` |
| Scratchpad | `operation`, `state`, `activity`, `tool`, `entry`, `content`, `assistant_id` |

A representative raw web event:

```json
{
  "type": "web_status",
  "run_id": "run_example",
  "status": "running",
  "tool": "read_web_page",
  "message": "Reading source"
}
```

Treat progress states as tool-specific strings, not as Run status values.
An individual tool warning or failure does not establish the final outcome
of inference. Use the explicit `assistant_id` and `origin_run_id` fields
when provided; do not derive identities from display strings.

### Application tool requests

```json
{
  "type": "tool_call_manifest",
  "run_id": "run_example",
  "tool": "lookup_order",
  "args": {"order_id": "123"},
  "action_id": "act_example",
  "tool_call_id": "call_example"
}
```

The SDK maps `tool` to `event.tool_name`. Keep the Action ID and model
call ID distinct. Use the application's registered handlers and validate
arguments before executing side effects. A function request is not proof
that a tool has executed.

`stream_events()` validates ordinary tool requests and can initiate another
inference turn after `event.execute(handler)`. `max_turns` defaults to 10.
Raw HTTP clients must manage tool output submission and continuation themselves.

### Generated files

```json
{
  "type": "code_interpreter_file",
  "run_id": "run_example",
  "filename": "report.pdf",
  "mime_type": "application/pdf",
  "file_id": "file_example",
  "url": "https://example.com/signed-download"
}
```

Use `file_id` to identify a file, not its filename or signed URL. The raw
payload may carry `base64`; Python exposes it as `base64_data`. Computer file
events may also carry a `context` field. Treat empty or absent download fields
as unavailable. Refresh expired links through the [Files](/docs/sdk-files) API.

### SDK serialization

`event.to_dict()` returns a dictionary representation of the SDK object.
Some discriminators change during mapping and serialization:

| Raw type | Serialized SDK `type` |
|---|---|
| `hot_code_output` | `code_output` |
| `code_interpreter_file` | `generated_file` |
| `computer_file` | `computer_generated_file` |
| `shell_output`, `shell_error` (bare) | `computer_output` |
| `error` | `web_status` |

This distinction matters when forwarding SDK events from an application
backend to a browser. A serialized SDK event is not necessarily accepted as
input by the raw chunk mapper. Define which representation your frontend
consumes rather than mixing the two formats.

## Normalize and route

The current SDK also recognizes nested transport envelopes:

```json
{
  "stream_type": "code_execution",
  "chunk": {"type": "hot_code_output", "content": "42\n"}
}
```

It unwraps `code_execution`, `computer_execution`, `delegation` and `shell`
envelopes, including recognized JSON payloads embedded in `content` strings.
Shell-enveloped `content`, `computer_output`, `shell_output` and `shell_error`
are suppressed by the typed mapper because the terminal receives PTY output
through a separate WebSocket. Computer file events still map normally.
Raw consumers should account for these envelopes if they require equivalent
behaviour. `stream_chunks()` does not perform this normalization.

The typed wrapper uses the configured Run ID for its mapped events. Do not
require every raw nested payload to carry a Run ID, or assume the typed
`run_id` identifies the originating delegated worker.

Route normalized events by type before rendering. Do not infer event types
from emoji prefixes or phrases such as "Validation error:" in ordinary text.
Such heuristics can hide legitimate model responses. Unknown events should
be ignored or recorded safely, not automatically appended to chat output.

## Delegated execution

Research progress, web status and scratchpad activity may be observed on the
parent stream. The SDK recognizes delegation envelopes and maps their inner
payloads to existing event classes. Delegated content and reasoning may also
appear as ordinary typed events; these alone do not identify the producer.

Use explicit origin metadata when available. Do not assume every internal
worker event is forwarded or that stream order constitutes a complete
execution audit. Core-owned tool execution does not require a local handler
merely because progress is visible. Explicit tool interceptions are a
separate event type; do not dispatch them as ordinary local manifests without
handling their origin and correlation fields.

## Completion and failure

After consuming the stream, retrieve the Run to determine the recorded
outcome. This also applies when the transport closes unexpectedly or a tool
continuation limit is reached.

```python interface=python
result = client.runs.retrieve_run(run.id)
print(result.status, result.last_error)
```

```curl interface=curl
curl -fsS "$BASE_URL/v1/runs/$RUN_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  | jq '{status,last_error}'
```

The typed mapper converts a raw `error` chunk to a failed `WebStatusEvent`;
that conversion does not itself raise an exception or establish terminal
Run state. HTTP and transport exceptions are separate from event payloads.
Do not treat every `WebStatusEvent(status="failed")` as an inference failure.
See [Runs](/docs/sdk-runs) for lifecycle and cancellation.

## Reference

- [Inference](/docs/sdk-inference)
- [Streaming](/docs/sdk-reference-streaming)
- [Streaming events](/docs/sdk-reference-events)
- [Function Calling](/docs/function-calling-and-tool-execution)
- [HTTP API Reference](/docs/api-reference)
