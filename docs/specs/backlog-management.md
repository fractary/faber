# Backlog Management for FABER Plan Command

**Status**: Draft
**Created**: 2026-01-08
**Repository**: fractary/faber

## Overview

Enhance the `faber plan` command to support backlog management by adding the ability to order and limit issues when planning. This allows users to select the top N highest priority issues or most recently updated issues from their backlog.

## Motivation

Currently, when using `faber plan --work-label "status:backlog"`, all matching issues are processed. For large backlogs, users need the ability to:
- Select top priorities for planning
- Process most recently updated issues first
- Limit the number of issues planned in a single batch

This is particularly important for teams managing large backlogs where planning all issues at once is impractical.

## User Requirements

1. **Order by priority**: Select highest priority issues first based on priority labels
2. **Order by date**: Select by creation date or last update time
3. **Limit results**: Specify maximum number of issues to plan (e.g., top 5, top 10)
4. **Configurable priority labels**: Support different priority label schemes across projects

## Proposed Solution

### New CLI Arguments

Add three new options to the `plan` command:

```bash
faber plan \
  --work-label "status:backlog" \
  --order-by priority \
  --order-direction desc \
  --limit 5
```

**Arguments:**
- `--limit <n>`: Maximum number of issues to plan (default: no limit)
- `--order-by <strategy>`: Order issues by `priority`, `created`, or `updated` (default: `priority`)
- `--order-direction <dir>`: Order direction `asc` or `desc` (default: `desc` for priority/updated, `asc` for created)

**Note**: Priority label prefix (e.g., `priority`, `p`) is configured in `.fractary/plugins/faber/config.json`, not as a CLI argument, since it's a project-wide setting that rarely changes.

### Priority Label Convention

**Recommended convention**: `priority-N` where lower N = higher priority

- `priority-1` - Highest priority
- `priority-2` - High priority
- `priority-3` - Medium priority
- `priority-4` - Low priority

Numeric values provide clear ordering and are extensible (can add `priority-0` for critical).

### Ordering Strategies

#### 1. Priority Ordering (`--order-by priority`)

Extracts priority from issue labels:
- Looks for labels matching configured prefix (e.g., `priority-1`, `priority-2`)
- Sorts numerically (lower number = higher priority)
- Issues without priority labels go last (assigned value 999)

#### 2. Created Date Ordering (`--order-by created`)

Orders by issue creation date:
- `--order-direction asc`: Oldest first (FIFO - process backlog in order)
- `--order-direction desc`: Newest first (LIFO - tackle recent issues)

#### 3. Updated Date Ordering (`--order-by updated`)

Orders by last update time:
- `--order-direction desc` (default): Most recently updated first - follow conversation momentum
- `--order-direction asc`: Least recently updated first - tackle stale issues

### Configuration

Add new `backlog_management` section to FABER config:

```json
{
  "backlog_management": {
    "default_limit": 50,
    "default_order_by": "priority",
    "priority_config": {
      "label_prefix": "priority"
    }
  }
}
```

## Implementation Details

### 1. Update Plan Command Options

**File**: `/cli/src/commands/plan/index.ts`

Add to `PlanOptions` interface (around line 23):

```typescript
interface PlanOptions {
  // ... existing options ...

  // NEW: Backlog management
  limit?: number;
  orderBy?: string;
  orderDirection?: string;
}
```

Add command options (after line 66):

```typescript
.option('--limit <n>', 'Maximum number of issues to plan (default: no limit)', parseInt)
.option('--order-by <strategy>', 'Order issues by: priority|created|updated (default: priority)', 'priority')
.option('--order-direction <dir>', 'Order direction: asc|desc (default: desc for priority/updated, asc for created)', 'desc')
```

### 2. Create Sorting Utility

**File**: `/cli/src/utils/sorting.ts` (new file)

```typescript
interface SortOptions {
  orderBy: 'priority' | 'created' | 'updated';
  direction: 'asc' | 'desc';
  priorityConfig: {
    labelPrefix: string;
    numericFirst: boolean;
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
 * Examples: priority-1 → 1, priority-2 → 2, p1 → 1
 * Returns 999 if no priority found
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

### 3. Integrate Sorting into Plan Command

**File**: `/cli/src/commands/plan/index.ts`

In `executePlanCommand()` function, after issues are fetched (around line 150):

```typescript
// Apply ordering
if (options.orderBy) {
  const { sortIssues } = await import('../../utils/sorting.js');

  // Load priority label prefix from config
  const priorityLabelPrefix = config.backlog_management?.priority_config?.label_prefix || 'priority';

  issues = sortIssues(issues, {
    orderBy: options.orderBy as 'priority' | 'created' | 'updated',
    direction: options.orderDirection || 'desc',
    priorityConfig: {
      labelPrefix: priorityLabelPrefix,
      numericFirst: true
    }
  });

  console.log(chalk.blue(`\n→ Sorted ${issues.length} issue(s) by ${options.orderBy} (${options.orderDirection || 'desc'})`));
}

// Apply limit
if (options.limit && issues.length > options.limit) {
  console.log(chalk.yellow(`→ Limiting to top ${options.limit} issue(s) (found ${issues.length})`));
  issues = issues.slice(0, options.limit);
}
```

### 4. Add Date Fields to Issue Type

**File**: `/cli/src/lib/sdk-type-adapter.ts`

Update `sdkIssueToCLIIssue()` function:

```typescript
export function sdkIssueToCLIIssue(sdkIssue: SDKIssue): CLIIssue {
  return {
    id: sdkIssue.id,
    number: sdkIssue.number,
    title: sdkIssue.title,
    description: sdkIssue.body || '',
    labels: extractLabels(sdkIssue.labels),
    url: sdkIssue.url,
    state: sdkIssue.state,
    createdAt: sdkIssue.created_at,   // ADD
    updatedAt: sdkIssue.updated_at,   // ADD
  };
}
```

### 5. Update Configuration Schema

**File**: `/plugins/faber/config/config.schema.json`

Add after line 48 (inside main properties):

```json
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
      "enum": ["priority", "created", "updated"],
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
},
```

## Usage Examples

```bash
# Get top 5 highest priority issues
faber plan --work-label "status:backlog" --order-by priority --limit 5

# Get 10 most recently updated bugs
faber plan --work-label "type:bug" --order-by updated --limit 10

# Get oldest 3 feature requests (FIFO processing)
faber plan --work-label "type:feature" --order-by created --order-direction asc --limit 3
```

## Verification Plan

### 1. Setup Test Issues

```bash
# Create test issues with various priorities
gh issue create --title "Critical bug fix" --label "priority-1,status:backlog"
gh issue create --title "High priority feature" --label "priority-2,status:backlog"
gh issue create --title "Medium priority task" --label "priority-3,status:backlog"
gh issue create --title "Low priority enhancement" --label "priority-4,status:backlog"
gh issue create --title "No priority task" --label "status:backlog"
```

### 2. Test Priority Ordering

```bash
# Should return issues in order: priority-1, priority-2, priority-3, priority-4, no-priority
faber plan --work-label "status:backlog" --order-by priority --limit 3

# Verify:
# - Issues are ordered by priority (1, 2, 3)
# - Only top 3 are selected
# - Issues without priority appear last (if within limit)
```

### 3. Test Date Ordering

```bash
# Update an older issue to make it most recent
gh issue comment <issue-number> --body "Update to make recent"

# Should return most recently updated issue first
faber plan --work-label "status:backlog" --order-by updated --limit 1

# Should return oldest issue first
faber plan --work-label "status:backlog" --order-by created --order-direction asc --limit 1
```

### 4. Test Configuration

```bash
# Add custom priority label prefix to config
# Update config.json:
{
  "backlog_management": {
    "priority_config": {
      "label_prefix": "p"
    }
  }
}

# Create issue with custom prefix
gh issue create --title "Test custom prefix" --label "p1,status:backlog"

# Verify custom prefix works
faber plan --work-label "status:backlog" --order-by priority --limit 1
```

## Files to Modify

1. **`/cli/src/commands/plan/index.ts`** - Add CLI options and sorting logic
2. **`/cli/src/lib/sdk-type-adapter.ts`** - Add date fields to issue type
3. **`/plugins/faber/config/config.schema.json`** - Add backlog_management config section

## Files to Create

1. **`/cli/src/utils/sorting.ts`** - Sorting and priority extraction utilities
2. **`/docs/guides/backlog-management.md`** - User guide (see below)

## User Documentation

Create `/docs/guides/backlog-management.md`:

```markdown
# Backlog Management Guide

## Overview

The `faber plan` command supports filtering, ordering, and limiting issues from your backlog to help you focus on the most important work.

## Quick Start

```bash
# Plan top 5 priorities
faber plan --work-label "status:backlog" --order-by priority --limit 5

# Plan 10 most recently updated bugs
faber plan --work-label "type:bug" --order-by updated --limit 10
```

## Priority Labels

Use `priority-N` labels where lower N = higher priority:

- `priority-1` - Highest priority
- `priority-2` - High priority
- `priority-3` - Medium priority
- `priority-4` - Low priority

Add priority labels to your issues:
```bash
gh issue edit <issue-number> --add-label "priority-1"
```

## Ordering Strategies

### Priority Ordering
```bash
faber plan --work-label "status:backlog" --order-by priority --limit 5
```
Orders issues by priority label. Issues without priority go last.

### Created Date Ordering
```bash
# Oldest first (FIFO)
faber plan --work-label "status:backlog" --order-by created --order-direction asc --limit 5

# Newest first (LIFO)
faber plan --work-label "status:backlog" --order-by created --limit 5
```

### Updated Date Ordering
```bash
# Most recently updated first (default)
faber plan --work-label "status:backlog" --order-by updated --limit 10
```
Useful for following up on issues with recent activity.

## Configuration

Add to `.fractary/plugins/faber/config.json`:

```json
{
  "backlog_management": {
    "default_limit": 20,
    "default_order_by": "priority",
    "priority_config": {
      "label_prefix": "priority"
    }
  }
}
```

### Custom Priority Labels

If your project uses a different priority label format (e.g., `p1`, `p2`):

```json
{
  "backlog_management": {
    "priority_config": {
      "label_prefix": "p"
    }
  }
}
```

## Workflow Example

1. **Label your backlog**:
   ```bash
   gh issue list --label "status:backlog" --json number --jq '.[].number' | \
     xargs -I {} gh issue edit {} --add-label "priority-3"
   ```

2. **Set priorities** for important issues:
   ```bash
   gh issue edit 123 --add-label "priority-1" --remove-label "priority-3"
   ```

3. **Plan top priorities**:
   ```bash
   faber plan --work-label "status:backlog" --order-by priority --limit 5
   ```

4. **Work through plans** and repeat as needed.

## Tips

- **Start with top priorities**: Use `--limit` to avoid planning too many issues at once
- **Review recently updated issues**: Use `--order-by updated` to catch issues with new comments or changes
- **Process backlog systematically**: Use `--order-by created --order-direction asc` for FIFO processing
- **Combine filters**: Use `--work-label` with multiple labels to narrow your selection
```

## Success Criteria

- [ ] Can order issues by priority, created date, or updated date
- [ ] Can limit number of issues planned
- [ ] Priority extraction works with configurable label prefix
- [ ] Issues without priority labels sort last
- [ ] Configuration schema includes backlog_management section
- [ ] User documentation created
- [ ] All test scenarios pass

## Future Enhancements

Potential future additions (not in this spec):
- Support for custom priority value mappings (e.g., `critical` → 1, `high` → 2)
- Multi-field sorting (e.g., priority then updated date)
- Saved backlog queries/filters
- Backlog health metrics (age distribution, priority distribution)
