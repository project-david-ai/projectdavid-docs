---
title: Function Calls
category: sdk
slug: function-calling-and-tool-execution
lifecycle_step: tool_calls
nav_order: 12
---

# Function Calling

The SDK implements a unified event loop for tool use. You write one iterator — the SDK handles turn management, tool submission, and resumption transparently.

## Define tools on an assistant

Tools are defined at assistant creation time as a JSON schema array.

```python
from projectdavid import Entity

client = Entity()

assistant = client.assistants.create_assistant(
    name="Flight Assistant",
    instructions="You are a helpful assistant.",
    tools=[
        {
            "type": "function",
            "function": {
                "name": "get_flight_times",
                "description": "Returns departure and arrival times for a given route.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "departure": {"type": "string", "description": "Origin airport code."},
                        "arrival":   {"type": "string", "description": "Destination airport code."},
                    },
                    "required": ["departure", "arrival"],
                },
            },
        }
    ],
)
```

To inspect tool definitions on an existing assistant:

```python
assistant = client.assistants.retrieve_assistant(assistant_id="asst_abc123")
print(assistant.tools)
```

## Implement a tool handler

A tool handler is a plain Python function that receives the tool name and arguments dict and returns a string.

```python
import json

def get_flight_times(tool_name: str, arguments: dict) -> str:
    return json.dumps({
        "departure": arguments.get("departure"),
        "arrival":   arguments.get("arrival"),
        "duration":  "4h 30m",
    })

TOOL_REGISTRY = {
    "get_flight_times": get_flight_times,
}
```

## Run the unified event loop

```python
import os
import json
from projectdavid import Entity, ContentEvent, ToolCallRequestEvent
from dotenv import load_dotenv

load_dotenv()

client = Entity(
    base_url=os.getenv("BASE_URL", "http://localhost:9000"),
    api_key=os.getenv("ENTITIES_API_KEY"),
)

thread = client.threads.create_thread()

message = client.messages.create_message(
    thread_id=thread.id,
    assistant_id=assistant.id,
    role="user",
    content="What are the flight times from LAX to JFK?"
)

run = client.runs.create_run(
    assistant_id=assistant.id,
    thread_id=thread.id
)

stream = client.synchronous_inference_stream
stream.setup(
    thread_id=thread.id,
    assistant_id=assistant.id,
    message_id=message.id,
    run_id=run.id,
    api_key=os.getenv("HYPERBOLIC_API_KEY"),
)

for event in stream.stream_events(model="hyperbolic/deepseek-ai/DeepSeek-V3"):

    if isinstance(event, ContentEvent):
        print(event.content, end="", flush=True)

    elif isinstance(event, ToolCallRequestEvent):
        handler = TOOL_REGISTRY.get(event.tool_name)
        if handler:
            event.execute(handler)
        else:
            print(f"Unknown tool: {event.tool_name}")
```

The loop runs for as many turns as needed. When `event.execute(handler)` is called the SDK submits the result and the generator resumes automatically.

## Error recovery

If a handler raises an exception, the SDK catches it, submits the error as tool output, and the model attempts to recover. No special handling required on your end.

```python
ATTEMPTS = 0

def get_flight_times(tool_name: str, arguments: dict) -> str:
    global ATTEMPTS
    ATTEMPTS += 1
    if ATTEMPTS == 1:
        raise Exception("Database timeout — please retry.")
    return json.dumps({"departure": "10:00 AM", "arrival": "06:30 PM"})
```

On the first call the SDK catches the exception and submits the error to the model. The model retries. On the second call the handler succeeds and the final answer is generated.

## How it works

| Step | What happens |
|---|---|
| 1 | `stream_events` yields `ContentEvent` tokens as the model thinks. |
| 2 | When the model calls a tool, a `ToolCallRequestEvent` is yielded. |
| 3 | You call `event.execute(handler)`. The SDK invokes your function. |
| 4 | The SDK submits the result to the API and triggers the next turn. |
| 5 | The generator resumes, yielding the model's final `ContentEvent` tokens. |

## Notes

- Tool schemas must conform to JSON Schema. The SDK validates arguments before execution and intercepts invalid calls automatically.
- `TOOL_REGISTRY` is a plain dict — add as many tools as needed.
- `stream_events` defaults to `max_turns=10`. Increase for complex multi-step tool chains.