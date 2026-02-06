# Backlog Management Guide

## Overview

The `faber plan` command supports filtering, ordering, and limiting issues from your backlog to help you focus on the most important work. Use these features to:

- Plan top priority issues first
- Work on recently updated issues
- Process your backlog systematically
- Avoid planning too many issues at once

## Quick Start

```bash
# Plan top 5 priorities
faber plan --work-label "status:backlog" --order-by priority --limit 5

# Plan 10 most recently updated bugs
faber plan --work-label "type:bug" --order-by updated --limit 10

# Plan oldest 3 feature requests (FIFO processing)
faber plan --work-label "type:feature" --order-by created --order-direction asc --limit 3
```

## Priority Labels

### Automatic Label Creation

Priority labels are created automatically when you:

1. **Run `faber workflow-init`**: You'll be prompted to create priority labels during initialization
2. **Use `--order-by priority`**: Labels are automatically created on first use if they don't exist

No manual setup required! The system handles label creation for you.

### Label Format

Use `priority-N` labels where lower N = higher priority (supports 1-10, recommend 1-4):

- `priority-1` - Highest priority (Critical)
- `priority-2` - High priority (Important)
- `priority-3` - Medium priority (Standard)
- `priority-4` - Low priority (Nice to have)
- `priority-5` through `priority-10` - Additional levels (optional, for fine-grained prioritization)

### Using Priority Labels

Add priority labels to your issues:

```bash
gh issue edit <issue-number> --add-label "priority-1"
```

Issues without priority labels will be sorted last when using priority ordering.

## Ordering Strategies

### Priority Ordering

```bash
faber plan --work-label "status:backlog" --order-by priority --limit 5
```

Orders issues by priority label (priority-1, priority-2, etc.). Issues without priority labels go last.

**Use when**: You want to tackle the most important work first.

### Created Date Ordering

```bash
# Oldest first (FIFO)
faber plan --work-label "status:backlog" --order-by created --order-direction asc --limit 5

# Newest first (LIFO)
faber plan --work-label "status:backlog" --order-by created --limit 5
```

Orders issues by creation date.

**Use when**:
- FIFO (asc): You want to process your backlog systematically, oldest issues first
- LIFO (desc): You want to focus on recently created work

### Updated Date Ordering

```bash
# Most recently updated first (default)
faber plan --work-label "status:backlog" --order-by updated --limit 10
```

Orders issues by last update time. Most recently updated issues appear first by default.

**Use when**: You want to follow up on issues with recent activity or comments.

## Limiting Results

Use `--limit` to restrict the number of issues planned:

```bash
faber plan --work-label "status:backlog" --limit 10
```

This is useful for:
- Planning in manageable batches
- Avoiding overwhelming the workflow system
- Focusing on a small set of high-value work

**Tip**: Start with `--limit 5` when first using backlog management, then adjust based on your capacity.

## Order Direction

Control sort direction with `--order-direction`:

```bash
# Descending (default for priority and updated)
faber plan --work-label "status:backlog" --order-by priority --order-direction desc

# Ascending
faber plan --work-label "status:backlog" --order-by priority --order-direction asc
```

**Defaults**:
- Priority: `desc` (priority-1 before priority-2)
- Updated: `desc` (most recent first)
- Created: `desc` (newest first)

## Configuration

Add to the `faber:` section of `.fractary/config.yaml`:

```yaml
faber:
  backlog_management:
    default_limit: 20
    default_order_by: priority
    priority_config:
      label_prefix: priority
```

### Configuration Options

- **`default_limit`**: Default maximum issues to plan (1-100)
- **`default_order_by`**: Default ordering strategy (`priority`, `created`, `updated`, or `none`)
- **`priority_config.label_prefix`**: Label prefix for priority extraction (default: `"priority"`)

### Custom Priority Labels

If your project uses a different priority label format (e.g., `p1`, `p2`):

```yaml
faber:
  backlog_management:
    priority_config:
      label_prefix: p
```

Then labels like `p1`, `p2`, `p3` will be recognized as priorities.

## Workflow Example

Here's a complete workflow for managing your backlog:

### 1. Initialize FABER (if not already done)

```bash
faber workflow-init
# When prompted, choose "Y" to create priority labels
```

Priority labels (priority-1 through priority-4) will be created automatically.

### 2. Label your backlog (optional)

Optionally, add default priority to all backlog items:

```bash
gh issue list --label "status:backlog" --json number --jq '.[].number' | \
  xargs -I {} gh issue edit {} --add-label "priority-3"
```

### 3. Set priorities for important issues

Upgrade critical and high-priority issues:

```bash
# Critical bug
gh issue edit 123 --add-label "priority-1" --remove-label "priority-3"

# High priority feature
gh issue edit 124 --add-label "priority-2" --remove-label "priority-3"
```

### 4. Plan top priorities

Plan the top 5 highest priority issues:

```bash
faber plan --work-label "status:backlog" --order-by priority --limit 5
```

The command will:
- Automatically create priority labels if they don't exist
- Fetch all issues with `status:backlog` label
- Sort by priority (priority-1 first)
- Limit to top 5 issues
- Show confirmation prompt
- Create workflow plans for approved issues

### 5. Work through plans

Execute the workflow plans:

```bash
cd ~/.claude-worktrees/<org>-<project>-<issue-number>
claude
# In Claude Code:
/fractary-faber:workflow-run <issue-number>
```

### 6. Repeat as needed

As you complete work, plan the next batch:

```bash
faber plan --work-label "status:backlog" --order-by priority --limit 5
```

## Combining Filters

Combine backlog management with label filters for powerful workflows:

```bash
# Top 3 priority bugs
faber plan --work-label "status:backlog,type:bug" --order-by priority --limit 3

# 5 most recently updated features
faber plan --work-label "status:backlog,type:feature" --order-by updated --limit 5

# Oldest 2 documentation issues
faber plan --work-label "status:backlog,type:docs" --order-by created --order-direction asc --limit 2
```

## Tips and Best Practices

### Start Small
- Use `--limit` to plan in small batches (5-10 issues)
- Don't plan your entire backlog at once
- Adjust batch size based on your team's capacity

### Review Recently Updated Issues
- Use `--order-by updated` to catch issues with new comments
- This helps you respond to stakeholder feedback quickly
- Great for keeping issues from going stale

### Process Backlog Systematically
- Use `--order-by created --order-direction asc` for FIFO processing
- Ensures older issues don't get forgotten
- Good for maintenance work and technical debt

### Combine with Multiple Labels
- Use multiple labels to narrow your selection
- Example: `--work-label "status:backlog,workflow:etl,priority-1"`
- More specific queries = more relevant plans

### Prioritize Regularly
- Review and update priority labels weekly
- Don't let priority labels become stale
- Remove issues that are no longer relevant

## Troubleshooting

### No issues found

**Cause**: No issues match your label filter or all issues were filtered out by limit.

**Solution**:
- Check your label names: `gh issue list --label "status:backlog"`
- Remove or increase `--limit`
- Verify issues exist with your filter combination

### Issues not sorting by priority

**Cause**: Priority labels don't match the configured prefix.

**Solution**:
- Check your labels: `gh issue view <issue-number>`
- Verify label format matches: `priority-1`, `priority-2`, etc.
- Check config for custom prefix: `yq '.faber.backlog_management' .fractary/config.yaml`

### Wrong order direction

**Cause**: Default direction might not match your expectation.

**Solution**: Explicitly specify `--order-direction`:
- For priority, use `--order-direction desc` (priority-1 first)
- For oldest first, use `--order-direction asc`

## Examples

### Sprint Planning

Plan top 10 priorities for a sprint:

```bash
faber plan \
  --work-label "status:backlog,milestone:sprint-23" \
  --order-by priority \
  --limit 10
```

### Bug Triage

Plan top 5 critical bugs:

```bash
faber plan \
  --work-label "type:bug,priority-1" \
  --order-by updated \
  --limit 5
```

### Maintenance Day

Work through oldest technical debt:

```bash
faber plan \
  --work-label "type:chore,status:backlog" \
  --order-by created \
  --order-direction asc \
  --limit 3
```

### Feature Work

Plan most recently updated feature requests:

```bash
faber plan \
  --work-label "type:feature,status:backlog" \
  --order-by updated \
  --limit 5
```

## See Also

- [FABER Workflow Guide](./workflow-guide.md) - Complete workflow documentation
- [CLI Reference](./api-reference.md) - All command options
- [Integration Guide](../integration-guide.md) - Setting up FABER
