---
title: Vector Stores
category: sdk
slug: sdk-Vector-Store
nav_order: 11
---

# Vector Stores

Index document content for semantic retrieval and retrieval-augmented
generation (RAG). A vector store contains text chunks, embeddings and
source metadata. Attach it to an assistant to make that content available
through file search.

## Configure

Complete [Authentication](/docs/api_keys) first. The Python SDK supports
local document processing and embedding generation through its optional
`embeddings` extra.

```bash
pip install 'projectdavid[embeddings]'
```

The cURL examples require Bash, `jq` and `uuidgen`. Generate embeddings
outside Core when using HTTP directly. Use the same embedding model and
vector dimensions for ingestion and retrieval, including assistant file search.
Run the examples in the same session.

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
BASE_URL="${BASE_URL%/}"
: "${PROJECTDAVID_API_KEY:?Set your API key}"
set -euo pipefail
```

## Create a vector store

The SDK defaults to 384 dimensions and cosine similarity. Match the store's
dimensions to the embedding model you intend to use.

```python interface=python
store = client.vectors.create_vector_store(
    name="Knowledge Base",
    vector_size=384,
    distance_metric="Cosine",
)
store_id = store.id
```

```curl interface=curl
STORE_ID=$(jq -n --arg id "vs_$(uuidgen)" '{
  shared_id: $id,
  name: "Knowledge Base",
  vector_size: 384,
  distance_metric: "COSINE",
  config: {}
}' | curl -fsS "$BASE_URL/v1/vector-stores" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary @- | jq -er '.id')
```

Core derives ownership from the API key. The SDK generates the shared ID
automatically; HTTP clients supply a unique `shared_id` themselves.

## Index a document

The SDK reads a local file, extracts and chunks its text, computes embeddings,
and submits the vectors and associated file record to Core. It does not use
the ordinary Files upload endpoint for this operation.

For direct HTTP, prepare `chunks.json` as an array of objects containing
`text` (a string) and `vector` (an array of 384 embedding numbers generated
by your embedding model). The example below indexes one batch and associates
it with a new vector-store file record. The `file_path` is a source identifier,
not a request for Core to read a local file.

```python interface=python
indexed = client.vectors.add_file_to_vector_store(
    vector_store_id=store_id,
    file_path="handbook.pdf",
    user_metadata={"category": "internal"},
)
print(indexed.id, indexed.status)
```

```curl interface=curl
FILE_RECORD_ID="vsf_$(uuidgen)"

jq -e --arg id "$FILE_RECORD_ID" '
  if length < 1 or length > 256 or
     any(.[]; (.text | type) != "string" or
              (.vector | type) != "array" or
              (.vector | length) != 384)
  then error("Expected 1–256 text chunks with 384-dimensional embeddings")
  else {
    texts: map(.text),
    vectors: map(.vector),
    metadata: (to_entries | map({
      source: "handbook.pdf",
      file_path: "handbook.pdf",
      file_name: "handbook.pdf",
      category: "internal",
      chunk_index: .key,
      file_id: $id
    })),
    file: {
      file_id: $id,
      file_name: "handbook.pdf",
      file_path: "handbook.pdf",
      status: "completed",
      meta_data: {category: "internal"}
    }
  } end
' chunks.json | curl -fsS "$BASE_URL/v1/vector-stores/$STORE_ID/vectors" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary @-
```

The HTTP schema accepts at most 256 chunks per upsert, with equal-length
`texts`, `vectors` and `metadata` arrays. The current SDK submits all chunks
from a file in one request; large documents can exceed this limit. This
example assumes a document that fits in one batch.

A vector-store file record is distinct from an uploaded Files API resource.

## Inspect indexed files

```python interface=python
for item in client.vectors.list_store_files(vector_store_id=store_id):
    print(item.file_path, item.status)
```

```curl interface=curl
curl -fsS "$BASE_URL/v1/vector-stores/$STORE_ID/files" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  | jq '.[] | {file_path, status}'
```

## Search

Search directly to verify retrieval before attaching the store to an assistant.
The SDK embeds your query locally. For cURL, prepare `query-vector.json` as a
JSON array containing the query's 384-dimensional embedding, computed with
the same embedding model as the indexed content.

```python interface=python
hits = client.vectors.vector_file_search_raw(
    vector_store_id=store_id,
    query_text="What is the incident response procedure?",
    top_k=5,
)
for hit in hits:
    print(hit["score"], hit["text"])
```

```curl interface=curl
jq -n --slurpfile query query-vector.json '{
  query_vector: $query[0],
  top_k: 5
}' | curl -fsS "$BASE_URL/v1/vector-stores/$STORE_ID/search" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary @- | jq '.[] | {score, text}'
```

Search returns matching chunks and scores, with source metadata. It does
not generate an assistant response.

## Attach to an assistant

Create a dedicated assistant with the `file_search` tool and associate the
store through `tool_resources`. For an existing assistant, preserve other
tool declarations and resources when updating its configuration.

```python interface=python
assistant = client.assistants.create_assistant(
    name="Knowledge Assistant",
    model="hyperbolic/deepseek-v4-flash-0731",
    instructions="Answer questions using the indexed knowledge base.",
    tools=[{"type": "file_search"}],
    tool_resources={"file_search": {"vector_store_ids": [store_id]}},
)
assistant_id = assistant.id
```

```curl interface=curl
ASSISTANT_ID=$(jq -n --arg id "$STORE_ID" '{
  name: "Knowledge Assistant",
  model: "hyperbolic/deepseek-v4-flash-0731",
  instructions: "Answer questions using the indexed knowledge base.",
  tools: [{type: "file_search"}],
  tool_resources: {file_search: {vector_store_ids: [$id]}}
}' | curl -fsS "$BASE_URL/v1/assistants" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary @- | jq -er '.id')
```

Use this assistant in the [Inference](/docs/sdk-inference) workflow.
The inference model and runtime must support file search. Configuring a
store does not itself execute a run.

## List and retrieve stores

```python interface=python
for item in client.vectors.list_my_vector_stores():
    print(item.id, item.name)

store = client.vectors.retrieve_vector_store_sync(store_id)
print(store.vector_size, store.file_count)
```

```curl interface=curl
curl -fsS "$BASE_URL/v1/vector-stores" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" | jq '.[] | {id, name}'

curl -fsS "$BASE_URL/v1/vector-stores/$STORE_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" | jq '{vector_size, file_count}'
```

## Remove indexed content

Use the `file_path` returned by the file listing to remove its associated
vectors. This does not delete an independent Files API upload.

```python interface=python
client.vectors.delete_file_from_vector_store(
    vector_store_id=store_id,
    file_path="handbook.pdf",
)
```

```curl interface=curl
curl -fsS -X DELETE --get \
  "$BASE_URL/v1/vector-stores/$STORE_ID/files" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  --data-urlencode 'file_path=handbook.pdf'
```

## Delete a vector store

Detach the store from assistants before deleting it. The default operation
soft-deletes the store; `permanent=true` requests deletion of the database
record and backing vector collection. Use permanent deletion only when you
intend to discard the index.

```python interface=python
client.vectors.delete_vector_store(store_id, permanent=False)
```

```curl interface=curl
curl -fsS -X DELETE \
  "$BASE_URL/v1/vector-stores/$STORE_ID?permanent=false" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY"
```

Both delete endpoints return HTTP 204 on success. The SDK returns a status
dictionary instead of the empty HTTP response.

## Reference

- [File search](/docs/sdk-file-search)
- [Files](/docs/sdk-files)
- [Assistants](/docs/sdk-assistants)
- [Vector Stores SDK Reference](/docs/sdk-reference-vector-stores)
- [HTTP API Reference](/docs/api-reference)
