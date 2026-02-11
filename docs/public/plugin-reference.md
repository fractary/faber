---
title: Plugin Reference
description: Reference for FABER plugin commands, agents, and templates
visibility: public
---

# Plugin Reference

Reference for the FABER Claude Code plugin (`fractary-faber`). This covers slash commands (invoked in Claude Code), the agents that power them, and agent templates for building custom agents.

---

## Plugin Commands

Commands are invoked in Claude Code with `/fractary-faber:<command>`.

### /fractary-faber:workflow-run

Execute a FABER workflow. The primary command that runs through all 5 phases (Frame, Architect, Build, Evaluate, Release).

```
/fractary-faber:workflow-run <work-id|plan-id> [options]
```

| Argument / Option | Description |
|-------------------|-------------|
| `<work-id\|plan-id>` | Work item ID (e.g., `123`) or full plan ID (required) |
| `--resume <run-id>` | Resume previous run from where it stopped |
| `--force-new` | Force fresh start, bypass auto-resume |
| `--phase <phases>` | Execute only specified phase(s), comma-separated |
| `--step <step-id>` | Execute only specified step(s), comma-separated |
| `--worktree` | Auto-create worktree on conflict without prompting |

**Model:** claude-opus-4-6 (runs directly, not delegated)

**Example:**
```
/fractary-faber:workflow-run 123
/fractary-faber:workflow-run 123 --resume run-abc123
/fractary-faber:workflow-run 123 --phase build,evaluate
```

### /fractary-faber:workflow-plan

Create a FABER execution plan without executing it.

```
/fractary-faber:workflow-plan [<target>] [options]
```

| Argument / Option | Description |
|-------------------|-------------|
| `[<target>]` | Target identifier |
| `--work-id <id>` | Work item ID |
| `--workflow <id>` | Workflow ID to use |
| `--autonomy <level>` | Override autonomy level |
| `--phase <phases>` | Plan only specified phases |

**Delegates to:** `faber-planner` agent

### /fractary-faber:run-inspect

Display workflow run status combining current state with historical logs.

```
/fractary-faber:run-inspect [work-id|run-id] [options]
```

| Argument / Option | Description |
|-------------------|-------------|
| `[work-id\|run-id]` | Work item or run ID |
| `--logs <n>` | Number of recent log entries to show |
| `--state-only` | Show state without logs |
| `--timing` | Show phase timing information |
| `--verbose` | Detailed output |
| `--json` | JSON output |

**Delegates to:** `run-inspect` agent

### /fractary-faber:config-init

Initialize FABER configuration. Auto-detects project settings and creates the `faber:` section in `.fractary/config.yaml`.

```
/fractary-faber:config-init [options]
```

| Option | Description |
|--------|-------------|
| `--autonomy <level>` | Pre-set autonomy level |
| `--force` | Overwrite existing faber section without confirmation |
| `--json` | JSON output |

**Delegates to:** `config-initializer` agent

### /fractary-faber:config-update

Update existing FABER configuration based on natural language or explicit changes.

```
/fractary-faber:config-update [description]
```

**Delegates to:** `config-updater` agent

### /fractary-faber:config-validate

Validate FABER configuration and report issues.

```
/fractary-faber:config-validate
```

**Delegates to:** `config-validator` agent

### /fractary-faber:workflow-create

Create a new FABER workflow definition by researching project structure.

```
/fractary-faber:workflow-create [<workflow-name>] [options]
```

| Argument / Option | Description |
|-------------------|-------------|
| `[<workflow-name>]` | Name for the new workflow |
| `--context <description>` | Description of what the workflow should do |
| `--extends <parent>` | Parent workflow to inherit from |
| `--template <type>` | Template type to start from |
| `--asset-type <asset>` | Target asset type |

**Delegates to:** `workflow-engineer` agent

### /fractary-faber:workflow-update

Update an existing FABER workflow definition.

```
/fractary-faber:workflow-update <workflow-name> [options]
```

| Argument / Option | Description |
|-------------------|-------------|
| `<workflow-name>` | Workflow to update (required) |
| `--context <changes>` | Description of desired changes |
| `--add-steps` | Add new steps |
| `--modify-steps` | Modify existing steps |
| `--change-autonomy` | Change autonomy settings |

**Delegates to:** `workflow-engineer` agent

### /fractary-faber:workflow-inspect

Validate FABER workflow configuration with completeness scoring.

```
/fractary-faber:workflow-inspect [<workflow-name-or-path>] [options]
```

| Argument / Option | Description |
|-------------------|-------------|
| `[<workflow-name-or-path>]` | Workflow to inspect |
| `--verbose` | Detailed output |
| `--fix` | Attempt to fix issues |
| `--check <aspect>` | Check specific aspect only |
| `--config-path <path>` | Custom config path |

**Delegates to:** `workflow-inspector` agent

### /fractary-faber:workflow-debug

Diagnose workflow issues and propose solutions using a knowledge base.

```
/fractary-faber:workflow-debug [options]
```

| Option | Description |
|--------|-------------|
| `--work-id <id>` | Work item ID |
| `--run-id <id>` | Run ID to debug |
| `--problem "<text>"` | Problem description |
| `--phase <phase>` | Phase where issue occurred |
| `--auto-fix` | Attempt automatic fix |
| `--learn` | Store solution in knowledge base |
| `--create-spec` | Create spec for the fix |

**Delegates to:** `workflow-debugger` agent

### /fractary-faber:session-load

Reload critical artifacts for the active workflow session.

```
/fractary-faber:session-load [options]
```

| Option | Description |
|--------|-------------|
| `--work-id <id>` | Work item ID |
| `--run-id <id>` | Run ID |
| `--trigger <trigger>` | Load trigger context |
| `--artifacts <list>` | Specific artifacts to load |
| `--force` | Force reload |
| `--dry-run` | Preview what would be loaded |

**Delegates to:** `session-manager` agent

### /fractary-faber:session-save

Save session metadata before a session ends.

```
/fractary-faber:session-save [options]
```

| Option | Description |
|--------|-------------|
| `--run-id <id>` | Run ID |
| `--reason <reason>` | Reason for saving |

**Delegates to:** `session-manager` agent

---

## Agents

Agents are the autonomous workers that execute plugin commands. They are spawned as subprocesses with specific tool access.

### faber-manager

**Purpose:** Core workflow orchestration. Runs the 5-phase FABER workflow (Frame, Architect, Build, Evaluate, Release) with failure handling and retry logic.

**Used by:** `workflow-run` command (directly)
**Tools:** Bash, Skill, Read, Write, Glob, Grep, AskUserQuestion

### faber-planner

**Purpose:** Creates FABER execution plans without executing them. Phase 1 of the two-phase architecture (plan then execute).

**Used by:** `workflow-plan` command
**Tools:** Skill, SlashCommand, Read, Write, Bash, Glob, Grep, AskUserQuestion

### workflow-engineer

**Purpose:** Creates and updates FABER workflow configurations by researching project structure and gathering requirements.

**Used by:** `workflow-create`, `workflow-update` commands
**Tools:** Read, Write, Glob, Bash, Grep, AskUserQuestion

### workflow-inspector

**Purpose:** Validates FABER workflow configuration and reports issues with completeness scoring.

**Used by:** `workflow-inspect` command
**Tools:** Read, Write, Glob, Bash

### workflow-debugger

**Purpose:** Diagnoses FABER workflow issues and proposes solutions using a persistent knowledge base of patterns.

**Used by:** `workflow-debug` command
**Tools:** Read, Write, Glob, Bash, Skill

### run-inspect

**Purpose:** Displays FABER workflow run status combining current state with historical logs.

**Used by:** `run-inspect` command
**Tools:** Read, Glob, Bash, Skill

### session-manager

**Purpose:** Manages critical context artifacts and session metadata during FABER workflow execution. Handles both loading and saving.

**Used by:** `session-load`, `session-save` commands
**Tools:** Read, Write, Glob, Bash, Skill

### config-initializer

**Purpose:** Initializes FABER configuration for new projects. Smart detection of platforms and project settings.

**Used by:** `config-init` command
**Tools:** Bash, Read, Glob, AskUserQuestion

### config-updater

**Purpose:** Applies targeted changes to existing FABER configuration based on natural language descriptions.

**Used by:** `config-update` command
**Tools:** Bash, Read, AskUserQuestion

### config-validator

**Purpose:** Validates FABER configuration (read-only check).

**Used by:** `config-validate` command
**Tools:** Bash, Read

---

## Agent Templates

FABER provides reusable agent templates for creating custom agents. Templates are defined in `templates/agents/`.

### Asset-Level Templates

| Template | FABER Phase | Description |
|----------|-------------|-------------|
| **asset-architect** | Architect | Designs implementation plans for a specific asset |
| **asset-engineer** | Build | Implements solutions by creating, modifying, or generating artifacts |
| **asset-configurator** | Frame | Manages configuration with safety guarantees (preview, backup, rollback) |
| **asset-debugger** | Evaluate | Troubleshoots problems and maintains a knowledge base of solutions |
| **asset-architect-validator** | Evaluate | Validates specifications from architect agents (static analysis). Pairs with `asset-architect` |
| **asset-engineer-validator** | Evaluate | Validates code from engineer agents (static + dynamic analysis). Pairs with `asset-engineer` |
| **asset-inspector** | Any | Reports point-in-time status of a single entity |

### Project-Level Templates

| Template | FABER Phase | Description |
|----------|-------------|-------------|
| **project-auditor** | Evaluate | Aggregates across multiple entities for project-wide dashboards |

Templates can be used as starting points when creating custom workflows with `/fractary-faber:workflow-create --template <type>`.

---

## See Also

- [CLI Reference](./cli.md) - CLI commands (outside Claude Code)
- [Concepts](./concepts.md) - FABER methodology and phases
- [Getting Started](./getting-started.md) - Installation and setup
