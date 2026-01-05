# Workflow: Context Reload Protocol

Protocol for reloading critical workflow artifacts on-demand to recover from context loss.

## Overview

**Purpose**: Restore critical workflow context when it has been lost due to context compaction, session boundaries, or environment changes.

**When to Execute**:
- User runs `/fractary-faber:prime-context` (manual trigger)
- Workflow pre_step executes automatic reload (session_start trigger)
- Phase transition requires specific artifacts (phase_transition trigger)
- Context compaction detected (future: compaction_detected trigger)

**Design Philosophy**: Configurable per-workflow. Each workflow declares which artifacts are critical and when they should be reloaded.

**Relationship to Context Reconstitution**: This protocol EXTENDS the existing context-reconstitution protocol (step 0) with configurable, repeatable artifact reloading throughout workflow execution.

## Integration with Context Reconstitution

```
┌──────────────────────────────────────────────────────┐
│  Context Reconstitution Protocol (Step 0)            │
│  - Runs ONCE at workflow start/resume                │
│  - Loads: state, spec, issue, branch info            │
│  - Fixed set of artifacts                            │
│  - Defined in context-reconstitution.md              │
└──────────────────────────────────────────────────────┘
                         │
                         ↓
┌──────────────────────────────────────────────────────┐
│  Context Reload Protocol (This Document)             │
│  - Runs ON DEMAND during workflow execution          │
│  - Loads: configurable per-workflow artifacts        │
│  - Dynamic artifact selection based on triggers      │
│  - Tracks what was loaded and when                   │
└──────────────────────────────────────────────────────┘
```

**When to use each**:
- **Reconstitution**: Workflow start, resume, or re-run (automatic, always happens)
- **Reload**: Context loss detected, phase transition, session start, manual request (on-demand, configurable)

## Protocol Steps

Execute these steps IN ORDER when context reload is triggered:

### Step 1: Detect Target Workflow

```bash
# If run_id provided explicitly
IF run_id is provided THEN
  target_run_id = run_id
ELSE
  # Auto-detect active workflow
  active_runs = find_active_runs()

  IF active_runs.length == 0 THEN
    ERROR: "No active workflow found"
    SUGGEST: "Use /fractary-faber:run to start a new workflow"
    SUGGEST: "Or specify run ID: /fractary-faber:prime-context --run-id {id}"
    EXIT 1

  ELSE IF active_runs.length == 1 THEN
    target_run_id = active_runs[0].run_id
    LOG "✓ Auto-detected active workflow: ${target_run_id}"

  ELSE IF active_runs.length > 1 THEN
    # Multiple active workflows - prompt user to select
    PROMPT_USER: "Multiple active workflows found. Please select:"
    for i, run in enumerate(active_runs):
      DISPLAY: "${i+1}. ${run.run_id} (${run.current_phase} phase, started ${run.started_at})"

    selection = GET_USER_INPUT()
    target_run_id = active_runs[selection - 1].run_id
```

**find_active_runs() Implementation**:
```bash
function find_active_runs():
  runs = []
  for state_file in glob(".fractary/runs/*/state.json"):
    state = read(state_file)
    if state.status in ["in_progress", "paused", "awaiting_feedback"]:
      runs.append({
        run_id: extract_run_id(state_file),
        current_phase: state.current_phase,
        started_at: state.started_at,
        status: state.status
      })
  return runs
```

### Step 2: Load State and Workflow Config

```bash
# Read run state
RUN_DIR = ".fractary/runs/${target_run_id}"
STATE_FILE = "${RUN_DIR}/state.json"

# Validate run exists
IF not file_exists(STATE_FILE) THEN
  ERROR: "Run not found: ${target_run_id}"
  ERROR: "Path: ${STATE_FILE}"
  SUGGEST: "Check available runs: ls .fractary/runs/"
  EXIT 1

# Load and validate state
state = read(STATE_FILE)

IF not is_valid_json(state) THEN
  ERROR: "Cannot read state file - invalid JSON"
  ERROR: "Path: ${STATE_FILE}"
  SUGGEST: "Check backup: ${RUN_DIR}/state.backup.json"
  SUGGEST: "Restore from backup if available"
  EXIT 1

# Validate required fields
IF not state.has("run_id") OR not state.has("workflow_id") THEN
  ERROR: "State file missing required fields (run_id, workflow_id)"
  EXIT 1

# Extract workflow identifier
workflow_id = state.workflow_id

# Load workflow configuration
IF workflow_id.startsWith("fractary-faber:") THEN
  # Built-in workflow
  workflow_name = workflow_id.split(":")[1]
  config_path = "plugins/faber/config/workflows/${workflow_name}.json"
ELSE
  # Custom workflow
  config_path = ".fractary/plugins/faber/workflows/${workflow_id}.json"

workflow_config = read(config_path)

IF workflow_config is null THEN
  ERROR: "Workflow configuration not found: ${workflow_id}"
  ERROR: "Path: ${config_path}"
  EXIT 1

# Extract critical artifacts configuration
critical_artifacts = workflow_config.critical_artifacts
IF critical_artifacts is null THEN
  # No artifacts configured - use defaults
  critical_artifacts = get_default_artifacts()

LOG "✓ Loaded workflow config: ${workflow_id}"
LOG "  Run status: ${state.status}"
LOG "  Current phase: ${state.current_phase}"
```

### Step 3: Determine Artifacts to Load

```bash
artifacts_to_load = []
current_phase = state.current_phase
load_trigger = determine_trigger()  # "session_start", "manual", "phase_transition", etc.

# 3.1: Always load artifacts
for artifact in critical_artifacts.always_load:
  if should_load_artifact(artifact, load_trigger):
    artifacts_to_load.append(artifact)

# 3.2: Conditional load artifacts
for artifact in critical_artifacts.conditional_load:
  # Evaluate condition using safe expression parser
  if evaluate_condition(artifact.condition, state):
    if should_load_artifact(artifact, load_trigger):
      artifacts_to_load.append(artifact)

# 3.3: Phase-specific artifacts
if critical_artifacts.phase_specific[current_phase]:
  for artifact in critical_artifacts.phase_specific[current_phase]:
    if should_load_artifact(artifact, load_trigger):
      artifacts_to_load.append(artifact)

# 3.4: Filter by --artifacts parameter if specified
if artifacts_parameter is not null:
  requested_ids = artifacts_parameter.split(",")
  artifacts_to_load = filter(artifacts_to_load, artifact.id in requested_ids)

LOG "Determined ${artifacts_to_load.length} artifacts to load"
```

**should_load_artifact() Implementation**:
```bash
function should_load_artifact(artifact, load_trigger):
  # Check if this artifact should be loaded for this trigger
  if load_trigger not in artifact.reload_triggers:
    return false

  # Check if artifact was recently loaded (unless force mode)
  if not force_mode:
    last_load = get_last_load_time(artifact.id, state)
    if last_load is not null:
      minutes_since_load = (now() - last_load).minutes
      if minutes_since_load < 5:
        LOG "ℹ Skipping ${artifact.id} - loaded ${minutes_since_load} minutes ago"
        return false

  return true
```

**evaluate_condition() Implementation**:
```bash
function evaluate_condition(condition_expr, state):
  # Parse condition expression safely without executing arbitrary code
  # Supported expressions:
  #   "state.artifacts.spec_path != null"
  #   "state.current_phase === 'build'"
  #   "state.work_id != null && state.status === 'in_progress'"

  # Implementation uses safe pattern matching and field lookups
  # rather than executing code dynamically

  # Handle null checks
  if condition_expr.contains("!= null"):
    field_path = extract_field_path(condition_expr)
    return get_nested_field(state, field_path) != null

  # Handle equality checks
  if condition_expr.contains("===") or condition_expr.contains("=="):
    [field_path, expected_value] = parse_equality(condition_expr)
    actual_value = get_nested_field(state, field_path)
    return actual_value == expected_value

  # Handle inequality checks
  if condition_expr.contains("!==") or condition_expr.contains("!="):
    [field_path, expected_value] = parse_inequality(condition_expr)
    actual_value = get_nested_field(state, field_path)
    return actual_value != expected_value

  # Handle logical AND
  if condition_expr.contains("&&"):
    parts = condition_expr.split("&&")
    return evaluate_condition(parts[0].trim(), state) AND
           evaluate_condition(parts[1].trim(), state)

  # Handle logical OR
  if condition_expr.contains("||"):
    parts = condition_expr.split("||")
    return evaluate_condition(parts[0].trim(), state) OR
           evaluate_condition(parts[1].trim(), state)

  # Unknown expression format
  WARN: "Cannot evaluate condition: ${condition_expr}"
  return false
```

### Step 4: Check Reload Status (Dry-Run Mode)

```bash
if dry_run_mode:
  LOG "Would reload context for run: ${target_run_id}"
  LOG "Workflow: ${workflow_id}"
  LOG "Run status: ${state.status}"
  LOG ""
  LOG "Artifacts that would be loaded:"
  LOG ""

  total_size = 0
  loadable_count = 0
  skipped_count = 0

  for artifact in artifacts_to_load:
    # Resolve path
    resolved_path = resolve_path(artifact, state)

    # Check existence
    exists = file_exists(resolved_path)
    size = exists ? file_size(resolved_path) : 0
    size_kb = (size / 1024).round(1)

    # Check if would be loaded or skipped
    last_load = get_last_load_time(artifact.id, state)
    would_load = last_load is null OR force_mode

    LOG "  ${would_load ? '✓' : '⊘'} ${artifact.id}"
    LOG "    Type: ${artifact.type}"
    LOG "    Path: ${artifact.path or artifact.path_from_state}"
    if artifact.path_from_state:
      LOG "    Resolved: ${resolved_path}"
    LOG "    Required: ${artifact.required ? 'yes' : 'no'}"
    LOG "    Exists: ${exists ? 'yes' : 'no'}"
    if exists:
      LOG "    Size: ${size_kb} KB"
    if last_load:
      minutes_ago = (now() - last_load).minutes
      LOG "    Last loaded: ${minutes_ago} minutes ago"
    else:
      LOG "    Last loaded: never"
    LOG "    Action: ${would_load ? 'LOAD' : 'SKIP (recently loaded)'}"
    LOG ""

    if would_load && exists:
      loadable_count += 1
      total_size += size
    else:
      skipped_count += 1

  total_size_kb = (total_size / 1024).round(1)
  LOG "Total: ${artifacts_to_load.length} artifacts (${loadable_count} would be loaded, ${skipped_count} skipped)"
  LOG "Estimated context size: ${total_size_kb} KB"

  EXIT 0  # Dry-run complete
```

### Step 5: Load Each Artifact

```bash
loaded_artifacts = []
failed_artifacts = []

for artifact in artifacts_to_load:
  LOG "Loading ${artifact.id}..."

  try:
    # Resolve path/command based on artifact type
    resolved_source = resolve_artifact_source(artifact, state)

    # Load based on artifact type
    loaded_data = load_artifact_by_type(artifact, resolved_source, state)

    # Track successful load
    loaded_artifacts.append({
      artifact_id: artifact.id,
      loaded_at: now(),
      load_trigger: load_trigger,
      source: resolved_source,
      size_bytes: calculate_size(loaded_data)
    })

    LOG "✓ ${artifact.id} - ${artifact.description}"
    LOG "  Source: ${resolved_source}"
    LOG "  Size: ${(calculate_size(loaded_data) / 1024).round(1)} KB"

  catch error:
    failed_artifacts.append({
      artifact_id: artifact.id,
      error: error.message,
      required: artifact.required
    })

    if artifact.required:
      # Required artifact failed - stop execution
      ERROR: "Required artifact not found"
      ERROR: "Artifact: ${artifact.id}"
      ERROR: "Source: ${resolved_source}"
      ERROR: "Error: ${error.message}"
      ERROR: ""
      ERROR: "Recovery:"
      ERROR: "1. Check if path is correct in workflow config"
      ERROR: "2. Check if artifact was created in earlier phase"
      ERROR: "3. Run the phase that creates this artifact"
      EXIT 1

    else:
      # Optional artifact failed - continue with warning
      WARN: "Optional artifact not found"
      WARN: "Artifact: ${artifact.id}"
      WARN: "Source: ${resolved_source}"
      WARN: ""
      WARN: "Workflow will continue without this artifact."
```

**load_artifact_by_type() Implementation**:
```bash
function load_artifact_by_type(artifact, source, state):
  switch artifact.type:
    case "json":
      return read_file(source)

    case "markdown":
      return read_file(source)

    case "directory":
      if artifact.load_strategy == "latest_only":
        # Load only most recent file
        files = list_files(source, sort_by="mtime", reverse=true)
        return read_file(files[0])

      else if artifact.load_strategy == "summary":
        # Load summary instead of all files
        files = list_files(source)
        summary = "Directory: ${source}\n"
        summary += "Files: ${files.length}\n"
        summary += "Latest: ${files[0].name} (${files[0].mtime})\n"
        return summary

      else:
        # Load all files (default)
        files = list_files(source)
        content = ""
        for file in files:
          content += "=== ${file.name} ===\n"
          content += read_file(file.path)
          content += "\n\n"
        return content

    case "work_plugin":
      # Execute work plugin command
      command = artifact.command.replace("{work_id}", state.work_id)
      return invoke_skill(command)

    case "skill":
      # Execute skill command
      command = artifact.command
      return invoke_skill(command)

    case "git_info":
      # Execute git command
      command = artifact.command
      return bash(command)

    default:
      throw "Unknown artifact type: ${artifact.type}"
```

**resolve_artifact_source() Implementation**:
```bash
function resolve_artifact_source(artifact, state):
  if artifact.path:
    # Static path with placeholders
    return resolve_path_placeholders(artifact.path, state)

  else if artifact.path_from_state:
    # Dynamic path from state field
    field_path = artifact.path_from_state
    path = get_nested_field(state, field_path)
    if path is null:
      throw "State field not found: ${field_path}"
    return resolve_path_placeholders(path, state)

  else if artifact.command:
    # Command to execute
    return artifact.command

  else:
    throw "Artifact must have path, path_from_state, or command"
```

**resolve_path_placeholders() Implementation**:
```bash
function resolve_path_placeholders(path, state):
  # Replace placeholders
  path = path.replace("{run_id}", state.run_id)
  path = path.replace("{plan_id}", state.plan_id or "")
  path = path.replace("{work_id}", state.work_id or "")
  path = path.replace("{project_root}", get_git_root())

  # Convert to absolute path if relative
  if not path.startsWith("/"):
    path = join_path(get_git_root(), path)

  return path
```

### Step 6: Update State Metadata

```bash
# Update context metadata
if not state.has("context_metadata"):
  state.context_metadata = {}

state.context_metadata.last_artifact_reload = now()
state.context_metadata.reload_count = (state.context_metadata.reload_count or 0) + 1

# Update artifacts_in_context
if not state.context_metadata.has("artifacts_in_context"):
  state.context_metadata.artifacts_in_context = []

# Remove old entries for artifacts that were just loaded
for loaded in loaded_artifacts:
  remove_from_array(state.context_metadata.artifacts_in_context,
                    item => item.artifact_id == loaded.artifact_id)

# Add new entries
state.context_metadata.artifacts_in_context.extend(loaded_artifacts)

# Update session tracking
if not state.has("sessions"):
  state.sessions = {
    current_session_id: generate_session_id(),
    total_sessions: 1,
    session_history: []
  }

# Check if this is a new session (different from last recorded)
last_session_id = state.sessions.current_session_id
current_session_id = detect_current_session_id()

if current_session_id != last_session_id:
  # New session detected
  LOG "✓ New session detected: ${current_session_id}"

  # End previous session
  if state.sessions.session_history.length > 0:
    last_session = state.sessions.session_history[-1]
    if not last_session.has("ended_at"):
      last_session.ended_at = now()

  # Start new session record
  new_session = {
    session_id: current_session_id,
    started_at: now(),
    phases_completed: [],
    environment: {
      hostname: get_hostname(),
      platform: get_platform(),
      cwd: get_cwd(),
      git_commit: get_current_commit()
    },
    artifacts_loaded: loaded_artifacts.map(a => a.artifact_id)
  }

  state.sessions.session_history.append(new_session)
  state.sessions.current_session_id = current_session_id
  state.sessions.total_sessions = state.sessions.session_history.length

else:
  # Same session - update artifacts loaded
  if state.sessions.session_history.length > 0:
    current_session = state.sessions.session_history[-1]
    for artifact_id in loaded_artifacts.map(a => a.artifact_id):
      if artifact_id not in current_session.artifacts_loaded:
        current_session.artifacts_loaded.append(artifact_id)

# Write updated state back to file
write(STATE_FILE, state)

LOG "✓ Updated state metadata"
```

**Session ID Detection**:
```bash
function detect_current_session_id():
  # Generate unique session identifier
  # Format: claude-session-YYYYMMDD-RANDOM
  timestamp = format_date(now(), "YYYYMMDD")
  random = generate_random_string(6)
  return "claude-session-${timestamp}-${random}"

function generate_session_id():
  return detect_current_session_id()
```

### Step 7: Report Results

```bash
LOG ""
LOG "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
LOG "✓ Context reloaded for run: ${target_run_id}"
LOG "  Workflow: ${workflow_id}"
LOG "  Run status: ${state.status}"
LOG "  Current phase: ${state.current_phase}"
LOG ""

LOG "Artifacts loaded (${loaded_artifacts.length}):"
for loaded in loaded_artifacts:
  size_kb = (loaded.size_bytes / 1024).round(1)
  LOG "  ✓ ${loaded.artifact_id} - ${get_artifact_description(loaded.artifact_id)}"
  LOG "    Source: ${loaded.source}"
  LOG "    Size: ${size_kb} KB"
  LOG ""

if failed_artifacts.length > 0:
  LOG "Artifacts skipped (${failed_artifacts.length}):"
  for failed in failed_artifacts:
    LOG "  ⚠️ ${failed.artifact_id} - ${failed.error}"
  LOG ""

LOG "Session tracking:"
LOG "  Current session: ${state.sessions.current_session_id}"
LOG "  Total sessions: ${state.sessions.total_sessions}"
LOG "  Environment: ${state.sessions.session_history[-1].environment.hostname} (${state.sessions.session_history[-1].environment.platform})"
LOG "  Working directory: ${state.sessions.session_history[-1].environment.cwd}"
LOG ""

LOG "Context metadata:"
LOG "  Last reload: ${state.context_metadata.last_artifact_reload}"
LOG "  Total reloads: ${state.context_metadata.reload_count}"
LOG "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

## Error Handling

### Critical Errors (Stop Execution)

These errors stop the protocol and return non-zero exit code:

1. **No active workflow found** (when auto-detecting)
2. **Run ID not found** (specified run doesn't exist)
3. **State file corrupted** (invalid JSON)
4. **Workflow config not found**
5. **Required artifact not found**
6. **Required artifact failed to load**

### Warnings (Continue Execution)

These issues generate warnings but allow protocol to continue:

1. **Optional artifact not found**
2. **Optional artifact failed to load**
3. **Large artifact detected** (>100KB)
4. **Artifact was recently loaded** (skipped unless force mode)

## Protocol Validation

To ensure correct implementation, validate:

1. **State file updated** - `context_metadata` and `sessions` fields exist and are current
2. **Artifacts tracked** - All loaded artifacts appear in `artifacts_in_context`
3. **Session recorded** - Current session exists in `session_history`
4. **Environment captured** - Session environment metadata is complete
5. **Timestamps accurate** - All timestamps are current (within last minute)

## Performance Considerations

### Optimization Strategies

1. **Skip redundant loads** - Don't reload artifacts loaded within last 5 minutes
2. **Size tracking** - Warn about large artifacts (>100KB), error on huge artifacts (>1MB)
3. **Lazy loading** - Only load conditional artifacts when condition is true
4. **Caching** - Remember which artifacts are already in context
5. **Parallel loading** - Load independent artifacts in parallel (future enhancement)

### Size Limits

- **Warning threshold**: 100 KB per artifact
- **Error threshold**: 1 MB per artifact
- **Total budget awareness**: Track cumulative size of all loaded artifacts

## Integration Points

### Called By

- `/fractary-faber:prime-context` command (manual trigger)
- Workflow pre_steps with `reload_triggers: ["session_start"]` (automatic trigger)
- Phase transition handlers with `reload_triggers: ["phase_transition:X->Y"]` (automatic trigger)

### Calls

- `Read` tool - For JSON and Markdown artifacts
- `Glob` tool - For directory listings
- `Bash` tool - For git commands
- `Skill` tool - For work plugin and custom skills

### Updates

- `.fractary/runs/{run_id}/state.json` - State metadata, session tracking, context metadata

## See Also

- **Context Reconstitution**: `context-reconstitution.md` - Initial context loading at workflow start
- **Command**: `plugins/faber/commands/prime-context.md` - User-facing command interface
- **Skill**: `plugins/faber/skills/context-manager/SKILL.md` - Context manager skill definition
- **Algorithm**: `plugins/faber/skills/context-manager/workflow/prime-context.md` - Detailed implementation
- **Schema**: `plugins/faber/config/workflow.schema.json` - Artifact configuration schema
- **State Schema**: `plugins/faber/config/state.schema.json` - Session and metadata schema
