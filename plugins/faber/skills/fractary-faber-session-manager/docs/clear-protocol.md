# Session Clear Protocol

Protocol for clearing conversation context at phase boundaries. Prevents context from one workflow phase bleeding into the next, ensuring each phase starts with a clean slate.

## Purpose

When a FABER workflow transitions between phases (e.g., from Architect to Build), the conversation context accumulated during the previous phase is no longer relevant and can cause confusion. The clear operation resets this context so the next phase begins fresh.

This operation always precedes a session-load operation. The sequence is: clear old context, then load artifacts relevant to the new phase.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `--phase <phase>` | The phase boundary being cleared (e.g., `architect`, `build`) |
| `--work-id <id>` | Work item ID for the boundary marker |
| `--run-id <id>` | Run ID for the boundary marker |

## Algorithm

### 1. Log Phase Boundary

If `--phase` is provided, log which phase boundary is being cleared. This provides an audit trail in the session history.

### 2. Attempt Context Clear

Attempt to invoke `/clear` to reset the conversation context. This is the preferred method as it fully resets the conversation window.

### 3. Fallback Boundary Marker

If `/clear` is not available (e.g., the environment does not support it), output an explicit context boundary marker instead:

```
=== CONTEXT BOUNDARY ===
Previous phase context has been cleared.
Phase: {phase}
Work ID: {work_id}
Run ID: {run_id}
Starting fresh context for next phase.
=== END BOUNDARY ===
```

The boundary marker serves as a visual and semantic separator. While it does not free context window space like a true clear, it signals to both the agent and any observers that prior context should be treated as stale.

### 4. Precedes Load

After the clear operation completes, a session-load operation is expected to follow immediately. The load operation will bring in only the artifacts relevant to the new phase, providing clean and focused context for the work ahead.
