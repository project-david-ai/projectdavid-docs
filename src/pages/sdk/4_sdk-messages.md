---
title: Messages
category: sdk
slug: sdk-messages
lifecycle_step: create_message
nav_order: 4
---

# Messages

A Message is an entry in a Thread's conversation history. Creating a user
message records input; a [Run](/docs/sdk-runs) executes the assistant.

## Configure

Complete [Authentication](/docs/api_keys) and create an [Assistant](/docs/sdk-assistants)
and a [Thread](/docs/sdk-threads). Set `PROJECTDAVID_ASSISTANT_ID` and
`PROJECTDAVID_THREAD_ID` to their IDs. Use the same authenticated account.
Run the examples in the same Python or Bash session. The cURL examples use `jq`.

```python interface=python
import os

from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv()

client = Entity(
    base_url=os.getenv("PROJECTDAVID_BASE_URL", "https://api.projectdavid.co.uk"),
    api_key=os.environ["PROJECTDAVID_API_KEY"],
)

assistant_id = os.environ["PROJECTDAVID_ASSISTANT_ID"]
thread_id = os.environ["PROJECTDAVID_THREAD_ID"]
```

```bash interface=curl
BASE_URL="${PROJECTDAVID_BASE_URL:-https://api.projectdavid.co.uk}"
ASSISTANT_ID="${PROJECTDAVID_ASSISTANT_ID:?Set the assistant ID}"
THREAD_ID="${PROJECTDAVID_THREAD_ID:?Set the thread ID}"
set -o pipefail
```

## Create a message

```python interface=python
message = client.messages.create_message(
    thread_id=thread_id,
    assistant_id=assistant_id,
    role="user",
    content="Explain how BGP selects its best path.",
)

message_id = message.id
print(message_id)
```

```curl interface=curl
MESSAGE_ID=$(jq -n \
  --arg thread_id "$THREAD_ID" \
  --arg assistant_id "$ASSISTANT_ID" \
  '{thread_id:$thread_id,assistant_id:$assistant_id,
    role:"user",content:"Explain how BGP selects its best path."}' \
  | curl -fsS "$BASE_URL/v1/messages" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" \
      -H 'Content-Type: application/json' \
      --data-binary @- \
  | jq -er '.id')
```

The message ID identifies the stored input. Message creation does not start
inference. Optional `meta_data` stores application-specific information.

Use the `user` role for application input. Assistant responses are produced
by execution; tool responses belong to the [function calling](/docs/sdk-function-calls)
workflow.

## Attach an image

For a vision-capable model, upload an image and reference its file ID in a
message. Place an image named `diagram.png` in your working directory for
this example.

```python interface=python
image = client.files.upload_file(
    file_path="diagram.png",
    purpose="vision",
)

image_message = client.messages.create_message(
    thread_id=thread_id,
    assistant_id=assistant_id,
    role="user",
    content=[
        {"type": "text", "text": "Describe this diagram."},
        {"type": "image_file", "image_file": {"file_id": image.id}},
    ],
)
```

```curl interface=curl
FILE_ID=$(curl -fsS "$BASE_URL/v1/uploads" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -F 'purpose=vision' \
  -F 'file=@diagram.png' \
  | jq -er '.id')

jq -n \
  --arg thread_id "$THREAD_ID" \
  --arg assistant_id "$ASSISTANT_ID" \
  --arg file_id "$FILE_ID" \
  '{thread_id:$thread_id,assistant_id:$assistant_id,
    role:"user",content:"Describe this diagram.",
    attachments:[{type:"image",file_id:$file_id}]}' \
  | curl -fsS "$BASE_URL/v1/messages" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" \
      -H 'Content-Type: application/json' \
      --data-binary @-
```

The SDK converts multimodal content blocks into text and attachment references.
Its `image_url` blocks also support HTTP(S) URLs and base64 image data URIs;
the SDK downloads or decodes these images and uploads them before creating the
message. Raw HTTP clients can upload files explicitly and send `attachments`
as above.

## Retrieve a message

```python interface=python
message = client.messages.retrieve_message(message_id=message_id)
print(message.role, message.content)
```

```curl interface=curl
curl -fsS "$BASE_URL/v1/messages/$MESSAGE_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY"
```

## List messages

Retrieve messages in conversation sequence order. Use `asc` for earliest
first or `desc` for latest first. The default limit is 20.

```python interface=python
messages = client.messages.list_messages(
    thread_id=thread_id,
    limit=20,
    order="asc",
)

for message in messages.data:
    print(message.role, message.content)
```

```curl interface=curl
curl -fsS "$BASE_URL/v1/threads/$THREAD_ID/messages?limit=20&order=asc" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  | jq '.data[] | {role, content}'
```

The response envelope contains `data`, `first_id`, `last_id` and `has_more`.
Currently, the endpoint accepts `limit` and `order`, but no pagination cursor.
A full result set can set `has_more` even when no further records exist.

## Delete a message

Only delete a message you intend to remove from the conversation. This example
removes the first user message created above, not the image message.

```python interface=python
result = client.messages.delete_message(message_id=message_id)
print(result.deleted)
```

```curl interface=curl
curl -fsS -X DELETE "$BASE_URL/v1/messages/$MESSAGE_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY"
```

A successful deletion returns `object: "thread.message.deleted"` with
`deleted: true`. The SDK raises an HTTP error if the request fails.
Message deletion is not a guarantee of erasure of attachments, execution
records or cached conversation state.

There is no supported public message-update endpoint in the current Core
contract. Submit a new message to correct or clarify previous input.

## Reference

- [Messages reference](/docs/sdk-reference-messages)
- [Files](/docs/sdk-files)
- [Runs](/docs/sdk-runs)
- [HTTP API reference](/docs/api-reference)
