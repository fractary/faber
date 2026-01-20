---
name: fractary-faber:agent-create
description: Create a new FABER-compliant agent and command - delegates to fractary-faber:agent-engineer agent
allowed-tools: Task(fractary-faber:agent-engineer)
model: claude-haiku-4-5
argument-hint: '<agent-name> [--type <type>] [--context "<context>"] [--tools <tools>] [--model <model>] [--plugin <plugin>]'
---

# Agent Create Command

Use **Task** tool with `fractary-faber:agent-engineer` agent in **create mode** to create a new FABER-compliant agent.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `<agent-name>` | string | Yes | Agent name (noun-first pattern, e.g., "schema-validator") |

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--type` | string | - | Agent type from templates/agents (e.g., `asset-architect`, `asset-engineer`). If not provided, auto-selects based on context |
| `--context` | string | - | What the agent does and any additional requirements or constraints |
| `--tools` | string | Read,Write,Glob,Grep | Comma-separated tools (e.g., "Read,Write,Glob") |
| `--model` | string | sonnet | Model to use: haiku, sonnet, opus |
| `--plugin` | string | faber | Plugin to create agent in |
| `--no-command` | flag | - | Skip creating command file |

## Examples

```bash
# Basic: create agent with name only (will prompt for context)
/fractary-faber:agent-create schema-validator

# With explicit type
/fractary-faber:agent-create schema-validator --type asset-engineer-validator --context "Validates JSON files against their schemas"

# Auto-selects type based on context keywords
/fractary-faber:agent-create api-planner --context "Designs API endpoints and data models"
# → selector will recommend asset-architect based on "design" keyword

# Create a configurator agent
/fractary-faber:agent-create project-setup --type asset-configurator --context "Interactive setup wizard for new projects"

# With detailed context
/fractary-faber:agent-create api-documenter --context "Generates API documentation. Should support OpenAPI 3.0 format, extract from JSDoc comments, and generate markdown output."

# Full specification with explicit type
/fractary-faber:agent-create changelog-generator --type asset-engineer --context "Creates changelog from git history" --tools "Read,Write,Bash,Glob" --model opus --plugin faber

# Skip command file creation
/fractary-faber:agent-create internal-helper --context "Internal utility agent" --no-command
```

## Agent Types

Available agent types from `templates/agents/`:

| Type | Scope | Purpose | FABER Phase |
|------|-------|---------|-------------|
| `asset-architect` | asset | Design implementation plans | architect |
| `asset-engineer` | asset | Implement features, build | build |
| `asset-configurator` | asset | Interactive setup | any |
| `asset-debugger` | asset | Diagnose/fix problems | evaluate |
| `asset-architect-validator` | asset | Validate architect output | evaluate |
| `asset-engineer-validator` | asset | Validate engineer output | evaluate |
| `asset-inspector` | asset | Report single entity status | evaluate |
| `project-auditor` | project | Aggregate cross-project status | evaluate |

If `--type` is not provided, the selector auto-recommends based on context keywords.

## Context Usage

The `--context` argument provides information to guide agent creation:
- What the agent does (1-2 sentences describing its purpose)
- Technical requirements or constraints
- Integration points with other systems
- Specific input/output format requirements
- Example use cases or scenarios
- Domain-specific knowledge the agent needs

## Invocation

```
Task(
  subagent_type="fractary-faber:agent-engineer",
  description="Create new FABER agent",
  prompt="Create agent: $ARGUMENTS --mode create"
)
```

## Output

On success, creates:
- `plugins/{plugin}/agents/{name}.md` - Agent definition
- `plugins/{plugin}/commands/{name}.md` - Command file (unless --no-command)

Returns paths to created files and instructions for next steps.

## See Also

- `/fractary-faber:agent-update` - Update existing agents
- `/fractary-faber:agent-inspect` - Inspect agents for best practices
- `plugins/faber/docs/FABER-AGENT-BEST-PRACTICES.md` - Agent standards
- `plugins/faber/docs/RESPONSE-FORMAT.md` - Response format specification
