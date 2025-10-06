# Faber

> Universal AI Agent Orchestration Framework - Core SDK

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/typescript-5.3.3-blue)](https://www.typescriptlang.org/)

## Overview

Faber is the core SDK for building universal AI agents that can be deployed across multiple AI frameworks (Claude Code, LangGraph, CrewAI, etc.) and adapted to different platforms and organizational contexts.

This is the **core framework package**. For the CLI tool, see [@fractary/faber-cli](https://www.npmjs.com/package/@fractary/faber-cli).

## Installation

```bash
npm install @fractary/faber
```

## Programmatic Usage

```typescript
import { FaberAPI, RoleLoader } from '@fractary/faber';

// Initialize API
const api = new FaberAPI({
  projectPath: './my-agents'
});

// Load and build an agent
const result = await api.build('claude', 'role', 'issue-manager', {
  output: './deployments/claude',
  platform: 'github-issues'
});

console.log('Built agent:', result.files);
```

## Core Features

- **Concept System** - Roles, Teams, Tools, Workflows, Evals
- **Context System** - 7 categories of dynamic knowledge loading
- **Overlay System** - Customization without forking
- **Binding Framework** - Transform to any AI framework
- **Configuration Management** - Flexible config system
- **TypeScript First** - Full type safety

## API Reference

### FaberAPI

Main programmatic interface:

```typescript
class FaberAPI {
  // Initialize a new Faber project
  async init(options: InitOptions): Promise<void>

  // Create new concepts
  async create(type: ConceptType, name: string, options: CreateOptions): Promise<void>

  // List available concepts
  async list(type?: ConceptType, filter?: ListFilter): Promise<ConceptInfo[]>

  // Validate a concept
  async validate(type: ConceptType, name: string): Promise<ValidationResult>

  // Build/transform for a framework
  async build(binding: string, type: ConceptType, name: string, options: BuildOptions): Promise<DeploymentArtifact>

  // Load configuration
  async loadConfig(): Promise<Config>

  // Apply overlays
  async applyOverlays(concept: Concept, overlays: Overlays): Promise<Concept>
}
```

### Concept Loaders

Direct access to loaders:

```typescript
import { RoleLoader, TeamLoader, ToolLoader } from '@fractary/faber/loaders';

const loader = new RoleLoader();
const role = await loader.load('./roles/my-agent');
const validation = await loader.validate(role);
```

### Bindings

Create custom framework bindings:

```typescript
import { BindingTransformer, DeploymentArtifact } from '@fractary/faber/bindings';

class MyCustomBinding implements BindingTransformer {
  async transform(concept: Concept, config: Config, overlays?: Overlays): Promise<DeploymentArtifact> {
    // Custom transformation logic
  }

  async validate(concept: Concept): Promise<ValidationResult> {
    // Validation logic
  }

  getRequirements(): BindingRequirements {
    return {
      supportedConcepts: [ConceptType.ROLE, ConceptType.TEAM]
    };
  }
}
```

## Documentation

- [Core Concepts](https://github.com/fractary/faber-cli/blob/main/docs/concepts.md)
- [Context System](https://github.com/fractary/faber-cli/blob/main/docs/contexts.md)
- [Overlay System](https://github.com/fractary/faber-cli/blob/main/docs/overlays.md)
- [Binding System](https://github.com/fractary/faber-cli/blob/main/docs/bindings.md)
- [API Reference](https://github.com/fractary/faber-cli/blob/main/docs/api.md)

## CLI Tool

For command-line usage, install the CLI package:

```bash
npm install -g @fractary/faber-cli
```

See [@fractary/faber-cli](https://www.npmjs.com/package/@fractary/faber-cli) for CLI documentation.

## Contributing

See [Contributing Guide](https://github.com/fractary/faber-cli/blob/main/docs/contributing.md).

## License

MIT - see [LICENSE](LICENSE) file for details.

---

**Part of the Faber Ecosystem**
- [@fractary/faber](https://www.npmjs.com/package/@fractary/faber) - Core SDK (this package)
- [@fractary/faber-cli](https://www.npmjs.com/package/@fractary/faber-cli) - CLI tool
