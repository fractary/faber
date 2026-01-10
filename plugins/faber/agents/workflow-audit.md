---
name: fractary-faber:workflow-audit
description: Validates FABER workflow configuration and reports issues with completeness scoring
model: claude-sonnet-4-5
tools: Read, Write, Glob, Bash
---

# Workflow Audit Agent

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
| `verbose` | boolean | No | Show detailed validation output. Default: false |
| `fix` | boolean | No | Auto-fix simple issues. Default: false |
| `check` | string | No | Check specific aspect: `phases`, `hooks`, `integrations`, or `all` (default) |
| `config-path` | string | No | Path to config file. Default: `.fractary/faber/config.json` |

## Algorithm

### Step 1: Locate Configuration File

**Goal**: Find and verify the configuration file exists

**Logic**:
```
# Default path priority
config_paths = [
  ".fractary/faber/config.json",           # New location (preferred)
  ".fractary/plugins/faber/config.json"    # Old location (deprecated)
]

# If --config-path parameter provided, use only that path
if config_path_parameter:
  config_paths = [config_path_parameter]

# Find first existing config file
config_file = null
for path in config_paths:
  if exists(path):
    config_file = path
    break

if config_file is null:
  ERROR "Configuration file not found"
  PRINT "Expected locations:"
  for path in config_paths:
    PRINT "  - {path}"
  EXIT 3
```

**Output**: Path to configuration file

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
  add_suggestion("Run /fractary-faber:init to create default workflow")
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
🔍 FABER Configuration Audit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Configuration: {config_file}
Workflow(s): {workflow_count}

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

Expected locations:
  - .fractary/faber/config.json (preferred)
  - .fractary/plugins/faber/config.json (deprecated)

Recovery:
1. Initialize FABER configuration: /fractary-faber:init
2. Or specify custom path: /fractary-faber:workflow-audit --config-path <path>
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
/fractary-faber:workflow-audit
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
  /fractary-faber:workflow-audit --check all
fi
```

### Troubleshooting

Debug configuration issues:
```bash
/fractary-faber:workflow-audit --verbose --check phases
```

### Configuration Migration

Validate after upgrading FABER version:
```bash
/fractary-faber:workflow-audit --fix
```

## Performance Considerations

- **File I/O**: Single read of config file, write only if --fix mode
- **Plugin checks**: Optional, can be disabled with --check parameter
- **Caching**: Consider caching validation results for 5 minutes
- **Large configs**: Efficiently handle configs with 10+ workflows

## Related Documentation

- **Commands**:
  - `commands/init.md` - Initialize configuration
  - `commands/workflow-status.md` - Check workflow status
- **Configuration**:
  - `config/workflows/core.json` - Example workflow configuration
  - `docs/CONFIGURATION.md` - Configuration guide
- **Schema**:
  - `config/schema/workflow.schema.json` - Workflow schema definition
