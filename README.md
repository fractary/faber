# @fractary/faber

> AI-native workflow automation that runs in production

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/typescript-5.3.3-blue)](https://www.typescriptlang.org/)

## ⚠️ Migration Notice

**Python agent/tool definitions are being migrated to [@fractary/forge](https://github.com/fractary/forge).**

Starting with FABER v1.x, agent and tool definitions will be managed by Forge:
- **v1.x**: Dual-mode support (legacy Python + Forge TypeScript)
- **v2.0**: Forge required, Python definitions removed

For migration instructions, see [docs/MIGRATION-FABER-FORGE.md](docs/MIGRATION-FABER-FORGE.md).

---

## Repository Structure

This is a monorepo containing JavaScript and Python SDKs, plus the CLI:

```
faber/
├── cli/                     # CLI (@fractary/faber-cli)
│   ├── src/                # TypeScript source
│   ├── dist/               # Compiled output
│   └── package.json        # @fractary/faber-cli
├── sdk/
│   ├── js/                 # JavaScript/TypeScript SDK
│   │   ├── src/           # TypeScript source
│   │   ├── dist/          # Compiled output
│   │   └── package.json   # @fractary/faber (v2.0+)
│   └── py/                # Python SDK
│       ├── faber/         # Python package
│       ├── tests/         # Python tests
│       └── pyproject.toml # faber
├── specs/                 # Design specifications
├── docs/                  # Documentation
└── package.json           # Monorepo root
```

### Development

**CLI:**
```bash
npm run build:cli    # Build CLI
npm run test:cli     # Test CLI
npm run lint:cli     # Lint CLI
```

**JavaScript SDK:**
```bash
npm run build:js     # Build SDK
npm run test:js      # Test SDK
npm run lint:js      # Lint SDK
```

**Python SDK:**
```bash
cd sdk/py
pip install -e ".[dev]"
pytest
```

**Run all builds:**
```bash
# From root
npm run build
npm run test
npm run lint
```

---

## What is FABER?

**FABER enables AI agents to do meaningful work autonomously while knowing exactly when to involve humans.**

Unlike simple automation tools that chain API calls, FABER orchestrates AI agents that actually reason about your work. Unlike raw AI frameworks, FABER provides the guardrails enterprises need to deploy with confidence.

```
From issue to PR, autonomously.
```

### The Problem

| Approach | What Happens |
|----------|--------------|
| **Deterministic Automation** (Zapier, Make) | Works for simple tasks, breaks when reasoning is required |
| **Raw AI Agents** (LangGraph, AutoGen) | Powerful but unpredictable—enterprises won't adopt |
| **AI + Approve Everything** | Human becomes the bottleneck, defeats the purpose |

### The FABER Solution

FABER takes a different approach: **AI operates autonomously within defined boundaries, escalates intelligently when boundaries are approached.**

- **Structural Guardrails**: The FABER methodology (Frame → Architect → Build → Evaluate → Release) prevents chaos through process
- **Boundary Guardrails**: Hard limits the AI cannot cross (production deploys, cost thresholds)
- **Intelligent Guardrails**: AI reasons about its own confidence and risk, deciding when to proceed vs. escalate

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

Every workflow follows five phases:

| Phase | Purpose |
|-------|---------|
| **Frame** | Understand the problem before acting |
| **Architect** | Plan the approach before building |
| **Build** | Implement to specification |
| **Evaluate** | Validate before shipping |
| **Release** | Controlled delivery |

### Earned Autonomy

Trust is earned, not assumed:

1. **Day 1**: Conservative—more human checkpoints
2. **Week 4**: Established patterns—less intervention needed
3. **Month 6**: Mature—90% autonomous, 10% escalation

### Autonomy Levels

| Level | Description |
|-------|-------------|
| `dry-run` | Preview changes without executing |
| `assisted` | Pause for user confirmation at each step |
| `guarded` | Confirm destructive operations only |
| `autonomous` | Execute within established boundaries |

## Installation

```bash
npm install @fractary/faber
```

## Quick Start

### CLI Workflow (Recommended)

FABER uses a two-phase approach: **plan** (CLI) + **execute** (Claude Code):

```bash
# 1. Plan workflow (creates plan, branch, worktree)
faber plan --work-id 258

# 2. Execute workflow (in Claude Code session)
cd ~/.claude-worktrees/fractary-myproject-258
claude
/fractary-faber:workflow-run 258
```

**Batch Planning:**
```bash
# Plan multiple workflows at once
faber plan --work-id 258,259,260

# Or search by labels
faber plan --work-label "workflow:etl,status:approved"
```

**Benefits:**
- ✅ Plan 10+ workflows in one command
- ✅ Each workflow runs in isolated worktree
- ✅ Parallel execution across multiple Claude sessions
- ✅ Claude focuses only on execution (no planning confusion)

### SDK Usage

```typescript
import { FaberWorkflow } from '@fractary/faber';

// Run a complete FABER workflow
const workflow = new FaberWorkflow();
const result = await workflow.run({
  workId: '123',
  autonomy: 'assisted'
});
```

### Additional CLI Commands

```bash
# Check workflow status
fractary-faber workflow-status --work-id 258

# Manage work items
fractary-faber work issue fetch 123
fractary-faber work comment create 123 --body "Starting"

# Repository operations
fractary-faber repo branch create feat/fix-123
fractary-faber repo pr create "Fix issue" --body "Resolves #123"
```

See [CLI README](cli/README.md) for comprehensive documentation.

## SDK Modules

The FABER SDK provides modular primitives for building AI-powered workflows:

| Module | Purpose | Import |
|--------|---------|--------|
| **Work** | Issue tracking (GitHub, Jira, Linear) | `@fractary/faber/work` |
| **Repo** | Git & PRs (GitHub, GitLab, Bitbucket) | `@fractary/faber/repo` |
| **Spec** | Specification management | `@fractary/faber/spec` |
| **State** | Workflow persistence & checkpoints | `@fractary/faber/state` |
| **Logs** | Session capture & audit trails | `@fractary/faber/logs` |
| **Storage** | Artifact storage with Codex integration | `@fractary/faber/storage` |
| **Workflow** | Full FABER orchestration | `@fractary/faber/workflow` |

### Work Module

```typescript
import { WorkManager } from '@fractary/faber/work';

const work = new WorkManager();
const issue = await work.fetchIssue(123);
await work.createComment(123, 'Starting implementation');
const workType = await work.classifyWorkType(issue); // 'feature' | 'bug' | 'chore'
```

### Repo Module

```typescript
import { RepoManager } from '@fractary/faber/repo';

const repo = new RepoManager();
await repo.createBranch('feature/add-export', { base: 'main' });
await repo.createPR({ title: 'Add export feature', head: 'feature/add-export' });
await repo.commit({ message: 'Add feature', type: 'feat' });
```

### Workflow Module

```typescript
import { FaberWorkflow } from '@fractary/faber/workflow';

const faber = new FaberWorkflow({
  config: {
    autonomy: 'guarded',
    phases: {
      frame: { enabled: true },
      architect: { enabled: true, refineSpec: true },
      build: { enabled: true },
      evaluate: { enabled: true, maxRetries: 3 },
      release: { enabled: true, requestReviews: true },
    },
  },
});

// Event handling
faber.addEventListener((event, data) => {
  console.log(`${event}:`, data);
});

// Run workflow
const result = await faber.run({ workId: '123' });
```

## CLI Commands

For comprehensive CLI documentation, see [@fractary/faber-cli](cli/README.md).

Quick reference:

```bash
# Workflow
fractary-faber init                                  # Initialize project
fractary-faber run --work-id <issue>                # Run workflow
fractary-faber status                               # Check status
fractary-faber resume <workflow-id>                 # Resume workflow

# Work tracking
fractary-faber work issue fetch <issue>
fractary-faber work issue create --title "Feature"
fractary-faber work comment create <issue> --body "Update"
fractary-faber work label add <issue> --label "bug"

# Repository
fractary-faber repo branch create <name>
fractary-faber repo pr create --title "Title"
fractary-faber repo commit "feat: message"
fractary-faber repo tag create v1.0.0

# Specifications
fractary-faber spec create "Title"
fractary-faber spec validate <spec-id>
fractary-faber spec refine <spec-id>

# Logs
fractary-faber logs capture <workflow-id>
fractary-faber logs read <session-id>
```

## Configuration

Configuration is stored in `.fractary/plugins/{module}/config.json`:

```
.fractary/
└── plugins/
    ├── work/config.json
    ├── repo/config.json
    └── ...
```

Example work configuration:

```json
{
  "platform": "github",
  "owner": "your-org",
  "repo": "your-repo"
}
```

## Platform Support

| Platform | Work Tracking | Repository |
|----------|--------------|------------|
| GitHub | Full | Full |
| Jira | Planned | - |
| Linear | Planned | - |
| GitLab | - | Planned |
| Bitbucket | - | Planned |

## Documentation

### Getting Started
- [Getting Started Guide](docs/public/getting-started.md) - Installation and first steps
- [Core Concepts](docs/public/concepts.md) - FABER methodology and architecture
- [Guardrails System](docs/public/guardrails.md) - Three layers of safety

### Guides
- [API Reference](docs/guides/api-reference.md) - Complete SDK API documentation (TypeScript & Python)
- [CLI Integration](docs/guides/cli-integration.md) - CLI usage patterns and integration
- [Configuration](docs/guides/configuration.md) - Complete configuration reference
- [Troubleshooting](docs/guides/troubleshooting.md) - Common issues and solutions

### Examples
- [Code Examples](docs/examples/README.md) - Runnable TypeScript and Python examples
  - Simple Workflow - Basic workflow execution
  - Work Tracking - Issue and PR automation
  - Repository Automation - Branch and PR management
  - And more...

### Component Documentation
- [CLI Reference](cli/README.md) - Command-line interface
- [MCP Server](mcp/server/README.md) - Model Context Protocol integration
- [Python SDK](sdk/py/README.md) - Python SDK guide

### Technical Specifications
- [SDK Architecture](specs/SPEC-00016-sdk-architecture.md) - Technical architecture overview
- [LangGraph Integration](specs/SPEC-00025-langgraph-integration.md) - Graph-based workflow orchestration
- [Intelligent Guardrails](specs/SPEC-00028-intelligent-guardrails.md) - Confidence-based autonomy system
- [Multi-Workflow Orchestration](specs/SPEC-00027-multi-workflow-orchestration.md) | DAC foundation

### Vision & Strategy
- [FABER Vision](docs/vision/FABER-VISION.md) - Mission, philosophy, and strategic positioning

## Type Exports

All types are exported for TypeScript consumers:

```typescript
import type {
  // Workflow
  WorkflowConfig, WorkflowResult, PhaseResult, FaberPhase, AutonomyLevel,

  // Work
  Issue, IssueCreateOptions, Comment, Label, WorkType,

  // Repo
  PullRequest, PRCreateOptions, Branch, BranchCreateOptions,

  // Spec
  Specification, SpecTemplate, ValidationResult,
} from '@fractary/faber';
```

## License

MIT - see [LICENSE](LICENSE) for details.

---

**Part of the [Fractary](https://fractary.dev) Ecosystem**
