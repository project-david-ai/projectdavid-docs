---
title: Threads
category: sdk
slug: sdk-threads
lifecycle_step: create_thread
nav_order: 3
---

# Threads

A Thread holds conversation history independently of the Assistant that
executes a Run. Reuse its ID for subsequent interactions in the same
conversation; create a new Thread for a separate conversation.

## Configure

Complete [Authentication](/docs/api_keys) first. Run the examples in the same
Python or Bash session. The cURL examples use `jq` to extract identifiers.

```python interface=python
import os

from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv()

client = Entity(
    base_url=os.getenv("PROJECTDAVID_BASE_URL", "https://api.projectdavid.co.uk"),
    api_key=os.environ["PROJECTDAVID_API_KEY"],
)
```

```bash interface=curl
BASE_URL="${PROJECTDAVID_BASE_URL:-https://api.projectdavid.co.uk}"
set -o pipefail
```

## Create a thread

The authenticated user becomes the owner. Metadata can identify the
conversation in your application without becoming a conversation message.

```python interface=python
thread = client.threads.create_thread(
    meta_data={"title": "Network troubleshooting"},
)

thread_id = thread.id
owner_id = thread.owner_id or os.environ["PROJECTDAVID_USER_ID"]
print(thread_id)
```

```curl interface=curl
THREAD=$(curl -fsS "$BASE_URL/v1/threads" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"meta_data":{"title":"Network troubleshooting"}}')

THREAD_ID=$(jq -er '.id' <<< "$THREAD")
OWNER_ID=$(jq -r '.owner_id // empty' <<< "$THREAD")
OWNER_ID="${OWNER_ID:-${PROJECTDAVID_USER_ID:?Set your account user ID}}"
printf '%s\n' "$THREAD_ID"
```

If the response does not include `owner_id`, set `PROJECTDAVID_USER_ID` to your
own account ID before running the example. The authenticated owner is included
among the participants automatically.

## Retrieve a thread

```python interface=python
thread = client.threads.retrieve_thread(thread_id=thread_id)
print(thread.meta_data)
```

```curl interface=curl
curl -fsS "$BASE_URL/v1/threads/$THREAD_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY"
```

The thread record contains its ID, creation time, metadata and tool resources.
The read-only `owner_id` identifies its canonical owner when supplied.
Retrieve conversation messages separately using the [Messages](/docs/sdk-messages) API.

## Update metadata

Use the dedicated metadata operation to update application-specific conversation
state. Supply the complete metadata object you want to retain.

```python interface=python
thread = client.threads.update_thread_metadata(
    thread_id=thread_id,
    new_metadata={
        "title": "Network troubleshooting",
        "status": "resolved",
    },
)
```

```curl interface=curl
curl -fsS -X PUT "$BASE_URL/v1/threads/$THREAD_ID/metadata" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Network troubleshooting","status":"resolved"}'
```

For broader changes, use the thread update operation. It accepts `participant_ids`,
`meta_data` and `tool_resources`. See the [Threads reference](/docs/sdk-reference-threads)
for the full signature.

```python interface=python
thread = client.threads.update_thread(
    thread_id=thread_id,
    meta_data={"title": "Network troubleshooting", "status": "resolved"},
)
```

```curl interface=curl
curl -fsS -X PUT "$BASE_URL/v1/threads/$THREAD_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"meta_data":{"title":"Network troubleshooting","status":"resolved"}}'
```

## List threads

Use thread records to populate a conversation list without retrieving every
thread individually.

```python interface=python
threads = client.threads.list_thread_records(user_id=owner_id)

for thread in threads:
    print(thread.id, thread.meta_data)
```

```curl interface=curl
curl -fsS "$BASE_URL/v1/threads/user/$OWNER_ID/records" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY"
```

For a list of identifiers only:

```python interface=python
thread_ids = client.threads.list_threads(user_id=owner_id)
print(thread_ids)
```

```curl interface=curl
curl -fsS "$BASE_URL/v1/threads/user/$OWNER_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY"
```

A thread record may include `materialized`, indicating whether at least one
persisted user message exists. A null or absent value means the producer has
not supplied that state.

## Delete a thread

Delete a thread when the application no longer needs the conversation.
Only delete a thread you intend to remove.

```python interface=python
result = client.threads.delete_thread(thread_id=thread_id)
print(result.deleted if result is not None else False)
```

```curl interface=curl
curl -fsS -X DELETE "$BASE_URL/v1/threads/$THREAD_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY"
```

A successful deletion returns a `thread.deleted` object with `deleted: true`.
The Python SDK returns `None` for HTTP 404; cURL reports the HTTP error.

## Reference

- [Threads reference](/docs/sdk-reference-threads)
- [Messages](/docs/sdk-messages)
- [Runs](/docs/sdk-runs)
- [HTTP API reference](/docs/api-reference)
