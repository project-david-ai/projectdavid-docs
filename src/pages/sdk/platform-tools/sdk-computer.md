---
title: Computer
category: sdk
slug: sdk-computer
nav_exclude: true
---

# Computer

The Computer capability gives an assistant a containerised terminal session. Terminal output and inference events may travel on separate connections.

## Connect to a session

Complete [Authentication](/docs/api_keys) first. Use an assistant configured for Computer in a supported runtime. The session ticket is not an assistant capability declaration or an inference request.

Create a thread and request a ticket from your application backend.

```python
import os

from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv()

client = Entity(
    base_url=os.getenv("PROJECTDAVID_BASE_URL", "https://api.projectdavid.co.uk"),
    api_key=os.environ["PROJECTDAVID_API_KEY"],
)

thread = client.threads.create_thread()
session = client.computer.create_session(room_id=thread.id)
```

The SDK returns the server's session metadata. The existing connection contract describes `room_id`, `token` and `ws_url`. Authorize the requesting user against the thread before issuing the ticket to a frontend; never send your Project David API key to the browser.

## Observe terminal output

The viewer connection described by the existing integration uses the returned WebSocket URL with `room`, `token` and `role=viewer` query parameters. Preserve any existing URL parameters and encode the values. Render `shell_output` messages through a terminal renderer; `command_complete` indicates a command finished, not that the parent Run completed.

The current server-side viewer authorization and ticket lifetime have not been verified here. Confirm them against your deployed runtime before exposing this integration. A viewer query parameter is not itself an authorization boundary. Keep terminal input disabled for observer sessions.

## Execute and monitor

Use the same thread in the [Inference](/docs/sdk-inference) workflow. The SDK maps the following SSE payloads:

| Raw event type | Python SDK event |
|---|---|
| `shell_status` | `ShellStatusEvent` |
| `computer_file` | `ComputerGeneratedFileEvent` |
| `computer_output`, `shell_output`, `shell_error` | `ComputerExecutionOutputEvent` for bare output chunks |

The SDK suppresses PTY text inside shell envelopes to avoid duplicating the WebSocket terminal feed. Do not depend on both transports delivering identical output. Use generated file IDs and available download URLs to present files, and the Run resource to verify final execution status.

Treat session tickets and signed URLs as credentials. Do not log or persist them unnecessarily.

## Reference

- [Tools](/docs/sdk-tools)
- [Inference](/docs/sdk-inference)
- [Streaming Protocol](/docs/sdk-stream-contract)
- [Files](/docs/sdk-files)
