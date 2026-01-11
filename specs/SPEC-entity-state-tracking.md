# SPEC: Entity-Level State Tracking for FABER Workflows

**Status**: Draft
**Created**: 2026-01-10
**Author**: Claude (based on user requirements)

## Overview

This specification defines entity-level state tracking for FABER workflows. Currently, FABER tracks workflow-run state (what is this run doing?), but lacks entity-centric tracking (what's the status of entity X across all workflows?).

### Problem Statement

FABER needs to track:
- Current status of individual entities (datasets, APIs, blog posts, etc.) across all workflows
- Per-step status for each entity (which steps have been completed/failed)
- Which entities need work (for workflow prioritization and querying)
- What was updated recently (for downstream systems)
- Historical audit trail per entity

### Solution

Add a parallel entity state management system that:
- Tracks aggregate state per entity across all workflows
- Updates automatically as workflows execute
- Provides query capabilities for dashboards and downstream polling
- Maintains step-level and workflow-level history per entity
- Supports future sync to centralized Helm system (see SPEC-faber-helm-integration.md)

## Requirements

### Functional Requirements

1. **Entity Identification**: Custom IDs per entity type (e.g., `blog-post-123`, `dataset-abc`)
2. **State Model**: Aggregate state across all workflows (not per-workflow)
3. **Automatic Updates**: faber-manager automatically updates entity state during workflow execution
4. **Step-Level Tracking**: Track status of each workflow step for the entity
5. **Step Hierarchy**: Support 3-level step categorization (step_id → step_action → step_type)
6. **Execution vs Outcome**: Track both execution status (lifecycle) and outcome status (result quality)
7. **Phase Context**: Record which phase each step was executed in
8. **Organization Tracking**: Include organization (from fractary-core:repo) for cross-org uniqueness
9. **History Separation**: Keep history (step_history, workflow_summary) in separate files
10. **Workflow Querying**: Enable workflows to query entity state programmatically

### Non-Functional Requirements

1. **Performance**: Fast queries for workflow decisions (< 100ms for local queries)
2. **Concurrency**: File locking to handle multiple workflows operating on same entity
3. **Scalability**: Support thousands of entities per project
4. **Backward Compatibility**: Opt-in via workflow config (existing workflows unaffected)
5. **External Sync Ready**: Schema designed for future push to DynamoDB/S3 (Helm)

## Architecture

### Storage Architecture

```
.fractary/faber/entities/
├── {entity_type}/                       # One directory per entity type
│   ├── {entity_id}.json                # Entity state file (current status)
│   ├── {entity_id}-history.json        # History file (step_history + workflow_summary)
│   └── {entity_id}.lock                # Lock file for concurrent writes
├── _indices/                            # Pre-computed indices for fast queries
│   ├── by-status.json                  # Index: status → [entity_ids]
│   ├── by-type.json                    # Index: type → [entity_ids]
│   ├── by-step-action.json             # Index: step_action → [entity_ids]
│   └── recent-updates.json             # Sorted by updated_at (last 1000)
└── _schemas/
    ├── entity-state.schema.json        # JSON schema for entity state
    └── entity-history.schema.json      # JSON schema for history file
```

**File Examples**:
- State: `.fractary/faber/entities/blog-post/blog-post-123.json`
- History: `.fractary/faber/entities/blog-post/blog-post-123-history.json`
- Lock: `.fractary/faber/entities/blog-post/blog-post-123.lock`

**Rationale for Separate History File**:
- Entity state file stays small (< 50 KB typically) for fast reads/writes
- History file can grow large without impacting current state queries
- Workflows querying "what entities need work" only read state files
- History file accessed only for audit trails and analytics
- Single lock file protects both state and history files

### Entity State Schema

**File**: `{entity_id}.json`

```json
{
  "organization": "fractary",
  "project": "blog",
  "entity_type": "blog-post",
  "entity_id": "blog-post-123",
  "status": "completed",
  "created_at": "2025-01-10T10:00:00Z",
  "updated_at": "2025-01-10T12:30:00Z",

  "step_status": {
    "build-github-commit": {
      "step_id": "build-github-commit",
      "step_action": "github-commit",
      "step_type": "repo-actions",
      "execution_status": "completed",
      "outcome_status": "success",
      "phase": "build",
      "last_executed_at": "2025-01-10T10:30:00Z",
      "last_executed_by": {
        "workflow_id": "content-pipeline",
        "run_id": "fractary/blog/uuid",
        "work_id": "42"
      },
      "execution_count": 2,
      "retry_count": 1
    },
    "evaluate-github-commit": {
      "step_id": "evaluate-github-commit",
      "step_action": "github-commit",
      "step_type": "repo-actions",
      "execution_status": "completed",
      "outcome_status": "success",
      "phase": "evaluate",
      "last_executed_at": "2025-01-10T11:00:00Z",
      "last_executed_by": {
        "workflow_id": "content-pipeline",
        "run_id": "fractary/blog/uuid",
        "work_id": "42"
      },
      "execution_count": 1,
      "retry_count": 0
    }
  },

  "properties": {
    "title": "Getting Started with FastAPI",
    "author": "john-doe",
    "publish_status": "published",
    "word_count": 1500
  },

  "artifacts": [
    {
      "type": "file",
      "path": "content/blog-post-123.md",
      "created_at": "2025-01-10T10:30:00Z",
      "created_by_step": "implement-content",
      "created_by_run": "fractary/blog/uuid"
    },
    {
      "type": "url",
      "path": "https://blog.example.com/fastapi-guide",
      "created_at": "2025-01-10T12:30:00Z",
      "created_by_step": "publish",
      "created_by_run": "fractary/blog/uuid"
    }
  ],

  "tags": ["tutorial", "python"],
  "version": 8,

  "sync_metadata": {
    "last_synced_at": null,
    "sync_enabled": false,
    "sync_target": null
  }
}
```

### Entity History Schema

**File**: `{entity_id}-history.json`

```json
{
  "entity_type": "blog-post",
  "entity_id": "blog-post-123",
  "organization": "fractary",
  "project": "blog",

  "step_history": [
    {
      "step_id": "build-github-commit",
      "step_action": "github-commit",
      "step_type": "repo-actions",
      "execution_status": "completed",
      "outcome_status": "success",
      "phase": "build",
      "executed_at": "2025-01-10T10:30:00Z",
      "workflow_id": "content-pipeline",
      "run_id": "fractary/blog/uuid",
      "work_id": "42",
      "session_id": "claude-session-...",
      "duration_ms": 12000,
      "retry_count": 1,
      "retry_reason": "Tests failed on first attempt"
    },
    {
      "step_id": "evaluate-github-commit",
      "step_action": "github-commit",
      "step_type": "repo-actions",
      "execution_status": "completed",
      "outcome_status": "success",
      "phase": "evaluate",
      "executed_at": "2025-01-10T11:00:00Z",
      "workflow_id": "content-pipeline",
      "run_id": "fractary/blog/uuid",
      "work_id": "42",
      "session_id": "claude-session-...",
      "duration_ms": 8000,
      "retry_count": 0
    }
  ],

  "workflow_summary": [
    {
      "workflow_id": "draft-creation",
      "run_id": "fractary/blog/uuid-1",
      "work_id": "41",
      "started_at": "2025-01-10T10:00:00Z",
      "completed_at": "2025-01-10T10:45:00Z",
      "outcome": "completed",
      "steps_executed": [
        {
          "step_id": "fetch-requirements",
          "step_action": "fetch-requirements",
          "step_type": "data-fetch"
        },
        {
          "step_id": "generate-spec",
          "step_action": "generate-spec",
          "step_type": "planning"
        }
      ]
    }
  ]
}
```

### Step Hierarchy

**Three-Level Hierarchy** (bottom to top):

1. **`step_id`** (required, most specific): Unique identifier within a workflow
   - Example: `build-github-commit`, `evaluate-github-commit`, `architect-fetch-requirements`
   - Must be unique within a workflow
   - Used for workflow step execution and state tracking

2. **`step_action`** (optional, middle level): Groups steps that perform the same action
   - Example: `github-commit` (groups `build-github-commit` and `evaluate-github-commit`)
   - Example: `run-tests` (groups `build-run-tests` and `evaluate-run-tests`)
   - Enables queries like "find all entities where 'github-commit' action failed"
   - Alternative names considered: `step_group`, `step_task`

3. **`step_type`** (optional, highest level): Broad categorization
   - Example: `repo-actions` (includes `github-commit`, `git-push`, `create-branch`)
   - Example: `testing` (includes `run-tests`, `run-lint`, `coverage-check`)
   - Example: `data-fetch` (includes `fetch-requirements`, `fetch-context`)
   - Enables high-level analytics across step types

**Configuration Example**:

```json
{
  "workflows": [
    {
      "id": "content-pipeline",
      "entity": {"enabled": true, "type": "blog-post"},
      "phases": {
        "build": {
          "steps": [
            {
              "id": "build-github-commit",
              "action": "github-commit",
              "type": "repo-actions",
              "skill": "commit-skill"
            }
          ]
        },
        "evaluate": {
          "steps": [
            {
              "id": "evaluate-github-commit",
              "action": "github-commit",
              "type": "repo-actions",
              "skill": "commit-skill"
            }
          ]
        }
      }
    }
  ]
}
```

**Query Use Cases**:
- By `step_id`: "Find entities where 'build-github-commit' failed"
- By `step_action`: "Find entities where any 'github-commit' action failed" (includes build-github-commit, evaluate-github-commit)
- By `step_type`: "Find entities where any 'repo-actions' step failed" (broader category)

### Status Fields

#### Execution Status (Lifecycle)

Values: `started`, `in_progress`, `completed`, `failed`, `skipped`

Describes the lifecycle state of step execution:
- `started`: Step just began execution
- `in_progress`: Step currently executing (for long-running steps)
- `completed`: Step finished execution (regardless of outcome)
- `failed`: Step failed to execute (error/exception)
- `skipped`: Step was skipped based on workflow logic

#### Outcome Status (Result Quality)

Values: `success`, `failure`, `warning`, `partial`

Describes the quality/result of step execution (from skill response):
- `success`: Step achieved desired outcome
- `failure`: Step executed but did not achieve desired outcome
- `warning`: Step succeeded with warnings or non-critical issues
- `partial`: Step achieved partial success (some tasks completed, others failed)

**Example Scenarios**:
- Test step: `execution_status=completed`, `outcome_status=failure` (tests ran but failed)
- Build step: `execution_status=failed`, `outcome_status=null` (build script crashed)
- Deploy step: `execution_status=completed`, `outcome_status=warning` (deployed but with deprecation warnings)

#### Overall Entity Status

Values: `pending`, `in_progress`, `completed`, `failed`, `archived`

Aggregate status computed from step statuses:
- `pending`: No steps executed yet
- `in_progress`: At least one step in progress or completed
- `completed`: All critical steps completed with success
- `failed`: At least one critical step failed
- `archived`: Entity no longer active (soft delete)

### Key Fields Explained

- **`organization`**: From fractary-core:repo plugin (enables cross-org queries in Helm)
- **`project`**: From git repository name or config (enables cross-project queries)
- **`step_status`**: Current status of each step (merged across all workflows)
  - Last execution details show which workflow/run last modified this step
  - Execution count tracks how many times step ran on this entity
  - Includes step hierarchy (`step_id`, `step_action`, `step_type`)
- **`step_history`** (in separate file): Complete audit trail of all step executions (append-only)
- **`workflow_summary`** (in separate file): High-level view of workflows that operated on entity
- **`sync_metadata`**: For future external sync (DynamoDB/S3 via Helm)

### Workflow Configuration

**Entity Tracking Configuration**:

```json
{
  "entity": {
    "enabled": true,
    "type": "blog-post",
    "id_field": "work_id",
    "auto_sync": true,
    "sync_on_phases": ["architect", "build", "release"],
    "artifact_mapping": {
      "spec_path": "file",
      "pr_url": "url"
    }
  }
}
```

**Step Configuration** (with hierarchy):

```json
{
  "steps": [
    {
      "id": "build-github-commit",
      "action": "github-commit",
      "type": "repo-actions",
      "skill": "commit-skill"
    }
  ]
}
```

**Fields**:
- `id` (required): Unique step identifier in workflow
- `action` (optional): Step action for grouping similar steps
- `type` (optional): Broad step category
- `skill`: Skill to execute for this step

## Integration with faber-manager

### Automatic Update Points

1. **Step 1.5: Entity Context Extraction** (NEW - after line 542)
   - Load/create entity state after config load
   - Extract organization from fractary-core:repo plugin
   - Extract project from git remote or run_id
   - Store in workflow context for later updates

2. **Step 4.2: After Each Step Execution** (MODIFY - around line 1090)
   - Record step execution in entity state immediately after step completes
   - Update `step_status` (current state in state file)
   - Append to `step_history` (audit trail in history file)
   - Record which workflow/run executed the step
   - Include phase, retry_count, step hierarchy

3. **Step 4.3: Phase Completion Hook** (MODIFY - around lines 1575-1628)
   - Update overall entity status based on phase completion
   - Extract artifacts from workflow state
   - Update artifact list in entity state

4. **Step 5: Workflow Completion** (MODIFY - around workflow completion logic)
   - Record workflow in workflow_summary (in history file)
   - Final entity status update
   - Trigger external sync if enabled (future: see SPEC-faber-helm-integration.md)

### Status Mapping

**Per-Step Execution**:
```
Step starts → execution_status = "started"
Step running → execution_status = "in_progress"
Step succeeds → execution_status = "completed", outcome_status = "success"
Step fails → execution_status = "failed" or "completed" with outcome_status = "failure"
Step skipped → execution_status = "skipped"
```

**Overall Entity Status**:
- Any step with execution_status = "in_progress" → entity.status = "in_progress"
- All critical steps with outcome_status = "success" → entity.status = "completed"
- Any critical step with outcome_status = "failure" → entity.status = "failed"
- No steps executed yet → entity.status = "pending"

## Entity-State Skill

**Location**: `plugins/faber/skills/entity-state/`

### Operations

| Operation | Purpose | Script |
|-----------|---------|--------|
| `create-entity` | Initialize new entity state | `entity-create.sh` |
| `read-entity` | Read entity by type + ID | `entity-read.sh` |
| `update-entity` | Update status/properties/artifacts | `entity-update.sh` |
| `record-step` | Record step execution | `entity-record-step.sh` |
| `record-workflow` | Add to workflow summary | `entity-record-workflow.sh` |
| `list-entities` | Query by type/status/step/action/tag | `entity-list.sh` |
| `query-recent-updates` | Find recently updated | `entity-query-recent.sh` |
| `query-step-action` | Query by step_action | `entity-query-step.sh` |
| `archive-entity` | Mark as archived | `entity-archive.sh` |

### Concurrency Control

**File Locking**:
- Lock file: `{entity_id}.lock` (directory-based lock)
- Acquire timeout: 30 seconds
- Stale lock detection: Remove locks from dead processes or > 5 minutes old
- Optimistic concurrency: Version numbers prevent conflicts

**Lock Pattern**:
```bash
# Acquire lock
mkdir "$ENTITY_LOCK_FILE" 2>/dev/null || wait_for_lock

# Perform operation
update_entity_state

# Release lock
rm -rf "$ENTITY_LOCK_FILE"
```

**Version Control**:
- Each entity state has a `version` field (integer)
- Increment version on every update
- Detect conflicts if expected version doesn't match current version

## Query Capabilities

### Use Case 1: Workflow Decision-Making

Workflows can query entity state to decide what to work on:

```bash
# Get 5 blog posts where seo-optimization is pending
fractary faber entity list \
  --type blog-post \
  --step-action seo-optimization \
  --execution-status pending \
  --limit 5

# Get entities updated in last hour
fractary faber entity query-recent \
  --since "2025-01-10T11:00:00Z" \
  --type blog-post
```

**SQL-like Query DSL** (future enhancement):
```
SELECT entity_id
FROM entities
WHERE entity_type = 'blog-post'
  AND step_status['seo-optimization'].execution_status = 'pending'
LIMIT 5
```

### Use Case 2: Dashboard/Audit

```bash
# List all blog posts by status
fractary faber entity list --type blog-post --status completed

# Find entities stuck on a specific step_action
fractary faber entity list \
  --type blog-post \
  --step-action github-commit \
  --execution-status failed

# Get step-level detail for specific entity
fractary faber entity get \
  --type blog-post \
  --id blog-post-123 \
  --show-steps
```

### Use Case 3: Downstream Polling

```bash
# Get entities updated since timestamp
fractary faber entity query-recent \
  --since 2025-01-10T00:00:00Z \
  --type blog-post

# Output: JSON array of entities for downstream processing
```

### Use Case 4: Step Action Analytics

```bash
# Find all entities where any 'github-commit' action failed
fractary faber entity query-step-action \
  --action github-commit \
  --outcome-status failure

# Get all entities by step_type
fractary faber entity query-step-type \
  --type repo-actions \
  --execution-status completed
```

### Query Performance

- **Type-based**: O(1) via directory listing
- **Status-based**: O(1) via index lookup
- **Recent updates**: O(1) via index scan with limit
- **Step-based**: O(1) via step-action index or O(n) scan
- **Step-action/type**: O(1) via dedicated indices

## Implementation Steps

### Phase 1: Core Infrastructure
1. Create entity-state skill directory structure
2. Implement entity state schema (JSON schema with step hierarchy)
3. Implement entity history schema (separate file)
4. Implement locking library (`entity-lock.sh`)
5. Implement core operations:
   - `entity-create.sh` (with empty step_status and step_history)
   - `entity-read.sh` (support querying step data)
   - `entity-update.sh` (merge step_status updates)
   - `entity-record-step.sh` (update state file + append to history file)
6. Test core operations with manual invocation

### Phase 2: Step Hierarchy Guidelines
1. Document step hierarchy (step_id → step_action → step_type)
2. Create step registry per entity type
3. Add validation script to warn on missing step_action/step_type
4. Update existing workflows to use step hierarchy

### Phase 3: Workflow Integration
1. Extend workflow config schema (add `entity` object and step hierarchy fields)
2. Modify faber-manager.md:
   - Add Step 1.5 (entity context extraction, load organization/project)
   - Modify Step 4.2 (call entity-record-step after each step completes)
   - Modify Step 4.3 (update overall entity status on phase completion)
   - Modify Step 5 (record workflow in workflow_summary)
3. Implement step and entity status mapping logic
4. Test with sample workflow using entity tracking

### Phase 4: Query & History
1. Implement `entity-record-workflow.sh` (workflow summary in history file)
2. Implement `entity-list.sh` (query by type/status/step/action)
3. Implement `entity-query-recent.sh` (recent updates)
4. Implement `entity-query-step.sh` (step-action and step-type queries)
5. Implement index maintenance (`index-update.sh` with step-action indices)
6. Test query operations including step hierarchy queries

### Phase 5: Organization and Project Tracking
1. Implement organization extraction from fractary-core:repo plugin
2. Add organization and project fields to all entity state structures
3. Test cross-org uniqueness (org + project + entity_type + entity_id)
4. Verify storage path uses `.fractary/faber/...` (not `.fractary/plugins/faber/...`)

### Phase 6: External Sync Preparation
1. Add `sync_metadata` fields to entity state
2. Draft FABER-Helm integration spec (see SPEC-faber-helm-integration.md)
3. Add `entity_sync` config to config schema (disabled by default)
4. Ensure local schema maps cleanly to external storage (includes organization field)

### Phase 7: CLI & Documentation
1. Add CLI commands for entity operations (including step hierarchy queries)
2. Write comprehensive SKILL.md with step tracking operations
3. Create example workflows with entity tracking and step hierarchy
4. Document entity state in faber-manager.md
5. Create step hierarchy guidelines document
6. Document execution_status vs outcome_status distinction

## Verification Steps

1. **Create test workflow with entity tracking**:
   ```json
   {
     "workflows": [{
       "id": "test-entity",
       "entity": {
         "enabled": true,
         "type": "test-item",
         "id_field": "work_id",
         "auto_sync": true
       },
       "phases": {
         "architect": {
           "steps": [{
             "id": "architect-design",
             "action": "design",
             "type": "planning",
             "skill": "echo-skill"
           }]
         },
         "build": {
           "steps": [{
             "id": "build-implement",
             "action": "implement",
             "type": "development",
             "skill": "echo-skill"
           }]
         }
       }
     }]
   }
   ```

2. **Run workflow**:
   ```bash
   fractary faber run --workflow test-entity --work-id test-123
   ```

3. **Verify entity created at correct path**:
   ```bash
   cat .fractary/faber/entities/test-item/test-123.json
   cat .fractary/faber/entities/test-item/test-123-history.json
   ```

4. **Verify entity state structure**:
   - Check organization and project fields populated
   - Check step_status has step_id, step_action, step_type
   - Check execution_status and outcome_status separate
   - Check phase field present
   - Check retry_count tracked

5. **Verify history file**:
   - Check step_history has entries for all executed steps
   - Check workflow_summary has workflow record

6. **Test step hierarchy queries**:
   ```bash
   # Query by step_id
   fractary faber entity list --type test-item --step-id build-implement

   # Query by step_action
   fractary faber entity query-step-action --action implement

   # Query by step_type
   fractary faber entity query-step-type --type development
   ```

7. **Test multi-workflow step tracking**:
   - Create second workflow with overlapping step_action
   - Run both workflows on same entity
   - Verify step_status shows merged state
   - Verify execution_count increments

8. **Test concurrent updates**:
   - Run two workflows on same entity simultaneously
   - Verify no corruption, proper locking
   - Verify both workflows in workflow_summary

## Success Criteria

- ✅ Entity state files at `.fractary/faber/entities/...` (not `.fractary/plugins/faber/...`)
- ✅ Separate history files prevent state file bloat
- ✅ **Step hierarchy**: step_id (required) → step_action (optional) → step_type (optional)
- ✅ **Per-step status tracking**: execution_status and outcome_status tracked separately
- ✅ **Phase tracking**: Each step execution records which phase it ran in
- ✅ **Retry tracking**: retry_count tracked per step
- ✅ **Organization tracking**: organization field from fractary-core:repo
- ✅ **Multi-workflow merging**: Steps from different workflows merged into unified step_status
- ✅ **Workflow querying**: Workflows can query entity state to decide what to work on
- ✅ **Step hierarchy queries**: Query by step_id, step_action, or step_type
- ✅ **Concurrent safety**: File locking prevents corruption
- ✅ **Backward compatible**: Opt-in via workflow config
- ✅ **External sync ready**: Schema designed for future Helm integration

## Future Enhancements

- Workflow routing based on outcome_status (e.g., route to debugger step on failure)
- Step-level analytics and bottleneck detection
- Dependency tracking between entities
- Quality metrics per step
- SQL-like query DSL for complex entity queries
- Real-time sync to Helm system (see SPEC-faber-helm-integration.md)
