---
title: Vision (Multimodal Messages)
category: sdk
slug: sdk-vision
nav_order: 5
---

# Vision

## Overview

The platform supports multimodal messages — messages that contain both text and images.
Images are automatically downloaded, stored server-side, and hydrated into the correct
format at inference time. This means your application sends a standard message payload
and the platform handles everything else: image fetching, upload, storage, and delivery
to the model.

Supported image sources:

- **Remote URLs** — any publicly accessible image URL (HTTP/S, including CDN-redirected URLs)
- **Base64 data URIs** — inline images encoded as `data:image/<type>;base64,...`
- **Pre-uploaded file IDs** — files previously uploaded via the Files API

Supported formats: JPEG, PNG, WebP, GIF.

---

## Sending Images via URL

Pass a content array instead of a plain string. Each block has a `type` field — `"text"`
for the prompt and `"image_url"` for each image.

```python
from projectdavid import Entity

client = Entity()

thread = client.threads.create_thread()

message = client.messages.create_message(
    thread_id=thread.id,
    assistant_id="your_assistant_id",
    role="user",
    content=[
        {
            "type": "text",
            "text": "What are the differences between these two images?"
        },
        {
            "type": "image_url",
            "image_url": {
                "url": "https://picsum.photos/id/1015/800/600"
            }
        },
        {
            "type": "image_url",
            "image_url": {
                "url": "https://picsum.photos/id/1016/800/600"
            }
        }
    ]
)

print(message.content)      # Plain text prompt as stored
print(message.attachments)  # [{"type": "image", "file_id": "file_xxx"}, ...]
```

The SDK automatically downloads each image, uploads it to the file store, and records
the resulting `file_id` in the message's `attachments` field. The raw bytes are never
stored in the message record itself.

---

## Sending a Local Image (Base64)

Read a local file and encode it as a base64 data URI. Resize the image before encoding
to keep token usage predictable — a maximum of 512px on the longest side is a reliable
starting point for most models.

```python
import base64
import io
from PIL import Image
from projectdavid import Entity

client = Entity()


def encode_image(path: str, max_size: int = 512) -> str:
    img = Image.open(path).convert("RGB")
    img.thumbnail((max_size, max_size), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode()}"


thread = client.threads.create_thread()

message = client.messages.create_message(
    thread_id=thread.id,
    assistant_id="your_assistant_id",
    role="user",
    content=[
        {
            "type": "text",
            "text": "Summarise the key trends in this chart."
        },
        {
            "type": "image_url",
            "image_url": {
                "url": encode_image("chart.png")
            }
        }
    ]
)
```

---

## Sending a Pre-Uploaded File

If you have already uploaded an image via the Files API and have its `file_id`, you can
attach it directly without re-uploading.

```python
message = client.messages.create_message(
    thread_id=thread.id,
    assistant_id="your_assistant_id",
    role="user",
    content=[
        {
            "type": "text",
            "text": "Describe what you see in this image."
        },
        {
            "type": "image_file",
            "image_file": {
                "file_id": "file_abc123"
            }
        }
    ]
)
```

---

## Mixing Text, URLs, and Local Images

All three source types can be combined in a single message.

```python
message = client.messages.create_message(
    thread_id=thread.id,
    assistant_id="your_assistant_id",
    role="user",
    content=[
        {
            "type": "text",
            "text": "Compare the remote photo with my local chart."
        },
        {
            "type": "image_url",
            "image_url": {
                "url": "https://picsum.photos/id/1015/800/600"
            }
        },
        {
            "type": "image_url",
            "image_url": {
                "url": encode_image("chart.png")
            }
        }
    ]
)
```

---

## Inspecting the Hydrated Payload

`get_formatted_messages()` returns the thread history in the format the model receives —
image `file_id` references are resolved to base64 content arrays at call time.

```python
formatted = client.messages.get_formatted_messages(thread.id)

for msg in formatted:
    content = msg.get("content")
    if isinstance(content, list):
        # Multimodal message — content is a Qwen-format array
        text_blocks  = [b for b in content if b["type"] == "text"]
        image_blocks = [b for b in content if b["type"] == "image"]
        print(f"Text:   {text_blocks[0]['text']}")
        print(f"Images: {len(image_blocks)} resolved")
    else:
        # Plain text message
        print(f"Text: {content}")
```

Example output:

```
Text:   What are the differences between these two images?
Images: 2 resolved
```

---

## Notes

**Image size** — resize images to a maximum of 512px on the longest side before encoding.
Large images generate significantly more tokens and may exceed the model's context limit,
causing the request to fail. The `encode_image` helper above handles this automatically.

**Image expiry** — uploaded images have a TTL. Check `message.attachments` to verify
file IDs are present before triggering a run if timing is a concern.

**CDN redirects** — URLs that return a `302` redirect (such as Picsum or many CDN
hosts) are followed automatically. No special handling is required.

**Strict hosts** — URLs from hosts that block non-browser requests (such as Wikipedia)
are fetched with a browser-compatible `User-Agent` header automatically.

**Plain text messages are unaffected** — passing a plain string to `content` works
exactly as before. The multimodal path is only activated when `content` is a list.

```python
# This still works exactly as before — no changes required
message = client.messages.create_message(
    thread_id=thread.id,
    assistant_id="your_assistant_id",
    role="user",
    content="Tell me about current trends in AI"
)
```