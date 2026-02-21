# SPEC: Workflow-Audit Command and Agent Improvements

**Date**: 2026-01-15
**Status**: Approved
**Priority**: High
**Category**: Tooling, Quality Assurance

## Executive Summary

Improve the workflow-audit command and workflow-audit agent to better validate FABER workflow configurations. Key improvements:
1. Rename agent to follow noun convention (workflow-audit → workflow-auditor)
2. Accept workflow name/path as primary argument for targeted audits
3. Validate that agents/skills referenced in workflow steps return proper FABER Response Format
4. Show usage and list available workflows when called with no arguments

## Background

### Current State

The existing workflow-audit system validates workflow configuration structure but has several limitations:

1. **Agent naming**: Uses verb form "workflow-audit" instead of noun form "workflow-auditor"
2. **No primary argument**: Only accepts optional flags, defaults to validating entire config file
3. **Limited validation**: Validates configuration structure but doesn't check if referenced agents/skills return proper FABER Response Format
4. **Poor discoverability**: No easy way to see available workflows or audit a specific workflow

### Problems

1. **Inconsistent naming**: Agent naming doesn't follow the noun convention established in faber-cloud refactors
2. **Workflow targeting**: Users can't easily audit a specific workflow without editing the config file
3. **Response format compliance**: No validation that agents/skills in workflow steps actually return standard FABER Response Format (status, message, details, errors, warnings)
4. **User experience**: When called with no arguments, immediately starts validating instead of showing usage

### User Story

> "As a workflow author, I want to audit a specific workflow by name and verify that all agents/skills it references will return proper FABER Response Format, so I can catch integration issues before running the workflow."

## Requirements

### Functional Requirements

#### FR-1: Agent Naming Convention
- Agent must be renamed from `workflow-audit` to `workflow-auditor` (noun form)
- Command name stays `workflow-audit` (user-facing command)
- Clean break - no backward compatibility aliases

#### FR-2: Primary Argument Support
The command must accept a workflow identifier as the first positional argument:

```bash
/fractary-faber:workflow-audit [<workflow-identifier>] [--verbose] [--fix] [--check <aspect>]
```

Where `<workflow-identifier>` can be:
- **Workflow ID**: `default` - validates workflow from project config
- **Workflow file**: `./workflows/custom.json` - validates standalone file
- **Namespaced**: `fractary-faber:feature` - validates plugin workflow
- **Omitted**: Shows usage and lists available workflows

#### FR-3: Audit Mode Resolution
Based on the workflow identifier, determine audit mode:

| Input | Mode | Behavior |
|-------|------|----------|
| None | `no_target` | Show usage, list workflows, exit |
| `*.json` | `workflow_file` | Validate standalone JSON file |
| `ns:id` | `namespaced_workflow` | Validate plugin workflow |
| `id` | `workflow_id` | Validate workflow from project config |

#### FR-4: Agent/Skill Reference Validation
For each workflow step, validate that referenced agents/skills:
1. **Exist**: Can be found in plugin or user directories
2. **Document responses**: Have output documentation indicating response format
3. **Follow FABER format**: Response structure aligns with FABER Response Format spec

Classification:
- **COMPLIANT**: Explicitly documents FABER Response Format or shows all required fields (status, message, details, errors, warnings)
- **UNKNOWN**: Has some output documentation but format compliance unclear
- **NOT_FOUND**: Agent/skill doesn't exist in registry

#### FR-5: Enhanced Reporting
Report must include:
1. Existing validation results (config structure, phases, hooks, etc.)
2. New section: Agent/Skill Validation
   - Count of COMPLIANT, UNKNOWN, NOT_FOUND references
   - List of each reference with classification
   - Actionable suggestions for non-compliant references

### Non-Functional Requirements

#### NFR-1: Performance
- Agent discovery should complete in < 5 seconds for typical plugin installations
- Workflow validation should complete in < 10 seconds for typical workflows

#### NFR-2: Maintainability
- Use heuristic approach (not schema validation) for response format checking
- No manual registry maintenance required
- Leverage existing faber-config patterns for namespace resolution

#### NFR-3: Compatibility
- Existing workflows using the command will see new default behavior (show usage)
- Workflows calling the agent directly must update references (breaking change)
- Exit codes remain unchanged (0=success, 1=warnings, 2=errors, 3=not found, 4=invalid JSON)

## Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ User invokes: /fractary-faber:workflow-audit <workflow-id>  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Command: workflow-audit.md                                   │
│ - Thin delegator                                             │
│ - Calls Task(fractary-faber:workflow-auditor)                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Agent: workflow-auditor.md                                   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Step 0: Parse Arguments & Determine Mode                │ │
│ │ - Extract workflow_target, flags                        │ │
│ │ - Resolve to: no_target, workflow_file, namespaced,    │ │
│ │   workflow_id, or config mode                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Step 1: Load Target Configuration/Workflow (Enhanced)   │ │
│ │ - no_target: Show usage, list workflows                 │ │
│ │ - workflow_file: Parse standalone JSON                  │ │
│ │ - namespaced: Resolve via faber-config patterns         │ │
│ │ - workflow_id: Load from project config                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Steps 2-6: Existing Validation Logic                    │ │
│ │ - Parse config, validate structure                       │ │
│ │ - Check phases, hooks, integrations, safety             │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Step 6.5: Validate Agent/Skill References (NEW)         │ │
│ │ A. Build registry (discover agents/skills)              │ │
│ │ B. Extract references from workflow steps               │ │
│ │ C. Validate each reference (exists + format)            │ │
│ │ D. Classify: COMPLIANT, UNKNOWN, NOT_FOUND              │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Step 10: Generate Report (Enhanced)                     │ │
│ │ - Existing report sections                              │ │
│ │ - NEW: Agent/Skill Validation section                   │ │
│ │ - Suggestions for non-compliant references              │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Agent/Skill Discovery Algorithm

```
function buildAgentSkillRegistry():
  registry = {}

  // Discover plugin agents
  plugin_root = getenv("CLAUDE_PLUGIN_ROOT") or "~/.claude/plugins/marketplaces/fractary/"

  for agent_file in glob("{plugin_root}/plugins/*/agents/*.md"):
    content = read(agent_file)
    agent_name = extract_yaml_field(content, "name")
    plugin_name = extract_plugin_from_path(agent_file)

    registry[agent_name] = {
      path: agent_file,
      type: "agent",
      plugin: plugin_name
    }

  // Discover plugin skills
  for skill_file in glob("{plugin_root}/plugins/*/skills/*/SKILL.md"):
    content = read(skill_file)
    skill_name = extract_yaml_field(content, "name")
    plugin_name = extract_plugin_from_path(skill_file)

    registry[skill_name] = {
      path: skill_file,
      type: "skill",
      plugin: plugin_name
    }

  // Discover user agents
  for agent_file in glob("~/.claude/agents/*.md", ".claude/agents/*.md"):
    content = read(agent_file)
    agent_name = extract_yaml_field(content, "name")

    registry[agent_name] = {
      path: agent_file,
      type: "agent",
      plugin: "user"
    }

  return registry
```

### Reference Extraction Algorithm

```
function extractReferences(workflow):
  references = set()

  for phase_name in ["frame", "architect", "build", "evaluate", "release"]:
    if workflow.phases[phase_name] is null:
      continue

    phase = workflow.phases[phase_name]
    all_steps = phase.pre_steps + phase.steps + phase.post_steps

    for step in all_steps:
      if step.prompt is null:
        continue

      prompt = step.prompt

      // Extract skill references
      skill_matches = regex_findall(r'Skill\(skill="([^"]+)"\)', prompt)
      references.update(skill_matches)

      slash_matches = regex_findall(r'/([a-z0-9-]+:[a-z0-9-]+)', prompt)
      references.update(slash_matches)

      // Extract agent references
      agent_matches = regex_findall(r'Task\(subagent_type="([^"]+)"\)', prompt)
      references.update(agent_matches)

  return references
```

### Response Format Validation Algorithm

```
function validateResponseFormat(agent_path):
  content = read(agent_path)

  // Check for explicit FABER Response Format indicators
  explicit_indicators = [
    "FABER Response Format",
    "FABER response format",
    "skill-response.schema.json",
    "RESPONSE-FORMAT.md",
    "standard FABER response"
  ]

  for indicator in explicit_indicators:
    if indicator in content:
      return "COMPLIANT"

  // Check for implicit indicators (structured output with required fields)
  has_outputs = "<OUTPUTS>" in content or "## Output" in content or "## Returns" in content

  if has_outputs:
    // Look for required fields in output documentation
    has_status = '"status":' in content or "'status':" in content or "status field" in content
    has_message = '"message":' in content or "'message':" in content or "message field" in content

    // Check for optional but indicative fields
    has_details = '"details":' in content or "details object" in content
    has_errors = '"errors":' in content or "errors array" in content
    has_warnings = '"warnings":' in content or "warnings array" in content

    // If has all required fields and at least one optional field, consider compliant
    if has_status and has_message and (has_details or has_errors or has_warnings):
      return "COMPLIANT"

  return "UNKNOWN"
```

### Namespace Resolution

Using faber-config patterns:
- `fractary-faber:` → `${PLUGIN_ROOT}/plugins/faber/config/workflows/`
- `fractary-faber-cloud:` → `${PLUGIN_ROOT}/plugins/faber-cloud/config/workflows/`
- `project:` or no prefix → `.fractary/faber/workflows/` or `.fractary/faber/config.json`

## Implementation Plan

### Phase 1: Agent Rename (Breaking Change)

**Files to modify:**
1. `/mnt/c/GitHub/fractary/faber/plugins/faber/agents/workflow-audit.md`
   - Rename to: `workflow-auditor.md`
   - Update frontmatter: `name: fractary-faber:workflow-auditor`

2. `/mnt/c/GitHub/fractary/faber/plugins/faber/commands/workflow-audit.md`
   - Update Task call to reference `fractary-faber:workflow-auditor`
   - Update `argument-hint: '[<workflow-name-or-path>] [--verbose] [--fix] [--check <aspect>]'`

### Phase 2: Primary Argument Support

**In workflow-auditor.md:**

Add **Step 0: Parse Arguments and Determine Audit Mode**
- Extract workflow_target (first positional arg)
- Extract flags: --verbose, --fix, --check, --config-path
- Determine mode based on workflow_target format
- Display audit header

Modify **Step 1: Load Target Configuration/Workflow**
- Handle `no_target` mode: Show usage and list workflows
- Handle `workflow_file` mode: Parse standalone JSON
- Handle `namespaced_workflow` mode: Resolve and load plugin workflow
- Handle `workflow_id` mode: Load from project config
- Handle `config` mode: Validate entire config (legacy)

### Phase 3: Agent/Skill Reference Validation

**In workflow-auditor.md:**

Add **Step 6.5: Validate Referenced Agents and Skills**
- **Step A**: Build agent/skill registry via discovery
- **Step B**: Extract references from workflow steps (regex patterns)
- **Step C**: Validate each reference (existence + format compliance)
- **Step D**: Classify as COMPLIANT, UNKNOWN, or NOT_FOUND

Modify **Step 10: Generate Report**
- Add new section: Agent/Skill Validation
- Show counts and details for each classification
- Provide actionable suggestions

## Testing Strategy

### Unit Tests

Test individual components:
1. **Argument parsing**: Verify mode resolution for different inputs
2. **Registry building**: Mock file system, verify discovery
3. **Reference extraction**: Test regex patterns against sample prompts
4. **Format validation**: Test heuristic against sample agent files

### Integration Tests

Test end-to-end workflows:

| Test Case | Command | Expected Behavior |
|-----------|---------|-------------------|
| No argument | `/fractary-faber:workflow-audit` | Shows usage, lists workflows |
| Workflow ID | `/fractary-faber:workflow-audit default` | Validates default workflow |
| Workflow file | `/fractary-faber:workflow-audit ./custom.json` | Validates standalone file |
| Namespaced | `/fractary-faber:workflow-audit fractary-faber:feature` | Validates plugin workflow |
| Not found | `/fractary-faber:workflow-audit nonexistent` | Error + list available |
| Compliant agent | Workflow references `fractary-spec:spec-create` | Shows as COMPLIANT |
| Unknown agent | Workflow references undocumented agent | Shows as UNKNOWN |
| Missing agent | Workflow references typo'd agent | Shows as NOT_FOUND |
| Combined flags | `/fractary-faber:workflow-audit default --verbose` | Detailed output |

### Acceptance Criteria

- [ ] Agent renamed to workflow-auditor (noun form)
- [ ] Command accepts workflow name/path as primary argument
- [ ] No argument shows usage and lists available workflows
- [ ] Workflow ID mode loads and validates specific workflow from config
- [ ] Workflow file mode validates standalone JSON files
- [ ] Namespaced mode resolves plugin workflows correctly
- [ ] Agent/skill registry discovers all agents/skills in plugins and user directories
- [ ] Reference extraction finds all Skill() and Task() calls in workflow steps
- [ ] Format validation correctly classifies agents as COMPLIANT, UNKNOWN, or NOT_FOUND
- [ ] Report includes agent/skill validation section with counts and suggestions
- [ ] Exit codes unchanged (0, 1, 2, 3, 4)
- [ ] All existing validation logic still works

## Rollout Plan

### Phase 1: Development
1. Rename agent file and update command reference
2. Implement Step 0 (argument parsing)
3. Enhance Step 1 (target loading)

### Phase 2: Enhanced Validation
1. Implement Step 6.5 (agent/skill validation)
2. Enhance Step 10 (report generation)
3. Test discovery and classification logic

### Phase 3: Testing
1. Run integration tests
2. Test with real workflows from fractary-faber, fractary-faber-cloud
3. Verify error messages and suggestions

### Phase 4: Documentation
1. Update workflow-audit command documentation
2. Add examples to faber documentation
3. Document breaking change (agent rename)

### Phase 5: Deployment
1. Merge changes to main branch
2. Update any workflows directly referencing workflow-audit agent
3. Announce breaking change in release notes

## Breaking Changes

### Agent Rename
- **What changed**: Agent renamed from `workflow-audit` to `workflow-auditor`
- **Impact**: Code directly referencing `fractary-faber:workflow-audit` agent must update
- **Migration**: Replace `Task(subagent_type="fractary-faber:workflow-audit")` with `Task(subagent_type="fractary-faber:workflow-auditor")`
- **Note**: Command name unchanged - `/fractary-faber:workflow-audit` still works

### Default Behavior Change
- **What changed**: Calling with no arguments now shows usage instead of validating entire config
- **Impact**: Scripts expecting automatic full validation must be updated
- **Migration**: Use `--config-path .fractary/faber/config.json` to explicitly validate full config

## Success Metrics

- **Adoption**: 100% of faber workflows use workflow-audit for pre-commit validation
- **Compliance**: 90%+ of agents/skills show as COMPLIANT for FABER Response Format
- **Quality**: Reduce workflow execution failures due to malformed agent responses by 50%
- **Usability**: Reduce time to audit a specific workflow from ~30s to ~5s

## Future Enhancements

### P1 (Next Release)
- Add `--json` flag for machine-readable output (CI/CD integration)
- Add `--suggest-fixes` to auto-generate response format templates for non-compliant agents

### P2 (Future)
- Schema validation mode for strict format checking
- Auto-fix mode for adding response format documentation to agents
- Integration with faber workflow runner to validate before execution

### P3 (Nice to Have)
- Visual workflow graph showing agent/skill relationships
- Diff mode to compare workflow versions
- Performance profiling to identify slow agents/skills

## References

- [RESPONSE-FORMAT.md](../plugins/faber/docs/RESPONSE-FORMAT.md) - FABER Response Format specification
- [RESULT-HANDLING.md](../plugins/faber/docs/RESULT-HANDLING.md) - Result handling behavior
- [faber-config skill](../plugins/faber/skills/faber-config/SKILL.md) - Namespace resolution patterns
- [response-validator skill](../plugins/faber/skills/response-validator/SKILL.md) - Runtime response validation

## Appendix A: Sample Output

### No Argument (Usage)
```
🔍 FABER Workflow Audit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage: /fractary-faber:workflow-audit [<workflow>] [OPTIONS]

Workflow identifier:
  workflow-id          Validate workflow from project config
  path/to/file.json    Validate standalone workflow file
  plugin:workflow-id   Validate namespaced workflow

Options:
  --verbose            Show detailed validation output
  --fix                Auto-fix simple issues
  --check <aspect>     Check specific aspect: phases, hooks, integrations, all
  --config-path <path> Override default config path

Available workflows in .fractary/faber/config.json:
  • default - Default FABER workflow with all phases
  • minimal - Minimal workflow for quick iterations
  • cloud-deploy - Cloud infrastructure deployment workflow
```

### Workflow ID Audit
```
🔍 FABER Workflow Audit
Target: Workflow 'default' from config
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[... existing validation output ...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Agent/Skill Validation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total references: 8

✅ COMPLIANT (6)
  ✓ fractary-spec:spec-create - Documents FABER Response Format
  ✓ fractary-work:issue-fetch - Documents FABER Response Format
  ✓ fractary-repo:branch-create - Documents FABER Response Format
  ✓ fractary-faber:faber-planner - Documents FABER Response Format
  ✓ fractary-faber:faber-executor - Documents FABER Response Format
  ✓ fractary-repo:pr-create - Documents FABER Response Format

⚠️  UNKNOWN (1)
  ? custom-agent:analyzer - Response format not documented or unclear

❌ NOT FOUND (1)
  ✗ fractary-tets:runner - Agent/skill not found

💡 SUGGESTIONS
  → Check for typo in 'fractary-tets:runner' (did you mean 'fractary-test:runner'?)
  → Add response format documentation to custom-agent:analyzer
  → Reference: plugins/faber/docs/RESPONSE-FORMAT.md
  → Add to agent's OUTPUTS section: "Returns standard FABER Response Format"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Completeness Score: 85%
Status: Configuration is mostly complete (1 error, 1 warning)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Appendix B: Response Format Validation Examples

### Example 1: Compliant Agent (Explicit)
```markdown
---
name: fractary-spec:spec-create
---

## Behavior
Creates a specification document based on work item analysis.

## Returns
Returns standard **FABER Response Format** with:
- `status`: "success" when spec generated
- `message`: Brief summary of spec creation
- `details.spec_path`: Path to created spec file
```

**Classification**: COMPLIANT (explicit mention)

### Example 2: Compliant Agent (Implicit)
```markdown
---
name: fractary-test:runner
---

## Output
Returns JSON object:
```json
{
  "status": "success" | "warning" | "failure",
  "message": "Human-readable summary",
  "details": {
    "tests_passed": 42,
    "tests_failed": 3
  },
  "errors": ["test1 failed", "test2 failed"],
  "warnings": ["deprecated API usage"]
}
```
```

**Classification**: COMPLIANT (shows all required fields)

### Example 3: Unknown Agent
```markdown
---
name: custom-agent:analyzer
---

## Returns
Analysis results as text summary.
```

**Classification**: UNKNOWN (no structured format documented)

## Appendix C: Regex Patterns

### Extract Skill References
```regex
Skill\(skill="([^"]+)"\)
```
Matches: `Skill(skill="fractary-spec:spec-create")`

```regex
/([a-z0-9-]+:[a-z0-9-]+)
```
Matches: `/fractary-spec:spec-create`

### Extract Agent References
```regex
Task\(subagent_type="([^"]+)"\)
```
Matches: `Task(subagent_type="fractary-faber:workflow-auditor")`

---

**Approved by**: User
**Implementation date**: 2026-01-15
**Target completion**: 2026-01-15
