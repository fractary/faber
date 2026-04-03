---
spec_id: WORK-00218-plugin-v3-migration-plan
issue_number: 218
issue_url: https://github.com/fractary/core/issues/218
title: Plugin v3.0 Migration Plan
type: infrastructure
status: draft
created: 2025-12-18
author: claude-opus-4-6
validated: false
source: conversation
related_docs:
  - docs/guides/new-claude-plugin-framework.md
  - docs/plans/plugin-v3-migration-plan.md
changelog:
  - date: 2025-12-18
    type: refined
    description: "Clarified MCP tools (use existing @fractary/core-mcp), type handling (expertise skills with type data), script archival strategy, and compound command removal"
  - date: 2025-12-19
    type: implementation
    description: "Phase 1 repo plugin complete: deleted compound commands (branch.md, pr.md, tag.md), added Task(fractary-repo:*) restrictions to all 20 commands. Status plugin in progress."
---

# Infrastructure Specification: Plugin v3.0 Migration Plan

**Issue**: [#218](https://github.com/fractary/core/issues/218)
**Type**: Infrastructure/Architecture Migration
**Status**: Draft
**Created**: 2025-12-18

## Summary

This specification defines the migration of all 7 Fractary plugins from their current mixed architectures (v1.0/v2.0) to the v3.0 MCP-First Architecture. The migration prioritizes **correctness through focus** by replacing manager agents with dedicated agents, converting orchestration skills to expertise skills, and moving platform abstraction to the SDK.

## Objectives

- Eliminate manager agents in favor of dedicated agents (1:1 command-to-agent ratio)
- Convert 70+ orchestration skills to ~15-20 expertise-only skills
- Move platform handlers from plugins to SDK
- Implement ultra-lightweight commands with tool restrictions
- Enable auto-triggering through detailed agent descriptions
- Reduce operational costs by ~90% (MCP-first design)
- Reduce latency from 8-15s to 1-2s per operation

## Current State

| Plugin | Commands | Agents | Skills | V3.0 Alignment |
|--------|----------|--------|--------|----------------|
| **repo** | 23 | 20 dedicated | 3 expertise + archived | ~85% |
| **work** | 25 | 1 manager | 18 (incl. deprecated handlers) | ~20% |
| **docs** | 5 | 1 manager | 10+ orchestration | ~15% |
| **logs** | 10 | 1 manager | 13 orchestration | ~15% |
| **file** | 4 | 1 manager | 8 (incl. handlers) | ~15% |
| **spec** | 6 | 1 manager | 7 orchestration | ~20% |
| **status** | 2 | 0 | 2 | ~30% |

**Key Anti-Patterns Identified**:
1. Manager agents routing to skills (6 of 7 plugins)
2. Orchestration skills instead of expertise skills (~70 skills)
3. Platform handlers in plugins instead of SDK (file, work)
4. Commands lacking `allowed-tools: Task` restrictions
5. Missing auto-trigger descriptions in agents

## Target State

| Plugin | Commands | Agents | Skills | V3.0 Alignment |
|--------|----------|--------|--------|----------------|
| **repo** | 20 | 20 dedicated | 3 expertise | 100% |
| **work** | 20 | 20 dedicated | 3-5 expertise | 100% |
| **docs** | 5 | 5 dedicated | 2-3 expertise | 100% |
| **logs** | 10 | 10 dedicated | 2-3 expertise | 100% |
| **file** | 4 | 4 dedicated | 0-2 expertise | 100% |
| **spec** | 6 | 6 dedicated | 2 expertise | 100% |
| **status** | 2 | 2 dedicated | 0-1 expertise | 100% |

**Target Metrics**:
- Manager agents: 6 → 0
- Dedicated agents: ~22 → ~67
- Orchestration skills: ~70 → 0
- Expertise skills: ~5 → ~15-20
- Platform handlers in plugins: ~8 → 0

## Architecture

### Components

- **Commands**: Ultra-lightweight (8-18 lines) with `allowed-tools: Task` restrictions
  - Type: Markdown frontmatter + invocation pattern
  - Purpose: Manual trigger interface with enforced delegation

- **Dedicated Agents**: One per command (60-100 lines)
  - Type: Markdown with workflow definition
  - Purpose: Orchestrate MCP tools, provide auto-triggering

- **Expertise Skills**: Organizational knowledge only
  - Type: Markdown knowledge documents
  - Purpose: Provide standards (commit-format, pr-template, etc.)

- **MCP Tools**: Deterministic operations
  - Type: TypeScript handlers wrapping SDK
  - Purpose: Fast, zero-cost data operations

- **SDK**: Business logic and platform abstraction
  - Type: TypeScript/Python libraries
  - Purpose: Reusable logic across all interfaces

### Data Flow

```
User Request
    ↓
Command (8-18 lines, allowed-tools: Task)
    ↓
Dedicated Agent (isolated context)
    ↓
MCP Tools (fractary_*) ← wraps SDK
    ↓
SDK (platform abstraction, business logic)
    ↓
Result (returned to main context)
```

### Network Topology

N/A - Local plugin architecture

## Resources Required

### Compute

- Development time: ~4-6 weeks total
- Testing environments for each plugin

### Storage

- Archived skills storage (~70 files moved to archived/)
- New agent files (~45 new files)
- Updated command files (~75 files modified)

### Third-Party Services

- GitHub API: For work/repo plugin operations
- Jira API: For work plugin (via SDK)
- Linear API: For work plugin (via SDK)
- Cloud storage APIs: For file plugin (via SDK)

## Configuration

### Configuration Files

- `plugins/{plugin}/agents/*.md`: New dedicated agent definitions
- `plugins/{plugin}/commands/*.md`: Updated ultra-lightweight commands
- `plugins/{plugin}/archived/README.md`: Migration documentation per plugin
- `mcp/server/src/handlers/*.ts`: MCP tool definitions
- `sdk/typescript/src/{plugin}/`: SDK implementations

## Implementation Plan

### Phase 1: Foundation (Wave 1)
**Status**: ✅ Complete

**Objective**: Complete repo plugin alignment and quick win with status plugin

**Tasks**:
- [x] Audit all repo commands for `allowed-tools: Task` restriction
- [x] Ensure repo commands are 8-18 lines (ultra-lightweight)
- [x] Add parameter-based restrictions: `Task(fractary-repo:agent-name)`
- [x] **Delete compound commands**: branch.md, pr.md, tag.md (not deprecate - remove entirely)
- [x] Review all 20 repo agents for auto-trigger descriptions
- [x] Add "MUST BE USED" and "Use PROACTIVELY" to repo agent descriptions
- [x] Create 2 dedicated agents for status plugin (status-install, status-sync)
- [x] Simplify status commands
- [x] Archive status plugin skills to archived/

**Completed**: 2025-12-19

### Phase 2: Work Plugin Migration
**Status**: ⬜ Not Started

**Objective**: Create dedicated agents for all work commands, archive orchestration skills, remove compound commands

**Tasks**:
- [ ] **Delete compound commands**: issue.md, label.md, milestone.md, state.md, comment.md
- [ ] Create 20+ dedicated agents (comment-create, issue-fetch, label-add, etc.)
- [ ] Archive 18 orchestration skills (with scripts/) to archived/
- [ ] Create 3-5 expertise skills (issue-template, work-conventions)
- [ ] Add `allowed-tools: Task(fractary-work:agent-name)` to all commands
- [ ] Update agents to use existing `@fractary/core-mcp` tools (no new MCP creation)
- [ ] Move handler logic to SDK
- [ ] Update plugin README and create MIGRATION-v3.0.md

**Estimated Scope**: 5-7 days

### Phase 3: Docs Plugin Migration
**Status**: ⬜ Not Started

**Objective**: Create dedicated agents, convert type system to expertise skill, archive orchestration skills

**Tasks**:
- [ ] Create 5 dedicated agents (docs-write, docs-validate, docs-audit, docs-list, docs-check-consistency)
- [ ] **Create `docs-types` expertise skill** containing all 12 document type definitions (schemas, templates, standards)
- [ ] Archive 10+ orchestration skills (with scripts/) to archived/
- [ ] Create `documentation-standards` expertise skill
- [ ] Update agents to use existing `@fractary/core-mcp` tools
- [ ] Agents reference `docs-types` skill for dynamic type loading
- [ ] Update plugin README

**Estimated Scope**: 5-7 days

### Phase 4: Logs Plugin Migration
**Status**: ⬜ Not Started

**Objective**: Create dedicated agents, convert type system to expertise skill

**Tasks**:
- [ ] Create 10 dedicated agents (log-analyze, log-archive, log-capture, etc.)
- [ ] **Create `logs-types` expertise skill** containing all 11 log type definitions
- [ ] Archive 13 orchestration skills (with scripts/) to archived/
- [ ] Create `log-format-standards` expertise skill
- [ ] Update agents to use existing `@fractary/core-mcp` tools
- [ ] Agents reference `logs-types` skill for dynamic type loading

**Estimated Scope**: 4-5 days

### Phase 5: File Plugin Migration
**Status**: ⬜ Not Started

**Objective**: Create dedicated agents, move handlers to SDK

**Tasks**:
- [ ] Create 4 dedicated agents (file-init, file-show-config, file-switch-handler, file-test-connection)
- [ ] Move 5 storage handlers to SDK (local, r2, s3, gcs, gdrive)
- [ ] Create unified StorageManager in SDK
- [ ] Archive old skills (with scripts/) to archived/
- [ ] Update agents to use existing `@fractary/core-mcp` tools (file operations already in MCP)

**Estimated Scope**: 4-5 days

### Phase 6: Spec Plugin Migration
**Status**: ⬜ Not Started

**Objective**: Create dedicated agents, archive orchestration skills

**Tasks**:
- [ ] Create 6 dedicated agents (spec-archive, spec-create, spec-init, spec-read, spec-refine, spec-validate)
- [ ] Archive 7 orchestration skills (with scripts/) to archived/
- [ ] Create 2 expertise skills (spec-format-standards, spec-quality-checklist)
- [ ] Update agents to use existing `@fractary/core-mcp` tools

**Estimated Scope**: 3-4 days

## Deployment Strategy

### Infrastructure as Code

N/A - Plugin architecture changes are source code modifications

### Deployment Steps

1. Complete migration for each plugin in isolated branch
2. Test all commands and auto-triggering
3. Merge to main branch
4. Update documentation
5. Announce breaking changes to users

### Rollback Plan

- Keep archived/ directories with original skills
- Git history preserves all previous versions
- Can restore individual plugins independently

## Monitoring and Observability

### Metrics

- Agent invocation count: Track usage of new dedicated agents
- Auto-trigger success rate: Measure natural language matching
- Operation latency: Target 1-2s per operation
- Token usage: Track context efficiency

### Alerts

- **Agent Failure Rate**: >5% failure rate → investigate agent workflow
- **Auto-trigger Miss**: User manually invokes when auto-trigger should work → improve description

## Security Considerations

### Authentication/Authorization

- MCP tools use existing auth mechanisms (GitHub tokens, API keys)
- No new security requirements introduced

### Data Encryption

- Existing encryption maintained (tokens in environment, secure storage)

## Cost Estimation

- **Development effort**: ~4-6 weeks (1 developer)
- **Operational savings**: ~90% reduction in token costs per operation
- **Before**: ~$0.018 per operation
- **After**: ~$0.001-0.002 per operation

## Dependencies

- **MCP Tools**: Use existing `@fractary/core-mcp` package - NO new MCP tools need to be created
- SDK must have platform abstraction for handlers being migrated
- Plugin framework documentation (docs/guides/new-claude-plugin-framework.md) must be finalized

## Key Decisions (Refinement Round 1)

### MCP Tools Strategy
**Decision**: Use existing MCP tools from `@fractary/core-mcp` package.
- Do NOT create new MCP tools as part of migration
- Agents will call existing `fractary_*` tools
- If gaps found, address separately from migration

### Type-Driven Plugins (docs, logs)
**Decision**: Use expertise skills to provide type context, NOT separate agents per type.
- Create expertise skills containing type schemas, templates, and standards
- Agents dynamically reference type data from expertise skills at runtime
- Example: `docs-types` skill contains all 12 document type definitions
- This preserves the excellent type-driven design while avoiding agent proliferation

### Script Archival Strategy
**Decision**: Keep scripts in archived/ directories but stop using them.
- Archive skills WITH their scripts/ directories intact (for reference/rollback)
- Migration replaces script execution with MCP tool calls or SDK usage
- Scripts serve as documentation of legacy behavior only

### Compound Commands
**Decision**: Remove entirely (not deprecated).
- Delete compound commands: `/work:issue`, `/work:label`, `/work:milestone`, `/work:state`, `/work:comment`, `/repo:branch`, `/repo:pr`, `/repo:tag`
- Users must use specific commands: `/work:issue-fetch`, `/work:label-add`, etc.
- This enforces clean 1:1 command-to-agent mapping
- Breaking change - document clearly

## Risks and Mitigations

- **Risk**: Breaking changes for existing users
  - **Impact**: High - workflows may break
  - **Mitigation**: Archive old components, provide migration guide, clear documentation

- **Risk**: Compound command removal breaks user workflows
  - **Impact**: High - users relying on `/work:issue`, `/repo:branch` etc. will break
  - **Mitigation**: Clear documentation of command mapping (issue → issue-fetch), announce in release notes, provide command alias examples for users who want shortcuts

- **Risk**: Missing MCP tools
  - **Impact**: Low (revised) - `@fractary/core-mcp` already provides required tools
  - **Mitigation**: Audit existing MCP tools for gaps before starting each plugin migration

- **Risk**: Lost functionality during migration
  - **Impact**: Medium - features may regress
  - **Mitigation**: Test each operation before/after, maintain archived code as reference

- **Risk**: Context overhead in agents
  - **Impact**: Low - performance degradation
  - **Mitigation**: Keep agents focused, use expertise skills only when standards matter

## Testing Strategy

### Infrastructure Tests

- Verify all commands have proper `allowed-tools` restrictions
- Verify 1:1 command-to-agent mapping
- Verify no orchestration skills remain (only expertise)

### Integration Tests

- Test each command invocation
- Test auto-triggering for each agent
- Test error handling paths
- Test cross-plugin operations

### Disaster Recovery Tests

- Verify archived components are accessible
- Verify rollback procedures work
- Verify git history is preserved

## Documentation Requirements

- **Plugin README**: Update each plugin's README for v3.0 architecture
- **Migration Guide**: Create MIGRATION-v3.0.md for each plugin
- **Agent Documentation**: Document auto-trigger patterns
- **MCP Tool Reference**: Document all MCP tools and their SDK implementations

## Acceptance Criteria

- [ ] All 7 plugins migrated to v3.0 architecture
- [ ] 0 manager agents remaining (6 → 0)
- [ ] ~67 dedicated agents created (1:1 with commands)
- [ ] 0 orchestration skills remaining (~70 → 0)
- [ ] All commands have `allowed-tools: Task` restrictions
- [ ] All commands are 8-18 lines (ultra-lightweight)
- [ ] All agents have detailed auto-trigger descriptions with examples
- [ ] All platform handlers moved to SDK
- [ ] All archived components have README.md explaining migration
- [ ] All plugin READMEs updated for v3.0
- [ ] Operation latency < 2 seconds
- [ ] Token cost < $0.005 per operation

## Implementation Notes

**Execution Order**:
1. Wave 1 (Week 1-2): repo (polish) + status (quick win)
2. Wave 2 (Week 2-4): work + docs (high impact)
3. Wave 3 (Week 4-6): logs + file + spec

**Templates Created**:
- Agent template (in docs/plans/plugin-v3-migration-plan.md)
- Command template
- Expertise skill template
- Archive README template

**Related Documents**:
- Framework: `docs/guides/new-claude-plugin-framework.md`
- Detailed Plan: `docs/plans/plugin-v3-migration-plan.md`
