---
title: Deep Research Flow
category: architecture
slug: archi-deep-research
nav_order: 1
---



### KEY ISOLATION POINTS:

1. Worker's internal tool calls (perform_web_search, read_web_page, etc.)
   stay ONLY in ephemeral_thread - NEVER bleed into main thread

2. Only the FINAL assistant message content from worker is extracted
   via messages_on_thread[-1].get('content')

3. This clean report is submitted as tool response to supervisor

4. Supervisor sees ONLY the final report, not the worker's tool execution

### THREAD CONTEXTS:

Main Thread Context (Supervisor sees):
  - User: "Find NVIDIA Q4 2024 revenue"
  - Assistant: <tool_call: delegate_research_task>
  - Tool: "NVIDIA fiscal Q4 2024 revenue was $26.04B..." ✓ CLEAN
  - Assistant: [Final synthesis to user]

Worker Thread Context (Isolated):
  - User: "### Research Assignment..."
  - Assistant: <tool_call: perform_web_search>
  - Tool: [search results]
  - Assistant: <tool_call: read_web_page>
  - Tool: [page content]
  - Assistant: "NVIDIA fiscal Q4 2024..." ← EXTRACTED


```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "background": "#f8f9fc",
    "primaryColor": "#dbeafe",
    "primaryTextColor": "#1e3a5f",
    "primaryBorderColor": "#3b82f6",
    "secondaryColor": "#fef3c7",
    "secondaryTextColor": "#78350f",
    "secondaryBorderColor": "#f59e0b",
    "tertiaryColor": "#ede9fe",
    "tertiaryTextColor": "#4c1d95",
    "tertiaryBorderColor": "#7c3aed",
    "nodeTextColor": "#1e293b",
    "edgeLabelBackground": "#f1f5f9",
    "clusterBkg": "#f8faff",
    "clusterBorder": "#cbd5e1",
    "titleColor": "#1e293b",
    "lineColor": "#94a3b8",
    "fontSize": "16px",
    "fontFamily": "Georgia, serif"
  }
}}%%
graph TD
    User([User Query])
    Web[(Internet / Tools)]
    DB[(Database / History)]

    subgraph MainThread ["Main Thread — Persistent Context"]
        direction TB
        Orchestrator{QwenWorker\nOrchestrator}
        CheckConfig{Is Deep Research?}
        MainAsst[Main Assistant Logic]
        SpawnSup[Spawn Ephemeral Supervisor]
        Supervisor[Supervisor Agent\nManager]
        SupervisorUpdate[Supervisor Receives Report\nUpdates Context Only]
        Cleanup[Cleanup Supervisor\nPersist to Thread]
    end

    subgraph Bridge ["Delegation Mixin — Bridge"]
        MixinHandle[handle_delegate_research_task]
        StreamProxy[Stream Proxy\nRelays Worker Events to User]
        FetchReport[fetch_worker_final_report]
        SubmitOut[submit_tool_output]
    end

    subgraph EphemeralThread ["Ephemeral Thread — Isolated Context"]
        direction TB
        CreateEnv[Create Worker and Thread]
        WorkerAgent[Worker Agent\nResearcher]

        subgraph WorkerLoop ["Worker Loop"]
            Thinking[Reasoning / Thoughts]
            Tools[Tool Execution\nSearch / Read / Scroll]
        end

        Synthesis[Final Answer Synthesis\nWorker writes conclusion]
    end

    User --> Orchestrator
    Orchestrator --> CheckConfig

    CheckConfig -- "No" --> MainAsst
    MainAsst --> |"Direct Response"| User

    CheckConfig -- "Yes" --> SpawnSup
    SpawnSup --> Supervisor
    Supervisor -- "Tool Call:\ndelegate_research_task" --> MixinHandle

    MixinHandle --> CreateEnv
    CreateEnv --> WorkerAgent

    WorkerAgent --> Thinking
    Thinking --> Tools
    Tools <--> Web
    Tools --> WorkerAgent

    Thinking -.-> |"Stream: Real-time"| StreamProxy
    Tools -.-> |"Stream: Activity"| StreamProxy
    Synthesis -.-> |"Stream: Final Answer"| StreamProxy
    StreamProxy ==> |"Yield Events"| User

    WorkerAgent --> Synthesis
    Synthesis --> |"End of Stream"| FetchReport

    FetchReport -- "Extract content\nfrom last message" --> SubmitOut
    SubmitOut -- "Tool Output" --> SupervisorUpdate

    SupervisorUpdate --> Cleanup
    Cleanup --> DB
    DB --> NextTurn([Ready for Next Turn])

    %% Backend: soft blue
    classDef main fill:#dbeafe,stroke:#3b82f6,stroke-width:1.5px,color:#1e3a5f

    %% Worker: soft amber
    classDef worker fill:#fef3c7,stroke:#f59e0b,stroke-width:1.5px,color:#78350f

    %% Bridge: soft violet
    classDef bridge fill:#ede9fe,stroke:#7c3aed,stroke-width:1.5px,color:#4c1d95

    %% External/Infra: soft green
    classDef external fill:#dcfce7,stroke:#22c55e,stroke-width:1.5px,color:#14532d

    class Supervisor,Orchestrator,MainAsst,SupervisorUpdate,CheckConfig,SpawnSup,Cleanup main
    class WorkerAgent,Tools,Synthesis,Thinking,CreateEnv worker
    class MixinHandle,FetchReport,SubmitOut,StreamProxy bridge
    class User,Web,DB,NextTurn external

    style MainThread fill:#eff6ff,stroke:#93c5fd,color:#1e3a5f
    style Bridge fill:#f5f3ff,stroke:#a78bfa,color:#4c1d95
    style EphemeralThread fill:#fffbeb,stroke:#fcd34d,color:#78350f
    style WorkerLoop fill:#fef9ee,stroke:#fbbf24,color:#78350f

```