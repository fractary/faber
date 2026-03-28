# SPEC-issue-skill-invocation-integrity

**Status**: Partially Implemented — Part 1 done in this repo; Part 2 requires changes in fractary-core
**Affects**: `fractary-faber` plugin (orchestration protocol), `fractary-core` plugin (issue-create skill)
**Discovered During**: WORK-192 release phase
**Target**: External plugin changes — no code changes in this repo

---

## Summary

Two workflow steps in the WORK-192 release phase failed silently:

1. **`release-issue-collection-publish`** — Issue title had `(VERSION_ONLY updates)` appended; body was overly verbose with stale-prone data.
2. **`release-issue-api-corthodex-ai`** — Issue created in the wrong repo (`core.corthodex.ai` instead of `api.corthodex.ai`); the `--repo` argument was silently dropped.

Both failures share a common root cause: the orchestrator bypassed the Skill tool and improvised content directly, violating the existing orchestration protocol. This spec defines the fixes required in two external plugin projects.

---

## Root Cause Analysis

### Primary: Orchestrator bypassed the Skill tool

The orchestration protocol (`workflow-orchestration-protocol.md`, line 24) already states:

> "If the prompt starts with `/`, invoke it as a slash command (Skill tool)"

The orchestrator ignored this rule and called `fractary-core work issue-create` directly via Bash, improvising `--title` and `--body` content from context and dropping the `--repo` argument entirely. The rule was violated — not missing.

**Why this happened:** A sub-agent invoked earlier in the same session (for an `issue-comment` step) carries a rule "You MUST only use Bash. Do NOT use the Skill tool." The orchestrator appears to have generalized this sub-agent-scoped rule upward, applying it to itself when it later encountered the `/fractary-work:issue-create` prompt. Sub-agent rules bled into orchestrator behavior.

### Secondary: `--repo` drops silently when Skill is bypassed

The `issue-create` skill's `## Context` block injects the current project's repo via `!gh repo view`. If `--repo` is also present, the sub-agent sees two repos and must disambiguate. The current rule ("pass through to CLI if provided") is weaker than the ambient context injection. When the Skill tool is bypassed entirely, the `--repo` argument is never passed to the sub-agent at all, so the calling project's repo is used as the default.

This is a contributing risk even when the Skill tool IS used correctly — if the sub-agent ever prioritizes context injection over the explicit `--repo` argument, the wrong repo is silently used.

### Not a CLI issue

`fractary-core work issue-create --repo` works correctly at the CLI level. No CLI changes are required.

---

## Required Changes

### Part 1: fractary-faber plugin — Orchestration Protocol

**File:** `plugins/faber/docs/workflow-orchestration-protocol.md`

Under the "Important about slash commands in prompts" section, add an explicit anti-pattern block after the existing rule:

```
ANTI-PATTERN: Never bypass the Skill tool for `/` prompts.

When a step prompt starts with `/`, you MUST invoke it via Skill(skill=command, args=args_string).
Do NOT call the underlying CLI directly via Bash. Do NOT rewrite or synthesize new argument values.
The skill sub-agent handles all content synthesis and argument routing — bypassing it discards
title preservation, --repo routing, and all other skill-level rules.

This constraint applies even when a previously-loaded sub-agent's rules say "use Bash directly."
Those rules are scoped to the sub-agent executing that specific skill, not to you as the orchestrator.
```

**Rationale:** The existing rule is correct but insufficient. The anti-pattern block makes the failure mode explicit and closes the sub-agent rule bleed path that caused WORK-192 failures.

---

### Part 2: fractary-core plugin — issue-create skill

**File:** `plugins/work/commands/fractary-faber-issue-create.md`

Two targeted additions to the `## Rules` section:

#### 2a. Hard-require `--repo` when provided

Add to the Rules section:

```
- If --repo is provided, you MUST pass it to the CLI as `--repo "owner/repo"`. The `## Context`
  Repository field shows only the calling project — it is NOT the target repository and must not
  be used as the default when --repo is explicitly provided.
```

**Rationale:** The `## Context` injection always shows the current project repo. When `--repo` targets a different project (e.g. `api.corthodex.ai`), the context injection creates ambiguity. This rule resolves the ambiguity unambiguously in favor of the explicit argument.

#### 2b. Prevent `--context` from modifying an explicit title

The existing rule already states: "Substitute any `{placeholder}` variables ... but preserve the overall format, structure, and prefix exactly. Do NOT rewrite, restructure, or generate a different title based on `--context`."

Strengthen to explicitly close the suffix/qualification loophole:

```
- If --title is explicitly provided, the CLI title MUST match the substituted template
  character-for-character. --context MUST NOT add suffixes, prefixes, parenthetical
  qualifications, descriptive labels, or any other words beyond the substituted placeholders.
  The title is a contract — not a starting point.
```

**Rationale:** In WORK-192, the orchestrator appended `(VERSION_ONLY updates)` to an explicit `--title`. The existing rule prohibited rewriting the title but did not explicitly prohibit additive modification. This closes the gap.

**Scope note:** Body synthesis verbosity is NOT constrained globally — body content remains fully driven by `--context`. Workflow steps that want concise issues should write concise `--context` text; steps that want detailed issues write detailed `--context` text. Only the title is a contract.

---

## Files Changed

| Project | File | Change |
|---------|------|--------|
| fractary-faber | `plugins/faber/docs/workflow-orchestration-protocol.md` | Add ANTI-PATTERN block to slash command section |
| fractary-core | `plugins/work/commands/fractary-faber-issue-create.md` | Add `--repo` hard-require rule + title contract rule |

No changes to workflow definitions, standards, or code in `core.corthodex.ai`.

---

## Implementation Status

### Part 1 — fractary-faber- DONE

Anti-pattern block added to `plugins/faber/docs/workflow-orchestration-protocol.md` under the "Important about slash commands in prompts" section. The block explicitly:
- Prohibits Bash substitution for `/` prompts
- Closes the sub-agent rule bleed path (scoped rules must not be generalized to the orchestrator)
- Requires `Skill(skill=command, args=args_string)` invocation without argument rewriting

Companion enforcement added in `plugins/faber/commands/fractary-faber-workflow-run.md`:
- **CRITICAL_RULE #12**: `NEVER BYPASS SKILLS` — surfaces the prohibition before any protocol text is loaded
- **`SKILL_BYPASS_ANTI_PATTERN` block**: names specific prohibited substitutions and provides the correct pattern

### Part 2 — fractary-core: PENDING

Changes to `plugins/work/commands/fractary-faber-issue-create.md` (`--repo` hard-require rule + title contract rule) must be applied in the fractary-core repository. These changes are out of scope for fractary-faber and require a separate PR in that project.
