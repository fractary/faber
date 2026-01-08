# Implementation Plan: Backlog Management for FABER Plan Command

**Related Spec**: specs/SPEC-20260108-backlog-management.md
**Created**: 2026-01-08
**Status**: Ready for Implementation

## Overview

This plan outlines the implementation steps for adding backlog management capabilities to the `faber plan` command. The feature adds `--order-by`, `--order-direction`, and `--limit` options to support prioritized planning of large backlogs.

## Implementation Strategy

### Phase 1: Foundation (Date Fields & Type System)
Add the necessary date fields to support date-based ordering.

### Phase 2: Sorting Infrastructure
Create the sorting utility module with priority extraction and ordering logic.

### Phase 3: CLI Integration
Integrate sorting and limiting into the plan command.

### Phase 4: Configuration
Add configuration schema and defaults for backlog management.

### Phase 5: Documentation
Create user documentation and examples.

---

## Phase 1: Foundation (Date Fields & Type System)

### Task 1.1: Update CLI Issue Type Interface
**File**: `cli/src/commands/plan/index.ts:35-44`

**Action**: Add optional date fields to the `Issue` interface:

```typescript
interface Issue {
  id: string;
  number: number;
  title: string;
  description: string;
  labels: string[];
  url: string;
  state: string;
  workflow?: string; // Extracted workflow label
  createdAt?: string;  // ADD
  updatedAt?: string;  // ADD
}
```

### Task 1.2: Update SDK Type Adapter
**File**: `cli/src/lib/sdk-type-adapter.ts:10-18`

**Action 1**: Update `CLIIssue` interface to include date fields:

```typescript
interface CLIIssue {
  id: string;
  number: number;
  title: string;
  description: string;
  labels: string[];
  url: string;
  state: string;
  createdAt?: string;  // ADD
  updatedAt?: string;  // ADD
}
```

**Action 2**: Update `sdkIssueToCLIIssue()` function around line 36:

```typescript
export function sdkIssueToCLIIssue(sdkIssue: SDKIssue): CLIIssue {
  return {
    id: sdkIssue.id,
    number: sdkIssue.number,
    title: sdkIssue.title,
    description: sdkIssue.body,
    labels: sdkIssue.labels.map(label => label.name),
    url: sdkIssue.url,
    state: sdkIssue.state,
    createdAt: sdkIssue.created_at,   // ADD
    updatedAt: sdkIssue.updated_at,   // ADD
  };
}
```

**Verification**:
- Compile TypeScript to ensure no type errors
- Date fields should be optional (issues without dates won't break)

---

## Phase 2: Sorting Infrastructure

### Task 2.1: Create Sorting Utility Module
**File**: `cli/src/utils/sorting.ts` (NEW FILE)

**Action**: Create complete sorting module with interfaces and functions:

```typescript
/**
 * Issue Sorting Utilities
 *
 * Provides sorting and priority extraction for backlog management
 */

interface SortOptions {
  orderBy: 'priority' | 'created' | 'updated';
  direction: 'asc' | 'desc';
  priorityConfig: {
    labelPrefix: string;
  };
}

interface Issue {
  id: string;
  number: number;
  title: string;
  description: string;
  labels: string[];
  url: string;
  state: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Extract numeric priority from issue labels
 * Examples: priority-1 → 1, priority-2 → 2, p-1 → 1
 * Returns 999 if no priority found (sorts last)
 */
function extractPriority(labels: string[], prefix: string): number {
  const priorityLabels = labels.filter(l => l.startsWith(prefix));

  if (priorityLabels.length === 0) return 999;

  // Extract numeric part: "priority-1" → "1"
  const value = priorityLabels[0].replace(prefix, '').replace(/^-/, '');
  const numeric = parseInt(value, 10);

  return isNaN(numeric) ? 999 : numeric;
}

/**
 * Sort issues according to strategy
 */
export function sortIssues(issues: Issue[], options: SortOptions): Issue[] {
  const sorted = [...issues];

  sorted.sort((a, b) => {
    let comparison = 0;

    if (options.orderBy === 'priority') {
      const aPriority = extractPriority(a.labels, options.priorityConfig.labelPrefix);
      const bPriority = extractPriority(b.labels, options.priorityConfig.labelPrefix);
      comparison = aPriority - bPriority; // Lower number = higher priority
    } else if (options.orderBy === 'created' && a.createdAt && b.createdAt) {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (options.orderBy === 'updated' && a.updatedAt && b.updatedAt) {
      comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    }

    // Apply direction
    return options.direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}
```

**Verification**:
- Create unit tests for `extractPriority()` with various label formats
- Test sorting with different `orderBy` strategies
- Test ascending and descending directions
- Test issues without dates or priority labels

---

## Phase 3: CLI Integration

### Task 3.1: Update PlanOptions Interface
**File**: `cli/src/commands/plan/index.ts:24-33`

**Action**: Add new options to the interface:

```typescript
interface PlanOptions {
  workId?: string;
  workLabel?: string;
  workflow?: string;
  noWorktree?: boolean;
  noBranch?: boolean;
  skipConfirm?: boolean;
  output?: string;
  json?: boolean;
  // NEW: Backlog management options
  limit?: number;
  orderBy?: string;
  orderDirection?: string;
}
```

### Task 3.2: Add CLI Options
**File**: `cli/src/commands/plan/index.ts:57-74`

**Action**: Add new command options after line 67:

```typescript
export function createPlanCommand(): Command {
  return new Command('plan')
    .description('Plan workflows for GitHub issues')
    .option('--work-id <ids>', 'Comma-separated list of work item IDs (e.g., "258,259,260")')
    .option('--work-label <labels>', 'Comma-separated label filters (e.g., "workflow:etl,status:approved")')
    .option('--workflow <name>', 'Override workflow (default: read from issue "workflow:*" label)')
    .option('--no-worktree', 'Skip worktree creation')
    .option('--no-branch', 'Skip branch creation')
    .option('--skip-confirm', 'Skip confirmation prompt (use with caution)')
    .option('--output <format>', 'Output format: text|json|yaml', 'text')
    .option('--json', 'Output as JSON (shorthand for --output json)')
    // ADD NEW OPTIONS:
    .option('--limit <n>', 'Maximum number of issues to plan', parseInt)
    .option('--order-by <strategy>', 'Order issues by: priority|created|updated (default: none)', 'none')
    .option('--order-direction <dir>', 'Order direction: asc|desc (default: desc)', 'desc')
    .action(async (options: PlanOptions) => {
      try {
        await executePlanCommand(options);
      } catch (error) {
        handlePlanError(error, options);
      }
    });
}
```

### Task 3.3: Integrate Sorting Logic
**File**: `cli/src/commands/plan/index.ts`

**Action**: Add sorting and limiting logic after issues are fetched (around line 150, after the `if (issues.length === 0)` block):

```typescript
  if (issues.length === 0) {
    if (outputFormat === 'text') {
      console.log(chalk.yellow('\n⚠️  No issues found'));
    } else {
      console.log(JSON.stringify({ status: 'success', issues: [], message: 'No issues found' }, null, 2));
    }
    return;
  }

  // ADD SORTING LOGIC HERE:

  // Apply ordering if requested
  if (options.orderBy && options.orderBy !== 'none') {
    const { sortIssues } = await import('../../utils/sorting.js');

    // Load priority label prefix from config (with fallback)
    const priorityLabelPrefix = config.backlog_management?.priority_config?.label_prefix || 'priority';

    const originalCount = issues.length;
    issues = sortIssues(issues, {
      orderBy: options.orderBy as 'priority' | 'created' | 'updated',
      direction: (options.orderDirection || 'desc') as 'asc' | 'desc',
      priorityConfig: {
        labelPrefix: priorityLabelPrefix,
      }
    });

    if (outputFormat === 'text') {
      console.log(chalk.blue(`\n→ Sorted ${originalCount} issue(s) by ${options.orderBy} (${options.orderDirection || 'desc'})`));
    }
  }

  // Apply limit if specified
  if (options.limit && issues.length > options.limit) {
    const totalFound = issues.length;
    issues = issues.slice(0, options.limit);

    if (outputFormat === 'text') {
      console.log(chalk.yellow(`→ Limiting to top ${options.limit} issue(s) (found ${totalFound})`));
    }
  }

  // EXISTING CODE CONTINUES (Step 2: Extract workflows from labels...)
```

**Verification**:
- Test with `--order-by priority --limit 5`
- Test with `--order-by updated --order-direction desc --limit 10`
- Test with `--order-by created --order-direction asc`
- Verify console output shows sorting and limiting messages
- Verify JSON output excludes filtered issues

---

## Phase 4: Configuration

### Task 4.1: Update Configuration Schema
**File**: `plugins/faber/config/config.schema.json`

**Action**: Add `backlog_management` property to the main schema properties (around line 48, before or after the `safety` property):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "properties": {
    // ... existing properties ...
    "safety": {
      "$ref": "#/definitions/safety"
    },
    "backlog_management": {
      "type": "object",
      "description": "Backlog planning and prioritization settings",
      "additionalProperties": false,
      "properties": {
        "default_limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100,
          "default": 50,
          "description": "Default maximum issues to plan in one batch"
        },
        "default_order_by": {
          "type": "string",
          "enum": ["priority", "created", "updated", "none"],
          "default": "priority",
          "description": "Default ordering strategy for backlog planning"
        },
        "priority_config": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "label_prefix": {
              "type": "string",
              "default": "priority",
              "description": "Label prefix for priority extraction (e.g., 'priority' for 'priority-1' labels)"
            }
          }
        }
      }
    }
  }
}
```

### Task 4.2: Update TypeScript Config Type
**File**: `cli/src/types/config.ts` (check if this file exists, or update the appropriate type definition file)

**Action**: Add `backlog_management` to the `FaberConfig` interface:

```typescript
export interface FaberConfig {
  // ... existing properties ...
  backlog_management?: {
    default_limit?: number;
    default_order_by?: 'priority' | 'created' | 'updated' | 'none';
    priority_config?: {
      label_prefix?: string;
    };
  };
}
```

**Verification**:
- Validate schema with a JSON schema validator
- Create example config with backlog_management section
- Ensure TypeScript compilation succeeds

---

## Phase 5: Documentation

### Task 5.1: Create User Guide
**File**: `docs/guides/backlog-management.md` (NEW FILE)

**Action**: Create comprehensive user guide based on spec lines 374-485. Key sections:

1. **Overview** - What backlog management does
2. **Quick Start** - Basic usage examples
3. **Priority Labels** - How to use `priority-N` labels
4. **Ordering Strategies** - Priority, created date, updated date
5. **Configuration** - Custom settings
6. **Workflow Example** - End-to-end workflow
7. **Tips** - Best practices

### Task 5.2: Update Main README
**File**: `README.md` or `cli/README.md`

**Action**: Add a section or reference to backlog management:

```markdown
## Backlog Management

Plan top priority issues from your backlog:

```bash
# Plan top 5 priorities
faber plan --work-label "status:backlog" --order-by priority --limit 5

# Plan most recently updated issues
faber plan --work-label "status:backlog" --order-by updated --limit 10
```

See [Backlog Management Guide](docs/guides/backlog-management.md) for details.
```

### Task 5.3: Add Examples to CLI Help
**File**: `cli/src/commands/plan/index.ts:58-59`

**Action**: Enhance the description with examples:

```typescript
.description('Plan workflows for GitHub issues\n\nExamples:\n' +
  '  faber plan --work-id 123,124,125\n' +
  '  faber plan --work-label "status:backlog"\n' +
  '  faber plan --work-label "status:backlog" --order-by priority --limit 5')
```

**Verification**:
- Run `faber plan --help` to verify help text
- Review documentation for clarity and completeness

---

## Testing & Verification Plan

### Test Scenario 1: Priority Ordering

**Setup**:
```bash
# Create test issues with priorities
gh issue create --title "Critical bug" --label "priority-1,status:backlog"
gh issue create --title "High priority" --label "priority-2,status:backlog"
gh issue create --title "Medium priority" --label "priority-3,status:backlog"
gh issue create --title "Low priority" --label "priority-4,status:backlog"
gh issue create --title "No priority" --label "status:backlog"
```

**Test**:
```bash
faber plan --work-label "status:backlog" --order-by priority --limit 3
```

**Expected**:
- Issues ordered: priority-1, priority-2, priority-3
- Only 3 issues selected
- Console shows: "Sorted 5 issue(s) by priority (desc)" and "Limiting to top 3 issue(s)"

### Test Scenario 2: Date Ordering

**Setup**:
```bash
# Create issues at different times, or update an existing issue
gh issue comment <issue-number> --body "Update to make recent"
```

**Test**:
```bash
# Most recent first
faber plan --work-label "status:backlog" --order-by updated --limit 1

# Oldest first
faber plan --work-label "status:backlog" --order-by created --order-direction asc --limit 1
```

**Expected**:
- Updated: Returns most recently updated issue
- Created: Returns oldest issue

### Test Scenario 3: Custom Priority Prefix

**Setup**: Update config with custom prefix:
```json
{
  "backlog_management": {
    "priority_config": {
      "label_prefix": "p"
    }
  }
}
```

**Test**:
```bash
gh issue create --title "Custom prefix" --label "p1,status:backlog"
faber plan --work-label "status:backlog" --order-by priority --limit 1
```

**Expected**:
- Issue with `p1` label is recognized as priority 1
- Sorted correctly with other priority issues

### Test Scenario 4: No Options (Baseline)

**Test**:
```bash
faber plan --work-label "status:backlog"
```

**Expected**:
- All issues fetched (no sorting or limiting)
- No "Sorted" or "Limiting" messages
- Behavior unchanged from current implementation

### Test Scenario 5: JSON Output

**Test**:
```bash
faber plan --work-label "status:backlog" --order-by priority --limit 3 --json
```

**Expected**:
- Valid JSON output
- Only 3 issues in results array
- Issues in correct priority order

---

## Implementation Order

1. **Phase 1** (Foundation) - Essential for all other phases
2. **Phase 2** (Sorting Infrastructure) - Core functionality
3. **Phase 3** (CLI Integration) - User-facing feature
4. **Phase 4** (Configuration) - Optional customization
5. **Phase 5** (Documentation) - User guidance

**Estimated Time**: 4-6 hours

---

## Success Criteria

- [ ] Can order issues by priority, created date, or updated date
- [ ] Can limit number of issues planned
- [ ] Priority extraction works with configurable label prefix
- [ ] Issues without priority labels sort last
- [ ] Configuration schema includes backlog_management section
- [ ] User documentation created
- [ ] All test scenarios pass
- [ ] TypeScript compilation succeeds
- [ ] CLI help text updated
- [ ] JSON output works correctly

---

## Files Summary

### Files to Create
1. `cli/src/utils/sorting.ts` - Sorting utilities
2. `docs/guides/backlog-management.md` - User guide

### Files to Modify
1. `cli/src/commands/plan/index.ts` - CLI options and sorting logic
2. `cli/src/lib/sdk-type-adapter.ts` - Add date fields
3. `plugins/faber/config/config.schema.json` - Configuration schema
4. `cli/src/types/config.ts` - TypeScript type definitions
5. `README.md` or `cli/README.md` - Documentation reference

---

## Risk Assessment

**Low Risk**:
- All changes are additive (no breaking changes)
- New options are optional (default behavior unchanged)
- Sorting creates a copy of the array (doesn't mutate)
- Date fields are optional (backward compatible)

**Potential Issues**:
- **Missing dates**: Some old issues might not have `created_at` or `updated_at` - handled by optional types
- **Invalid priority labels**: Non-numeric priorities default to 999 (sorted last)
- **Performance**: Sorting large result sets - acceptable for typical backlog sizes (< 100 issues)

---

## Future Enhancements (Not in This Plan)

From spec lines 497-503:
- Custom priority value mappings (e.g., `critical` → 1, `high` → 2)
- Multi-field sorting (e.g., priority then updated date)
- Saved backlog queries/filters
- Backlog health metrics (age distribution, priority distribution)

---

## Notes

- Priority label convention: `priority-N` where lower N = higher priority
- Default order direction: `desc` for priority and updated, `asc` for created
- Config priority prefix defaults to `"priority"` if not specified
- Issues without priority get value 999 (sorts last)
- Sorting happens before limiting (limit applies to sorted results)
