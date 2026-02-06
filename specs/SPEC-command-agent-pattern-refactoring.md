# Refactor Faber Commands: Lightweight Command + Agent Pattern

## Overview

Refactor Faber plugin commands to follow the lightweight command + agent pattern consistently. Analysis shows 3 commands need refactoring to extract implementation logic into agents and make command files minimal wrappers.

## Naming Conventions

**Decided:**
- Commands operating on workflows: `workflow-` prefix
- Context/session commands: `session-` prefix with action verbs (load/save)
- Skills → Agents: All skill references must become agent references
- Agent naming: Matches command naming pattern

## Current State Analysis

### Command Inventory (8 total commands)

**✅ Already Following Best Practice - Need Renaming (3 commands):**
- `workflow-plan.md` - Delegates to faber-planner agent ✓ (name is good)
- `prime-context.md` - Delegates to context-manager **skill** → **Rename to `session-load.md`**, change to **agent**
- `session-end.md` - Delegates to context-manager **skill** → **Rename to `session-save.md`**, change to **agent**
- `init.md` - Delegates to faber-initializer agent ✓ (just completed, name is good)

**❌ Need Refactoring + Renaming (3 commands):**
- `audit.md` - 79+ lines of validation logic → **Rename to `workflow-audit.md`**, extract to agent
- `status.md` - 250+ lines of status display logic → **Rename to `workflow-status.md`**, extract to agent
- `debugger.md` - 186 lines of debugging logic → **Rename to `workflow-debugger.md`**, extract to agent

**⚠️ Special Case (1 command):**
- `workflow-run.md` - Orchestrator pattern (1000+ lines, intentionally direct) ✓

### Problem: Inconsistent Patterns

Commands with implementation logic violate best practices:
1. **Logic in command files** - Should be in agents
2. **Not reusable** - Logic locked in command context
3. **Hard to test** - No separation of concerns
4. **Maintenance burden** - Mixed implementation and documentation

### Best Practice Pattern

Exemplified by `workflow-plan.md` and `init.md`:

**Command File (12 lines):**
```markdown
---
name: fractary-faber:command-name
description: Short description - delegates to agent-name
allowed-tools: Task(agent-name)
model: claude-haiku-4-5
---

Use Task tool with agent to perform operation.

Task(
  subagent_type="fractary-faber:agent-name",
  description="Short description",
  prompt="Operation: $ARGUMENTS"
)
```

**Agent File (comprehensive logic):**
- Full implementation details
- Step-by-step procedures
- Error handling
- SDK/tool usage
- Output formatting

## Refactoring Plan

### Group A: Rename Session Commands (Skills → Agents)

These already follow the pattern but need renaming and skill→agent conversion:

#### 1. prime-context → session-load
- **Rename:** `prime-context.md` → `session-load.md`
- **Change:** References to "context-manager skill" → "session-manager agent"
- **Agent:** Create or update `session-manager.md` agent (handles both load and save)

#### 2. session-end → session-save
- **Rename:** `session-end.md` → `session-save.md`
- **Change:** References to "context-manager skill" → "session-manager agent"
- **Agent:** Same `session-manager.md` agent (handles both operations)

---

### Group B: Refactor Workflow Commands (Extract Logic to Agents)

These need both refactoring and renaming:

### Priority 1: workflow-audit Command → Workflow Audit Agent

**Current State:**
- File: `plugins/faber/commands/audit.md` (79+ lines)
- Has: Validation steps, error detection, scoring logic
- Problem: All implementation in command file

**Refactoring:**

1. **Rename:** `audit.md` → `workflow-audit.md`
2. **Create Agent:** `plugins/faber/agents/workflow-audit.md`
   - Move all validation logic from audit.md
   - Implement configuration validation algorithm
   - Add SDK integration for config loading
   - Include completeness scoring
   - Error detection and reporting

3. **Simplify Command:** `plugins/faber/commands/workflow-audit.md`
   - Reduce to 12 lines (like init.md pattern)
   - Parse arguments: `--verbose`, `--fix`, `--check`
   - Delegate to workflow-audit agent via Task tool
   - Return agent output

**Agent Implementation:**
```markdown
---
name: fractary-faber:workflow-audit
description: Validate FABER workflow configuration and report issues
model: claude-sonnet-4-5
tools: Read, Glob, Bash
---

# Workflow Audit Agent

## Objective
Perform comprehensive validation of FABER configuration files.

## Implementation Steps

1. Load Config
   - Use SDK: loadFaberConfig()
   - Check file existence
   - Validate JSON/YAML syntax

2. Validate Structure
   - Check all 5 phases defined
   - Validate phase structure
   - Check hook configuration
   - Verify plugin integrations

3. Calculate Score
   - Completeness: 0-100%
   - Weight by importance
   - Report gaps

4. Generate Report
   - Passed checks
   - Warnings
   - Suggestions
   - Auto-fix recommendations

5. Apply Fixes (if --fix)
   - Add missing arrays
   - Set default values
   - Fix typos
```

**Command Pattern:**
```markdown
---
name: fractary-faber:workflow-audit
description: Validate FABER workflow configuration - delegates to workflow-audit agent
allowed-tools: Task(fractary-faber:workflow-audit)
model: claude-haiku-4-5
argument-hint: '[--verbose] [--fix] [--check <aspect>]'
---

Use Task tool with workflow-audit agent to validate configuration.

Task(
  subagent_type="fractary-faber:workflow-audit",
  description="Validate FABER workflow configuration",
  prompt="Audit workflow configuration: $ARGUMENTS"
)
```

### Priority 2: workflow-status Command → Workflow Status Agent

**Current State:**
- File: `plugins/faber/commands/status.md` (250+ lines)
- Has: State loading, log querying, formatting logic
- Problem: All implementation in command file

**Refactoring:**

1. **Rename:** `status.md` → `workflow-status.md`
2. **Create Agent:** `plugins/faber/agents/workflow-status.md`
   - Move all status display logic
   - Implement state file loading
   - Log querying and parsing
   - Status formatting
   - Error handling

3. **Simplify Command:** `plugins/faber/commands/workflow-status.md`
   - Reduce to 12 lines
   - Parse arguments: `--work-id`, `--workflow-id`, `--verbose`, `--json`
   - Delegate to workflow-status agent
   - Return formatted output

**Agent Implementation:**
```markdown
---
name: fractary-faber:workflow-status
description: Display workflow execution status
model: claude-sonnet-4-5
tools: Read, Glob, Bash
---

# Workflow Status Agent

## Objective
Display current and historical workflow execution status.

## Implementation Steps

1. Load State
   - Find state files in .fractary/faber/state/
   - Parse JSON state
   - Load workflow metadata

2. Query Logs
   - Check logs plugin for session logs
   - Parse execution history
   - Extract phase progress

3. Format Output
   - Current status
   - Phase completion
   - Recent actions
   - Error messages

4. JSON Mode
   - Structured output
   - Machine-readable format
```

**Command Pattern:**
```markdown
---
name: fractary-faber:workflow-status
description: Display workflow execution status - delegates to workflow-status agent
allowed-tools: Task(fractary-faber:workflow-status)
model: claude-haiku-4-5
argument-hint: '[--work-id <id>] [--workflow-id <id>] [--verbose] [--json]'
---

Use Task tool with workflow-status agent to display status.

Task(
  subagent_type="fractary-faber:workflow-status",
  description="Display workflow execution status",
  prompt="Show workflow status: $ARGUMENTS"
)
```

### Priority 3: workflow-debugger Command → Workflow Debugger Agent

**Current State:**
- File: `plugins/faber/commands/debugger.md` (186 lines)
- Has: Problem detection, root cause analysis, solution generation
- Problem: All implementation in command file
- Note: Agent already referenced but not implemented

**Refactoring:**

1. **Rename:** `debugger.md` → `workflow-debugger.md`
2. **Create Agent:** `plugins/faber/agents/workflow-debugger.md`
   - Move all debugging logic
   - Implement diagnostic algorithms
   - Root cause analysis
   - Solution generation
   - Fix application

3. **Simplify Command:** `plugins/faber/commands/workflow-debugger.md`
   - Reduce to 12 lines
   - Parse arguments: `--work-id`, `--auto-fix`
   - Delegate to workflow-debugger agent
   - Return diagnostic report

**Agent Implementation:**
```markdown
---
name: fractary-faber:workflow-debugger
description: Debug FABER workflow execution issues
model: claude-sonnet-4-5
tools: Read, Write, Glob, Grep, Bash
---

# Workflow Debugger Agent

## Objective
Diagnose and fix workflow execution issues.

## Implementation Steps

1. Collect Evidence
   - Load workflow state
   - Read error logs
   - Check configuration
   - Review recent changes

2. Analyze Problems
   - Pattern matching
   - Error categorization
   - Root cause identification

3. Generate Solutions
   - Propose fixes
   - Show examples
   - Explain rationale

4. Apply Fixes (if --auto-fix)
   - Modify configuration
   - Update state files
   - Validate changes
```

**Command Pattern:**
```markdown
---
name: fractary-faber:workflow-debug
description: Debug workflow execution issues - delegates to workflow-debugger agent
allowed-tools: Task(fractary-faber:workflow-debugger)
model: claude-haiku-4-5
argument-hint: '[--work-id <id>] [--auto-fix]'
---

Use Task tool with workflow-debugger agent to diagnose issues.

Task(
  subagent_type="fractary-faber:workflow-debugger",
  description="Debug workflow execution issues",
  prompt="Debug workflow: $ARGUMENTS"
)
```

## Implementation Sequence

### Phase 0: Rename Session Commands (Quick wins)
1. Rename `prime-context.md` → `session-load.md`
2. Rename `session-end.md` → `session-save.md`
3. Change skill references → agent references (session-manager agent)
4. Create/verify `plugins/faber/agents/session-manager.md` exists
5. Test: `/fractary-faber:session-load` and `/fractary-faber:session-save`

### Phase 1: workflow-audit Command (Simplest, clear validation logic)
1. Rename `audit.md` → `workflow-audit.md`
2. Create `plugins/faber/agents/workflow-audit.md`
3. Update `plugins/faber/commands/workflow-audit.md` to lightweight wrapper
4. Test: `/fractary-faber:workflow-audit`
5. Verify: Validation works, reports generated

### Phase 2: workflow-status Command (Medium complexity, state reading)
1. Rename `status.md` → `workflow-status.md`
2. Create `plugins/faber/agents/workflow-status.md`
3. Update `plugins/faber/commands/workflow-status.md` to lightweight wrapper
4. Test: `/fractary-faber:workflow-status --work-id 123`
5. Verify: Status displayed, JSON output works

### Phase 3: workflow-debugger Command (Most complex, diagnostics)
1. Rename `debugger.md` → `workflow-debugger.md`
2. Create `plugins/faber/agents/workflow-debugger.md`
3. Update `plugins/faber/commands/workflow-debugger.md` to lightweight wrapper
4. Test: `/fractary-faber:workflow-debug --work-id 123`
5. Verify: Issues detected, solutions proposed

## Critical Files

### Files to Create (4 agents):
1. `plugins/faber/agents/session-manager.md` - Session context loading/saving agent
2. `plugins/faber/agents/workflow-audit.md` - Workflow config validation agent
3. `plugins/faber/agents/workflow-status.md` - Workflow status display agent
4. `plugins/faber/agents/workflow-debugger.md` - Workflow debugging agent

### Files to Rename + Update (5 commands):
1. `prime-context.md` → `session-load.md` - Change to agent, keep lightweight
2. `session-end.md` → `session-save.md` - Change to agent, keep lightweight
3. `audit.md` → `workflow-audit.md` - Simplify to 12 lines
4. `status.md` → `workflow-status.md` - Simplify to 12 lines
5. `debugger.md` → `workflow-debugger.md` - Simplify to 12 lines

### Files to Leave Unchanged:
- `workflow-plan.md` - Already follows pattern ✓
- `workflow-run.md` - Orchestrator pattern (intentional) ✓
- `init.md` - Just completed ✓

## Benefits

### Consistency
- ✅ All 8 commands follow same pattern
- ✅ Clear separation: commands delegate, agents implement
- ✅ Predictable structure for maintainers

### Reusability
- ✅ Agents can be invoked independently
- ✅ Logic can be reused in other contexts
- ✅ SDK integration opportunities

### Maintainability
- ✅ Commands: 12 lines each (96% reduction)
- ✅ Logic centralized in agents
- ✅ Easier to test and debug
- ✅ Clear responsibilities

### Architecture Alignment
- ✅ Follows fractary plugin patterns
- ✅ Matches workflow-plan precedent
- ✅ Consistent with init refactoring

## Verification

### Test Each Command After Refactoring:

**Session Commands:**
```bash
/fractary-faber:session-load
/fractary-faber:session-save
```

**Workflow Audit:**
```bash
/fractary-faber:workflow-audit
/fractary-faber:workflow-audit --verbose
/fractary-faber:workflow-audit --fix
```

**Workflow Status:**
```bash
/fractary-faber:workflow-status
/fractary-faber:workflow-status --work-id 123
/fractary-faber:workflow-status --json
```

**Workflow Debugger:**
```bash
/fractary-faber:workflow-debug --work-id 123
/fractary-faber:workflow-debug --work-id 123 --auto-fix
```

### Success Criteria:
- ✅ All commands renamed with consistent prefixes (workflow-, session-)
- ✅ All commands reduced to ~12 lines
- ✅ All skill references changed to agent references
- ✅ All agents created and functional
- ✅ Commands delegate via Task tool
- ✅ Original functionality preserved
- ✅ Consistent pattern across all 8 commands
