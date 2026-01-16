---
name: fractary-faber:agent-create
description: Create a new FABER-compliant agent and command - delegates to fractary-faber:agent-creator agent
allowed-tools: Task(fractary-faber:agent-creator)
model: claude-haiku-4-5
argument-hint: '<agent-name> [--purpose "<purpose>"] [--context "<context>"] [--tools <tools>] [--model <model>] [--plugin <plugin>]'
---

# Agent Create Command

Use **Task** tool with `fractary-faber:agent-creator` agent to create a new FABER-compliant agent with provided arguments.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `<agent-name>` | string | Yes | Agent name (noun-first pattern, e.g., "schema-validator") |

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--purpose` | string | - | What the agent does (1-2 sentences) |
| `--context` | string | - | Supplemental context for agent creation (requirements, constraints, examples) |
| `--tools` | string | Read,Write,Glob,Grep | Comma-separated tools (e.g., "Read,Write,Glob") |
| `--model` | string | sonnet | Model to use: haiku, sonnet, opus |
| `--plugin` | string | faber | Plugin to create agent in |
| `--no-command` | flag | - | Skip creating command file |

## Examples

```bash
# Basic: create agent with name only (will prompt for purpose)
/fractary-faber:agent-create schema-validator

# With purpose
/fractary-faber:agent-create schema-validator --purpose "Validates JSON files against their schemas"

# With supplemental context
/fractary-faber:agent-create api-documenter --purpose "Generates API documentation" --context "Should support OpenAPI 3.0 format, extract from JSDoc comments, and generate markdown output"

# Full specification
/fractary-faber:agent-create changelog-generator --purpose "Creates changelog from git history" --tools "Read,Write,Bash,Glob" --model opus --plugin faber

# Skip command file creation
/fractary-faber:agent-create internal-helper --purpose "Internal utility agent" --no-command
```

## Context Usage

The `--context` argument provides supplemental information to guide agent creation:
- Technical requirements or constraints
- Integration points with other systems
- Specific input/output format requirements
- Example use cases or scenarios
- Domain-specific knowledge the agent needs

```bash
/fractary-faber:agent-create test-generator \
  --purpose "Generates unit tests for source files" \
  --context "Should support Jest and Vitest frameworks. Generate tests that cover edge cases. Follow AAA pattern (Arrange, Act, Assert). Include both positive and negative test cases."
```

## Invocation

```
Task(
  subagent_type="fractary-faber:agent-creator",
  description="Create new FABER agent",
  prompt="Create agent: $ARGUMENTS"
)
```

## Output

On success, creates:
- `plugins/{plugin}/agents/{name}.md` - Agent definition
- `plugins/{plugin}/commands/{name}.md` - Command file (unless --no-command)

Returns paths to created files and instructions for next steps.

## See Also

- `/fractary-faber:agent-audit` - Audit existing agents for best practices
- `plugins/faber/docs/FABER-AGENT-BEST-PRACTICES.md` - Agent standards
- `plugins/faber/docs/RESPONSE-FORMAT.md` - Response format specification
