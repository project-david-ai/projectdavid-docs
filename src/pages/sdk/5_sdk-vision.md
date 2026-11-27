---
title: Vision
category: sdk
slug: sdk-vision
nav_order: 5
---

# Vision

Send images alongside text to a vision-capable model. Images are stored as
files; messages carry the prompt and references to those files.

## Configure

Use an [Assistant](/docs/sdk-assistants) configured with a vision-capable
model and a [Thread](/docs/sdk-threads) owned by your account. Complete
[Authentication](/docs/api_keys) and set `PROJECTDAVID_ASSISTANT_ID` and
`PROJECTDAVID_THREAD_ID` to their IDs. The cURL examples use Bash and `jq`.
Run each example in the same session.

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
set -euo pipefail
```

## Upload an image

Place an image named `diagram.png` in your working directory. Upload it
with `purpose="vision"` and retain its file ID. If you already have an
uploaded image, use its existing ID instead.

```python interface=python
image = client.files.upload_file(
    file_path="diagram.png",
    purpose="vision",
)
file_id = image.id
```

```curl interface=curl
FILE_ID=$(curl -fsS "$BASE_URL/v1/uploads" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -F 'purpose=vision' \
  -F 'file=@diagram.png' \
  | jq -er '.id')
```

## Create a vision message

Reference the uploaded image in the message. Both interfaces produce
stored text and an image attachment of type `image` with a `file_id`.

```python interface=python
message = client.messages.create_message(
    thread_id=thread_id,
    assistant_id=assistant_id,
    role="user",
    content=[
        {"type": "text", "text": "Explain this diagram."},
        {"type": "image_file", "image_file": {"file_id": file_id}},
    ],
)
message_id = message.id
```

```curl interface=curl
MESSAGE_ID=$(jq -n \
  --arg thread_id "$THREAD_ID" \
  --arg assistant_id "$ASSISTANT_ID" \
  --arg file_id "$FILE_ID" \
  '{thread_id:$thread_id,assistant_id:$assistant_id,
    role:"user",content:"Explain this diagram.",
    attachments:[{type:"image",file_id:$file_id}]}' \
  | curl -fsS "$BASE_URL/v1/messages" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" \
      -H 'Content-Type: application/json' \
      --data-binary @- \
  | jq -er '.id')
```

Create a Run and start inference using this message ID, following the
[Quick Start](/docs/sdk-quick-start). The model selected for the Run must
support image input. Creating the message alone does not execute it.

## Remote images and data URIs

The Python SDK also accepts `image_url` content blocks. It downloads HTTP(S)
images (following redirects) or decodes base64 image data URIs, uploads the
result, then creates the message. These are SDK conveniences, not the raw
HTTP message attachment format.

Set `IMAGE_URL` to a trusted, accessible PNG image URL before running this
example. The cURL equivalent explicitly downloads and uploads the image.

```python interface=python
message = client.messages.create_message(
    thread_id=thread_id,
    assistant_id=assistant_id,
    role="user",
    content=[
        {"type": "text", "text": "Describe this image."},
        {"type": "image_url", "image_url": {"url": os.environ["IMAGE_URL"]}},
    ],
)
message_id = message.id
```

```curl interface=curl
# IMAGE_URL must identify a trusted PNG image.
IMAGE_PATH=$(mktemp)
trap 'rm -f "$IMAGE_PATH"' EXIT
curl -fsSL --proto '=https' --proto-redir '=https' \
  "${IMAGE_URL:?Set a trusted HTTPS image URL}" -o "$IMAGE_PATH"

FILE_ID=$(curl -fsS "$BASE_URL/v1/uploads" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -F 'purpose=vision' \
  -F "file=@$IMAGE_PATH;filename=image.png;type=image/png" \
  | jq -er '.id')
rm -f "$IMAGE_PATH"
trap - EXIT

MESSAGE_ID=$(jq -n \
  --arg thread_id "$THREAD_ID" \
  --arg assistant_id "$ASSISTANT_ID" \
  --arg file_id "$FILE_ID" \
  '{thread_id:$thread_id,assistant_id:$assistant_id,
    role:"user",content:"Describe this image.",
    attachments:[{type:"image",file_id:$file_id}]}' \
  | curl -fsS "$BASE_URL/v1/messages" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" \
      -H 'Content-Type: application/json' \
      --data-binary @- \
  | jq -er '.id')
```

For inline PNG data, the SDK accepts the same `image_url` block with
`url` set to `data:image/png;base64,...`. HTTP clients can decode the data
locally and use the upload workflow above. Prefer direct file uploads for
local images rather than encoding them unnecessarily.

Only fetch images from trusted sources. Do not pass arbitrary user-supplied
URLs to the SDK's image downloader without applying your application's
network-access policy.

## Multiple images

For ordered comparisons, upload images separately and reference their file
IDs in the intended order. Set `PROJECTDAVID_FIRST_IMAGE_ID` and
`PROJECTDAVID_SECOND_IMAGE_ID` to two image IDs owned by your account.

```python interface=python
first_id = os.environ["PROJECTDAVID_FIRST_IMAGE_ID"]
second_id = os.environ["PROJECTDAVID_SECOND_IMAGE_ID"]

message = client.messages.create_message(
    thread_id=thread_id,
    assistant_id=assistant_id,
    role="user",
    content=[
        {"type": "text", "text": "Compare the first image with the second."},
        {"type": "image_file", "image_file": {"file_id": first_id}},
        {"type": "image_file", "image_file": {"file_id": second_id}},
    ],
)
message_id = message.id
```

```curl interface=curl
MESSAGE_ID=$(jq -n \
  --arg thread_id "$THREAD_ID" \
  --arg assistant_id "$ASSISTANT_ID" \
  --arg first_id "${PROJECTDAVID_FIRST_IMAGE_ID:?Set the first image ID}" \
  --arg second_id "${PROJECTDAVID_SECOND_IMAGE_ID:?Set the second image ID}" \
  '{thread_id:$thread_id,assistant_id:$assistant_id,
    role:"user",content:"Compare the first image with the second.",
    attachments:[{type:"image",file_id:$first_id},
                 {type:"image",file_id:$second_id}]}' \
  | curl -fsS "$BASE_URL/v1/messages" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" \
      -H 'Content-Type: application/json' \
      --data-binary @- \
  | jq -er '.id')
```

The SDK batches `image_url` uploads concurrently, so their attachment order
is not guaranteed. Text blocks are combined into a single prompt, not
preserved as interleaved text and images.

## Inspect attachments

```python interface=python
message = client.messages.retrieve_message(message_id=message_id)
print(message.content)
print(message.attachments)
```

```curl interface=curl
curl -fsS "$BASE_URL/v1/messages/$MESSAGE_ID" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  | jq '{content, attachments}'
```

Attachment references do not guarantee that image bytes remain available at
inference time. Keep the referenced files available to the owning account.
Core resolves image references when preparing multimodal context; unavailable
images may be skipped, leaving a text-only message. Image size, format and
context limits also depend on the selected model and provider.

## Reference

- [Messages](/docs/sdk-messages)
- [Files](/docs/sdk-files)
- [Runs](/docs/sdk-runs)
- [Messages reference](/docs/sdk-reference-messages)
- [HTTP API reference](/docs/api-reference)
