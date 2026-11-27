---
title: Orchestrator State Machine (TLA+)
category: algorithms
slug: orchestrator-spec
nav_order: 4
status: current
---

\section{Orchestrator — Formal Specification}

\subsection*{Overview}

This TLA+ specification models the supervisor/worker state machine.
It includes weak fairness constraints that are \textbf{sound with respect to
the current implementation} — they are not aspirational annotations but
are backed by concrete code.

\subsection*{Soundness of Fairness Annotation}

$WF_{\text{vars}}(WorkerCompletes)$ asserts: if $WorkerCompletes$ is
continuously enabled, it must eventually fire.

This is backed in the implementation by:

\begin{itemize}
  \item \texttt{\_WORKER\_RUN\_TIMEOUT = 1200} in \texttt{DelegationMixin}
  \item \texttt{\_wait\_for\_run\_completion} raises \texttt{asyncio.TimeoutError}
        on expiry, which is caught and converted to an error tool output
  \item The supervisor loop then continues — $WorkerCompletes$ fires
        (as an error) within bounded time
\end{itemize}

This means the fairness annotation is \textbf{currently sound}. It was previously
classified as aspirational — that classification was incorrect.

\subsection*{Module}

\begin{verbatim}
----------------------- MODULE Orchestrator -----------------------
EXTENDS Naturals, Sequences

CONSTANTS MaxSupervisorTurns,   \* = 200 (process_conversation)
          WorkerTimeoutSeconds   \* = 1200 (DelegationMixin)

VARIABLES
  supervisorState,
  workerQueue,
  scratchpad,
  delegationCount

vars == <<supervisorState, workerQueue, scratchpad, delegationCount>>
\end{verbatim}

\subsection*{State Space}

Supervisor states are drawn from:

\[ \{Idle,\ Delegating,\ Awaiting,\ Evaluating,\ Synthesizing,\ Terminated\} \]

The type invariant requires:

\begin{itemize}
  \item $supervisorState \in SupervisorStates$
  \item $workerQueue \in Seq(\{Running,\ Complete,\ TimedOut\})$
  \item $scratchpad \in Seq(\{Incomplete,\ Complete\})$
  \item $delegationCount \in \mathbb{N}$
  \item $delegationCount \leq MaxSupervisorTurns$
\end{itemize}

Note: $WorkerTimedOut$ is a new terminal worker state absent from the original spec.
It reflects \texttt{asyncio.TimeoutError} handling in \texttt{\_wait\_for\_run\_completion}.

\subsection*{Initial State}

\begin{verbatim}
Init ==
  /\ supervisorState = "Idle"
  /\ workerQueue     = << >>
  /\ scratchpad      = << >>
  /\ delegationCount = 0
\end{verbatim}

\subsection*{Transitions}

\textbf{SpawnWorker} — fires when $supervisorState = Delegating$
and $delegationCount < MaxSupervisorTurns$:

\[ delegationCount' = delegationCount + 1 \]
\[ supervisorState' = Awaiting \]

\textbf{WorkerCompletes} — worker run reaches terminal state within $T_W = 1200\text{s}$:

\[ scratchpad' = Append(scratchpad,\ Complete) \]
\[ supervisorState' = Evaluating \]

\textbf{WorkerTimesOut} — \texttt{asyncio.TimeoutError} fires after $T_W$:

\[ scratchpad' = Append(scratchpad,\ Incomplete) \]
\[ supervisorState' = Evaluating \]

\textbf{Evaluate} — branches on depth bound:

\[ supervisorState' = \begin{cases} Synthesizing & \text{if } delegationCount \geq MaxSupervisorTurns \\ Delegating & \text{otherwise} \end{cases} \]

\textbf{Note on $Synthesizing$:} In the current implementation, entering $Synthesizing$
when $delegationCount \geq MaxSupervisorTurns$ produces a hard error, not a synthesis.
See \textit{Liveness Gap Analysis} — this is the primary open gap.

\textbf{Synthesize}:

\[ supervisorState' = Terminated \]

\subsection*{Fairness}

\begin{verbatim}
Fairness ==
  /\ WF_vars(WorkerCompletes)
  /\ WF_vars(WorkerTimesOut)
  /\ WF_vars(Evaluate)
  /\ WF_vars(Synthesize)

Spec ==
  Init /\ [][Next]_vars /\ Fairness
\end{verbatim}

Both $WF_{\text{vars}}(WorkerCompletes)$ and $WF_{\text{vars}}(WorkerTimesOut)$ are
sound: \texttt{\_WORKER\_RUN\_TIMEOUT} guarantees one of the two fires within 1200s.

\subsection*{Safety Properties}

$\textbf{Safety}$: $\square\ TypeInvariant$ — holds at every reachable state.

\subsection*{Liveness Property}

\[ \Diamond\ (supervisorState = Terminated) \]

Checkable by TLC under the current $Spec$ with $Fairness$.
Note: $Terminated$ includes the failure case (max turns exceeded).
$\Diamond\ Success$ is the stronger property — see \textit{Liveness Gap Analysis}.

\qed