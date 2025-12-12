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
npm install -g @fractary/faber

# Verify installation
fractary --version
```

## Configuration

Create configuration files in your project at `.fractary/plugins/{module}/config.json`.

### Work Configuration

```bash
mkdir -p .fractary/plugins/work
```

```json
// .fractary/plugins/work/config.json
{
  "platform": "github",
  "owner": "your-org",
  "repo": "your-repo"
}
```

### Repository Configuration

```bash
mkdir -p .fractary/plugins/repo
```

```json
// .fractary/plugins/repo/config.json
{
  "platform": "github",
  "owner": "your-org",
  "repo": "your-repo",
  "defaultBranch": "main",
  "branchPrefixes": {
    "feature": "feature/",
    "fix": "fix/",
    "chore": "chore/"
  }
}
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
fractary work fetch 123

# Create a new issue
fractary work create --title "Add feature" --body "Description" --type feature

# Search issues
fractary work search "authentication" --state open

# Add a comment
fractary work comment 123 --body "Progress update"

# Close an issue
fractary work close 123

# Classify work type
fractary work classify 123
```

### Repository Commands

```bash
# Create a branch
fractary repo branch create feature/new-feature

# List branches
fractary repo branch list --merged

# Create a PR
fractary repo pr create --title "Add feature" --head feature/new-feature

# Commit changes
fractary repo commit --message "Add feature" --type feat
```

### Specification Commands

```bash
# Create a spec
fractary spec create "Add authentication" --template feature

# List specs
fractary spec list --status draft

# Validate a spec
fractary spec validate SPEC-001

# Refine a spec
fractary spec refine SPEC-001
```

### Workflow Commands

```bash
# Run FABER workflow
fractary workflow run 123 --autonomy assisted

# Check status
fractary workflow status <workflow-id>

# Resume paused workflow
fractary workflow resume <workflow-id>
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
│   └── plugins/
│       ├── work/
│       │   └── config.json
│       ├── repo/
│       │   └── config.json
│       ├── spec/
│       │   └── config.json
│       ├── logs/
│       │   └── config.json
│       └── state/
│           └── config.json
├── specs/                  # Specification files
│   └── SPEC-001.md
├── .faber-state/           # Workflow state (auto-generated)
└── .faber-logs/            # Session logs (auto-generated)
```

## Next Steps

- [Core Concepts](./concepts.md) - Philosophy, architecture, and key concepts
- [Intelligent Guardrails](./guardrails.md) - Deep dive into the autonomy and safety system
- [CLI Reference](./cli.md) - Complete command documentation
- [API Reference](./api.md) - Programmatic API details

## Troubleshooting

### Common Issues

**"Configuration not found"**
- Create the config file at `.fractary/plugins/{module}/config.json`
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
