# FABER Examples

This directory contains runnable code examples demonstrating common FABER usage patterns.

## Available Examples

| Example | Description | Languages |
|---------|-------------|-----------|
| [simple-workflow](#simple-workflow) | Basic workflow execution | TypeScript, Python |
| [work-tracking](#work-tracking) | Issue and PR automation | TypeScript, Python |
| [repository-automation](#repository-automation) | Branch and PR management | TypeScript, Python |
| [spec-management](#spec-management) | Specification creation and validation | TypeScript, Python |
| [custom-hooks](#custom-hooks) | Custom workflow hooks | TypeScript, Python |
| [event-handling](#event-handling) | Workflow event listeners | TypeScript, Python |

## Prerequisites

### TypeScript Examples

```bash
npm install @fractary/faber
npm install --save-dev typescript @types/node tsx
```

### Python Examples

```bash
pip install faber
```

## Running Examples

### TypeScript

```bash
# Run with tsx
npx tsx docs/examples/simple-workflow.ts

# Or compile and run
npx tsc docs/examples/simple-workflow.ts
node docs/examples/simple-workflow.js
```

### Python

```bash
python docs/examples/simple-workflow.py
```

---

## simple-workflow

**Files:** `simple-workflow.ts`, `simple-workflow.py`

Basic FABER workflow execution for a work item.

**What it demonstrates:**
- Initializing FaberWorkflow
- Running a workflow with autonomy level
- Handling workflow events
- Processing workflow results

**Usage:**

```bash
# TypeScript
GITHUB_TOKEN=xxx npx tsx docs/examples/simple-workflow.ts 123

# Python
GITHUB_TOKEN=xxx python docs/examples/simple-workflow.py 123
```

---

## work-tracking

**Files:** `work-tracking.ts`, `work-tracking.py`

Complete work tracking operations: creating issues, adding comments, managing labels.

**What it demonstrates:**
- Creating and fetching issues
- Adding comments with FABER context
- Managing labels and milestones
- Classifying work types

**Usage:**

```bash
# TypeScript
GITHUB_TOKEN=xxx npx tsx docs/examples/work-tracking.ts

# Python
GITHUB_TOKEN=xxx python docs/examples/work-tracking.py
```

---

## repository-automation

**Files:** `repository-automation.ts`, `repository-automation.py`

Automated repository operations from issue to merged PR.

**What it demonstrates:**
- Creating semantic branch names
- Making commits with conventional commit format
- Creating and managing pull requests
- Merging PRs with cleanup

**Usage:**

```bash
# TypeScript
GITHUB_TOKEN=xxx npx tsx docs/examples/repository-automation.ts 123

# Python
GITHUB_TOKEN=xxx python docs/examples/repository-automation.py 123
```

---

## spec-management

**Files:** `spec-management.ts`, `spec-management.py`

Specification lifecycle: creation, validation, refinement.

**What it demonstrates:**
- Creating specifications from templates
- Validating specification completeness
- Generating refinement questions
- Applying refinements
- Exporting specifications

**Usage:**

```bash
# TypeScript
npx tsx docs/examples/spec-management.ts

# Python
python docs/examples/spec-management.py
```

---

## custom-hooks

**Files:** `custom-hooks.ts`, `custom-hooks.py`

Using lifecycle hooks to customize workflow behavior.

**What it demonstrates:**
- Configuring pre/post hooks
- Running validation in hooks
- Custom build scripts
- Deployment hooks

**Usage:**

```bash
# TypeScript
npx tsx docs/examples/custom-hooks.ts

# Python
python docs/examples/custom-hooks.py
```

---

## event-handling

**Files:** `event-handling.ts`, `event-handling.py`

Advanced event handling and workflow monitoring.

**What it demonstrates:**
- Adding event listeners
- Handling different event types
- Workflow progress tracking
- Error handling and recovery

**Usage:**

```bash
# TypeScript
GITHUB_TOKEN=xxx npx tsx docs/examples/event-handling.ts 123

# Python
GITHUB_TOKEN=xxx python docs/examples/event-handling.py 123
```

---

## Environment Variables

All examples require appropriate environment variables:

```bash
# GitHub (most examples)
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Jira (work-tracking examples)
export JIRA_BASE_URL=https://your-domain.atlassian.net
export JIRA_USERNAME=user@example.com
export JIRA_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Linear (work-tracking examples)
export LINEAR_API_KEY=lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Configuration

Examples expect a `.fractary/faber/config.json` file. Initialize one:

```bash
cd /path/to/your/project
fractary-faber init --preset default
```

Or the examples will create a minimal configuration automatically.

## Modifying Examples

Each example is self-contained and can be modified to fit your needs:

1. Copy the example to your project
2. Modify configuration values (owner, repo, etc.)
3. Add your custom logic
4. Run and iterate

## Common Patterns

### Error Handling

```typescript
try {
  const result = await faber.run({ workId: '123' });
  console.log('Success:', result);
} catch (error) {
  if (error instanceof WorkflowError) {
    console.error('Workflow failed:', error.message);
  }
}
```

### Progress Tracking

```typescript
faber.addEventListener((event, data) => {
  if (event.startsWith('phase:')) {
    console.log(`${event}: ${data.phase}`);
  }
});
```

### Configuration

```typescript
const config = {
  autonomy: 'guarded',
  phases: {
    build: { enabled: true },
    evaluate: { enabled: true, maxRetries: 3 }
  }
};
```

## See Also

- [API Reference](../guides/api-reference.md) - Complete SDK documentation
- [CLI Integration Guide](../guides/cli-integration.md) - CLI usage patterns
- [Configuration Guide](../guides/configuration.md) - Configuration options
- [Getting Started](../public/getting-started.md) - Installation guide
