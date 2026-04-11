---
title: Platform Overview
category: overview
slug: api-index
---

# Project David

Project David is a sovereign AI runtime and state management API.

It implements the OpenAI Assistants API specification (Assistants, Threads, Messages, Runs, and Tools) and runs entirely on your infrastructure, against any model endpoint you point it at.

If you have used the OpenAI Assistants API, you already know how to use this. The difference is that you own the runtime, the data, and the compute.

---

## Architecture

![Project David Stack](/projectdavid-stack.svg)

---

## What it is

A stateful orchestration layer that sits between your application and your model endpoints. It manages conversation state, context windows, tool dispatch, and streaming. Your application talks to one API regardless of what is running behind it.

Model endpoints it routes to today:

- Hosted providers: OpenAI-compatible APIs, Hyperbolic, Together AI, DeepSeek
- Local GPU inference: vLLM via Ray Serve (Sovereign Forge), Ollama
- Any OpenAI-compatible endpoint

Swapping the model behind an assistant is a single field change. No application code changes required.

---

## What it is not

Project David is not a gateway or a proxy. It does not rewrite requests and forward them. It is a runtime: it holds state, manages the execution loop, dispatches tools, streams responses, and appends results back to the thread. The nearest equivalent in the ecosystem is the OpenAI Assistants API, not LiteLLM.

---

## Who it is for

Teams and individuals who need the stateful assistant primitives of the OpenAI Assistants API but cannot or will not send data to a cloud provider. This includes security-constrained environments, airgapped deployments, organisations with data residency requirements, and anyone building on open weights models who wants a production-grade orchestration layer rather than a collection of prompt utilities.

---

## Licensing

Project David is distributed under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/). Personal projects, research, and internal non-commercial use are permitted at no cost.

Commercial deployments require a separate licence. This includes production use within a company, embedding Project David in a commercial product, or operating it as part of a service offered to paying customers. Contact [licensing@projectdavid.co.uk](mailto:licensing@projectdavid.co.uk) to discuss terms.

---

## Where to go next

- [Quick Start](/docs/sdk-quick-start): a complete inference call from setup to streaming response in under five minutes
- [Project David Core](/docs/core-overview): run the full stack from source
- [Project David Platform](/docs/platform-overview): containerised deployment via pip, no source required
- [Sovereign Forge](/docs/fine-tuning-pipeline): fine-tune open weights models and serve them from the same runtime
- [GitHub](https://github.com/project-david-ai): source code, issues, and contributions