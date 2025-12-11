---
title: Getting Started with Faber
description: Step-by-step guide to installing and creating your first AI agent with Faber
visibility: public
---

# Getting Started

This guide will walk you through installing Faber and creating your first AI agent.

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **yarn**
- Basic understanding of TypeScript (for SDK usage)
- A code editor (VS Code recommended)

## Installation

### Option 1: CLI Tool (Recommended for Quick Start)

```bash
# Install globally
npm install -g @fractary/faber-cli

# Verify installation
faber --version
```

### Option 2: SDK Library (For Programmatic Usage)

```bash
# Install in your project
npm install @fractary/faber

# For TypeScript projects
npm install --save-dev @types/node typescript
```

### Option 3: Both

```bash
# Global CLI for commands
npm install -g @fractary/faber-cli

# Local SDK for custom code
npm install @fractary/faber
```

## Creating Your First Project

### Initialize a New Project

```bash
# Create a new directory
mkdir my-agents
cd my-agents

# Initialize Faber project
faber init

# Or with options
faber init \
  --org acme \
  --system support \
  --platforms github-issues,slack
```

This creates the following structure:

```
my-agents/
├── .faber/
│   ├── config.yml           # Project configuration
│   └── overlays/            # Customization overlays
├── roles/                   # Your agent roles
├── teams/                   # Team definitions
├── tools/                   # Tool definitions
├── workflows/               # Workflow definitions
├── evals/                   # Evaluation scenarios
└── contexts/                # Shared contexts
    ├── domain/
    ├── platform/
    ├── org/
    ├── project/
    ├── specialist/
    ├── task/
    └── integration/
```

### Configuration File

The `.faber/config.yml` file contains your project settings:

```yaml
org: acme
system: support
platforms:
  github-issues: github
  slack: slack
overlays:
  enabled: true
  paths:
    - .faber/overlays
```

## Creating Your First Agent

Let's create a simple GitHub issue manager agent.

### Step 1: Create a Role

```bash
faber create role issue-manager \
  --description "Manages and triages GitHub issues" \
  --platforms github-issues
```

This creates:

```
roles/issue-manager/
├── agent.yml          # Role metadata
├── prompt.md          # Base prompt
├── contexts/          # Role-specific contexts
├── tasks/             # Reusable tasks
└── flows/             # Task flows
```

### Step 2: Edit the Agent Metadata

Open `roles/issue-manager/agent.yml`:

```yaml
org: acme
system: support
name: issue-manager
type: role
description: Manages and triages GitHub issues
platforms:
  - github-issues
default_platform: github-issues
color: "#2ea44f"
agent_type: autonomous
```

### Step 3: Write the Base Prompt

Edit `roles/issue-manager/prompt.md`:

```markdown
---
name: Issue Manager
description: Triages and manages GitHub issues efficiently
---

You are an intelligent issue manager for GitHub repositories. Your primary responsibilities are:

## Core Responsibilities

1. **Triage new issues** - Classify, label, and prioritize incoming issues
2. **Assign issues** - Route issues to appropriate team members
3. **Manage lifecycle** - Track progress and update issue status
4. **Ensure quality** - Verify issues have sufficient detail before assignment

## Guidelines

- Always be helpful and professional
- Ask clarifying questions when issues lack detail
- Use labels consistently across the repository
- Escalate critical issues immediately
- Keep issue discussions focused and organized

## Available Actions

You can:
- Read issue details and comments
- Add labels and milestones
- Assign issues to team members
- Comment on issues
- Close or reopen issues
- Link related issues
```

### Step 4: Add Platform Context

Create `contexts/platform/github-issues.md`:

```markdown
---
category: platform
platform: github-issues
description: GitHub Issues platform capabilities and conventions
---

## GitHub Issues Platform

### Available Operations

#### Reading Issues
- List repository issues with filters
- Get issue details, comments, and history
- Search issues by label, assignee, or text

#### Managing Issues
- Create new issues
- Update issue title, body, or state
- Add/remove labels
- Set assignees and milestones
- Close or reopen issues

### Labels Convention

Use these standard labels:
- `bug` - Something isn't working
- `enhancement` - New feature request
- `documentation` - Documentation improvements
- `question` - Questions or help needed
- `duplicate` - Duplicate of existing issue
- `wontfix` - Will not be addressed

Priority labels:
- `priority: critical` - Immediate attention required
- `priority: high` - Important, address soon
- `priority: medium` - Normal priority
- `priority: low` - Nice to have

### Issue Templates

Reference these templates when creating issues:
- Bug reports require reproduction steps
- Feature requests require use case description
- Questions should check existing documentation first
```

### Step 5: Create a Task

Create `roles/issue-manager/tasks/triage-issue.md`:

```markdown
---
name: Triage Issue
description: Classify and label a new issue
---

# Triage Issue Task

When triaging a new issue:

1. **Read and understand** the issue description
2. **Classify the type**:
   - Bug report → add `bug` label
   - Feature request → add `enhancement` label
   - Question → add `question` label
   - Documentation → add `documentation` label

3. **Assess priority** based on:
   - Impact on users
   - Severity of problem
   - Urgency of request
   - Business priority

4. **Add appropriate labels**:
   - Type label (bug, enhancement, etc.)
   - Priority label (critical, high, medium, low)
   - Area labels (frontend, backend, api, etc.)

5. **Check for duplicates**:
   - Search for similar existing issues
   - If duplicate, link to original and close

6. **Validate completeness**:
   - Does it have enough detail?
   - Are reproduction steps clear (for bugs)?
   - Is the use case explained (for features)?
   - If not, ask for clarification

7. **Route appropriately**:
   - Assign to team member if obvious owner
   - Add to appropriate milestone
   - Leave in backlog if needs discussion
```

### Step 6: Build for Claude Code

```bash
faber build claude-code role issue-manager \
  --platform github-issues \
  --output ./deployments/claude
```

This generates a Claude Code agent in `./deployments/claude/` with:
- Agent configuration file
- Complete prompt with contexts
- Platform-specific adaptations

### Step 7: Deploy the Agent

Copy the generated files to your Claude Code configuration:

```bash
# For Claude Code CLI
cp -r ./deployments/claude/* ~/.claude/agents/

# Or for Claude Desktop
cp -r ./deployments/claude/* ~/Library/Application\ Support/Claude/agents/
```

## Testing Your Agent

### Create an Eval

```bash
faber create eval issue-manager-basic \
  --description "Basic issue triage tests"
```

Edit `evals/issue-manager-basic/eval.yml`:

```yaml
name: issue-manager-basic
type: eval
description: Basic issue triage functionality tests
targets:
  - issue-manager
scenarios:
  - name: triage-bug-report
    description: Correctly identifies and labels a bug report
    inputs:
      issue_title: "App crashes on startup"
      issue_body: "Steps to reproduce:\n1. Open app\n2. Click settings\n3. App crashes"
    expected_outputs:
      labels:
        - bug
        - priority: high
    assertions:
      - "Issue is labeled as 'bug'"
      - "Priority is set to high or critical"
      - "No clarification questions needed"

  - name: triage-incomplete-issue
    description: Asks for more information on incomplete issue
    inputs:
      issue_title: "Something is broken"
      issue_body: "It doesn't work"
    assertions:
      - "Asks for clarification"
      - "Requests reproduction steps or details"
```

### Run Validation

```bash
# Validate the role structure
faber validate role issue-manager

# Run evals (when supported by binding)
faber eval issue-manager-basic
```

## Using the Programmatic API

For more control, use the SDK directly:

```typescript
import { FaberAPI, ConceptType } from '@fractary/faber';

async function buildAgent() {
  // Initialize API
  const faber = new FaberAPI({
    projectPath: './my-agents',
    verbose: true
  });

  // Load configuration
  const config = await faber.loadConfig();
  console.log('Loaded config:', config);

  // List available roles
  const roles = await faber.list(ConceptType.ROLE);
  console.log('Available roles:', roles);

  // Validate a role
  const validation = await faber.validate(
    ConceptType.ROLE,
    'issue-manager'
  );

  if (!validation.valid) {
    console.error('Validation errors:', validation.errors);
    return;
  }

  // Build for Claude Code
  const artifact = await faber.build(
    'claude-code',
    ConceptType.ROLE,
    'issue-manager',
    {
      output: './deployments/claude',
      platform: 'github-issues',
      verbose: true
    }
  );

  console.log('Built agent:', {
    files: artifact.files.length,
    metadata: artifact.metadata
  });
}

buildAgent().catch(console.error);
```

## Next Steps

Now that you have your first agent running:

1. **Add more contexts** - Enrich your agent with domain knowledge
2. **Create overlays** - Customize for different organizations or platforms
3. **Build a team** - Coordinate multiple agents
4. **Define workflows** - Create multi-stage processes
5. **Write evals** - Test and validate agent behavior

### Learn More

- [Core Concepts](./concepts.md) - Understanding Faber's architecture
- [CLI Reference](./cli.md) - Complete command documentation
- [API Reference](./api.md) - Programmatic API details
- [Context System](./concepts.md#context-system) - Dynamic knowledge loading
- [Overlay System](./concepts.md#overlay-system) - Customization patterns

## Troubleshooting

### Common Issues

**Issue**: `faber: command not found`
- Solution: Ensure global npm bin directory is in your PATH
- Run: `npm config get prefix` and add `<prefix>/bin` to PATH

**Issue**: `Cannot find module '@fractary/faber'`
- Solution: Install the SDK in your project
- Run: `npm install @fractary/faber`

**Issue**: Validation errors on build
- Solution: Check agent.yml format matches schema
- Run: `faber validate role <name>` for details

**Issue**: Contexts not loading
- Solution: Verify context files have proper frontmatter
- Check: Category and platform fields match configuration

### Getting Help

- [GitHub Issues](https://github.com/fractary/faber/issues)
- [Documentation](https://developers.fractary.com)
- [Examples Repository](https://github.com/fractary/faber-examples)
