---
title: Scratchpads
category: sdk
slug: sdk-scratchpad
nav_order: 1
---

# Scratchpads

A Scratchpad is a thread-scoped resource for recording working state outside
conversation messages. Each owned thread has at most one canonical Scratchpad.
Applications manage it through `client.scratchpads` or the HTTP API, independently
of the model-facing scratchpad tool interface.

| State | Purpose |
|---|---|
| Metadata | Application-defined resource attributes |
| Content | Replaceable textual working state |
| Entries | Ordered, append-oriented ledger |

## Configure

Complete [Authentication](/docs/api_keys) and create a [Thread](/docs/sdk-threads).
Set `PROJECTDAVID_THREAD_ID` to the ID of a thread you own. The cURL examples
use Bash and `jq`; export the environment variables before running them.
Run the examples in order in the same Python or shell session.

```python interface=python
import os

from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv()

client = Entity(
    base_url=os.getenv("PROJECTDAVID_BASE_URL", "https://api.projectdavid.co.uk"),
    api_key=os.environ["PROJECTDAVID_API_KEY"],
)
thread_id = os.environ["PROJECTDAVID_THREAD_ID"]
```

```curl interface=curl
set -euo pipefail
BASE_URL="${PROJECTDAVID_BASE_URL:-https://api.projectdavid.co.uk}"
THREAD_ID="${PROJECTDAVID_THREAD_ID:?Set the thread ID}"
: "${PROJECTDAVID_API_KEY:?Set the Project David API key}"
```

## Create a Scratchpad

Create a Scratchpad for a thread that does not yet have one. The server
assigns its ID and ownership; subsequent state operations use that ID.
If the thread already has a Scratchpad, retrieve it by thread instead.

```python interface=python
scratchpad = client.scratchpads.create_scratchpad(thread_id=thread_id)
scratchpad_id = scratchpad.id
print(scratchpad_id)
```

```curl interface=curl
SCRATCHPAD=$(jq -n --arg thread_id "$THREAD_ID" '{thread_id:$thread_id}' \
  | curl -fsS "$BASE_URL/v1/scratchpads" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" \
      -H "Content-Type: application/json" --data-binary @-)
SCRATCHPAD_ID=$(jq -er '.id' <<< "$SCRATCHPAD")
printf '%s\n' "$SCRATCHPAD_ID"
```

## Retrieve and list

Resolve a Scratchpad from its thread, retrieve it directly by ID, or list
resources visible to the authenticated caller. Listing returns a `data`
array; the current interface has no pagination parameters.

```python interface=python
scratchpad = client.scratchpads.retrieve_scratchpad_by_thread(thread_id)
scratchpad_id = scratchpad.id

record = client.scratchpads.retrieve_scratchpad(scratchpad_id)
print(record.meta_data)

for record in client.scratchpads.list_scratchpads().data:
    print(record.id, record.thread_id)
```

```curl interface=curl
SCRATCHPAD_ID=$(curl -fsS "$BASE_URL/v1/threads/$THREAD_ID/scratchpad" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" | jq -er '.id')

curl -fsS "$BASE_URL/v1/scratchpads/$SCRATCHPAD_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" | jq '.meta_data'

curl -fsS "$BASE_URL/v1/scratchpads" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" | jq '.data[] | {id, thread_id}'
```

## Update metadata

Use metadata to label application state, not to store the working body or
append ledger entries.

```python interface=python
scratchpad = client.scratchpads.update_scratchpad(
    scratchpad_id,
    meta_data={"purpose": "research", "phase": "verification"},
)
```

```curl interface=curl
curl -fsS -X PATCH "$BASE_URL/v1/scratchpads/$SCRATCHPAD_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"meta_data":{"purpose":"research","phase":"verification"}}'
```

## Working content

Use `set_content()` to replace the current working body. Read it back with
`get_content()`. This is a replacement operation, not an append operation.

```python interface=python
client.scratchpads.set_content(
    scratchpad_id,
    "Research plan: verify primary sources.",
)
state = client.scratchpads.get_content(scratchpad_id)
print(state.content)
```

```curl interface=curl
curl -fsS -X PUT "$BASE_URL/v1/scratchpads/$SCRATCHPAD_ID/content" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content":"Research plan: verify primary sources."}'

curl -fsS "$BASE_URL/v1/scratchpads/$SCRATCHPAD_ID/content" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" | jq -r '.content'
```

## Entry ledger

Append observations or progress independently of the working body. Entries
are returned in an ordered `data` array with their content and creation time.
Individual entries cannot be edited through this API, but the ledger can be
cleared. Do not use it as an immutable compliance audit log.

```python interface=python
client.scratchpads.append_entry(scratchpad_id, "Primary source verified.")

for entry in client.scratchpads.list_entries(scratchpad_id).data:
    print(entry.created_at, entry.content)
```

```curl interface=curl
curl -fsS "$BASE_URL/v1/scratchpads/$SCRATCHPAD_ID/entries" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content":"Primary source verified."}'

curl -fsS "$BASE_URL/v1/scratchpads/$SCRATCHPAD_ID/entries" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  | jq '.data[] | {created_at, content}'
```

## Clear mutable state

Choose the scope of the operation. Clearing state retains the Scratchpad
resource and its metadata.

| Scope | SDK method | HTTP operation |
|---|---|---|
| Content only | `clear_content(id)` | `DELETE /v1/scratchpads/{id}/content` |
| Entries only | `clear_entries(id)` | `DELETE /v1/scratchpads/{id}/entries` |
| Both | `clear_scratchpad(id)` | `POST /v1/scratchpads/{id}/clear` |

The following example clears both content and entries. Run it only when
that state is no longer needed.

```python interface=python
result = client.scratchpads.clear_scratchpad(scratchpad_id)
print(result.scope, result.cleared)
```

```curl interface=curl
curl -fsS -X POST "$BASE_URL/v1/scratchpads/$SCRATCHPAD_ID/clear" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" | jq '{scope, cleared}'
```

## Delete a Scratchpad

Delete the resource itself only when it is no longer required. This is
not the same as clearing its working state.

```python interface=python
result = client.scratchpads.delete_scratchpad(scratchpad_id)
print(result.deleted)
```

```curl interface=curl
curl -fsS -X DELETE "$BASE_URL/v1/scratchpads/$SCRATCHPAD_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" | jq '.deleted'
```

## Error handling

The SDK validates responses against typed models. HTTP failures raise
`httpx.HTTPStatusError`; response validation failures raise `ValueError`.
With cURL, `-f` makes HTTP error responses return a non-zero exit status.

## Reference

- [Scratchpads SDK Reference](/docs/sdk-reference-scratchpads)
- [Threads](/docs/sdk-threads)
- [HTTP API Reference](/docs/api-reference)
