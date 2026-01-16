---
name: fractary-faber:agent-inspect
description: Inspect FABER agents for best practices compliance - delegates to fractary-faber:agent-inspector agent
allowed-tools: Task(fractary-faber:agent-inspector)
model: claude-haiku-4-5
argument-hint: '<agent> [--context "<context>"] [--plugin <plugin>] [--format <format>]'
---

# Agent Inspect Command

Use **Task** tool with `fractary-faber:agent-inspector` agent to inspect FABER agents for best practices compliance.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `<agent>` | string | Yes | Agent to inspect: name, path, or pattern |

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--context` | string | - | Supplemental context for the inspection (specific concerns, standards to check) |
| `--plugin` | string | all | Scope to specific plugin (searches plugins/{plugin}/agents/) |
| `--format` | string | text | Output format: text, json, markdown |

## Examples

```bash
# Inspect single agent by name
/fractary-faber:agent-inspect faber-planner

# Inspect agent by path
/fractary-faber:agent-inspect plugins/faber/agents/workflow-engineer.md

# Inspect with supplemental context about specific concerns
/fractary-faber:agent-inspect faber-planner --context "Focus on response format compliance and error handling patterns"

# Inspect agent in specific plugin
/fractary-faber:agent-inspect faber-planner --plugin faber

# JSON output for CI integration
/fractary-faber:agent-inspect faber-planner --format json

# Inspect with custom standards context
/fractary-faber:agent-inspect my-agent --context "This agent must also comply with our internal security guidelines requiring input validation"
```

## Context Usage

The `--context` argument provides supplemental guidance for the inspection:
- Specific compliance concerns to focus on
- Additional standards beyond FABER defaults
- Domain-specific requirements to validate
- Known issues to investigate

## Inspection Checks

The inspection validates:

1. **Frontmatter** - name, description, model, tools, color fields
2. **Sections** - CONTEXT, CRITICAL_RULES, INPUTS, WORKFLOW, OUTPUTS
3. **Response Format** - FABER response compliance (status, message, details)
4. **Naming** - Noun-first pattern, lowercase with hyphens
5. **Documentation** - Examples, error handling, notes/references

## Invocation

```
Task(
  subagent_type="fractary-faber:agent-inspector",
  description="Inspect FABER agent for best practices",
  prompt="Inspect agent: $ARGUMENTS"
)
```

## Output

Returns inspection report with:
- Compliance score (0-100%)
- Errors (must fix)
- Warnings (should fix)
- Info (suggestions)
- Passed checks

## Exit Codes (for CI)

| Code | Meaning |
|------|---------|
| 0 | Agent passes (score >= 70%) |
| 1 | Warnings present |
| 2 | Errors present |

## See Also

- `/fractary-faber:agent-create` - Create new FABER-compliant agents
- `/fractary-faber:workflow-audit` - Audit workflow configuration (project-wide)
- `plugins/faber/docs/FABER-AGENT-BEST-PRACTICES.md` - Agent standards
