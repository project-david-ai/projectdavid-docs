---
title: Scratchpad Client
category: sdk
slug: sdk-scratchpad
nav_order: 1
---



# Scratchpad Client

`ScratchpadsClient` provides the SDK interface for first-class Scratchpad resources.

It is separate from the model-facing scratchpad tool methods exposed through
`ToolsClient`.

The distinction is:

```text
ToolsClient.scratchpad_*
    → model-facing compatibility API
    → operates through the tool/runtime layer

ScratchpadsClient
    → first-class resource API
    → addresses canonical Scratchpad resources by scratchpad ID
```

`ScratchpadsClient` exposes four groups of operations:

```text
Resource plane
Content plane
Entry ledger
Mutable-state lifecycle
```

All responses are validated against Project David Pydantic models before being
returned to the caller.

---

## Accessing the Client

The client is exposed as the Scratchpad resource interface associated with an
authenticated Project David SDK client.

Conceptually:

```python
scratchpads = client.scratchpads
```

The exact top-level client construction depends on the SDK configuration used by
the application.

Every request is authenticated through the underlying `BaseAPIClient`.

---

# Resource Plane

The resource plane manages Scratchpad resources themselves.

It handles creation, retrieval, listing, metadata updates, and deletion.

---

## `create_scratchpad`

Creates a Scratchpad associated with a thread.

```python
scratchpad = client.scratchpads.create_scratchpad(
    thread_id="thread_abc123",
)
```

### Signature

```python
create_scratchpad(
    thread_id: str,
) -> ScratchpadRead
```

### HTTP request

```http
POST /v1/scratchpads
```

### Request body

```json
{
  "thread_id": "thread_abc123"
}
```

### Returns

```python
ScratchpadRead
```

The returned object represents the newly created canonical Scratchpad resource.

### Notes

A Scratchpad is created against a specific `thread_id`.

The caller does not supply a Scratchpad ID; the server creates the resource and
returns its canonical representation.

---

## `retrieve_scratchpad`

Retrieves a Scratchpad directly by Scratchpad ID.

```python
scratchpad = client.scratchpads.retrieve_scratchpad(
    scratchpad_id="scratchpad_abc123",
)
```

### Signature

```python
retrieve_scratchpad(
    scratchpad_id: str,
) -> ScratchpadRead
```

### HTTP request

```http
GET /v1/scratchpads/{scratchpad_id}
```

### Returns

```python
ScratchpadRead
```

Use this method when the canonical Scratchpad ID is already known.

---

## `retrieve_scratchpad_by_thread`

Retrieves the Scratchpad associated with a thread.

```python
scratchpad = client.scratchpads.retrieve_scratchpad_by_thread(
    thread_id="thread_abc123",
)
```

### Signature

```python
retrieve_scratchpad_by_thread(
    thread_id: str,
) -> ScratchpadRead
```

### HTTP request

```http
GET /v1/threads/{thread_id}/scratchpad
```

### Returns

```python
ScratchpadRead
```

This is useful when the caller knows the thread but does not already have the
Scratchpad ID.

---

## `list_scratchpads`

Lists Scratchpad resources visible to the authenticated caller.

```python
scratchpads = client.scratchpads.list_scratchpads()
```

### Signature

```python
list_scratchpads() -> ScratchpadList
```

### HTTP request

```http
GET /v1/scratchpads
```

### Returns

```python
ScratchpadList
```

No filtering or pagination parameters are exposed by this SDK method.

---

## `update_scratchpad`

Updates Scratchpad resource metadata.

```python
scratchpad = client.scratchpads.update_scratchpad(
    scratchpad_id="scratchpad_abc123",
    meta_data={
        "purpose": "deep-research",
        "stage": "verification",
    },
)
```

### Signature

```python
update_scratchpad(
    scratchpad_id: str,
    *,
    meta_data: Dict[str, Any],
) -> ScratchpadRead
```

### HTTP request

```http
PATCH /v1/scratchpads/{scratchpad_id}
```

### Request body

```json
{
  "meta_data": {
    "purpose": "deep-research",
    "stage": "verification"
  }
}
```

### Returns

```python
ScratchpadRead
```

### Important

This method updates the Scratchpad resource's `meta_data`.

It does **not** replace Scratchpad textual content and does **not** append a
ledger entry.

For those operations use:

```text
set_content()
append_entry()
```

respectively.

---

## `delete_scratchpad`

Deletes a Scratchpad resource.

```python
result = client.scratchpads.delete_scratchpad(
    scratchpad_id="scratchpad_abc123",
)
```

### Signature

```python
delete_scratchpad(
    scratchpad_id: str,
) -> ScratchpadDeleted
```

### HTTP request

```http
DELETE /v1/scratchpads/{scratchpad_id}
```

### Returns

```python
ScratchpadDeleted
```

This operates on the Scratchpad resource itself rather than merely clearing its
mutable content.

---

# Content Plane

The content plane manages the Scratchpad's current textual working state.

These methods operate on:

```text
/v1/scratchpads/{scratchpad_id}/content
```

---

## `get_content`

Retrieves the current Scratchpad content.

```python
content = client.scratchpads.get_content(
    scratchpad_id="scratchpad_abc123",
)
```

### Signature

```python
get_content(
    scratchpad_id: str,
) -> ScratchpadContentRead
```

### HTTP request

```http
GET /v1/scratchpads/{scratchpad_id}/content
```

### Returns

```python
ScratchpadContentRead
```

This reads the Scratchpad's current content state without modifying it.

---

## `set_content`

Replaces the Scratchpad's current content.

```python
content = client.scratchpads.set_content(
    scratchpad_id="scratchpad_abc123",
    content="Current research plan and working state.",
)
```

### Signature

```python
set_content(
    scratchpad_id: str,
    content: str,
) -> ScratchpadContentRead
```

### HTTP request

```http
PUT /v1/scratchpads/{scratchpad_id}/content
```

### Request body

```json
{
  "content": "Current research plan and working state."
}
```

### Returns

```python
ScratchpadContentRead
```

### Important

`set_content()` is a replacement operation.

Use `append_entry()` when the intended operation is to add a new item to the
Scratchpad entry ledger rather than replace the current content state.

---

## `clear_content`

Clears the Scratchpad's current content.

```python
result = client.scratchpads.clear_content(
    scratchpad_id="scratchpad_abc123",
)
```

### Signature

```python
clear_content(
    scratchpad_id: str,
) -> ScratchpadStateCleared
```

### HTTP request

```http
DELETE /v1/scratchpads/{scratchpad_id}/content
```

### Returns

```python
ScratchpadStateCleared
```

This clears the current content state only.

It is distinct from:

```text
clear_entries()
clear_scratchpad()
delete_scratchpad()
```

---

# Entry Ledger

The entry ledger provides append-oriented Scratchpad history.

Entries are managed independently from the Scratchpad's current content.

---

## `append_entry`

Adds a new entry to the Scratchpad entry ledger.

```python
entry = client.scratchpads.append_entry(
    scratchpad_id="scratchpad_abc123",
    content="✅ Verified the source and recorded the result.",
)
```

### Signature

```python
append_entry(
    scratchpad_id: str,
    content: str,
) -> ScratchpadEntryRead
```

### HTTP request

```http
POST /v1/scratchpads/{scratchpad_id}/entries
```

### Request body

```json
{
  "content": "✅ Verified the source and recorded the result."
}
```

### Returns

```python
ScratchpadEntryRead
```

`append_entry()` creates an individual ledger entry rather than replacing the
Scratchpad's current content.

---

## `list_entries`

Retrieves the Scratchpad entry ledger.

```python
entries = client.scratchpads.list_entries(
    scratchpad_id="scratchpad_abc123",
)
```

### Signature

```python
list_entries(
    scratchpad_id: str,
) -> ScratchpadEntryList
```

### HTTP request

```http
GET /v1/scratchpads/{scratchpad_id}/entries
```

### Returns

```python
ScratchpadEntryList
```

This returns the collection of entries associated with the Scratchpad.

---

## `clear_entries`

Clears the Scratchpad entry ledger.

```python
result = client.scratchpads.clear_entries(
    scratchpad_id="scratchpad_abc123",
)
```

### Signature

```python
clear_entries(
    scratchpad_id: str,
) -> ScratchpadStateCleared
```

### HTTP request

```http
DELETE /v1/scratchpads/{scratchpad_id}/entries
```

### Returns

```python
ScratchpadStateCleared
```

This clears ledger entries without deleting the Scratchpad resource itself.

It is distinct from `clear_content()`, which operates on the current content
state.

---

# Mutable-State Lifecycle

The mutable-state lifecycle API provides a single operation for clearing the
Scratchpad's mutable state.

---

## `clear_scratchpad`

Clears the Scratchpad's mutable state.

```python
result = client.scratchpads.clear_scratchpad(
    scratchpad_id="scratchpad_abc123",
)
```

### Signature

```python
clear_scratchpad(
    scratchpad_id: str,
) -> ScratchpadStateCleared
```

### HTTP request

```http
POST /v1/scratchpads/{scratchpad_id}/clear
```

### Returns

```python
ScratchpadStateCleared
```

This is the Scratchpad-level clear operation.

It should not be confused with:

```text
clear_content()
    → DELETE /v1/scratchpads/{id}/content

clear_entries()
    → DELETE /v1/scratchpads/{id}/entries

clear_scratchpad()
    → POST /v1/scratchpads/{id}/clear

delete_scratchpad()
    → DELETE /v1/scratchpads/{id}
```

The SDK exposes these separately because they represent different resource
operations.

---

# Method Summary

| Method | Plane | HTTP | Purpose | Returns |
|---|---|---|---|---|
| `create_scratchpad(thread_id)` | Resource | `POST /v1/scratchpads` | Create a Scratchpad for a thread | `ScratchpadRead` |
| `retrieve_scratchpad(id)` | Resource | `GET /v1/scratchpads/{id}` | Retrieve by Scratchpad ID | `ScratchpadRead` |
| `retrieve_scratchpad_by_thread(thread_id)` | Resource | `GET /v1/threads/{thread_id}/scratchpad` | Retrieve by thread ID | `ScratchpadRead` |
| `list_scratchpads()` | Resource | `GET /v1/scratchpads` | List Scratchpads | `ScratchpadList` |
| `update_scratchpad(id, meta_data=...)` | Resource | `PATCH /v1/scratchpads/{id}` | Update metadata | `ScratchpadRead` |
| `delete_scratchpad(id)` | Resource | `DELETE /v1/scratchpads/{id}` | Delete resource | `ScratchpadDeleted` |
| `get_content(id)` | Content | `GET /v1/scratchpads/{id}/content` | Read current content | `ScratchpadContentRead` |
| `set_content(id, content)` | Content | `PUT /v1/scratchpads/{id}/content` | Replace current content | `ScratchpadContentRead` |
| `clear_content(id)` | Content | `DELETE /v1/scratchpads/{id}/content` | Clear current content | `ScratchpadStateCleared` |
| `append_entry(id, content)` | Entry ledger | `POST /v1/scratchpads/{id}/entries` | Append ledger entry | `ScratchpadEntryRead` |
| `list_entries(id)` | Entry ledger | `GET /v1/scratchpads/{id}/entries` | Read entry ledger | `ScratchpadEntryList` |
| `clear_entries(id)` | Entry ledger | `DELETE /v1/scratchpads/{id}/entries` | Clear entry ledger | `ScratchpadStateCleared` |
| `clear_scratchpad(id)` | Lifecycle | `POST /v1/scratchpads/{id}/clear` | Clear mutable Scratchpad state | `ScratchpadStateCleared` |

---

# Response Validation

Every `ScratchpadsClient` method passes server responses through a declared
Pydantic response model.

For example:

```python
return response_model.model_validate(response.json())
```

This means SDK callers receive validated Project David models rather than
unstructured response dictionaries.

If the server returns JSON that does not satisfy the expected schema, the client
raises:

```python
ValueError(
    "Scratchpad response validation failed: ..."
)
```

The original Pydantic `ValidationError` is retained as the exception cause.

---

# HTTP Errors

HTTP errors are not converted into Scratchpad-specific exception classes.

The client calls:

```python
response.raise_for_status()
```

and re-raises the resulting:

```python
httpx.HTTPStatusError
```

This allows callers to inspect the normal HTTP response information:

```python
try:
    scratchpad = client.scratchpads.retrieve_scratchpad(
        "scratchpad_missing"
    )
except httpx.HTTPStatusError as exc:
    print(exc.response.status_code)
    print(exc.response.text)
```

---

# Usage Example

A typical resource workflow can be expressed as:

```python
# Create a canonical Scratchpad for a thread.
scratchpad = client.scratchpads.create_scratchpad(
    thread_id="thread_abc123",
)

scratchpad_id = scratchpad.id

# Store current working content.
client.scratchpads.set_content(
    scratchpad_id,
    "📌 Research plan: verify primary sources.",
)

# Append an independently addressable ledger entry.
client.scratchpads.append_entry(
    scratchpad_id,
    "✅ Primary source verified.",
)

# Read current state.
content = client.scratchpads.get_content(scratchpad_id)
entries = client.scratchpads.list_entries(scratchpad_id)

# Update resource metadata.
client.scratchpads.update_scratchpad(
    scratchpad_id,
    meta_data={
        "phase": "complete",
    },
)

# Clear mutable state when required.
client.scratchpads.clear_scratchpad(scratchpad_id)

# Delete the Scratchpad resource when it is no longer required.
client.scratchpads.delete_scratchpad(scratchpad_id)
```

---

# ScratchpadsClient vs Model Scratchpad Tools

`ScratchpadsClient` should not be confused with the model-facing scratchpad tool
surface.

The two APIs serve different purposes:

| API | Purpose |
|---|---|
| `ScratchpadsClient` | Application/SDK access to canonical Scratchpad resources |
| `ToolsClient.scratchpad_*` | Compatibility/tool API used by model-facing runtime operations |

The resource client addresses Scratchpads by canonical Scratchpad ID and exposes
explicit resource, content, ledger, and lifecycle operations.

The model-facing tool API remains a separate compatibility surface.
```