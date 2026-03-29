---
title: Assistants
category: sdk
slug: sdk-assistants
nav_order: 2
---


# Assistants

## Overview

Create an Assistant by defining its custom instructions and picking a model. If helpful, add files and enable tools like Code Interpreter, File Search, and Function calling.

### Basic Assistant Operations

```python

from projectdavid import Entity

client = Entity()

# Create assistant

assistant = client.assistants.create_assistant(
    name='Mathy',
    description='test_case',
    model='llama3.1',
    instructions='You are a helpful math tutor.'
)
print(f"Assistant created: ID: {assistant.id}")


# Retrieve an Assistant

retrieved_assistant = client.assistants.retrieve_assistant(assistant_id=assistant.id)

print(retrieved_assistant)

# Update and assistant

client.assistants.update_assistant(
    assistant_id=assistant.id,
    name='Mathy',
    description='test_update',
    instructions='You are now a world class poker player.'
)

# Delete an assistant 

client.assistants.delete_assistant(assistant_id=assistant.id)
```


## Inference Parameters

You can control how the model generates responses by setting `max_tokens`,
`temperature`, and `top_p` at assistant creation time. These parameters are
stored on the assistant record and applied automatically to every inference
call made by that assistant.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `max_tokens` | `int` or `None` | `None` | Maximum tokens to generate per response. When `None`, the model provider's default applies. |
| `temperature` | `float` | `1.0` | Sampling temperature. Lower values produce more focused, deterministic output. Higher values produce more varied output. Valid range: `0.0` – `2.0`. |
| `top_p` | `float` or `None` | `None` | Nucleus sampling threshold. When `None`, the provider default applies. Valid range: `0.0` – `1.0`. |

### Setting Parameters at Creation
```python
assistant = client.assistants.create_assistant(
    name='Precise Assistant',
    model='llama3.1',
    instructions='You are a precise technical assistant.',
    max_tokens=2048,
    temperature=0.2,
    top_p=0.85,
)
```

### Deferring to Model Defaults

If you omit these parameters or pass `None`, the model provider's built-in
defaults are used. This is the recommended approach unless you have a specific
reason to override them.
```python
# All three parameters omitted — provider defaults apply
assistant = client.assistants.create_assistant(
    name='Standard Assistant',
    model='llama3.1',
    instructions='You are a helpful assistant.',
)
```

### Updating Parameters on an Existing Assistant
```python
client.assistants.update_assistant(
    assistant_id=assistant.id,
    temperature=0.7,
    max_tokens=4096,
)
```

### Common Configurations
```python
# Creative writing — high temperature, no token cap
assistant = client.assistants.create_assistant(
    name='Creative Writer',
    model='llama3.1',
    instructions='You are a creative writing assistant.',
    temperature=1.4,
    top_p=0.95,
)

# Precise technical assistant — low temperature, capped output
assistant = client.assistants.create_assistant(
    name='Technical Assistant',
    model='llama3.1',
    instructions='You are a precise technical assistant.',
    temperature=0.2,
    max_tokens=2048,
)

# Agentic loop — needs longer outputs for tool calls
assistant = client.assistants.create_assistant(
    name='Agent',
    model='llama3.1',
    instructions='You are an autonomous agent.',
    agent_mode=True,
    temperature=0.6,
    max_tokens=8192,
)
```