---
title: Threads
category: sdk
slug: sdk-threads
lifecycle_step: create_thread
nav_order: 3
---

# Threads

A thread is a conversation container. It holds the message history between a user and an assistant and persists across multiple interactions.

## Create a thread

```python
from projectdavid import Entity

client = Entity()

thread = client.threads.create_thread()
print(thread.id)  # thread_abc123
```


## Retrieve a thread

```python
thread = client.threads.retrieve_thread(thread_id="thread_abc123")
print(thread.id)
```

## Update a thread

```python
thread = client.threads.update_thread(
    thread_id="thread_abc123",
    meta_data={"status": "resolved"}
)
```

## List threads for a user

```python
threads = client.threads.list_threads(user_id="user_abc123")
print(threads)  # ["thread_abc123", "thread_def456"]
```

## Delete a thread

```python
result = client.threads.delete_thread(thread_id="thread_abc123")
print(result.deleted)  # True
```

Returns `None` if the thread does not exist.

## Notes

- Multiple assistants can share the same thread.
- Metadata is arbitrary key/value and can be updated at any time.
- Deleting a thread is permanent.