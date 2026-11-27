---
title: Coming from OpenAI
category: sdk
slug: openai-migration
nav_order: 2
---

# Coming from OpenAI

Move an application built with the OpenAI Responses API or Agents SDK to Project David. Choose stateless inference for bounded generation, or persistent resources when your application needs conversation state, tools and independently addressable execution records.

Project David has its own API and event protocol. Migration is an application integration change, not a base URL substitution.

## Map the architecture

| OpenAI | Project David |
|---|---|
| Responses request configuration | Assistant configuration and Run parameters |
| Agents SDK `Agent` | Persistent Assistant resource |
| Agents SDK `Runner` | Core execution runtime and SDK inference interface |
| Conversations, sessions or `previous_response_id` | Threads and Messages for persistent context |
| Response or agent run | Run for stateful execution |
| Response output items and streaming events | Messages and typed inference events |
| Function tools | Function definitions, application handlers and Actions |
| Hosted tools | Platform-managed tools |
| Remote MCP tools | Registered MCP servers and selected tools |
| Vector stores and file search | Vector Stores and file search |
| Agent tracing | Run execution accounting and execution events |

These are integration counterparts, not equivalent object schemas. Agents SDK sessions can maintain history on the client or through OpenAI-managed state. Project David's stateful interface uses server-side resources. Its stateless interface does not require those resources.

## Authentication and models

Create a Project David API key and configure an inference credential for the provider you choose. The platform key authenticates the application; the provider credential authorizes inference. For stateful BYOK inference, register the provider key and retain its ID.

Replace OpenAI model identifiers with supported Project David provider-qualified identifiers. A provider change may alter output quality, tool behaviour, context limits and supported modalities. Revalidate your application against the selected model.

See [Authentication](/docs/api_keys) and [Provider Keys](/docs/sdk-reference-provider-keys).

## Migrate text generation

A typical Responses API request supplies input and configuration together:

```python
import os
from openai import OpenAI

client = OpenAI()
response = client.responses.create(
    model=os.environ["OPENAI_MODEL"],
    instructions="Answer concisely.",
    input="Explain TCP retransmission.",
)
print(response.output_text)
```

For bounded text generation without persistent conversation resources, Project David offers buffered stateless completion. Install `projectdavid`, set `PROJECTDAVID_API_KEY` and a Hyperbolic `PROVIDER_API_KEY` in your environment, then run:

```python
import os
from projectdavid import Entity

client = Entity(
    base_url=os.getenv("PROJECTDAVID_BASE_URL", "https://api.projectdavid.co.uk"),
    api_key=os.environ["PROJECTDAVID_API_KEY"],
)
completion = client.inference.create_stateless_completion(
    model="hyperbolic/deepseek-v4-flash-0731",
    prompt="Explain TCP retransmission concisely.",
    provider_api_key=os.environ["PROVIDER_API_KEY"],
    max_tokens=256,
)
print(completion["choices"][0]["text"])
```

This example uses a direct provider credential. It is not a replacement for every Responses feature: it does not establish a persistent conversation or provide the stateful tool execution lifecycle. See [Inference](/docs/sdk-inference) for the supported request forms.

## Migrate a persistent agent

An Agents SDK application can define an `Agent` and invoke `Runner.run()` with input. The runner manages the agent loop and may use sessions, tool handlers, handoffs and guardrails configured in the application.

In Project David, provision the Assistant once, associate a Thread with the application's conversation, and create a Message and Run for each interaction. Creating a Run does not start inference; the execution request is separate.

The following standalone example assumes `PROJECTDAVID_API_KEY` and a registered Hyperbolic `PROJECTDAVID_PROVIDER_KEY_ID` are set. Complete [Quick Start](/docs/sdk-quick-start) to obtain those credentials.

```python
import os
from projectdavid import Entity
from projectdavid.events import ContentEvent

client = Entity(
    base_url=os.getenv("PROJECTDAVID_BASE_URL", "https://api.projectdavid.co.uk"),
    api_key=os.environ["PROJECTDAVID_API_KEY"],
)
provider_key_id = os.environ["PROJECTDAVID_PROVIDER_KEY_ID"]

assistant = client.assistants.create_assistant(
    name="Network Support",
    model="hyperbolic/deepseek-v4-flash-0731",
    instructions="Explain networking concepts concisely.",
)
thread = client.threads.create_thread()


def respond(prompt):
    message = client.messages.create_message(
        thread_id=thread.id,
        assistant_id=assistant.id,
        role="user",
        content=prompt,
    )
    run = client.runs.create_run(
        assistant_id=assistant.id,
        thread_id=thread.id,
    )
    stream = client.synchronous_inference_stream
    stream.setup(
        thread_id=thread.id,
        assistant_id=assistant.id,
        message_id=message.id,
        run_id=run.id,
        provider_key_id=provider_key_id,
    )
    for event in stream.stream_events(model=run.model):
        if isinstance(event, ContentEvent):
            print(event.content, end="", flush=True)
    print()
    result = client.runs.retrieve_run(run.id)
    if result.status != "completed":
        raise RuntimeError(f"Run {run.id}: {result.status}")


respond("Explain TCP retransmission.")
respond("How does it differ from fast retransmit?")
```

In production, retain the Assistant and Thread IDs instead of provisioning new resources for each turn. Serialize executions on the same Thread. Use a separate Thread for independent conversations.

## Migrate tools

Responses function definitions use a flat function schema. Project David uses a nested `function` definition on the Assistant. The schema declares arguments; it does not register executable Python code.

Keep your existing business functions and authorization checks. Replace the dispatch and continuation layer: consume `ToolCallRequestEvent`, execute an allowlisted handler using `event.execute(handler)`, and continue consuming the SDK stream. The handler accepts a function name and argument dictionary and returns the tool output. With raw HTTP, submit the result and continue inference on the same Run, keeping the Action ID and model tool-call ID distinct.

Do not translate Responses `function_call_output` items directly into Project David messages. Follow [Function calling and tool execution](/docs/function-calling-and-tool-execution) for the complete workflow.

For hosted tools, enable the corresponding [Platform tools](/docs/sdk-tools). For remote MCP, [register the server, discover tools and attach the required capabilities](/docs/sdk-mcp-tools). Review approvals and permissions before enabling side effects. Agents SDK handoffs, guardrails and human approval policies require explicit migration; there is no general automatic conversion.

## Migrate retrieval and execution records

Re-ingest source documents using the [Vector Stores](/docs/sdk-Vector-Store) workflow and attach the new store to the Assistant. Use a compatible embedding configuration for ingestion and retrieval. Do not reuse OpenAI file or vector-store IDs.

Replace Responses event handlers with the [Streaming protocol](/docs/sdk-stream-contract). Route text, reasoning, tool requests and generated files according to their event types. Stream exhaustion is not evidence of success: retrieve the Run and inspect its recorded status.

For observability, use [Execution Accounting](/docs/sdk-reference-execution-accounting) to inspect execution records, delegations and execution events. Use Actions to inspect application-executed tools. These resources do not import or reproduce OpenAI trace spans; retain any external telemetry and evaluation infrastructure your application requires.

## Cutover

- Provision credentials and select the target model for each workflow.
- Recreate agent configuration, authorization rules and tool definitions.
- Map application conversation identifiers to new Threads. Import only history your application is authorized to retain; do not assume arbitrary Responses items, reasoning state or SDK session state can be replayed losslessly.
- Re-ingest documents and record new resource IDs.
- Verify multi-turn behaviour, tool failures, cancellation, retrieval, execution records and model-specific capabilities before switching traffic.

For deployment control, see [Platform overview](/docs/platform-overview). Review the storage, retention and security policies of your deployment and external inference providers independently.

## Reference

- [Python SDK Reference](/docs/sdk-reference-client)
- [HTTP API Reference](/docs/api-reference)
- [OpenAI Responses API](https://developers.openai.com/api/reference/responses/overview)
- [OpenAI conversation state](https://developers.openai.com/api/docs/guides/conversation-state)
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/agents/)
