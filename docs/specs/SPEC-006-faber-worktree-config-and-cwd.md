---
org: corthos
system: api.corthodex.ai
title: SPEC-006 - FABER Worktree Config and Working Directory Discipline
description: Root cause analysis of issue #60 worktree escape and proposed upstream fixes for fractary-faber plugin
tags: [spec, faber, worktree, cwd, upstream, fractary-faber]
created: 2026-03-23
updated: 2026-03-23
fractary_doc_type: specification
visibility: internal
---

# SPEC-006: FABER Worktree Config and Working Directory Discipline

**Status**: Proposed upstream fix for `fractary/faber` project
**Affects**: `fractary-faber` plugin, all projects using FABER workflows

---

## Background

During the implementation of issue #60 (entity-first admission handler), a root cause analysis revealed two related bugs in the `fractary-faber` plugin that caused the build phase to write handler files to the **wrong directory** — the project root rather than the active git worktree. The implementation was never committed, only the research spec was merged via PR #69, and the wrong (collection-first) handler was deployed to production.

This spec documents the root cause, evidence, and proposed fixes for the upstream `fractary/faber` project.

---

## Root Cause #1: Frame Phase Hardcodes `worktree: true`

### Location

```
plugins/faber/skills/fractary-faber-frame/workflow/basic.md
line 148: "worktree": true
```

### Problem

The FABER frame phase unconditionally creates a git worktree via the `repo-manager` plugin. The `basic.md` skill contains:

```markdown
CRITICAL: The worktree: true parameter ensures the workflow executes in an isolated worktree.
```

There is no configuration field to disable this behavior. Calling `faber config-init` does not add a `worktree.enabled` field to `.fractary/config.yaml`. The worktree is created regardless of whether:
- The user already has a worktree active (Claude Code `--worktree` flag)
- The user's project prefers not to use FABER-managed worktrees
- Claude Code already provides superior worktree management

### Impact

When a user runs Claude Code with `--worktree` to get an isolated execution environment, FABER creates a **second** git worktree. The FABER subagents (engineer, researcher, etc.) are spawned as Tasks without an explicit working directory. They resolve paths relative to `git rev-parse --show-toplevel` (the git root), which is the **project root**, not the Claude Code worktree at `$PWD`.

### Evidence from Issue #60

```
# Claude Code --worktree created:
/home/ubuntu/.claude-worktrees/corthosai-api.corthodex.ai-60/

# FABER frame phase created:
~/.claude-worktrees/corthosai-api.corthodex.ai-60/  (same branch, second worktree)

# Engineer subagent wrote to:
/home/ubuntu/GitHub/corthos/api.corthodex.ai/src/handlers/education-colleges-admission.ts
# (project root — NOT the Claude Code worktree)

# Files were never committed to feat/60 branch
# PR #69 squash-merged only the research spec (365 insertions)
# Wrong collection-first handler deployed to production
```

---

## Root Cause #2: Subagent Working Directory Not Inherited from `$PWD`

### Problem

When Claude Code is launched with `--worktree`, it sets `$PWD` to the worktree path (e.g., `/home/ubuntu/.claude-worktrees/corthosai-api.corthodex.ai-60/`). However, FABER-spawned subagents (via `Task()`) resolve file paths using `git rev-parse --show-toplevel`, which returns the **git root** of the original repository, not the worktree path.

Any skill or subagent that uses `git rev-parse --show-toplevel` to construct absolute paths will silently write to the wrong directory when executing inside a worktree.

### Affected Components

1. **fractary-faber build phase agent** — writes implementation files using git-root-relative paths
2. **fractary-faber researcher agent** — reads/writes spec files
3. **fractary-repo CLI commands** — `fractary-core repo commit` resolves to the wrong working directory

### Evidence

```bash
# Inside worktree at /home/ubuntu/.claude-worktrees/corthosai-api.corthodex.ai-60/
$ pwd
/home/ubuntu/.claude-worktrees/corthosai-api.corthodex.ai-60/

$ git rev-parse --show-toplevel
/home/ubuntu/GitHub/corthos/api.corthodex.ai   # ← git root, NOT the worktree
```

When a Task-spawned subagent uses `git rev-parse --show-toplevel` to anchor file operations, all writes go to the git root, not the worktree.

---

## Proposed Fixes

### Fix 1: Add `faber.worktree.enabled` Config Field

**Change**: Add a `worktree.enabled` boolean field to the FABER config schema, defaulting to `false`.

**Config schema addition** (`.fractary/config.yaml`):

```yaml
faber:
  workflows:
    path: .fractary/faber/workflows
    default: api-create
    autonomy: guarded
  runs:
    path: .fractary/faber/runs
  worktree:
    # Set to true if you want FABER to manage the worktree lifecycle.
    # Default is false: Claude Code's --worktree flag is the preferred
    # worktree isolation mechanism. FABER will operate within $PWD.
    enabled: false
```

**`faber config-init` change**: When generating initial configuration, always write `faber.worktree.enabled: false` with a comment explaining the recommended pattern.

**`plugins/faber/skills/fractary-faber-frame/workflow/basic.md` change** (line ~148):

```markdown
# Read worktree config (default: false)
const worktreeEnabled = config.faber?.worktree?.enabled ?? false;

# Pass to repo-manager
"worktree": worktreeEnabled
```

Remove or soften the "CRITICAL: The worktree: true parameter..." note. Replace with:

```markdown
NOTE: worktree defaults to false. Claude Code's --worktree flag is the preferred
isolation mechanism. Enable faber.worktree.enabled: true in .fractary/config.yaml
only if you want FABER to manage the worktree lifecycle directly.
```

### Fix 2: Working Directory Discipline in Subagents

**Change**: When the workflow orchestrator or any FABER skill/subagent needs to construct file paths, it MUST use `$PWD` (or the equivalent `process.cwd()`) rather than `git rev-parse --show-toplevel`.

**Audit locations**: Search all skill files for `git rev-parse --show-toplevel` and replace with `$PWD`-relative paths. Key files to check:

```
plugins/faber/skills/fractary-faber-build/*/
plugins/faber/skills/fractary-faber-frame/*/
plugins/faber/skills/fractary-faber-evaluate/*/
plugins/faber/skills/fractary-faber-release/*/
```

**Task prompt injection**: When spawning subagent Tasks from inside a worktree (detected when `$PWD != git rev-parse --show-toplevel`), the orchestrator MUST pass the current `$PWD` as an explicit context variable in the Task prompt:

```markdown
IMPORTANT: You are operating inside a git worktree.
Working directory: {$PWD}
All file operations MUST use paths relative to {$PWD}.
Do NOT use `git rev-parse --show-toplevel` for path resolution —
that returns the git root, not the current worktree.
```

### Fix 3: Detection Helper

**New utility**: Add a helper function to detect the worktree context:

```bash
# Detect if running inside a worktree
is_in_worktree() {
  local git_root=$(git rev-parse --show-toplevel 2>/dev/null)
  local cwd=$(pwd)
  if [ "$git_root" != "$cwd" ] && [ "${cwd#$git_root}" = "$cwd" ]; then
    echo "true"
  else
    echo "false"
  fi
}

# More robust: check git worktree list
git worktree list --porcelain | grep -q "worktree $(pwd)" && echo "in_worktree" || echo "main"
```

---

## Recommended Worktree Model

There are two valid patterns for worktree isolation with FABER:

### Pattern A: Claude Code manages worktree (Recommended)

```bash
# Claude Code creates the worktree
claude --worktree /fractary-faber-workflow-run 60

# FABER config: worktree.enabled: false (default)
# All FABER operations run within $PWD (the Claude Code worktree)
# Claude Code handles worktree cleanup
```

**Advantages**: Better integration with Claude Code session management, automatic cleanup, no double-worktree creation.

### Pattern B: FABER manages worktree

```yaml
# .fractary/config.yaml
faber:
  worktree:
    enabled: true  # FABER creates and manages the worktree
```

```bash
# Claude Code does NOT use --worktree
/fractary-faber-workflow-run 60
```

**Advantages**: Simpler single command, no CLI flag needed.

**Caution**: See Root Cause #2 above — subagent CWD discipline must be verified before relying on Pattern B.

---

## Temporary Mitigation (This Project)

Until the upstream `fractary/faber` fix is applied, this project uses the following workaround:

1. **`.fractary/config.yaml`** has `faber.worktree.enabled: false` (added 2026-03-23) with a comment referencing this spec.
2. **Never use Claude Code `--worktree`** with FABER workflows unless the working directory issue is resolved upstream.
3. **Run FABER from the project root** directly. All file writes happen in the correct location.

---

## Upstream Delivery

This spec should be filed as a bug report + feature request in the `fractary/faber` repository:

- **Bug**: Frame phase hardcodes `worktree: true` with no config override
- **Bug**: Subagents spawned inside a worktree write to git root instead of `$PWD`
- **Feature**: Add `faber.worktree.enabled` config field, default `false`
- **Feature**: `faber config-init` generates `worktree.enabled: false` with explanatory comment

---

## References

- Issue #60: entity-first admission handler — commit `1f210d1` (re-implemented after root cause analysis)
- PR #69: squash-merged only research spec (wrong handler deployed — root cause of this spec)
- `.fractary/config.yaml`: `faber.worktree.enabled: false` (local mitigation)
- `~/.claude/plugins/marketplaces/fractary-faber/plugins/faber/skills/fractary-faber-frame/workflow/basic.md` (upstream file — do not edit locally)
