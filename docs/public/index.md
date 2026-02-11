---
title: Faber SDK Documentation
description: AI-native workflow automation that runs in production
visibility: public
---

# Faber SDK

> AI-native workflow automation that runs in production

Faber enables AI agents to do meaningful work autonomously while knowing exactly when to involve humans. Unlike simple automation tools that chain API calls, FABER orchestrates AI agents that actually reason about your work. Unlike raw AI frameworks, FABER provides the guardrails enterprises need to deploy with confidence.

## The Problem

| Approach | What Happens |
|----------|--------------|
| **Deterministic Automation** (Zapier, Make) | Works for simple tasks, breaks when reasoning is required |
| **Raw AI Agents** (LangGraph, AutoGen) | Powerful but unpredictable—enterprises won't adopt |
| **AI + Approve Everything** | Human becomes the bottleneck, defeats the purpose |

## The FABER Solution

FABER takes a different approach: **AI operates autonomously within defined boundaries, escalates intelligently when boundaries are approached.**

```
From issue to PR, autonomously.
```

The result: 90% autonomous operation, 10% human involvement—focused on decisions that actually matter.

## Who is FABER For?

### Development Teams
Automate complex development tasks—from understanding an issue to shipping a PR. Focus on interesting problems while AI handles the routine work.

### Technical Operations
Automated incident response, deployment pipelines, and infrastructure changes with human oversight on critical decisions.

### Platform Engineers
Build AI-powered workflows that your entire organization can use, with the safety and observability enterprises require.

## Key Concepts

### The FABER Methodology

Every workflow follows five structured phases:

| Phase | Purpose |
|-------|---------|
| **Frame** | Understand the problem before acting |
| **Architect** | Plan the approach before building |
| **Build** | Implement to specification |
| **Evaluate** | Validate before shipping |
| **Release** | Controlled delivery |

### Three Layers of Protection

- **Structural Guardrails**: The FABER methodology itself prevents chaos through process
- **Boundary Guardrails**: Hard limits the AI cannot cross (production deploys, cost thresholds)
- **Intelligent Guardrails**: AI reasons about its own confidence and risk, deciding when to proceed vs. escalate

### Earned Autonomy

Trust is earned, not assumed:

1. **Day 1**: Conservative—more human checkpoints, AI learns patterns
2. **Week 4**: Established patterns—less intervention for known situations
3. **Month 6**: Mature—90% autonomous, 10% escalation on genuinely novel situations

### Autonomy Levels

| Level | Behavior |
|-------|----------|
| `dry-run` | Preview changes without executing |
| `assisted` | Pause for confirmation at each step |
| `guarded` | Confirm destructive operations only |
| `autonomous` | Execute within established boundaries |

## Installation

```bash
npm install @fractary/faber
```

## Quick Start

```typescript
import { FaberWorkflow } from '@fractary/faber';

// Run a complete FABER workflow
const workflow = new FaberWorkflow();
const result = await workflow.run({
  workId: '123',
  autonomy: 'assisted'
});
```

Or use the CLI:

```bash
# Run workflow for issue #123
fractary-faber workflow-run --work-id 123 --autonomy assisted

# Check status
fractary-faber run-inspect --work-id 123
```

## SDK Modules

| Module | Purpose |
|--------|---------|
| [`work`](./api.md#work-module) | Multi-platform work tracking (GitHub, Jira, Linear) |
| [`repo`](./api.md#repo-module) | Git and repository operations (GitHub, GitLab, Bitbucket) |
| [`spec`](./api.md#spec-module) | Specification management |
| [`logs`](./api.md#logs-module) | Session capture and logging |
| [`state`](./api.md#state-module) | Workflow state persistence |
| [`workflow`](./api.md#workflow-module) | FABER orchestration |
| [`storage`](./api.md#storage-module) | Artifact storage |

## Platform Support

| Platform | Work Tracking | Repository |
|----------|--------------|------------|
| GitHub | Full | Full |
| Jira | Planned | - |
| Linear | Planned | - |
| GitLab | - | Planned |
| Bitbucket | - | Planned |

## Documentation

- [Getting Started](./getting-started.md) - Installation and first steps
- [Core Concepts](./concepts.md) - Architecture and key concepts
- [Intelligent Guardrails](./guardrails.md) - Autonomy and safety model
- [CLI Reference](./cli.md) - Command-line interface
- [Plugin Reference](./plugin-reference.md) - Plugin commands and agents
- [API Reference](./api.md) - Programmatic API

## Community & Support

- **Documentation**: [developers.fractary.com](https://developers.fractary.com)
- **GitHub**: [github.com/fractary/faber](https://github.com/fractary/faber)
- **Issues**: [github.com/fractary/faber/issues](https://github.com/fractary/faber/issues)
- **npm**: [@fractary/faber](https://www.npmjs.com/package/@fractary/faber)

## License

MIT - see [LICENSE](https://github.com/fractary/faber/blob/main/LICENSE) for details.
