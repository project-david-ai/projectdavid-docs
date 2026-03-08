---
title: Vector Store
category: sdk
slug: sdk-Vector-Store
nav_order: 10
---



# Vector Store
## Overview

A high-performance vector storage and retrieval system designed for AI/ML workflows. This implementation provides:

Associated methods can be used to extend the memory and contextual recall of AI assistants beyond the context window, allowing for Retrieval Augmented Generations (RAG).  

Client-side document chunking and vectorization requires the `embeddings` extra. Without it, local file processing will fail.

```bash
pip install "projectdavid[embeddings]"
```


# File Search — Vector Store Pipeline

```python
# tests/integration/vector_store_pipeline.py
import json
import os

from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv()



client = Entity(
    base_url=os.getenv("BASE_URL", "http://localhost:9000"),
    api_key=os.getenv("ENTITIES_API_KEY"),  # This is the entities user API Key
)

# --------------------------
# 1. Create a vector store
# ---------------------------
print("--- Creating Vector Store ---")
vector_store = client.vectors.create_vector_store(name="Test Vector Store 1")
print(f"Created: {vector_store.id}\n")

# ---------------------------------
# 2. Upload file to vector store
# ----------------------------------
print("--- Uploading File ---")
save_file_to_store = client.vectors.add_file_to_vector_store(
    vector_store_id=vector_store.id,
    file_path="People_on_war _241118_200546.pdf",
)
print(f"File Uploaded: {save_file_to_store.file_name}\n")

# ---------------------------
# 3. List files in store
# ---------------------------
list_files_in_store = client.vectors.list_store_files(vector_store_id=vector_store.id)
print("--- Files in Store ---")
print(list_files_in_store)
print("\n")

# --------------------------------------
# 4. Attach to Assistant (and enable tool!)
# ----------------------------------------
print("--- Updating Assistant ---")
update_assistant = client.assistants.update_assistant(
    assistant_id="your_assistant_id_here",
    tools=[{"type": "file_search"}],  # 👈 CRITICAL: Tells the LLM the tool exists!
    tool_resources={"file_search": {"vector_store_ids": [vector_store.id]}},
)

print(f"Assistant Tools: {update_assistant.tools}")
print(f"Assistant Resources: {update_assistant.tool_resources}\n")
```


---

## Supported File Types

| Type | Extensions |
|------|------------|
| PDF | `.pdf` |
| Text / Markup / Code | `.txt` `.md` `.rst` `.py` `.js` `.ts` `.html` `.css` `.c` `.cpp` `.cs` `.go` `.java` `.php` `.rb` `.sh` `.tex` |
| CSV | `.csv` |
| Office | `.doc` `.docx` `.pptx` |
| JSON | `.json` |