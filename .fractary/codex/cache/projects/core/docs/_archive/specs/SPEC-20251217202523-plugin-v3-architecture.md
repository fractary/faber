# SPEC-20251217202523: Plugin v3.0 Architecture Implementation

| Field | Value |
|-------|-------|
| **Status** | Draft |
| **Created** | 2025-12-17 |
| **Author** | Claude (with human direction) |
| **Related** | SPEC-00026-distributed-plugin-architecture, docs/guides/new-claude-plugin-framework.md |
| **Branch** | refactor/mcp-integration |

## 1. Executive Summary

This specification defines the implementation plan for migrating Claude Code plugins from the v2.0 skill-centric architecture to the v3.0 MCP-first architecture. The new architecture eliminates unnecessary layers (skills, handlers, scripts) and introduces dedicated agents per command with direct MCP tool invocation.

### 1.1 Scope

This document covers:
- Migration from v2.0 (Command → Agent → Skill → Handler → Script) to v3.0 (Command → Dedicated Agent → MCP)
- Technology preference order: MCP > SDK (Python) > CLI (Bash)
- Elimination of skills layer (archived, not deleted)
- Creation of dedicated agents per command
- Simplification of commands to ultra-lightweight wrappers
- Platform abstraction consolidation in SDK

### 1.2 Design Goals

1. **MCP-First** - Use MCP tools for all deterministic operations (no LLM cost)
2. **Dedicated Agents** - One agent per command (no routing decisions)
3. **No Skills** - Agents orchestrate MCP directly (skills add no value with MCP)
4. **No Handlers** - SDK handles platform differences internally
5. **No Scripts** - SDK/MCP handles execution (scripts were context overhead)
6. **Ultra-Lightweight Commands** - 5-10 lines, just invoke agent
7. **Auto-Triggerable** - Agents with specific descriptions for natural language invocation
8. **Isolated Context** - Agent execution doesn't pollute main conversation

### 1.3 Key Changes

| Aspect | v2.0 (Skill-Centric) | v3.0 (MCP-First) |
|--------|---------------------|------------------|
| **Architecture** | Command → Agent → Skill → Handler → Script | Command → Dedicated Agent → MCP |
| **LLM Invocations** | 3-4 per operation | 1 per operation |
| **Latency** | 8-15 seconds | 1-2 seconds |
| **Tokens** | ~3000 per operation | ~500 per operation |
| **Cost** | $0.018-0.020 per operation | $0.0005-0.002 per operation |
| **Skills** | 15+ skills per plugin | 0 (archived) |
| **Handlers** | 3+ per platform | 0 (SDK handles) |
| **Scripts** | 150+ shell scripts | 0 (SDK handles) |
| **Commands** | 100+ lines each | 5-10 lines each |
| **Agents** | 1 manager (1000+ lines) | 24 dedicated (60-100 lines each) |
| **Routing Decisions** | Yes (unreliable) | No (hardcoded) |
| **Auto-Trigger** | Generic (unreliable) | Specific (reliable) |

## 2. Background & Motivation

### 2.1 Current Architecture Limitations (v2.0)

The existing skill-centric architecture suffers from:

1. **Multiple LLM Invocations**
   - Command parsing (Haiku)
   - Agent routing (Opus)
   - Skill orchestration (Haiku)
   - Total: 3-4 LLM calls per operation

2. **Routing Reliability**
   - Manager agents must decide "which skill to use"
   - This decision is an LLM inference that can fail
   - Generic descriptions make auto-triggering unreliable

3. **Context Overhead**
   - Skills load conditionally (complex)
   - Scripts output pollutes context
   - Handler logic duplicated across platforms

4. **Maintenance Burden**
   - 15+ skills per plugin
   - 150+ shell scripts
   - 3+ handlers per platform
   - Cross-file dependencies

### 2.2 Why MCP Changes Everything

MCP (Model Context Protocol) tools provide:
- **Zero LLM Cost** - Direct function calls, no token usage
- **Structured I/O** - Type-safe parameters and responses
- **Fast Execution** - No LLM inference latency
- **Deterministic** - Same input → same output

With MCP, the heavy lifting (data operations, git commands, API calls) happens without LLM invocation. The only LLM work is orchestration logic in the agent.

### 2.3 Technology Preference Order

When implementing operations, use this preference order:

| Preference | Technology | When to Use | Context Cost |
|------------|-----------|-------------|--------------|
| **1 (Highest)** | MCP Tools | All deterministic operations | Zero |
| **2** | SDK via Python | Operations MCP can't handle (local file writes) | Minimal |
| **3 (Lowest)** | CLI via Bash | Last resort, temporary until MCP available | Higher |

## 3. Proposed Architecture

### 3.1 Layer Structure

```
┌─────────────────────────────────────────────────┐
│ Layer 1: Command (5-10 lines)                   │
│ "Invoke {dedicated-agent}"                      │
│                                                  │
│ Minimal boilerplate, no logic                   │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ Layer 2: Dedicated Agent (60-100 lines)         │
│ - Focused on ONE task                           │
│ - No routing logic needed                       │
│ - Orchestrates MCP/SDK/CLI calls                │
│ - Auto-triggerable with specific examples       │
│ - Isolated context                              │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ Layer 3: MCP Tools / SDK / CLI                  │
│ - MCP: Deterministic operations (no LLM)        │
│ - SDK: Business logic + platform detection      │
│ - CLI: Direct git/gh commands if needed         │
└─────────────────────────────────────────────────┘
```

### 3.2 Component Specifications

#### 3.2.1 Commands (5-10 lines)

**Location:** `plugins/{plugin}/commands/{command}.md`

**Template:**
```markdown
# /plugin:command-name

Brief description of what this command does.

Invokes the {command-name} agent to handle the operation.
```

**Responsibilities:**
- Describe the command for users
- Invoke the dedicated agent
- Nothing else (no parsing, no logic)

#### 3.2.2 Dedicated Agents (60-100 lines)

**Location:** `plugins/{plugin}/agents/{command-name}.md`

**Template:**
```markdown
# {command-name} Agent

## Description
Detailed description of what this agent does.

## Use Cases
**Use this agent when:**
- User wants to [specific action]
- User mentions "[trigger phrase]"
- User needs to [specific goal]

**Examples:**
- "Example user request 1"
- "Example user request 2"
- "Example user request 3"

## Workflow

<WORKFLOW>
1. Parse/extract arguments from command or natural language

2. Conditional logic based on arguments:

   If condition A:
     - Call fractary_{plugin}_{tool_1}
     - Process result
     - Call fractary_{plugin}_{tool_2}

   If condition B:
     - Call fractary_{plugin}_{tool_3}

3. Handle errors gracefully

4. Format and return result
</WORKFLOW>
```

**Key Principles:**
- Specific auto-trigger descriptions with examples
- Hardcoded flow (no routing decisions)
- MCP-first for all data operations
- Error handling with helpful messages
- Isolated context (doesn't pollute main)

#### 3.2.3 MCP Tools

**Location:** `mcp/server/src/handlers/{plugin}.ts`

**Existing Tools:** 81 tools across 6 modules (already implemented)

| Module | Tool Count | Examples |
|--------|-----------|----------|
| **repo** | 38 | branch_create, commit, push, pr_create |
| **work** | 18 | issue_fetch, issue_create, comment_add |
| **spec** | 8 | spec_create, spec_validate |
| **logs** | 7 | log_capture, log_archive |
| **file** | 6 | file_upload, file_download |
| **docs** | 4 | doc_generate, doc_update |

#### 3.2.4 SDK

**Location:** `sdk/js/src/{module}/manager.ts`

**Responsibilities:**
- Core business logic
- Platform detection and abstraction (GitHub/GitLab/Bitbucket)
- Input validation
- API/CLI interactions

## 4. Implementation Plan

### 4.1 Phase 1: Repo Plugin Migration (Pilot)

**Duration:** 1-2 weeks
**Scope:** All 24 repo plugin commands

#### 4.1.1 Create Dedicated Agents

Create one agent per command in `plugins/repo/agents/`:

| Agent | MCP Tools Used | Complexity |
|-------|---------------|------------|
| `branch-create.md` | 1-3 (issue_fetch, name_generate, branch_create) | Medium |
| `branch-delete.md` | 1 (branch_delete) | Simple |
| `branch-list.md` | 1 (branch_list) | Simple |
| `push.md` | 1 (push) | Simple |
| `pull.md` | 1 (pull) | Simple |
| `commit.md` | 1-2 (commit, or diff + generate) | Medium |
| `commit-and-push.md` | 2 (commit, push) | Simple |
| `pr-create.md` | 2-3 (diff, generate_body, pr_create) | Medium |
| `pr-comment.md` | 1-2 (pr_comment, or analyze + comment) | Medium |
| `pr-review.md` | 2-3 (diff, analyze, review) | Complex |
| `pr-merge.md` | 1-2 (pr_merge, worktree_cleanup) | Simple |
| `tag-create.md` | 1 (tag_create) | Simple |
| `tag-push.md` | 1 (tag_push) | Simple |
| `tag-list.md` | 1 (tag_list) | Simple |
| `worktree-list.md` | 1 (worktree_list) | Simple |
| `worktree-remove.md` | 1 (worktree_remove) | Simple |
| `worktree-cleanup.md` | 1 (worktree_cleanup) | Simple |
| `cleanup.md` | 1-2 (stale_list, branch_delete) | Medium |
| `init.md` | 3-5 (detect, validate, create_config) | Complex |
| ... | ... | ... |

#### 4.1.2 Simplify Commands

Reduce each command to 5-10 lines:

**Before (v2.0 - 100+ lines):**
```markdown
# /repo:branch-create

[Extensive argument parsing]
[Validation logic]
[Workflow steps with MCP calls]
[Error handling]
[Output formatting]
```

**After (v3.0 - 5 lines):**
```markdown
# /repo:branch-create

Create a Git branch from work items, descriptions, or direct names.

Invokes the branch-create agent to handle branch creation.
```

#### 4.1.3 Archive Old Components

Move to `plugins/repo/archived/`:
- `skills/` (15 directories)
- `scripts/` (7 files)
- `handlers/` (if any remain)

Create `archived/README.md` explaining:
- What was archived and why
- Performance comparison (before/after)
- Reference for historical context

#### 4.1.4 Delete Manager Agent

Remove `plugins/repo/agents/fractary-faber-repo-manager.md` (1000+ lines → 0)

### 4.2 Phase 2: Work Plugin Migration

**Duration:** 1 week
**Scope:** All 26 work plugin commands

Same pattern as repo plugin:
1. Create 26 dedicated agents
2. Simplify 26 commands
3. Archive skills/fractary-faber-scripts
4. Remove manager agent

### 4.3 Phase 3: Remaining Plugins

**Duration:** 1-2 weeks
**Scope:** spec, logs, file, docs plugins

| Plugin | Commands | Agents to Create |
|--------|----------|-----------------|
| spec | 6 | 6 |
| logs | 10 | 10 |
| file | 4 | 4 |
| docs | 5 | 5 |

### 4.4 Phase 4: Testing & Validation

**Duration:** 1 week

1. **Auto-Trigger Tests**
   - Natural language requests match correct agent
   - Examples in agent descriptions work

2. **Command Invocation Tests**
   - Each command correctly invokes its agent
   - Arguments passed correctly

3. **MCP Tool Tests**
   - Each agent's MCP calls work
   - Error handling catches failures

4. **Integration Tests**
   - Full workflows (branch → commit → PR → merge)
   - Cross-plugin operations

### 4.5 Phase 5: Documentation

**Duration:** 3 days

1. Update plugin READMEs
2. Update command documentation
3. Add migration guide for external plugins
4. Update SPEC-00026 to reference this architecture

## 5. Technical Specifications

### 5.1 Agent Definition Schema

```yaml
# Agent file structure
name: string                    # Agent identifier
description: string             # What this agent does
use_cases: string[]            # When to use (for auto-trigger)
examples: string[]             # Example user requests
arguments:
  - name: string
    type: string
    required: boolean
    description: string
workflow:
  - step: number
    condition: string?         # Optional: "if work_id provided"
    actions:
      - mcp_tool: string       # MCP tool name
        params: object         # Tool parameters
output:
  success: string              # Success message format
  error: string                # Error message format
```

### 5.2 MCP Tool Invocation Pattern

```markdown
## Workflow

<WORKFLOW>
1. Extract arguments:
   - arg1 from command or natural language
   - arg2 (optional, default: value)

2. Execute operation:

   Call: fractary_{plugin}_{operation}
   Parameters: {
     arg1: extracted_value,
     arg2: extracted_value
   }

3. Handle result:
   Success: "✅ Operation completed: {result}"
   Error: Display MCP error message

</WORKFLOW>
```

### 5.3 File Organization

```
plugins/{plugin}/
├── commands/
│   ├── command-1.md           # Ultra-lightweight (5-10 lines)
│   ├── command-2.md
│   └── ...
├── agents/
│   ├── command-1.md           # Dedicated agent (60-100 lines)
│   ├── command-2.md
│   └── ...
├── archived/                  # Old v2.0 components
│   ├── README.md              # Explains what and why
│   ├── skills/
│   ├── scripts/
│   └── handlers/
├── config/
├── docs/
└── README.md
```

## 6. Success Metrics

### 6.1 Performance Metrics

| Metric | v2.0 Baseline | v3.0 Target | Improvement |
|--------|--------------|-------------|-------------|
| **Latency (simple op)** | 8-10s | 1-2s | 5-7x faster |
| **Latency (complex op)** | 12-15s | 2-4s | 4-5x faster |
| **Tokens per operation** | 2500-3500 | 300-800 | 70-90% reduction |
| **Cost per operation** | $0.018-0.020 | $0.0003-0.008 | 85-98% reduction |
| **LLM invocations** | 3-4 | 1 | 75% reduction |

### 6.2 Code Metrics

| Metric | v2.0 Baseline | v3.0 Target | Improvement |
|--------|--------------|-------------|-------------|
| **Commands (lines)** | 100-350 each | 5-10 each | 95% reduction |
| **Manager agent (lines)** | 1000-1500 | 0 (deleted) | 100% reduction |
| **Skills** | 15 per plugin | 0 (archived) | 100% reduction |
| **Scripts** | 150+ | 0 (archived) | 100% reduction |
| **Handlers** | 3+ per platform | 0 (SDK) | 100% reduction |
| **Total plugin code** | ~10,000 lines | ~2,500 lines | 75% reduction |

### 6.3 Reliability Metrics

| Metric | v2.0 Baseline | v3.0 Target |
|--------|--------------|-------------|
| **Routing accuracy** | ~85% (manager decides) | 100% (hardcoded) |
| **Auto-trigger accuracy** | ~70% (generic descriptions) | ~95% (specific examples) |
| **Error handling** | Inconsistent | Consistent per agent |

## 7. Risks & Mitigations

### 7.1 Migration Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Breaking existing workflows** | High | Archive old components (don't delete), test extensively |
| **Missing MCP tools** | Medium | Verify all needed tools exist before migration |
| **Agent auto-trigger overlap** | Medium | Write specific, non-overlapping descriptions |
| **SDK missing platform support** | Low | SDK already supports GitHub/GitLab/Bitbucket |

### 7.2 Operational Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **MCP server unavailable** | High | Agents can fall back to CLI |
| **Agent context limits** | Low | Agents are small (60-100 lines) |
| **Performance regression** | Low | Measure before/after each plugin |

## 8. Open Questions

### 8.1 Resolved

- **Q: Manager agent vs dedicated agents?**
  A: Dedicated agents (no routing decisions, better auto-trigger)

- **Q: Keep skills or remove?**
  A: Remove (archive). MCP makes skills unnecessary overhead.

- **Q: Where does platform logic live?**
  A: SDK handles platform detection and abstraction.

### 8.2 Pending

- **Q: Should agents have claude.md files?**
  A: Likely no - keep agents self-contained. To be validated.

- **Q: How to handle agent-to-agent calls?**
  A: Via Task tool. To be documented with examples.

## 9. References

### 9.1 Related Documents

- [Framework Guide](../docs/guides/new-claude-plugin-framework.md) - Comprehensive v3.0 documentation
- [SPEC-00026](./SPEC-00026-distributed-plugin-architecture.md) - Plugin distribution architecture
- [MCP Server README](../mcp/server/README.md) - MCP tool documentation
- [SDK README](../sdk/js/README.md) - SDK documentation

### 9.2 External References

- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP specification
- [Claude Code Plugins](https://docs.anthropic.com/claude-code/plugins) - Plugin documentation

## 10. Appendices

### Appendix A: Example Agent Migration

**Before: Manager Agent Route (v2.0)**
```markdown
# repo-manager Agent

Routes repository operations to appropriate skills.

<SUPPORTED_OPERATIONS>
1. branch-create → branch-manager skill
2. branch-delete → branch-manager skill
3. commit → commit-creator skill
4. push → branch-pusher skill
... (22 operations)
</SUPPORTED_OPERATIONS>

<WORKFLOW>
1. Parse operation from user request
2. Route to appropriate skill
3. Return skill result
</WORKFLOW>
```

**After: Dedicated Agent (v3.0)**
```markdown
# branch-create Agent

Create Git branches from work items, descriptions, or direct names.

**Use this agent when:**
- User wants to create a new Git branch
- User mentions "create branch", "new branch", "make a branch"
- User references a work item and wants a branch for it

**Examples:**
- "Create a branch for issue 123"
- "Make a feature branch called dark-mode"
- "Create a branch for the authentication work"

## Workflow

<WORKFLOW>
1. Extract arguments:
   - work_item_id (issue/ticket number)
   - name (direct branch name)
   - description (for semantic name generation)
   - base (base branch, default: main)

2. Determine creation path:

   If work_item_id provided:
     - Call: fractary_work_issue_fetch(work_item_id)
     - Call: fractary_repo_branch_name_generate(work_item_id, issue.title)
     - Call: fractary_repo_branch_create(name, base)

   If description provided:
     - Call: fractary_repo_branch_name_generate(description)
     - Call: fractary_repo_branch_create(name, base)

   If name provided directly:
     - Call: fractary_repo_branch_create(name, base)

3. Return result:
   "✅ Created branch '{name}' from '{base}'"
</WORKFLOW>
```

### Appendix B: MCP Tool Reference (Repo Module)

| Tool | Description | Parameters |
|------|-------------|------------|
| `fractary_repo_branch_create` | Create a new branch | name, base |
| `fractary_repo_branch_delete` | Delete a branch | name, location |
| `fractary_repo_branch_list` | List branches | stale, merged, pattern |
| `fractary_repo_branch_name_generate` | Generate semantic name | work_id, description, type |
| `fractary_repo_commit` | Create a commit | message, type, scope, body |
| `fractary_repo_push` | Push to remote | branch, remote, force |
| `fractary_repo_pull` | Pull from remote | branch, remote, strategy |
| `fractary_repo_pr_create` | Create pull request | title, body, base, head |
| `fractary_repo_pr_comment` | Comment on PR | pr_number, comment |
| `fractary_repo_pr_merge` | Merge pull request | pr_number, strategy |
| `fractary_repo_tag_create` | Create a tag | name, message, commit |
| `fractary_repo_tag_push` | Push tag to remote | name, remote |
| `fractary_repo_worktree_create` | Create worktree | branch, path |
| `fractary_repo_worktree_remove` | Remove worktree | branch, force |
| `fractary_repo_status` | Get repo status | - |
| `fractary_repo_diff` | Get diff | staged |
| ... | ... | ... |

### Appendix C: Migration Checklist

#### Per Plugin Migration
- [ ] Verify all needed MCP tools exist
- [ ] Create dedicated agents (one per command)
- [ ] Write specific auto-trigger examples for each agent
- [ ] Simplify commands to 5-10 lines
- [ ] Archive skills directory
- [ ] Archive scripts directory
- [ ] Delete manager agent
- [ ] Update plugin README
- [ ] Test auto-triggering
- [ ] Test command invocation
- [ ] Measure performance improvement

#### Final Validation
- [ ] All plugins migrated
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Performance metrics recorded
- [ ] No regressions in functionality
