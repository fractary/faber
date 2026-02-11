---
title: Core Concepts
description: Understanding FABER's philosophy, architecture, and key concepts
visibility: public
---

# Core Concepts

This guide explains the fundamental concepts that make FABER different from other automation tools.

## Philosophy: AI That Knows When to Ask

The fundamental insight behind FABER: **The value of AI automation is destroyed when humans become the bottleneck.**

Most AI systems fail by falling into one of two traps:

1. **Full autonomy**: AI operates without checks, makes expensive mistakes, enterprises won't adopt
2. **Full oversight**: Every action requires approval, human becomes bottleneck, defeats the purpose

FABER takes a different approach:

```
NOT: "Human approves every step"
NOT: "AI does everything unsupervised"
BUT: "AI operates autonomously WITHIN defined boundaries,
      escalates INTELLIGENTLY when boundaries are approached"
```

The key is **asymmetric human involvement**:
- 90% of work: AI autonomous, human informed (async)
- 10% of work: AI pauses, human decides (blocking)

The goal is knowing which 10% matters.

## The FABER Methodology

FABER is a structured workflow that acts as a forcing function for quality:

```
┌─────────────────────────────────────────────────────────────┐
│                    FABER Workflow                           │
├─────────┬───────────┬─────────┬────────────┬───────────────┤
│  Frame  │ Architect │  Build  │  Evaluate  │    Release    │
├─────────┼───────────┼─────────┼────────────┼───────────────┤
│ Under-  │  Plan     │  Impl-  │  Validate  │  Deliver      │
│ stand   │  before   │  ement  │  before    │  with         │
│ first   │  build    │  to     │  shipping  │  control      │
│         │           │  spec   │            │               │
└─────────┴───────────┴─────────┴────────────┴───────────────┘
```

### Why Each Phase Matters

| Phase | Without It | With It |
|-------|-----------|---------|
| **Frame** | AI jumps to solutions without understanding | AI understands the actual problem first |
| **Architect** | Implementation chaos, no plan | Considered design, edge cases identified |
| **Build** | Unstructured coding, scope creep | Spec-driven development, constrained creativity |
| **Evaluate** | Ship and pray | Validated deliverables, issues caught early |
| **Release** | Surprise production issues | Controlled rollout, proper reviews |

The methodology IS a guardrail. You can't skip steps.

### Phase Details

| Phase | Purpose | Key Activities |
|-------|---------|----------------|
| **Frame** | Understand what needs to be done | Fetch issue, classify work type, gather context |
| **Architect** | Plan the solution | Create/update spec, validate completeness, refine |
| **Build** | Implement the solution | Create branch, write code, make commits |
| **Evaluate** | Verify the solution | Run tests, validate against spec, review |
| **Release** | Deliver the solution | Push changes, create PR, request reviews |

## Three Layers of Guardrails

FABER provides three types of protection that work together:

### Layer 1: Structural Guardrails (Methodology)

The FABER methodology itself prevents chaos:
- Phases cannot be skipped
- Each phase has entry/exit criteria
- Outputs are validated before proceeding
- Process prevents chaos through structure

### Layer 2: Boundary Guardrails (Hard Limits)

Non-negotiable limits defined by policy:
- Production deployments always require approval
- Cost thresholds that trigger escalation
- Security-sensitive operations (credentials, permissions)
- Destructive operations (delete, force push)

These are configurable but absolute—the AI cannot cross them.

### Layer 3: Intelligent Guardrails (AI Reasoning)

The AI evaluates its own state to make escalation decisions:

| Factor | Question |
|--------|----------|
| **Confidence** | How sure am I about this action? |
| **Risk** | What's the downside if I'm wrong? |
| **Reversibility** | Can this action be undone? |
| **Precedent** | Have I done this successfully before? |

The decision matrix:

```
                 Low Risk              High Risk
               ────────────────────────────────────
              │                │                   │
High          │   PROCEED      │   PROCEED         │
Confidence    │   (silent)     │   + NOTIFY        │
              │                │                   │
              ├────────────────┼───────────────────┤
              │                │                   │
Low           │   PROCEED      │   ESCALATE        │
Confidence    │   + NOTIFY     │   (block)         │
              │                │                   │
               ────────────────────────────────────
```

See [Intelligent Guardrails](./guardrails.md) for full details.

## Earned Autonomy

Trust is earned, not assumed. The system starts conservative and earns autonomy over time based on demonstrated success.

### The Progression

```
Day 1: Supervised
├── All actions require confirmation
├── AI learns patterns and preferences
└── Success/failure tracking begins

Week 2-4: Assisted
├── Low-risk actions proceed with notification
├── Medium-risk actions still confirmed
└── Autonomy expands for proven-safe action types

Month 2+: Guarded
├── Most actions proceed autonomously
├── Only high-risk/novel situations escalate
└── Human involvement drops to ~10%

Mature: Autonomous
├── AI operates within established boundaries
├── Novel situations trigger automatic escalation
└── Human oversight is strategic, not tactical
```

### What the System Learns

- Which action types succeed consistently
- Which situations require human judgment
- Individual risk tolerances
- Domain-specific patterns

### Expansion Criteria

Autonomy expands when:
- Sufficient successful executions (default: 10+)
- High success rate maintained (default: 95%+)
- Minimum time at current level (default: 7 days)
- No recent failures

Autonomy contracts when failures occur, ensuring the system remains safe.

## Autonomy Levels

Four levels control the balance between automation and human oversight:

### dry-run

No changes made. Preview what would happen.

```typescript
const result = await faber.run({
  workId: '123',
  autonomy: 'dry-run',
});
// result.phases will show { dryRun: true, message: "Would create branch..." }
```

Use for: Testing workflows, understanding impact, demonstrations.

### assisted

Pauses at each significant step for user confirmation.

```typescript
faber.setUserInputCallback(async (request) => {
  console.log(request.message);
  return await askUser('Proceed? (yes/no)') === 'yes';
});

await faber.run({ workId: '123', autonomy: 'assisted' });
```

Use for: New workflows, learning phase, high-stakes work.

### guarded

Automatic for safe operations, confirms for potentially destructive actions:
- Branch deletion
- Force push
- PR creation/merge
- Closing issues
- Production operations

Use for: Established workflows where you trust routine operations.

### autonomous

Runs to completion without user interaction, within established boundaries.

```typescript
await faber.run({ workId: '123', autonomy: 'autonomous' });
```

Use for: Mature deployments, well-understood work types, background automation.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FaberWorkflow                            │
│                (Orchestration Layer)                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              GuardrailEngine                          │  │
│  │    Confidence + Risk Assessment → Decision            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Work   │  │   Repo   │  │   Spec   │  │   Logs   │   │
│  │ Manager  │  │ Manager  │  │ Manager  │  │ Manager  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │             │          │
│  ┌────┴─────┐  ┌────┴─────┐      │             │          │
│  │Providers │  │Providers │      │             │          │
│  │ GitHub   │  │ GitHub   │      │             │          │
│  │ Jira*    │  │ GitLab*  │      │             │          │
│  │ Linear*  │  │Bitbucket*│      │             │          │
│  └──────────┘  └──────────┘      │             │          │
│                                   │             │          │
├─────────────────────────────────────────────────────────────┤
│                    StateManager                             │
│              (Persistence & Recovery)                       │
└─────────────────────────────────────────────────────────────┘
```

*Stub implementations

## Modules

### WorkManager

Unified interface for work tracking across platforms.

```typescript
import { WorkManager } from '@fractary/faber/work';

const work = new WorkManager();

// Platform-agnostic operations
const issue = await work.fetchIssue(123);
await work.addLabels(123, ['bug', 'priority:high']);
const workType = await work.classifyWorkType(issue);
```

**Supported Platforms:**
- GitHub Issues (fully implemented)
- Jira (stub - interface only)
- Linear (stub - interface only)

### RepoManager

Git and repository operations with platform abstraction.

```typescript
import { RepoManager } from '@fractary/faber/repo';

const repo = new RepoManager();

// Branch operations
await repo.createBranch('feature/add-auth');
const branches = await repo.listBranches({ merged: true });

// PR operations
const pr = await repo.createPR({
  title: 'Add authentication',
  head: 'feature/add-auth',
});

// Git operations
repo.commit({ message: 'Add login form', type: 'feat' });
repo.push({ setUpstream: true });
```

### SpecManager

Specification creation, validation, and refinement.

```typescript
import { SpecManager } from '@fractary/faber/spec';

const spec = new SpecManager();

// Create from template
const newSpec = spec.createSpec('Add OAuth support', {
  template: 'feature',
  workId: '123',
});

// Validate
const validation = spec.validateSpec(newSpec.id);

// Refine
const questions = spec.generateRefinementQuestions(newSpec.id);
spec.applyRefinements(newSpec.id, {
  'auth-method': 'OAuth 2.0 with PKCE',
});
```

**Templates:**
- `basic` - Minimal spec structure
- `feature` - New feature implementation
- `bug` - Bug fix with reproduction steps
- `infrastructure` - Infrastructure changes
- `api` - API design and changes

### StateManager

Workflow state persistence and recovery.

```typescript
import { StateManager } from '@fractary/faber/state';

const state = new StateManager();

// Create workflow state
const workflow = state.createWorkflow('123');

// Track phases
state.startPhase(workflow.workflow_id, 'frame');
state.completePhase(workflow.workflow_id, 'frame', { workType: 'feature' });

// Checkpoints for recovery
state.createCheckpoint(workflow.workflow_id, 'before-build');
state.restoreFromCheckpoint(workflow.workflow_id, 'before-build');
```

### FaberWorkflow

Orchestrates the complete FABER workflow.

```typescript
import { FaberWorkflow } from '@fractary/faber/workflow';

const faber = new FaberWorkflow({
  config: {
    autonomy: 'assisted',
    phases: {
      frame: { enabled: true },
      architect: { enabled: true, refineSpec: true },
      build: { enabled: true },
      evaluate: { enabled: true, maxRetries: 3 },
      release: { enabled: true, requestReviews: true },
    },
  },
});

const result = await faber.run({ workId: '123' });
```

## Configuration

FABER uses a unified YAML configuration file at `.fractary/config.yaml`.

### Directory Structure

```
.fractary/
├── config.yaml              # Unified configuration (GitHub, Anthropic, FABER)
└── faber/
    ├── workflows/           # Workflow definitions
    │   ├── workflows.yaml   # Workflow manifest
    │   └── default.yaml     # Default workflow config
    └── runs/                # Run artifacts
```

### Example Configuration

```yaml
version: "2.0"
github:
  organization: your-org
  project: your-repo
  app:
    id: "12345"
    installation_id: "67890"
    private_key_path: ~/.github/faber-your-org.pem
anthropic:
  api_key: ${ANTHROPIC_API_KEY}
faber:
  workflows:
    path: .fractary/faber/workflows
    default: default
    autonomy: guarded
  runs:
    path: .fractary/faber/runs
```

See [Configuration Guide](../guides/configuration.md) for full details.

## Event System

Subscribe to workflow events for monitoring and integration:

```typescript
faber.addEventListener((event, data) => {
  switch (event) {
    case 'workflow:start':
      console.log('Starting:', data.workflowId);
      break;
    case 'phase:start':
      console.log('Phase:', data.phase);
      break;
    case 'guardrail:escalate':
      console.log('Escalation:', data.reason);
      break;
    case 'workflow:complete':
      console.log('Done:', data.status);
      break;
  }
});
```

**Available Events:**
- `workflow:start` - Workflow begins
- `workflow:complete` - Workflow finishes successfully
- `workflow:fail` - Workflow fails
- `workflow:pause` - Workflow paused for input
- `phase:start` - Phase begins
- `phase:complete` - Phase completes
- `guardrail:check` - Guardrail evaluation
- `guardrail:escalate` - Escalation triggered
- `artifact:create` - Artifact created (spec, branch, PR)

## Error Handling

The SDK provides typed errors:

```typescript
import {
  FaberError,           // Base class
  ConfigurationError,   // Invalid config
  ProviderError,        // Platform API errors
  WorkflowError,        // Workflow execution errors
  GuardrailViolation,   // Boundary guardrail crossed
  IssueNotFoundError,   // Issue not found
  BranchExistsError,    // Branch already exists
} from '@fractary/faber';

try {
  await work.fetchIssue(999999);
} catch (error) {
  if (error instanceof IssueNotFoundError) {
    console.log('Issue does not exist');
  }
}
```

## Next Steps

- [Getting Started](./getting-started.md) - Installation and first steps
- [Intelligent Guardrails](./guardrails.md) - Deep dive into the autonomy system
- [CLI Reference](./cli.md) - Command-line interface
- [API Reference](./api.md) - Full API documentation
