---
title: Messages
category: sdk
slug: sdk-messages
lifecycle_step: create_message
nav_order: 4
---

# Messages

A message is a single entry in a thread. Messages have a role (`user`, `assistant`, or `tool`) and carry text or multimodal content.

## Create a message

```python
from projectdavid import Entity

client = Entity()

message = client.messages.create_message(
    thread_id="thread_abc123",
    assistant_id="asst_abc123",
    content="Tell me about current trends in AI",
    role="user"
)

print(message.id)  # msg_abc123
```

## Create a multimodal message

Pass a content array to include images alongside text.

```python
message = client.messages.create_message(
    thread_id="thread_abc123",
    assistant_id="asst_abc123",
    role="user",
    content=[
        {"type": "text", "text": "What is in this image?"},
        {"type": "image_url", "image_url": {"url": "https://example.com/image.jpg"}}
    ]
)
```

Images are automatically downloaded and uploaded to file storage. Base64 data URIs are also supported.

## Retrieve a message

```python
message = client.messages.retrieve_message(message_id="msg_abc123")
print(message.content)
```

## Update a message

```python
message = client.messages.update_message(
    message_id="msg_abc123",
    content="Can you tell me more?"
)
```

## List messages in a thread

```python
messages = client.messages.list_messages(
    thread_id="thread_abc123",
    limit=20,
    order="asc"
)

for msg in messages.data:
    print(msg.role, msg.content)
```

## Delete a message

```python
result = client.messages.delete_message(message_id="msg_abc123")
print(result.deleted)  # True
```

## Notes

- `role` must be one of `user`, `assistant`, or `tool`.
- Multimodal content is normalized to a text string and an attachments list before storage.
- `list_messages` returns an envelope with a `data` array and pagination metadata.