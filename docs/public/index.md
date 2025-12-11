---
title: Faber SDK Documentation
description: FABER workflow toolkit for AI-assisted software development
visibility: public
---

# Faber SDK

> FABER Workflow Toolkit for AI-Assisted Development

Faber is a TypeScript SDK that powers the **FABER workflow methodology**: **Frame → Architect → Build → Evaluate → Release**. It provides unified APIs for work tracking, repository operations, specifications, session logging, state management, and workflow orchestration.

## What is FABER?

FABER is a structured approach to AI-assisted software development:

| Phase | Purpose |
|-------|---------|
| **Frame** | Gather requirements from issues and conversations |
| **Architect** | Create and refine specifications |
| **Build** | Implement the solution with proper branching |
| **Evaluate** | Validate against requirements |
| **Release** | Create PRs and request reviews |

The SDK provides the tools to automate and orchestrate each phase.

## Key Features

### Multi-Platform Support
- **Work Tracking**: GitHub Issues, Jira*, Linear*
- **Repository Operations**: GitHub, GitLab*, Bitbucket*
- **Git Operations**: Branching, commits, worktrees

*\*Stub implementations - interface defined, full implementation planned*

### Autonomy Levels
Control how much automation you want:

| Level | Behavior |
|-------|----------|
| `dry-run` | Preview changes without executing |
| `assisted` | Pause for confirmation at each step |
| `guarded` | Confirm destructive operations only |
| `autonomous` | Execute without confirmation |

### Workflow Orchestration
- Full FABER phase execution
- Event-driven architecture
- State persistence and recovery
- Checkpoint/rollback support

### Developer Experience
- Full TypeScript support
- Comprehensive type exports
- Zod schema validation
- CLI included for quick usage

## Installation

```bash
npm install @fractary/faber
```

## Quick Start

```typescript
import { WorkManager, RepoManager, FaberWorkflow } from '@fractary/faber';

// Fetch an issue
const work = new WorkManager();
const issue = await work.fetchIssue(123);

// Create a branch
const repo = new RepoManager();
await repo.createBranch('feature/add-export');

// Run full FABER workflow
const faber = new FaberWorkflow();
const result = await faber.run({
  workId: '123',
  autonomy: 'assisted',
});
```

## Modules

| Module | Description |
|--------|-------------|
| [`work`](./modules/work.md) | Multi-platform work tracking |
| [`repo`](./modules/repo.md) | Git and repository operations |
| [`spec`](./modules/spec.md) | Specification management |
| [`logs`](./modules/logs.md) | Session capture and logging |
| [`state`](./modules/state.md) | Workflow state persistence |
| [`workflow`](./modules/workflow.md) | FABER orchestration |
| [`storage`](./modules/storage.md) | Artifact storage |

## CLI Usage

The SDK includes a CLI for quick access:

```bash
# Work tracking
fractary work fetch 123
fractary work create --title "New feature"
fractary work classify 123

# Repository operations
fractary repo branch create feature/new-feature
fractary repo pr create --title "Add feature"

# Specifications
fractary spec create "Add authentication" --template feature
fractary spec validate SPEC-001

# FABER workflow
fractary workflow run 123 --autonomy assisted
```

## Documentation

- [Getting Started](./getting-started.md) - Installation and first steps
- [Concepts](./concepts.md) - Core concepts and architecture
- [CLI Reference](./cli.md) - Command-line interface
- [API Reference](./api.md) - Programmatic API

## Configuration

Configuration files are stored at `.fractary/plugins/{module}/config.json`:

```json
{
  "platform": "github",
  "owner": "your-org",
  "repo": "your-repo"
}
```

See [Configuration Guide](./concepts.md#configuration) for details.

## Community & Support

- **Documentation**: [developers.fractary.com](https://developers.fractary.com)
- **GitHub**: [github.com/fractary/faber](https://github.com/fractary/faber)
- **Issues**: [github.com/fractary/faber/issues](https://github.com/fractary/faber/issues)
- **npm**: [@fractary/faber](https://www.npmjs.com/package/@fractary/faber)

## License

MIT - see [LICENSE](https://github.com/fractary/faber/blob/main/LICENSE) for details.
