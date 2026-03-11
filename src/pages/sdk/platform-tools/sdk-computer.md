---
title: Computer
category: sdk
slug: sdk-computer
nav_exclude: true
---

## /Computer

The computer tool gives the assistant access to a containerised PTY session from where it can call Linux commands, execute scripts, and interact with the outside world through ad-hoc API calls. 

### Rooms 
Each PTY session is mediated by a room, which maps directly to a Thread ID. The assistant crafts and sends its commands to a room. The joining of rooms is completed at the `Entity.threads` level.

```python
# ------------------------------------------------------------------
# 0.  Create thread
# ------------------------------------------------------------------

client = Entity(api_key=os.getenv("ENTITIES_API_KEY"))
thread = client.threads.create_thread()
print(thread.id)

# ------------------------------------------------------------------
# 1.  Join the thread to a pty session
# ------------------------------------------------------------------

session_data = client.computer.create_session(room_id=thread.id)
```

## Monitoring the Computer Tool Session from a Frontend

When a computer tool session is created, the platform returns connection metadata that allows a frontend application to observe the assistant's PTY session in real time.

```json
{
  "room_id": "thread_abc123",
  "token": "signed_access_token",
  "ws_url": "wss://domain/ws/computer"
}
```

A frontend client can use this data to connect to the PTY stream over WebSocket and render terminal output using a terminal emulator component (for example: xterm.js, hterm, or a native terminal widget).

At present, **only the assistant can execute commands** in the PTY. Frontends are observers unless explicitly enabled otherwise by platform policy.

### Architectural Overview: The Split Stream

To ensure high performance and keep the main inference stream clean, the Computer tool splits its output across two channels:

1. **Direct WebSocket:** Delivers high-volume, raw PTY text directly to the frontend emulator.
2. **Server-Sent Events (SSE):** Delivers discrete lifecycle updates and generated file metadata alongside standard assistant text.

### 1. Connection Flow (WebSocket for Terminal Output)

1. **Request a session ticket from your backend**
   - Your backend calls: `client.computer.create_session(room_id=thread.id)`
   - The backend returns the signed token and WebSocket URL to the browser.
   - Do not mint tokens directly in the browser.

2. **Open a WebSocket connection**
   - Connect to the provided endpoint using the required query parameters:
     - `room` (the thread ID)
     - `token` (the signed JWT)
     - `role=viewer`
   - **Important:** The `role=viewer` parameter is required for frontends. It informs the server to listen for broadcasts without attempting to spawn a redundant, conflicting shell process.

   Example URL:
   `wss://domain/ws/computer?room=thread_abc123&token=...&role=viewer`

3. **Listen for Terminal Broadcasts**
   - The WebSocket will emit JSON payloads. Pass `content` directly to your terminal renderer (e.g., `term.write(data.content)`).

   Typical WebSocket payloads:
   ```json
   {
     "type": "shell_output",
     "thread_id": "thread_abc123",
     "content": "total 8\ndrwxr-xr-x 2 sandboxuser ...\n"
   }
   ```
   ```json
   {
     "type": "command_complete",
     "thread_id": "thread_abc123"
   }
   ```

### 2. Monitoring Lifecycle and Files (SSE Inference Stream)

While the WebSocket handles raw terminal rendering, the standard Assistant inference stream (SSE) will yield discrete events regarding the state of the shell session.

1. **Status Events**
   - Render these as UI indicators (e.g., "Executing in sandbox shell...").
   ```json
   {
     "type": "shell_status",
     "activity": "Executing in sandbox shell...",
     "state": "in_progress",
     "tool": "computer",
     "run_id": "run_123"
   }
   ```

2. **Generated Files**
   - If the assistant generates files during its session (e.g., saving a .csv or .txt file to the working directory), the platform automatically harvests these files and uploads them.
   - They arrive in the SSE stream as `computer_file` events, complete with short-lived signed URLs for downloading.
   ```json
   {
     "type": "computer_file",
     "filename": "test_data.csv",
     "file_id": "file_xyz789",
     "url": "https://...",
     "mime_type": "text/csv",
     "context": "session_end"
   }
   ```

### Minimal Client Responsibilities

Any frontend stack can implement support if it can:

- Open a WebSocket connection with the `role=viewer` parameter.
- Parse incoming JSON messages and route `shell_output` to a terminal renderer.
- Preserve ANSI escape sequences for correct formatting.
- Handle reconnect logic (with backoff) if the WebSocket drops.
- Render file download links when `computer_file` events are received via the main chat stream.

### Recommended Safeguards

- Treat tokens as short-lived credentials.
- Never expose your platform API key to the browser.
- Proxy session creation through your backend.
- Maintain a silent text buffer for incoming WebSocket data if the UI terminal component is closed or currently unmounted, flushing it when the terminal is opened.
- Disable stdin in the terminal widget unless interactive mode is explicitly enabled.