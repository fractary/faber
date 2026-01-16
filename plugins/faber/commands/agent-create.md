---
name: fractary-faber:agent-create
description: Create a new FABER-compliant agent and command - delegates to fractary-faber:agent-creator agent
allowed-tools: Task(fractary-faber:agent-creator)
model: claude-haiku-4-5
argument-hint: '<context> | --name <name> --purpose "<purpose>" [--tools <tools>] [--model <model>] [--plugin <plugin>]'
---

# Agent Create Command

Use **Task** tool with `fractary-faber:agent-creator` agent to create a new FABER-compliant agent with provided context.

## Arguments

The context can be provided in two ways:

### 1. Natural Language (Positional)

Describe what the agent should do:
```
/fractary-faber:agent-create Create an agent that validates JSON schemas
```

### 2. Structured Options

Use flags for explicit control:

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `--name` | string | No | Agent name (noun-first pattern, e.g., "schema-validator") |
| `--purpose` | string | No | What the agent does (1-2 sentences) |
| `--tools` | string | No | Comma-separated tools (e.g., "Read,Write,Glob") |
| `--model` | string | No | Model to use (haiku/sonnet/opus, default: sonnet) |
| `--plugin` | string | No | Plugin to create agent in (default: faber) |
| `--no-command` | flag | No | Skip creating command file |

**Examples:**
```bash
# Natural language
/fractary-faber:agent-create Create an agent that generates API documentation from code

# Structured
/fractary-faber:agent-create --name api-documenter --purpose "Generates API documentation from source code" --tools "Read,Write,Glob,Grep" --model opus

# Minimal
/fractary-faber:agent-create --name changelog-generator --purpose "Creates changelog from git history"
```

### 3. JSON Context

For full control, provide JSON:
```bash
/fractary-faber:agent-create {"name": "spec-generator", "purpose": "Generates specs from work items", "tools": ["Read", "Write", "Glob"], "inputs": [{"name": "work_id", "type": "string", "required": true}]}
```

## Invocation

```
Task(
  subagent_type="fractary-faber:agent-creator",
  description="Create new FABER agent",
  prompt="Create agent with context: $ARGUMENTS"
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
