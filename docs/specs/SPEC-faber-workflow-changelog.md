---
fractary_doc_type: spec
org: corthos
system: fractary/faber
title: FABER Workflow Machine-Readable Changelog
description: Proposal for NDJSON-based machine-readable changelog integrated into the FABER workflow executor
tags: [spec, changelog, faber, ndjson, machine-readable, automation]
created: 2026-02-12
visibility: internal
status: draft
target_project: fractary/faber
---

# SPEC: FABER Workflow Machine-Readable Changelog

## Problem

FABER workflows produce structured step results with rich metadata (record counts, validation results, deployment status, execution times), but this data is only available by reading individual run state files. There is no standardized, machine-readable changelog that downstream systems can consume to understand what changed and what actions they need to take.

The previous changelog system (SPEC-00027, deprecated Nov 2025) used pipe-delimited markdown -- human-readable but not truly machine-parseable. With FABER now driving all dataset operations, the changelog should be a native output of the workflow executor rather than a separate recording mechanism.

## Proposal

Emit a machine-readable changelog in NDJSON (Newline-Delimited JSON) format as a native output of FABER workflow execution. Each meaningful step completion produces a changelog entry appended to both a per-run file and an aggregated project-level file.

### Why NDJSON

- **Append-only**: New entries are appended without rewriting the file
- **Streaming-friendly**: Each line is a self-contained JSON object, parseable independently
- **No merge conflicts**: Concurrent appends to different lines never conflict
- **Trivially parseable**: `for line in file: json.loads(line)` -- no schema negotiation
- **Extensible**: New fields added without breaking existing consumers
- **Tooling**: Standard Unix tools work (`wc -l`, `tail -1`, `grep`, `jq`)

## Format

### File Locations

| File | Scope | Lifecycle |
|------|-------|-----------|
| `.fractary/faber/runs/{run_id}/changelog.ndjson` | Per-run | Created during run, immutable after completion |
| `.fractary/changelog.ndjson` | Project-level aggregate | Appended after each run completes |

### Entry Schema

Each line in the NDJSON file is a JSON object with the following schema:

```json
{
  "event_id": "evt_{run_id}_{step_id}_{timestamp}",
  "timestamp": "2026-02-11T19:33:00Z",
  "run_id": "corthosai-etl-corthion-ai-ipeds-hd-v2024-20260211T112734",
  "workflow_id": "dataset-create",
  "work_id": "150",
  "phase": "evaluate",
  "step_id": "evaluate-dataset-publish-test",
  "step_name": "Publish Data to Test Environment",
  "status": "success",
  "event_type": "DATA_PUBLISHED",
  "target": "ipeds/hd",
  "environment": "test",
  "version": "2024",
  "message": "Glue job SUCCEEDED in 94s. 5,664 rows, 111 columns.",
  "metadata": {
    "record_count": 5664,
    "column_count": 111,
    "execution_time_seconds": 94,
    "file_count": 2,
    "data_size_mb": 1.75
  },
  "actions_required": {
    "downstream_catalog_update": true,
    "schema_migration": false,
    "breaking_changes": false
  }
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event_id` | string | yes | Unique identifier: `evt_{run_id}_{step_id}_{timestamp}` |
| `timestamp` | string (ISO 8601) | yes | When the step completed |
| `run_id` | string | yes | FABER run identifier |
| `workflow_id` | string | yes | Workflow that produced this entry (e.g., `dataset-create`) |
| `work_id` | string | yes | Associated work item (GitHub issue number) |
| `phase` | string | yes | FABER phase: `frame`, `architect`, `build`, `evaluate`, `release` |
| `step_id` | string | yes | Step identifier within the workflow |
| `step_name` | string | yes | Human-readable step name |
| `status` | string | yes | Step outcome: `success`, `failure`, `skipped` |
| `event_type` | string | yes | Semantic event classification (see Event Types) |
| `target` | string | yes | Asset identifier in slash notation (e.g., `ipeds/hd`) |
| `environment` | string | no | `test`, `prod`, or omitted for environment-agnostic steps |
| `version` | string | no | Data version if applicable |
| `message` | string | yes | Human-readable summary of what happened |
| `metadata` | object | no | Step-specific structured data (counts, sizes, durations) |
| `actions_required` | object | no | Flags for downstream system actions |

### Event Types

Event types provide semantic classification of what a step accomplished. They are mapped from step ID patterns in the workflow configuration.

| Event Type | Triggered By Step Pattern | Description |
|------------|--------------------------|-------------|
| `INFRASTRUCTURE_DEPLOYED` | `*-deploy-apply-*` | Terraform resources created/updated |
| `INFRASTRUCTURE_VALIDATED` | `*-deploy-validate-*` | Deployment verification passed |
| `DATA_PUBLISHED` | `*-dataset-publish-*` (excluding validate) | ETL job executed, data written |
| `DATA_VALIDATED` | `*-dataset-publish-validate-*` | Published data quality verified |
| `CODE_MERGED` | `*-pr-merge-*` | Code merged to target branch |
| `CODE_REVIEWED` | `*-pr-review` | Pull request reviewed |
| `SCHEMA_DOCUMENTED` | `*-engineer-document` | Documentation generated/updated |
| `ARCHITECTURE_DOCUMENTED` | `*-design-validate` | Architecture spec validated |
| `RESEARCH_COMPLETED` | `*-research-validate` | Research phase validated |
| `CODEX_SYNCED` | `*-codex-sync-*` | Documentation synced to codex |

### Event Type Configuration

Workflows specify which steps produce changelog entries and their event type mapping via a `changelog` field on the step definition. Steps without a `changelog` field do not produce entries.

```json
{
  "id": "evaluate-dataset-publish-test",
  "name": "Publish Data to Test Environment",
  "changelog": {
    "event_type": "DATA_PUBLISHED",
    "actions_required": {
      "downstream_catalog_update": true
    }
  }
}
```

By default, only steps that produce meaningful external artifacts should have `changelog` entries: deployments, data publications, merges, and schema changes. Internal workflow steps (issue comments, commit-and-push, context loading) should not.

## Integration Point

### Where in FABER

The FABER executor (`faber-executor` skill) already processes step results and updates run state. The changelog integration point is the step completion handler:

```
Step Executes → Result Captured → State Updated → [Changelog Entry Emitted]
```

After updating step state, the executor checks if the step definition has a `changelog` field. If present, it:

1. Constructs a changelog entry from the step result and workflow context
2. Appends it as a JSON line to `.fractary/faber/runs/{run_id}/changelog.ndjson`
3. On workflow completion, appends all per-run entries to `.fractary/changelog.ndjson`

### Entry Construction

The changelog entry is derived from data already available in the executor context:

| Entry Field | Source |
|-------------|--------|
| `event_id` | Generated from `run_id` + `step_id` + `timestamp` |
| `timestamp` | Step `completed_at` from state |
| `run_id`, `workflow_id`, `work_id` | Run metadata |
| `phase`, `step_id`, `step_name` | Step definition |
| `status` | Step result status |
| `event_type` | Step `changelog.event_type` config |
| `target` | Run `work_items[0].target` |
| `environment` | Parsed from step_id pattern or step config |
| `version` | Run parameters |
| `message` | Step result message |
| `metadata` | Step result structured data (if available) |
| `actions_required` | Step `changelog.actions_required` config merged with runtime detection |

## Aggregation

### Per-Run File

`.fractary/faber/runs/{run_id}/changelog.ndjson`

- Created during workflow execution
- Entries appended as each changelog-enabled step completes
- Immutable after workflow completes (success or failure)
- Provides run-scoped view for debugging and auditing

### Project-Level File

`.fractary/changelog.ndjson`

- Appended when a workflow run completes
- All entries from the per-run file are appended in order
- Provides cross-run, cross-workflow view
- Primary consumption point for downstream systems

### Delivery to Downstream Systems

Delivery and synchronization of changelog data to downstream systems (e.g., lake.corthonomy.ai) is **out of scope** for this spec. That is a separate concern handled by codex-sync or other integration mechanisms that can read the NDJSON files.

## Consumption Example

For reference -- this illustrates how a downstream system would consume the changelog. This is not part of the spec itself.

```python
import json
from datetime import datetime

def get_datasets_to_update(changelog_path, since_timestamp):
    """Read NDJSON changelog, return datasets needing catalog updates."""
    datasets = set()
    with open(changelog_path) as f:
        for line in f:
            event = json.loads(line)
            if event['timestamp'] > since_timestamp:
                if event.get('actions_required', {}).get('downstream_catalog_update'):
                    datasets.add(event['target'])
    return datasets

# Usage
datasets = get_datasets_to_update('.fractary/changelog.ndjson', '2026-02-01T00:00:00Z')
for ds in datasets:
    print(f"Update catalog for: {ds}")
```

## Migration from Previous System

The previous changelog system (SPEC-00027) used per-dataset `CHANGELOG.md` files with pipe-delimited entries and a separate `dataset-changelog-recorder` agent. That system is fully deprecated.

- **Per-dataset human-readable changelogs** (`src/datasets/{dataset}/{table}/CHANGELOG.md`) continue to exist as documentation artifacts, maintained during the `build-engineer-document` step of the FABER workflow. These are human-readable, not machine-readable.
- **Machine-readable changelog** is replaced by this NDJSON system, which is a native FABER output rather than a separate recording mechanism.

The two systems are complementary:
- NDJSON changelog: machine-readable, automation-oriented, captures all workflow events
- Per-dataset CHANGELOG.md: human-readable, documentation-oriented, captures what was built/changed

## Open Questions

1. **Retention policy**: Should `.fractary/changelog.ndjson` be rotated or trimmed? For a project with ~120 datasets updated quarterly, this would grow by ~2,400 entries/year (~500KB). Likely fine without rotation for years.
2. **Failure entries**: Should failed steps emit changelog entries? Current proposal: yes, with `status: "failure"` -- useful for debugging but consumers should filter by status.
3. **Schema versioning**: Should entries include a `schema_version` field for forward compatibility? Current proposal: not initially -- NDJSON's extensibility handles this naturally.
