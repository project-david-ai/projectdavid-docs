---
title: Function Calls
category: sdk
slug: function-calling-and-tool-execution
lifecycle_step: tool_calls
nav_order: 12
---

# Function calling

A function declaration tells the model which operation it can request and
what arguments it accepts. Your application executes the function; Project
David records the Action and tool output and continues the Run.

For platform-managed execution or remote MCP tools, see [Tools](/docs/sdk-tools).

## Configure

Complete [Authentication](/docs/api_keys) and register a Hyperbolic provider
key. Set `PROJECTDAVID_API_KEY` and `PROJECTDAVID_PROVIDER_KEY_ID` in your
application environment. The examples use a synthetic flight lookup, not a
live airline service.

Run the examples in order in the same Python or Bash session. The cURL
interface requires `jq` and `uuidgen`.

```python interface=python
import json
import os

from dotenv import load_dotenv
from projectdavid import Entity
from projectdavid.events import ContentEvent, ToolCallRequestEvent

load_dotenv()
client = Entity(
    base_url=os.getenv("PROJECTDAVID_BASE_URL", "https://api.projectdavid.co.uk"),
    api_key=os.environ["PROJECTDAVID_API_KEY"],
)
provider_key_id = os.environ["PROJECTDAVID_PROVIDER_KEY_ID"]
```

```bash interface=curl
set -euo pipefail
BASE_URL="${PROJECTDAVID_BASE_URL:-https://api.projectdavid.co.uk}"
PROVIDER_KEY_ID="${PROJECTDAVID_PROVIDER_KEY_ID:?Set the provider key ID}"

request() {
  curl -fsS -X "$1" "$BASE_URL$2" \
    -H "X-API-Key: $PROJECTDAVID_API_KEY" \
    -H 'Content-Type: application/json' "${@:3}"
}
```

## Declare a function

Attach an OpenAI-style function definition to an Assistant. The schema
specifies arguments, not executable code.

```python interface=python
assistant = client.assistants.create_assistant(
    name="Flight Demo",
    model="hyperbolic/deepseek-v4-flash-0731",
    instructions="Use the flight lookup tool. Clearly label its results as demo data.",
    tools=[{
        "type": "function",
        "function": {
            "name": "get_flight_times",
            "description": "Look up synthetic flight data for a route.",
            "parameters": {
                "type": "object",
                "properties": {
                    "departure": {"type": "string"},
                    "arrival": {"type": "string"},
                },
                "required": ["departure", "arrival"],
                "additionalProperties": False,
            },
        },
    }],
)
```

```curl interface=curl
ASSISTANT_ID=$(request POST /v1/assistants --data-binary @- <<'JSON' | jq -er '.id'
{
  "name": "Flight Demo",
  "model": "hyperbolic/deepseek-v4-flash-0731",
  "instructions": "Use the flight lookup tool. Clearly label its results as demo data.",
  "tools": [{
    "type": "function",
    "function": {
      "name": "get_flight_times",
      "description": "Look up synthetic flight data for a route.",
      "parameters": {
        "type": "object",
        "properties": {
          "departure": {"type": "string"},
          "arrival": {"type": "string"}
        },
        "required": ["departure", "arrival"],
        "additionalProperties": false
      }
    }
  }]
}
JSON
)
```

For updating an existing Assistant, see [Assistants](/docs/sdk-assistants).

## Implement the handler

Use an explicit allowlist to dispatch requests. This example accepts one
route and returns a deterministic result with a verification reference.

```python interface=python
def execute_tool(name: str, args: dict) -> str:
    if name != "get_flight_times":
        raise ValueError("Unknown function")
    if args != {"departure": "LAX", "arrival": "JFK"}:
        raise ValueError("Demo supports LAX to JFK only")
    return json.dumps({
        "departure": "LAX",
        "arrival": "JFK",
        "duration": "5h 30m",
        "reference": "FLIGHT-DEMO-001",
        "synthetic": True,
    })
```

```bash interface=curl
execute_tool() {
  jq -ce --arg name "$1" '
    if $name == "get_flight_times" and
       . == {departure:"LAX",arrival:"JFK"}
    then {departure:"LAX",arrival:"JFK",duration:"5h 30m",
          reference:"FLIGHT-DEMO-001",synthetic:true}
    else error("Unsupported function or route") end
  ' <<< "$2"
}
```

Validate authorization and business rules inside real handlers. Model-generated
arguments are untrusted input, even when they match the declared schema.

## Create a run

```python interface=python
prompt = "Use get_flight_times for LAX to JFK. Include the returned reference."
thread = client.threads.create_thread()
message = client.messages.create_message(
    thread_id=thread.id,
    assistant_id=assistant.id,
    role="user",
    content=prompt,
)
run = client.runs.create_run(
    assistant_id=assistant.id,
    thread_id=thread.id,
    temperature=0.2,
    top_p=1.0,
)
```

```curl interface=curl
THREAD_ID=$(printf '{}' | request POST /v1/threads --data-binary @- | jq -er '.id')
MESSAGE_ID=$(jq -n --arg thread "$THREAD_ID" --arg assistant "$ASSISTANT_ID" \
  '{thread_id:$thread,assistant_id:$assistant,role:"user",
    content:"Use get_flight_times for LAX to JFK. Include the returned reference."}' \
  | request POST /v1/messages --data-binary @- | jq -er '.id')

NOW=$(date +%s)
RUN=$(jq -n --arg id "run_$(uuidgen | tr -d '-')" \
  --arg thread "$THREAD_ID" --arg assistant "$ASSISTANT_ID" \
  --argjson now "$NOW" --argjson expires "$((NOW + 3600))" \
  '{id:$id,thread_id:$thread,assistant_id:$assistant,instructions:"",
    created_at:$now,expires_at:$expires,temperature:0.2,top_p:1}' \
  | request POST /v1/runs --data-binary @-)
RUN_ID=$(jq -er '.id' <<< "$RUN")
MODEL=$(jq -er '.model' <<< "$RUN")
```

## Execute and continue

The SDK maps SSE frames to typed events and coordinates the continuation
when `event.execute()` submits tool output. With raw HTTP, handle the
`tool_call_manifest` frame, execute the function, submit its result and
start another inference pass on the same Run.

```python interface=python
stream = client.synchronous_inference_stream
stream.setup(
    thread_id=thread.id,
    assistant_id=assistant.id,
    message_id=message.id,
    run_id=run.id,
    provider_key_id=provider_key_id,
)

for event in stream.stream_events(model=run.model, max_turns=10):
    if isinstance(event, ContentEvent):
        print(event.content, end="", flush=True)
    elif isinstance(event, ToolCallRequestEvent):
        if not event.execute(execute_tool):
            raise RuntimeError("Tool output could not be handled")

print()
```

```curl interface=curl
PAYLOAD=$(jq -n --arg model "$MODEL" --arg thread "$THREAD_ID" \
  --arg message "$MESSAGE_ID" --arg run "$RUN_ID" \
  --arg assistant "$ASSISTANT_ID" --arg key "$PROVIDER_KEY_ID" \
  '{model:$model,thread_id:$thread,message_id:$message,run_id:$run,
    assistant_id:$assistant,provider_key_id:$key,stream:true}')

# Handle each manifest as it arrives, then continue after the stream closes.
# This example handles the flat JSON SSE frames used for local functions.
(
  work=$(mktemp -d)
  trap 'rm -rf -- "$work"' EXIT

  for ((turn=1; turn<=10; turn++)); do
    rm -f "$work/continue"
    curl -fsSN "$BASE_URL/v1/completions" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" \
      -H 'Content-Type: application/json' --data-binary "$PAYLOAD" \
    | while IFS= read -r line; do
        [[ "$line" == data:* ]] || continue
        data=${line#data:}
        data=${data# }
        data=${data%$'\r'}
        [[ "$data" == '[DONE]' ]] && continue
        case $(jq -er '.type // "unknown"' <<< "$data") in
          content) jq -jr '.content // ""' <<< "$data" ;;
          error) echo 'Inference reported an error' >&2; exit 1 ;;
          tool_call_manifest)
            action=$(jq -er '.action_id' <<< "$data")
            call=$(jq -er '.tool_call_id' <<< "$data")
            name=$(jq -er '.tool' <<< "$data")
            args=$(jq -c '.args' <<< "$data")

            request PUT "/v1/actions/$action" \
              -d '{"status":"processing"}' >/dev/null

            if output=$(execute_tool "$name" "$args"); then
              status=completed
            else
              output='{"error":"Unsupported function or arguments"}'
              status=failed
            fi

            jq -n --arg thread "$THREAD_ID" --arg assistant "$ASSISTANT_ID" \
              --arg action "$action" --arg call "$call" --arg output "$output" \
              '{thread_id:$thread,assistant_id:$assistant,role:"tool",
                tool_id:$action,tool_call_id:$call,content:$output}' \
              | request POST /v1/messages/tools --data-binary @- >/dev/null

            jq -n --arg status "$status" '{status:$status}' \
              | request PUT "/v1/actions/$action" --data-binary @- >/dev/null
            touch "$work/continue"
            ;;
        esac
      done
    [[ -f "$work/continue" ]] || break
  done
  printf '\n'
)
```

The Action ID (`action_id`) identifies the execution record; the model's
`tool_call_id` associates the result with the original function request.
Send both when submitting tool output. Keep the original user Message ID,
Run ID and provider credential for continuation; do not create another Run.

The SDK validates arguments against the Assistant's tool schemas before
exposing a normal tool request. Invalid calls may be intercepted and returned
as errors. The cURL demo implements its own strict argument check; it is not
a general-purpose SDK replacement.

## Check the outcome

```python interface=python
result = client.runs.retrieve_run(run.id)
print(result.status, result.last_error)
if result.status != "completed":
    raise RuntimeError("Run did not complete")
```

```curl interface=curl
RESULT=$(request GET "/v1/runs/$RUN_ID")
jq '{status,last_error}' <<< "$RESULT"
jq -e '.status == "completed"' <<< "$RESULT" >/dev/null
```

`event.execute()` can return `True` after recording a handler exception as
failed tool output. This indicates the SDK can continue, not that the function
succeeded. Inspect the Action status to distinguish completed and failed
operations. The model may attempt recovery; a retry or successful final answer
is not guaranteed.

`max_turns` bounds SDK continuation passes (default: 10). It is not a guarantee
that the Run becomes terminal when the limit is reached. Inspect Run status
and Actions before retrying after a failure or disconnect. Make side-effecting
handlers idempotent and avoid exposing secrets in tool results or exception
messages.

## Reference

- [Inference guide](/docs/sdk-inference)
- [Streaming events](/docs/sdk-reference-events)
- [Streaming](/docs/sdk-reference-streaming)
- [Actions](/docs/sdk-reference-actions)
- [HTTP API Reference](/docs/api-reference)
