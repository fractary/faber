---
name: fractary-faber:agent-audit
description: Audit FABER agents for best practices compliance - delegates to fractary-faber:agent-auditor agent
allowed-tools: Task(fractary-faber:agent-auditor)
model: claude-haiku-4-5
argument-hint: '<agent> [--context "<context>"] [--all] [--plugin <plugin>] [--verbose] [--check <aspect>]'
---

# Agent Audit Command

Use **Task** tool with `fractary-faber:agent-auditor` agent to audit FABER agents for best practices compliance.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `<agent>` | string | No* | Agent to audit: name, path, or pattern |

*Either `<agent>` or `--all` flag is required. If neither is provided, shows usage and lists available agents.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--context` | string | - | Supplemental context for the audit (specific concerns, standards to check) |
| `--all` | flag | - | Audit all agents |
| `--plugin` | string | all | Scope to specific plugin |
| `--verbose` | flag | false | Show detailed check results |
| `--check` | string | all | Specific check: frontmatter, sections, response, naming, documentation, all |
| `--format` | string | text | Output format: text, json, markdown |

## Examples

```bash
# Show usage and list available agents
/fractary-faber:agent-audit

# Audit single agent by name
/fractary-faber:agent-audit faber-planner

# Audit agent by path
/fractary-faber:agent-audit plugins/faber/agents/workflow-auditor.md

# Audit with supplemental context about specific concerns
/fractary-faber:agent-audit faber-planner --context "Focus on response format compliance and error handling patterns"

# Audit all agents in faber plugin
/fractary-faber:agent-audit --all --plugin faber

# Audit with verbose output
/fractary-faber:agent-audit faber-planner --verbose

# Check only response format compliance
/fractary-faber:agent-audit faber-planner --check response

# JSON output for CI integration
/fractary-faber:agent-audit --all --format json

# Audit with custom standards context
/fractary-faber:agent-audit my-agent --context "This agent must also comply with our internal security guidelines requiring input validation"
```

## Context Usage

The `--context` argument provides supplemental guidance for the audit:
- Specific compliance concerns to focus on
- Additional standards beyond FABER defaults
- Domain-specific requirements to validate
- Known issues to investigate

## Audit Checks

The audit validates:

1. **Frontmatter** - name, description, model, tools, color fields
2. **Sections** - CONTEXT, CRITICAL_RULES, INPUTS, WORKFLOW, OUTPUTS
3. **Response Format** - FABER response compliance (status, message, details)
4. **Naming** - Noun-first pattern, lowercase with hyphens
5. **Documentation** - Examples, error handling, notes/references

## Invocation

```
Task(
  subagent_type="fractary-faber:agent-auditor",
  description="Audit FABER agent for best practices",
  prompt="Audit agent: $ARGUMENTS"
)
```

## Output

Returns audit report with:
- Compliance score (0-100%)
- Errors (must fix)
- Warnings (should fix)
- Info (suggestions)
- Per-agent breakdown

## Exit Codes (for CI)

| Code | Meaning |
|------|---------|
| 0 | All agents pass (score >= 70%) |
| 1 | Warnings present |
| 2 | Errors present |

## See Also

- `/fractary-faber:agent-create` - Create new FABER-compliant agents
- `/fractary-faber:workflow-audit` - Audit workflow configuration
- `plugins/faber/docs/FABER-AGENT-BEST-PRACTICES.md` - Agent standards
