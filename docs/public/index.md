---
title: Faber SDK Documentation
description: Universal AI agent orchestration framework for building agents that work across multiple platforms
visibility: public
---

# Faber SDK

> Universal AI Agent Orchestration Framework

Faber is a comprehensive SDK for building AI agents that can be deployed across multiple AI frameworks (Claude Code, LangGraph, CrewAI) and adapted to different platforms and organizational contexts without forking or duplicating code.

## What is Faber?

Faber provides a **universal agent definition format** that separates agent logic from framework-specific implementations. This allows you to:

- **Write once, deploy everywhere** - Define agents once, deploy to Claude Code, LangGraph, CrewAI, or custom frameworks
- **Context-aware agents** - Dynamically load knowledge based on platform, organization, or user context
- **Customization without forking** - Use overlays to adapt agents without modifying source code
- **Type-safe development** - Full TypeScript support with comprehensive type definitions
- **Team orchestration** - Coordinate multiple agents working together on complex workflows

## Key Features

### 🎭 Concept System
Define reusable agent concepts:
- **Roles** - Individual AI agents with specific responsibilities
- **Teams** - Groups of roles working together
- **Tools** - Capabilities agents can use
- **Workflows** - Multi-stage processes across teams
- **Evals** - Test scenarios to validate agent behavior

### 📚 Context System
7 categories of dynamic knowledge loading:
- **Domain** - Industry/domain-specific knowledge
- **Platform** - Platform-specific capabilities (GitHub, Jira, Slack)
- **Org** - Organization-specific information
- **Project** - Project-level context
- **Specialist** - Deep expertise in specific areas
- **Task** - Task-specific instructions
- **Integration** - Integration guides and examples

### 🎨 Overlay System
Customize agents without forking:
- Organization-level customization
- Platform-specific adaptations
- Role-specific overrides
- Additional context injection

### 🔌 Binding Framework
Transform agents to any framework:
- Claude Code (built-in)
- LangGraph (coming soon)
- CrewAI (coming soon)
- Custom bindings (extensible)

## Quick Start

### Installation

```bash
# Install the SDK
npm install @fractary/faber

# Or install the CLI globally
npm install -g @fractary/faber-cli
```

### Using the SDK

```typescript
import { FaberAPI } from '@fractary/faber';

// Initialize
const faber = new FaberAPI({
  projectPath: './my-agents'
});

// Load and build an agent
const result = await faber.build('claude-code', 'role', 'issue-manager', {
  output: './deployments/claude',
  platform: 'github'
});

console.log('Agent deployed:', result.metadata);
```

### Using the CLI

```bash
# Initialize a new project
faber init my-agents

# Create a new role
faber create role issue-manager \
  --description "Manages and triages GitHub issues"

# Build for Claude Code
faber build claude-code role issue-manager \
  --platform github \
  --output ./deployments
```

## Project Structure

A typical Faber project has this structure:

```
my-agents/
├── .faber/
│   ├── config.yml              # Project configuration
│   └── overlays/               # Customization overlays
│       ├── org/                # Organization overlays
│       └── platforms/          # Platform overlays
├── roles/                      # Agent roles
│   └── issue-manager/
│       ├── agent.yml           # Role metadata
│       ├── prompt.md           # Base prompt
│       ├── contexts/           # Role-specific contexts
│       ├── tasks/              # Reusable tasks
│       └── flows/              # Task flows
├── teams/                      # Team definitions
├── tools/                      # Tool definitions
├── workflows/                  # Workflow definitions
├── evals/                      # Evaluation scenarios
└── contexts/                   # Shared contexts
    ├── domain/
    ├── platform/
    ├── org/
    └── ...
```

## Core Concepts

### Roles (Agents)

A role defines an individual AI agent:

```yaml
# roles/issue-manager/agent.yml
org: acme
system: support
name: issue-manager
type: role
description: Triages and manages GitHub issues
platforms:
  - github-issues
  - linear
default_platform: github-issues
```

### Teams

Teams coordinate multiple roles:

```yaml
# teams/support-team/team.yml
name: support-team
type: team
description: Handles customer support across channels
members:
  - role: issue-manager
    name: github-bot
  - role: slack-responder
    name: support-bot
coordination: sequential
leader: github-bot
```

### Workflows

Workflows define multi-stage processes:

```yaml
# workflows/issue-resolution/workflow.yml
name: issue-resolution
type: workflow
description: Full issue resolution workflow
stages:
  - name: triage
    team: support-team
    tasks:
      - classify-issue
      - assign-priority
  - name: resolution
    team: engineering-team
    tasks:
      - investigate
      - implement-fix
      - deploy
triggers:
  - type: event
    config:
      event: issue.opened
```

## Next Steps

- [Getting Started](./getting-started.md) - Detailed setup and first agent
- [Core Concepts](./concepts.md) - Deep dive into Faber concepts
- [CLI Reference](./cli.md) - Complete CLI command documentation
- [API Reference](./api.md) - Programmatic API documentation

## Community & Support

- **Documentation**: [developers.fractary.com](https://developers.fractary.com)
- **GitHub**: [github.com/fractary/faber](https://github.com/fractary/faber)
- **Issues**: [github.com/fractary/faber/issues](https://github.com/fractary/faber/issues)
- **npm**: [@fractary/faber](https://www.npmjs.com/package/@fractary/faber)

## License

MIT - see [LICENSE](https://github.com/fractary/faber/blob/main/LICENSE) for details.
