---
title: Code Interpreter
category: sdk
slug: sdk-code-interpreter
nav_order: 7.1
---

# Code Interpreter

Execute Python in the runtime sandbox for calculations, data analysis and file generation.

## Enable the tool

Complete [Authentication](/docs/api_keys) first. The examples create an assistant; they do not execute inference. Use a model and runtime that support the capability.

```python interface=python
import os

from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv()

client = Entity(
    base_url=os.getenv("PROJECTDAVID_BASE_URL", "https://api.projectdavid.co.uk"),
    api_key=os.environ["PROJECTDAVID_API_KEY"],
)

assistant = client.assistants.create_assistant(
    name='Analysis Assistant',
    model='hyperbolic/deepseek-v4-flash-0731',
    instructions='Use Python to analyse data and generate files when needed.',
    tools=[{'type': 'code_interpreter'}],
)
print(assistant.id)
```

```curl interface=curl
BASE_URL="${PROJECTDAVID_BASE_URL:-https://api.projectdavid.co.uk}"
BASE_URL="${BASE_URL%/}"
: "${PROJECTDAVID_API_KEY:?Set your API key}"

curl -fsS "$BASE_URL/v1/assistants" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON'
{
  "name": "Analysis Assistant",
  "model": "hyperbolic/deepseek-v4-flash-0731",
  "instructions": "Use Python to analyse data and generate files when needed.",
  "tools": [
    {
      "type": "code_interpreter"
    }
  ]
}
JSON
```

## Execute

Use the returned assistant in the [Inference](/docs/sdk-inference) workflow, with a registered provider credential. Create a thread, message and run, then consume the inference stream. A tool declaration makes the capability available; it does not guarantee that the model will invoke it.

Try a request such as: “Calculate the mean of 12, 18 and 24 using Python, and save the result as a CSV.”

## Stream execution output

| Raw event type | Python SDK event | Content |
|---|---|---|
| `hot_code` | `HotCodeEvent` | Candidate code before execution |
| `code_status` | `CodeStatusEvent` | Execution activity and state |
| `hot_code_output` | `CodeExecutionOutputEvent` | Execution text |
| `code_interpreter_file` | `CodeExecutionGeneratedFileEvent` | Generated file metadata |

Route candidate code, output and assistant text separately. Generated file events expose `file_id`, `filename`, `mime_type`, and optional `url` and `base64_data` fields in the SDK. Use the file ID as the stable reference; handle absent or expired download URLs through the Files API.

Sandbox isolation and available packages depend on deployment configuration. Do not treat execution in a container as a security guarantee.

## Reference

- [Tools](/docs/sdk-tools)
- [Assistants](/docs/sdk-assistants)
- [Streaming Protocol](/docs/sdk-stream-contract)
- [Event reference](/docs/sdk-reference-events)
- [Files](/docs/sdk-files)
