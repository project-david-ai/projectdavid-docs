---
title: Files
category: sdk
slug: sdk-files
nav_order: 10
---

# Files

Upload files for use in messages, tools and vector stores. Project David
assigns each file an ID and associates ownership with the authenticated
account.

## Configure

Complete [Authentication](/docs/api_keys) and set `PROJECTDAVID_API_KEY`.
The cURL examples use Bash and `jq`. Run the examples in the same session.

```python interface=python
import os

from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv()

base_url = os.getenv(
    "PROJECTDAVID_BASE_URL", "https://api.projectdavid.co.uk"
).rstrip("/")
api_key = os.environ["PROJECTDAVID_API_KEY"]
client = Entity(base_url=base_url, api_key=api_key)
```

```bash interface=curl
BASE_URL="${PROJECTDAVID_BASE_URL:-https://api.projectdavid.co.uk}"
BASE_URL="${BASE_URL%/}"
: "${PROJECTDAVID_API_KEY:?Set your API key}"
set -euo pipefail
```

## Upload a file

Place a file named `report.pdf` in your working directory. Upload it with
its intended purpose and retain the returned ID. Ownership is derived
from the API key; no `user_id` is required.

```python interface=python
uploaded = client.files.upload_file(
    file_path="report.pdf",
    purpose="assistants",
)
file_id = uploaded.id
```

```curl interface=curl
FILE_ID=$(curl -fsS "$BASE_URL/v1/uploads" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -F 'purpose=assistants' \
  -F 'file=@report.pdf;type=application/pdf' \
  | jq -er '.id')
```

The HTTP request uses `multipart/form-data`. Core validates supported
file extensions and their content types. Storage support does not imply
that every model or tool can process every file format.

The SDK also supports binary file-like objects through
`upload_file_object()`. Its optional `metadata` argument is not transmitted
by the current implementation.

## Retrieve metadata

```python interface=python
record = client.files.retrieve_file(file_id=file_id)
print(record.filename, record.bytes, record.purpose)
```

```curl interface=curl
curl -fsS "$BASE_URL/v1/files/$FILE_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY"
```

This operation returns metadata, not file content. The SDK converts an
HTTP 404 response into `FileNotFoundError`.

## List files

List files belonging to the authenticated account, newest first.
Filter by purpose if needed.

The current SDK does not expose a listing method. The Python example
uses the standard library to call the HTTP endpoint directly.

```python interface=python
import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

params = {"limit": 20, "purpose": "assistants"}
request = Request(
    f"{base_url}/v1/files?{urlencode(params)}",
    headers={"X-API-Key": api_key},
)
with urlopen(request, timeout=30) as response:
    page = json.load(response)

for record in page["data"]:
    print(record["id"], record["filename"])
```

```curl interface=curl
PAGE=$(curl -fsS -G "$BASE_URL/v1/files" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  --data-urlencode 'limit=20' \
  --data-urlencode 'purpose=assistants')

jq '.data[] | {id, filename}' <<< "$PAGE"
```

The response includes `data`, `first_id`, `last_id` and `has_more`.
When `has_more` is true, pass `last_id` as the next request's `after`
parameter, retaining the same purpose filter. `limit` accepts 1–100
and defaults to 50. Soft-deleted files are excluded from listing.

## Download a file

Generate a signed URL, then use it to retrieve the bytes. The URL is a
bearer credential: downloading through it does not require an API key.
Do not send your Project David API key to the signed download URL.

```python interface=python
from pathlib import Path
from urllib.request import urlopen

url = client.files.get_signed_url(
    file_id=file_id,
    expires_in=600,
    use_real_filename=True,
)
if not url:
    raise RuntimeError("Could not generate download URL")

with urlopen(url, timeout=60) as response:
    Path("downloaded-report.pdf").write_bytes(response.read())
```

```curl interface=curl
FILE_URL=$(curl -fsS -G "$BASE_URL/v1/files/$FILE_ID/signed-url" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  --data-urlencode 'expires_in=600' \
  --data-urlencode 'use_real_filename=true' \
  | jq -er '.signed_url')

curl -fsS "$FILE_URL" -o downloaded-report.pdf
```

Signed URLs default to 600 seconds of validity. `use_real_filename`
controls the filename supplied in the download response. The SDK returns
`None` when it cannot obtain a signed URL.

For self-hosted deployments, configure `DOWNLOAD_BASE_URL` so the returned
URL is reachable by its intended recipient. Use HTTPS for remote access
and keep signed URLs out of public logs.

## Retrieve Base64 content

Use Base64 only when an application requires encoded content. For ordinary
file downloads, prefer a signed URL.

```python interface=python
encoded = client.files.get_file_as_base64(file_id=file_id)
if encoded is None:
    raise RuntimeError("No Base64 content returned")
```

```curl interface=curl
ENCODED=$(curl -fsS "$BASE_URL/v1/files/$FILE_ID/base64" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  | jq -er '.base64')
```

The SDK returns the encoded string or `None`, while HTTP returns an
object containing `file_id` and `base64`.

## Delete a file

Choose the deletion operation deliberately.

| Operation | Behaviour |
|---|---|
| Soft delete | Retains the record and stored bytes; excludes the file from listings and new signed URL issuance. |
| Hard delete | Removes the file record and attempts to remove the stored bytes. |

Use the appropriate operation on a file you no longer need. These
examples act on the file uploaded above; they are alternatives, although
hard deletion may also be requested after soft deletion.

### Soft delete

```python interface=python
print(client.files.soft_delete_file(file_id=file_id))
```

```curl interface=curl
curl -fsS -X PATCH "$BASE_URL/v1/files/$FILE_ID/soft-delete" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY"
```

### Hard delete

```python interface=python
print(client.files.delete_file(file_id=file_id))
```

```curl interface=curl
curl -fsS -X DELETE "$BASE_URL/v1/files/$FILE_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY"
```

Both SDK deletion methods return a boolean and return `False` on HTTP
404. The HTTP response includes `id`, `object` and `deleted`.

Soft deletion is not an access-revocation mechanism: existing signed
URLs and direct content retrieval may still work. A successful hard
delete response does not prove erasure of every physical copy. Do not
assume deleting a file also removes message references or vector indexes.

## Reference

- [Files reference](/docs/sdk-reference-files)
- [Messages](/docs/sdk-messages)
- [Vision](/docs/sdk-vision)
- [HTTP API reference](/docs/api-reference)
