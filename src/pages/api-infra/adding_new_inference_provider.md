---
title: Inference integrations
slug: adding_new_inference_provider
category: api-infra
nav_order: 4
---

# Inference integrations

Add a model to an existing provider or introduce a provider by extending Core's routing and execution layers. Keep provider-specific behaviour behind the worker boundary and preserve the public inference contract.

## Routing architecture

```text
Unified model ID
    -> InferenceProviderSelector
    -> Provider dispatcher
    -> InferenceArbiter.get_provider_instance()
    -> Concrete worker
```

| Component | Source path (relative to Core root) | Responsibility |
|---|---|---|
| Selector | `src/api/entities_api/orchestration/engine/inference_provider_selector.py` | Resolve the provider prefix and API model name |
| Dispatcher | `src/api/entities_api/orchestration/handlers/hb_handler.py` | Example: resolve Hyperbolic model families and delegate execution |
| Arbiter | `src/api/entities_api/orchestration/engine/inference_arbiter.py` | Create fresh workers using Redis and the shared assistant cache |
| Workers | `src/api/entities_api/orchestration/workers/hyperbolic/` | Example: provider-specific execution and streaming |
| Model mapping | `projectdavid_common.constants.ai_model_map` | Shared model ID mapping and translation |

The selector caches general dispatcher instances by class name, under a lock. The arbiter does **not** cache concrete workers: each factory call constructs a new instance. Keep run-specific context, mutable execution state and credentials out of cached dispatchers.

## Add a model

1. Choose the canonical provider-prefixed identifier and check the provider's actual outbound model name.
2. Review `MODEL_MAP` and `translate_model_id` in the Common package. Add or update mapping only where needed.
3. Check that the selector routes the prefix to the intended dispatcher, and that the dispatcher resolves the model to a compatible worker.
4. Verify model-specific capabilities, context limits, message formatting, streaming and tool-call behaviour. Reuse an existing worker only after these checks pass.
5. Test stateful inference and raw inference separately.

The selector compares a lowercased, stripped model ID against its routing prefixes, longest first. Its ordinary `MODEL_MAP` lookup uses the original ID. Do not assume arbitrary casing or whitespace will produce the same outbound model name.

The direct DeepSeek route currently accepts only `deepseek-ai/deepseek-flash` and maps it to `deepseek-flash`. Extending it requires updating the explicit selector restriction as well as any model mapping.

## Hyperbolic example

The `HyperbolicHandler.SUBMODEL_CLASS_MAP` maps family patterns to workers:

| Pattern | Worker |
|---|---|
| `deepseek` | `HyperbolicDs1` |
| `meta-llama/` | `HyperbolicLlamaWorker` |
| `qwen/` | `HyperbolicQwenWorker` |
| `kimi` | `HyperbolicQwenWorker` |
| `gpt-oss` | `HyperbolicGptOssWorker` |

The dispatcher removes the `hyperbolic/` prefix for family matching. Patterns ending in `/` match the beginning of the remaining ID; other patterns match substrings. Longer patterns are considered first. Unknown families raise an error rather than falling back to an unrelated worker.

For example, `hyperbolic/deepseek-v4-flash-0731` matches the `deepseek` family. This describes the routing decision, not a guarantee of model availability or tool compatibility.

## Add a provider

- Implement a dispatcher following an existing handler's contract. Register its unique prefix in `TOP_LEVEL_ROUTING_MAP`.
- Resolve concrete worker classes from canonical model IDs. Obtain workers through `InferenceArbiter.get_provider_instance()` rather than maintaining a worker cache.
- Forward the thread, message, run, assistant, model, reasoning-stream flag and credential where the corresponding interface accepts them. Preserve additional execution arguments.
- Implement provider-specific request construction, model translation, response normalization and failure handling in the worker. Inspect the actual compatible worker and base classes before choosing inheritance or mixins.
- Integrate provider credential resolution with the existing authenticated execution path. A new route is not sufficient to establish registered provider-key support; verify the relevant credential and authorization layers separately.

In the Hyperbolic reference implementation, `process_conversation` and `stream` yield the corresponding worker's chunks. `process_function_calls` delegates to the worker's `process_tool_calls`. The raw-inference selector method `select_provider_worker` resolves a concrete worker and returns its translated model ID. Check both paths for consistent model translation; do not forward an internal routing prefix to an upstream API unless the provider expects it.

## Verification

Add focused tests for:

- Provider and family selection, unknown identifiers, overlapping patterns and model translation.
- New worker instances on successive factory calls and isolation of concurrent execution state and credentials.
- Streaming content, reasoning, tool arguments, tool results and terminal run outcomes, as applicable to the model.
- Credential selection, provider errors, cancellation and continuation of the original run after a tool call.
- Raw inference and stateful inference using mocked upstream responses, followed by controlled live tests where authorized.

Keep model capabilities explicit. A successful routing test does not establish successful inference or tool execution.

## Release

If a shared model mapping changes, release the Common package and update the consumers that actually require that version. Verify the installed dependency versions in the environment used by Core and its workers. Do not assume a neighbouring source checkout is the package imported by the runtime.

Verify local changes in the existing development stack before building release images. Review dependency and image requirements, run the relevant tests and promote through the normal repository release process.

## Reference

- [Development commands](/docs/docker_commands)
- [Container architecture](/docs/infrastructure-container-map)
- [Inference](/docs/sdk-inference)
- [Streaming Protocol](/docs/sdk-stream-contract)
- [Authentication](/docs/api_keys)
