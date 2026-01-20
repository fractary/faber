---
name: fractary-faber:agent-update
description: Update an existing FABER agent - delegates to fractary-faber:agent-engineer agent
allowed-tools: Task(fractary-faber:agent-engineer)
model: claude-haiku-4-5
argument-hint: '<agent-name> [--context "<changes>"] [--tools <tools>] [--model <model>] [--plugin <plugin>]'
---

# Agent Update Command

Use **Task** tool with `fractary-faber:agent-engineer` agent in **update mode** to modify an existing FABER agent.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `<agent-name>` | string | Yes | Name of the agent to update |

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--context` | string | - | Description of changes to make (what to add, modify, or fix) |
| `--tools` | string | - | Update tools (comma-separated, e.g., "Read,Write,Glob,Bash") |
| `--model` | string | - | Update model: haiku, sonnet, opus |
| `--plugin` | string | faber | Plugin where agent is located |
| `--no-command` | flag | - | Skip updating command file |

## Examples

```bash
# Update agent with new capabilities
/fractary-faber:agent-update faber-planner --context "Add support for parallel step execution"

# Update model and tools
/fractary-faber:agent-update workflow-inspector --model opus --tools "Read,Write,Glob,Grep,Bash"

# Update description and purpose
/fractary-faber:agent-update spec-generator --context "Update description to: Generates comprehensive technical specifications with architecture diagrams"

# Detailed changes via context
/fractary-faber:agent-update schema-validator --context "Improve error messages to include line numbers. Add support for JSON Schema draft-07. Update OUTPUTS section with new error format examples."

# Fix specific issues
/fractary-faber:agent-update api-documenter --context "Fix Step 3 in WORKFLOW to handle async functions correctly. Add error handling for missing JSDoc comments."
```

## Context Usage

The `--context` argument describes what changes to make:
- New capabilities or features to add
- Sections to modify or enhance
- Issues or bugs to fix
- Workflow improvements
- Documentation updates

**Examples of effective context:**

```bash
# Adding a feature
--context "Add input validation for the work_id parameter. Should check format matches 'WORK-XXXXX' pattern."

# Fixing an issue
--context "Fix error handling in Step 2 - currently fails silently when file not found. Should return failure status with helpful message."

# Enhancing documentation
--context "Add more examples to EXAMPLES section showing error cases and edge conditions."

# Updating workflow
--context "Refactor Step 4 to use parallel file processing for better performance with large codebases."
```

## Agent Type Awareness

When updating an agent that has `agent_type` in its frontmatter, the updater:
- Loads the corresponding type's standards from `templates/agents/{type}/standards.md`
- Uses type-specific validation rules when applying changes
- Ensures updates maintain compliance with type requirements

For example, if updating an agent with `agent_type: asset-engineer-validator`, the updater will:
- Verify the agent maintains read-only behavior (no Write tool unless justified)
- Ensure OUTPUTS section includes pass/fail status
- Validate that scoring criteria are preserved

## Safety

- Preserves existing content not explicitly changed
- Preserves `agent_type` from frontmatter (ensures type compliance)
- Use git to track changes and revert if needed

## Invocation

```
Task(
  subagent_type="fractary-faber:agent-engineer",
  description="Update existing FABER agent",
  prompt="Update agent: $ARGUMENTS --mode update"
)
```

## Output

On success, returns:
- Path to updated agent file
- List of changes made

```json
{
  "status": "success",
  "message": "Agent 'faber-planner' updated successfully",
  "details": {
    "agent_path": "plugins/faber/agents/faber-planner.md",
    "agent_type": "asset-architect",
    "changes_made": ["Updated WORKFLOW section", "Added new CRITICAL_RULE"]
  }
}
```

## See Also

- `/fractary-faber:agent-create` - Create new agents
- `/fractary-faber:agent-inspect` - Inspect agents for best practices
- `plugins/faber/docs/FABER-AGENT-BEST-PRACTICES.md` - Agent standards
