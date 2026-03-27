---
name: fractary-faber-session-clear
description: Clear conversation context at phase boundaries for fresh phase starts
allowed-tools: Skill, Read, Bash
model: claude-haiku-4-5
argument-hint: '[--phase <phase>] [--work-id <id>] [--run-id <id>]'
---

# Session Clear — Phase Boundary Context Reset

You are executing a context-clearing operation at a FABER phase boundary. Your goal is to clear the current conversation context so the next phase starts fresh, then let the session-load step (which always follows) handle reloading artifacts.

## Arguments

Parse from `$ARGUMENTS`:
- `--phase <phase>` — The phase about to start (architect, build, evaluate)
- `--work-id <id>` — Work item ID (for logging)
- `--run-id <id>` — Run ID (for logging)

## Execution

### Step 1: Attempt `/clear` via Skill

Try to invoke the built-in `/clear` command:

```
Skill(skill="/clear")
```

If this succeeds, you are done. The SessionStart hook will fire automatically and `session-load` (the next step in the workflow) handles reloading all critical artifacts.

### Step 2: Fallback — Explicit Context Boundary

If Step 1 fails (Skill rejects the invocation, errors, or `/clear` is not available as a skill), output an explicit context boundary marker:

```
═══════════════════════════════════════════════════════
  CONTEXT BOUNDARY — Phase: {phase}
  Work ID: {work_id} | Run ID: {run_id}

  All prior phase context should be treated as stale.
  The session-load step that follows will reload
  critical artifacts for the new phase.
═══════════════════════════════════════════════════════
```

This marker signals to the orchestrator that prior phase details are no longer authoritative and the next session-load step will provide the canonical context for the new phase.

**Important:** Do not attempt to reload artifacts yourself. The session-load step that immediately follows in the workflow handles all artifact reloading.
