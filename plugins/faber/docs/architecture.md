# FABER Architecture

This document describes the system architecture, design decisions, and implementation details of the FABER plugin.

## Table of Contents

- [System Overview](#system-overview)
- [3-Layer Architecture](#3-layer-architecture)
- [Component Hierarchy](#component-hierarchy)
- [Data Flow](#data-flow)
- [Design Decisions](#design-decisions)
- [Context Efficiency](#context-efficiency)
- [Extensibility](#extensibility)
- [Performance](#performance)

## System Overview

FABER is a **tool-agnostic SDLC workflow framework** built on a 3-layer architecture designed for context efficiency and platform extensibility.

### Core Principles

1. **Context Efficiency**: Minimize token usage through architectural separation
2. **Tool Agnostic**: Support multiple platforms without skill changes
3. **Domain Agnostic**: Support multiple work domains (engineering, design, writing, data)
4. **Composability**: Small, focused components that compose into complete workflows
5. **Resilience**: Automatic retry mechanisms and error recovery

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                        │
│  /fractary-faber-workflow-run, /fractary-faber-config-*  │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                   Orchestration                          │
│       workflow-runner skill (Direct Step Execution)      │
│  Iterates phases from workflow JSON (pre/steps/post)     │
│  Each step invokes a skill or executes a prompt directly │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                  Utility Skills                          │
│   config-manager, session-manager, workflow-author,      │
│   run-inspector, faber-debugger, response-validator      │
│   Invoked by workflow steps as needed                    │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                     Scripts                              │
│    Deterministic operations (fetch, commit, upload...)   │
│        Execute outside LLM context (not loaded)          │
└─────────────────────────────────────────────────────────┘
```

## 2-Layer Architecture

FABER uses a 2-layer architecture to achieve context efficiency:

### Layer 1: Skills (Decision Logic + Orchestration)

**Purpose**: High-level decision making, workflow orchestration, and platform adapter selection

**Characteristics**:
- Written in markdown (prompt engineering)
- Loaded into LLM context
- Make decisions based on inputs
- Delegate deterministic operations to scripts
- Each skill has `SKILL.md` + optional `workflow/*.md` protocols

**Components**:

**Workflow Orchestration**:
- `workflow-runner` - Orchestrates complete FABER workflow across all 5 phases by executing steps directly from workflow JSON definitions (no delegation to sub-skills per phase)

**Management Skills**:
- `config-manager` - Project configuration (init, update, validate)
- `session-manager` - Session artifact management (load, save, clear)
- `workflow-author` - Workflow definition creation and updates
- `run-inspector` - Run status inspection
- `faber-debugger` - Debugging and error handling

**Core Skills**:
- `core` - Configuration, sessions, status cards
- `faber-config` - Config loading and resolution
- `faber-state` - Workflow state management

**Example Decision Logic**:
```
Should I retry Build phase?
- Check retry_count < max_evaluate_retries
- Check Evaluate decision = NO-GO
- If yes: Return to Build
- If no: Fail workflow
```

**Example Adapter Selection**:
```bash
# Load config to determine platform
FILE_SYSTEM=$(echo "$CONFIG_JSON" | jq -r '.project.file_system')

# Route to platform-specific script
"$SKILL_DIR/scripts/$FILE_SYSTEM/upload.sh" "$LOCAL_PATH" "$REMOTE_PATH"
```

### Layer 2: Scripts (Deterministic Operations)

**Purpose**: Platform-specific deterministic operations

**Characteristics**:
- Bash scripts (deterministic, testable)
- Execute outside LLM context
- Only output enters context (not script code)
- ~50-100 lines per script

**Components**:
- `scripts/github/` - GitHub operations
- `scripts/r2/` - Cloudflare R2 operations
- `scripts/local/` - Local filesystem operations
- (future: jira, linear, s3, gitlab...)

**Example Script**:
```bash
#!/bin/bash
# Upload file to R2

LOCAL_PATH="$1"
REMOTE_PATH="$2"

aws s3 cp "$LOCAL_PATH" "s3://$BUCKET/$REMOTE_PATH" \
  --endpoint-url "$R2_ENDPOINT"

echo "https://$PUBLIC_URL/$REMOTE_PATH"
```

### Context Efficiency Comparison

**Before (Multi-Agent Architecture)**:
```
director loads: ~26K tokens
+ frame-manager: ~12K tokens
+ architect-manager: ~14K tokens
+ build-manager: ~14K tokens
+ evaluate-manager: ~16K tokens
+ release-manager: ~16K tokens
Total orchestration: ~98K tokens
```

**After (Skill-Based Architecture)**:
```
workflow-runner skill: ~15K tokens (orchestrator + direct step execution)
+ utility skills loaded on demand: ~5-10K tokens
Total orchestration: ~20-25K tokens
Savings: ~75% context reduction!

Additional benefits:
- Continuous context across all phases
- Single point of orchestration logic
- No delegation overhead (steps execute directly)
- Easier to maintain and debug
```

## Component Hierarchy

### Full Component Tree

```
User
  └─ /fractary-faber-* (Slash Commands)
      ├─ /fractary-faber-config-init
      │   └─ config-manager skill (init protocol)
      ├─ /fractary-faber-config-update
      │   └─ config-manager skill (update protocol)
      ├─ /fractary-faber-config-validate
      │   └─ config-manager skill (validate protocol)
      ├─ /fractary-faber-workflow-run
      │   └─ workflow-runner skill (executes steps from workflow JSON)
      │       ├─ Frame phase: executes pre_steps → steps → post_steps
      │       ├─ Architect phase: executes pre_steps → steps → post_steps
      │       ├─ Build phase: executes pre_steps → steps → post_steps
      │       ├─ Evaluate phase: executes pre_steps → steps → post_steps
      │       └─ Release phase: executes pre_steps → steps → post_steps
      │           Each step invokes skills or prompts directly
      ├─ /fractary-faber-run-inspect
      │   └─ run-inspector skill
      └─ /fractary-faber-session-load
          └─ session-manager skill (load protocol)
```

### Invocation Chain Example

```
User: /fractary-faber-workflow-run 123
  ↓
workflow-runner skill (direct execution in main context)
  ↓ Loads plan from workflow JSON, initializes state and task list
  ↓
Phase 1: Frame
  ↓ Executes pre_steps (session-load, env-switch, codex-sync)
  ↓ Executes steps (defined in workflow JSON)
  ↓ Executes post_steps (commit-push, issue-comment)
  ↓ Updates state → Frame complete
  ↓
Phase 2: Architect (with full Frame context)
  ↓ Same pattern: pre_steps → steps → post_steps
  ↓
Phase 3: Build (with Frame + Architect context)
  ↓
Phase 4: Evaluate (with all previous context)
  ↓ If NO-GO → retry Build (up to max_retries)
  ↓
Phase 5: Release (with complete workflow context)
  ↓ Creates PR, posts completion status
```

## Data Flow

### Workflow Data Flow

```
1. User Input
   └─ Issue ID: "123"

2. Command Processing
   ├─ Validate input
   ├─ Generate work_id: "abc12345"
   └─ Load configuration

3. State Creation
   └─ .fractary/faber/state.json
       ├─ work_id
       ├─ metadata (source, domain, timestamps)
       ├─ current_phase
       ├─ phases (frame, architect, build, evaluate, release)
       └─ history []

4. Phase Execution
   Each phase:
   ├─ Update state (phase → started)
   ├─ Execute phase operations
   ├─ Generate outputs
   ├─ Update state (phase → completed, data)
   ├─ Create workflow log entry (fractary-logs)
   └─ Post status card

5. State Updates
   After each phase:
   ├─ .fractary/faber/state.json (current state)
   │   ├─ phases.frame.status = "completed"
   │   ├─ phases.frame.data = {work_type, branch_name}
   │   ├─ phases.architect.status = "completed"
   │   ├─ phases.architect.data = {spec_file, spec_url}
   │   └─ ...
   └─ fractary-logs workflow entry (historical audit trail)

6. Final Output
   ├─ Pull request created
   ├─ State file preserved (current workflow state)
   ├─ Workflow log preserved (complete audit trail)
   └─ Status cards posted
```

### Configuration Flow

```
1. Configuration File (.fractary/config.yaml)
   └─ faber:
      ├─ schema_version: "2.0"
      ├─ workflows[]: Array of workflow configurations
      ├─ integrations: Plugin references (work, repo, spec, logs)
      ├─ logging: Workflow logging configuration
      └─ safety: Protected paths and confirmation rules

2. Config Loader (skills/fractary-faber-core/scripts/config-loader.sh)
   ├─ Reads YAML file from .fractary/config.yaml
   ├─ Extracts faber: section
   ├─ Validates schema version and required fields
   ├─ Expands environment variables
   └─ Returns validated JSON (for tool compatibility)

3. Config Consumption
   Skills read config:
   ├─ WORKFLOW=$(echo $CONFIG | jq -r '.workflows[0]')
   ├─ WORK_PLUGIN=$(echo $CONFIG | jq -r '.integrations.work_plugin')
   └─ Use config values to make decisions

4. Platform Routing
   Skill uses config to route:
   ├─ Determine platform from primitive plugin config
   └─ Platform-specific scripts handle routing internally
```

### Session State Flow

```
Session State Machine:

pending → started → in_progress → completed
   ↓                                  ↑
   └─────────→ failed ←───────────────┘

Phase Transitions:
1. frame: pending → started → completed
2. architect: pending → started → completed
3. build: pending → started → completed → (retry) → started → completed
4. evaluate: pending → started → in_progress → completed
   └─ If NO-GO: in_progress (stays until GO or max retries)
5. release: pending → started → completed
```

## Design Decisions

### Why Bash Scripts?

**Decision**: Use Bash scripts for Layer 3 (deterministic operations)

**Rationale**:
- Native to Linux/macOS (no installation needed)
- Easy to test independently (`bash script.sh` to run)
- Simple debugging (add `set -x` to trace)
- Execute outside LLM context (zero token cost)
- Familiar to DevOps engineers

**Alternatives Considered**:
- Python: More deps, harder to test in isolation
- Node.js: Requires npm, async complexity
- Inline bash in agents: Context explosion

### Why JSON for Configuration?

**Decision**: Use unified YAML configuration at `.fractary/config.yaml` with a `faber:` section

**Rationale**:
- Unified configuration across all Fractary plugins in a single file
- Human-readable format with clear structure
- Supports complex nested structures (workflows array, phase configurations)
- Easy validation with JSON Schema (YAML is JSON-compatible)
- Native processing via yq utility
- Consistent with plugin ecosystem standards

**Evolution**:
- v1.x used TOML (`.faber.config.toml`) for human-readability
- v2.0 switched to JSON at `.fractary/faber/config.json` (now deprecated)
- v3.0+ uses unified YAML at `.fractary/config.yaml` with a `faber:` section

**Alternatives Considered**:
- TOML: Requires Python conversion, inconsistent with plugin ecosystem
- Separate JSON files per plugin: File proliferation, harder to manage
- Custom format: Non-standard, reinventing wheel

### Why Dual-State Tracking?

**Decision**: Use both current state file and historical workflow logs (v2.0)

**Rationale**:
- **Current State** (`.fractary/faber/state.json`):
  - Single-workflow state for resume/retry
  - Lightweight, always current
  - Enables workflow continuation after interruption
- **Historical Logs** (fractary-logs plugin):
  - Complete audit trail across all workflows
  - Searchable history with timestamps
  - Compliance and debugging support
  - Parallel workflow tracking

**Benefits of Dual Approach**:
- Separation of concerns (current vs historical)
- No state file accumulation (only one current state)
- Rich historical data without state file bloat
- Integration with logging infrastructure

**Alternatives Considered**:
- Session files per workflow (v1.x): Accumulation problem, no centralized history
- In-memory only: Lost on crash
- Database: Overkill, adds dependency
- Git commits: Clutters history

See [STATE-TRACKING.md](STATE-TRACKING.md) for detailed implementation.

### Why Separate Skills and Scripts?

**Decision**: Separate Skills → Scripts

**Rationale**:
- **Context Efficiency**: 55-69% reduction
- **Platform Extensibility**: Add platforms without skill changes
- **Testability**: Test scripts independently
- **Maintainability**: Clear separation of concerns

**Alternatives Considered**:
- 1 layer (Monolithic skills with inline scripts): Context explosion
- 3+ layers (Skills → Adapters → Scripts): Over-engineered, too complex

### Why Retry Loop?

**Decision**: Automatic Evaluate → Build retry loop

**Rationale**:
- Tests may fail due to transient issues
- LLM can fix simple errors autonomously
- Reduces manual intervention
- Configurable limit prevents infinite loops

**Alternatives Considered**:
- No retries: Fail immediately (too brittle)
- Unlimited retries: Risk infinite loop
- Manual retry only: More user intervention

### Why Prompt Customization?

**Decision**: Support custom execution patterns in phase prompts (v2.0)

**Rationale**:
- Different teams have different workflow preferences
- Some phases benefit from guided step-by-step execution
- Flexible prompt patterns without code changes
- Supports autonomous, guided, and step-by-step execution modes

**Supported Patterns**:
- **Autonomous**: Phase executes completely without user interaction
- **Guided**: Phase executes with periodic user confirmation
- **Step-by-step**: Each operation requires explicit user approval
- **Custom**: Project-specific patterns defined in configuration

**Benefits**:
- Configurable autonomy level per phase
- No skill code changes needed
- Project-specific workflow customization
- Guardrails for production changes

See [PROMPT-CUSTOMIZATION.md](PROMPT-CUSTOMIZATION.md) for detailed implementation.

## Context Efficiency

### Token Usage Analysis

**Traditional Monolithic Approach**:
```
work-manager skill (monolithic):
- Decision logic: 200 lines
- GitHub fetch code: 100 lines
- GitHub classify code: 80 lines
- Jira fetch code: 100 lines (not used!)
- Jira classify code: 80 lines (not used!)
- Linear fetch code: 100 lines (not used!)
- Error handling: 80 lines
- Utilities: 60 lines
Total: 800 lines in context per invocation
```

**3-Layer Approach**:
```
work-manager skill:
- Decision logic: 200 lines

work-manager skill:
- Adapter selection: 80 lines
- Platform routing: 20 lines

Scripts (NOT in context):
- github/fetch-issue.sh: 50 lines (not loaded)
- github/classify-issue.sh: 40 lines (not loaded)
- Only script OUTPUT in context: ~10 lines

Total: 310 lines in context
Savings: 61% reduction
```

### Context Reduction by Component

| Component | Before | After | Savings |
|-----------|--------|-------|---------|
| work-manager | 800 | 310 | 61% |
| repo-manager | 900 | 350 | 61% |
| file-manager | 700 | 280 | 60% |
| **Average** | **800** | **313** | **61%** |

### Cumulative Impact

For a complete workflow (5 phases, multiple manager invocations):

```
Traditional approach:
- 15 manager invocations × 800 lines = 12,000 lines

3-layer approach:
- 15 manager invocations × 313 lines = 4,695 lines

Total workflow savings: 61% (7,305 lines)
```

## Extensibility

### Adding a New Platform

To add support for a new platform (e.g., GitLab):

**Step 1: Create Scripts** (Layer 3)
```bash
mkdir -p skills/fractary-faber-repo-manager/scripts/gitlab/
# Create: generate-branch-name.sh, create-branch.sh, etc.
```

**Step 2: Update Skill** (Layer 2)
```bash
# skills/fractary-faber-repo-manager/SKILL.md
# Add GitLab to supported platforms list
# No code changes needed - routing is automatic!
```

**Step 3: Update Repo Plugin Configuration**
```json
// .fractary/plugins/repo/config.json
{
  "platform": "gitlab",
  "gitlab": {
    "url": "${GITLAB_URL}",
    "token": "${GITLAB_TOKEN}"
  }
}
```

Note: Platform-specific configuration lives in the primitive plugin (fractary-repo), not in FABER config.

**Step 4: Test**
```bash
# Update repo plugin configuration
# Edit .fractary/plugins/repo/config.json to set platform = "gitlab"

# Run workflow - automatically uses GitLab scripts!
/fractary-faber-run --work-id 123
```

**No skill changes required!** The skill layer automatically routes to the correct platform.

### Adding a New Domain

To add support for a new domain (e.g., Design):

**Step 1: Create Domain Bundle** (Future)
```bash
mkdir -p domains/design/
# Create domain-specific managers
```

**Step 2: Update Configuration**
```json
// .fractary/config.yaml (faber: section)
{
  "workflows": [{
    "id": "design-workflow",
    "description": "Design-focused FABER workflow"
  }]
}
```

**Step 3: Domain-Specific Workflows**
```bash
/fractary-faber-run --work-id 123 --workflow design
# Uses design-specific Build and Evaluate logic
```

## Performance

### Workflow Execution Time

Typical workflow (engineering domain, medium complexity):

```
Phase 1: Frame        ~1-2 minutes
Phase 2: Architect    ~2-5 minutes
Phase 3: Build        ~5-15 minutes
Phase 4: Evaluate     ~2-5 minutes (×retries)
Phase 5: Release      ~1-2 minutes
Total:                ~11-29 minutes
```

### Optimization Opportunities

1. **Parallel Phase Execution** (future)
   - Some phases could run in parallel
   - E.g., Architect + Environment setup

2. **Caching** (future)
   - Cache codebase analysis
   - Cache test results

3. **Incremental Operations** (future)
   - Only test changed files
   - Only analyze modified code

### Scalability

**Current Limits**:
- State file: Single file, ~1-2KB (one active workflow)
- Workflow logs: ~1KB per workflow (managed by fractary-logs plugin)
- Concurrent workflows: Limited by LLM rate limits
- Repository size: No hard limit (uses git)

**Future Scaling**:
- Multi-workflow state management for parallel workflows
- Distributed execution for parallel workflows
- Caching layer for codebase analysis

## Security Considerations

### Credential Management

- Never commit secrets to config files
- Use environment variables for tokens
- Support for secrets managers (future)

### Protected Paths

- Configurable list of protected files
- Prevents accidental modification
- Includes .git/, credentials, etc.

### Audit Trail

- Complete workflow history via fractary-logs plugin
- All operations logged with timestamps
- Git commits traceable to work items
- Dual-state tracking for current and historical data

## See Also

- [Configuration Guide](configuration.md) - Configure FABER
- [Workflow Guide](workflow-guide.md) - Workflow details
- [README](../README.md) - Quick start
