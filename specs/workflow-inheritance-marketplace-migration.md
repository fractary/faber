# SPEC: Fix Workflow Inheritance for Split Marketplace Architecture

**Status:** Draft
**Created:** 2025-12-28
**Author:** Analysis from etl.corthion.ai project
**Target Project:** fractary/faber

## Problem Statement

When using `/fractary-faber:workflow-plan` to create execution plans with workflows that extend `fractary-faber:core`, the workflow inheritance chain is recognized but parent workflow steps are NOT included in the generated plan. Only the child workflow steps appear in the final plan.

### Expected Behavior
When a workflow extends `fractary-faber:core`, the generated plan should include:
- Pre-steps from parent workflows (executed before child steps)
- Main steps from child workflow
- Post-steps from parent workflows (executed after child steps)

### Actual Behavior
Plans show the correct `inheritance_chain` metadata:
```json
"inheritance_chain": ["dataset-maintain", "fractary-faber:core"]
```

But the merged workflow phases contain ONLY steps from the child workflow. All parent workflow steps are missing.

### Example
For a workflow extending `fractary-faber:core`, the expected Frame phase should include:
```json
"frame": {
  "steps": [
    // From parent (fractary-faber:core) - MISSING
    {"id": "core-fetch-or-create-issue", ...},
    {"id": "core-switch-or-create-branch", ...},
    // From child (dataset-maintain) - PRESENT
    {"id": "dataset-inspect-initial", ...}
  ]
}
```

But currently only the child step appears.

## Root Cause Analysis

### Marketplace Architecture Migration
The Fractary plugin ecosystem has migrated from a single unified marketplace to separate marketplaces:

**Old Structure (still exists):**
```
~/.claude/plugins/marketplaces/fractary/
  ├── plugins/faber/
  ├── plugins/repo/
  ├── plugins/work/
  └── ...
```

**New Structure (current):**
```
~/.claude/plugins/marketplaces/
  ├── fractary-core/
  │   └── plugins/{repo,work,docs,spec}/
  ├── fractary-codex/
  │   └── plugins/codex/
  └── fractary-faber/
      └── plugins/faber/
```

### The Bug
Two critical files still hardcode the OLD marketplace path:

**1. merge-workflows.sh** (line 23):
```bash
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/marketplaces/fractary}"
```

**2. faber-planner.md** (Step 3):
```bash
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/marketplaces/fractary}"
```

### Impact Chain

1. **Namespace Resolution**: When resolving `fractary-faber:core`, the namespace is `fractary-faber`
2. **Path Construction**: Script builds path as `${PLUGIN_ROOT}/plugins/faber/config/workflows/core.json`
3. **Actual Path Used**: `~/.claude/plugins/marketplaces/fractary/plugins/faber/config/workflows/core.json`
4. **Problem**: This loads the OLD workflow definition from the old marketplace
5. **Format Mismatch**: Old marketplace has command+arguments format, new has prompt-based format
6. **Result**: Steps in old format are filtered out or fail to process, leaving only child steps

### Evidence
```bash
# Old marketplace workflow format (command+arguments):
{
  "command": "/fractary-work:issue-fetch",
  "arguments": {"issue_number": "{work_id}"}
}

# New marketplace workflow format (prompt-based):
{
  "prompt": "/fractary-work:issue-fetch --work-id {work_id}"
}
```

The diff shows all parent workflow steps use the old format when loaded from the old marketplace location.

## Proposed Solution

### Overview
Update workflow resolution to be namespace-aware, mapping each namespace to its corresponding marketplace directory in the new split architecture.

### Changes Required

#### File 1: merge-workflows.sh

**Location:** `plugins/faber/skills/faber-config/scripts/merge-workflows.sh`

**Change 1 - Update default path (line ~23):**
```bash
# Before:
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/marketplaces/fractary}"

# After:
MARKETPLACE_ROOT="${CLAUDE_MARKETPLACE_ROOT:-$HOME/.claude/plugins/marketplaces}"
```

**Change 2 - Update resolve_workflow_path function (lines ~52-72):**
```bash
resolve_workflow_path() {
    local workflow_id="$1"
    local namespace=""
    local workflow_name=""

    # Parse namespace from workflow_id
    if [[ "$workflow_id" == *":"* ]]; then
        namespace="${workflow_id%%:*}"
        workflow_name="${workflow_id#*:}"
    else
        namespace="project"
        workflow_name="$workflow_id"
    fi

    # Map namespace to marketplace-aware path
    case "$namespace" in
        "fractary-faber")
            echo "${MARKETPLACE_ROOT}/fractary-faber/plugins/faber/config/workflows/${workflow_name}.json"
            ;;
        "fractary-faber-cloud")
            echo "${MARKETPLACE_ROOT}/fractary-faber/plugins/faber-cloud/config/workflows/${workflow_name}.json"
            ;;
        "fractary-core")
            # Extract plugin name from workflow_name if it contains slash
            local plugin="${workflow_name%%/*}"
            local workflow="${workflow_name##*/}"
            echo "${MARKETPLACE_ROOT}/fractary-core/plugins/${plugin}/config/workflows/${workflow}.json"
            ;;
        "fractary-codex")
            echo "${MARKETPLACE_ROOT}/fractary-codex/plugins/codex/config/workflows/${workflow_name}.json"
            ;;
        "project"|"")
            echo "${PROJECT_ROOT}/.fractary/plugins/faber/workflows/${workflow_name}.json"
            ;;
        *)
            # Fallback to old unified marketplace for backward compatibility
            echo "${MARKETPLACE_ROOT}/fractary/plugins/${namespace#fractary-}/config/workflows/${workflow_name}.json"
            ;;
    esac
}
```

#### File 2: faber-planner.md

**Location:** `plugins/faber/agents/faber-planner.md`

**Change - Update Step 3 instructions:**
```markdown
## Step 3: Resolve Workflow (MANDATORY SCRIPT EXECUTION)

**Determine workflow to resolve:**
<!-- existing logic -->

```bash
# Determine marketplace root (where all plugin marketplaces live)
MARKETPLACE_ROOT="${CLAUDE_MARKETPLACE_ROOT:-$HOME/.claude/plugins/marketplaces}"

# Execute the merge-workflows.sh script
"${MARKETPLACE_ROOT}/fractary-faber/plugins/faber/skills/faber-config/scripts/merge-workflows.sh" \
  "{workflow_id}" \
  --marketplace-root "${MARKETPLACE_ROOT}" \
  --project-root "$(pwd)"
```

**Example with default workflow:**
```bash
MARKETPLACE_ROOT="${CLAUDE_MARKETPLACE_ROOT:-$HOME/.claude/plugins/marketplaces}"
"${MARKETPLACE_ROOT}/fractary-faber/plugins/faber/skills/faber-config/scripts/merge-workflows.sh" \
  "fractary-faber:default" \
  --marketplace-root "${MARKETPLACE_ROOT}" \
  --project-root "$(pwd)"
```
```

**Note:** Also update merge-workflows.sh to accept `--marketplace-root` flag (in addition to `--plugin-root` for backward compatibility).

## Implementation Plan

### Phase 1: Update merge-workflows.sh

1. Add `--marketplace-root` argument parsing (maintain `--plugin-root` for backward compat)
2. Update default path variable from `PLUGIN_ROOT` to `MARKETPLACE_ROOT`
3. Rewrite `resolve_workflow_path()` function with namespace-aware mapping
4. Update all references to `PLUGIN_ROOT` to use `MARKETPLACE_ROOT`
5. Test with both old and new marketplace structures

### Phase 2: Update faber-planner.md

1. Update Step 3 instructions to use `MARKETPLACE_ROOT`
2. Update all example code blocks
3. Update script invocation to use new marketplace path

### Phase 3: Testing

#### Test Case 1: New Marketplace Structure
```bash
# Setup: Ensure fractary-faber marketplace exists
ls ~/.claude/plugins/marketplaces/fractary-faber/

# Execute: Create plan with extending workflow
/fractary-faber:workflow-plan --work-id 96

# Verify: Check plan contains inherited steps
cat logs/fractary/plugins/faber/plans/{plan-id}.json | jq '.workflow.phases.frame.steps[] | .id'
# Should show: core-fetch-or-create-issue, core-switch-or-create-branch, dataset-inspect-initial
```

#### Test Case 2: Old Marketplace Fallback
```bash
# Setup: Rename new marketplace to simulate old-only environment
mv ~/.claude/plugins/marketplaces/fractary-faber ~/.claude/plugins/marketplaces/fractary-faber.bak

# Execute: Create plan (should fall back to old marketplace)
/fractary-faber:workflow-plan --work-id 96

# Verify: Should still work (with old format steps)
# Cleanup:
mv ~/.claude/plugins/marketplaces/fractary-faber.bak ~/.claude/plugins/marketplaces/fractary-faber
```

#### Test Case 3: Mixed Namespaces
Test workflows that extend across different marketplaces (e.g., `fractary-core:*` workflows)

### Phase 4: Documentation

1. Update CHANGELOG.md with breaking change notice
2. Add migration guide for users with custom workflows
3. Document the namespace-to-marketplace mapping
4. Update README with new CLAUDE_MARKETPLACE_ROOT environment variable

## Backward Compatibility

The proposed solution maintains backward compatibility through:

1. **Fallback logic**: The `*` case in the switch statement handles unknown namespaces by falling back to old structure
2. **Environment variable**: `CLAUDE_PLUGIN_ROOT` continues to work (as `CLAUDE_MARKETPLACE_ROOT` is the new preferred name)
3. **Dual argument support**: Accept both `--plugin-root` and `--marketplace-root` flags
4. **Graceful degradation**: If new marketplace doesn't exist, falls back to old location

## Migration Path for Users

Users don't need to take action, but can optimize by:

1. **Optional**: Set environment variable for explicit control:
   ```bash
   export CLAUDE_MARKETPLACE_ROOT="$HOME/.claude/plugins/marketplaces"
   ```

2. **Optional**: Remove old marketplace after verifying everything works:
   ```bash
   # Test first!
   mv ~/.claude/plugins/marketplaces/fractary ~/.claude/plugins/marketplaces/fractary-backup
   # ... test all workflows ...
   # If all works: rm -rf ~/.claude/plugins/marketplaces/fractary-backup
   ```

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaks existing workflows | High | Comprehensive testing, backward compatibility |
| Path logic errors | Medium | Unit tests for all namespace cases |
| Environment variable conflicts | Low | Choose non-conflicting name (CLAUDE_MARKETPLACE_ROOT) |
| Old marketplace dependency | Low | Maintain fallback logic, document migration |

## Success Criteria

1. Workflows extending `fractary-faber:core` include all parent workflow steps in generated plans
2. All inherited steps use the NEW prompt-based format (not old command+arguments format)
3. Plans show correct source metadata for each step (`"source": "fractary-faber:core"`)
4. Backward compatibility maintained for old marketplace structure
5. All existing tests pass
6. New tests added for namespace resolution

## References

**Discovered in:** etl.corthion.ai project (corthosai/etl.corthion.ai)
**Related Issue:** #96 (Convert skills to agents for deterministic execution)
**Affects:** All projects using fractary-faber workflows with inheritance

**Key Files:**
- `~/.claude/plugins/marketplaces/fractary-faber/plugins/faber/skills/faber-config/scripts/merge-workflows.sh`
- `~/.claude/plugins/marketplaces/fractary-faber/plugins/faber/agents/faber-planner.md`
- `~/.claude/plugins/marketplaces/fractary-faber/plugins/faber/config/workflows/core.json` (NEW format)
- `~/.claude/plugins/marketplaces/fractary/plugins/faber/config/workflows/core.json` (OLD format)

## Appendix: Example Diff

### Old workflow (fractary marketplace):
```json
{
  "id": "core-fetch-or-create-issue",
  "name": "Fetch or Create Issue",
  "description": "...",
  "command": "/fractary-work:issue-fetch",
  "arguments": {
    "issue_number": "{work_id}"
  }
}
```

### New workflow (fractary-faber marketplace):
```json
{
  "id": "core-fetch-or-create-issue",
  "name": "Fetch or Create Issue",
  "description": "...",
  "prompt": "/fractary-work:issue-fetch --work-id {work_id}"
}
```

The new format is required for issue #96's deterministic command-to-agent delegation pattern.
