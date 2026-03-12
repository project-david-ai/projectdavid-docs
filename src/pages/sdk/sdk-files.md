---
title: Files
category: sdk
slug: sdk-files
nav_order: 10
---



# Files

## Overview

The **Files** endpoints provide a secure, consistent interface for managing user-uploaded files within the assistant ecosystem. Files may serve a variety of roles, such as input to tools, persistent assets in conversations, or outputs from code execution and data analysis.

This interface abstracts away storage concerns (e.g., Samba, local disk, cloud object store) while offering:

- **Secure Uploads** – All files are uploaded with metadata including user ID, purpose, MIME type, and size.
- **Secure Downloads** – Files are accessed via time-limited signed URLs, preventing unauthorized access.
- **Inline Rendering** – Files such as images or PDFs can be rendered inline when appropriate, based on MIME type and disposition headers.
- **Persistent Associations** – Each file is tied to a user, purpose, and lifecycle within assistant threads or tools.

Whether uploading training data, referencing a code snippet, or viewing the output of a Python script, these endpoints ensure files are handled with privacy, structure, and context-awareness.

## Supported File Types

| Extension | MIME Type |
|-----------|-----------|
| `.c`      | text/x-c |
| `.cpp`    | text/x-c++ |
| `.cs`     | text/x-csharp |
| `.css`    | text/css |
| `.doc`    | application/msword |
| `.docx`   | application/vnd.openxmlformats-officedocument.wordprocessingml.document |
| `.go`     | text/x-golang |
| `.html`   | text/html |
| `.java`   | text/x-java |
| `.js`     | text/javascript |
| `.json`   | application/json |
| `.md`     | text/markdown |
| `.pdf`    | application/pdf |
| `.php`    | text/x-php |
| `.pptx`   | application/vnd.openxmlformats-officedocument.presentationml.presentation |
| `.py`     | text/x-python |
| `.pyx`    | text/x-script.python |
| `.rb`     | text/x-ruby |
| `.sh`     | application/x-sh |
| `.tex`    | text/x-tex |
| `.ts`     | application/typescript |
| `.txt`    | text/plain |
| `.csv`    | text/csv |
| `.tsv`    | text/tab-separated-values |
| `.xls`    | application/vnd.ms-excel |
| `.xlsx`   | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet |
| `.png`    | image/png |
| `.jpg`    | image/jpeg |
| `.jpeg`   | image/jpeg |
| `.gif`    | image/gif |
| `.svg`    | image/svg+xml |
| `.zip`    | application/zip |
| `.tar`    | application/x-tar |
| `.gz`     | application/gzip |
| `.rar`    | application/vnd.rar |
| `.7z`     | application/x-7z-compressed |
| `.mp3`    | audio/mpeg |
| `.mp4`    | video/mp4 |
| `.wav`    | audio/wav |
| `.ogg`    | audio/ogg |


## Use


**Upload a file**

```python

upload = client.files.upload_file(
    file_path=file_path, user_id=user.id, purpose="assistants")

```

**Generate a signed URL for a file**

```python

file_url = client.files.get_signed_url(
    upload.id, label=filename, markdown=False)

```
Generates:

```plaintext
print(url)

http://localhost:9000/v1/files/download?file_id=file_rxW1Vo7BgEKDqB8Lx7mN2f&expires=1711657200&signature=9a3044a1fdf5ff54a9851785c8d6dc7b90c3c438e1793f1e7f395cc7fc6b2bfc

If you set markdown=True, the output would instead be:

[plot.png](<http://localhost:9000/v1/files/download?file_id=file_rxW1Vo7BgEKDqB8Lx7mN2f&expires=1711657200&signature=9a3044a1fdf5ff54a9851785c8d6dc7b90c3c438e1793f1e7f395cc7fc6b2bfc>)



```


