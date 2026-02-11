# FABER CLI Implementation Status

**Date**: 2026-01-06
**Branch**: feat/spec-00028-worktree-management

## Completed

### ✅ CLI Planning Command (`faber plan`)

The CLI planning command has been implemented with the following structure:

**Files Created:**
- `/cli/src/commands/plan/index.ts` - Main plan command implementation
- `/cli/src/lib/config.ts` - Configuration manager (reads Claude Code settings)
- `/cli/src/lib/anthropic-client.ts` - Anthropic API client for plan generation
- `/cli/src/lib/repo-client.ts` - Wrapper for fractary-repo CLI commands
- `/cli/src/utils/prompt.ts` - Interactive prompt utility

**Files Modified:**
- `/cli/src/index.ts` - Added plan command registration

**Command Syntax:**
```bash
faber plan [options]

Options:
  --work-id <ids>          Comma-separated list of work item IDs (e.g., "258,259,260")
  --work-label <labels>    Comma-separated label filters (e.g., "workflow:etl,status:approved")
  --workflow <name>        Override workflow (default: read from issue "workflow:*" label)
  --no-worktree           Skip worktree creation
  --no-branch             Skip branch creation
  --skip-confirm          Skip confirmation prompt (use with caution)
  --output <format>        Output format: text|json|yaml (default: text)
  --json                   Output as JSON (shorthand for --output json)
```

**Features Implemented:**
- ✅ Fetch issues by ID or label filter
- ✅ Extract workflow from issue labels
- ✅ Prompt user for missing workflows
- ✅ Confirmation prompt before planning
- ✅ Plan generation via Anthropic API
- ✅ Branch and worktree creation
- ✅ Plan writing to worktree
- ✅ GitHub issue updates with plan ID
- ✅ Text and JSON output formats
- ✅ Configuration management (reads Claude Code settings for worktree location)
- ✅ Organization included in worktree path pattern

**Process Flow:**
1. Fetch issues from GitHub (by ID or label search)
2. Identify workflows (from labels or prompt user)
3. Show confirmation prompt with issue list
4. For each issue:
   - Generate plan JSON via Anthropic API
   - Create git branch (`feature/{work-id}`)
   - Create git worktree (`~/.claude-worktrees/{org}-{project}-{work-id}`)
   - Write plan to worktree (`.fractary/faber/runs/{plan-id}/plan.json`)
   - Update GitHub issue with plan ID and label
5. Output summary with execution instructions

## Dependencies

### ⚠️ fractary-repo Plugin Commands (REQUIRED)

The implementation **depends on** fractary-repo plugin commands that must be implemented separately. See **SPEC-00030-FRACTARY-REPO-ENHANCEMENTS.md** for full requirements.

**Required Commands:**

1. **`fractary-repo issue-fetch --ids 258,259,260 --format json`**
   - Fetch specific GitHub issues by ID
   - Must return JSON with issue details

2. **`fractary-repo issue-search --labels "workflow:etl,status:approved" --format json`**
   - Search issues matching ALL specified labels
   - Must return JSON with issue array

3. **`fractary-repo issue-update --id 258 --comment "..." --add-label "..."`**
   - Update issue with comment and/or labels
   - Used to store plan_id in GitHub issue

4. **`fractary-repo branch-create <branch-name> --format json`**
   - Create git branch
   - Must return JSON with branch info

5. **`fractary-repo worktree-create --work-id 258 [--path <path>] --format json`**
   - Create git worktree at specified or default location
   - Default pattern: `~/.claude-worktrees/{organization}-{project}-{work-id}/`
   - Must return JSON with worktree details

**Critical Requirement:**
All commands must be available in **both fractary-repo CLI and SDK** (not just Claude plugin).

**Current Status:**
- Commands have placeholder implementations that throw errors with helpful messages
- When fractary-repo commands become available, remove placeholders and implement actual CLI calls
- See `/cli/src/lib/repo-client.ts` for implementation points

### API Keys Required

- **ANTHROPIC_API_KEY** - For plan generation via Claude API
- **GITHUB_TOKEN** - For GitHub API operations

## Configuration

The CLI reads configuration from multiple sources:

1. **Environment variables:**
   - `ANTHROPIC_API_KEY`
   - `GITHUB_TOKEN`

2. **FABER settings:** `.fractary/settings.json`
   ```json
   {
     "anthropic": {
       "api_key": "..."
     },
     "github": {
       "token": "...",
       "organization": "fractary",
       "project": "myproject"
     },
     "worktree": {
       "location": "~/.claude-worktrees",
       "inherit_from_claude": true
     },
     "workflow": {
       "default": "core",
       "config_path": "./plugins/faber/config/workflows"
     }
   }
   ```

3. **Claude Code settings:** (auto-detected)
   - Linux: `~/.config/claude/config.json`
   - macOS: `~/Library/Application Support/Claude/config.json`
   - Windows: `%APPDATA%/Claude/config.json`
   - Extracts `worktree.directory` if present

## Testing

### Manual Testing (Once fractary-repo Commands Available)

```bash
# Single workflow
faber plan --work-id 258

# Multiple workflows
faber plan --work-id 258,259,260

# Label-based batch
faber plan --work-label "workflow:etl,status:approved"

# With workflow override
faber plan --work-id 258 --workflow bugfix

# Skip confirmation (CI/automation)
faber plan --work-id 258,259 --skip-confirm

# JSON output
faber plan --work-id 258 --json
```

### Testing Without fractary-repo

Currently, running the command will show a friendly error:
```
⚠️  fractary-repo commands not yet available
   This command requires fractary-repo plugin implementation.
   See SPEC-00030-FRACTARY-REPO-ENHANCEMENTS.md
```

## Next Steps

### Phase 1: fractary-repo Implementation (Separate Repo/PR)
1. Implement fractary-repo commands per SPEC-00030
2. Ensure CLI and SDK availability for all commands
3. Test commands independently

### Phase 2: Integration
4. Update `/cli/src/lib/repo-client.ts` to call actual fractary-repo CLI
5. Test end-to-end: `faber plan` → fractary-repo commands → success

### Phase 3: Claude Plugin Simplification (This Repo)
6. Simplify `workflow-run` command (remove planning, add work-id support)
7. Delete `workflow-plan-run` command
8. Update plan schema to include issue metadata
9. Update documentation

### Phase 4: Testing
10. Test end-to-end: CLI plan → Claude execute
11. Test batch planning (multiple issues)
12. Test workflow prompts for missing labels
13. Test configuration discovery

## Architecture Notes

**Separation of Concerns:**
- **CLI (faber plan)** - Batch planning, issue fetching, plan generation
- **Claude Plugin (workflow-run)** - Plan execution only, no planning

**Benefits:**
- Batch-able planning (plan 10+ workflows at once)
- Focused execution (Claude just runs pre-made plans)
- Universal (works for any issue type: ETL, bugs, features)
- Flexible (different workflows per issue via labels)
- Safe (confirmation before planning)
- Extensible (plugin-based GitHub/worktree operations)

**Worktree Path Pattern:**
- `~/.claude-worktrees/{organization}-{project}-{work-id}/`
- Organization prevents conflicts across projects
- Respects Claude Code configuration
- Centralized location (all worktrees in one place)

## Related Specifications

- [SPEC-00029](../specs/SPEC-00029-FABER-CLI-PLANNING.md) - FABER CLI planning architecture
- [SPEC-00030](../specs/SPEC-00030-FRACTARY-REPO-ENHANCEMENTS.md) - fractary-repo plugin requirements
- [SPEC-00028](../specs/SPEC-00028-faber-worktree-management.md) - Worktree management

## Support

For issues or questions:
- Review SPEC-00029 for architecture details
- Review SPEC-00030 for fractary-repo requirements
- Check `/cli/src/lib/repo-client.ts` for integration points
