# SPEC: FABER-Helm Integration for Centralized Entity Management

**Status**: Future Implementation
**Created**: 2026-01-10
**Author**: Claude (based on user requirements)
**Depends On**: SPEC-entity-state-tracking.md

## Overview

This specification defines the integration between FABER's local entity state tracking and the future FABER-Helm centralized control plane for multi-project/multi-organization workflow management.

### Purpose

Enable FABER to push entity state updates to a centralized Helm system (app.fractary.com) for:
- Cross-project entity dashboards
- Cross-organization holistic views
- Advanced analytics and bottleneck detection
- Time-series trends and forecasting
- Alert configuration and notifications
- Audit reports and compliance tracking

### Scope

- **In Scope**: Protocol, schemas, and configuration for FABER → Helm sync
- **Out of Scope**: Helm backend implementation (separate project)
- **Related**: SPEC-entity-state-tracking.md (local FABER implementation)

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FABER (Local)                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Workflow Execution                                      │ │
│  │ ├─ Entity State (.fractary/faber/entities/)           │ │
│  │ ├─ Step Tracking (per-step updates)                   │ │
│  │ └─ Basic Queries (for workflow decisions)             │ │
│  └────────────────────────────────────────────────────────┘ │
│                         │                                    │
│                         │ Real-time Stream                   │
│                         │ (on every step status change)      │
│                         ▼                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Entity Sync Skill (optional, paid add-on)              │ │
│  │ ├─ Event stream formatting                             │ │
│  │ ├─ Batch aggregation                                   │ │
│  │ ├─ Retry logic                                         │ │
│  │ └─ Authentication (API key)                            │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ HTTPS POST
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              FABER-Helm Backend (app.fractary.com)           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ API Gateway                                             │ │
│  │ ├─ Authentication & Authorization                       │ │
│  │ ├─ Rate Limiting (1000 events/min per org)            │ │
│  │ └─ Event Validation                                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                         │                                    │
│                         ├─────────┬──────────┐               │
│                         ▼         ▼          ▼               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  DynamoDB    │  │  Kinesis     │  │  EventBridge │      │
│  │  (Live State)│  │  (Stream)    │  │  (Events)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                                  │
│         │                 └────────▶ S3 Archive              │
│         │                           (90-day TTL)             │
│         │                                                    │
│         ▼                                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Dashboard UI (app.fractary.com)                         │ │
│  │ ├─ Organization View (all projects)                     │ │
│  │ ├─ Project View (all entities)                          │ │
│  │ ├─ Entity Status Grids                                  │ │
│  │ ├─ Step Bottleneck Detection                            │ │
│  │ ├─ Time-Series Charts                                   │ │
│  │ └─ Alerts & Notifications                               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## FABER vs Helm Responsibilities

### FABER Plugin (This + SPEC-entity-state-tracking.md)

**Free, Open Source**:
- ✅ Record entity state locally during workflow execution
- ✅ Maintain step-level tracking (step_status, step_history)
- ✅ Provide basic query operations for workflow decisions
- ✅ File locking and concurrency control
- ✅ Local indices for fast queries within a project

**Paid Add-On (Entity Sync)**:
- 💰 Push entity state to external storage (DynamoDB/S3) via sync mechanism
- 💰 Real-time streaming on step status changes
- 💰 Batch aggregation and retry logic
- 💰 API authentication and rate limiting compliance

### FABER-Helm System (Future Project)

**Paid Service**:
- ⏸️ Centralized control plane for multi-project/multi-org management
- ⏸️ Receive entity state updates from FABER via real-time streams
- ⏸️ Store aggregated state in DynamoDB (cross-project queries)
- ⏸️ Archive historical data in S3 (Athena analytics)
- ⏸️ Advanced analytics and dashboards (app.fractary.com):
  - Holistic view across all organizations/projects
  - Step-level bottleneck detection
  - Time-series trends and forecasting
  - Alert configuration and notifications
- ⏸️ Audit reports and compliance tracking
- ⏸️ Workflow orchestration and prioritization recommendations

## Entity State Stream Protocol

### Stream Trigger

**Real-Time**: On every step status change (execution_status or outcome_status update)

**Events Generated**:
- Step execution started
- Step execution completed
- Step execution failed
- Entity status changed (aggregate status update)
- Workflow completed on entity
- Entity created
- Entity archived

### Stream Format

**Transport**: JSON over HTTPS (POST request)
**Endpoint**: `https://api.app.fractary.com/v1/faber/entity-events`
**Authentication**: Bearer token in Authorization header
**Rate Limiting**: 1000 events/min per organization

### Event Payload Structure

```json
{
  "event_type": "entity.step.completed",
  "event_id": "evt_2026-01-10T12:30:00.123Z_abc123",
  "timestamp": "2026-01-10T12:30:00.123Z",

  "source": {
    "organization": "fractary",
    "project": "blog",
    "faber_version": "2.4.0",
    "hostname": "dev-machine-1",
    "session_id": "claude-session-20260110-123456"
  },

  "entity": {
    "organization": "fractary",
    "project": "blog",
    "type": "blog-post",
    "id": "blog-post-123"
  },

  "step": {
    "step_id": "build-github-commit",
    "step_action": "github-commit",
    "step_type": "repo-actions",
    "execution_status": "completed",
    "outcome_status": "success",
    "phase": "build",
    "executed_at": "2026-01-10T12:30:00Z",
    "workflow_id": "content-pipeline",
    "run_id": "fractary/blog/uuid",
    "work_id": "42",
    "duration_ms": 12000,
    "retry_count": 1
  },

  "entity_snapshot": {
    "status": "in_progress",
    "updated_at": "2026-01-10T12:30:00Z",
    "step_status_summary": {
      "completed": 5,
      "failed": 0,
      "in_progress": 1,
      "pending": 3
    }
  }
}
```

### Event Types

| Event Type | Description | Payload Includes |
|------------|-------------|------------------|
| `entity.created` | New entity registered | entity, entity_snapshot |
| `entity.step.started` | Step execution started | entity, step (execution_status=started) |
| `entity.step.in_progress` | Long-running step update | entity, step (progress indicator) |
| `entity.step.completed` | Step execution completed | entity, step (full details), entity_snapshot |
| `entity.step.failed` | Step execution failed | entity, step (error details), entity_snapshot |
| `entity.status.changed` | Overall entity status changed | entity, entity_snapshot (before/after) |
| `entity.workflow.completed` | Workflow completed on entity | entity, workflow_summary, entity_snapshot |
| `entity.archived` | Entity archived (soft delete) | entity, archive_reason |

## Helm Backend Requirements

### API Endpoint

**URL**: `https://api.app.fractary.com/v1/faber/entity-events`

**Method**: POST

**Headers**:
```
Authorization: Bearer {api_key}
Content-Type: application/json
X-FABER-Version: 2.4.0
X-Request-ID: {unique_request_id}
```

### Authentication

**API Key Provisioning**:
- Provisioned per organization via app.fractary.com dashboard
- Scoped to organization (can only push events for that org)
- Rotatable (old keys valid for 30 days after rotation)
- Rate limits enforced per API key

**Security**:
- HTTPS required (reject HTTP)
- API key validated against organization claim in payload
- Mismatch between API key org and event org → 403 Forbidden

### Rate Limiting

- **Limit**: 1000 events/min per organization
- **Burst**: Allow 2x burst for up to 1 minute
- **Response**: 429 Too Many Requests with Retry-After header
- **FABER Behavior**: Exponential backoff (1s, 2s, 4s, 8s, 16s, give up)

### Response Format

**Success** (200 OK):
```json
{
  "status": "accepted",
  "event_id": "evt_abc123",
  "message": "Entity event accepted for processing"
}
```

**Error** (4xx/5xx):
```json
{
  "status": "error",
  "error_code": "INVALID_EVENT_TYPE",
  "message": "Unknown event type: entity.invalid",
  "details": {
    "field": "event_type",
    "allowed_values": ["entity.created", "entity.step.completed", ...]
  }
}
```

### Error Handling

| Status Code | FABER Action | Retry? |
|-------------|--------------|--------|
| 200 OK | Success | No |
| 400 Bad Request | Log error, drop event | No |
| 401 Unauthorized | Log error, disable sync | No |
| 403 Forbidden | Log error, check API key | No |
| 429 Too Many Requests | Exponential backoff | Yes (with delay) |
| 500 Server Error | Retry with backoff | Yes (3 attempts) |
| 503 Service Unavailable | Retry with backoff | Yes (5 attempts) |

**FABER Resilience**:
- Buffer up to 1000 events in local queue during outage
- Continue local operation even if sync fails
- Resume sync when connectivity restored
- Emit local log warnings on sync failures

## DynamoDB Schema (Helm Backend)

### Table: helm-entity-states

**Purpose**: Live current state of all entities across all orgs/projects

**Schema**:
```
Partition Key: org#project (e.g., "fractary#blog")
Sort Key: entity_type#entity_id (e.g., "blog-post#blog-post-123")

Attributes:
- organization (string)
- project (string)
- entity_type (string)
- entity_id (string)
- status (string) - overall entity status
- created_at (string, ISO 8601)
- updated_at (string, ISO 8601)
- last_event_at (string, ISO 8601)
- step_status (map) - current status of each step
  - Keys: step_id
  - Values: {
      step_action: string,
      step_type: string,
      execution_status: string,
      outcome_status: string,
      phase: string,
      last_executed_at: string,
      execution_count: number,
      retry_count: number
    }
- faber_version (string)
- version (number) - for optimistic locking

GSI 1: Status Index
  PK: status (e.g., "completed", "failed")
  SK: updated_at
  Purpose: Query "all failed entities across all orgs"

GSI 2: Org-Status Index
  PK: organization#status (e.g., "fractary#in_progress")
  SK: updated_at
  Purpose: Query "all in-progress entities in fractary org"

GSI 3: Project-Updated Index
  PK: org#project
  SK: updated_at
  Purpose: Query "recently updated entities in fractary/blog"

GSI 4: Step-Action Index
  PK: step_action#execution_status (e.g., "github-commit#failed")
  SK: updated_at
  Purpose: Query "all entities where 'github-commit' action is failing"

GSI 5: Step-Type Index
  PK: step_type#execution_status (e.g., "repo-actions#failed")
  SK: updated_at
  Purpose: Query "all entities where 'repo-actions' type is failing"
```

**Query Examples**:
```python
# Get all failed entities
dynamodb.query(
    IndexName='StatusIndex',
    KeyConditionExpression='status = :status',
    ExpressionAttributeValues={':status': 'failed'}
)

# Get all in-progress entities in fractary org
dynamodb.query(
    IndexName='OrgStatusIndex',
    KeyConditionExpression='org_status = :org_status',
    ExpressionAttributeValues={':org_status': 'fractary#in_progress'}
)

# Get entities where github-commit action is failing
dynamodb.query(
    IndexName='StepActionIndex',
    KeyConditionExpression='step_action_status = :action_status',
    ExpressionAttributeValues={':action_status': 'github-commit#failed'}
)
```

### Table: helm-step-history

**Purpose**: Detailed step execution history for time-series queries

**Schema**:
```
Partition Key: org#project#entity_type#entity_id
Sort Key: executed_at#step_id

Attributes:
- organization, project, entity_type, entity_id
- step_id, step_action, step_type
- execution_status, outcome_status
- phase
- executed_at (ISO 8601)
- workflow_id, run_id, work_id, session_id
- duration_ms
- retry_count, retry_reason
- error_message (if failed)

TTL: 90 days (automatically archived to S3)
```

**Query Examples**:
```python
# Get step history for specific entity
dynamodb.query(
    KeyConditionExpression='entity_key = :entity',
    ExpressionAttributeValues={':entity': 'fractary#blog#blog-post#blog-post-123'}
)

# Get recent step executions (last 24 hours)
dynamodb.query(
    KeyConditionExpression='entity_key = :entity AND executed_at > :since',
    ExpressionAttributeValues={
        ':entity': 'fractary#blog#blog-post#blog-post-123',
        ':since': '2026-01-09T12:30:00Z'
    }
)
```

## S3 Archive Structure (Helm Backend)

### Archive Path Schema

```
s3://helm-entity-archives/
├── org={organization}/
│   ├── project={project}/
│   │   ├── entity_type={type}/
│   │   │   ├── year=2026/
│   │   │   │   ├── month=01/
│   │   │   │   │   ├── day=10/
│   │   │   │   │   │   ├── entity-history-{entity_id}-{timestamp}.json.gz
│   │   │   │   │   │   └── entity-state-{entity_id}-{timestamp}.json.gz
```

**Example Path**:
```
s3://helm-entity-archives/
  org=fractary/
    project=blog/
      entity_type=blog-post/
        year=2026/
          month=01/
            day=10/
              entity-history-blog-post-123-20260110T123000Z.json.gz
```

**File Format**: Compressed JSON (gzip, 60-70% reduction)

**Partitioning Strategy**: Partition by org, project, entity_type, and date for efficient Athena queries

### Athena Table Definition

```sql
CREATE EXTERNAL TABLE helm_entity_archives (
  organization STRING,
  project STRING,
  entity_type STRING,
  entity_id STRING,
  step_id STRING,
  step_action STRING,
  step_type STRING,
  execution_status STRING,
  outcome_status STRING,
  phase STRING,
  executed_at TIMESTAMP,
  workflow_id STRING,
  run_id STRING,
  duration_ms BIGINT,
  retry_count INT
)
PARTITIONED BY (
  org STRING,
  project STRING,
  entity_type STRING,
  year INT,
  month INT,
  day INT
)
STORED AS PARQUET
LOCATION 's3://helm-entity-archives/'
TBLPROPERTIES ('parquet.compression'='SNAPPY');
```

### Athena Query Examples

```sql
-- Find entities that failed during January 2026
SELECT entity_id, step_id, executed_at, outcome_status
FROM helm_entity_archives
WHERE year = 2026
  AND month = 01
  AND org = 'fractary'
  AND outcome_status = 'failure'
ORDER BY executed_at DESC;

-- Average step duration by step_action
SELECT step_action, AVG(duration_ms) as avg_duration_ms
FROM helm_entity_archives
WHERE year = 2026 AND month = 01
GROUP BY step_action
ORDER BY avg_duration_ms DESC;

-- Step failure rate by step_type over time
SELECT
  DATE_TRUNC('day', executed_at) as date,
  step_type,
  COUNT(*) as total_executions,
  SUM(CASE WHEN outcome_status = 'failure' THEN 1 ELSE 0 END) as failures,
  (SUM(CASE WHEN outcome_status = 'failure' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as failure_rate
FROM helm_entity_archives
WHERE year = 2026 AND month = 01
GROUP BY DATE_TRUNC('day', executed_at), step_type
ORDER BY date, failure_rate DESC;

-- Find entities stuck on same step for > 24 hours
SELECT entity_id, step_id, MIN(executed_at) as first_attempt, COUNT(*) as attempts
FROM helm_entity_archives
WHERE execution_status = 'failed'
  AND year = 2026 AND month = 01
GROUP BY entity_id, step_id
HAVING DATEDIFF('hour', MIN(executed_at), MAX(executed_at)) > 24
ORDER BY attempts DESC;
```

## FABER Sync Configuration

### Configuration Schema

In FABER `config.json`:

```json
{
  "entity_sync": {
    "enabled": false,
    "provider": "helm",
    "config": {
      "api_url": "https://api.app.fractary.com/v1/faber/entity-events",
      "api_key_env": "FRACTARY_API_KEY",
      "sync_strategy": "on_update",
      "batch_size": 100,
      "batch_interval_seconds": 5,
      "retry_max_attempts": 3,
      "retry_backoff_multiplier": 2,
      "local_queue_max_size": 1000,
      "timeout_seconds": 10
    }
  }
}
```

**Fields**:
- `enabled`: Enable/disable sync (default: false)
- `provider`: Sync provider ("helm" for Helm backend)
- `api_url`: Helm backend API endpoint
- `api_key_env`: Environment variable name for API key
- `sync_strategy`: When to sync ("on_update", "on_workflow_complete", "scheduled")
- `batch_size`: Events per batch request
- `batch_interval_seconds`: Max time to wait before sending partial batch
- `retry_max_attempts`: Max retry attempts for failed requests
- `retry_backoff_multiplier`: Exponential backoff multiplier
- `local_queue_max_size`: Max events to buffer during outage
- `timeout_seconds`: Request timeout

### Sync Strategies

| Strategy | Trigger | Latency | Bandwidth | Use Case |
|----------|---------|---------|-----------|----------|
| `on_update` | Every step status change | Real-time | High | Production monitoring |
| `on_workflow_complete` | Workflow completion | Batch | Low | Cost-optimized |
| `scheduled` | Every N seconds | Near real-time | Medium | Balanced |

### Environment Setup

```bash
# Set API key
export FRACTARY_API_KEY="fk_live_abc123def456..."

# Enable sync in config
fractary faber config set entity_sync.enabled true

# Test connection
fractary faber sync test
```

## Helm Dashboard Features (app.fractary.com)

### Organization View

**URL**: `https://app.fractary.com/orgs/{organization}`

**Features**:
- List all projects in the organization
- Entity count by project and status
- Step failure rate trends across all projects
- Recent activity feed
- Quick filters by status, entity_type

### Project View

**URL**: `https://app.fractary.com/orgs/{organization}/projects/{project}`

**Features**:
- Entity status grid (entity_type × status)
- Step execution timeline
- Workflow completion rate
- Entity list with filters (status, step_action, step_type)
- Drill-down to individual entity details

### Entity Detail View

**URL**: `https://app.fractary.com/orgs/{organization}/projects/{project}/entities/{type}/{id}`

**Features**:
- Current entity status
- Step status breakdown (by step_action and step_type)
- Step history timeline with execution/outcome status
- Workflow summary (all workflows that operated on entity)
- Custom properties display
- Artifacts list with links
- Full audit trail

### Step Bottleneck Detection

**URL**: `https://app.fractary.com/analytics/bottlenecks`

**Features**:
- Identify steps with high failure rates
- Identify steps with long average duration
- Identify steps causing entity backlog
- Compare step performance across projects/orgs
- Trend analysis (failure rate over time)

### Time-Series Charts

**Metrics**:
- Entity throughput (entities completed per day)
- Step duration trends (by step_action, step_type)
- Failure rate by step_action
- Workflow completion rate
- Entity backlog (pending entities)

### Alerts & Notifications

**Alert Types**:
- Entity stuck on step for > N hours
- Step failure rate exceeds threshold
- Entity backlog exceeds threshold
- Anomaly detection (unusual patterns)

**Notification Channels**:
- Email
- Slack
- Webhook (to custom systems)

### Audit Reports

**Reports**:
- Entity lifecycle report (created → completed)
- Step execution report (all steps by entity)
- Workflow summary report (all workflows by entity)
- Compliance audit trail (who did what when)

## Free vs Paid Features

### Free (Open Source FABER)

- ✅ Local entity state tracking
- ✅ Basic queries for workflow decisions
  - "Get 5 entities where step X has status Y"
  - "List entities by status"
  - "Find recently updated entities"
- ✅ Manual export to JSON/CSV
- ✅ Command-line entity queries

### Paid (Helm Add-On)

**Tier 1: Basic Sync** ($49/month per organization):
- 💰 Real-time sync to centralized Helm system
- 💰 Cross-project entity dashboard
- 💰 30-day historical data retention
- 💰 Basic alerts (email)
- 💰 Up to 10,000 events/month

**Tier 2: Professional** ($199/month per organization):
- 💰 All Basic features
- 💰 90-day historical data retention
- 💰 Advanced analytics (step bottleneck detection)
- 💰 Time-series trends and charts
- 💰 Slack notifications
- 💰 Up to 100,000 events/month

**Tier 3: Enterprise** (Custom pricing):
- 💰 All Professional features
- 💰 Unlimited historical data retention (S3 + Athena)
- 💰 Custom dashboards and reports
- 💰 Webhook integrations
- 💰 Priority support
- 💰 Unlimited events

## Implementation Phases

### Phase 1: FABER Local (SPEC-entity-state-tracking.md)
- ✅ Implement local entity state tracking
- ✅ Add sync_metadata fields to entity state
- ✅ Add entity_sync config schema (disabled by default)

### Phase 2: FABER Sync Skill (This Spec)
- ⏸️ Implement entity-sync skill
- ⏸️ Event stream formatting
- ⏸️ Batch aggregation
- ⏸️ Retry logic with exponential backoff
- ⏸️ Local queue for outage resilience
- ⏸️ API authentication (Bearer token)

### Phase 3: Helm Backend
- ⏸️ API Gateway (authentication, rate limiting, validation)
- ⏸️ DynamoDB tables (entity-states, step-history)
- ⏸️ S3 archive setup (with DynamoDB TTL)
- ⏸️ EventBridge integration
- ⏸️ Athena table definitions

### Phase 4: Helm Dashboard
- ⏸️ Organization view
- ⏸️ Project view
- ⏸️ Entity detail view
- ⏸️ Step bottleneck detection
- ⏸️ Time-series charts
- ⏸️ Alerts and notifications

### Phase 5: Advanced Analytics
- ⏸️ Athena query optimization
- ⏸️ ML-based anomaly detection
- ⏸️ Workflow optimization recommendations
- ⏸️ Predictive analytics (forecast entity completion times)

## Security Considerations

1. **API Key Security**:
   - Never log API keys
   - Store in environment variables only
   - Rotate keys regularly
   - Scope to organization (can't access other orgs)

2. **Data Privacy**:
   - Entity state may contain sensitive data (entity properties)
   - Option to exclude specific fields from sync
   - PII detection and redaction (future)

3. **Rate Limiting**:
   - Protect Helm backend from DoS
   - Fair usage across organizations
   - Graceful degradation (local operation continues)

4. **Authentication**:
   - HTTPS required
   - Bearer token validation
   - Organization claim validation

## Testing Strategy

1. **Unit Tests**:
   - Event formatting
   - Batch aggregation
   - Retry logic

2. **Integration Tests**:
   - FABER → Helm API
   - API authentication
   - Rate limiting
   - Error handling

3. **End-to-End Tests**:
   - Run workflow → check Helm dashboard
   - Verify step history in DynamoDB
   - Query Athena for archived data

4. **Load Tests**:
   - 1000 events/min sustained
   - Burst to 2000 events/min
   - Recovery after outage

## Success Criteria

- ✅ FABER can push entity events to Helm backend
- ✅ Real-time sync with < 5 second latency
- ✅ 99.9% event delivery success rate
- ✅ Graceful degradation during outages (local queue buffers events)
- ✅ Dashboard shows live entity state across all orgs/projects
- ✅ Athena queries return correct historical data
- ✅ Alerts trigger correctly based on configured thresholds
- ✅ API key authentication works correctly
- ✅ Rate limiting prevents abuse
- ✅ Step hierarchy queries work (by step_id, step_action, step_type)

## Future Enhancements

- Workflow orchestration recommendations (ML-based)
- Dependency tracking between entities
- Quality score prediction (predict if entity will pass QA)
- Capacity planning (forecast resource needs)
- Cost optimization (identify expensive workflows)
