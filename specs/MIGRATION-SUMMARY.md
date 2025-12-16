# FABER → Forge Migration: Specification Summary

**Created:** 2025-12-14
**Status:** Ready for Review

## Overview

This document summarizes the specifications created for migrating agent and tool definition capabilities from `@fractary/faber` to `@fractary/forge`.

## Strategic Vision

```
┌─────────────────────────────────────────────┐
│          Stockyard (Discovery)              │
│  - Marketplace of agents, tools, skills     │
│  - Ratings, evals, search                   │
│  - Free + premium packages                  │
└─────────────────┬───────────────────────────┘
                  │ Browse, search, discover
                  ▼
┌─────────────────────────────────────────────┐
│      Forge (Deployment & Customization)     │
│  - Pull from Stockyard                      │
│  - Fork and customize                       │
│  - Manage versions                          │
│  - Deploy to projects                       │
└─────────────────┬───────────────────────────┘
                  │ Provide agents/tools
                  ▼
┌─────────────────────────────────────────────┐
│         FABER (Orchestration)               │
│  - Execute workflows                        │
│  - 5-phase methodology                      │
│  - Consume agents from Forge                │
└─────────────────────────────────────────────┘
```

## Created Specifications

### SPEC-FORGE-001: Agent & Tool Definition System Architecture

**Project:** `@fractary/forge`
**Phase:** Foundation
**File:** `specs/SPEC-FORGE-001-agent-tool-definition-system.md`

**Key Points:**
- Defines YAML schema for agents and tools
- LLM configuration (Anthropic, OpenAI, Google)
- Prompt caching support (Claude-specific)
- Tool implementation types (bash, python, http)
- LangChain integration
- Codex integration for caching sources
- Migration path from FABER's Python schemas

**Example Agent Definition:**
```yaml
name: corthion-loader-engineer
type: agent
llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
system_prompt: |
  You are a specialized data engineering agent...
tools:
  - read_file
  - write_file
caching:
  enabled: true
  cache_sources:
    - type: codex
      uri: codex://corthion/patterns/data-loaders
      label: "Corthion Loader Patterns"
```

---

### SPEC-FORGE-002: Agent Registry & Resolution

**Project:** `@fractary/forge`
**Phase:** Foundation
**File:** `specs/SPEC-FORGE-002-agent-registry-resolution.md`

**Key Points:**
- Three-tier registry: local → global → Stockyard
- Version constraint resolution (semver)
- Lockfile for version pinning
- Fork workflow (fork → customize → merge upstream)
- Multi-level caching (memory → disk → network)
- Update notifications
- Package manifests with metadata

**Resolution Algorithm:**
```typescript
forge.resolveAgent('frame-agent@^2.0.0')
  → Check .fractary/agents/frame-agent.yaml (local)
  → Check ~/.fractary/registry/agents/frame-agent@*.yaml (global)
  → Fetch from Stockyard API (remote)
  → Cache to global registry
  → Return executable agent
```

---

### SPEC-FABER-002: Forge Integration Interface

**Project:** `@fractary/faber`
**Phase:** Integration
**File:** `specs/SPEC-FABER-002-forge-integration.md`

**Key Points:**
- FABER depends on `@fractary/forge`
- Agent resolution interface contract
- Tool resolution interface contract
- Dual-mode support during migration (legacy + Forge)
- Workflow execution with Forge-provided agents
- Error handling and fallback strategies
- Performance targets (< 5% overhead)

**Integration Pattern:**
```typescript
// Before (FABER owns definitions)
const agentDef = await this.definitionRegistry.getAgent('frame-agent');
const agent = await this.agentFactory.create(agentDef);

// After (Forge owns definitions)
const agent = await this.forge.resolveAgent('frame-agent');
```

---

### SPEC-MIGRATION-001: Cross-Project Migration Guide

**Projects:** Both
**Phase:** All
**File:** `specs/SPEC-MIGRATION-001-cross-project-migration.md`

**Key Points:**
- Step-by-step migration plan (4 phases, 8 weeks)
- Source code locations and file mapping
- Detailed task breakdown per week
- Built-in agent conversion (Python → YAML)
- Testing strategy (unit, integration, e2e)
- Rollback plan
- Success metrics

**Timeline:**
| Phase | Duration | Focus |
|-------|----------|-------|
| Phase 1: Foundation | 2 weeks | Forge definition system |
| Phase 2: Integration | 2 weeks | FABER + Forge integration |
| Phase 3: Migration | 3 weeks | Built-in agents → packages |
| Phase 4: Cleanup | 1 week | Remove legacy code |

## File Migration Summary

### From FABER (`/mnt/c/GitHub/fractary/faber/`)

**To Be Migrated to Forge:**
```
python/faber/definitions/schemas.py     → forge/src/definitions/schemas/
python/faber/definitions/api.py         → forge/src/definitions/api.ts
python/faber/definitions/registry.py    → forge/src/definitions/registry/
python/faber/definitions/agent_factory.py → forge/src/definitions/factory/
python/faber/definitions/tool_executor.py → forge/src/definitions/executor/
python/faber/definitions/converters.py  → forge/src/definitions/converters/
```

**To Be Converted to YAML:**
```
python/faber/agents/frame.py       → forge/definitions/agents/frame-agent.yaml
python/faber/agents/architect.py   → forge/definitions/agents/architect-agent.yaml
python/faber/agents/build.py       → forge/definitions/agents/build-agent.yaml
python/faber/agents/evaluate.py    → forge/definitions/agents/evaluate-agent.yaml
python/faber/agents/release.py     → forge/definitions/agents/release-agent.yaml
```

**To Be Updated (Integration):**
```
typescript/src/workflow/phase-executor.ts   → Use Forge API
typescript/src/workflow/compiler.ts         → Use Forge API
typescript/src/workflow/workflow-engine.ts  → Use Forge API
```

### To Forge (`/mnt/c/GitHub/fractary/forge/`)

**New Directories:**
```
src/definitions/          # NEW: Core agent/tool system
├── schemas/
├── registry/
├── factory/
├── executor/
├── converters/
└── api.ts

definitions/              # NEW: First-party definitions
├── agents/
│   ├── frame-agent.yaml
│   ├── architect-agent.yaml
│   ├── build-agent.yaml
│   ├── evaluate-agent.yaml
│   └── release-agent.yaml
└── tools/

src/commands/             # NEW: CLI commands
├── install.ts
├── update.ts
├── fork.ts
└── list.ts
```

## Key Design Decisions

### 1. YAML + LangChain

**Decision:** Use YAML for definitions with LangChain runtime
**Rationale:**
- Human-readable, version-controllable
- Industry standard (like Docker Compose, GitHub Actions)
- LangChain provides robust agent runtime
- Supports multiple LLM providers

### 2. Three-Tier Registry

**Decision:** Local → Global → Stockyard
**Rationale:**
- Local allows project-specific customization
- Global enables sharing across projects
- Stockyard provides marketplace
- Similar to npm (node_modules → global → registry)

### 3. Forge Owns, FABER Consumes

**Decision:** Clean separation of concerns
**Rationale:**
- Single Responsibility Principle
- FABER focuses on orchestration
- Forge focuses on artifact management
- Enables marketplace vision
- Each SDK better at its core job

### 4. Semantic Versioning

**Decision:** Use semver for all agents/tools
**Rationale:**
- Industry standard
- Version constraints (^, ~, >=)
- Breaking change management
- Familiar to developers

### 5. Fork-First Customization

**Decision:** Easy forking with upstream tracking
**Rationale:**
- Encourages experimentation
- Preserves connection to upstream
- Merge upstream updates
- Similar to Git workflows

## Success Criteria

- [ ] All FABER workflows work identically with Forge
- [ ] Performance regression < 5%
- [ ] 100% test coverage on new code
- [ ] Built-in agents successfully migrated
- [ ] Documentation complete
- [ ] Zero breaking changes for users
- [ ] Forge + FABER integration tested end-to-end

## Next Steps

### Immediate (This Week)

1. **Review Specifications**
   - Team review of all 4 specs
   - Address open questions
   - Finalize design decisions

2. **Kickoff Planning**
   - Assign tasks
   - Set up tracking
   - Create branches

### Phase 1 (Weeks 1-2)

1. **Start Forge Development**
   - Create schemas (TypeScript)
   - Implement YAML loader
   - Build registry
   - Add resolution algorithm
   - Create caching layer

2. **Testing**
   - Unit tests
   - Integration tests
   - Validation tests

### Phase 2 (Weeks 3-4)

1. **FABER Integration**
   - Add Forge dependency
   - Dual-mode support
   - Update phase executor
   - Integration tests

2. **Documentation**
   - Migration guide
   - API documentation
   - Examples

### Phase 3 (Weeks 5-7)

1. **Agent Migration**
   - Convert Python agents to YAML
   - Package as first-party Forge packages
   - Update FABER init
   - Testing

### Phase 4 (Week 8)

1. **Cleanup**
   - Remove legacy code
   - Final documentation
   - Release preparation

## Open Questions

From the specifications:

1. **Python SDK**: Should Forge have a Python SDK for Python-based workflows?
2. **Private Registries**: Support for private Stockyard instances?
3. **CDN**: Should Stockyard serve definitions via CDN?
4. **Circular Dependencies**: How to prevent/handle?
5. **Versioning Strategy**: For built-in agents specifically?
6. **Support Window**: How long to maintain legacy mode?
7. **Stockyard Timeline**: When to start marketplace development?

## Resources

### Specifications
- [SPEC-FORGE-001](./SPEC-FORGE-001-agent-tool-definition-system.md)
- [SPEC-FORGE-002](./SPEC-FORGE-002-agent-registry-resolution.md)
- [SPEC-FABER-002](./SPEC-FABER-002-forge-integration.md)
- [SPEC-MIGRATION-001](./SPEC-MIGRATION-001-cross-project-migration.md)

### Source Code References
- FABER Project: `/mnt/c/GitHub/fractary/faber/`
- Forge Project: `/mnt/c/GitHub/fractary/forge/`

### Related Documents
- [FABER Vision](../docs/vision/FABER-VISION.md)
- [SDK Architecture](./SPEC-00016-sdk-architecture.md)

---

**Ready for team review and discussion.**
