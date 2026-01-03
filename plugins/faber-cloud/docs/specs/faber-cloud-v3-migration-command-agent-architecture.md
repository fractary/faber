# Faber-Cloud v3.0 Migration Specification
## Command-Agent Architecture Migration

**Status:** Approved
**Version:** 3.0.0
**Date:** 2025-12-29
**Author:** Architecture Migration Team

---

## Executive Summary

This specification details the migration of the faber-cloud plugin from a centralized routing architecture (cloud-director + infra-manager agents) to a distributed command-agent architecture where each command invokes its own dedicated agent via the Task tool. This migration aligns with FABER best practices, ensures reliable agent execution, and improves maintainability.

**Breaking Change:** Version bump from 2.3.0 → 3.0.0

---

## Current vs Target Architecture

### Current Architecture (v2.3.0)

```
User Command → cloud-director (NL routing) → infra-manager (orchestration) → Skill (work execution)
    (16)            (haiku)                       (opus)                          (14)
```

**Problems:**
- Centralized routing creates single point of failure
- Skills are optional - Claude may not invoke them reliably
- Difficult to maintain and debug complex routing logic
- Manager/director pattern is outdated

### Target Architecture (v3.0.0)

```
User Command → Dedicated Agent → Utility Skills (optional)
    (16)            (16)              (4 kept)
```

**Advantages:**
- Each command has dedicated agent invoked via Task tool (deterministic)
- Simpler architecture - one command, one agent
- Easier to maintain, test, and debug
- Aligns with FABER best practices
- Utility skills remain for shared functionality

---

## Migration Strategy

### Phase 1: Create 15 New Agents

#### Convert Workflow-Step Skills to Agents (10):

1. **adopt-agent.md** ← infra-adoption skill
   - Model: claude-opus-4-5
   - Tools: Bash, Read, Write
   - Purpose: Discover and adopt existing infrastructure

2. **architect-agent.md** ← infra-architect skill
   - Model: claude-opus-4-5
   - Tools: Read, Write, Bash
   - Purpose: Design infrastructure architecture

3. **audit-agent.md** ← infra-auditor skill
   - Model: claude-opus-4-5
   - Tools: Bash, Read, Write
   - Purpose: Non-destructive infrastructure audits

4. **debug-agent.md** ← infra-debugger skill
   - Model: claude-opus-4-5
   - Tools: Bash, Read, Write, SlashCommand
   - Purpose: Diagnose and fix deployment errors

5. **deploy-apply-agent.md** ← infra-deployer skill
   - Model: claude-opus-4-5
   - Tools: Bash, Read, Write, SlashCommand
   - Purpose: Execute infrastructure deployments

6. **deploy-plan-agent.md** ← infra-planner skill
   - Model: claude-haiku-4-5
   - Tools: Bash, Read
   - Purpose: Generate terraform deployment plans

7. **engineer-agent.md** ← infra-engineer skill
   - Model: claude-opus-4-5
   - Tools: Read, Write, Bash, SlashCommand
   - Purpose: Generate Infrastructure-as-Code

8. **teardown-agent.md** ← infra-teardown skill
   - Model: claude-opus-4-5
   - Tools: Bash, Read, Write
   - Purpose: Safely destroy infrastructure

9. **test-agent.md** ← infra-tester skill
   - Model: claude-opus-4-5
   - Tools: Bash, Read, Write
   - Purpose: Run security scans, cost estimates, compliance checks

10. **validate-agent.md** ← infra-validator skill
    - Model: claude-haiku-4-5
    - Tools: Bash, Read
    - Purpose: Validate terraform syntax and configuration

#### Create New Agents (5):

11. **direct-agent.md** (replaces cloud-director)
    - Model: claude-haiku-4-5
    - Tools: SlashCommand
    - Purpose: Natural language routing

12. **list-agent.md** (new)
    - Model: claude-haiku-4-5
    - Tools: Bash, Read
    - Purpose: List deployed resources

13. **manage-agent.md** (replaces infra-manager workflow mode)
    - Model: claude-opus-4-5
    - Tools: SlashCommand
    - Purpose: FABER workflow orchestration

14. **status-agent.md** (new)
    - Model: claude-haiku-4-5
    - Tools: Bash, Read
    - Purpose: Show configuration status

15. **init-agent.md** (new)
    - Model: claude-haiku-4-5
    - Tools: Bash, Read, Write
    - Purpose: Initialize plugin configuration

#### Utility Skills to Keep (4):

- **cloud-common** - Config loading, pattern substitution, hooks
- **handler-hosting-aws** - AWS-specific operations (CloudWatch, profiles, etc.)
- **handler-iac-terraform** - Terraform wrapper (init, plan, apply, destroy)
- **infra-permission-manager** - IAM permission auto-generation and fixes

#### Agent Template Structure:

```markdown
---
name: {operation}-agent
model: {claude-opus-4-5 | claude-haiku-4-5}
description: |
  {Single-line description of agent's purpose}
tools: {comma-separated list of allowed tools}
color: orange
---

# {Operation} Agent

<CONTEXT>
You are the {operation} agent for the faber-cloud plugin.
{Brief explanation of responsibility and scope}
</CONTEXT>

<CRITICAL_RULES>
{Critical rules from original skill, adapted for agent}
- May include invocation patterns for utility skills
- Error handling requirements
- Completion criteria
</CRITICAL_RULES>

<INPUTS>
**This agent receives from the command:**
- {parameter1}: {description}
- {parameter2}: {description}
</INPUTS>

<WORKFLOW>
{Step-by-step workflow - may invoke utility skills via Skill tool}
</WORKFLOW>

<COMPLETION_CRITERIA>
{Clear success/failure criteria}
</COMPLETION_CRITERIA>

<OUTPUTS>
{What the agent returns to the command}
</OUTPUTS>
```

---

### Phase 2: Update 15 Commands

Update all commands (except init) to be lightweight wrappers that invoke their dedicated agent via the Task tool.

#### Command Update Pattern:

**Before (current in architect.md:60-62):**
```markdown
## Invocation

This command invokes the `infra-manager` agent with the `architect` operation.

USE AGENT: infra-manager with operation=architect and description from user input
```

**After (new pattern):**
```markdown
## Invocation

**Immediately invoke the dedicated agent using the Task tool:**

```javascript
Task(
  subagent_type="fractary-faber-cloud:architect-agent",
  description="Design infrastructure architecture",
  prompt={
    "operation": "architect",
    "parameters": {
      "description": <extracted from user input>,
      "env": <extracted from --env flag or default "test">
    }
  }
)
```

The agent handles all work and returns the result directly.
```

#### Commands to Update:

| Command | Invokes Agent | Key Parameters |
|---------|---------------|----------------|
| adopt.md | adopt-agent | project-root, dry-run |
| architect.md | architect-agent | description |
| audit.md | audit-agent | env, check-type |
| debug.md | debug-agent | error, operation, env |
| deploy-apply.md | deploy-apply-agent | env, skip-tests, skip-plan |
| deploy-plan.md | deploy-plan-agent | env |
| direct.md | direct-agent | user_query |
| engineer.md | engineer-agent | instructions |
| init.md | **NO CHANGE** | (performs setup directly) |
| list.md | list-agent | env |
| manage.md | manage-agent | work-id, workflow, operation |
| status.md | status-agent | (none) |
| teardown.md | teardown-agent | env, backup, confirm |
| test.md | test-agent | env, phase |
| validate.md | validate-agent | env |

#### Update Template for Commands:

Each command must:
1. Parse arguments from user input
2. Invoke agent via Task tool with structured parameters
3. Return agent's output directly

**Changes:**
- ✅ Remove all references to infra-manager/cloud-director
- ✅ Add Task tool invocation section
- ✅ Update "Invocation" section with new pattern
- ✅ Keep all other sections unchanged (Usage, Parameters, Examples)

---

### Phase 3: Update 3 Workflow JSON Files

Update skill references to agent references in FABER workflow configurations.

#### Files to Update:

**1. infrastructure-deploy.json**

Mapping (line numbers from current file):

| Line | Old | New |
|------|-----|-----|
| 39 | `"skill": "fractary-faber-cloud:infra-architect"` | `"agent": "@agent-fractary-faber-cloud:architect-agent"` |
| 51 | `"skill": "fractary-faber-cloud:infra-tester"` | `"agent": "@agent-fractary-faber-cloud:test-agent"` |
| 67 | `"skill": "fractary-faber-cloud:infra-engineer"` | `"agent": "@agent-fractary-faber-cloud:engineer-agent"` |
| 73 | `"skill": "fractary-faber-cloud:infra-engineer"` | `"agent": "@agent-fractary-faber-cloud:engineer-agent"` |
| 101 | `"skill": "fractary-faber-cloud:infra-validator"` | `"agent": "@agent-fractary-faber-cloud:validate-agent"` |
| 107 | `"skill": "fractary-faber-cloud:infra-tester"` | `"agent": "@agent-fractary-faber-cloud:test-agent"` |
| 117 | `"skill": "fractary-faber-cloud:infra-auditor"` | `"agent": "@agent-fractary-faber-cloud:audit-agent"` |
| 126 | `"skill": "fractary-faber-cloud:infra-tester"` | `"agent": "@agent-fractary-faber-cloud:test-agent"` |
| 149 | `"skill": "fractary-faber-cloud:infra-planner"` | `"agent": "@agent-fractary-faber-cloud:deploy-plan-agent"` |
| 160 | `"skill": "fractary-faber-cloud:infra-deployer"` | `"agent": "@agent-fractary-faber-cloud:deploy-apply-agent"` |
| 170 | `"skill": "fractary-faber-cloud:infra-auditor"` | `"agent": "@agent-fractary-faber-cloud:audit-agent"` |

**2. infrastructure-audit.json**

All `infra-auditor` skill references → `audit-agent`

**3. infrastructure-teardown.json**

All `infra-teardown` skill references → `teardown-agent`

#### Reference Pattern:

```json
// OLD
{
  "skill": "fractary-faber-cloud:infra-{name}"
}

// NEW
{
  "agent": "@agent-fractary-faber-cloud:{name}-agent"
}
```

---

### Phase 4: Update Plugin Configuration

**File:** `plugins/faber-cloud/.claude-plugin/plugin.json`

**Changes:**

```json
{
  "name": "fractary-faber-cloud",
  "version": "3.0.0",  // ← CHANGE: 2.3.0 → 3.0.0
  "description": "Infrastructure lifecycle management for Claude Code - architect, engineer, test, and deploy cloud infrastructure (FABER workflow). Includes audit for non-destructive observability. For operations monitoring, use fractary-helm-cloud.",
  "commands": "./commands/",
  "agents": "./agents/",  // ← CHANGE: Array → Directory (auto-discovery)
  "skills": "./skills/"
}
```

**What changes:**
1. **Version bump:** 2.3.0 → 3.0.0 (major version for breaking change)
2. **Agents discovery:** Array of files → Directory path for auto-discovery

**Before:**
```json
"agents": [
  "./agents/cloud-director.md",
  "./agents/infra-manager.md"
]
```

**After:**
```json
"agents": "./agents/"
```

This enables automatic discovery of all `.md` files in the `agents/` directory.

---

### Phase 5: Archive Deprecated Agents and Skills

Move deprecated components to archive **outside their discovery directories** to prevent accidental loading.

#### Archive Old Agents:

```bash
# Create archive directory at plugin root level
mkdir -p plugins/faber-cloud/.archive/deprecated-agents/

# Move deprecated agents (3 files)
mv plugins/faber-cloud/agents/cloud-director.md \
   plugins/faber-cloud/.archive/deprecated-agents/

mv plugins/faber-cloud/agents/infra-manager.md \
   plugins/faber-cloud/.archive/deprecated-agents/

mv plugins/faber-cloud/agents/infra-manager.md.backup \
   plugins/faber-cloud/.archive/deprecated-agents/
```

#### Archive Skills Converted to Agents:

```bash
# Create archive directory for deprecated skills
mkdir -p plugins/faber-cloud/.archive/deprecated-skills/

# Move skills that became agents (10 directories)
mv plugins/faber-cloud/skills/infra-adopt \
   plugins/faber-cloud/.archive/deprecated-skills/

mv plugins/faber-cloud/skills/infra-architect \
   plugins/faber-cloud/.archive/deprecated-skills/

mv plugins/faber-cloud/skills/infra-auditor \
   plugins/faber-cloud/.archive/deprecated-skills/

mv plugins/faber-cloud/skills/infra-debugger \
   plugins/faber-cloud/.archive/deprecated-skills/

mv plugins/faber-cloud/skills/infra-deployer \
   plugins/faber-cloud/.archive/deprecated-skills/

mv plugins/faber-cloud/skills/infra-engineer \
   plugins/faber-cloud/.archive/deprecated-skills/

mv plugins/faber-cloud/skills/infra-planner \
   plugins/faber-cloud/.archive/deprecated-skills/

mv plugins/faber-cloud/skills/infra-teardown \
   plugins/faber-cloud/.archive/deprecated-skills/

mv plugins/faber-cloud/skills/infra-tester \
   plugins/faber-cloud/.archive/deprecated-skills/

mv plugins/faber-cloud/skills/infra-validator \
   plugins/faber-cloud/.archive/deprecated-skills/
```

#### Skills Remaining (4 utility skills):

- `plugins/faber-cloud/skills/cloud-common/` - Configuration management
- `plugins/faber-cloud/skills/handler-hosting-aws/` - AWS operations
- `plugins/faber-cloud/skills/handler-iac-terraform/` - Terraform wrapper
- `plugins/faber-cloud/skills/infra-permission-manager/` - IAM fixes

**Critical:** Archives must be **outside** `agents/` and `skills/` directories to prevent discovery and loading.

**Retention:** Do not delete - keep for historical reference and potential rollback.

---

### Phase 6: Update Documentation

#### Files to Update:

**1. README.md**

Add new architecture section:

```markdown
## Architecture (v3.0)

faber-cloud uses a distributed command-agent architecture:

### Command → Agent Pattern

Each command invokes a dedicated agent via the Task tool:

```
/fractary-faber-cloud:architect
    ↓ (Task tool)
architect-agent.md (opus-4-5)
    ↓ (Skill tool)
Skills: cloud-common, handlers
```

### 15 Dedicated Agents

- **adopt-agent** - Discover and adopt existing infrastructure
- **architect-agent** - Design infrastructure solutions
- **audit-agent** - Non-destructive infrastructure audits
- **debug-agent** - Diagnose and fix errors
- **deploy-apply-agent** - Execute deployments
- **deploy-plan-agent** - Generate deployment plans
- **direct-agent** - Natural language routing
- **engineer-agent** - Generate Infrastructure-as-Code
- **init-agent** - Initialize plugin configuration
- **list-agent** - List deployed resources
- **manage-agent** - FABER workflow orchestration
- **status-agent** - Show configuration status
- **teardown-agent** - Safe infrastructure destruction
- **test-agent** - Security scans, cost estimates, testing
- **validate-agent** - Validate terraform configuration

### 4 Utility Skills

Shared utilities invoked by agents:

- **cloud-common** - Config loading, hooks, pattern substitution
- **handler-hosting-aws** - AWS CLI operations, CloudWatch
- **handler-iac-terraform** - Terraform init/plan/apply/destroy
- **infra-permission-manager** - Auto-generate IAM policies

### FABER Workflow Integration

Workflows reference agents directly:

```json
{
  "steps": [
    {
      "name": "design",
      "agent": "@agent-fractary-faber-cloud:architect-agent"
    }
  ]
}
```
```

**2. CHANGELOG.md**

Add v3.0.0 section at the top:

```markdown
## [3.0.0] - 2025-XX-XX

### BREAKING CHANGES

- **Architecture Migration:** Migrated from manager/director architecture to command-agent architecture
- **Removed Agents:** cloud-director and infra-manager agents removed
- **New Pattern:** Each command now invokes its own dedicated agent via Task tool
- **Workflow Updates:** Custom workflows must update agent references from `skill:` to `agent:`

### Added

- 15 dedicated command-specific agents for reliable execution
- Improved architecture: one command = one agent
- Better maintainability and debuggability
- Task tool invocation pattern ensures deterministic agent execution

### Changed

- All commands updated to use Task tool for agent invocation
- Workflow JSON files updated with agent references
- Plugin configuration now uses directory-based agent discovery

### Deprecated

- cloud-director agent (replaced by direct-agent)
- infra-manager agent (replaced by dedicated command agents)
- 10 workflow skills (converted to agents)

### Migration Guide

#### For Custom Workflows

If you have custom FABER workflows that reference faber-cloud skills:

**OLD (v2.x):**
```json
{
  "skill": "fractary-faber-cloud:infra-architect"
}
```

**NEW (v3.0):**
```json
{
  "agent": "@agent-fractary-faber-cloud:architect-agent"
}
```

**Skill → Agent Mapping:**
- `infra-adopt` → `adopt-agent`
- `infra-architect` → `architect-agent`
- `infra-auditor` → `audit-agent`
- `infra-debugger` → `debug-agent`
- `infra-deployer` → `deploy-apply-agent`
- `infra-engineer` → `engineer-agent`
- `infra-planner` → `deploy-plan-agent`
- `infra-tester` → `test-agent`
- `infra-teardown` → `teardown-agent`
- `infra-validator` → `validate-agent`

#### For End Users

**No action required!** All slash commands work exactly as before:

```bash
/fractary-faber-cloud:architect "S3 bucket"
/fractary-faber-cloud:deploy-apply --env test
/fractary-faber-cloud:audit --env prod
```

The migration is transparent to command users.
```

**3. docs/architecture/ARCHITECTURE.md** (if exists)

Complete architecture rewrite documenting:
- Command → Agent → Skills pattern
- Agent responsibilities and tool access
- Workflow integration patterns
- Decision rationale

---

## Implementation Timeline

### Week 1: Agent Creation (Phase 1)
- Day 1-2: Create 10 agents from skills (adopt, architect, audit, debug, deploy-apply, deploy-plan, engineer, teardown, test, validate)
- Day 3-4: Create 5 new agents (direct, list, manage, status, init)
- Day 5: Validate all agent syntax, test independently

### Week 2: Commands & Workflows (Phases 2-3)
- Day 1-2: Update 15 command files with Task tool invocation pattern
- Day 3: Test command → agent flow for all commands
- Day 4: Update 3 workflow JSON files with agent references
- Day 5: Test workflow execution end-to-end

### Week 3: Configuration & Documentation (Phases 4-6)
- Day 1: Update plugin.json configuration
- Day 2: Archive deprecated agents and skills
- Day 3-4: Update documentation (README, CHANGELOG, architecture docs)
- Day 5: Final review and validation

### Week 4: Testing & Release
- Day 1-3: Comprehensive testing (per-agent, command integration, workflows)
- Day 4: Version bump, git commit, create release tag
- Day 5: Release v3.0.0, publish documentation

---

## Testing Strategy

### Per-Agent Testing
For each of the 15 agents:
- ✅ Test direct agent invocation
- ✅ Verify argument parsing
- ✅ Validate skill invocation (if applicable)
- ✅ Test error handling
- ✅ Verify output format

### Command Integration Testing
For each of the 15 commands:
- ✅ Test command argument parsing
- ✅ Verify Task tool invocation
- ✅ Validate parameters passed to agent
- ✅ Verify agent output returned to user
- ✅ Test error propagation

### Workflow Testing
- ✅ infrastructure-deploy.json: Full deployment workflow
- ✅ infrastructure-audit.json: Audit workflow
- ✅ infrastructure-teardown.json: Teardown workflow
- ✅ Verify all phases execute correctly
- ✅ Validate agent references resolve properly

### Regression Testing
Test known scenarios:
- ✅ Simple deployment (S3 bucket)
- ✅ Complex deployment (API + database)
- ✅ Security audit workflow
- ✅ Safe teardown workflow
- ✅ Error scenarios (permission errors, validation failures)

---

## Success Criteria

Migration is complete and successful when:

- ✅ All 15 agents created and independently tested
- ✅ All 15 commands updated and tested (14 modified + init unchanged)
- ✅ All 3 workflow JSON files updated and tested
- ✅ plugin.json updated to v3.0.0 with directory-based discovery
- ✅ Deprecated agents and skills archived
- ✅ All documentation updated (README, CHANGELOG, architecture)
- ✅ No functional regressions in any commands
- ✅ All existing workflows execute successfully
- ✅ Performance acceptable or improved
- ✅ Release v3.0.0 published with migration guide

---

## Migration Impact

### User Impact: MINIMAL

**Commands work exactly as before:**
```bash
# All these still work identically
/fractary-faber-cloud:architect "Lambda function"
/fractary-faber-cloud:deploy-apply --env test
/fractary-faber-cloud:audit --check drift
```

**No user action required** unless they have custom workflows.

### Breaking Changes

1. **Custom Workflows:** Must update skill references to agent references
2. **Direct Agent Invocation:** cloud-director and infra-manager no longer available
3. **Skill References:** 10 skills moved to archive, replaced by agents

### Backward Compatibility

**None.** This is a clean break in v3.0.0.

Rationale: Cleaner migration, simpler codebase, clear deprecation path.

### Migration Support

- **Migration guide** in CHANGELOG.md
- **Example conversions** for common workflow patterns
- **Archived code** retained for reference
- **Rollback plan** documented below

---

## Rollback Plan

If critical issues discovered during or after migration:

### Immediate Rollback

```bash
# Revert to v2.3.0
git revert <migration-commit-hash>
git tag v2.3.1

# Restore archived files if needed
mv .archive/deprecated-agents/* agents/
mv .archive/deprecated-skills/* skills/
```

### Fixes and Re-release

1. Fix issues in feature branch
2. Re-test thoroughly
3. Create new migration commit
4. Re-release as v3.0.1 or v3.1.0

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Agent invocation failures | High | Medium | Thorough testing in Week 4 |
| Workflow execution breaks | Critical | Medium | Incremental migration, test each workflow |
| Performance degradation | Medium | Low | Task tool optimized, should be faster |
| User confusion | Low | Low | Commands unchanged, clear documentation |
| Custom workflows break | Medium | Low | Migration guide, example conversions |

---

## Appendix A: Critical Files Reference

### Files to CREATE (15 agents)

```
plugins/faber-cloud/agents/
├── adopt-agent.md          (NEW - from infra-adoption)
├── architect-agent.md      (NEW - from infra-architect)
├── audit-agent.md          (NEW - from infra-auditor)
├── debug-agent.md          (NEW - from infra-debugger)
├── deploy-apply-agent.md   (NEW - from infra-deployer)
├── deploy-plan-agent.md    (NEW - from infra-planner)
├── direct-agent.md         (NEW - replaces cloud-director)
├── engineer-agent.md       (NEW - from infra-engineer)
├── init-agent.md           (NEW)
├── list-agent.md           (NEW)
├── manage-agent.md         (NEW - replaces infra-manager workflow mode)
├── status-agent.md         (NEW)
├── teardown-agent.md       (NEW - from infra-teardown)
├── test-agent.md           (NEW - from infra-tester)
└── validate-agent.md       (NEW - from infra-validator)
```

### Files to MODIFY (18 files)

**Commands (14 modified, 1 unchanged):**
```
plugins/faber-cloud/commands/
├── adopt.md          (MODIFY - invoke adopt-agent)
├── architect.md      (MODIFY - invoke architect-agent)
├── audit.md          (MODIFY - invoke audit-agent)
├── debug.md          (MODIFY - invoke debug-agent)
├── deploy-apply.md   (MODIFY - invoke deploy-apply-agent)
├── deploy-plan.md    (MODIFY - invoke deploy-plan-agent)
├── direct.md         (MODIFY - invoke direct-agent)
├── engineer.md       (MODIFY - invoke engineer-agent)
├── init.md           (NO CHANGE - exception)
├── list.md           (MODIFY - invoke list-agent)
├── manage.md         (MODIFY - invoke manage-agent)
├── status.md         (MODIFY - invoke status-agent)
├── teardown.md       (MODIFY - invoke teardown-agent)
├── test.md           (MODIFY - invoke test-agent)
└── validate.md       (MODIFY - invoke validate-agent)
```

**Workflows (3 files):**
```
plugins/faber-cloud/config/workflows/
├── infrastructure-deploy.json    (MODIFY - 11 skill→agent refs)
├── infrastructure-audit.json     (MODIFY - skill→agent refs)
└── infrastructure-teardown.json  (MODIFY - skill→agent refs)
```

**Configuration (1 file):**
```
plugins/faber-cloud/.claude-plugin/
└── plugin.json  (MODIFY - version, agents discovery)
```

### Files to MOVE/ARCHIVE (13 items)

**Deprecated Agents (3 files):**
```
.archive/deprecated-agents/
├── cloud-director.md
├── infra-manager.md
└── infra-manager.md.backup
```

**Deprecated Skills (10 directories):**
```
.archive/deprecated-skills/
├── infra-adopt/
├── infra-architect/
├── infra-auditor/
├── infra-debugger/
├── infra-deployer/
├── infra-engineer/
├── infra-planner/
├── infra-teardown/
├── infra-tester/
└── infra-validator/
```

### Files to UPDATE (documentation)

```
plugins/faber-cloud/
├── README.md                      (MODIFY - architecture section)
├── CHANGELOG.md                   (MODIFY - v3.0.0 section)
└── docs/architecture/ARCHITECTURE.md  (MODIFY - complete rewrite)
```

---

## Appendix B: Model Selection Rationale

### claude-opus-4-5 (Complex Tasks)
**Agents using Opus:**
- adopt-agent - Complex discovery and analysis
- architect-agent - Design decisions requiring deep reasoning
- engineer-agent - Code generation with architectural understanding
- deploy-apply-agent - Complex orchestration with safety checks
- test-agent - Security analysis and threat modeling
- audit-agent - Compliance analysis and recommendations
- debug-agent - Error diagnosis requiring investigation
- teardown-agent - Safety validation and dependency analysis
- manage-agent - Workflow orchestration and decision-making

### claude-haiku-4-5 (Fast, Structured Tasks)
**Agents using Haiku:**
- validate-agent - Syntax checking (fast, deterministic)
- deploy-plan-agent - Run terraform plan (simple wrapper)
- list-agent - Read and format files (simple read operation)
- status-agent - Show configuration (simple read operation)
- init-agent - Setup tasks (structured, template-based)
- direct-agent - Intent routing (fast classification)

---

## Appendix C: References

- [FABER Best Practices](../../specs/FABER-best-practices.md)
- [Command-Agent Architecture Pattern](../../specs/command-agent-pattern.md)
- [Task Tool Documentation](https://docs.claude.com/tools/task)
- [Plugin Architecture Guide](../../specs/plugin-architecture.md)

---

**End of Specification**

This specification provides a complete blueprint for migrating faber-cloud to v3.0 command-agent architecture. Follow the phases sequentially, test thoroughly at each stage, and refer to the appendices for detailed file references.
