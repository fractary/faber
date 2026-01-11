---
name: entity-state
description: Manage entity-level state tracking across FABER workflows
model: claude-opus-4-5
---

# FABER Entity State Skill

<CONTEXT>
You are a focused utility skill for managing entity-level state tracking across FABER workflows.
You provide deterministic CRUD operations for entity state management.

Entity state is stored at:
- **State file**: `.fractary/faber/entities/{entity_type}/{entity_id}.json` (current status)
- **History file**: `.fractary/faber/entities/{entity_type}/{entity_id}-history.json` (step_history + workflow_summary)

Entity state tracks:
- Overall entity status (pending, in_progress, completed, failed, archived)
- Per-step status with step hierarchy (step_id → step_action → step_type)
- Execution status (lifecycle) vs outcome status (result quality)
- Organization and project (for cross-org/project queries)
- Custom properties and artifacts
- Step history and workflow summary
</CONTEXT>

<CRITICAL_RULES>
**YOU MUST:**
- Use existing scripts from `scripts/` directory
- Return structured JSON results for all operations
- Preserve existing state data when updating (merge, don't replace)
- Use atomic writes with file locking to prevent corruption
- Validate step hierarchy (step_id required, step_action and step_type optional)

**YOU MUST NOT:**
- Make decisions about workflow progression (that's the agent's job)
- Skip state validation
- Delete state without explicit request
- Modify history files directly (use record-step and record-workflow operations)
</CRITICAL_RULES>

<STATE_STRUCTURE>
## Entity State File ({entity_id}.json)

```json
{
  "organization": "fractary",
  "project": "blog",
  "entity_type": "blog-post",
  "entity_id": "blog-post-123",
  "status": "in_progress",
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
      "execution_count": 1,
      "retry_count": 0
    }
  },
  "properties": {
    "title": "Getting Started with FastAPI",
    "word_count": 1500
  },
  "artifacts": [
    {
      "type": "file",
      "path": "content/blog-post-123.md",
      "created_at": "2025-01-10T10:30:00Z",
      "created_by_step": "implement-content"
    }
  ],
  "tags": ["tutorial", "python"],
  "version": 5
}
```

## Entity History File ({entity_id}-history.json)

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
      "duration_ms": 12000,
      "retry_count": 0
    }
  ],
  "workflow_summary": [
    {
      "workflow_id": "content-pipeline",
      "run_id": "fractary/blog/uuid",
      "started_at": "2025-01-10T10:00:00Z",
      "completed_at": "2025-01-10T12:30:00Z",
      "outcome": "completed",
      "steps_executed": [
        {"step_id": "build-github-commit", "step_action": "github-commit", "step_type": "repo-actions"}
      ]
    }
  ]
}
```

## Step Hierarchy

- **step_id** (required): Unique identifier within workflow (e.g., "build-github-commit")
- **step_action** (optional): Groups steps that do the same thing (e.g., "github-commit")
- **step_type** (optional): Broad category (e.g., "repo-actions")

## Status Fields

- **execution_status**: Lifecycle state (started, in_progress, completed, failed, skipped)
- **outcome_status**: Result quality (success, failure, warning, partial)
</STATE_STRUCTURE>

<OPERATIONS>

## create-entity

Initialize a new entity state file.

**Script:** `scripts/entity-create.sh`

**Parameters:**
- `type` (required): Entity type (e.g., "blog-post")
- `id` (required): Entity ID (e.g., "blog-post-123")
- `org` (required): Organization name (from fractary-core:repo)
- `project` (required): Project name (from git or config)
- `properties` (optional): JSON object with custom properties
- `tags` (optional): Comma-separated tags

**Example:**
```bash
scripts/entity-create.sh \
  --type blog-post \
  --id blog-post-123 \
  --org fractary \
  --project blog \
  --properties '{"title": "Getting Started"}' \
  --tags "tutorial,python"
```

**Returns:**
```json
{
  "status": "success",
  "operation": "create-entity",
  "entity_type": "blog-post",
  "entity_id": "blog-post-123",
  "entity_path": ".fractary/faber/entities/blog-post/blog-post-123.json",
  "history_path": ".fractary/faber/entities/blog-post/blog-post-123-history.json"
}
```

## read-entity

Read entity state by type and ID.

**Script:** `scripts/entity-read.sh`

**Parameters:**
- `type` (required): Entity type
- `id` (required): Entity ID
- `query` (optional): jq query for specific fields (default: ".")
- `include-history` (optional): Include step_history and workflow_summary

**Example:**
```bash
# Read full entity state
scripts/entity-read.sh --type blog-post --id blog-post-123

# Query specific field
scripts/entity-read.sh --type blog-post --id blog-post-123 --query '.status'

# Include history
scripts/entity-read.sh --type blog-post --id blog-post-123 --include-history
```

## update-entity

Update entity state (status, properties, artifacts).

**Script:** `scripts/entity-update.sh`

**Parameters:**
- `type` (required): Entity type
- `id` (required): Entity ID
- `status` (optional): New overall status
- `properties` (optional): JSON object to merge into properties
- `artifacts` (optional): JSON array of artifacts to append
- `add-tags` (optional): Comma-separated tags to add
- `version` (optional): Expected version for optimistic locking

**Example:**
```bash
# Update status
scripts/entity-update.sh \
  --type blog-post \
  --id blog-post-123 \
  --status completed

# Update properties
scripts/entity-update.sh \
  --type blog-post \
  --id blog-post-123 \
  --properties '{"word_count": 1500}'

# Add artifacts
scripts/entity-update.sh \
  --type blog-post \
  --id blog-post-123 \
  --artifacts '[{"type": "url", "path": "https://blog.example.com/post-123", "created_at": "2025-01-10T12:30:00Z", "created_by_step": "publish"}]'
```

**Returns:**
```json
{
  "status": "success",
  "operation": "update-entity",
  "entity_type": "blog-post",
  "entity_id": "blog-post-123",
  "new_version": 6
}
```

## record-step

Record step execution in entity state and history.

**Script:** `scripts/entity-record-step.sh`

**Parameters:**
- `type` (required): Entity type
- `id` (required): Entity ID
- `step-id` (required): Step identifier
- `step-action` (optional): Step action for grouping
- `step-type` (optional): Broad step category
- `execution-status` (required): Lifecycle state (started, in_progress, completed, failed, skipped)
- `outcome-status` (optional): Result quality (success, failure, warning, partial)
- `phase` (required): Phase (frame, architect, build, evaluate, release)
- `workflow-id` (required): Workflow identifier
- `run-id` (required): Run identifier
- `work-id` (optional): Work item ID
- `session-id` (optional): Claude session ID
- `duration-ms` (optional): Step duration in milliseconds
- `retry-count` (optional): Number of retries
- `retry-reason` (optional): Reason for retry
- `error-message` (optional): Error message if failed

**Example:**
```bash
scripts/entity-record-step.sh \
  --type blog-post \
  --id blog-post-123 \
  --step-id build-github-commit \
  --step-action github-commit \
  --step-type repo-actions \
  --execution-status completed \
  --outcome-status success \
  --phase build \
  --workflow-id content-pipeline \
  --run-id fractary/blog/uuid \
  --work-id 42 \
  --duration-ms 12000 \
  --retry-count 0
```

**Returns:**
```json
{
  "status": "success",
  "operation": "record-step",
  "entity_type": "blog-post",
  "entity_id": "blog-post-123",
  "step_id": "build-github-commit",
  "execution_status": "completed",
  "new_version": 7,
  "execution_count": 1
}
```

## record-workflow

Record workflow completion in entity history.

**Script:** `scripts/entity-record-workflow.sh`

**Parameters:**
- `type` (required): Entity type
- `id` (required): Entity ID
- `workflow-id` (required): Workflow identifier
- `run-id` (required): Run identifier
- `work-id` (optional): Work item ID
- `started-at` (required): Workflow start time (ISO 8601)
- `completed-at` (optional): Workflow completion time (ISO 8601)
- `outcome` (required): Workflow outcome (completed, failed, partial, cancelled)
- `steps` (required): JSON array of steps executed

**Example:**
```bash
scripts/entity-record-workflow.sh \
  --type blog-post \
  --id blog-post-123 \
  --workflow-id content-pipeline \
  --run-id fractary/blog/uuid \
  --work-id 42 \
  --started-at "2025-01-10T10:00:00Z" \
  --completed-at "2025-01-10T12:30:00Z" \
  --outcome completed \
  --steps '[{"step_id": "build-github-commit", "step_action": "github-commit", "step_type": "repo-actions"}]'
```

## list-entities

List entities with filters.

**Script:** `scripts/entity-list.sh`

**Parameters:**
- `type` (required): Entity type
- `status` (optional): Filter by overall status
- `step-action` (optional): Filter by step action
- `execution-status` (optional): Filter by step execution status (used with step-action)
- `limit` (optional): Max results (default: 100)

**Example:**
```bash
# List all blog posts
scripts/entity-list.sh --type blog-post

# List completed blog posts
scripts/entity-list.sh --type blog-post --status completed

# List entities where github-commit action failed
scripts/entity-list.sh \
  --type blog-post \
  --step-action github-commit \
  --execution-status failed \
  --limit 10
```

**Returns:** JSON array of entity states

## query-recent

Query recently updated entities (for downstream polling).

**Script:** `scripts/entity-query-recent.sh`

**Parameters:**
- `since` (optional): ISO 8601 timestamp to filter updates after this time
- `limit` (optional): Max results (default: 100)
- `type` (optional): Filter by entity type

**Example:**
```bash
# Get all recent updates
scripts/entity-query-recent.sh --limit 50

# Get updates since timestamp
scripts/entity-query-recent.sh --since "2025-01-10T00:00:00Z"

# Get recent updates for specific type
scripts/entity-query-recent.sh --type blog-post --limit 10
```

**Returns:**
```json
[
  {
    "entity": "blog-post/blog-post-123",
    "type": "blog-post",
    "id": "blog-post-123",
    "updated_at": "2025-01-10T12:30:00Z"
  }
]
```

## query-step

Query entities by step action and execution status.

**Script:** `scripts/entity-query-step.sh`

**Parameters:**
- `step-action` (required): Step action to query
- `execution-status` (optional): Filter by execution status
- `limit` (optional): Max results (default: 100)

**Example:**
```bash
# Get entities where github-commit action is pending
scripts/entity-query-step.sh \
  --step-action github-commit \
  --execution-status pending \
  --limit 5

# Get all entities with seo-optimization step (any status)
scripts/entity-query-step.sh \
  --step-action seo-optimization
```

**Returns:** JSON array of full entity states

## rebuild-indices

Rebuild all indices from scratch (maintenance operation).

**Script:** `scripts/entity-rebuild-indices.sh`

**Parameters:**
- `force` (optional): Must be provided to proceed with rebuild

**Example:**
```bash
# Rebuild all indices (requires --force)
scripts/entity-rebuild-indices.sh --force
```

**Returns:**
```json
{
  "status": "success",
  "operation": "rebuild-indices",
  "message": "All indices rebuilt successfully"
}
```

**Note:** This operation scans all entity files and rebuilds indices. Use this if indices become corrupted or out of sync.

</OPERATIONS>

<TYPICAL_WORKFLOW>

## Creating and Tracking an Entity

1. **Create entity** when workflow starts:
```
Invoke Skill: entity-state
Operation: create-entity
Parameters: type=blog-post, id=blog-post-123, org=fractary, project=blog
```

2. **Record step execution** after each workflow step:
```
Invoke Skill: entity-state
Operation: record-step
Parameters:
  type=blog-post, id=blog-post-123,
  step-id=build-github-commit, step-action=github-commit, step-type=repo-actions,
  execution-status=completed, outcome-status=success,
  phase=build, workflow-id=content-pipeline, run-id=fractary/blog/uuid
```

3. **Update entity status** on phase completion:
```
Invoke Skill: entity-state
Operation: update-entity
Parameters: type=blog-post, id=blog-post-123, status=in_progress
```

4. **Record workflow completion** at end:
```
Invoke Skill: entity-state
Operation: record-workflow
Parameters:
  type=blog-post, id=blog-post-123,
  workflow-id=content-pipeline, run-id=fractary/blog/uuid,
  started-at=..., completed-at=..., outcome=completed,
  steps=[...]
```

## Querying Entities for Workflow Decisions

Workflows can query entity state to decide what to work on:

```bash
# Get 5 blog posts where seo-optimization step is pending
scripts/entity-query-step.sh \
  --step-action seo-optimization \
  --execution-status pending \
  --limit 5

# Alternative: Use list-entities with step-action filter
scripts/entity-list.sh \
  --type blog-post \
  --step-action seo-optimization \
  --execution-status pending \
  --limit 5
```

**Use Case**: A workflow that performs SEO optimization can query for entities that need this step, then iterate through them.

## Polling for Recent Updates

Downstream systems can poll for recently updated entities:

```bash
# Get entities updated in last hour
scripts/entity-query-recent.sh \
  --since "$(date -u -d '1 hour ago' -Iseconds)" \
  --limit 100

# Filter by type
scripts/entity-query-recent.sh \
  --since "2025-01-10T12:00:00Z" \
  --type blog-post
```

**Use Case**: External dashboards or monitoring systems can poll this endpoint to detect changes without scanning all entities.

</TYPICAL_WORKFLOW>

<ERROR_HANDLING>

All operations return structured JSON with `status` field:
- `"success"`: Operation completed successfully
- `"error"`: Operation failed (check `message` field)
- `"conflict"`: Version conflict detected (check `expected_version` and `current_version`)

Example error response:
```json
{
  "status": "error",
  "message": "Entity not found: blog-post/blog-post-999"
}
```

</ERROR_HANDLING>

<NOTES>
- Entity state and history are kept in separate files to prevent bloat
- Step hierarchy enables grouping (step_id → step_action → step_type)
- Execution status tracks lifecycle, outcome status tracks result quality
- File locking prevents concurrent modification conflicts
- Organization and project fields enable cross-org/project queries (for Helm)
- **Indices**: Automatically maintained for fast queries (by-status, by-type, by-step-action, recent-updates)
- **Index Performance**: O(1) lookups for status/type/step queries, O(log n) for recent updates
- **Index Location**: `.fractary/faber/entities/_indices/`
- **Index Maintenance**: Automatic on create/update/record-step operations
- **Index Rebuild**: Use `entity-rebuild-indices.sh --force` if indices become corrupted
</NOTES>
