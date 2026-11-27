---
title: Authentication
category: sdk
slug: api_keys
nav_order: 1.5
---

# Authentication

Project David separates application authentication from inference
and remote tool credentials.

| Credential | Purpose |
|---|---|
| API key | Access the Project David API |
| Provider key | Authorize model inference |
| MCP credential | Authorize remote tool access |

## API keys

Obtain an API key from the
[Dashboard](https://platform.projectdavid.co.uk).

Store the key in your environment rather than embedding it
in application source.

```dotenv interface=python
# .env
PROJECTDAVID_API_KEY=your_project_david_api_key
```

```bash interface=curl
read -rsp "Project David API key: " PROJECTDAVID_API_KEY
export PROJECTDAVID_API_KEY
echo
```

Authenticate a request to list your assistants.

```python interface=python
import os

from dotenv import load_dotenv
from projectdavid import Entity

load_dotenv()

client = Entity(
    base_url="https://api.projectdavid.co.uk",
    api_key=os.environ["PROJECTDAVID_API_KEY"],
)

assistants = client.assistants.list()
```

```curl interface=curl
BASE_URL="https://api.projectdavid.co.uk"

curl -fsS "$BASE_URL/v1/assistants" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY"
```

The SDK supplies the `X-API-Key` header automatically.

## Manage API keys

Applications can create, list and revoke their own API keys.

For key management operations, supply the user ID associated
with your authenticated account.

### Create a key

```python interface=python
new_key = client.keys.create_key(
    user_id=os.environ["PROJECTDAVID_USER_ID"],
    key_name="Production",
    expires_in_days=90,
)

# Store new_key.plain_key securely.
# new_key.details.prefix identifies the key.
```

```curl interface=curl
# Set PROJECTDAVID_USER_ID to your own user ID first.

KEY_RESPONSE=$(curl -fsS \
  "$BASE_URL/v1/users/$PROJECTDAVID_USER_ID/apikeys" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"key_name":"Production","expires_in_days":90}')

NEW_API_KEY=$(jq -er '.plain_key' <<< "$KEY_RESPONSE")
KEY_PREFIX=$(jq -er '.details.prefix' <<< "$KEY_RESPONSE")

unset KEY_RESPONSE
```

The full key is returned only when created. Transfer it to
your secret store before ending the session.

### List keys

```python interface=python
keys = client.keys.list_keys(
    user_id=os.environ["PROJECTDAVID_USER_ID"],
)

for key in keys:
    print(key.prefix, key.key_name, key.is_active)
```

```curl interface=curl
curl -fsS \
  "$BASE_URL/v1/users/$PROJECTDAVID_USER_ID/apikeys" \
  -H "X-API-Key: $PROJECTDAVID_API_KEY"
```

Listing keys returns metadata, not the original secrets.

### Rotate a key

1. Create a replacement key.
2. Update applications to use the replacement.
3. Verify authentication.
4. Revoke the previous key.

Do not revoke an existing key until its replacement
has been verified.

See [API Keys](/docs/sdk-reference-api-keys)
for the complete management interface.

## Provider keys

Bring your own inference provider credentials (BYOK).

Register a provider key once and reference its identifier
in subsequent inference requests.

```dotenv interface=python
# Add to .env
PROVIDER_API_KEY=your_hyperbolic_api_key
```

```bash interface=curl
read -rsp "Provider API key: " PROVIDER_API_KEY
export PROVIDER_API_KEY
echo
```

### Register a provider key

```python interface=python
import os

from dotenv import load_dotenv

load_dotenv()

provider_key = client.provider_keys.create(
    provider="hyperbolic",
    api_key=os.environ["PROVIDER_API_KEY"],
    name="Production inference",
)

provider_key_id = provider_key.id
```

```curl interface=curl
PROVIDER_KEY_ID=$(jq -n \
  '{provider:"hyperbolic",
    api_key:env.PROVIDER_API_KEY,
    name:"Production inference"}' \
  | curl -fsS "$BASE_URL/v1/provider-keys" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" \
      -H "Content-Type: application/json" \
      --data-binary @- \
  | jq -er '.id')
```

The returned identifier selects the registered credential.
Registration responses do not contain the provider secret.

Pass `provider_key_id` when configuring inference, as shown
in the [Quick Start](/docs/sdk-quick-start).

### Rotate a provider key

Register the replacement credential, update applications
to use its identifier, verify inference and revoke the
previous credential.

Updating a provider key's name does not replace its secret.

See [Provider Keys](/docs/sdk-reference-provider-keys).

## MCP credentials

Remote MCP servers can be registered with bearer authentication.

Configure `MCP_SERVER_URL` and `MCP_BEARER_TOKEN` in your
environment using the credentials issued by your MCP server.

```python interface=python
server = client.mcp.create_server(
    name="My MCP Server",
    url=os.environ["MCP_SERVER_URL"],
    bearer_token=os.environ["MCP_BEARER_TOKEN"],
)

server_id = server.id
```

```curl interface=curl
MCP_SERVER_ID=$(jq -n \
  '{name:"My MCP Server",
    url:env.MCP_SERVER_URL,
    auth:{
      type:"bearer",
      token:env.MCP_BEARER_TOKEN
    }}' \
  | curl -fsS "$BASE_URL/v1/mcp/servers" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" \
      -H "Content-Type: application/json" \
      --data-binary @- \
  | jq -er '.id')
```

Authentication is bound to the registered MCP server.
Subsequent discovery and execution do not require the
application to submit the bearer token again.

### Rotate an MCP credential

Unlike provider keys, MCP credentials can be replaced
in place without creating a new server registration.

```python interface=python
client.mcp.rotate_server_credential(
    server_id=server_id,
    bearer_token=os.environ["NEW_MCP_BEARER_TOKEN"],
)
```

```curl interface=curl
jq -n \
  '{type:"bearer",token:env.NEW_MCP_BEARER_TOKEN}' \
  | curl -fsS -X PUT \
      "$BASE_URL/v1/mcp/servers/$MCP_SERVER_ID/credential" \
      -H "X-API-Key: $PROJECTDAVID_API_KEY" \
      -H "Content-Type: application/json" \
      --data-binary @-
```

See [MCP](/docs/sdk-reference-mcp).

## Security

- Keep credentials out of source control and application logs.
- Use separate API keys for separate applications and environments.
- Use HTTPS when transmitting credentials.
- Keep provider secrets and MCP tokens server-side.
- Revoke compromised or unused credentials.
- Never expose administrative credentials to frontend applications.

## Reference

- [API Keys](/docs/sdk-reference-api-keys)
- [Provider Keys](/docs/sdk-reference-provider-keys)
- [MCP](/docs/sdk-reference-mcp)
- [HTTP API Reference](/docs/api-reference)