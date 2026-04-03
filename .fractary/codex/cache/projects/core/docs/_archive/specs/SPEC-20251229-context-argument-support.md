---
spec_id: SPEC-20251229-context-argument-support
title: Universal --context Argument Support for Fractary Core Plugins
type: feature
status: draft
created: 2025-12-29
author: claude-opus-4-6
validated: false
source: conversation
related_docs:
  - plugins/spec/commands/fractary-faber-create.md
  - plugins/spec/commands/fractary-faber-refine.md
  - plugins/docs/commands/fractary-faber-write.md
  - plugins/work/commands/fractary-faber-issue-refine.md
changelog: []
---

# Feature Specification: Universal --context Argument Support

**Type**: Feature - Systematic Enhancement
**Status**: Draft
**Created**: 2025-12-29

## 1. Executive Summary

This specification details the systematic addition of a `--context` argument to all 41 Fractary Core plugin commands and updates to 29 agents to handle contextual instructions. This enhancement provides users with a consistent, universal mechanism to pass additional contextual instructions to any command, enabling more flexible and precise control over agent behavior.

### 1.1 Scope

This document covers:
- Migration of existing `--prompt` arguments to `--context` for consistency
- Addition of `--context` to all 41 commands across 7 plugins
- Updates to 29 agents to parse and apply context appropriately
- Standardized patterns for context handling
- Backward compatibility considerations

### 1.2 Design Goals

1. **Universal Availability** - Every command supports `--context`
2. **Consistent Naming** - Replace inconsistent `--prompt` with standardized `--context`
3. **Non-Breaking** - Existing workflows continue to function
4. **Minimal Overhead** - Context is optional, no impact when unused
5. **Agent Awareness** - Agents understand and apply context appropriately

### 1.3 Key Metrics

| Metric | Before | After |
|--------|--------|-------|
| Commands with context support | 5 | 41 |
| Agents with context handling | 4 | 29 |
| Consistent argument naming | No (`--prompt` vs `--context`) | Yes (`--context`) |
| Universal availability | 12% of commands | 100% of commands |

## 2. Background & Motivation

### 2.1 Current State

Currently, only a small subset of commands support passing additional instructions:

| Plugin | Command | Current Argument |
|--------|---------|------------------|
| spec | create | `--prompt` |
| spec | refine | `--prompt` |
| docs | write | `--prompt` |
| work | issue-refine | `--prompt` |

**Issues with Current State:**

1. **Inconsistent Availability** - Most commands lack context support
2. **Inconsistent Naming** - Some use `--prompt`, implying generation rather than guidance
3. **Missing Capability** - Users cannot guide agent behavior for 36 commands
4. **Discoverability** - No standard pattern for users to expect

### 2.2 Use Cases Enabled by Universal --context

**Use Case 1: Focused Operations**
```bash
# Focus documentation audit on security concerns
/fractary-docs:audit --context "Focus on security-related documentation gaps"

# Commit with specific style guidance
/fractary-repo:commit --context "Use conventional commit format with scope"
```

**Use Case 2: Output Customization**
```bash
# Get verbose log analysis
/fractary-logs:analyze errors --context "Include full stack traces and timestamps"

# Concise issue list
/fractary-work:issue-list --context "Show only critical bugs, one line per issue"
```

**Use Case 3: Behavioral Guidance**
```bash
# Conservative file operations
/fractary-file:switch-handler s3 --context "Verify current data is backed up before switching"

# Strict validation
/fractary-spec:validate --context "Apply strict validation, fail on any warnings"
```

**Use Case 4: Domain-Specific Context**
```bash
# Healthcare compliance context
/fractary-docs:write api --context "This API handles PHI data, ensure HIPAA compliance is documented"

# Financial context
/fractary-logs:audit --context "Flag any operations involving financial transactions"
```

## 3. Architecture

### 3.1 Pattern Overview

The `--context` argument follows a simple flow:

```
User Command with --context
         |
         v
    Command File (argument-hint includes --context)
         |
         v
    Task Tool Invocation (passes $ARGUMENTS including --context)
         |
         v
    Agent (parses --context, applies to behavior)
         |
         v
    Execution (context influences decisions/output)
```

### 3.2 Command File Changes

Every command file requires:

1. **argument-hint update** - Add `[--context "<instructions>"]` to argument-hint
2. **No logic changes** - Commands already pass `$ARGUMENTS` to agents

**Before:**
```yaml
---
name: fractary-logs:analyze
argument-hint: '<type> [--issue <number>] [--since <date>] [--until <date>] [--verbose]'
---
```

**After:**
```yaml
---
name: fractary-logs:analyze
argument-hint: '<type> [--issue <number>] [--since <date>] [--until <date>] [--verbose] [--context "<instructions>"]'
---
```

### 3.3 Agent File Changes

Each agent requires updates to:

1. **ARGUMENTS section** - Document `--context` parameter
2. **WORKFLOW section** - Include context parsing in step 1
3. **CONTEXT_HANDLING section** (new) - Define how context is applied

**New Section Pattern:**
```markdown
<CONTEXT_HANDLING>
The `--context` argument provides additional instructions that influence agent behavior.

**How context is applied:**
- [Specific to agent: focus areas, output formatting, validation strictness, etc.]

**Examples:**
- `--context "Focus on security issues"` - Prioritizes security-related findings
- `--context "Be verbose"` - Provides detailed output
- `--context "Skip X"` - Excludes specific items

**Context does NOT:**
- Override explicit arguments (--verbose always means verbose)
- Change core functionality (analyze still analyzes)
- Bypass safety checks or validations
</CONTEXT_HANDLING>
```

### 3.4 Argument Precedence

When `--context` conflicts with explicit arguments:

1. **Explicit arguments win** - `--verbose` always means verbose, even if context says "be brief"
2. **Context refines behavior** - Context guides HOW explicit arguments are interpreted
3. **Context fills gaps** - Context provides guidance where no explicit argument exists

## 4. Migration from --prompt to --context

### 4.1 Rationale for Renaming

| Aspect | `--prompt` | `--context` |
|--------|-----------|-------------|
| Implication | "Generate something" | "Here's additional guidance" |
| Scope | Generation-focused | Universal applicability |
| Clarity | Ambiguous (prompt for what?) | Clear (contextual instructions) |
| Industry Standard | Less common | More common (LLM tooling) |

### 4.2 Migration Strategy

**Phase 1: Add --context everywhere (non-breaking)**
- All commands gain `--context` support
- Agents updated to parse `--context`

**Phase 2: Deprecate --prompt (soft warning)**
- Commands with `--prompt` also accept `--context`
- Using `--prompt` logs deprecation notice
- Documentation updated to prefer `--context`

**Phase 3: Remove --prompt (future)**
- `--prompt` removed from argument-hints
- Agents no longer parse `--prompt`
- Only if breaking change is acceptable

### 4.3 Backward Compatibility

For commands currently using `--prompt`:

```markdown
<ARGUMENTS>
- `--context "<instructions>"` - Additional contextual instructions (preferred)
- `--prompt "<instructions>"` - Alias for --context (deprecated, use --context)
</ARGUMENTS>

<WORKFLOW>
## Step 1: Parse Arguments
...
- `--context` or `--prompt`: Additional instructions (--context takes precedence)
...
</WORKFLOW>
```

## 5. Complete Command Inventory

### 5.1 docs Plugin (5 commands)

| Command | Current Args | Add --context | Agent Update |
|---------|-------------|---------------|--------------|
| audit | none | Yes | docs-audit.md |
| check-consistency | none | Yes | docs-check-consistency.md |
| list | none | Yes | docs-list.md |
| validate | none | Yes | docs-validate.md |
| write | `--prompt` | Migrate | docs-write.md |

### 5.2 file Plugin (4 commands)

| Command | Current Args | Add --context | Agent Update |
|---------|-------------|---------------|--------------|
| init | none | Yes | file-init.md |
| show-config | none | Yes | file-show-config.md |
| switch-handler | none | Yes | file-switch-handler.md |
| test-connection | none | Yes | file-test-connection.md |

### 5.3 logs Plugin (10 commands)

| Command | Current Args | Add --context | Agent Update |
|---------|-------------|---------------|--------------|
| analyze | none | Yes | logs-analyze.md |
| archive | none | Yes | logs-archive.md |
| audit | none | Yes | logs-audit.md |
| capture | none | Yes | logs-capture.md |
| cleanup | none | Yes | logs-cleanup.md |
| init | none | Yes | logs-init.md |
| log | none | Yes | logs-log.md |
| read | none | Yes | logs-read.md |
| search | none | Yes | logs-search.md |
| stop | none | Yes | logs-stop.md |

### 5.4 repo Plugin (8 commands)

| Command | Current Args | Add --context | Agent Update |
|---------|-------------|---------------|--------------|
| commit | none | Yes | N/A (direct) |
| commit-push | none | Yes | N/A (direct) |
| commit-push-pr | none | Yes | N/A (direct) |
| init | none | Yes | init.md |
| pr-create | none | Yes | N/A (direct) |
| pr-merge | none | Yes | N/A (direct) |
| pr-review | none | Yes | N/A (direct) |
| pull | none | Yes | N/A (direct) |

### 5.5 spec Plugin (5 commands)

| Command | Current Args | Add --context | Agent Update |
|---------|-------------|---------------|--------------|
| archive | none | Yes | spec-archive.md |
| create | `--prompt` | Migrate | spec-create.md |
| init | none | Yes | spec-init.md |
| refine | `--prompt` | Migrate | spec-refine.md |
| validate | none | Yes | spec-validate.md |

### 5.6 status Plugin (2 commands)

| Command | Current Args | Add --context | Agent Update |
|---------|-------------|---------------|--------------|
| install | none | Yes | status-install.md |
| sync | none | Yes | status-sync.md |

### 5.7 work Plugin (7 commands)

| Command | Current Args | Add --context | Agent Update |
|---------|-------------|---------------|--------------|
| init | none | Yes | init.md |
| issue-create | none | Yes | N/A (direct) |
| issue-fetch | none | Yes | N/A (direct) |
| issue-list | none | Yes | N/A (direct) |
| issue-refine | `--prompt` | Migrate | issue-refine.md |
| issue-search | none | Yes | N/A (direct) |
| issue-update | none | Yes | N/A (direct) |

### 5.8 Summary Totals

| Category | Count |
|----------|-------|
| Total Commands | 41 |
| Commands needing --context added | 37 |
| Commands with --prompt to migrate | 4 |
| Agents needing updates | 29 |
| Direct commands (no agent) | 12 |

## 6. Agent Update Patterns

### 6.1 Standard Agent Update Template

For agents that delegate to skills or perform multi-step workflows:

```markdown
<ARGUMENTS>
- `[existing args...]`
- `--context "<instructions>"` - Optional: Additional contextual instructions
</ARGUMENTS>

<WORKFLOW>
## Step 1: Parse Arguments
- Parse all explicit arguments
- Extract `--context` if provided
- Apply context to workflow decisions where appropriate
...
</WORKFLOW>

<CONTEXT_HANDLING>
The `--context` argument provides additional instructions that influence agent behavior.

**How context is applied:**
- Influences [specific decision points for this agent]
- Adjusts [output format, verbosity, focus areas]
- Guides [prioritization, filtering, selection]

**Context does NOT:**
- Override explicit arguments
- Change core operation semantics
- Bypass validation or safety checks
</CONTEXT_HANDLING>
```

### 6.2 Direct Command Pattern

For commands without dedicated agents (e.g., issue-create, pr-create):

```markdown
---
name: fractary-work:issue-create
argument-hint: '[--title "<title>"] [--body "<text>"] [--label <label>] [--assignee <user>] [--context "<instructions>"]'
---

## Context Handling

If `--context` is provided, use it to guide:
- Issue title/body generation when not explicitly provided
- Label selection based on context hints
- Description formatting and detail level

Parse arguments:
- --title: Issue title (or generate from conversation context)
- --body: Issue description (or generate from conversation context)
- --context: Additional instructions for generation/formatting
...
```

### 6.3 Context Application Examples by Agent Type

**Audit/Analysis Agents:**
```markdown
<CONTEXT_HANDLING>
**How context is applied:**
- Focus areas: `--context "Focus on security"` prioritizes security findings
- Severity filtering: `--context "Only critical issues"` filters output
- Verbosity: `--context "Include recommendations"` adds remediation guidance
</CONTEXT_HANDLING>
```

**Write/Create Agents:**
```markdown
<CONTEXT_HANDLING>
**How context is applied:**
- Content focus: `--context "For technical audience"` adjusts language
- Format preferences: `--context "Use bullet points"` influences structure
- Domain context: `--context "Healthcare domain"` adds relevant terminology
</CONTEXT_HANDLING>
```

**Init/Setup Agents:**
```markdown
<CONTEXT_HANDLING>
**How context is applied:**
- Configuration preferences: `--context "Minimal setup"` reduces defaults
- Environment hints: `--context "Production environment"` adjusts settings
- Safety level: `--context "Verify before changes"` adds confirmation steps
</CONTEXT_HANDLING>
```

## 7. Implementation Plan

### 7.1 Phase 1: Command File Updates (41 files)

Update `argument-hint` in all command files:

**docs plugin (5 files):**
- [ ] `/plugins/docs/commands/fractary-faber-audit.md`
- [ ] `/plugins/docs/commands/fractary-faber-check-consistency.md`
- [ ] `/plugins/docs/commands/fractary-faber-list.md`
- [ ] `/plugins/docs/commands/fractary-faber-validate.md`
- [ ] `/plugins/docs/commands/fractary-faber-write.md` (migrate --prompt)

**file plugin (4 files):**
- [ ] `/plugins/file/commands/fractary-faber-init.md`
- [ ] `/plugins/file/commands/fractary-faber-show-config.md`
- [ ] `/plugins/file/commands/fractary-faber-switch-handler.md`
- [ ] `/plugins/file/commands/fractary-faber-test-connection.md`

**logs plugin (10 files):**
- [ ] `/plugins/logs/commands/fractary-faber-analyze.md`
- [ ] `/plugins/logs/commands/fractary-faber-archive.md`
- [ ] `/plugins/logs/commands/fractary-faber-audit.md`
- [ ] `/plugins/logs/commands/fractary-faber-capture.md`
- [ ] `/plugins/logs/commands/fractary-faber-cleanup.md`
- [ ] `/plugins/logs/commands/fractary-faber-init.md`
- [ ] `/plugins/logs/commands/fractary-faber-log.md`
- [ ] `/plugins/logs/commands/fractary-faber-read.md`
- [ ] `/plugins/logs/commands/fractary-faber-search.md`
- [ ] `/plugins/logs/commands/fractary-faber-stop.md`

**repo plugin (8 files):**
- [ ] `/plugins/repo/commands/fractary-faber-commit.md`
- [ ] `/plugins/repo/commands/fractary-faber-commit-push.md`
- [ ] `/plugins/repo/commands/fractary-faber-commit-push-pr.md`
- [ ] `/plugins/repo/commands/fractary-faber-init.md`
- [ ] `/plugins/repo/commands/fractary-faber-pr-create.md`
- [ ] `/plugins/repo/commands/fractary-faber-pr-merge.md`
- [ ] `/plugins/repo/commands/fractary-faber-pr-review.md`
- [ ] `/plugins/repo/commands/fractary-faber-pull.md`

**spec plugin (5 files):**
- [ ] `/plugins/spec/commands/fractary-faber-archive.md`
- [ ] `/plugins/spec/commands/fractary-faber-create.md` (migrate --prompt)
- [ ] `/plugins/spec/commands/fractary-faber-init.md`
- [ ] `/plugins/spec/commands/fractary-faber-refine.md` (migrate --prompt)
- [ ] `/plugins/spec/commands/fractary-faber-validate.md`

**status plugin (2 files):**
- [ ] `/plugins/status/commands/fractary-faber-install.md`
- [ ] `/plugins/status/commands/fractary-faber-sync.md`

**work plugin (7 files):**
- [ ] `/plugins/work/commands/fractary-faber-init.md`
- [ ] `/plugins/work/commands/fractary-faber-issue-create.md`
- [ ] `/plugins/work/commands/fractary-faber-issue-fetch.md`
- [ ] `/plugins/work/commands/fractary-faber-issue-list.md`
- [ ] `/plugins/work/commands/fractary-faber-issue-refine.md` (migrate --prompt)
- [ ] `/plugins/work/commands/fractary-faber-issue-search.md`
- [ ] `/plugins/work/commands/fractary-faber-issue-update.md`

### 7.2 Phase 2: Agent File Updates (29 files)

Update agents with ARGUMENTS, WORKFLOW, and CONTEXT_HANDLING sections:

**docs plugin (5 agents):**
- [ ] `/plugins/docs/agents/fractary-faber-docs-audit.md`
- [ ] `/plugins/docs/agents/fractary-faber-docs-check-consistency.md`
- [ ] `/plugins/docs/agents/fractary-faber-docs-list.md`
- [ ] `/plugins/docs/agents/fractary-faber-docs-validate.md`
- [ ] `/plugins/docs/agents/fractary-faber-docs-write.md`

**file plugin (4 agents):**
- [ ] `/plugins/file/agents/fractary-faber-file-init.md`
- [ ] `/plugins/file/agents/fractary-faber-file-show-config.md`
- [ ] `/plugins/file/agents/fractary-faber-file-switch-handler.md`
- [ ] `/plugins/file/agents/fractary-faber-file-test-connection.md`

**logs plugin (10 agents):**
- [ ] `/plugins/logs/agents/fractary-faber-logs-analyze.md`
- [ ] `/plugins/logs/agents/fractary-faber-logs-archive.md`
- [ ] `/plugins/logs/agents/fractary-faber-logs-audit.md`
- [ ] `/plugins/logs/agents/fractary-faber-logs-capture.md`
- [ ] `/plugins/logs/agents/fractary-faber-logs-cleanup.md`
- [ ] `/plugins/logs/agents/fractary-faber-logs-init.md`
- [ ] `/plugins/logs/agents/fractary-faber-logs-log.md`
- [ ] `/plugins/logs/agents/fractary-faber-logs-read.md`
- [ ] `/plugins/logs/agents/fractary-faber-logs-search.md`
- [ ] `/plugins/logs/agents/fractary-faber-logs-stop.md`

**repo plugin (1 agent):**
- [ ] `/plugins/repo/agents/fractary-faber-init.md`

**spec plugin (5 agents):**
- [ ] `/plugins/spec/agents/fractary-faber-spec-archive.md`
- [ ] `/plugins/spec/agents/fractary-faber-spec-create.md`
- [ ] `/plugins/spec/agents/fractary-faber-spec-init.md`
- [ ] `/plugins/spec/agents/fractary-faber-spec-refine.md`
- [ ] `/plugins/spec/agents/fractary-faber-spec-validate.md`

**status plugin (2 agents):**
- [ ] `/plugins/status/agents/fractary-faber-status-install.md`
- [ ] `/plugins/status/agents/fractary-faber-status-sync.md`

**work plugin (2 agents):**
- [ ] `/plugins/work/agents/fractary-faber-init.md`
- [ ] `/plugins/work/agents/fractary-faber-issue-refine.md`

### 7.3 Phase 3: Plugin Manifest Updates (7 files)

Update version numbers in plugin manifests:

- [ ] `/plugins/docs/.claude-plugin/plugin.json`
- [ ] `/plugins/file/.claude-plugin/plugin.json`
- [ ] `/plugins/logs/.claude-plugin/plugin.json`
- [ ] `/plugins/repo/.claude-plugin/plugin.json`
- [ ] `/plugins/spec/.claude-plugin/plugin.json`
- [ ] `/plugins/status/.claude-plugin/plugin.json`
- [ ] `/plugins/work/.claude-plugin/plugin.json`

### 7.4 Phase 4: Testing

**Unit Testing (per command):**
- [ ] Verify --context is accepted without error
- [ ] Verify --context is passed to agent
- [ ] Verify context influences behavior appropriately
- [ ] Verify explicit arguments override context

**Integration Testing (per plugin):**
- [ ] Test commands with --context across plugin
- [ ] Verify no regression in existing functionality
- [ ] Test edge cases (empty context, very long context)

**Migration Testing (4 commands):**
- [ ] Verify --prompt still works (backward compatibility)
- [ ] Verify --context takes precedence over --prompt
- [ ] Verify deprecation notice is shown for --prompt

### 7.5 Phase 5: Documentation

- [ ] Update plugin READMEs with --context examples
- [ ] Add "Context Argument" section to developer guide
- [ ] Update command reference documentation
- [ ] Create migration guide for --prompt users

## 8. File Changes Summary

### 8.1 Files Modified

| Category | Count | Files |
|----------|-------|-------|
| Command files | 41 | `/plugins/*/commands/*.md` |
| Agent files | 29 | `/plugins/*/agents/*.md` |
| Plugin manifests | 7 | `/plugins/*/.claude-plugin/plugin.json` |
| **Total** | **77** | |

### 8.2 Estimated Line Changes

| Change Type | Estimate |
|-------------|----------|
| Command argument-hint additions | ~41 lines (1 per file) |
| Agent ARGUMENTS updates | ~58 lines (2 per file) |
| Agent WORKFLOW updates | ~87 lines (3 per file) |
| Agent CONTEXT_HANDLING sections | ~435 lines (15 per file) |
| **Total New/Modified Lines** | **~620 lines** |

## 9. Acceptance Criteria

### 9.1 Functional Requirements

- [ ] All 41 commands accept `--context` argument
- [ ] All 29 agents parse and apply `--context`
- [ ] Context influences agent behavior appropriately
- [ ] Explicit arguments override context suggestions
- [ ] Commands with `--prompt` also accept `--context`
- [ ] `--prompt` shows deprecation notice

### 9.2 Non-Functional Requirements

- [ ] No performance regression (context parsing is lightweight)
- [ ] No breaking changes to existing workflows
- [ ] Consistent documentation pattern across all agents
- [ ] All plugin versions incremented appropriately

### 9.3 Quality Criteria

- [ ] 100% of commands have --context in argument-hint
- [ ] 100% of agents have CONTEXT_HANDLING section
- [ ] All tests pass with and without --context
- [ ] Documentation complete for all commands

## 10. Risks & Mitigations

### Risk 1: Context Misinterpretation
**Impact**: Medium - Agent misunderstands context instructions
**Mitigation**: Clear CONTEXT_HANDLING documentation, explicit examples
**Fallback**: Users can omit context, explicit arguments still work

### Risk 2: Breaking Existing Workflows
**Impact**: High - Users relying on --prompt experience issues
**Mitigation**: Backward compatibility with --prompt as alias
**Fallback**: --prompt continues to work, migration is optional

### Risk 3: Inconsistent Implementation
**Impact**: Medium - Different agents handle context differently
**Mitigation**: Standard templates, code review checklist
**Fallback**: Iterative refinement based on feedback

### Risk 4: Scope Creep
**Impact**: Low - Adding features beyond context support
**Mitigation**: Strict scope definition in this spec
**Fallback**: New features go in separate specs

### Risk 5: Testing Gaps
**Impact**: Medium - Some commands not properly tested
**Mitigation**: Testing checklist per command, automation where possible
**Fallback**: Manual testing before release

## 11. Future Enhancements

**Out of Scope for This Spec:**
- Context history/memory across commands
- Context templates (predefined context sets)
- Context validation (semantic checking)
- Context suggestions (auto-complete)
- Context inheritance (parent command context)

**Potential Future Features:**
- `--context-file <path>` - Load context from file
- `--context-preset <name>` - Use predefined context template
- Context profiles per project/workspace
- AI-suggested context based on operation

## 12. Example Usage

### 12.1 Before and After

**Before (limited context support):**
```bash
# Only some commands accept guidance
/fractary-spec:create --prompt "Focus on API design"
/fractary-logs:analyze errors  # No way to guide analysis

# Inconsistent naming
/fractary-docs:write api --prompt "..."
/fractary-work:issue-refine 123 --prompt "..."
```

**After (universal context support):**
```bash
# All commands accept --context
/fractary-spec:create --context "Focus on API design"
/fractary-logs:analyze errors --context "Include security-related errors only"
/fractary-docs:audit --context "Check for outdated API references"
/fractary-repo:commit --context "Use conventional commit format"
/fractary-file:init --context "Configure for production environment"

# Consistent naming across all plugins
/fractary-docs:write api --context "..."
/fractary-work:issue-refine 123 --context "..."
```

### 12.2 Real-World Scenarios

**Scenario 1: Security-Focused Audit**
```bash
# Audit documentation with security focus
/fractary-docs:audit --context "Focus on security documentation: authentication, authorization, data handling, and compliance"

# Output prioritizes security-related gaps
```

**Scenario 2: Verbose Log Analysis**
```bash
# Analyze errors with full details
/fractary-logs:analyze errors --since 2025-12-28 --context "Include full stack traces, group by error type, show frequency"

# Output includes detailed breakdown
```

**Scenario 3: Domain-Specific Specification**
```bash
# Create spec for healthcare application
/fractary-spec:create --work-id 456 --context "This is a healthcare application handling PHI. Ensure HIPAA compliance requirements are addressed in architecture"

# Generated spec includes compliance considerations
```

**Scenario 4: Conservative Operations**
```bash
# Cautious file handler switch
/fractary-file:switch-handler s3 --context "Verify all local files are synced before switching. Show diff of what will change."

# Agent adds verification steps
```

## 13. Related Work

**Similar Patterns in Other Tools:**
- GitHub CLI `--body` for additional context
- kubectl `--dry-run` for preview mode (context: "preview only")
- terraform `-var` for runtime configuration

**Internal Related Specs:**
- SPEC-20251217202523-plugin-v3-architecture (agent structure)
- SPEC-20251228-issue-refine-command (--prompt usage example)

## 14. Notes

- All commands should document context in argument-hint for discoverability
- Context should never override explicit arguments (user intent is clear)
- Empty context (`--context ""`) should be treated as no context
- Very long context should be accepted (no artificial limits)
- Context is passed as-is to agents, no preprocessing

---

*Specification generated from conversation context on 2025-12-29*
