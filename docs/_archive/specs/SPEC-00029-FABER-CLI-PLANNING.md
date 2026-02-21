# SPEC-00029: FABER CLI Planning Enhancement + Worktree Management

**Status**: Approved
**Version**: 1.0
**Date**: 2026-01-06
**Authors**: FABER Team

## Overview

**Major Architecture Improvement**: Move the planning phase from Claude Code sessions into the FABER CLI. This separates batch-able planning from focused execution (Claude just runs the plan), enabling bulk workflow creation and future automation.

**Key Principles:**
1. **Issues exist first** - Plan command assumes GitHub issues already created (universal, works for any use case)
2. **Workflow from labels** - Each issue's workflow label determines which workflow config to use
3. **Confirmation before action** - Show user what will be planned, get approval before proceeding
4. **Delegate to plugins** - Use fractary-repo plugin for GitHub operations and worktree management
5. **Universal planning** - Works for ETL datasets, bug fixes, features, any workflow type

**Worktree Management**: Use global worktree directory (`~/.claude-worktrees/{organization}-{project}-{work-id}/` by default, respecting Claude Code's config) instead of subdirectories, following Claude Desktop conventions.

## Context

### Current Architecture (Problematic)
```
User → Claude → Plan (in Claude) → Run (in Claude)
```

**Problems:**
- workflow-plan-run command confuses Claude by mixing planning and execution
- Can't batch plan multiple workflows efficiently
- User must babysit each workflow from planning through execution
- Planning phase clutters the execution phase

### New Architecture (Better)
```
# Issues already exist (created manually or via future backlog manager)
GitHub Issues: #258, #259, #260 (with workflow labels)

# Planning Phase (FABER CLI)
User → faber plan --work-id 258,259,260
                 OR
       faber plan --work-label "workflow:etl,status:approved"

       ↓ Fetch issues from GitHub (via fractary-repo)
       ↓ Show list: "Will plan workflows for:"
       ↓   #258: Load IPEDS HD (workflow: etl)
       ↓   #259: Load IPEDS IC (workflow: etl)
       ↓   #260: Fix auth bug (workflow: bugfix)
       ↓ User confirms ✓
       ↓
       For each issue:
         ├── Generate plan JSON (via Anthropic API)
         ├── Create git branch (via fractary-repo)
         ├── Create git worktree (via fractary-repo)
         └── Write plan to worktree

# Execution Phase (Claude Code)
User → cd ~/.claude-worktrees/fractary-myproject-258
     → claude
     → /fractary-faber:workflow-run <plan-id>

       Claude just:
         ├── Load plan
         ├── Create todos
         └── Execute steps
```

**Benefits:**
- ✅ **Universal** - Works for any use case (ETL, bugs, features)
- ✅ **Batch-able** - Plan 10+ workflows at once
- ✅ **Flexible** - Different workflows per issue (via labels)
- ✅ **Safe** - Confirmation before planning
- ✅ **Focused execution** - Claude just runs the plan, no confusion
- ✅ **Parallel workflows** - Multiple terminals, multiple Claude sessions
- ✅ **Plugin-based** - Delegates to fractary-repo for GitHub and worktree operations
- ✅ **Future-proof** - Sets foundation for @faber in GitHub, bulk execution, other issue systems

### Key Insight: Parallel Workflows Need Separate Sessions Anyway

For true parallel execution, each workflow needs its own Claude session regardless of worktree location. Given this, we should:
1. Use conventional global worktree directory (`~/.claude-worktrees/`)
2. Focus on making batch planning efficient (FABER CLI)
3. Keep execution simple (Claude just runs pre-made plan)

### Worktree Location Decision

**Use global directory as default**: `~/.claude-worktrees/{organization}-{project}-{work-id}/`
- Includes GitHub organization to avoid conflicts across projects
- Matches Claude Desktop behavior (centralized)
- Centralized (all worktrees in one place)
- Clean (doesn't clutter parent or project directories)
- **Respects Claude Code config**: Read from Claude's settings if available
- **Configurable**: Allow override in FABER settings

## CLI Command Specification

### Usage

```bash
faber plan [options]

Options:
  --work-id <ids>          Comma-separated list of work item IDs (e.g., "258,259,260")
  --work-label <labels>    Comma-separated label filters (e.g., "workflow:etl,status:approved")
                          Fetches all issues matching ALL specified labels
  --workflow <name>        Override workflow (default: read from issue "workflow:*" label)
  --no-worktree           Skip worktree creation
  --no-branch             Skip branch creation
  --skip-confirm          Skip confirmation prompt (use with caution)
  --output <format>        Output format: text|json|yaml (default: text)
```

### Use Cases

- Single workflow: `faber plan --work-id 258`
- Multiple workflows: `faber plan --work-id 258,259,260`
- Label-based batch: `faber plan --work-label "workflow:etl,status:approved"`
- Bug batch: `faber plan --work-label "workflow:bugfix,priority:high"`

### Workflow Label Convention

- Issues should have a `workflow:*` label (e.g., `workflow:etl`, `workflow:bugfix`, `workflow:feature`)
- This label determines which workflow config to use for planning
- **If workflow label missing**: Prompt user to select workflow for those issues
- If multiple workflow labels exist, use first one or warn user
- Can be overridden with `--workflow` flag (applies to all issues)
- **Planning cannot proceed without workflows identified for all issues**

### Process Flow

```
faber plan --work-id 258,259 OR --work-label "workflow:etl,status:approved"
↓
1. Fetch issues from GitHub (via fractary-repo plugin)
   - If --work-id: fetch specified issues
   - If --work-label: query issues matching ALL labels

2. For each issue:
   - Extract work_id (issue number)
   - Read workflow label (e.g., "workflow:etl") or use --workflow override
   - Load workflow config (e.g., workflows/etl.json)

3. If any issues lack workflow labels, prompt user:
   ```
   ⚠️  The following issues are missing workflow labels:

   #258: Load IPEDS HD dataset
     Available workflows: etl, bugfix, feature, core
     Select workflow for this issue: [etl]

   #259: Load IPEDS IC dataset
     Available workflows: etl, bugfix, feature, core
     Select workflow for this issue: [etl]
   ```
   - User selects workflow for each issue missing label
   - Cannot proceed without workflows for all issues

4. Show confirmation prompt:
   ```
   📋 Will plan workflows for 3 issues:

   #258: Load IPEDS HD dataset
     Workflow: etl
     Branch: feature/258
     Worktree: ~/.claude-worktrees/fractary-myproject-258

   #259: Load IPEDS IC dataset
     Workflow: etl
     Branch: feature/259
     Worktree: ~/.claude-worktrees/fractary-myproject-259

   #260: Fix authentication timeout
     Workflow: bugfix
     Branch: feature/260
     Worktree: ~/.claude-worktrees/fractary-myproject-260

   Proceed? [Y/n]:
   ```

5. If confirmed, for each issue:
   a. Call Anthropic API to generate plan JSON (using workflow config + issue description)
   b. Call fractary-repo to create git branch (feature/{work_id})
   c. Call fractary-repo to create git worktree (~/.claude-worktrees/{organization}-{project}-{work_id})
   d. Write plan JSON to worktree (.fractary/faber/runs/{plan_id}/plan.json)
   e. **Update GitHub issue** with plan_id (via fractary-repo):
      - Add comment: "🤖 Workflow plan created: {plan_id}"
      - Add label: "faber:planned"
      - Store plan_id in issue body or custom field

6. Output summary with run instructions for each workflow
```

### Configuration

- Anthropic API key (from env or config)
- fractary-repo plugin (for GitHub and worktree operations)
- Worktree location (read from Claude Code config, fallback to `~/.claude-worktrees/`)
- Workflow config path

### Output Format

```
✓ Planned 3 workflows successfully:

[1/3] Issue #258: Load IPEDS HD dataset
      Workflow: etl
      Plan: myorg-myproject-258-20260106-143022
      Branch: feature/258
      Worktree: ~/.claude-worktrees/fractary-myproject-258

      To execute:
        cd ~/.claude-worktrees/fractary-myproject-258 && claude
        /fractary-faber:workflow-run myorg-myproject-258-20260106-143022

[2/3] Issue #259: Load IPEDS IC dataset
      Workflow: etl
      Plan: myorg-myproject-259-20260106-143025
      Branch: feature/259
      Worktree: ~/.claude-worktrees/fractary-myproject-259

      To execute:
        cd ~/.claude-worktrees/fractary-myproject-259 && claude
        /fractary-faber:workflow-run myorg-myproject-259-20260106-143025

[3/3] Issue #260: Fix authentication timeout
      Workflow: bugfix
      ...
```

## workflow-run Enhancements

### Accept work-id OR plan-id

The `/fractary-faber:workflow-run` command now accepts either:
- **Work ID** (e.g., `258`) - Fetches plan from GitHub issue
- **Plan ID** (e.g., `myorg-myproject-258-20260106-143022`) - Direct plan reference

### User Experience Improvement

```bash
# Simple: use work-id
/fractary-faber:workflow-run 258

# Traditional: use plan-id
/fractary-faber:workflow-run myorg-myproject-258-20260106-143022
```

Both are supported for backwards compatibility.

### Implementation Logic

```javascript
// Parse argument - can be work-id or plan-id
const arg = args[0];
let plan_id;

if (/^\d+$/.test(arg)) {
  // Numeric — this is a work ID, fetch plan_id from GitHub issue
  const work_id = arg;
  console.log(`→ Fetching plan for issue #${work_id}...`);

  const issue = await repoClient.fetchIssue(work_id);
  plan_id = extractPlanIdFromIssue(issue); // From comment or custom field

  if (!plan_id) {
    throw new Error(`No plan found for issue #${work_id}. Run 'faber plan --work-id ${work_id}' first.`);
  }

  console.log(`✓ Found plan: ${plan_id}`);
} else {
  // Non-numeric — this is a plan ID (e.g., myorg-myproject-258-20260106-143022)
  plan_id = arg;
}

// Load plan and execute
const plan = await loadPlan(plan_id);
const state = initializeState(plan);
await executeWorkflow(plan, state);
```

## Plan Manifest Schema

The plan JSON must include issue metadata:

```json
{
  "plan_id": "myorg-myproject-258-20260106-143022",
  "created_by": "cli",
  "cli_version": "3.4.0",
  "issue": {
    "source": "github",
    "id": "258",
    "url": "https://github.com/owner/repo/issues/258"
  },
  "branch": "feature/258",
  "worktree": "~/.claude-worktrees/fractary-myproject-258",
  "workflow": "etl",
  "phases": [...]
}
```

These fields make it clear what issue and environment this plan belongs to.

## Dependencies

### fractary-repo Plugin Commands

See [SPEC-00030](./SPEC-00030-FRACTARY-REPO-ENHANCEMENTS.md) for full requirements.

**Required commands:**
1. `/fractary-repo:issue-fetch --ids 258,259,260`
2. `/fractary-repo:issue-search --labels "workflow:etl,status:approved"`
3. `/fractary-repo:issue-update --id 258 --comment "..." --add-label "..."`
4. `/fractary-repo:branch-create feature/258`
5. `/fractary-repo:worktree-create --work-id 258`
6. `/fractary-repo:worktree-list`
7. `/fractary-repo:worktree-remove <path>`
8. `/fractary-repo:worktree-prune`

**Critical**: Commands must be available in **both fractary-repo CLI and SDK**.

## Changes to Existing Components

### workflow-run.md

- **Remove** planning phases (Finalize, Achieve, Break, Estimate)
- **Remove** worktree creation logic
- **Add** work-id argument support
- **Keep** only execution phases (Build, Execute, Refine, Release)
- **Keep** plan-id support for backwards compatibility

### workflow-plan-run.md

- **DELETE** this file entirely - planning moved to CLI

### core.json

- **Remove** planning phases: Finalize, Achieve, Break, Estimate
- **Keep** execution phases: Build, Execute, Refine, Release

### plan.schema.json

- **Add** `created_by: "cli"`
- **Add** `cli_version`
- **Add** `issue` object (source, id, url)
- **Add** `branch` field
- **Add** `worktree` field

## Future Enhancements (Out of Scope)

1. **Backlog Manager**: CLI tool for bulk issue creation
   - `faber backlog create --pattern "ipeds/*" --template "..." --workflow "etl"`
   - Creates GitHub issues in bulk, then calls `faber plan`
2. **Parallel Execution**: Launch multiple Claude sessions automatically
3. **GitHub Integration**: @faber command in GitHub issues
4. **Progressive Execution**: Ralph Wiggum-style hook for automated execution
5. **Other Issue Systems**: Support Jira, Linear via fractary-repo plugin

## Success Criteria

1. ✅ `faber plan` command generates high-quality plans via API
2. ✅ Batch planning creates multiple workflows efficiently
3. ✅ Worktrees created in `~/.claude-worktrees/{organization}-{project}-{work-id}/` by default
4. ✅ Configuration respects Claude Code settings
5. ✅ `workflow-run` focuses only on execution (no planning confusion)
6. ✅ Documentation clearly explains new CLI-first workflow
7. ✅ Sets foundation for future automation (GitHub integration, bulk execution)

## Implementation Notes

- **Scope**: This is a major architecture improvement
- **Branch**: Create new branch `feat/faber-cli-planning`
- **Complexity**: HIGH
  - CLI implementation: High (new code, API integration, batch logic)
  - workflow-run simplification: Medium (remove code)
  - Documentation: Medium (significant updates)
  - Testing: High (many scenarios)
- **Dependencies**: Requires fractary-repo plugin enhancements (see SPEC-00030)
- **Critical Path**: CLI plan generation quality determines architecture success

## Related Specifications

- [SPEC-00028](./SPEC-00028-faber-worktree-management.md) - Original worktree management spec
- [SPEC-00030](./SPEC-00030-FRACTARY-REPO-ENHANCEMENTS.md) - fractary-repo plugin requirements
- [SPEC-00027](./SPEC-00027-faber-context-management.md) - Context management (foundation)
