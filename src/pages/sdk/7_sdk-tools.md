---
title: Tools
category: sdk
slug: sdk-tools
nav_order: 7
---

# Tools

Tools allow an assistant to interact with external systems, data sources, and services.
There are two categories: platform tools built into the Entities API, and developer-defined
tools that you implement and register yourself.

## Platform Tools

| Tool | Description |
|---|---|
| [**computer**](/docs/sdk-computer) | Gives the assistant access to a containerised Linux environment connected to the internet. |
| [**web_search**](/docs/sdk-web-search) | Allows the assistant to query a search engine and synthesize responses from live web content. |
| [**deep_research**](/docs/sdk-deep-research) | Designed for queries requiring multi-hop reasoning, evidence gathering, and long-horizon synthesis across multiple inference passes. |
| [**file_search**](/docs/sdk-file-search) | Allows the assistant to search, retrieve, and utilize files stored within its accessible vector stores. |
| [**code_interpreter**](/docs/sdk-code-interpreter) | Allows the assistant to execute Python code, draft documents, and perform data analysis in a secure sandbox environment. |

## Developer-defined Tools

Developer-defined tools are custom extensions you implement and register on an assistant.
They follow a standard function-calling interface and allow the assistant to invoke
your own APIs, databases, or services during a run.

A tool is defined by a **function schema** — a description of the tool's name, purpose,
and expected parameters. The model may emit a function call matching this schema,
but it does not execute the function. Execution is always performed by your runtime.

### Defining a Tool

Pass a `tools` array when creating or updating an assistant:

```python
from projectdavid import Entity

client = Entity()

assistant = client.assistants.create_assistant(
    name="Flighty",
    instructions="You are a helpful flight assistant.",
    model="gpt-oss-120b",
    tools=[
        {
            "type": "function",
            "function": {
                "name": "get_flight_times",
                "description": "Get departure and arrival times for a flight.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "departure": {"type": "string"},
                        "arrival":   {"type": "string"}
                    },
                    "required": ["departure", "arrival"]
                }
            }
        }
    ]
)
```

### Updating Tools

Tool schemas can be updated or replaced at any time:

```python
client.assistants.update_assistant(
    assistant_id="your_assistant_id",
    tools=[
        {
            "type": "function",
            "function": {
                "name": "get_flight_times",
                "description": "Get departure and arrival times for a flight.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "departure": {"type": "string"},
                        "arrival":   {"type": "string"}
                    },
                    "required": ["departure", "arrival"]
                }
            }
        }
    ]
)
```

Once a schema is attached, the model may emit function call outputs matching it.
Detecting those outputs, validating arguments, executing the function, and returning
results to the model is covered in the [Function Calls](/docs/function-calling-and-tool-execution) guide.