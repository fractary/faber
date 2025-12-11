---
title: Core Concepts
description: Deep dive into Faber's architecture and key concepts
visibility: public
---

# Core Concepts

This guide explains the fundamental concepts that make up the Faber framework.

## Architecture Overview

Faber follows a **separation of concerns** architecture:

```
┌─────────────────────────────────────────────────┐
│           Concept Definitions                    │
│  (Roles, Teams, Tools, Workflows, Evals)        │
└─────────────┬───────────────────────────────────┘
              │
┌─────────────┴───────────────────────────────────┐
│           Context System                         │
│  (Domain, Platform, Org, Project, etc.)         │
└─────────────┬───────────────────────────────────┘
              │
┌─────────────┴───────────────────────────────────┐
│           Overlay System                         │
│  (Org, Platform, Role customization)            │
└─────────────┬───────────────────────────────────┘
              │
┌─────────────┴───────────────────────────────────┐
│           Binding Layer                          │
│  (Claude Code, LangGraph, CrewAI, etc.)         │
└─────────────────────────────────────────────────┘
```

## The Concept System

Concepts are the building blocks of Faber. There are five core concept types:

### 1. Roles (Agents)

A **Role** defines a single AI agent with specific responsibilities.

**Structure:**
```
roles/issue-manager/
├── agent.yml          # Metadata and configuration
├── prompt.md          # Base prompt template
├── contexts/          # Role-specific contexts
│   ├── domain/
│   └── platform/
├── tasks/             # Reusable task definitions
│   ├── triage.md
│   └── assign.md
├── flows/             # Task flow definitions
│   └── issue-lifecycle.md
└── bindings/          # Framework-specific configs
    └── claude-code.yml
```

**agent.yml example:**
```yaml
org: acme
system: support
name: issue-manager
type: role
description: Manages and triages GitHub issues
platforms:
  - github-issues
  - linear
default_platform: github-issues
platform_config_key: github_config
color: "#2ea44f"
agent_type: autonomous
```

**Key properties:**
- `platforms` - Supported platforms (e.g., github-issues, slack)
- `default_platform` - Default if not specified
- `agent_type` - autonomous, interactive, or batch
- `color` - UI color hint

### 2. Teams

A **Team** coordinates multiple roles working together.

**team.yml example:**
```yaml
org: acme
system: support
name: support-team
type: team
description: Handles customer support across all channels
members:
  - role: issue-manager
    name: github-bot
    config:
      max_issues: 50
  - role: slack-responder
    name: support-bot
  - role: email-handler
    name: email-bot
coordination: parallel  # or: sequential, dynamic
leader: github-bot
workflows:
  - incident-response
  - feature-request-handling
```

**Coordination types:**
- `parallel` - All members work simultaneously
- `sequential` - Members work in order
- `dynamic` - Runtime coordination based on context

### 3. Tools

A **Tool** defines capabilities that agents can use.

**tool.yml example:**
```yaml
org: acme
system: support
name: github-api
type: tool
description: GitHub REST API integration
tool_type: api
mcp_server: true
protocols:
  - mcp
  - rest
command: node
args:
  - ./servers/github-mcp.js
env:
  GITHUB_TOKEN: ${GITHUB_TOKEN}
```

**Tool types:**
- `api` - REST/GraphQL APIs
- `mcp_server` - Model Context Protocol server
- `cli` - Command-line tool
- `sdk` - Language SDK
- `custom` - Custom integration

### 4. Workflows

A **Workflow** defines multi-stage processes that span teams.

**workflow.yml example:**
```yaml
org: acme
system: support
name: incident-response
type: workflow
description: Full incident response workflow from detection to resolution
stages:
  - name: detection
    team: monitoring-team
    entry_criteria:
      - "Alert severity >= high"
    tasks:
      - verify-alert
      - assess-impact
    exit_criteria:
      - "Impact assessed"
    on_failure:
      - escalate-to-oncall

  - name: triage
    team: support-team
    tasks:
      - classify-incident
      - determine-priority
      - notify-stakeholders

  - name: resolution
    team: engineering-team
    tasks:
      - investigate-root-cause
      - implement-fix
      - deploy-fix
      - verify-resolution

  - name: postmortem
    team: support-team
    tasks:
      - document-incident
      - update-runbook
      - share-learnings

teams:
  - monitoring-team
  - support-team
  - engineering-team

triggers:
  - type: event
    config:
      event: alert.critical
  - type: manual
    config:
      command: /incident

conditions:
  auto_escalate: true
  notification_channels:
    - slack://incidents
    - pagerduty://oncall
```

### 5. Evals

An **Eval** defines test scenarios to validate agent behavior.

**eval.yml example:**
```yaml
org: acme
system: support
name: issue-manager-evals
type: eval
description: Comprehensive tests for issue manager agent
targets:
  - issue-manager
scenarios:
  - name: triage-critical-bug
    description: Correctly identifies and prioritizes critical bugs
    inputs:
      issue_title: "Production database outage"
      issue_body: "Users cannot access the application. Database connection failing."
      issue_labels: []
    expected_outputs:
      labels:
        - bug
        - priority: critical
      assignee: oncall-engineer
      milestone: hotfix
    assertions:
      - "Issue labeled as 'bug' and 'priority: critical'"
      - "Assigned to on-call engineer"
      - "Added to hotfix milestone"
      - "Notification sent to #incidents channel"

  - name: handle-incomplete-issue
    description: Requests clarification for incomplete issues
    inputs:
      issue_title: "Feature not working"
      issue_body: "Please fix it"
    assertions:
      - "Asks for more details"
      - "Provides template or guidance"
      - "Does not close the issue"

  - name: identify-duplicate
    description: Detects and links duplicate issues
    inputs:
      issue_title: "Login button doesn't work"
      issue_body: "When I click login, nothing happens"
      existing_issues:
        - title: "Login form not responding"
          number: 42
          labels: ["bug", "frontend"]
    expected_outputs:
      comment: "Duplicate of #42"
      state: closed
      labels:
        - duplicate
    assertions:
      - "Links to original issue #42"
      - "Closes as duplicate"
      - "Adds 'duplicate' label"

metrics:
  - name: accuracy
    type: accuracy
    threshold: 0.95
  - name: response_time
    type: performance
    threshold: 5000  # ms

success_threshold: 90
platforms:
  - github-issues
```

## The Context System

Contexts are dynamic knowledge that gets loaded based on the situation. There are 7 context categories:

### Context Categories

#### 1. Domain Context
Industry or domain-specific knowledge.

```markdown
---
category: domain
name: software-engineering
description: Software development best practices
---

# Software Engineering Domain

## Development Practices
- Follow semantic versioning
- Write meaningful commit messages
- Review code before merging
- Maintain test coverage > 80%
```

**File location:** `contexts/domain/software-engineering.md`

#### 2. Platform Context
Platform-specific capabilities and conventions.

```markdown
---
category: platform
platform: github-issues
description: GitHub Issues API and conventions
---

# GitHub Issues Platform

## API Capabilities
- List, create, update issues
- Manage labels, milestones, assignees
- Add comments and reactions
- Close/reopen issues

## Rate Limits
- 5000 requests/hour for authenticated users
- Use conditional requests to save quota
```

**File location:** `contexts/platform/github-issues.md`

#### 3. Org Context
Organization-specific information and policies.

```markdown
---
category: org
name: acme-policies
description: ACME Corp policies and guidelines
---

# ACME Corp Guidelines

## Issue Triage Policy
- P0 (Critical): Response within 1 hour
- P1 (High): Response within 4 hours
- P2 (Medium): Response within 1 business day
- P3 (Low): Response within 1 week

## Escalation Path
1. Team lead
2. Engineering manager
3. VP Engineering
```

**File location:** `contexts/org/acme-policies.md`

#### 4. Project Context
Project-level information.

```markdown
---
category: project
name: web-app
description: Web application project context
---

# Web App Project

## Architecture
- React frontend
- Node.js backend
- PostgreSQL database
- Deployed on AWS

## Team
- Frontend: @alice, @bob
- Backend: @charlie, @david
- DevOps: @eve
```

**File location:** `contexts/project/web-app.md`

#### 5. Specialist Context
Deep expertise in specific areas.

```markdown
---
category: specialist
name: kubernetes-expert
description: Kubernetes deployment and troubleshooting
---

# Kubernetes Specialist

## Common Issues
- Pod CrashLoopBackOff: Check container logs
- ImagePullBackOff: Verify image exists and credentials
- OOMKilled: Increase memory limits

## Best Practices
- Use resource limits
- Implement health checks
- Use namespaces for isolation
```

**File location:** `contexts/specialist/kubernetes-expert.md`

#### 6. Task Context
Task-specific instructions.

```markdown
---
category: task
name: code-review
description: Code review guidelines
---

# Code Review Task

## Review Checklist
- [ ] Code follows style guide
- [ ] Tests are included
- [ ] Documentation is updated
- [ ] No security vulnerabilities
- [ ] Performance impact considered
```

**File location:** `contexts/task/code-review.md`

#### 7. Integration Context
Integration guides and examples.

```markdown
---
category: integration
name: github-slack
description: GitHub and Slack integration patterns
---

# GitHub + Slack Integration

## Event Handling
When an issue is created:
1. Post summary to #engineering channel
2. Include link and priority label
3. Mention relevant team if P0/P1

## Message Format
```
🐛 New issue: <title>
Priority: High
Link: <url>
CC: @team-leads
```
```

**File location:** `contexts/integration/github-slack.md`

### Context Loading

Contexts are loaded dynamically based on:
- **Role requirements** - Specified in agent.yml
- **Platform** - Automatically loads platform contexts
- **Organization** - Loads org-level contexts
- **Runtime context** - Project, task contexts as needed

## The Overlay System

Overlays allow customization without forking the base definitions.

### Overlay Types

#### Organization Overlays
Organization-wide customizations.

```
.faber/overlays/org/
└── contexts/
    ├── domain/
    └── org/
        └── company-policies.md
```

#### Platform Overlays
Platform-specific adaptations.

```
.faber/overlays/platforms/github/
├── contexts/
│   └── platform/
│       └── github-enterprise.md
└── config/
    └── rate-limits.yml
```

#### Role Overlays
Role-specific overrides.

```
.faber/overlays/roles/issue-manager/
├── contexts/
│   └── specialist/
│       └── security-focus.md
└── prompt-additions.md
```

### Overlay Resolution

Overlays are applied in this order (later overrides earlier):

1. Base definition
2. Organization overlay
3. Platform overlay
4. Role overlay
5. Runtime parameters

### Example: Multi-Org Setup

Base role in `roles/issue-manager/`:
```yaml
# agent.yml
name: issue-manager
type: role
description: Generic issue manager
```

ACME overlay in `.faber/overlays/org/acme/`:
```yaml
# config.yml
priority_levels:
  - p0: critical
  - p1: high
  - p2: medium
  - p3: low
response_times:
  p0: 1h
  p1: 4h
  p2: 1d
  p3: 1w
```

TechCorp overlay in `.faber/overlays/org/techcorp/`:
```yaml
# config.yml
priority_levels:
  - critical
  - important
  - normal
response_times:
  critical: 30m
  important: 2h
  normal: 2d
```

## The Binding System

Bindings transform Faber concepts to framework-specific formats.

### Built-in Bindings

#### Claude Code Binding
Transforms to Claude Code agent format.

**Output structure:**
```
deployments/claude/
├── agents/
│   └── issue-manager/
│       ├── agent.md          # Compiled prompt
│       └── config.json       # Agent configuration
└── contexts/
    └── ...                   # Flattened contexts
```

**CLI:**
```bash
faber build claude-code role issue-manager \
  --platform github \
  --output ./deployments
```

**API:**
```typescript
const artifact = await faber.build(
  'claude-code',
  ConceptType.ROLE,
  'issue-manager',
  { platform: 'github' }
);
```

### Custom Bindings

You can create custom bindings for other frameworks:

```typescript
import { BindingTransformer, Concept, Config, Overlays } from '@fractary/faber/bindings';

export class MyCustomBinding implements BindingTransformer {
  async transform(
    concept: Concept,
    config: Config,
    overlays?: Overlays
  ): Promise<DeploymentArtifact> {
    // Transform concept to your framework format
    const files = [];

    // Generate framework-specific files
    files.push({
      path: 'agent.py',
      content: this.generatePythonAgent(concept)
    });

    return {
      framework: 'my-framework',
      concept: concept.name,
      conceptType: concept.type,
      files,
      metadata: {
        version: '1.0',
        timestamp: new Date().toISOString(),
        config
      }
    };
  }

  async validate(concept: Concept): Promise<ValidationResult> {
    // Validate concept for your framework
    return {
      valid: true,
      errors: [],
      warnings: []
    };
  }

  getRequirements(): BindingRequirements {
    return {
      supportedConcepts: [ConceptType.ROLE, ConceptType.TEAM]
    };
  }
}
```

Register your binding:

```typescript
import { FaberAPI } from '@fractary/faber';
import { MyCustomBinding } from './my-binding';

const faber = new FaberAPI();
faber.registerBinding('my-framework', new MyCustomBinding());

// Use it
await faber.build('my-framework', ConceptType.ROLE, 'my-agent');
```

## Best Practices

### Organizing Concepts

1. **Keep roles focused** - One clear responsibility per role
2. **Share contexts** - Use shared contexts for common knowledge
3. **Use overlays** - Don't fork, use overlays for customization
4. **Version contexts** - Track context changes for consistency

### Naming Conventions

- **Roles**: `noun-action` (e.g., `issue-manager`, `code-reviewer`)
- **Teams**: `function-team` (e.g., `support-team`, `devops-team`)
- **Tools**: `service-type` (e.g., `github-api`, `slack-notifier`)
- **Workflows**: `process-name` (e.g., `incident-response`, `release-deployment`)
- **Contexts**: `descriptive-name` (e.g., `github-issues`, `kubernetes-expert`)

### Context Organization

- Keep contexts **small and focused**
- Use **meaningful frontmatter**
- Group related contexts
- Document context dependencies

### Testing Strategy

1. **Unit evals** - Test individual role capabilities
2. **Integration evals** - Test role interactions
3. **Workflow evals** - Test end-to-end workflows
4. **Platform evals** - Test platform-specific behavior

## Next Steps

- [CLI Reference](./cli.md) - Learn all CLI commands
- [API Reference](./api.md) - Explore the programmatic API
- [Getting Started](./getting-started.md) - Build your first agent
