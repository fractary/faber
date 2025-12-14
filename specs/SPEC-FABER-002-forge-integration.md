# SPEC-FABER-002: Forge Integration Interface

| Field | Value |
|-------|-------|
| **Status** | Draft |
| **Created** | 2025-12-14 |
| **Author** | Claude (with human direction) |
| **Project** | `@fractary/faber` |
| **Related** | SPEC-FORGE-001, SPEC-FORGE-002, SPEC-MIGRATION-001 |
| **Phase** | Phase 2: Migration |

## 1. Executive Summary

This specification defines how **FABER integrates with Forge** for agent and tool resolution, establishing the contract between FABER's workflow orchestration layer and Forge's artifact management layer.

### 1.1 Scope

This document covers:
- FABER's dependency on `@fractary/forge`
- Agent resolution interface contract
- Tool resolution interface contract
- Workflow execution with Forge-provided agents
- Configuration integration between FABER and Forge
- Error handling and fallback strategies
- Migration path from FABER's definitions to Forge

### 1.2 Design Goals

1. **Clean Separation** - FABER orchestrates, Forge manages artifacts
2. **No Definition Logic** - FABER delegates all agent/tool resolution to Forge
3. **Backward Compatible** - Existing FABER workflows continue working
4. **Graceful Degradation** - Sensible fallbacks if Forge unavailable
5. **Type Safe** - Strong TypeScript contracts between SDKs
6. **Performance** - No performance regression from migration

## 2. Architecture Overview

### 2.1 Current State (FABER Owns Definitions)

```
┌─────────────────────────────────────────────┐
│           FABER Workflow Engine             │
│  - Orchestrates 5-phase execution           │
│  - Loads agent definitions                  │  ← Problem: FABER doing too much
│  - Creates agent instances                  │
│  - Executes tools                           │
└─────────────────────────────────────────────┘
```

**Location:** `/mnt/c/GitHub/fractary/faber/python/faber/definitions/`

### 2.2 Target State (Forge Owns Definitions)

```
┌─────────────────────────────────────────────┐
│           FABER Workflow Engine             │
│  - Orchestrates 5-phase execution           │
│  - Requests agents from Forge               │  ← Clean separation
│  - Invokes agents                           │
└─────────────────────────────────────────────┘
                    │
                    │ forge.resolveAgent('frame-agent')
                    ▼
┌─────────────────────────────────────────────┐
│              Forge SDK                      │
│  - Resolves agents (local/global/Stockyard)│
│  - Manages versions and dependencies        │
│  - Returns executable agent instances       │
└─────────────────────────────────────────────┘
```

## 3. Integration Contract

### 3.1 Agent Resolution Interface

**FABER's Requirement:**

```typescript
// What FABER needs from Forge
interface IAgentResolver {
  /**
   * Resolve and load an agent by name
   * @param name - Agent name (e.g., "frame-agent" or "frame-agent@2.0.0")
   * @returns Executable agent instance
   * @throws AgentNotFoundError if agent doesn't exist
   */
  resolveAgent(name: string): Promise<ExecutableAgent>;

  /**
   * Check if an agent exists without loading it
   * @param name - Agent name
   * @returns true if agent exists in any registry
   */
  hasAgent(name: string): Promise<boolean>;

  /**
   * Get agent metadata without loading
   * @param name - Agent name
   * @returns Agent metadata (version, description, tags)
   */
  getAgentInfo(name: string): Promise<AgentInfo>;
}

interface ExecutableAgent {
  name: string;
  version: string;

  /**
   * Invoke the agent with a task
   * @param task - Task description or instruction
   * @param context - Optional context object
   * @returns Agent execution result
   */
  invoke(task: string, context?: Record<string, any>): Promise<AgentResult>;
}

interface AgentResult {
  output: string;
  messages: Message[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_hits?: number;
  };
  metadata?: Record<string, any>;
}
```

**Forge's Implementation:**

```typescript
// forge/src/definitions/api.ts
export class AgentAPI implements IAgentResolver {
  private resolver: AgentResolver;
  private factory: AgentFactory;
  private cache: RegistryCache;

  async resolveAgent(name: string): Promise<ExecutableAgent> {
    // Resolve definition
    const resolved = await this.resolver.resolve(name);

    // Create executable instance
    const agent = await this.factory.create(resolved.definition);

    return {
      name: resolved.definition.name,
      version: resolved.version,
      invoke: async (task: string, context?: Record<string, any>) => {
        return await agent.invoke(task, context);
      },
    };
  }

  async hasAgent(name: string): Promise<boolean> {
    try {
      await this.resolver.resolve(name);
      return true;
    } catch (e) {
      if (e instanceof AgentNotFoundError) return false;
      throw e;
    }
  }

  async getAgentInfo(name: string): Promise<AgentInfo> {
    const resolved = await this.resolver.resolve(name);
    return {
      name: resolved.definition.name,
      version: resolved.version,
      description: resolved.definition.description,
      tags: resolved.definition.tags,
      author: resolved.definition.author,
      source: resolved.source,
    };
  }
}
```

### 3.2 Tool Resolution Interface

**FABER's Requirement:**

```typescript
// What FABER needs from Forge
interface IToolResolver {
  /**
   * Resolve and load a tool by name
   * @param name - Tool name (e.g., "terraform-deploy")
   * @returns Executable tool instance
   */
  resolveTool(name: string): Promise<ExecutableTool>;

  /**
   * Execute a tool directly
   * @param name - Tool name
   * @param params - Tool parameters
   * @returns Tool execution result
   */
  executeTool(name: string, params: Record<string, any>): Promise<ToolResult>;
}

interface ExecutableTool {
  name: string;
  version: string;
  description: string;
  parameters: ToolParameter[];

  /**
   * Execute the tool
   * @param params - Tool parameters
   * @returns Tool execution result
   */
  execute(params: Record<string, any>): Promise<ToolResult>;
}

interface ToolResult {
  status: 'success' | 'failure';
  output: any;
  error?: string;
  duration_ms: number;
}
```

## 4. FABER Workflow Integration

### 4.1 Workflow Phase Execution

**Current (FABER owns definitions):**

```typescript
// faber/src/workflow/phase-executor.ts (CURRENT)
export class PhaseExecutor {
  async executePhase(phase: PhaseConfig): Promise<PhaseResult> {
    // FABER loads agent directly
    const agentDef = await this.definitionRegistry.getAgent(phase.agent);
    const agent = await this.agentFactory.create(agentDef);

    // Execute
    const result = await agent.invoke(phase.task);

    return result;
  }
}
```

**Target (Forge owns definitions):**

```typescript
// faber/src/workflow/phase-executor.ts (TARGET)
import { AgentAPI } from '@fractary/forge';

export class PhaseExecutor {
  private forge: AgentAPI;

  constructor() {
    this.forge = new AgentAPI(); // Forge handles all resolution
  }

  async executePhase(phase: PhaseConfig): Promise<PhaseResult> {
    // FABER delegates to Forge
    const agent = await this.forge.resolveAgent(phase.agent);

    // Execute
    const result = await agent.invoke(phase.task, phase.inputs);

    return result;
  }
}
```

### 4.2 Workflow YAML Processing

**Workflow Definition (No Change):**

```yaml
# software-dev.yaml
phases:
  - name: frame
    agent: frame-agent  # FABER passes this to Forge
    model: $models.classification
    tools:
      - fetch_issue
      - classify_work_type
```

**FABER Workflow Processor:**

```typescript
// faber/src/workflow/compiler.ts
export class WorkflowCompiler {
  private forge: AgentAPI;
  private toolResolver: ToolAPI;

  async compilePhase(phaseConfig: PhaseConfig): Promise<CompiledPhase> {
    // Resolve agent from Forge
    const agent = await this.forge.resolveAgent(phaseConfig.agent);

    // Resolve tools from Forge
    const tools = await Promise.all(
      phaseConfig.tools.map(toolName => this.toolResolver.resolveTool(toolName))
    );

    return {
      name: phaseConfig.name,
      agent,
      tools,
      config: phaseConfig,
    };
  }
}
```

## 5. Configuration Integration

### 5.1 FABER Configuration

**FABER's config continues to focus on workflow concerns:**

```json
// .fractary/plugins/faber/config.json
{
  "workflow": {
    "autonomy": "assisted",
    "max_retries": 3
  },

  "phases": {
    "frame": { "enabled": true },
    "architect": { "enabled": true, "refine_spec": true },
    "build": { "enabled": true },
    "evaluate": { "enabled": true, "max_retries": 3 },
    "release": { "enabled": true, "request_reviews": true }
  },

  "models": {
    "default": "anthropic:claude-sonnet-4-20250514",
    "classification": "anthropic:claude-3-5-haiku-20241022"
  },

  // NEW: Delegate to Forge for agent resolution
  "forge": {
    "enabled": true,
    "prefer_local": true  // Prefer project-local agents
  }
}
```

### 5.2 Forge Configuration

**Forge manages agent/tool concerns:**

```json
// .fractary/plugins/forge/config.json
{
  "registry": {
    "local": {
      "enabled": true,
      "paths": [".fractary/agents", ".fractary/tools"]
    },
    "global": {
      "enabled": true,
      "path": "~/.fractary/registry"
    },
    "stockyard": {
      "enabled": false,
      "url": "https://stockyard.fractary.dev"
    }
  },

  "caching": {
    "enabled": true,
    "ttl": 3600
  }
}
```

## 6. Error Handling

### 6.1 Agent Not Found

```typescript
// faber/src/workflow/phase-executor.ts
export class PhaseExecutor {
  async executePhase(phase: PhaseConfig): Promise<PhaseResult> {
    try {
      const agent = await this.forge.resolveAgent(phase.agent);
      return await agent.invoke(phase.task, phase.inputs);
    } catch (error) {
      if (error instanceof AgentNotFoundError) {
        throw new WorkflowError(
          `Agent '${phase.agent}' not found. ` +
          `Run 'forge install ${phase.agent}' or check your .fractary/agents/ directory.`,
          { phase: phase.name, agent: phase.agent }
        );
      }

      throw error;
    }
  }
}
```

### 6.2 Version Conflicts

```typescript
// If workflow specifies version but different version is locked
export class PhaseExecutor {
  async executePhase(phase: PhaseConfig): Promise<PhaseResult> {
    const requestedAgent = phase.agent; // e.g., "frame-agent@2.0.0"
    const lockfile = await this.lockfileManager.load();

    // Check if locked version differs
    const lockedVersion = lockfile.agents[phase.agent]?.version;

    if (lockedVersion && requestedAgent.includes('@')) {
      const [name, requestedVersion] = requestedAgent.split('@');

      if (lockedVersion !== requestedVersion) {
        this.logger.warn(
          `Version mismatch: workflow requests ${requestedAgent} ` +
          `but lockfile pins ${name}@${lockedVersion}. ` +
          `Using locked version.`
        );
      }
    }

    // Resolve (respects lockfile)
    const agent = await this.forge.resolveAgent(phase.agent);
    return await agent.invoke(phase.task, phase.inputs);
  }
}
```

## 7. Migration Path

### 7.1 Phase 1: Add Forge Dependency

```json
// faber/package.json
{
  "dependencies": {
    "@fractary/forge": "^1.0.0",
    // ... existing deps
  }
}
```

### 7.2 Phase 2: Dual-Mode Support

FABER supports both modes during transition:

```typescript
// faber/src/workflow/phase-executor.ts
export class PhaseExecutor {
  private forge?: AgentAPI;
  private legacyRegistry?: DefinitionRegistry;

  constructor(config: FaberConfig) {
    // New mode: use Forge
    if (config.forge?.enabled) {
      this.forge = new AgentAPI();
    }
    // Legacy mode: use FABER's definitions
    else {
      this.legacyRegistry = new DefinitionRegistry();
    }
  }

  async executePhase(phase: PhaseConfig): Promise<PhaseResult> {
    // Delegate to appropriate system
    if (this.forge) {
      return this.executeWithForge(phase);
    } else {
      return this.executeWithLegacy(phase);
    }
  }

  private async executeWithForge(phase: PhaseConfig): Promise<PhaseResult> {
    const agent = await this.forge!.resolveAgent(phase.agent);
    return await agent.invoke(phase.task, phase.inputs);
  }

  private async executeWithLegacy(phase: PhaseConfig): Promise<PhaseResult> {
    const agentDef = await this.legacyRegistry!.getAgent(phase.agent);
    const agent = await this.agentFactory.create(agentDef);
    return await agent.invoke(phase.task, phase.inputs);
  }
}
```

### 7.3 Phase 3: Remove Legacy Code

Once migration complete:
1. Remove `faber/python/faber/definitions/`
2. Remove dual-mode support
3. Forge becomes required dependency

## 8. Built-in Agents Migration

### 8.1 Current Built-in Agents (FABER)

```
faber/python/faber/agents/
├── frame.py
├── architect.py
├── build.py
├── evaluate.py
└── release.py
```

### 8.2 Target (Forge Packages)

These become first-party Forge packages:

```
~/.fractary/registry/agents/
├── frame-agent@2.0.0.yaml
├── architect-agent@1.5.0.yaml
├── build-agent@3.0.0.yaml
├── evaluate-agent@2.1.0.yaml
└── release-agent@1.8.0.yaml
```

**Installed by default:**

```bash
# During FABER initialization
faber init

# This runs:
forge install frame-agent@latest
forge install architect-agent@latest
forge install build-agent@latest
forge install evaluate-agent@latest
forge install release-agent@latest
```

### 8.3 Conversion Example

**Before (Python agent in FABER):**

```python
# faber/python/faber/agents/frame.py
class FrameAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="frame-agent",
            system_prompt=self.load_prompt(),
            tools=["fetch_issue", "classify_work_type"]
        )

    def load_prompt(self) -> str:
        return """
        You are the Frame phase agent in the FABER methodology.
        Your role is to gather requirements and classify work type.
        ...
        """
```

**After (YAML definition in Forge):**

```yaml
# ~/.fractary/registry/agents/frame-agent@2.0.0.yaml
name: frame-agent
type: agent
description: FABER Frame phase - gathers requirements and classifies work

llm:
  provider: anthropic
  model: claude-3-5-haiku-20241022
  temperature: 0.0
  max_tokens: 4096

system_prompt: |
  You are the Frame phase agent in the FABER methodology.
  Your role is to gather requirements and classify work type.
  ...

tools:
  - fetch_issue
  - classify_work_type
  - log_phase_start
  - log_phase_end

version: "2.0.0"
author: "Fractary Team"
tags:
  - faber
  - workflow
  - classification
```

## 9. Testing Strategy

### 9.1 Integration Tests

```typescript
// faber/tests/integration/forge-integration.test.ts
describe('FABER + Forge Integration', () => {
  it('should resolve agents from Forge', async () => {
    const executor = new PhaseExecutor({
      forge: { enabled: true }
    });

    const phase: PhaseConfig = {
      name: 'frame',
      agent: 'frame-agent',
      task: 'Classify this issue',
    };

    const result = await executor.executePhase(phase);

    expect(result.status).toBe('success');
  });

  it('should handle agent not found gracefully', async () => {
    const executor = new PhaseExecutor({
      forge: { enabled: true }
    });

    const phase: PhaseConfig = {
      name: 'frame',
      agent: 'nonexistent-agent',
      task: 'Classify this issue',
    };

    await expect(executor.executePhase(phase)).rejects.toThrow(
      WorkflowError
    );
  });

  it('should respect lockfile versions', async () => {
    // Create lockfile with specific version
    const lockfile = {
      agents: {
        'frame-agent': { version: '1.5.0' }
      }
    };

    await fs.writeJson('.fractary/plugins/forge/lockfile.json', lockfile);

    const executor = new PhaseExecutor({
      forge: { enabled: true }
    });

    const agent = await executor.forge.resolveAgent('frame-agent');

    expect(agent.version).toBe('1.5.0');
  });
});
```

## 10. Performance Considerations

### 10.1 Agent Resolution Caching

```typescript
// faber/src/workflow/agent-cache.ts
export class WorkflowAgentCache {
  private cache = new Map<string, ExecutableAgent>();

  async getOrResolve(
    name: string,
    forge: AgentAPI
  ): Promise<ExecutableAgent> {
    // Check cache
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    // Resolve from Forge
    const agent = await forge.resolveAgent(name);

    // Cache for workflow duration
    this.cache.set(name, agent);

    return agent;
  }

  clear(): void {
    this.cache.clear();
  }
}
```

### 10.2 Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Agent resolution (first call) | < 200ms | Includes Forge lookup + instantiation |
| Agent resolution (cached) | < 10ms | In-memory cache hit |
| Phase execution overhead | < 50ms | FABER → Forge → Agent |

## 11. Backward Compatibility

### 11.1 Gradual Migration

Users can migrate at their own pace:

1. **Day 1**: FABER uses internal definitions (legacy mode)
2. **Day 30**: Enable Forge mode, definitions still in FABER
3. **Day 60**: Migrate definitions to Forge, dual-mode support
4. **Day 90**: Remove legacy mode, Forge required

### 11.2 Configuration Flag

```json
// .fractary/plugins/faber/config.json
{
  "forge": {
    "enabled": false,  // Default: false (legacy mode)
    "migration_warnings": true  // Warn about upcoming deprecation
  }
}
```

## 12. Success Criteria

- [ ] FABER workflows execute identically with Forge integration
- [ ] No performance regression (< 5% overhead)
- [ ] Error messages are helpful and actionable
- [ ] Lockfile correctly pins versions
- [ ] Legacy mode continues working during transition
- [ ] All integration tests pass
- [ ] Documentation updated with migration guide

## 13. Open Questions

1. **Python Support**: Should FABER's Python SDK also integrate with Forge? (Currently spec focuses on TypeScript)
2. **Hot Reload**: Should agent updates be hot-reloadable during workflow execution?
3. **Telemetry**: How do we track which agents are being used most?
4. **Fallbacks**: Should FABER have embedded fallback agents if Forge fails?

## 14. Related Specifications

- **SPEC-FORGE-001**: Agent & Tool Definition System Architecture
- **SPEC-FORGE-002**: Agent Registry & Resolution
- **SPEC-MIGRATION-001**: Cross-Project Migration Guide
