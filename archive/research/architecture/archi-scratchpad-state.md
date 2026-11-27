

---
title: Scratchpad State Machine
category: architecture
slug: archi-scratchpad-state
nav_order: 4

---

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
    "tertiaryColor": "#dcfce7",
    "tertiaryTextColor": "#14532d",
    "tertiaryBorderColor": "#22c55e",
    "edgeLabelBackground": "#f1f5f9",
    "titleColor": "#1e293b",
    "lineColor": "#94a3b8",
    "fontSize": "18px",
    "fontFamily": "Georgia, serif",
    "stateBkg": "#fef9ee",
    "stateTextColor": "#1e293b",
    "stateBorder": "#f59e0b",
    "altBackground": "#eff6ff",
    "noteBkgColor": "#f5f3ff",
    "noteTextColor": "#4c1d95",
    "noteBorderColor": "#a78bfa",
    "labelColor": "#1e293b",
    "errorBkgColor": "#fde8e8",
    "errorTextColor": "#991b1b"
  }
}}%%
stateDiagram-v2
    [*] --> STRATEGY : Supervisor initializes run
    [*] --> USER_DIRECTIVE : User intervenes during active run

    state "STRATEGY  |  Supervisor-only  |  GOAL · ENTITIES · TOOL CHAIN · ASSIGNED" as STRATEGY
    state "PENDING   |  Worker-written   |  ENTITY · FIELD · assigned_to · turn" as PENDING
    state "VERIFIED  |  Worker-written   |  ENTITY · FIELD · VALUE · SOURCE_URL · retrieved_by" as VERIFIED
    state "UNVERIFIED  |  Worker-written  |  ENTITY · FIELD · CLAIMED_VALUE · reason" as UNVERIFIED
    state "FAILED_URL  |  Worker-written  |  URL · failure_reason · tried_by" as FAILED_URL
    state "TOMBSTONE  |  Supervisor-only  |  URL · failure_reason · turn  PERMANENT" as TOMBSTONE
    state "USER DIRECTIVE  |  User-written via scratchpad UI  |  Non-destructive mid-stream" as USER_DIRECTIVE
    state "SYNTHESIS  |  Supervisor-only  |  Only VERIFIED entries cited" as SYNTHESIS

    STRATEGY --> PENDING : Worker spawned - claims task
    PENDING --> VERIFIED : Fact confirmed with live URL
    PENDING --> UNVERIFIED : Value found - no confirmed URL
    PENDING --> FAILED_URL : URL blocked or dead
    UNVERIFIED --> PENDING : Supervisor re-delegates to new worker
    FAILED_URL --> TOMBSTONE : Supervisor promotes immediately
    TOMBSTONE --> PENDING : Supervisor issues new SERP query
    USER_DIRECTIVE --> STRATEGY : Supervisor reads on next evaluation cycle
    VERIFIED --> SYNTHESIS : All claims verified - zero PENDING - zero UNVERIFIED
    SYNTHESIS --> [*] : Final answer delivered - Redis TTL expires

    note right of STRATEGY
        Write permissions
        Supervisor only  — STRATEGY · TOMBSTONE
        Worker only      — PENDING · VERIFIED · UNVERIFIED · FAILED_URL
        User only        — USER DIRECTIVE
    end note

    note right of VERIFIED
        Redis backend
        Atomic RPUSH — no race conditions
        Sub-millisecond reads
        TTL auto-cleanup per run
        Key format — scratchpad:{thread_id}
    end note

    note right of USER_DIRECTIVE
        Upcoming feature
        Redis pub/sub notifies Supervisor
        No stream break required
        Operation continues with
        corrected intent
    end note
   ````
   