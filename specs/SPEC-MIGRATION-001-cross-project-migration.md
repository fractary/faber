# SPEC-MIGRATION-001: Cross-Project Migration Guide

| Field | Value |
|-------|-------|
| **Status** | Draft |
| **Created** | 2025-12-14 |
| **Author** | Claude (with human direction) |
| **Projects** | `@fractary/faber` + `@fractary/forge` |
| **Related** | SPEC-FORGE-001, SPEC-FORGE-002, SPEC-FABER-002 |
| **Phase** | All Phases |

## 1. Executive Summary

This specification provides a **step-by-step migration plan** for moving agent and tool definition capabilities from `@fractary/faber` to `@fractary/forge`, establishing clear ownership boundaries and enabling the Stockyard marketplace vision.

### 1.1 Migration Goals

1. **Move Definitions to Forge** - Agent/tool schemas and registry move from FABER to Forge
2. **FABER as Consumer** - FABER becomes a consumer of Forge's agent resolution API
3. **Built-in Agents as Packages** - work, repo, spec, docs agents become first-party Forge packages
4. **Zero Downtime** - Existing FABER workflows continue working throughout migration
5. **Backward Compatibility** - Support legacy mode during transition

### 1.2 Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1: Foundation** | 2 weeks | Forge definition system, registry, resolution |
| **Phase 2: Integration** | 2 weeks | FABER integrates with Forge, dual-mode support |
| **Phase 3: Migration** | 3 weeks | Built-in agents → Forge packages, deprecate legacy |
| **Phase 4: Cleanup** | 1 week | Remove legacy code, documentation |

## 2. Source Code Locations

### 2.1 FABER Project

**Current Location:** `/mnt/c/GitHub/fractary/faber/`

**Files to Migrate:**

```
python/faber/definitions/          → TO FORGE
├── __init__.py
├── schemas.py                     → Core schemas (Agent, Tool)
├── api.py                        → AgentAPI, ToolAPI
├── registry.py                   → DefinitionRegistry
├── agent_factory.py              → AgentFactory
├── tool_executor.py              → Tool execution
└── converters.py                 → LangChain converters

python/faber/agents/               → TO FORGE (as YAML)
├── __init__.py
├── base.py
├── frame.py                      → frame-agent.yaml
├── architect.py                  → architect-agent.yaml
├── build.py                      → build-agent.yaml
├── evaluate.py                   → evaluate-agent.yaml
└── release.py                    → release-agent.yaml
```

**Files to Update (Integration):**

```
typescript/src/workflow/           → UPDATED
├── phase-executor.ts             → Use Forge for agent resolution
├── compiler.ts                   → Resolve agents from Forge
└── workflow-engine.ts            → Integration with Forge API
```

### 2.2 Forge Project

**Current Location:** `/mnt/c/GitHub/fractary/forge/`

**New Directories to Create:**

```
src/
├── definitions/                   → NEW
│   ├── schemas/                  → TypeScript type definitions
│   │   ├── agent.ts
│   │   ├── tool.ts
│   │   └── index.ts
│   │
│   ├── registry/                 → Agent/tool registry
│   │   ├── resolver.ts          → Resolution algorithm
│   │   ├── cache.ts             → Multi-level caching
│   │   ├── lockfile.ts          → Version locking
│   │   └── manifest.ts          → Package metadata
│   │
│   ├── factory/                  → Agent instantiation
│   │   ├── agent-factory.ts
│   │   └── langchain-factory.ts
│   │
│   ├── executor/                 → Tool execution
│   │   ├── tool-executor.ts
│   │   ├── bash-executor.ts
│   │   ├── python-executor.ts
│   │   └── http-executor.ts
│   │
│   ├── converters/               → Format converters
│   │   ├── langchain.ts         → LangChain integration
│   │   └── yaml-loader.ts       → YAML parsing
│   │
│   └── api.ts                    → Public API (AgentAPI, ToolAPI)
│
├── commands/                      → NEW CLI commands
│   ├── install.ts
│   ├── update.ts
│   ├── fork.ts
│   └── list.ts
│
└── stockyard/                     → NEW (future)
    ├── client.ts                 → Stockyard API client
    └── search.ts                 → Search/discovery
```

## 3. Phase 1: Foundation (Forge)

### 3.1 Week 1: Core Schemas & Registry

**Project:** `@fractary/forge`

**Tasks:**

1. **Create TypeScript Schemas**
   - Port Python Pydantic schemas to TypeScript
   - File: `src/definitions/schemas/agent.ts`
   - File: `src/definitions/schemas/tool.ts`
   - Reference: `/mnt/c/GitHub/fractary/faber/python/faber/definitions/schemas.py`

2. **Implement YAML Loader**
   - Parse YAML definitions
   - Validate against schemas
   - File: `src/definitions/converters/yaml-loader.ts`

3. **Create Registry**
   - File system scanning
   - Multi-source registry (local/global)
   - File: `src/definitions/registry/resolver.ts`

**Validation:**

```bash
# Create test agent definition
cat > test-agent.yaml << EOF
name: test-agent
type: agent
llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
system_prompt: "Test agent"
tools: []
version: "1.0.0"
tags: ["test"]
EOF

# Load and validate
forge validate test-agent.yaml
# Expected: ✓ Valid agent definition
```

### 3.2 Week 2: Resolution & Caching

**Tasks:**

1. **Implement Resolution Algorithm**
   - Priority: local → global → Stockyard (stub)
   - Version constraint matching
   - File: `src/definitions/registry/resolver.ts`

2. **Add Caching Layer**
   - In-memory cache
   - File system cache
   - File: `src/definitions/registry/cache.ts`

3. **Create Lockfile Manager**
   - Generate lockfiles
   - Pin exact versions
   - File: `src/definitions/registry/lockfile.ts`

4. **Add Manifest Support**
   - Package metadata
   - Version tracking
   - File: `src/definitions/registry/manifest.ts`

**Validation:**

```typescript
// Test resolution
import { AgentResolver } from '@fractary/forge';

const resolver = new AgentResolver();

// Should find in project-local
const local = await resolver.resolve('my-agent');
assert(local.source === 'local');

// Should find in global
const global = await resolver.resolve('frame-agent');
assert(global.source === 'global');

// Should handle version constraints
const versioned = await resolver.resolve('frame-agent@^2.0.0');
assert(versioned.version.startsWith('2.'));
```

## 4. Phase 2: Integration (FABER)

### 4.1 Week 3: Add Forge Dependency

**Project:** `@fractary/faber`

**Tasks:**

1. **Add Dependency**
   ```bash
   cd /mnt/c/GitHub/fractary/faber
   npm install --save @fractary/forge
   ```

2. **Create Dual-Mode Support**
   - Add feature flag: `config.forge.enabled`
   - File: `typescript/src/config/faber-config.ts`

3. **Update Phase Executor**
   - Add Forge integration path
   - Keep legacy path
   - File: `typescript/src/workflow/phase-executor.ts`

**Code Changes:**

```typescript
// typescript/src/workflow/phase-executor.ts
import { AgentAPI } from '@fractary/forge';

export class PhaseExecutor {
  private forge?: AgentAPI;
  private legacyRegistry?: DefinitionRegistry;

  constructor(config: FaberConfig) {
    if (config.forge?.enabled) {
      this.forge = new AgentAPI();
      this.logger.info('Using Forge for agent resolution');
    } else {
      this.legacyRegistry = new DefinitionRegistry();
      this.logger.warn(
        'Using legacy mode. Consider enabling Forge: config.forge.enabled = true'
      );
    }
  }

  async executePhase(phase: PhaseConfig): Promise<PhaseResult> {
    const agent = this.forge
      ? await this.forge.resolveAgent(phase.agent)
      : await this.resolveLegacy(phase.agent);

    return await agent.invoke(phase.task, phase.inputs);
  }

  private async resolveLegacy(name: string): Promise<ExecutableAgent> {
    const agentDef = await this.legacyRegistry!.getAgent(name);
    return await this.agentFactory.create(agentDef);
  }
}
```

**Validation:**

```bash
# Test with Forge disabled (legacy mode)
cat > .fractary/plugins/faber/config.json << EOF
{
  "forge": { "enabled": false }
}
EOF

faber run 123
# Expected: Works with legacy definitions

# Test with Forge enabled
cat > .fractary/plugins/faber/config.json << EOF
{
  "forge": { "enabled": true }
}
EOF

faber run 123
# Expected: Works with Forge resolution
```

### 4.2 Week 4: Integration Testing

**Tasks:**

1. **Create Integration Tests**
   - File: `typescript/tests/integration/forge-integration.test.ts`
   - Test both modes (legacy + Forge)
   - Test error handling

2. **Performance Testing**
   - Measure overhead of Forge integration
   - Target: < 5% regression
   - File: `typescript/tests/performance/forge-overhead.test.ts`

3. **Documentation**
   - Update README with Forge integration
   - Migration guide for users
   - File: `docs/guides/forge-migration.md`

## 5. Phase 3: Built-in Agent Migration

### 5.1 Week 5-6: Convert Python Agents to YAML

**Project:** Both (`@fractary/faber` → `@fractary/forge`)

**Tasks:**

For each built-in agent (frame, architect, build, evaluate, release):

1. **Extract System Prompt**
   - From Python class → YAML `system_prompt`

2. **Define Tool Dependencies**
   - List required tools in `tools` array

3. **Add Metadata**
   - Version, author, tags, description

4. **Create YAML Definition**
   - File: `forge/definitions/agents/{name}.yaml`

**Example Conversion:**

**Before (Python):**

```python
# faber/python/faber/agents/frame.py
class FrameAgent(BaseAgent):
    """Frame phase agent - gathers requirements and classifies work type."""

    def __init__(self):
        super().__init__(
            name="frame-agent",
            model="claude-3-5-haiku-20241022",
            tools=["fetch_issue", "classify_work_type", "log_phase_start"]
        )

    def get_system_prompt(self) -> str:
        return """
        You are the Frame phase agent in the FABER methodology.

        Your responsibilities:
        1. Fetch and analyze the work item
        2. Classify the work type (feature, bug, chore, patch)
        3. Extract key requirements
        4. Set context for subsequent phases

        Available tools:
        - fetch_issue: Retrieve issue details from work tracker
        - classify_work_type: Classify work as feature/bug/chore/patch
        - log_phase_start: Log phase start event

        Output format:
        {
          "work_type": "feature|bug|chore|patch",
          "requirements": ["req1", "req2", ...],
          "issue": { ... }
        }
        """
```

**After (YAML):**

```yaml
# forge/definitions/agents/frame-agent.yaml
name: frame-agent
type: agent
description: |
  Frame phase agent for FABER methodology.
  Gathers requirements and classifies work type.

llm:
  provider: anthropic
  model: claude-3-5-haiku-20241022
  temperature: 0.0
  max_tokens: 4096

system_prompt: |
  You are the Frame phase agent in the FABER methodology.

  Your responsibilities:
  1. Fetch and analyze the work item
  2. Classify the work type (feature, bug, chore, patch)
  3. Extract key requirements
  4. Set context for subsequent phases

  Available tools:
  - fetch_issue: Retrieve issue details from work tracker
  - classify_work_type: Classify work as feature/bug/chore/patch
  - log_phase_start: Log phase start event

  Output format:
  {
    "work_type": "feature|bug|chore|patch",
    "requirements": ["req1", "req2", ...],
    "issue": { ... }
  }

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
  - frame-phase
```

**Validation:**

```bash
# Validate converted agent
forge validate forge/definitions/agents/frame-agent.yaml
# Expected: ✓ Valid

# Test invocation
forge exec frame-agent --task "Classify issue #123"
# Expected: Successfully executes
```

### 5.2 Week 7: Package & Distribute

**Tasks:**

1. **Create First-Party Package Repository**
   - Location: Global registry `~/.fractary/registry/agents/`
   - Copy YAML definitions
   - Create manifests

2. **Update FABER Init**
   - Install first-party agents on `faber init`

```typescript
// faber/src/commands/init.ts
export class InitCommand {
  async run() {
    // ... existing init logic ...

    // Install first-party agents via Forge
    this.logger.info('Installing FABER agents...');

    const agents = [
      'frame-agent@2.0.0',
      'architect-agent@1.5.0',
      'build-agent@3.0.0',
      'evaluate-agent@2.1.0',
      'release-agent@1.8.0',
    ];

    for (const agent of agents) {
      await this.forge.install(agent);
      this.logger.success(`Installed ${agent}`);
    }
  }
}
```

3. **Deprecation Warnings**
   - Warn when Python agents are used
   - Point to YAML equivalents

```python
# faber/python/faber/agents/frame.py
class FrameAgent(BaseAgent):
    def __init__(self):
        warnings.warn(
            "FrameAgent Python class is deprecated. "
            "Use 'frame-agent' YAML definition via Forge instead.",
            DeprecationWarning,
            stacklevel=2
        )
        # ... rest of implementation ...
```

## 6. Phase 4: Cleanup

### 6.1 Week 8: Remove Legacy Code

**Project:** `@fractary/faber`

**Tasks:**

1. **Remove Python Definitions**
   ```bash
   cd /mnt/c/GitHub/fractary/faber
   rm -rf python/faber/definitions/
   rm -rf python/faber/agents/
   ```

2. **Remove Dual-Mode Support**
   - Delete legacy code path in `phase-executor.ts`
   - Make Forge required dependency

3. **Update Configuration**
   - Remove `config.forge.enabled` flag
   - Forge is always used

4. **Update Tests**
   - Remove legacy mode tests
   - Keep Forge integration tests

5. **Update Documentation**
   - README updates
   - Migration complete notice
   - Update examples

**Final State:**

```typescript
// typescript/src/workflow/phase-executor.ts (FINAL)
import { AgentAPI } from '@fractary/forge';

export class PhaseExecutor {
  private forge: AgentAPI;  // No longer optional

  constructor() {
    this.forge = new AgentAPI();
  }

  async executePhase(phase: PhaseConfig): Promise<PhaseResult> {
    // Only Forge path remains
    const agent = await this.forge.resolveAgent(phase.agent);
    return await agent.invoke(phase.task, phase.inputs);
  }
}
```

## 7. Migration Checklist

### 7.1 Forge Project

- [ ] Create TypeScript schemas (agent, tool)
- [ ] Implement YAML loader and validator
- [ ] Create registry with multi-source support
- [ ] Implement resolution algorithm
- [ ] Add caching layer (memory + disk)
- [ ] Create lockfile manager
- [ ] Add manifest support
- [ ] Implement AgentFactory
- [ ] Implement ToolExecutor (bash, python, http)
- [ ] Create LangChain converters
- [ ] Add public API (AgentAPI, ToolAPI)
- [ ] Create CLI commands (install, update, fork, list)
- [ ] Add tests (unit + integration)
- [ ] Write documentation

### 7.2 FABER Project

- [ ] Add @fractary/forge dependency
- [ ] Create dual-mode support
- [ ] Update PhaseExecutor to use Forge
- [ ] Update WorkflowCompiler to use Forge
- [ ] Add integration tests
- [ ] Performance testing
- [ ] Convert Python agents to YAML
- [ ] Update init command to install agents
- [ ] Add deprecation warnings
- [ ] Remove legacy code
- [ ] Update documentation
- [ ] Update examples

### 7.3 Cross-Project

- [ ] Define interface contracts
- [ ] Version alignment (Forge 1.0 + FABER 2.0)
- [ ] End-to-end testing
- [ ] Performance benchmarks
- [ ] Migration guide for users
- [ ] Release notes

## 8. Testing Strategy

### 8.1 Unit Tests

**Forge:**
- Schema validation
- YAML parsing
- Resolution algorithm
- Caching logic
- Version matching
- Lockfile generation

**FABER:**
- Forge integration
- Dual-mode switching
- Error handling
- Configuration loading

### 8.2 Integration Tests

**Cross-Project:**
- FABER workflow using Forge agents
- Version pinning via lockfile
- Agent not found errors
- Tool resolution
- Performance regression

### 8.3 End-to-End Tests

```bash
# Full workflow test
cd /tmp/test-project
faber init
faber run 123

# Should:
# 1. Install agents via Forge
# 2. Create lockfile
# 3. Execute workflow
# 4. All phases succeed
```

## 9. Rollback Plan

If critical issues discovered during migration:

1. **Revert FABER to Legacy Mode**
   ```json
   {
     "forge": { "enabled": false }
   }
   ```

2. **Hotfix Release**
   - Restore Python agents
   - Keep dual-mode support longer

3. **Investigation Period**
   - Fix issues in Forge
   - Re-test integration

4. **Resume Migration**
   - Once stable, re-enable Forge mode

## 10. Communication Plan

### 10.1 User Communication

**Before Migration:**
- Blog post: "The Future of FABER Agents"
- Explain vision (Forge, Stockyard)
- Timeline and benefits

**During Migration:**
- Release notes for each phase
- Migration guide
- Video walkthrough

**After Migration:**
- Success announcement
- Showcase new capabilities (forking, versioning)
- Invite contributions to Stockyard

### 10.2 Developer Communication

- Spec reviews (these documents)
- Architecture discussions
- Code reviews
- Regular sync meetings

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Migration completion | 100% | All code migrated, legacy removed |
| Performance regression | < 5% | Benchmark before/after |
| Test coverage | > 90% | Both Forge and FABER |
| User migration | > 80% in 30 days | Telemetry (if available) |
| Breaking changes | 0 | Existing workflows work |
| Documentation | Complete | All docs updated |

## 12. Post-Migration Roadmap

After migration complete:

1. **Stockyard Integration (Phase 3)**
   - Remote marketplace
   - Search and discovery
   - Ratings and reviews

2. **Premium Packages (Phase 3)**
   - Payment integration
   - Licensing
   - Private packages

3. **Advanced Features**
   - Agent composition (agents using agents)
   - Hot reload during development
   - Agent versioning strategies
   - Dependency visualization

## 13. Open Questions & Decisions Needed

1. **Python SDK**: Should Forge have a Python SDK too?
2. **Breaking Changes**: When can we introduce breaking changes to agent schemas?
3. **Versioning**: What's the versioning strategy for built-in agents?
4. **Support Window**: How long do we support legacy mode?
5. **Stockyard Timeline**: When to start Stockyard development?

## 14. Appendices

### Appendix A: File Migration Map

| Source (FABER) | Destination (Forge) | Status |
|----------------|---------------------|--------|
| python/faber/definitions/schemas.py | src/definitions/schemas/ | To migrate |
| python/faber/definitions/api.py | src/definitions/api.ts | To migrate |
| python/faber/definitions/registry.py | src/definitions/registry/ | To migrate |
| python/faber/definitions/agent_factory.py | src/definitions/factory/ | To migrate |
| python/faber/definitions/tool_executor.py | src/definitions/executor/ | To migrate |
| python/faber/definitions/converters.py | src/definitions/converters/ | To migrate |
| python/faber/agents/frame.py | definitions/agents/frame-agent.yaml | To convert |
| python/faber/agents/architect.py | definitions/agents/architect-agent.yaml | To convert |
| python/faber/agents/build.py | definitions/agents/build-agent.yaml | To convert |
| python/faber/agents/evaluate.py | definitions/agents/evaluate-agent.yaml | To convert |
| python/faber/agents/release.py | definitions/agents/release-agent.yaml | To convert |

### Appendix B: Dependencies

```json
// forge/package.json
{
  "name": "@fractary/forge",
  "version": "1.0.0",
  "dependencies": {
    "@langchain/anthropic": "^0.1.0",
    "@langchain/openai": "^0.1.0",
    "@langchain/google-genai": "^0.0.1",
    "js-yaml": "^4.1.0",
    "semver": "^7.5.4",
    "glob": "^10.3.0",
    "fs-extra": "^11.2.0"
  }
}

// faber/package.json
{
  "name": "@fractary/faber",
  "version": "2.0.0",
  "dependencies": {
    "@fractary/forge": "^1.0.0",  // NEW
    // ... existing deps
  }
}
```

### Appendix C: Directory Structure After Migration

```
# FABER Project (simplified)
/mnt/c/GitHub/fractary/faber/
├── typescript/src/
│   ├── workflow/          # Workflow orchestration (keeps this)
│   ├── state/            # State management (keeps this)
│   └── config/           # Configuration (keeps this)
├── python/faber/
│   ├── workflow/         # Python workflow SDK
│   └── [definitions/]    # REMOVED
└── specs/
    ├── SPEC-FORGE-001-agent-tool-definition-system.md
    ├── SPEC-FORGE-002-agent-registry-resolution.md
    ├── SPEC-FABER-002-forge-integration.md
    └── SPEC-MIGRATION-001-cross-project-migration.md

# Forge Project (expanded)
/mnt/c/GitHub/fractary/forge/
├── src/
│   ├── definitions/      # NEW: Agent/tool system
│   ├── resolvers/       # Existing: Asset resolvers
│   ├── commands/        # NEW: CLI commands
│   └── stockyard/       # NEW: Marketplace integration
├── definitions/
│   ├── agents/          # NEW: First-party agents
│   │   ├── frame-agent.yaml
│   │   ├── architect-agent.yaml
│   │   ├── build-agent.yaml
│   │   ├── evaluate-agent.yaml
│   │   └── release-agent.yaml
│   └── tools/           # NEW: First-party tools
└── docs/
    └── migration-from-faber.md
```

## 15. Related Specifications

- **SPEC-FORGE-001**: Agent & Tool Definition System Architecture
- **SPEC-FORGE-002**: Agent Registry & Resolution
- **SPEC-FABER-002**: Forge Integration Interface
