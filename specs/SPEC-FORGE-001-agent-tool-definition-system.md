# SPEC-FORGE-001: Agent & Tool Definition System Architecture

| Field | Value |
|-------|-------|
| **Status** | Draft |
| **Created** | 2025-12-14 |
| **Author** | Claude (with human direction) |
| **Project** | `@fractary/forge` |
| **Related** | SPEC-FORGE-002, SPEC-FABER-002, SPEC-MIGRATION-001 |
| **Phase** | Phase 1: Foundation |

## 1. Executive Summary

This specification defines the **Agent & Tool Definition System** for `@fractary/forge`, establishing how agents and tools are defined, stored, resolved, and deployed. This moves agent/tool definition capabilities from `@fractary/faber` to `@fractary/forge`, aligning with Forge's role as the deployment and artifact management layer.

### 1.1 Scope

This document covers:
- Agent and tool definition schemas (migrated from FABER)
- Definition file formats (YAML with LangChain integration)
- Storage locations (`.fractary/agents/`, `.fractary/tools/`)
- Definition validation and type checking
- LLM configuration (provider, model, temperature, tokens)
- Prompt caching configuration (Claude-specific optimization)
- Tool implementation types (bash, python, http)
- Custom tool definitions within agents
- Definition metadata (version, author, tags)

### 1.2 Design Goals

1. **Declarative Definitions** - YAML-based, human-readable, version-controllable
2. **LangChain Compatible** - Convert seamlessly to LangChain primitives
3. **Multi-Provider** - Support Anthropic, OpenAI, Google models
4. **Implementation Flexible** - Tools can be bash scripts, Python functions, or HTTP APIs
5. **Prompt Caching** - First-class support for Claude's prompt caching
6. **Codex Integration** - Support codex:// URIs in caching sources
7. **Composable** - Agents can reference tools, tools can be reused across agents
8. **Versionable** - Support versioning, forking, and updates

### 1.3 Migration from FABER

**Source Location (FABER):**
```
/mnt/c/GitHub/fractary/faber/python/faber/definitions/
├── schemas.py           # Pydantic schemas (AgentDefinition, ToolDefinition)
├── api.py              # AgentAPI, ToolAPI
├── registry.py         # DefinitionRegistry
├── agent_factory.py    # AgentFactory
├── tool_executor.py    # Tool execution logic
└── converters.py       # LangChain converters
```

**Target Location (Forge):**
```
@fractary/forge/src/
├── definitions/
│   ├── schemas/       # TypeScript type definitions
│   ├── registry/      # Agent/tool registry
│   ├── factory/       # Agent factory
│   ├── executor/      # Tool executor
│   └── converters/    # LangChain converters
```

## 2. Definition Schemas

### 2.1 Agent Definition Schema

**File Location:** `.fractary/agents/{name}.yaml`

```yaml
# .fractary/agents/corthion-loader-engineer.yaml
name: corthion-loader-engineer
type: agent
description: |
  Specialized agent for creating Glue loaders for Corthion data platform.
  Generates Python scripts following Corthion patterns and conventions.

# LLM Configuration
llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
  temperature: 0.0
  max_tokens: 4096

# System Prompt
system_prompt: |
  You are a specialized data engineering agent for the Corthion platform.
  Your role is to create AWS Glue job loaders following established patterns.

  Key responsibilities:
  - Generate loader scripts using Glue 4.0 Python APIs
  - Follow Corthion naming conventions (snake_case)
  - Implement proper error handling and logging
  - Include data quality checks

# Built-in tools this agent can use
tools:
  - read_file
  - write_file
  - search_code
  - execute_bash

# Custom tools specific to this agent
custom_tools:
  - name: generate-loader-template
    type: tool
    description: Generate a loader script template
    parameters:
      dataset:
        type: string
        description: Dataset name (e.g., "claims")
        required: true
      table:
        type: string
        description: Table name (e.g., "medical_claims")
        required: true
    implementation:
      type: python
      python:
        module: corthion.tools.loaders
        function: generate_template

# Prompt Caching (Claude-specific)
caching:
  enabled: true
  cache_sources:
    # Cache the entire Corthion patterns guide
    - type: codex
      uri: codex://corthion/patterns/data-loaders
      label: "Corthion Loader Patterns"

    # Cache existing loader examples
    - type: glob
      pattern: "src/loaders/**/*.py"
      label: "Existing Loaders"

    # Cache the project README
    - type: file
      path: "README.md"
      label: "Project Overview"

# Additional configuration
config:
  default_glue_version: "4.0"
  python_version: "3.10"
  timeout_seconds: 300

# Metadata
version: "2.1.0"
author: "Corthion Engineering"
tags:
  - data-engineering
  - aws-glue
  - corthion
  - loader-generation
```

**TypeScript Type Definition:**

```typescript
// forge/src/definitions/schemas/agent.ts
export interface LLMConfig {
  provider: 'anthropic' | 'openai' | 'google';
  model: string;
  temperature?: number; // 0.0 - 1.0
  max_tokens?: number;  // 1 - 200000
}

export interface CachingSource {
  type: 'file' | 'glob' | 'inline' | 'codex';
  path?: string;        // For type=file
  pattern?: string;     // For type=glob
  content?: string;     // For type=inline
  uri?: string;         // For type=codex (codex://org/project/path)
  label: string;
}

export interface CachingConfig {
  enabled: boolean;
  cache_sources: CachingSource[];
}

export interface AgentDefinition {
  name: string;
  type: 'agent';
  description: string;

  // LLM configuration
  llm: LLMConfig;

  // System prompt
  system_prompt: string;

  // Tools
  tools: string[];              // Built-in tool names
  custom_tools: ToolDefinition[];

  // Prompt caching
  caching?: CachingConfig;

  // Additional configuration
  config: Record<string, any>;

  // Metadata
  version: string;
  author?: string;
  tags: string[];
}
```

### 2.2 Tool Definition Schema

**File Location:** `.fractary/tools/{name}.yaml`

```yaml
# .fractary/tools/terraform-deploy.yaml
name: terraform-deploy
type: tool
description: Deploy Terraform infrastructure with safety checks

# Parameters
parameters:
  environment:
    type: string
    description: Target environment (dev, test, prod)
    required: true
    enum: [dev, test, prod]

  target:
    type: string
    description: Specific resource to target (optional)
    required: false

  auto_approve:
    type: boolean
    description: Skip approval prompt (USE WITH CAUTION)
    required: false
    default: false

# Implementation
implementation:
  type: bash
  bash:
    command: |
      #!/bin/bash
      set -euo pipefail

      ENV="${environment}"
      TARGET="${target:-}"
      AUTO_APPROVE="${auto_approve:-false}"

      cd "terraform/${ENV}"

      # Plan first
      if [ -n "$TARGET" ]; then
        terraform plan -target="$TARGET" -out=tfplan
      else
        terraform plan -out=tfplan
      fi

      # Apply
      if [ "$AUTO_APPROVE" = "true" ]; then
        terraform apply tfplan
      else
        terraform apply tfplan
      fi

    sandbox:
      enabled: true
      allowlisted_commands:
        - terraform
        - cd
        - test
      network_access: true  # Terraform needs AWS API access
      max_execution_time: 900  # 15 minutes
      env_vars:
        - AWS_PROFILE
        - AWS_REGION

# Output schema (JSON Schema format)
output:
  type: object
  properties:
    status:
      type: string
      enum: [success, failure]
    resources_changed:
      type: integer
    resources_created:
      type: integer
    resources_destroyed:
      type: integer
    duration_seconds:
      type: number

# Metadata
version: "1.2.0"
author: "Infrastructure Team"
tags:
  - infrastructure
  - terraform
  - deployment
```

**TypeScript Type Definition:**

```typescript
// forge/src/definitions/schemas/tool.ts
export interface ToolParameter {
  type: 'string' | 'integer' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: any;
  enum?: any[];
  properties?: Record<string, ToolParameter>; // For nested objects
}

export interface BashImplementation {
  command: string;  // Supports ${param} substitution
  sandbox?: {
    enabled: boolean;
    allowlisted_commands: string[];
    network_access: boolean;
    max_execution_time: number;
    env_vars: string[];
  };
}

export interface PythonImplementation {
  module: string;   // e.g., "myproject.tools.custom"
  function: string; // Function name to call
}

export interface HTTPImplementation {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;      // Supports ${param} substitution
  headers?: Record<string, string>;
  body_template?: string;  // Supports ${param} substitution
}

export interface ToolImplementation {
  type: 'bash' | 'python' | 'http';
  bash?: BashImplementation;
  python?: PythonImplementation;
  http?: HTTPImplementation;
}

export interface ToolDefinition {
  name: string;
  type: 'tool';
  description: string;

  // Parameters
  parameters: Record<string, ToolParameter>;

  // Implementation
  implementation: ToolImplementation;

  // Output schema (JSON Schema)
  output?: Record<string, any>;

  // Metadata
  version: string;
  author?: string;
  tags: string[];
}
```

## 3. Storage & Discovery

### 3.1 File System Layout

```
project-root/
├── .fractary/
│   ├── agents/
│   │   ├── corthion-loader-engineer.yaml
│   │   ├── frame-agent.yaml
│   │   ├── architect-agent.yaml
│   │   ├── build-agent.yaml
│   │   ├── evaluate-agent.yaml
│   │   └── release-agent.yaml
│   │
│   ├── tools/
│   │   ├── terraform-deploy.yaml
│   │   ├── docker-build.yaml
│   │   └── run-tests.yaml
│   │
│   └── plugins/
│       └── forge/
│           └── config.json  # Forge configuration
```

### 3.2 Discovery Algorithm

**Priority Order:**
1. **Project-Local** (`.fractary/agents/` in current project)
2. **Global Registry** (`~/.fractary/registry/agents/`)
3. **Stockyard** (Remote marketplace - future)

```typescript
// forge/src/definitions/registry/resolver.ts
export class DefinitionResolver {
  async resolveAgent(name: string): Promise<AgentDefinition | null> {
    // 1. Check project-local
    const localPath = path.join(process.cwd(), '.fractary/agents', `${name}.yaml`);
    if (await fs.pathExists(localPath)) {
      return this.loadAgentYaml(localPath);
    }

    // 2. Check global registry
    const globalPath = path.join(
      os.homedir(),
      '.fractary/registry/agents',
      `${name}.yaml`
    );
    if (await fs.pathExists(globalPath)) {
      return this.loadAgentYaml(globalPath);
    }

    // 3. Check Stockyard (future)
    if (this.config.stockyard.enabled) {
      return this.fetchFromStockyard(name);
    }

    return null;
  }
}
```

## 4. Validation & Type Checking

### 4.1 Schema Validation

Forge validates all YAML definitions on load:

```typescript
// forge/src/definitions/validator.ts
export class DefinitionValidator {
  validateAgent(yaml: any): ValidationResult {
    const errors: ValidationError[] = [];

    // Required fields
    if (!yaml.name) errors.push({ field: 'name', message: 'Required' });
    if (!yaml.llm) errors.push({ field: 'llm', message: 'Required' });
    if (!yaml.system_prompt) errors.push({ field: 'system_prompt', message: 'Required' });

    // LLM validation
    if (yaml.llm) {
      if (!['anthropic', 'openai', 'google'].includes(yaml.llm.provider)) {
        errors.push({
          field: 'llm.provider',
          message: 'Must be anthropic, openai, or google'
        });
      }

      if (yaml.llm.temperature !== undefined) {
        if (yaml.llm.temperature < 0 || yaml.llm.temperature > 1) {
          errors.push({
            field: 'llm.temperature',
            message: 'Must be between 0 and 1'
          });
        }
      }
    }

    // Caching validation
    if (yaml.caching?.enabled) {
      for (const source of yaml.caching.cache_sources) {
        if (source.type === 'codex' && !source.uri?.startsWith('codex://')) {
          errors.push({
            field: 'caching.cache_sources',
            message: 'Codex URI must start with codex://'
          });
        }
      }
    }

    // Tool references
    for (const toolName of yaml.tools || []) {
      if (!this.isValidToolName(toolName)) {
        errors.push({
          field: 'tools',
          message: `Invalid tool name: ${toolName}`
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

### 4.2 Runtime Type Safety

```typescript
// forge/src/definitions/types.ts
export type AgentName = string & { readonly __brand: 'AgentName' };
export type ToolName = string & { readonly __brand: 'ToolName' };

export function createAgentName(name: string): AgentName {
  if (!isValidAgentName(name)) {
    throw new Error(`Invalid agent name: ${name}`);
  }
  return name as AgentName;
}

function isValidAgentName(name: string): boolean {
  // Alphanumeric, hyphens, underscores, colons only
  return /^[a-zA-Z0-9\-_:]+$/.test(name);
}
```

## 5. LangChain Integration

### 5.1 Converter Architecture

```typescript
// forge/src/definitions/converters/langchain.ts
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

export class LangChainConverter {
  convertAgent(definition: AgentDefinition): any {
    // Create LLM instance based on provider
    const llm = this.createLLM(definition.llm);

    // Convert tools
    const tools = this.convertTools(definition.tools, definition.custom_tools);

    // Build agent
    return {
      llm,
      tools,
      systemMessage: definition.system_prompt,
      config: definition.config,
    };
  }

  private createLLM(config: LLMConfig): any {
    switch (config.provider) {
      case 'anthropic':
        return new ChatAnthropic({
          modelName: config.model,
          temperature: config.temperature ?? 0,
          maxTokens: config.max_tokens ?? 4096,
        });

      case 'openai':
        return new ChatOpenAI({
          modelName: config.model,
          temperature: config.temperature ?? 0,
          maxTokens: config.max_tokens ?? 4096,
        });

      case 'google':
        return new ChatGoogleGenerativeAI({
          modelName: config.model,
          temperature: config.temperature ?? 0,
          maxOutputTokens: config.max_tokens ?? 4096,
        });

      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  private convertTools(
    builtInTools: string[],
    customTools: ToolDefinition[]
  ): any[] {
    const tools = [];

    // Convert built-in tools
    for (const toolName of builtInTools) {
      const toolDef = this.registry.getTool(toolName);
      if (toolDef) {
        tools.push(this.convertTool(toolDef));
      }
    }

    // Convert custom tools
    for (const toolDef of customTools) {
      tools.push(this.convertTool(toolDef));
    }

    return tools;
  }

  private convertTool(definition: ToolDefinition): any {
    // Convert to LangChain Tool format
    return {
      name: definition.name,
      description: definition.description,
      schema: this.buildParameterSchema(definition.parameters),
      func: this.createToolExecutor(definition),
    };
  }
}
```

## 6. Prompt Caching Support

### 6.1 Cache Source Resolution

```typescript
// forge/src/definitions/caching/resolver.ts
export class CachingResolver {
  async resolveCacheSources(
    sources: CachingSource[]
  ): Promise<CachedBlock[]> {
    const blocks: CachedBlock[] = [];

    for (const source of sources) {
      switch (source.type) {
        case 'file':
          blocks.push({
            type: 'text',
            text: await fs.readFile(source.path!, 'utf-8'),
            cache_control: { type: 'ephemeral' },
          });
          break;

        case 'glob':
          const files = await glob(source.pattern!);
          const combined = await this.combineFiles(files);
          blocks.push({
            type: 'text',
            text: combined,
            cache_control: { type: 'ephemeral' },
          });
          break;

        case 'inline':
          blocks.push({
            type: 'text',
            text: source.content!,
            cache_control: { type: 'ephemeral' },
          });
          break;

        case 'codex':
          // Fetch from Codex (requires @fractary/codex integration)
          const content = await this.fetchFromCodex(source.uri!);
          blocks.push({
            type: 'text',
            text: content,
            cache_control: { type: 'ephemeral' },
          });
          break;
      }
    }

    return blocks;
  }

  private async fetchFromCodex(uri: string): Promise<string> {
    // Parse codex://org/project/path
    const match = uri.match(/^codex:\/\/([^\/]+)\/([^\/]+)\/(.+)$/);
    if (!match) throw new Error(`Invalid codex URI: ${uri}`);

    const [, org, project, path] = match;

    // Use @fractary/codex to fetch
    // This creates optional runtime dependency on Codex
    if (this.codexClient) {
      return await this.codexClient.fetch({ org, project, path });
    } else {
      throw new Error('Codex integration not available');
    }
  }
}
```

## 7. Configuration

### 7.1 Forge Configuration

```json
// .fractary/plugins/forge/config.json
{
  "registry": {
    "local": {
      "enabled": true,
      "paths": [
        ".fractary/agents",
        ".fractary/tools"
      ]
    },
    "global": {
      "enabled": true,
      "path": "~/.fractary/registry"
    },
    "stockyard": {
      "enabled": false,
      "url": "https://stockyard.fractary.dev",
      "api_key": "${STOCKYARD_API_KEY}"
    }
  },

  "caching": {
    "enabled": true,
    "ttl": 3600
  },

  "validation": {
    "strict": true,
    "warn_on_missing_tools": true
  }
}
```

## 8. API Surface

### 8.1 Public API

```typescript
// forge/src/index.ts
export { DefinitionRegistry } from './definitions/registry';
export { DefinitionResolver } from './definitions/resolver';
export { DefinitionValidator } from './definitions/validator';
export { AgentFactory } from './definitions/factory';
export { ToolExecutor } from './definitions/executor';
export { LangChainConverter } from './definitions/converters/langchain';

// Types
export type {
  AgentDefinition,
  ToolDefinition,
  LLMConfig,
  CachingConfig,
  CachingSource,
  ToolParameter,
  ToolImplementation,
} from './definitions/schemas';

// Main API classes
export { AgentAPI, ToolAPI } from './definitions/api';
```

### 8.2 Usage Examples

```typescript
// Load and invoke an agent
import { AgentAPI } from '@fractary/forge';

const forge = new AgentAPI();

// List available agents
const agents = forge.listAgents({ tags: ['data-engineering'] });

// Get agent definition
const agentDef = forge.getAgent('corthion-loader-engineer');

// Load executable agent
const agent = forge.loadAgent('corthion-loader-engineer');

// Invoke agent
const result = await forge.invokeAgent(
  'corthion-loader-engineer',
  'Create loader for claims.medical_claims',
  { dataset: 'claims', table: 'medical_claims' }
);
```

## 9. Migration Path

### 9.1 Phase 1: Copy to Forge

1. Copy Python schemas to TypeScript equivalents
2. Port validation logic
3. Port LangChain converters
4. Create Forge API surface

### 9.2 Phase 2: FABER Integration

1. FABER imports from `@fractary/forge`
2. FABER delegates to Forge for agent/tool resolution
3. Keep FABER's workflow orchestration logic

### 9.3 Phase 3: Built-in Agent Migration

1. Migrate work, repo, spec, docs agents to Forge
2. Create first-party packages
3. Update FABER to consume from Forge

## 10. Success Criteria

- [ ] All FABER agent definitions can be loaded by Forge
- [ ] Validation catches all schema errors
- [ ] LangChain conversion produces executable agents
- [ ] Prompt caching works with all source types
- [ ] Codex integration works (optional runtime dependency)
- [ ] Performance: Agent loading < 100ms (cold), < 10ms (warm)
- [ ] 100% type safety in TypeScript API
- [ ] Comprehensive test coverage (>90%)

## 11. Open Questions

1. **Python SDK**: Should we also create a Python version of Forge for Python-based workflows?
2. **Versioning**: How do we handle version constraints (e.g., `agent@>=2.0.0`)?
3. **Forking**: What's the UX for forking an agent from Stockyard?
4. **Updates**: How do we notify users when new versions are available?

## 12. Related Specifications

- **SPEC-FORGE-002**: Agent Registry & Resolution
- **SPEC-FABER-002**: Forge Integration Interface
- **SPEC-MIGRATION-001**: Cross-Project Migration Guide
