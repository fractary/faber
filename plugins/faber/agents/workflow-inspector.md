---
name: workflow-inspector
description: Validates FABER workflow configuration and reports issues with completeness scoring
model: claude-sonnet-4-5
tools: Read, Write, Glob, Bash
color: orange
---

# Workflow Inspector Agent

## Purpose

Performs comprehensive validation of FABER workflow configuration files to ensure:
- Configuration file is valid and complete
- All required phases are properly defined
- Hooks are configured correctly
- Plugin integrations are valid
- Best practices are followed

Reports issues with severity levels (ERROR, WARNING, INFO) and calculates a configuration completeness score (0-100%).

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflow-target` | string | No | **First positional argument**. Workflow to inspect: workflow ID, file path (*.json), or namespaced (plugin:id). If omitted, shows usage and lists available workflows. |
| `verbose` | boolean | No | Show detailed validation output. Default: false |
| `fix` | boolean | No | Auto-fix simple issues. Default: false |
| `check` | string | No | Check specific aspect: `phases`, `hooks`, `integrations`, or `all` (default) |
| `config-path` | string | No | Path to config file. Default: `.fractary/config.yaml` |

**Examples**:
- No argument: `/fractary-faber:workflow-inspect` → Shows usage and lists workflows
- Workflow ID: `/fractary-faber:workflow-inspect default` → Validates "default" workflow from project config
- Workflow file: `/fractary-faber:workflow-inspect ./custom.json` → Validates standalone workflow file
- Namespaced: `/fractary-faber:workflow-inspect fractary-faber:feature` → Validates plugin workflow

## Algorithm

### Step 0: Parse Arguments and Determine Inspect Mode

**Goal**: Parse input arguments and determine what to inspect (full config, specific workflow, or show usage)

**Logic**:
```
# Parse arguments from $ARGUMENTS
args_string = "$ARGUMENTS"
workflow_target = extract_first_positional_argument(args_string)
flags = parse_flags(args_string)  # --verbose, --fix, --check, --config-path

verbose = flags["verbose"] or false
fix = flags["fix"] or false
check_aspect = flags["check"] or "all"
config_path_override = flags["config-path"] or null

# Determine audit mode based on workflow_target format
if workflow_target is null or workflow_target == "":
  inspect_mode = "no_target"
  target_description = "Show usage and list available workflows"
else if workflow_target ends_with ".json":
  inspect_mode = "workflow_file"
  workflow_file_path = resolve_path(workflow_target)
  target_description = "Workflow file: {workflow_file_path}"
else if workflow_target contains ":":
  inspect_mode = "namespaced_workflow"
  parts = split(workflow_target, ":")
  namespace = parts[0]
  workflow_id = parts[1]
  target_description = "Namespaced workflow: {workflow_target}"
else:
  inspect_mode = "workflow_id"
  workflow_id = workflow_target
  target_description = "Workflow '{workflow_id}' from project config"

# Display inspect header
PRINT "🔍 FABER Workflow Inspection"
PRINT "Target: {target_description}"
PRINT "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
PRINT ""

if verbose:
  PRINT "Mode: {inspect_mode}"
  PRINT "Check aspect: {check_aspect}"
  PRINT "Auto-fix: {fix}"
  PRINT ""
```

**Output**:
- `inspect_mode`: One of `no_target`, `workflow_file`, `namespaced_workflow`, `workflow_id`, `config`
- `workflow_target`, `workflow_id`, `workflow_file_path`, `namespace` (depending on mode)
- `verbose`, `fix`, `check_aspect`, `config_path_override` flags

### Step 1: Load Target Configuration/Workflow

**Goal**: Load the target for inspection based on the mode determined in Step 0

**Logic**:
```
# Handle based on inspect_mode from Step 0

# MODE: no_target - Show usage and list workflows
if inspect_mode == "no_target":
  # Load default config to list workflows (unified YAML)
  default_config_paths = [
    ".fractary/config.yaml"
  ]

  config_file = find_first_existing(default_config_paths)

  if config_file:
    config = parse_json(read(config_file))

    PRINT "Usage: /fractary-faber:workflow-inspect [<workflow>] [OPTIONS]"
    PRINT ""
    PRINT "Workflow identifier:"
    PRINT "  workflow-id          Validate workflow from project config"
    PRINT "  path/to/file.json    Validate standalone workflow file"
    PRINT "  plugin:workflow-id   Validate namespaced workflow"
    PRINT ""
    PRINT "Options:"
    PRINT "  --verbose            Show detailed validation output"
    PRINT "  --fix                Auto-fix simple issues"
    PRINT "  --check <aspect>     Check specific aspect: phases, hooks, integrations, all"
    PRINT "  --config-path <path> Override default config path"
    PRINT ""

    if config.workflows and len(config.workflows) > 0:
      PRINT "Available workflows in {config_file}:"
      for workflow in config.workflows:
        desc = workflow.description or "No description"
        PRINT "  • {workflow.id} - {desc}"
    else:
      PRINT "No workflows found in {config_file}"
  else:
    PRINT "Usage: /fractary-faber:workflow-inspect [<workflow>] [OPTIONS]"
    PRINT ""
    PRINT "No configuration file found at default locations."
    PRINT "Use --config-path to specify config location."

  EXIT 0

# MODE: workflow_file - Validate standalone JSON file
else if inspect_mode == "workflow_file":
  if not exists(workflow_file_path):
    ERROR "Workflow file not found: {workflow_file_path}"
    EXIT 3

  workflow_content = read(workflow_file_path)
  workflow = parse_json(workflow_content)

  # Validate it's a workflow (has required fields)
  if not workflow.id or not workflow.phases:
    ERROR "File is not a valid workflow (missing required fields: id, phases)"
    EXIT 4

  workflows = [workflow]
  config_file = workflow_file_path

# MODE: namespaced_workflow - Load from plugin
else if inspect_mode == "namespaced_workflow":
  # Resolve namespace to plugin path
  plugin_root = getenv("CLAUDE_PLUGIN_ROOT") or "~/.claude/plugins/marketplaces/fractary/"

  # Map namespace to workflow directory
  if namespace == "fractary-faber":
    workflow_dir = "{plugin_root}/plugins/faber/config/workflows/"
  else if namespace == "fractary-faber-cloud":
    workflow_dir = "{plugin_root}/plugins/faber-cloud/config/workflows/"
  else if namespace == "project":
    workflow_dir = ".fractary/faber/workflows/"
  else:
    # Try generic pattern: namespace → plugins/{namespace}/config/workflows/
    plugin_name = replace(namespace, "fractary-", "")
    workflow_dir = "{plugin_root}/plugins/{plugin_name}/config/workflows/"

  workflow_file_path = "{workflow_dir}/{workflow_id}.json"

  if not exists(workflow_file_path):
    ERROR "Namespaced workflow not found: {workflow_file_path}"
    PRINT "Namespace: {namespace}"
    PRINT "Workflow ID: {workflow_id}"
    PRINT "Searched in: {workflow_dir}"
    EXIT 3

  workflow = parse_json(read(workflow_file_path))
  workflows = [workflow]
  config_file = workflow_file_path

# MODE: workflow_id - Load from project config
else if inspect_mode == "workflow_id":
  # Determine config paths
  if config_path_override:
    config_paths = [config_path_override]
  else:
    config_paths = [
      ".fractary/config.yaml"
    ]

  config_file = find_first_existing(config_paths)

  if config_file is null:
    ERROR "Configuration file not found"
    PRINT "Expected locations:"
    for path in config_paths:
      PRINT "  - {path}"
    EXIT 3

  config = parse_json(read(config_file))

  # Find workflow by ID
  workflow = null
  for w in config.workflows:
    if w.id == workflow_id:
      workflow = w
      break

  if workflow is null:
    ERROR "Workflow '{workflow_id}' not found in config"
    PRINT ""
    PRINT "Available workflows:"
    for w in config.workflows:
      PRINT "  - {w.id}: {w.description}"
    EXIT 3

  # If workflow.file specified, load from file
  if workflow.file:
    workflow_file_path = resolve_path(workflow.file)
    if exists(workflow_file_path):
      workflow = parse_json(read(workflow_file_path))

  workflows = [workflow]

# MODE: config (legacy, explicit --config-path without workflow)
else:
  # Original behavior: validate entire config
  if config_path_override:
    config_paths = [config_path_override]
  else:
    config_paths = [
      ".fractary/config.yaml"
    ]

  config_file = find_first_existing(config_paths)

  if config_file is null:
    ERROR "Configuration file not found"
    PRINT "Expected locations:"
    for path in config_paths:
      PRINT "  - {path}"
    EXIT 3

  config = parse_json(read(config_file))
  workflows = config.workflows
```

**Output**:
- `workflows`: Array of workflow objects to validate
- `config_file`: Path to config or workflow file (for reporting)
- `config`: Full config object (if loaded from project config)

### Step 2: Parse and Validate JSON

**Goal**: Load configuration and verify valid JSON syntax

**Logic**:
```
TRY:
  config_content = read(config_file)
  config = parse_json(config_content)
CATCH json_error:
  ERROR "Invalid JSON syntax in configuration file"
  PRINT "File: {config_file}"
  PRINT "Error: {json_error.message}"
  PRINT "Line: {json_error.line}"
  EXIT 4
```

**Validation**:
- File is valid JSON
- Root is an object (not array or primitive)
- Basic structure exists

### Step 3: Initialize Validation Tracking

**Goal**: Set up data structures for tracking validation results

**Logic**:
```
validation_results = {
  passed: [],      # List of passed checks
  warnings: [],    # List of warnings
  errors: [],      # List of errors
  suggestions: [], # List of improvement suggestions
  completeness_score: 0,
  total_checks: 0,
  passed_checks: 0
}

# Define all validation checks
all_checks = [
  # Configuration file checks
  {aspect: "file", name: "Configuration file exists", weight: 5},
  {aspect: "file", name: "Valid JSON syntax", weight: 5},
  {aspect: "file", name: "Schema version is 2.0", weight: 2},

  # Workflows checks
  {aspect: "workflows", name: "Workflows array exists", weight: 5},
  {aspect: "workflows", name: "At least one workflow defined", weight: 5},

  # Phase checks (per phase)
  {aspect: "phases", name: "Frame phase defined", weight: 10},
  {aspect: "phases", name: "Architect phase defined", weight: 10},
  {aspect: "phases", name: "Build phase defined", weight: 10},
  {aspect: "phases", name: "Evaluate phase defined", weight: 10},
  {aspect: "phases", name: "Release phase defined", weight: 10},

  # Hook checks
  {aspect: "hooks", name: "All 10 phase hooks present", weight: 8},

  # Integration checks
  {aspect: "integrations", name: "Work plugin configured", weight: 3},
  {aspect: "integrations", name: "Repo plugin configured", weight: 3},
  {aspect: "integrations", name: "Spec plugin configured", weight: 3},
  {aspect: "integrations", name: "Logs plugin configured", weight: 3},

  # Autonomy checks
  {aspect: "autonomy", name: "Autonomy level valid", weight: 5},

  # Safety checks
  {aspect: "safety", name: "Safety configuration present", weight: 3}
]

# Filter checks if --check parameter provided
if check_parameter and check_parameter != "all":
  all_checks = filter(all_checks, check.aspect == check_parameter)
```

### Step 4: Validate Schema Version

**Goal**: Ensure configuration uses correct schema version

**Logic**:
```
if config.schema_version is null:
  add_warning("Schema version not specified (assuming 2.0)")
  if fix_mode:
    config.schema_version = "2.0"
    mark_for_fix()
else if config.schema_version != "2.0":
  add_error("Unsupported schema version: {config.schema_version}")
  add_suggestion("Update to schema version 2.0")
else:
  add_passed("Schema version is 2.0")
```

### Step 5: Validate Workflows Array

**Goal**: Ensure workflows are properly defined

**Logic**:
```
if config.workflows is null:
  add_error("Missing 'workflows' array")
  EXIT 2
else if not is_array(config.workflows):
  add_error("'workflows' must be an array")
  EXIT 2
else if length(config.workflows) == 0:
  add_error("At least one workflow must be defined")
  add_suggestion("Run /fractary-faber:configure to create default workflow")
  EXIT 2
else:
  add_passed("Workflows array exists and has {length(config.workflows)} workflow(s)")

# Check for duplicate workflow IDs
workflow_ids = []
for workflow in config.workflows:
  if workflow.id in workflow_ids:
    add_error("Duplicate workflow ID: {workflow.id}")
  else:
    workflow_ids.append(workflow.id)
```

### Step 6: Validate Each Workflow

**Goal**: Deep validation of each workflow configuration

**For each workflow**:

#### 6.1: Validate Required Fields

```
required_fields = ["id", "description", "phases", "hooks"]

for field in required_fields:
  if workflow[field] is null:
    add_error("[{workflow.id}] Missing required field: {field}")
  else:
    add_passed("[{workflow.id}] Field '{field}' present")
```

#### 6.1.5: Load Type-Specific Validation Rules (if workflow_type present)

```
# Check if workflow has a workflow_type field
if workflow.workflow_type is not null:
  workflow_type = workflow.workflow_type

  # Load type specification from templates
  type_spec_path = "templates/workflows/{workflow_type}/workflow.yaml"

  if exists(type_spec_path):
    type_spec = parse_yaml(read(type_spec_path))

    PRINT "📋 Workflow Type: {workflow_type}"
    PRINT "   Loading type-specific validation rules..."

    # Store for use in subsequent validation steps
    type_validation_rules = type_spec.validation
    type_critical_rules = type_spec.critical_rules

    add_passed("[{workflow.id}] workflow_type '{workflow_type}' found and loaded")
  else:
    add_warning("[{workflow.id}] workflow_type '{workflow_type}' specified but template not found")
    add_suggestion("Check that templates/workflows/{workflow_type}/ exists")
    type_validation_rules = null
    type_critical_rules = null
else:
  # No workflow_type - use standard validation only
  type_validation_rules = null
  type_critical_rules = null
```

#### 6.2: Validate Phases

```
required_phases = ["frame", "architect", "build", "evaluate", "release"]

for phase_name in required_phases:
  phase = workflow.phases[phase_name]

  if phase is null:
    add_error("[{workflow.id}] Missing phase: {phase_name}")
    continue

  # Validate phase structure
  if phase.enabled is null:
    if fix_mode:
      phase.enabled = true
      mark_for_fix()
    else:
      add_warning("[{workflow.id}] Phase '{phase_name}' missing 'enabled' field")

  if phase.description is null or phase.description == "":
    add_warning("[{workflow.id}] Phase '{phase_name}' missing description")
    add_suggestion("Add clear description for {phase_name} phase")

  if phase.steps is null or not is_array(phase.steps):
    add_error("[{workflow.id}] Phase '{phase_name}' missing 'steps' array")
  else if length(phase.steps) == 0:
    add_warning("[{workflow.id}] Phase '{phase_name}' has no steps defined")
  else:
    add_passed("[{workflow.id}] Phase '{phase_name}' has {length(phase.steps)} step(s)")

  # Validate phase-specific configurations
  if phase_name == "evaluate":
    if phase.max_retries is null:
      add_warning("[{workflow.id}] Evaluate phase missing 'max_retries' configuration")
      add_suggestion("Set max_retries for evaluate phase (recommended: 2-3)")

  if phase_name == "release":
    if phase.require_approval is null:
      add_warning("[{workflow.id}] Release phase missing 'require_approval' setting")
      add_suggestion("Set require_approval=true for release phase safety")

  # Validate validation criteria
  if phase.validation is null or length(phase.validation) == 0:
    add_info("[{workflow.id}] Phase '{phase_name}' has no validation criteria")
    add_suggestion("Add validation criteria for {phase_name} phase")
```

#### 6.2.5: Type-Specific Phase Validation

```
# Skip if no type validation rules loaded
if type_validation_rules is null:
  skip this step

PRINT "🔍 Validating against {workflow_type} template rules..."

asset_type = workflow.asset_type or "asset"  # Default to "asset" if not specified

# Validate required phases
if type_validation_rules.required_phases:
  for phase_name in type_validation_rules.required_phases:
    if workflow.phases[phase_name] is null:
      add_error("[{workflow.id}] Type '{workflow_type}' requires phase: {phase_name}")
    else if workflow.phases[phase_name].enabled == false:
      add_warning("[{workflow.id}] Type '{workflow_type}' expects phase '{phase_name}' to be enabled")

# Validate minimum steps per phase
if type_validation_rules.min_steps_per_phase:
  for phase_name, min_steps in type_validation_rules.min_steps_per_phase.items():
    if workflow.phases[phase_name] is null:
      continue

    phase = workflow.phases[phase_name]
    total_steps = len(phase.pre_steps or []) + len(phase.steps or []) + len(phase.post_steps or [])

    if total_steps < min_steps:
      add_warning("[{workflow.id}] Phase '{phase_name}' has {total_steps} steps, type requires minimum {min_steps}")

# Validate step ID patterns
if type_validation_rules.step_id_patterns:
  for phase_name, pattern in type_validation_rules.step_id_patterns.items():
    if workflow.phases[phase_name] is null:
      continue

    phase = workflow.phases[phase_name]
    all_steps = (phase.pre_steps or []) + (phase.steps or []) + (phase.post_steps or [])

    # Replace {{asset_type}} placeholder in pattern
    resolved_pattern = pattern.replace("{{asset_type}}", asset_type)

    for step in all_steps:
      if step.id and not regex_match(step.id, resolved_pattern):
        add_info("[{workflow.id}] Step '{step.id}' does not match type pattern: {resolved_pattern}")
        add_suggestion("Consider renaming to follow '{asset_type}-<action>' pattern")

# Validate required integrations
if type_validation_rules.required_integrations:
  for phase_name, integrations in type_validation_rules.required_integrations.items():
    if workflow.phases[phase_name] is null:
      continue

    phase = workflow.phases[phase_name]
    all_steps = (phase.pre_steps or []) + (phase.steps or []) + (phase.post_steps or [])

    for required_integration in integrations:
      found = false
      for step in all_steps:
        if step.command and required_integration in step.command:
          found = true
          break
        if step.prompt and required_integration in step.prompt:
          found = true
          break

      if not found:
        add_warning("[{workflow.id}] Phase '{phase_name}' should use '{required_integration}' integration")
        add_suggestion("Add a step using /fractary-{required_integration}:* command")

# Validate critical rules
if type_critical_rules:
  for rule in type_critical_rules:
    rule_id = rule.id
    severity = rule.severity or "warning"

    # Check specific rules
    if rule_id == "research-before-build":
      # Verify frame phase has research steps
      if workflow.phases.frame:
        frame_steps = workflow.phases.frame.steps or []
        has_research = any(step.id and "research" in step.id for step in frame_steps)
        if not has_research:
          if severity == "error":
            add_error("[{workflow.id}] {rule.title}: Frame phase should have research steps")
          else:
            add_warning("[{workflow.id}] {rule.title}: Frame phase should have research steps")

    if rule_id == "require-production-approval":
      # Verify release phase has approval required
      if workflow.phases.release:
        if workflow.phases.release.require_approval != true:
          if severity == "error":
            add_error("[{workflow.id}] {rule.title}: Release phase must have require_approval=true")
          else:
            add_warning("[{workflow.id}] {rule.title}: Release phase should have require_approval=true")

    if rule_id == "test-before-production":
      # Verify evaluate phase is enabled
      if workflow.phases.evaluate:
        if workflow.phases.evaluate.enabled == false:
          if severity == "error":
            add_error("[{workflow.id}] {rule.title}: Evaluate phase must be enabled")
          else:
            add_warning("[{workflow.id}] {rule.title}: Evaluate phase should be enabled")

PRINT "   Type-specific validation complete"
```

#### 6.3: Validate Hooks

```
required_hooks = [
  "pre_frame", "post_frame",
  "pre_architect", "post_architect",
  "pre_build", "post_build",
  "pre_evaluate", "post_evaluate",
  "pre_release", "post_release"
]

missing_hooks = []
for hook_name in required_hooks:
  if workflow.hooks[hook_name] is null:
    missing_hooks.append(hook_name)
    if fix_mode:
      workflow.hooks[hook_name] = []
      mark_for_fix()

if length(missing_hooks) > 0:
  if fix_mode:
    add_passed("[{workflow.id}] Auto-fixed {length(missing_hooks)} missing hook arrays")
  else:
    add_warning("[{workflow.id}] Missing {length(missing_hooks)} hook definitions")
    add_suggestion("Add hook arrays: {join(missing_hooks, ', ')}")
else:
  add_passed("[{workflow.id}] All 10 phase hooks present")

# Validate each hook definition
for hook_name in required_hooks:
  if workflow.hooks[hook_name] is null:
    continue

  for hook in workflow.hooks[hook_name]:
    # Validate hook structure
    if hook.type is null:
      add_error("[{workflow.id}] Hook in '{hook_name}' missing 'type' field")
    else if hook.type not in ["document", "skill", "script", "agent"]:
      add_error("[{workflow.id}] Invalid hook type: {hook.type}")

    if hook.name is null:
      add_warning("[{workflow.id}] Hook in '{hook_name}' missing 'name' field")

    # Validate referenced files exist
    if hook.type == "document" and hook.path:
      if not exists(hook.path):
        add_warning("[{workflow.id}] Hook references missing file: {hook.path}")

    if hook.type == "skill" and hook.skill:
      # Check if skill exists (optional - may not be installed yet)
      pass
```

#### 6.4: Validate Autonomy Configuration

```
if workflow.autonomy is null:
  add_warning("[{workflow.id}] Missing autonomy configuration")
  add_suggestion("Add autonomy configuration (level, pause_before_release, require_approval_for)")
else:
  valid_levels = ["dry-run", "assist", "guarded", "autonomous"]

  if workflow.autonomy.level is null:
    add_warning("[{workflow.id}] Missing autonomy level")
  else if workflow.autonomy.level not in valid_levels:
    add_error("[{workflow.id}] Invalid autonomy level: {workflow.autonomy.level}")
    add_suggestion("Use one of: {join(valid_levels, ', ')}")
  else:
    add_passed("[{workflow.id}] Valid autonomy level: {workflow.autonomy.level}")

  if workflow.autonomy.pause_before_release is null:
    add_info("[{workflow.id}] Consider setting pause_before_release=true")

  if workflow.autonomy.require_approval_for is null:
    if fix_mode:
      workflow.autonomy.require_approval_for = []
      mark_for_fix()
    else:
      add_warning("[{workflow.id}] Missing require_approval_for array")
```

### Step 6.5: Validate Referenced Agents and Skills

**Goal**: Verify that agents/skills referenced in workflow steps exist and return proper FABER Response Format

**Logic**:
```
# Skip if not checking relevant aspects
if check_aspect not in ["all", "steps", "integrations"]:
  skip this step

# Initialize results tracking
agent_skill_validation = {
  compliant: [],
  unknown: [],
  not_found: []
}

# Step A: Build Agent/Skill Registry
PRINT "🔍 Discovering agents and skills..."

agent_registry = {}

# Discover plugin agents
plugin_root = getenv("CLAUDE_PLUGIN_ROOT") or "~/.claude/plugins/marketplaces/fractary/"

agent_files = glob("{plugin_root}/plugins/*/agents/*.md")
for agent_file in agent_files:
  content = read(agent_file)
  # Extract name from frontmatter (YAML between --- markers)
  agent_name = extract_yaml_field(content, "name")
  if agent_name:
    plugin_name = extract_plugin_from_path(agent_file)  # e.g., "faber" from "plugins/faber/agents/"

    agent_registry[agent_name] = {
      path: agent_file,
      type: "agent",
      plugin: plugin_name
    }

# Discover plugin skills
skill_files = glob("{plugin_root}/plugins/*/skills/*/SKILL.md")
for skill_file in skill_files:
  content = read(skill_file)
  skill_name = extract_yaml_field(content, "name")
  if skill_name:
    plugin_name = extract_plugin_from_path(skill_file)

    agent_registry[skill_name] = {
      path: skill_file,
      type: "skill",
      plugin: plugin_name
    }

# Discover user agents
user_agent_patterns = ["~/.claude/agents/*.md", ".claude/agents/*.md"]
for pattern in user_agent_patterns:
  agent_files = glob(pattern)
  for agent_file in agent_files:
    content = read(agent_file)
    agent_name = extract_yaml_field(content, "name")
    if agent_name:
      agent_registry[agent_name] = {
        path: agent_file,
        type: "agent",
        plugin: "user"
      }

PRINT "Found {len(agent_registry)} agents/skills in registry"
if verbose:
  PRINT "Registry entries:"
  for name in agent_registry.keys():
    entry = agent_registry[name]
    PRINT "  - {name} ({entry.type}, {entry.plugin})"

# Step B: Extract References from Workflow Steps
PRINT "Extracting agent/skill references from workflow steps..."

referenced = set()

for workflow in workflows:
  for phase_name in ["frame", "architect", "build", "evaluate", "release"]:
    if workflow.phases is null or workflow.phases[phase_name] is null:
      continue

    phase = workflow.phases[phase_name]

    # Collect all steps
    all_steps = []
    if phase.pre_steps:
      all_steps.extend(phase.pre_steps)
    if phase.steps:
      all_steps.extend(phase.steps)
    if phase.post_steps:
      all_steps.extend(phase.post_steps)

    for step in all_steps:
      if step.prompt is null:
        continue

      prompt = step.prompt

      # Extract skill references: Skill(skill="name") or /plugin:skill
      skill_matches = regex_findall('Skill\\(skill="([^"]+)"\\)', prompt)
      for match in skill_matches:
        referenced.add(match)

      slash_matches = regex_findall('/([a-z0-9-]+:[a-z0-9-]+)', prompt)
      for match in slash_matches:
        referenced.add(match)

      # Extract agent references: Task(subagent_type="name")
      agent_matches = regex_findall('Task\\(subagent_type="([^"]+)"\\)', prompt)
      for match in agent_matches:
        referenced.add(match)

PRINT "Found {len(referenced)} unique agent/skill references"
if verbose:
  PRINT "References:"
  for ref in referenced:
    PRINT "  - {ref}"

# Step C: Validate Each Reference
PRINT "Validating agent/skill response format compliance..."

for ref in referenced:
  entry = agent_registry.get(ref)

  if entry is null:
    # Not found in registry
    agent_skill_validation.not_found.append({
      name: ref,
      type: "unknown"
    })
    add_warning("[Agent/Skill] Referenced agent/skill not found: {ref}")
    continue

  # Check documentation for FABER Response Format compliance
  doc_content = read(entry.path)

  # Look for explicit indicators of FABER Response Format
  explicit_indicators = [
    "FABER Response Format",
    "FABER response format",
    "skill-response.schema.json",
    "RESPONSE-FORMAT.md",
    "standard FABER response"
  ]

  is_compliant = false
  for indicator in explicit_indicators:
    if indicator in doc_content:
      is_compliant = true
      break

  if is_compliant:
    agent_skill_validation.compliant.append({
      name: ref,
      type: entry.type,
      plugin: entry.plugin
    })
    add_passed("[Agent/Skill] {ref} documents FABER Response Format")
  else:
    # Check for implicit indicators (structured output with required fields)
    has_outputs = "<OUTPUTS>" in doc_content or "## Output" in doc_content or "## Returns" in doc_content
    has_status = '"status":' in doc_content or "'status':" in doc_content or "status field" in doc_content
    has_message = '"message":' in doc_content or "'message':" in doc_content or "message field" in doc_content
    has_details = '"details":' in doc_content or "details object" in doc_content
    has_errors = '"errors":' in doc_content or "errors array" in doc_content
    has_warnings = '"warnings":' in doc_content or "warnings array" in doc_content

    # If has structured output with required fields, consider compliant
    if has_outputs and has_status and has_message and (has_details or has_errors or has_warnings):
      is_compliant = true
      agent_skill_validation.compliant.append({
        name: ref,
        type: entry.type,
        plugin: entry.plugin
      })
      add_passed("[Agent/Skill] {ref} has structured output matching FABER format")
    else:
      agent_skill_validation.unknown.append({
        name: ref,
        type: entry.type,
        plugin: entry.plugin,
        has_structured_output: has_outputs and has_status and has_message
      })

      add_info("[Agent/Skill] {ref} response format compliance unknown")
      add_suggestion("Document FABER Response Format compliance for {ref}")
      add_suggestion("Reference: plugins/faber/docs/RESPONSE-FORMAT.md")

# Store for report generation in Step 10
# (agent_skill_validation variable will be available in Step 10)
```

**Output**:
- `agent_skill_validation`: Object with arrays of compliant, unknown, and not_found agents/skills

### Step 7: Validate Global Configuration

**Goal**: Validate settings that apply to all workflows

#### 7.1: Logging Configuration

```
if config.logging is null:
  add_warning("Missing global logging configuration")
else:
  if config.logging.use_logs_plugin != true:
    add_warning("Logs plugin not enabled (use_logs_plugin=false)")
    add_suggestion("Enable logs plugin for better workflow tracking")

  if config.logging.log_type is null:
    add_warning("Missing log_type configuration")
  else if config.logging.log_type != "workflow":
    add_info("Log type is '{config.logging.log_type}' (expected: 'workflow')")

  valid_log_levels = ["debug", "info", "warn", "error"]
  if config.logging.log_level not in valid_log_levels:
    add_warning("Invalid log level: {config.logging.log_level}")
```

#### 7.2: Plugin Integrations

```
if config.integrations is null:
  add_warning("Missing integrations configuration")
  add_suggestion("Configure plugin integrations (work, repo, spec, logs)")
else:
  required_plugins = {
    "work_plugin": "fractary-work",
    "repo_plugin": "fractary-repo",
    "spec_plugin": "fractary-spec",
    "logs_plugin": "fractary-logs"
  }

  for plugin_key, plugin_id in required_plugins.items():
    if config.integrations[plugin_key] is null:
      add_warning("Missing integration: {plugin_key}")
    else:
      configured_plugin = config.integrations[plugin_key]

      # Check if plugin is installed
      plugin_exists = exists(".fractary/plugins/{configured_plugin}")

      if not plugin_exists:
        add_warning("Plugin '{configured_plugin}' not found in .fractary/plugins/")
        add_suggestion("Install plugin: fractary-cli install {configured_plugin}")
      else:
        add_passed("Plugin '{configured_plugin}' is installed")
```

#### 7.3: Safety Configuration

```
if config.safety is null:
  add_warning("Missing safety configuration")
  add_suggestion("Add safety configuration (protected_paths, require_confirm_for)")
else:
  if config.safety.protected_paths is null:
    if fix_mode:
      config.safety.protected_paths = [".fractary/", ".git/"]
      mark_for_fix()
    else:
      add_warning("Missing protected_paths array")

  if config.safety.require_confirm_for is null:
    if fix_mode:
      config.safety.require_confirm_for = ["delete", "deploy", "publish"]
      mark_for_fix()
    else:
      add_warning("Missing require_confirm_for array")
```

### Step 8: Calculate Completeness Score

**Goal**: Compute overall configuration quality score (0-100%)

**Logic**:
```
# Weighted scoring
total_weight = sum(check.weight for check in all_checks)
passed_weight = sum(check.weight for check in all_checks if check in passed_checks)

completeness_score = (passed_weight / total_weight) * 100

# Adjust score based on errors and warnings
error_penalty = length(validation_results.errors) * 5
warning_penalty = length(validation_results.warnings) * 2

completeness_score = max(0, completeness_score - error_penalty - warning_penalty)

validation_results.completeness_score = round(completeness_score)
```

### Step 9: Apply Auto-Fixes (if --fix mode)

**Goal**: Automatically fix simple issues

**Logic**:
```
if fix_mode and has_fixes:
  # Create backup
  backup_path = config_file + ".backup"
  TRY:
    copy(config_file, backup_path)
  CATCH:
    WARN "Could not create backup"

  # Write fixed configuration
  TRY:
    json_string = serialize_json(config, indent=2)
    write(config_file, json_string)

    PRINT "✓ Auto-fixed {fix_count} issues"
    PRINT "  Backup: {backup_path}"
  CATCH write_error:
    ERROR "Failed to write fixed configuration: {write_error}"
    EXIT 1
```

**Auto-fixable issues**:
- Missing hook arrays (add empty arrays)
- Missing enabled fields (set to true)
- Missing require_approval_for arrays (add empty arrays)
- Missing schema_version (set to "2.0")
- Missing protected_paths (add defaults)
- Missing require_confirm_for (add defaults)

### Step 10: Generate Report

**Goal**: Present validation results in readable format

**Output Format**:
```
🔍 FABER Configuration Inspection
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Configuration: {config_file}
Workflow(s): {workflow_count}

📋 Workflow Type Compliance (if workflow_type present):
Type: {workflow_type}
Asset Type: {asset_type}
Template: templates/workflows/{workflow_type}/

Type Standards Checked:
  ✓ Required phases present
  ✓ Minimum steps per phase met
  ⚠ Step ID patterns (2 suggestions)
  ✓ Required integrations present
  ✓ Critical rules validated

📊 Configuration Completeness: {completeness_score}/100

✅ PASSED ({passed_count})
  ✓ {passed_check_1}
  ✓ {passed_check_2}
  ...

❌ ERRORS ({error_count})
  ✗ {error_1}
  ✗ {error_2}
  ...

⚠️  WARNINGS ({warning_count})
  ! {warning_1}
  ! {warning_2}
  ...

💡 SUGGESTIONS ({suggestion_count})
  → {suggestion_1}
  → {suggestion_2}
  ...

📋 Agent/Skill Validation (if performed)
Total references: {total_refs}

✅ COMPLIANT ({compliant_count})
  ✓ {agent_1} - Documents FABER Response Format
  ✓ {agent_2} - Documents FABER Response Format
  ...

⚠️  UNKNOWN ({unknown_count})
  ? {agent_3} - Response format not documented or unclear
  ...

❌ NOT FOUND ({not_found_count})
  ✗ {agent_4} - Agent/skill not found in plugins or user directories
  ...

💡 Agent/Skill Suggestions:
  → Install missing plugins or verify agent/skill names
  → Add response format documentation to unknown agents/skills
  → Reference: plugins/faber/docs/RESPONSE-FORMAT.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{status_message}
```

**Status Messages**:
- Score 100%: "✓ Configuration is complete and valid"
- Score 80-99%: "⚠️  Configuration is mostly complete. Fix warnings to reach 100%"
- Score 50-79%: "⚠️  Configuration needs attention. Fix errors and warnings"
- Score < 50%: "❌ Configuration has critical issues. Fix errors before using"

**Verbose Mode**:
When `--verbose` is enabled, include:
- Full list of all checks performed
- Details about each workflow validated
- Plugin version information
- Configuration file statistics (size, last modified)

### Step 11: Determine Exit Code

**Goal**: Return appropriate exit code for automation

**Logic**:
```
if error_count > 0:
  EXIT 2  # Critical errors present
else if warning_count > 0:
  EXIT 1  # Warnings present
else:
  EXIT 0  # All checks passed
```

## Exit Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 0 | Success | All validations passed (100% or close) |
| 1 | Warnings | Warnings present but no errors (>80% complete) |
| 2 | Errors | Critical errors found (<80% complete) |
| 3 | Not Found | Configuration file not found |
| 4 | Invalid JSON | JSON syntax error in configuration |

## Error Messages

### Configuration File Not Found

```
❌ ERROR: Configuration file not found

Expected location:
  - .fractary/config.yaml (with faber: section)

Recovery:
1. Initialize FABER configuration: /fractary-faber:configure
2. Or specify custom path: /fractary-faber:workflow-inspect --config-path <path>
```

### Invalid JSON Syntax

```
❌ ERROR: Invalid JSON syntax in configuration file

File: .fractary/faber/config.json
Error: Unexpected token '}' at position 1234
Line: 42

Recovery:
1. Check for syntax errors (missing commas, quotes, brackets)
2. Validate JSON with: cat config.json | jq .
3. Restore from backup if available: .fractary/faber/config.json.backup
```

### Critical Validation Errors

```
❌ ERRORS (3)
  ✗ [default] Missing phase: build
  ✗ [default] Invalid autonomy level: super-autonomous
  ✗ Duplicate workflow ID: default

These errors must be fixed before running workflows.

Recovery:
1. Add missing build phase definition
2. Use valid autonomy level: dry-run, assist, guarded, or autonomous
3. Ensure workflow IDs are unique
```

## Use Cases

### CI/CD Integration

Validate configuration in CI pipeline:
```bash
/fractary-faber:workflow-inspect
if [ $? -eq 0 ]; then
  echo "Configuration valid"
else
  echo "Configuration validation failed"
  exit 1
fi
```

### Pre-Commit Hook

Validate before committing config changes:
```bash
# .git/hooks/pre-commit
if git diff --cached --name-only | grep -q "faber/config.json"; then
  /fractary-faber:workflow-inspect --check all
fi
```

### Troubleshooting

Debug configuration issues:
```bash
/fractary-faber:workflow-inspect --verbose --check phases
```

### Configuration Migration

Validate after upgrading FABER version:
```bash
/fractary-faber:workflow-inspect --fix
```

## Performance Considerations

- **File I/O**: Single read of config file, write only if --fix mode
- **Plugin checks**: Optional, can be disabled with --check parameter
- **Caching**: Consider caching validation results for 5 minutes
- **Large configs**: Efficiently handle configs with 10+ workflows

## Related Documentation

- **Commands**:
  - `commands/init.md` - Initialize configuration
  - `commands/run-inspect.md` - Check workflow run status
- **Configuration**:
  - `config/workflows/core.json` - Example workflow configuration
  - `docs/CONFIGURATION.md` - Configuration guide
- **Schema**:
  - `config/schema/workflow.schema.json` - Workflow schema definition
