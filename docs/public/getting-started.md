---
title: Getting Started with Faber
description: Installation and first steps with the FABER SDK
visibility: public
---

# Getting Started

This guide walks you through installing the Faber SDK and running your first AI-powered development workflow.

FABER enables AI agents to do meaningful work autonomously while knowing exactly when to involve humans. By the end of this guide, you'll have FABER configured and ready to automate development tasks.

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **yarn**
- **Git** installed and configured
- **GitHub CLI** (`gh`) for GitHub operations

## Installation

### SDK Installation

```bash
npm install @fractary/faber
```

### Global CLI (Optional)

```bash
npm install -g @fractary/faber-cli

# Verify installation
fractary-faber --version
```

## Configuration

FABER uses a unified configuration file at `.fractary/config.yaml`.

### Quick Setup

```bash
# Auto-initialize configuration
fractary-faber configure

# Or use config init with options
fractary-faber config init --autonomy guarded
```

### Manual Configuration

Create `.fractary/config.yaml`:

```yaml
github:
  organization: your-org
  project: your-repo

faber:
  workflows:
    path: .fractary/faber/workflows
    default: default
    autonomy: guarded
  runs:
    path: .fractary/faber/runs
```

## Basic Usage

### Work Tracking

```typescript
import { WorkManager } from '@fractary/faber/work';

const work = new WorkManager();

// Fetch an issue
const issue = await work.fetchIssue(123);
console.log(issue.title, issue.state);

// Create an issue
const newIssue = await work.createIssue({
  title: 'Add CSV export feature',
  body: 'Users need to export data as CSV',
  labels: ['enhancement'],
});

// Add a comment
await work.createComment(123, 'Starting implementation');

// Close when done
await work.closeIssue(123);
```

### Repository Operations

```typescript
import { RepoManager } from '@fractary/faber/repo';

const repo = new RepoManager();

// Create a feature branch
await repo.createBranch('feature/add-export', { base: 'main' });

// Make commits
repo.commit({
  message: 'Add CSV export functionality',
  type: 'feat',
});

// Push to remote
repo.push({ branch: 'feature/add-export', setUpstream: true });

// Create a pull request
const pr = await repo.createPR({
  title: 'Add CSV export feature',
  body: 'Implements CSV export for user data',
  head: 'feature/add-export',
  base: 'main',
});
```

### Specifications

```typescript
import { SpecManager } from '@fractary/faber/spec';

const spec = new SpecManager();

// Create a spec from template
const newSpec = spec.createSpec('Add user authentication', {
  template: 'feature',
  workId: '123',
});

// Validate completeness
const validation = spec.validateSpec(newSpec.id);
if (validation.status !== 'pass') {
  console.log('Issues:', validation.suggestions);
}

// Get refinement questions
const questions = spec.generateRefinementQuestions(newSpec.id);
```

### Full FABER Workflow

```typescript
import { FaberWorkflow } from '@fractary/faber/workflow';

const faber = new FaberWorkflow({
  config: {
    autonomy: 'assisted',
  },
});

// Listen to events
faber.addEventListener((event, data) => {
  console.log(`${event}:`, data);
});

// Run the workflow
const result = await faber.run({
  workId: '123',
  autonomy: 'assisted',
});

console.log('Status:', result.status);
console.log('Phases:', result.phases.map(p => `${p.phase}: ${p.status}`));
```

## CLI Usage

### Work Commands

```bash
# Fetch issue details
fractary-faber work issue fetch 123

# Create a new issue
fractary-faber work issue create --title "Add feature"

# Add a comment
fractary-faber work comment create 123 --body "Progress update"

# Close an issue
fractary-faber work issue close 123
```

### Repository Commands

```bash
# Create a branch
fractary-faber repo branch create feature/new-feature

# List branches
fractary-faber repo branch list

# Create a PR
fractary-faber repo pr create "Add feature" --body "Description"

# Commit changes
fractary-faber repo commit "feat: add feature"
```

### Workflow Commands

```bash
# Plan a workflow
fractary-faber workflow-plan --work-id 123

# Run FABER workflow
fractary-faber workflow-run --work-id 123

# Check status
fractary-faber run-inspect --work-id 123

# Resume paused workflow
fractary-faber workflow-resume <workflow-id>
```

## Autonomy Levels

Control how much human oversight you want:

### dry-run
Preview what would happen without making changes:

```typescript
const result = await faber.run({
  workId: '123',
  autonomy: 'dry-run',
});
// Shows what would be created/modified
```

### assisted
Pause at each step for confirmation:

```typescript
faber.setUserInputCallback(async (request) => {
  const answer = await promptUser(request.message);
  return answer === 'yes';
});

await faber.run({ workId: '123', autonomy: 'assisted' });
```

### guarded
Only confirm destructive operations:

```typescript
await faber.run({ workId: '123', autonomy: 'guarded' });
// Auto-proceeds except for deletions, force pushes, etc.
```

### autonomous
Full automation without confirmation:

```typescript
await faber.run({ workId: '123', autonomy: 'autonomous' });
// Runs to completion automatically
```

## Project Structure

Recommended project structure:

```
your-project/
├── .fractary/
│   ├── config.yaml              # Unified configuration
│   └── faber/
│       ├── workflows/           # Workflow definitions
│       │   ├── workflows.yaml   # Workflow manifest
│       │   └── default.yaml     # Default workflow
│       └── runs/                # Run artifacts (auto-generated)
├── specs/                       # Specification files
│   └── SPEC-001.md
└── ...
```

## Next Steps

- [Core Concepts](./concepts.md) - Philosophy, architecture, and key concepts
- [Intelligent Guardrails](./guardrails.md) - Deep dive into the autonomy and safety system
- [CLI Reference](./cli.md) - Complete command documentation
- [API Reference](./api.md) - Programmatic API details

## Troubleshooting

### Common Issues

**"Configuration not found"**
- Run `fractary-faber configure` or `fractary-faber config init` to create configuration
- Ensure you're running from the project root

**"gh: command not found"**
- Install GitHub CLI: `brew install gh` or [github.com/cli/cli](https://github.com/cli/cli)
- Authenticate: `gh auth login`

**"Permission denied"**
- Check your GitHub token has required scopes
- Re-authenticate: `gh auth refresh`

**"Branch already exists"**
- Use a different branch name
- Delete the existing branch first: `fractary repo branch delete <name>`

### Getting Help

- [GitHub Issues](https://github.com/fractary/faber/issues)
- [Documentation](https://developers.fractary.com)
