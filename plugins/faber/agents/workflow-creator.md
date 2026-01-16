---
name: workflow-creator
description: Creates or updates FABER workflow configurations by researching project structure and gathering requirements
model: claude-sonnet-4-5
tools: Read, Write, Glob, Bash, Grep, AskUserQuestion
---

# Workflow Creator Agent

## Purpose

Creates high-quality, project-specific FABER workflow configurations by:
- Researching the project's existing commands, agents, and skills
- Understanding the project structure and conventions
- Gathering requirements through user interaction
- Generating workflows that extend the core workflow and follow best practices

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflow-name` | string | No | Name for the workflow (will prompt if not provided) |
| `context` | string | No | Description of workflow purpose and requirements |
| `extends` | string | No | Parent workflow to extend (default: `fractary-faber:core`) |
| `type` | string | No | Workflow type hint: `feature`, `bug`, `data`, `infra`, `custom` |

## Algorithm

### Step 0: Parse Arguments

**Goal**: Extract parameters from input arguments

**Logic**:
```
args_string = "$ARGUMENTS"
workflow_name = extract_first_positional_argument(args_string)
context = get_flag_value(args_string, "--context")
extends = get_flag_value(args_string, "--extends") or "fractary-faber:core"
workflow_type = get_flag_value(args_string, "--type")

PRINT "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
PRINT "FABER Workflow Creator"
PRINT "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
PRINT ""
```

### Step 1: Research Project Structure

**Goal**: Discover existing commands, agents, and skills in the project

**Logic**:
```
# Initialize discovery results
discovered = {
  commands: [],
  agents: [],
  skills: [],
  workflows: [],
  project_type: null
}

# 1. Discover project-specific commands
project_command_patterns = [
  ".claude/commands/*.md",
  ".fractary/commands/*.md"
]

for pattern in project_command_patterns:
  files = glob(pattern)
  for file in files:
    content = read(file)
    name = extract_yaml_field(content, "name")
    description = extract_yaml_field(content, "description")
    discovered.commands.append({
      name: name,
      description: description,
      path: file,
      source: "project"
    })

# 2. Discover project-specific agents
project_agent_patterns = [
  ".claude/agents/*.md",
  ".fractary/agents/*.md"
]

for pattern in project_agent_patterns:
  files = glob(pattern)
  for file in files:
    content = read(file)
    name = extract_yaml_field(content, "name")
    description = extract_yaml_field(content, "description")
    discovered.agents.append({
      name: name,
      description: description,
      path: file,
      source: "project"
    })

# 3. Discover project-specific skills
project_skill_patterns = [
  ".claude/skills/*/SKILL.md",
  ".fractary/skills/*/SKILL.md"
]

for pattern in project_skill_patterns:
  files = glob(pattern)
  for file in files:
    content = read(file)
    name = extract_yaml_field(content, "name")
    description = extract_yaml_field(content, "description")
    discovered.skills.append({
      name: name,
      description: description,
      path: file,
      source: "project"
    })

# 4. Discover installed plugin commands/agents/skills
plugin_patterns = [
  "~/.claude/plugins/*/commands/*.md",
  "~/.claude/plugins/marketplaces/*/plugins/*/commands/*.md"
]

# Note: Only discover commonly used plugins, don't overwhelm the discovery
# Focus on fractary-* plugins that integrate with FABER

# 5. Discover existing workflows in project
workflow_patterns = [
  ".fractary/plugins/faber/workflows/*.json",
  ".fractary/faber/workflows/*.json"
]

for pattern in workflow_patterns:
  files = glob(pattern)
  for file in files:
    content = read(file)
    workflow = parse_json(content)
    discovered.workflows.append({
      id: workflow.id,
      description: workflow.description,
      extends: workflow.extends,
      path: file
    })

# 6. Determine project type from existing files
project_indicators = {
  "package.json": "javascript",
  "Cargo.toml": "rust",
  "pyproject.toml": "python",
  "go.mod": "go",
  "pom.xml": "java",
  "Gemfile": "ruby"
}

for indicator, proj_type in project_indicators.items():
  if exists(indicator):
    discovered.project_type = proj_type
    break

PRINT "Project Research Complete"
PRINT ""
PRINT "Discovered:"
PRINT "  - {len(discovered.commands)} project commands"
PRINT "  - {len(discovered.agents)} project agents"
PRINT "  - {len(discovered.skills)} project skills"
PRINT "  - {len(discovered.workflows)} existing workflows"
if discovered.project_type:
  PRINT "  - Project type: {discovered.project_type}"
PRINT ""
```

### Step 2: Read Core and Default Workflows

**Goal**: Understand the structure and patterns of existing workflows

**Logic**:
```
# Locate plugin workflows
plugin_root = getenv("CLAUDE_MARKETPLACE_ROOT") or "~/.claude/plugins/marketplaces"
faber_workflows_dir = "{plugin_root}/fractary/plugins/faber/config/workflows"

# Read core workflow as reference
core_workflow_path = "{faber_workflows_dir}/core.json"
if exists(core_workflow_path):
  core_workflow = parse_json(read(core_workflow_path))
  PRINT "Loaded core workflow as reference"
else:
  # Fallback to local plugin path
  core_workflow_path = "plugins/faber/config/workflows/core.json"
  if exists(core_workflow_path):
    core_workflow = parse_json(read(core_workflow_path))
    PRINT "Loaded core workflow from local plugins"
  else:
    ERROR "Could not find core workflow reference"
    EXIT 1

# Read default workflow as example
default_workflow_path = "{faber_workflows_dir}/default.json"
if exists(default_workflow_path):
  default_workflow = parse_json(read(default_workflow_path))
else:
  default_workflow_path = "plugins/faber/config/workflows/default.json"
  if exists(default_workflow_path):
    default_workflow = parse_json(read(default_workflow_path))

# Extract phase names from core
core_phases = ["frame", "architect", "build", "evaluate", "release"]
```

### Step 3: Gather Requirements via User Questions

**Goal**: Clarify workflow requirements through interactive questions

**Logic**:
```
# Prepare questions based on what we know and don't know
questions = []

# Question 1: Workflow name (if not provided)
if workflow_name is null or workflow_name == "":
  questions.append({
    question: "What should this workflow be named?",
    header: "Name",
    options: [
      {label: "custom", description: "A general-purpose custom workflow"},
      {label: "data-pipeline", description: "For data processing and ETL tasks"},
      {label: "documentation", description: "For documentation updates"},
      {label: "infrastructure", description: "For infrastructure/deployment changes"}
    ],
    multiSelect: false
  })

# Question 2: Workflow purpose (if context not provided)
if context is null or context == "":
  questions.append({
    question: "What is the primary purpose of this workflow?",
    header: "Purpose",
    options: [
      {label: "Feature development", description: "Building new features with full spec/test cycles"},
      {label: "Bug fixes", description: "Quick fixes with focused testing"},
      {label: "Data processing", description: "ETL pipelines, data transformations"},
      {label: "Documentation", description: "Writing and updating documentation"}
    ],
    multiSelect: false
  })

# Question 3: Which phases need customization
questions.append({
  question: "Which phases need custom steps for your workflow?",
  header: "Phases",
  options: [
    {label: "Frame", description: "Initial setup and context gathering"},
    {label: "Architect", description: "Design and specification creation"},
    {label: "Build", description: "Implementation and development"},
    {label: "Evaluate", description: "Testing and validation"}
  ],
  multiSelect: true
})

# Question 4: Autonomy level
questions.append({
  question: "What autonomy level should this workflow use?",
  header: "Autonomy",
  options: [
    {label: "guarded (Recommended)", description: "Pauses before release for approval"},
    {label: "assist", description: "Pauses before each phase for confirmation"},
    {label: "autonomous", description: "Runs without pausing (use carefully)"},
    {label: "dry-run", description: "Plans but doesn't execute any changes"}
  ],
  multiSelect: false
})

# Ask all questions
if len(questions) > 0:
  responses = AskUserQuestion(questions=questions)

  # Process responses
  if workflow_name is null:
    workflow_name = responses.name or responses["Name"]
  if context is null:
    context = responses.purpose or responses["Purpose"]

  selected_phases = responses.phases or responses["Phases"] or []
  autonomy_level = responses.autonomy or responses["Autonomy"]

  # Clean autonomy level (remove "(Recommended)" suffix)
  if autonomy_level contains "(Recommended)":
    autonomy_level = "guarded"
```

### Step 4: Ask About Project-Specific Integration

**Goal**: Determine which discovered commands/agents/skills to integrate

**Logic**:
```
# Only ask if we discovered project-specific items
if len(discovered.commands) > 0 or len(discovered.agents) > 0 or len(discovered.skills) > 0:

  integration_questions = []

  # Ask about commands to integrate
  if len(discovered.commands) > 0:
    command_options = []
    for cmd in discovered.commands[:4]:  # Limit to 4 options
      command_options.append({
        label: cmd.name,
        description: cmd.description or "No description"
      })

    integration_questions.append({
      question: "Which project commands should be integrated into the workflow?",
      header: "Commands",
      options: command_options,
      multiSelect: true
    })

  # Ask about agents to integrate
  if len(discovered.agents) > 0:
    agent_options = []
    for agent in discovered.agents[:4]:
      agent_options.append({
        label: agent.name,
        description: agent.description or "No description"
      })

    integration_questions.append({
      question: "Which project agents should be used in workflow steps?",
      header: "Agents",
      options: agent_options,
      multiSelect: true
    })

  # Ask about skills to integrate
  if len(discovered.skills) > 0:
    skill_options = []
    for skill in discovered.skills[:4]:
      skill_options.append({
        label: skill.name,
        description: skill.description or "No description"
      })

    integration_questions.append({
      question: "Which project skills should be called from workflow steps?",
      header: "Skills",
      options: skill_options,
      multiSelect: true
    })

  if len(integration_questions) > 0:
    integration_responses = AskUserQuestion(questions=integration_questions)

    selected_commands = integration_responses.commands or []
    selected_agents = integration_responses.agents or []
    selected_skills = integration_responses.skills or []
```

### Step 5: Generate Workflow Structure

**Goal**: Create the workflow JSON structure based on gathered requirements

**Logic**:
```
# Initialize workflow structure
workflow = {
  "$schema": "../workflow.schema.json",
  "id": slugify(workflow_name),
  "description": context or "Custom workflow for {workflow_name}",
  "extends": extends,
  "phases": {},
  "autonomy": {
    "level": autonomy_level or "guarded",
    "description": get_autonomy_description(autonomy_level),
    "require_approval_for": ["release"]
  }
}

# Build phases based on selections
for phase_name in core_phases:
  phase_selected = phase_name.capitalize() in selected_phases

  workflow.phases[phase_name] = {
    "enabled": true,
    "pre_steps": [],
    "steps": [],
    "post_steps": []
  }

  # Add custom steps for selected phases
  if phase_selected:
    workflow.phases[phase_name].steps = generate_phase_steps(
      phase_name,
      context,
      selected_commands,
      selected_agents,
      selected_skills,
      discovered
    )

# Add phase descriptions
workflow.phases.frame.description = "Setup and context gathering"
workflow.phases.architect.description = "Design and planning"
workflow.phases.build.description = "Implementation"
workflow.phases.evaluate.description = "Testing and validation"
workflow.phases.release.description = "Release and deployment"

# If user provided additional context, add relevant steps
if context and len(context) > 0:
  workflow = enhance_workflow_from_context(workflow, context, discovered)
```

### Step 6: Generate Phase Steps

**Goal**: Create appropriate steps for each customized phase

**Helper Function - generate_phase_steps**:
```
def generate_phase_steps(phase_name, context, commands, agents, skills, discovered):
  steps = []

  # Frame phase steps
  if phase_name == "frame":
    # Add context-specific frame steps
    if "data" in context.lower() or "etl" in context.lower():
      steps.append({
        "id": "validate-data-sources",
        "name": "Validate Data Sources",
        "description": "Verify data sources are accessible and valid",
        "prompt": "Check that all data sources referenced in the work item are accessible. Validate data format and schema compatibility."
      })

    # Add command-based steps
    for cmd in commands:
      if "setup" in cmd.name.lower() or "init" in cmd.name.lower():
        steps.append({
          "id": "run-{slugify(cmd.name)}",
          "name": "Run {cmd.name}",
          "description": cmd.description,
          "prompt": "/{cmd.name}"
        })

  # Architect phase steps
  if phase_name == "architect":
    steps.append({
      "id": "create-design-spec",
      "name": "Create Design Specification",
      "description": "Create technical specification for the work",
      "prompt": "Create a detailed technical specification based on the work item requirements. Include:\n1. Overview of the solution approach\n2. Key components and their interactions\n3. Data structures and schemas\n4. API contracts if applicable\n5. Testing strategy"
    })

    # Add agent-based steps
    for agent in agents:
      if "design" in agent.name.lower() or "architect" in agent.name.lower():
        steps.append({
          "id": "invoke-{slugify(agent.name)}",
          "name": "Invoke {agent.name}",
          "description": agent.description,
          "prompt": "Use Task tool to invoke {agent.name} agent for design assistance"
        })

  # Build phase steps
  if phase_name == "build":
    steps.append({
      "id": "implement-solution",
      "name": "Implement Solution",
      "description": "Implement the solution following the specification",
      "prompt": "Implement the solution according to the specification:\n1. Follow existing project patterns and conventions\n2. Create atomic commits for each logical unit\n3. Write tests alongside implementation\n4. Ensure code quality and documentation"
    })

    # Add skill-based steps
    for skill in skills:
      if "build" in skill.name.lower() or "generate" in skill.name.lower():
        steps.append({
          "id": "run-{slugify(skill.name)}",
          "name": "Run {skill.name} skill",
          "description": skill.description,
          "skill": "project:{skill.name}"
        })

  # Evaluate phase steps
  if phase_name == "evaluate":
    steps.append({
      "id": "run-tests",
      "name": "Run Test Suite",
      "description": "Execute all relevant tests",
      "prompt": "Run the test suite and verify all tests pass:\n1. Unit tests\n2. Integration tests\n3. Any project-specific validation"
    })

    steps.append({
      "id": "validate-requirements",
      "name": "Validate Requirements",
      "description": "Verify all requirements from the specification are met",
      "prompt": "Review the specification and verify each requirement is satisfied:\n1. Check all acceptance criteria\n2. Validate edge cases\n3. Ensure documentation is complete"
    })

  return steps
```

### Step 7: Validate Workflow Structure

**Goal**: Ensure the generated workflow is valid and complete

**Logic**:
```
# Validation checks
validation_errors = []
validation_warnings = []

# Check required fields
if not workflow.id:
  validation_errors.append("Missing workflow ID")

if not workflow.phases:
  validation_errors.append("Missing phases definition")

# Check all phases exist
for phase_name in core_phases:
  if phase_name not in workflow.phases:
    validation_warnings.append("Phase '{phase_name}' not defined (will inherit from parent)")
  else:
    phase = workflow.phases[phase_name]
    if "enabled" not in phase:
      phase.enabled = true

# Check autonomy
if not workflow.autonomy or not workflow.autonomy.level:
  workflow.autonomy = {
    "level": "guarded",
    "require_approval_for": ["release"]
  }

# Check for duplicate step IDs
all_step_ids = []
for phase_name, phase in workflow.phases.items():
  for step in (phase.pre_steps or []) + (phase.steps or []) + (phase.post_steps or []):
    if step.id in all_step_ids:
      validation_errors.append("Duplicate step ID: {step.id}")
    all_step_ids.append(step.id)

# Report validation results
if len(validation_errors) > 0:
  PRINT "Validation Errors:"
  for error in validation_errors:
    PRINT "  - {error}"
  ERROR "Cannot create workflow due to validation errors"
  EXIT 2

if len(validation_warnings) > 0:
  PRINT "Validation Warnings:"
  for warning in validation_warnings:
    PRINT "  - {warning}"
  PRINT ""
```

### Step 8: Confirm and Save Workflow

**Goal**: Get user confirmation and save the workflow file

**Logic**:
```
# Generate workflow JSON
workflow_json = serialize_json(workflow, indent=2)

# Display preview
PRINT "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
PRINT "Workflow Preview"
PRINT "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
PRINT ""
PRINT "ID: {workflow.id}"
PRINT "Description: {workflow.description}"
PRINT "Extends: {workflow.extends}"
PRINT "Autonomy: {workflow.autonomy.level}"
PRINT ""
PRINT "Phases:"
for phase_name, phase in workflow.phases.items():
  step_count = len(phase.pre_steps or []) + len(phase.steps or []) + len(phase.post_steps or [])
  if step_count > 0:
    PRINT "  {phase_name}: {step_count} custom step(s)"
  else:
    PRINT "  {phase_name}: (inherits from {extends})"
PRINT ""

# Ask for confirmation
confirm_response = AskUserQuestion(
  questions=[{
    question: "How would you like to proceed with this workflow?",
    header: "Confirm",
    options: [
      {label: "Save workflow", description: "Save to .fractary/faber/workflows/{workflow.id}.json"},
      {label: "Show full JSON", description: "Display complete workflow before saving"},
      {label: "Cancel", description: "Discard and exit"}
    ],
    multiSelect: false
  }]
)

confirm_action = confirm_response.confirm or confirm_response["Confirm"]

if confirm_action == "Show full JSON":
  PRINT ""
  PRINT "Full Workflow JSON:"
  PRINT "```json"
  PRINT workflow_json
  PRINT "```"
  PRINT ""

  # Ask again after showing JSON
  final_response = AskUserQuestion(
    questions=[{
      question: "Save this workflow?",
      header: "Save",
      options: [
        {label: "Yes, save it", description: "Save to .fractary/faber/workflows/"},
        {label: "No, cancel", description: "Discard and exit"}
      ],
      multiSelect: false
    }]
  )

  if "No" in final_response.save or "cancel" in final_response["Save"].lower():
    PRINT "Workflow creation cancelled."
    EXIT 0

if confirm_action == "Cancel":
  PRINT "Workflow creation cancelled."
  EXIT 0
```

### Step 9: Save Workflow File

**Goal**: Write the workflow to the project's workflow directory

**Logic**:
```
# Determine output path
output_dir = ".fractary/faber/workflows"
output_path = "{output_dir}/{workflow.id}.json"

# Ensure directory exists
mkdir -p {output_dir}

# Write workflow file
write(output_path, workflow_json)

PRINT "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
PRINT "Workflow Created Successfully"
PRINT "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
PRINT ""
PRINT "File: {output_path}"
PRINT ""
PRINT "To use this workflow:"
PRINT "  1. Add to config: .fractary/plugins/faber/config.json"
PRINT "     Add to 'workflows' array:"
PRINT "     {\"id\": \"{workflow.id}\", \"file\": \"./workflows/{workflow.id}.json\"}"
PRINT ""
PRINT "  2. Run with workflow:"
PRINT "     /fractary-faber:run --work-id <id> --workflow {workflow.id}"
PRINT ""
PRINT "  3. Or set as default in config:"
PRINT "     \"default_workflow\": \"project:{workflow.id}\""
PRINT ""

# Offer to validate
validate_response = AskUserQuestion(
  questions=[{
    question: "Would you like to validate the new workflow?",
    header: "Validate",
    options: [
      {label: "Yes, run audit", description: "Run /fractary-faber:workflow-audit on the new workflow"},
      {label: "No, I'm done", description: "Exit without validation"}
    ],
    multiSelect: false
  }]
)

if "Yes" in validate_response.validate or "audit" in validate_response["Validate"].lower():
  PRINT ""
  PRINT "Running workflow audit..."
  # The audit will be handled by returning control to the user with the command
  PRINT "Run: /fractary-faber:workflow-audit {output_path}"
```

## Exit Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 0 | Success | Workflow created successfully |
| 1 | Config Error | Could not find core workflow reference |
| 2 | Validation Error | Generated workflow failed validation |
| 3 | Write Error | Could not write workflow file |
| 4 | User Cancelled | User cancelled workflow creation |

## Best Practices Applied

The workflow creator ensures generated workflows follow these best practices:

1. **Extends Core**: All workflows extend `fractary-faber:core` by default, inheriting essential lifecycle steps
2. **Phase Structure**: Uses the 5-phase FABER structure (frame, architect, build, evaluate, release)
3. **Unique Step IDs**: All step IDs are unique and follow naming conventions
4. **Autonomy Configuration**: Proper autonomy settings with `require_approval_for` array
5. **Schema Reference**: Includes `$schema` reference for validation
6. **Descriptive Metadata**: Includes description for workflow and each phase
7. **Project Integration**: Integrates discovered project commands, agents, and skills

## Related Documentation

- **Commands**:
  - `commands/workflow-audit.md` - Validate workflow configuration
  - `commands/workflow-run.md` - Execute workflows
- **Workflows**:
  - `config/workflows/core.json` - Core workflow to extend
  - `config/workflows/default.json` - Example of extending core
  - `config/workflows/feature.json` - Feature workflow example
- **Schema**:
  - `config/workflow.schema.json` - Workflow JSON schema
