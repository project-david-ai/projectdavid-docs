---
title: File Search
category: sdk
slug: sdk-file-search
nav_exclude: true
---

# File Search

Let an assistant retrieve relevant document passages from a vector store during inference.

## Prepare a vector store

Follow [Vector Stores](/docs/sdk-Vector-Store) to create a store and index documents. Use compatible embedding models and dimensions for ingestion and retrieval. Ordinary file uploads alone do not populate a vector store.

## Attach a store to an assistant

Complete [Authentication](/docs/api_keys) first. Set `VECTOR_STORE_ID` in your environment to the ID of a store you have indexed and can access.

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
    name="Knowledge Assistant",
    model="hyperbolic/deepseek-v4-flash-0731",
    instructions="Answer questions using the indexed documents.",
    tools=[{"type": "file_search"}],
    tool_resources={"file_search": {"vector_store_ids": [os.environ["VECTOR_STORE_ID"]]}},
)
print(assistant.id)
```

```curl interface=curl
BASE_URL="${PROJECTDAVID_BASE_URL:-https://api.projectdavid.co.uk}"
BASE_URL="${BASE_URL%/}"
: "${PROJECTDAVID_API_KEY:?Set your API key}"
: "${VECTOR_STORE_ID:?Set your vector store ID}"

jq -n --arg id "$VECTOR_STORE_ID" '{
  name: "Knowledge Assistant",
  model: "hyperbolic/deepseek-v4-flash-0731",
  instructions: "Answer questions using the indexed documents.",
  tools: [{type: "file_search"}],
  tool_resources: {file_search: {vector_store_ids: [$id]}}
}' | curl -fsS "$BASE_URL/v1/assistants" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary @-
```

## Execute

Use the returned assistant in the [Inference](/docs/sdk-inference) workflow, with a registered provider credential. Create a thread, message and run, then consume the inference stream. A tool declaration makes the capability available; it does not guarantee that the model will invoke it.

Ask a question about the indexed documents. The model and runtime must support file search. If retrieval is poor, check that ingestion completed, the correct store is attached and the embedding configuration is compatible. Test direct retrieval using the Vector Stores guide before diagnosing the assistant's synthesis.

## Reference

- [Vector Stores](/docs/sdk-Vector-Store)
- [Vector Stores SDK Reference](/docs/sdk-reference-vector-stores)
- [Tools](/docs/sdk-tools)
- [Inference](/docs/sdk-inference)
