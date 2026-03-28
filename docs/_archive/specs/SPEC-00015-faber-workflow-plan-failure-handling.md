---
spec: SPEC-00015
title: FABER Workflow Plan — Failure Handling & Idempotency
status: active
created: 2026-02-27
work-ref: WORK-128
affects: fractary-faber plugin (workflow-plan skill, faber-planner agent)
---

# SPEC-00015: FABER Workflow Plan — Failure Handling & Idempotency

## Background

During WORK-128, the `/fractary-faber-workflow-plan` skill was invoked. The skill's
frontmatter explicitly listed `Task(fractary-faber-faber-planner)` as the only permitted tool.

Execution sequence:
1. `Task(fractary-faber-faber-planner)` called — ran for ~17 minutes
2. Failed with `UND_ERR_SOCKET` (Node.js undici — TCP socket closed before response delivered)
3. Claude incorrectly substituted `Skill(fractary-faber-workflow-plan)` (not in allowed tools)
4. That in turn called `Task(fractary-faber-faber-planner)` again — ~20 more minutes wasted
5. Total wasted time: ~37 minutes across two executions

**Root causes identified:**

| # | Root Cause | Location |
|---|-----------|----------|
| 1 | No failure-handling instructions in `workflow-plan.md` | fractary-faber plugin |
| 2 | No project-level rule preventing tool substitution | lake.corthonomy.ai CLAUDE.md |
| 3 | No persistent memory entry for this constraint | Claude memory |
| 4 | faber-planner has no idempotency guard against duplicate plan creation | fractary-faber plugin |

Root causes 2 and 3 have been addressed in this project (CLAUDE.md Behavior Constraints
section + MEMORY.md). This document covers the changes needed in the **fractary-faber plugin**.

---

## Problem 1: No Failure Instructions in workflow-plan.md

### Current State

The `workflow-plan.md` skill file (in the fractary-faber plugin) defines allowed tools but
provides no guidance on what Claude should do if the required `Task(faber-planner)` call fails.
Only the success path is described.

### Proposed Fix

Add an explicit `## On Failure` section to the `workflow-plan.md` frontmatter or body.

**Exact text to add** (insert after the tool use section, before any output format section):

```markdown
## On Failure

If `Task(fractary-faber-faber-planner)` fails for any reason (socket error, API error,
timeout, or any other error):

1. **STOP immediately** — do not attempt any other tool call
2. **Report the exact error** to the user verbatim
3. **Check for partial artifacts** — inform the user to check:
   - `.fractary/faber/runs/{plan-id}/plan.json` (may exist if agent completed but socket dropped)
   - `.fractary/faber/runs/{plan-id}/state.json`
4. **Wait for user instruction** — do not retry, do not substitute tools

A `UND_ERR_SOCKET` error on WSL2 means the TCP connection dropped. The faber-planner
agent may have completed successfully — its output file may already exist on disk even
though the result was not returned to Claude. Always check for existing artifacts before
re-running.
```

### Files to Modify in fractary-faber

```
.claude/skills/fractary-faber-fractary-faber/workflow-plan.md   (or equivalent path in fractary-faber repo)
```

---

## Problem 2: faber-planner Has No Idempotency Guard

### Current State

The `faber-planner` agent starts generating a new plan immediately when invoked. If called
twice due to a retry (whether by Claude or by the user), it creates a second plan, potentially
overwriting or conflicting with the first.

### Proposed Fix

Add an idempotency check at the start of the faber-planner agent prompt. Before generating
a plan, the agent should check whether a plan already exists for the given work-id and
workflow combination.

**Logic to add at the start of faber-planner agent**:

```
Before generating a plan, check:
1. Does `.fractary/faber/runs/{plan-id}/plan.json` exist?
2. Does it contain a valid plan for this workflow and work-id?

If YES:
- Report to the user: "A plan already exists at {path}. Created at {timestamp}."
- Show plan summary (phases, steps, target)
- Ask: "Do you want to use the existing plan, or generate a new one?"
- Default: use existing plan (idempotent)

If NO:
- Proceed with plan generation as normal
```

**Plan ID derivation** (match existing convention):
```
plan-id = "{org}-{system}-{work-id}"
e.g. "corthosai-lake-corthonomy-ai-128"
```

The run directory path:
```
.fractary/faber/runs/{plan-id}/
```

### Files to Modify in fractary-faber

```
.claude/agents/fractary-faber-fractary-faber/faber-planner.md   (or equivalent path in fractary-faber repo)
```

---

## Verification Checklist

When implementing these changes in the fractary-faber plugin, verify:

- [ ] `workflow-plan.md` contains an explicit `## On Failure` section
- [ ] The failure section names `UND_ERR_SOCKET` as a known WSL2 error pattern
- [ ] The failure section instructs Claude to check for existing artifacts before reporting failure
- [ ] `faber-planner` checks for existing `plan.json` before generating a new plan
- [ ] Idempotency check shows plan summary and asks for confirmation before overwriting
- [ ] Default behavior (no user response) is to use the existing plan, not overwrite it

---

## Notes for Transfer

This document is intended to be copied to the fractary-faber plugin project as a reference
for implementing these changes. The exact file paths within the fractary-faber plugin may
differ from what is shown above — adapt as needed.

The lake.corthonomy.ai-side mitigations (CLAUDE.md Behavior Constraints + MEMORY.md) are
already in place as of 2026-02-27.
