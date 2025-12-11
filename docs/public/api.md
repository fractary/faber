---
title: API Reference
description: Complete reference for the Faber programmatic API
visibility: public
---

# API Reference

Complete documentation for using Faber programmatically in your Node.js/TypeScript applications.

## Installation

```bash
npm install @fractary/faber
```

## Quick Start

```typescript
import { FaberAPI, ConceptType } from '@fractary/faber';

// Initialize
const faber = new FaberAPI({
  projectPath: './my-agents'
});

// Build an agent
const artifact = await faber.build(
  'claude-code',
  ConceptType.ROLE,
  'issue-manager',
  { platform: 'github' }
);

console.log('Built agent:', artifact.metadata);
```

## Core API

### FaberAPI

Main entry point for the Faber SDK.

#### Constructor

```typescript
new FaberAPI(options?: FaberOptions)
```

**Options:**
```typescript
interface FaberOptions {
  projectPath?: string;    // Path to Faber project (default: cwd)
  configPath?: string;     // Path to config.yml (default: .faber/config.yml)
  verbose?: boolean;       // Enable verbose logging (default: false)
  quiet?: boolean;         // Suppress non-error output (default: false)
}
```

**Example:**
```typescript
const faber = new FaberAPI({
  projectPath: '/path/to/agents',
  verbose: true
});
```

---

#### `init(options)`

Initialize a new Faber project.

```typescript
async init(options?: InitOptions): Promise<void>
```

**Options:**
```typescript
interface InitOptions {
  org?: string;              // Organization identifier
  system?: string;           // System identifier
  platforms?: string[];      // Platform list
  description?: string;      // Project description
}
```

**Example:**
```typescript
await faber.init({
  org: 'acme',
  system: 'support',
  platforms: ['github', 'slack'],
  description: 'Support automation agents'
});
```

---

#### `create(type, name, options)`

Create a new concept.

```typescript
async create(
  type: ConceptType,
  name: string,
  options?: CreateOptions
): Promise<void>
```

**Parameters:**
- `type` - Concept type enum value
- `name` - Concept name (kebab-case)
- `options` - Creation options

**Options:**
```typescript
interface CreateOptions {
  org?: string;
  system?: string;
  description?: string;
  platforms?: string[];
  members?: string[];        // For teams
  type?: string;            // For tools
  target?: string;          // For evals
}
```

**Example:**
```typescript
import { ConceptType } from '@fractary/faber';

// Create a role
await faber.create(ConceptType.ROLE, 'issue-manager', {
  description: 'Manages GitHub issues',
  platforms: ['github']
});

// Create a team
await faber.create(ConceptType.TEAM, 'support-team', {
  description: 'Support team',
  members: ['issue-manager', 'slack-responder']
});

// Create a tool
await faber.create(ConceptType.TOOL, 'github-api', {
  description: 'GitHub API',
  type: 'api'
});
```

---

#### `list(type?, filter?)`

List concepts.

```typescript
async list(
  type?: ConceptType,
  filter?: ListFilter
): Promise<ConceptInfo[]>
```

**Parameters:**
- `type` - Optional concept type filter
- `filter` - Additional filters

**Filter:**
```typescript
interface ListFilter {
  org?: string;
  system?: string;
  platform?: string;
}
```

**Return:**
```typescript
interface ConceptInfo {
  type: ConceptType;
  name: string;
  description?: string;
  path: string;
}
```

**Example:**
```typescript
// List all concepts
const all = await faber.list();

// List only roles
const roles = await faber.list(ConceptType.ROLE);

// List with filter
const githubRoles = await faber.list(ConceptType.ROLE, {
  platform: 'github'
});

console.log('Roles:', roles.map(r => r.name));
```

---

#### `loadConcept(type, name)`

Load a concept.

```typescript
async loadConcept<T extends Concept>(
  type: ConceptType,
  name: string
): Promise<T>
```

**Parameters:**
- `type` - Concept type
- `name` - Concept name

**Return:**
Type-specific concept object (Role, Team, Tool, Workflow, Eval)

**Example:**
```typescript
import { Role, ConceptType } from '@fractary/faber';

const role = await faber.loadConcept<Role>(
  ConceptType.ROLE,
  'issue-manager'
);

console.log('Loaded role:', role.metadata.name);
console.log('Platforms:', role.metadata.platforms);
console.log('Tasks:', role.tasks.size);
```

---

#### `validate(type, name)`

Validate a concept.

```typescript
async validate(
  type: ConceptType,
  name: string
): Promise<ValidationResult>
```

**Return:**
```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  info?: ValidationInfo[];
}

interface ValidationError {
  path: string;
  message: string;
  code?: string;
  type?: 'error' | 'warning';
}
```

**Example:**
```typescript
const result = await faber.validate(
  ConceptType.ROLE,
  'issue-manager'
);

if (!result.valid) {
  console.error('Validation errors:');
  result.errors.forEach(err => {
    console.error(`  ${err.path}: ${err.message}`);
  });
} else {
  console.log('Validation passed!');
}
```

---

#### `build(binding, type, name, options)`

Build/transform a concept for a framework.

```typescript
async build(
  binding: string,
  type: ConceptType,
  name: string,
  options?: BuildOptions
): Promise<DeploymentArtifact>
```

**Options:**
```typescript
interface BuildOptions {
  output?: string;           // Output directory
  noOverlays?: boolean;     // Skip overlays
  platform?: string;        // Target platform
  dryRun?: boolean;         // Don't write files
  verbose?: boolean;        // Verbose output
}
```

**Return:**
```typescript
interface DeploymentArtifact {
  framework: string;
  concept: string;
  conceptType: ConceptType;
  files: FileArtifact[];
  metadata: DeploymentMetadata;
}

interface FileArtifact {
  path: string;
  content: string;
  encoding?: string;
  permissions?: string;
}

interface DeploymentMetadata {
  version: string;
  timestamp: string;
  config: Config;
  overlays?: Overlays;
  platform?: string;
}
```

**Example:**
```typescript
const artifact = await faber.build(
  'claude-code',
  ConceptType.ROLE,
  'issue-manager',
  {
    output: './deployments/prod',
    platform: 'github',
    verbose: true
  }
);

console.log(`Generated ${artifact.files.length} files`);
artifact.files.forEach(file => {
  console.log(`  ${file.path} (${file.content.length} bytes)`);
});
```

---

#### `loadConfig()`

Load project configuration.

```typescript
async loadConfig(): Promise<Config>
```

**Return:**
```typescript
interface Config {
  platforms?: Record<string, string>;
  mcp_servers?: Record<string, MCPServerConfig>;
  overlays?: {
    enabled: boolean;
    paths?: string[];
  };
  bindings?: Record<string, BindingConfig>;
}
```

**Example:**
```typescript
const config = await faber.loadConfig();

console.log('Platforms:', Object.keys(config.platforms));
console.log('Overlays enabled:', config.overlays?.enabled);
```

---

#### `resolveOverlays(type, name, platform?)`

Resolve overlays for a concept.

```typescript
async resolveOverlays(
  type: string,
  name: string,
  platform?: string
): Promise<Overlays>
```

**Return:**
```typescript
interface Overlays {
  organization: OverlayContent;
  platforms: Record<string, OverlayContent>;
  roles: Record<string, OverlayContent>;
  teams: Record<string, OverlayContent>;
  workflows: Record<string, OverlayContent>;
}

interface OverlayContent {
  contexts: Context[];
  config?: Record<string, unknown>;
}
```

**Example:**
```typescript
const overlays = await faber.resolveOverlays(
  'role',
  'issue-manager',
  'github'
);

console.log('Org contexts:', overlays.organization.contexts.length);
console.log('Platform contexts:', overlays.platforms['github']?.contexts.length);
```

---

#### `applyOverlays(concept, overlays)`

Apply overlays to a concept.

```typescript
async applyOverlays(
  concept: Concept,
  overlays: Overlays
): Promise<Concept>
```

**Example:**
```typescript
const role = await faber.loadConcept(ConceptType.ROLE, 'issue-manager');
const overlays = await faber.resolveOverlays('role', 'issue-manager', 'github');
const enhanced = await faber.applyOverlays(role, overlays);

console.log('Original contexts:', role.contexts.size);
console.log('With overlays:', enhanced.contexts.size);
```

---

### Event System

FaberAPI extends EventEmitter and emits events during operations.

#### Events

```typescript
// Concept loaded
faber.on('concept:loaded', ({ type, name, concept }) => {
  console.log(`Loaded ${type}: ${name}`);
});

// Concept validated
faber.on('concept:validated', ({ type, name, result }) => {
  console.log(`Validated ${name}: ${result.valid ? 'OK' : 'FAILED'}`);
});

// Build started
faber.on('build:start', ({ binding, type, name }) => {
  console.log(`Building ${name} for ${binding}...`);
});

// Build complete
faber.on('build:complete', ({ artifact }) => {
  console.log(`Build complete: ${artifact.files.length} files`);
});

// Deploy complete
faber.on('deploy:complete', ({ artifact, target }) => {
  console.log(`Deployed to ${target}`);
});
```

**Example:**
```typescript
const faber = new FaberAPI({ verbose: true });

faber.on('concept:loaded', ({ name }) => {
  console.log(`✓ Loaded ${name}`);
});

faber.on('build:start', ({ name }) => {
  console.log(`⚙️  Building ${name}...`);
});

faber.on('build:complete', ({ artifact }) => {
  console.log(`✓ Generated ${artifact.files.length} files`);
});

await faber.build('claude-code', ConceptType.ROLE, 'issue-manager');
```

---

## Concept Loaders

Direct access to concept loaders for fine-grained control.

### RoleLoader

```typescript
import { RoleLoader } from '@fractary/faber/loaders';

const loader = new RoleLoader();

// Load a role
const role = await loader.load('./roles/issue-manager');

// Validate
const result = await loader.validate(role);
```

### TeamLoader

```typescript
import { TeamLoader } from '@fractary/faber/loaders';

const loader = new TeamLoader();
const team = await loader.load('./teams/support-team');
```

### ToolLoader

```typescript
import { ToolLoader } from '@fractary/faber/loaders';

const loader = new ToolLoader();
const tool = await loader.load('./tools/github-api');
```

### WorkflowLoader

```typescript
import { WorkflowLoader } from '@fractary/faber/loaders';

const loader = new WorkflowLoader();
const workflow = await loader.load('./workflows/incident-response');
```

### EvalLoader

```typescript
import { EvalLoader } from '@fractary/faber/loaders';

const loader = new EvalLoader();
const eval = await loader.load('./evals/issue-manager-tests');
```

---

## Bindings API

Create custom framework bindings.

### BindingTransformer Interface

```typescript
import {
  BindingTransformer,
  Concept,
  Config,
  Overlays,
  DeploymentArtifact,
  ValidationResult,
  BindingRequirements
} from '@fractary/faber/bindings';

export class MyCustomBinding implements BindingTransformer {
  async transform(
    concept: Concept,
    config: Config,
    overlays?: Overlays
  ): Promise<DeploymentArtifact> {
    // Transform concept to your framework format
    const files: FileArtifact[] = [];

    // Generate your framework's files
    files.push({
      path: 'agent.py',
      content: this.generateAgent(concept)
    });

    files.push({
      path: 'config.yaml',
      content: this.generateConfig(concept, config)
    });

    return {
      framework: 'my-framework',
      concept: concept.name,
      conceptType: concept.type,
      files,
      metadata: {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        config
      }
    };
  }

  async validate(concept: Concept): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Your validation logic
    if (!concept.description) {
      errors.push({
        path: 'description',
        message: 'Description is required'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  getRequirements(): BindingRequirements {
    return {
      minVersion: '0.1.0',
      supportedConcepts: [ConceptType.ROLE, ConceptType.TEAM],
      requiredFeatures: ['contexts', 'overlays']
    };
  }

  private generateAgent(concept: Concept): string {
    // Your generation logic
    return `# Agent: ${concept.name}\n...`;
  }

  private generateConfig(concept: Concept, config: Config): string {
    // Your config generation logic
    return `name: ${concept.name}\n...`;
  }
}
```

### Register Custom Binding

```typescript
import { FaberAPI } from '@fractary/faber';
import { MyCustomBinding } from './my-binding';

const faber = new FaberAPI();

// Register your binding
faber.registerBinding('my-framework', new MyCustomBinding());

// Use it
const artifact = await faber.build(
  'my-framework',
  ConceptType.ROLE,
  'issue-manager'
);
```

---

## Type Definitions

### Core Types

```typescript
enum ConceptType {
  ROLE = 'role',
  TOOL = 'tool',
  EVAL = 'eval',
  TEAM = 'team',
  WORKFLOW = 'workflow'
}

interface Concept {
  name: string;
  type: ConceptType;
  description?: string;
}
```

### Role

```typescript
interface Role extends Concept {
  type: ConceptType.ROLE;
  metadata: RoleMetadata;
  path: string;
  prompt: string;
  tasks: Map<string, Task>;
  flows: Map<string, Flow>;
  contexts: Map<string, Context>;
  bindings?: Map<string, BindingConfig>;
}

interface RoleMetadata extends ConceptMetadata {
  type: ConceptType.ROLE;
  platforms?: string[];
  default_platform?: string;
  platform_config_key?: string;
  color?: string;
  agent_type?: 'autonomous' | 'interactive' | 'batch';
}
```

### Team

```typescript
interface Team extends Concept {
  type: ConceptType.TEAM;
  members: TeamMember[];
  coordination?: CoordinationType;
  workflows?: string[];
  leader?: string;
}

interface TeamMember {
  role: string;
  name?: string;
  config?: Record<string, unknown>;
}

enum CoordinationType {
  PARALLEL = 'parallel',
  SEQUENTIAL = 'sequential',
  DYNAMIC = 'dynamic'
}
```

### Tool

```typescript
interface Tool extends Concept {
  type: ConceptType.TOOL;
  tool_type: ToolType;
  mcp_server?: boolean;
  protocols?: string[];
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

enum ToolType {
  API = 'api',
  MCP_SERVER = 'mcp_server',
  CLI = 'cli',
  SDK = 'sdk',
  CUSTOM = 'custom'
}
```

### Workflow

```typescript
interface Workflow extends Concept {
  type: ConceptType.WORKFLOW;
  stages: Stage[];
  teams: string[];
  triggers?: Trigger[];
  conditions?: Record<string, unknown>;
}

interface Stage {
  name: string;
  team: string;
  entry_criteria?: string[];
  tasks: string[];
  exit_criteria?: string[];
  on_failure?: string[];
}

interface Trigger {
  type: 'manual' | 'scheduled' | 'event';
  config?: Record<string, unknown>;
}
```

### Eval

```typescript
interface Eval extends Concept {
  type: ConceptType.EVAL;
  targets: string[];
  scenarios: Scenario[];
  metrics?: Metric[];
  success_threshold?: number;
  platforms?: string[];
}

interface Scenario {
  name: string;
  description?: string;
  inputs: Record<string, unknown>;
  expected_outputs?: Record<string, unknown>;
  assertions?: string[];
}

interface Metric {
  name: string;
  type: 'accuracy' | 'coverage' | 'performance' | 'quality';
  threshold?: number;
}
```

### Context

```typescript
interface Context {
  category: ContextCategory;
  name: string;
  content: string;
  frontmatter?: ContextFrontmatter;
  metadata?: ContextFrontmatter;
  filePath?: string;
  path?: string;
}

enum ContextCategory {
  DOMAIN = 'domain',
  PLATFORM = 'platform',
  ORG = 'org',
  PROJECT = 'project',
  SPECIALIST = 'specialist',
  TASK = 'task',
  INTEGRATION = 'integration'
}
```

---

## Advanced Usage

### Custom Context Loading

```typescript
import { ContextLoader } from '@fractary/faber';

const contextLoader = new ContextLoader();

// Load a single context
const context = await contextLoader.loadContext(
  './contexts/platform/github.md',
  ContextCategory.PLATFORM,
  'github'
);

// Load all contexts in a category
const platformContexts = await contextLoader.loadCategoryContexts(
  './contexts/platform',
  ContextCategory.PLATFORM
);

// Load contexts for a role
const roleContexts = await contextLoader.loadRoleContexts(role, config);
```

### Overlay Resolution

```typescript
import { OverlayResolver } from '@fractary/faber';

const resolver = new OverlayResolver('.faber/overlays');

// Resolve overlays for a concept
const overlays = await resolver.resolveOverlays(
  'role',
  'issue-manager',
  'github'
);

// Access specific overlays
console.log('Org contexts:', overlays.organization.contexts);
console.log('Platform config:', overlays.platforms['github']?.config);
```

### Configuration Management

```typescript
import { ConfigLoader } from '@fractary/faber';

const configLoader = new ConfigLoader('./my-agents');

// Load config
const config = await configLoader.load();

// Validate config
const isValid = await configLoader.validate(config);

// Get platform binding
const platform = config.platforms?.['github-issues'];
```

---

## Error Handling

All async methods can throw errors. Always use try-catch:

```typescript
try {
  const artifact = await faber.build(
    'claude-code',
    ConceptType.ROLE,
    'issue-manager'
  );
} catch (error) {
  if (error.code === 'CONCEPT_NOT_FOUND') {
    console.error('Concept not found:', error.message);
  } else if (error.code === 'VALIDATION_ERROR') {
    console.error('Validation failed:', error.details);
  } else {
    console.error('Build failed:', error.message);
  }
}
```

Common error codes:
- `CONCEPT_NOT_FOUND` - Concept doesn't exist
- `VALIDATION_ERROR` - Validation failed
- `BUILD_ERROR` - Build/transform failed
- `CONFIG_ERROR` - Configuration error
- `IO_ERROR` - File system error

---

## Next Steps

- [Getting Started](./getting-started.md) - Build your first agent
- [Core Concepts](./concepts.md) - Understand the architecture
- [CLI Reference](./cli.md) - Command-line interface
- [GitHub](https://github.com/fractary/faber) - Source code and examples
