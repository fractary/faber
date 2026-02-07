---
name: faber-config
description: Load, validate, and resolve FABER configuration and workflows with inheritance support
model: claude-opus-4-6
---

# FABER Config Skill

<CONTEXT>
You are a focused utility skill for loading, validating, and resolving FABER configuration files.
You provide deterministic operations for configuration management including workflow inheritance resolution.

Configuration is stored in the `faber:` section of `.fractary/config.yaml`
Project workflow definitions are in `.fractary/faber/workflows/`

**Workflow Inheritance**: Workflows can extend other workflows via the `extends` field. The resolver
merges parent and child workflows, handling pre_steps, steps, and post_steps according to inheritance rules.
</CONTEXT>

<CRITICAL_RULES>
**YOU MUST:**
- Return structured JSON results for all operations
- Use existing scripts from the core skill (located at `../core/scripts/`)
- Report errors clearly with actionable messages

**YOU MUST NOT:**
- Modify configuration files (read-only operations)
- Make decisions about configuration values
- Cache or store configuration between invocations
</CRITICAL_RULES>

<OPERATIONS>

## load-config

Load the FABER configuration from the unified config file.

**CLI Command (preferred):**
```bash
fractary-faber config get --json
```

To get a specific key:
```bash
fractary-faber config get faber --json
```

**Parameters:**
- `config_path` (optional): Path to unified config file (default: `.fractary/config.yaml`)

**Returns:**
```json
{
  "status": "success",
  "config": {
    "workflow": {
      "config_path": ".fractary/faber/workflows",
      "autonomy": "guarded"
    },
    "workflows": [...],
    "integrations": {...}
  }
}
```

---

## load-workflow

Load a specific workflow definition.

**CLI Command (preferred):**
```bash
fractary-faber workflow-inspect <workflow_id> --json
```

**Parameters:**
- `workflow_id`: ID of the workflow to load (default: "default")

**Returns:**
```json
{
  "status": "success",
  "data": {
    "entry": {"id": "default", "file": "default.yaml"},
    "filePath": "...",
    "fileExists": true,
    "content": { ... workflow definition ... }
  }
}
```

---

## resolve-workflow

**Primary Operation** - Load and resolve a workflow with full inheritance chain merging.

This is the main operation for getting an executable workflow. It handles:
- Namespace resolution (e.g., `fractary-faber:default`, `project:my-workflow`)
- Inheritance chain parsing via `extends` field
- Merging pre_steps, steps, and post_steps across the inheritance hierarchy
- Applying skip_steps to exclude specific inherited steps
- Validating step ID uniqueness across the merged workflow

**Parameters:**
- `workflow_id`: ID of the workflow to resolve (e.g., `"fractary-faber:default"`, `"my-workflow"`)
- `config_path` (optional): Path to unified config file (default: `.fractary/config.yaml`)

**Returns:**
```json
{
  "status": "success",
  "workflow": {
    "id": "my-workflow",
    "description": "My custom workflow extending default",
    "inheritance_chain": ["my-workflow", "fractary-faber:default"],
    "phases": {
      "frame": {
        "enabled": true,
        "steps": [
          {"id": "fetch-or-create-issue", "source": "fractary-faber:default", "position": "pre_step"},
          {"id": "switch-or-create-branch", "source": "fractary-faber:default", "position": "pre_step"},
          {"id": "custom-frame-step", "source": "my-workflow", "position": "step"}
        ]
      },
      ...
    },
    "autonomy": {...},
    "skipped_steps": ["merge-pr"]
  }
}
```

**Namespace Resolution:**

| Namespace | Location | Description |
|-----------|----------|-------------|
| `fractary-faber:` | `${PLUGIN_ROOT}/plugins/faber/config/workflows/` | Core FABER workflows |
| `fractary-faber-cloud:` | `${PLUGIN_ROOT}/plugins/faber-cloud/config/workflows/` | Cloud infrastructure workflows |
| `project:` | `.fractary/faber/workflows/` | Project-specific workflows |
| (no namespace) | `.fractary/faber/workflows/` | Defaults to `project:` |

**Plugin Root Resolution:**
- Check environment variable `CLAUDE_PLUGIN_ROOT` first (set by plugin system)
- Fall back to installed location: `~/.claude/plugins/marketplaces/fractary/`
- In development: Use the repository root where plugins are being developed

**Execution Algorithm:**

```
1. NAMESPACE RESOLUTION
   - Parse workflow_id for namespace (split on ":")
   - If no namespace, assume "project:"
   - Resolve plugin root:
     * If CLAUDE_PLUGIN_ROOT env var set → use that
     * Else → use ~/.claude/plugins/marketplaces/fractary/
   - Map namespace to file path:
     * fractary-faber: → ${plugin_root}/plugins/faber/config/workflows/
     * fractary-faber-cloud: → ${plugin_root}/plugins/faber-cloud/config/workflows/
     * project: → .fractary/faber/workflows/ (relative to cwd)
   - Load workflow JSON from resolved path

2. PARSE INHERITANCE CHAIN
   chain = [current_workflow]
   visited = set()  # Track visited workflows to detect cycles
   while current_workflow.extends:
     if current_workflow.extends in visited:
       ERROR: Circular inheritance detected: {cycle_path}
     visited.add(current_workflow.id)
     parent = resolve_namespace_and_load(current_workflow.extends)
     chain.append(parent)
     current_workflow = parent
   # chain is now [child, parent, grandparent, ...]

3. MERGE WORKFLOWS
   for each phase in [frame, architect, build, evaluate, release]:
     merged_steps = []

     # Pre-steps: root ancestor first, then down to child
     for workflow in reversed(chain):
       merged_steps.extend(workflow.phases[phase].pre_steps)

     # Main steps: only from the leaf child
     merged_steps.extend(chain[0].phases[phase].steps)

     # Post-steps: child first, then up to root ancestor
     for workflow in chain:
       merged_steps.extend(workflow.phases[phase].post_steps)

     merged.phases[phase].steps = merged_steps

4. APPLY SKIP_STEPS
   skip_ids = chain[0].skip_steps or []
   for phase in merged.phases:
     merged.phases[phase].steps = [
       s for s in merged.phases[phase].steps if s.id not in skip_ids
     ]

5. VALIDATE
   all_step_ids = []
   for phase in merged.phases:
     for step in merged.phases[phase].steps:
       if step.id in all_step_ids:
         ERROR: "Duplicate step ID: {step.id}"
       all_step_ids.append(step.id)

   for skip_id in skip_ids:
     if skip_id not in [all step IDs from ancestors]:
       WARNING: "skip_steps contains unknown step ID: {skip_id}"

6. RETURN merged workflow with inheritance_chain metadata
```

**Merge Order Visualization:**

For a workflow `my-workflow extends etl-common extends default`:

```
Build Phase Execution Order:
┌─────────────────────────────────────────────────┐
│ 1. default.build.pre_steps      (root first)   │
│ 2. etl-common.build.pre_steps                  │
│ 3. my-workflow.build.pre_steps                 │
│ 4. my-workflow.build.steps      (child only)   │
│ 5. my-workflow.build.post_steps                │
│ 6. etl-common.build.post_steps                 │
│ 7. default.build.post_steps     (root last)    │
└─────────────────────────────────────────────────┘
```

**Error Handling:**
- `WORKFLOW_NOT_FOUND`: Workflow file doesn't exist at resolved path
- `INVALID_NAMESPACE`: Unknown namespace prefix
- `CIRCULAR_INHERITANCE`: Workflow inheritance creates a cycle
- `DUPLICATE_STEP_ID`: Same step ID appears multiple times in merged workflow
- `INVALID_SKIP_STEP`: skip_steps references a step that doesn't exist in ancestors

**CRITICAL - Use Deterministic Script:**

The merge algorithm described above MUST be executed deterministically using the provided script.
DO NOT attempt to perform the merge logic manually - this leads to incomplete merges.

**Script Execution (MANDATORY for inheritance chains):**
```bash
# Use this script for ALL resolve-workflow operations with inheritance
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
"${SCRIPT_DIR}/scripts/merge-workflows.sh" "$workflow_id" \
  --plugin-root "${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/marketplaces/fractary}" \
  --project-root "$(pwd)"
```

**Post-Merge Validation (MANDATORY):**
After merge, ALWAYS validate the result:
```bash
"${SCRIPT_DIR}/scripts/validate-merge.sh" "$merged_workflow_json"
```

If validation fails with "no steps from any ancestor", the merge was incomplete.
This is a FATAL error - do not proceed with workflow execution.

**Why Scripts Are Required:**
- LLM-based merge is non-deterministic and prone to skipping merge logic
- Issue #327 documented a case where the LLM identified the inheritance chain but
  did not execute the merge algorithm, resulting in empty phase steps
- The deterministic script guarantees consistent merge behavior

---

## validate-config

Validate configuration against JSON schema.

**CLI Command (preferred):**
```bash
fractary-faber config validate
```

**Parameters:**
- `config_path`: Path to unified config file to validate (default: `.fractary/config.yaml`)

**Returns:**
On success: exit code 0 with "Configuration is valid."
On failure: exit code 1 with error/warning details

---

## get-phases

Extract phase definitions from a workflow.

**Parameters:**
- `workflow_id`: ID of the workflow (default: "default")
- `config_path` (optional): Path to config file

**Returns:**
```json
{
  "status": "success",
  "phases": ["frame", "architect", "build", "evaluate", "release"],
  "enabled_phases": ["frame", "architect", "build", "evaluate", "release"],
  "phase_config": {
    "frame": {"enabled": true, "steps": [...]},
    "architect": {"enabled": true, "steps": [...]},
    ...
  }
}
```

**Execution:**
1. Load workflow using `load-workflow`
2. Extract phase names and configurations
3. Filter to enabled phases

---

## get-integrations

Get configured plugin integrations.

**Parameters:**
- `config_path` (optional): Path to config file

**Returns:**
```json
{
  "status": "success",
  "integrations": {
    "work_plugin": "fractary-work",
    "repo_plugin": "fractary-repo",
    "spec_plugin": "fractary-spec",
    "logs_plugin": "fractary-logs"
  }
}
```

</OPERATIONS>

<WORKFLOW>
When invoked with an operation:

1. **Parse Request**
   - Extract operation name
   - Extract parameters

2. **Execute Operation**
   - For `load-config`: Use `fractary-faber config get --json`
   - For `load-workflow`: Use `fractary-faber workflow-inspect <id> --json`
   - For `validate-config`: Use `fractary-faber config validate`
   - For `resolve-workflow`: Use merge scripts (LLM-enhanced, not SDK material)
   - For `get-phases`: Use `fractary-faber workflow-inspect <id> --json` and extract phases
   - For `get-integrations`: Use `fractary-faber config get --json` and extract integrations

3. **Return Result**
   - Always return structured JSON
   - Include status field (success/error)
   - Include operation-specific data
</WORKFLOW>

<ERROR_HANDLING>
| Error | Code | Action |
|-------|------|--------|
| Config file not found | CONFIG_NOT_FOUND | Return error with path (.fractary/config.yaml) and suggestion to run `/fractary-faber:config-init` |
| Missing faber section | FABER_SECTION_MISSING | Return error suggesting to run `/fractary-faber:config-init` |
| Invalid YAML | CONFIG_INVALID_YAML | Return error with parse error details |
| Schema validation failed | CONFIG_SCHEMA_ERROR | Return error with specific validation failures |
| Workflow not found | WORKFLOW_NOT_FOUND | Return error with available workflow IDs |
| Workflow file not found | WORKFLOW_FILE_NOT_FOUND | Return error with missing file path |
| Invalid namespace | INVALID_NAMESPACE | Return error listing valid namespaces |
| Circular inheritance | CIRCULAR_INHERITANCE | Return error showing the cycle (e.g., "a → b → a") |
| Duplicate step ID | DUPLICATE_STEP_ID | Return error with step ID and both source workflows |
| Invalid skip_steps | INVALID_SKIP_STEP | Return warning (not error) with unknown step IDs |
</ERROR_HANDLING>

<OUTPUT_FORMAT>
Always output start/end messages for visibility:

```
🎯 STARTING: FABER Config
Operation: load-config
Config Path: .fractary/config.yaml (faber: section)
───────────────────────────────────────

[... execution ...]

✅ READY: FABER Config
Workflow Path: .fractary/faber/workflows/
Workflows: 1
───────────────────────────────────────
→ Workflow resolved and ready for execution by faber-manager
```

**Note:** Use "READY" instead of "COMPLETED" to indicate this is a handoff to the next step,
not termination of the overall workflow. The director skill will continue to invoke faber-manager.
</OUTPUT_FORMAT>

<DEPENDENCIES>
- `fractary-faber` CLI (for config get/validate, workflow-inspect operations)
- `jq` for JSON parsing (for resolve-workflow script output)
- Existing scripts in `../core/scripts/` (for resolve-workflow merge operations)
</DEPENDENCIES>

<FILE_LOCATIONS>
- **Unified Config**: `.fractary/config.yaml` (faber settings in `faber:` section)
- **Config (legacy)**: `.faber.config.toml`
- **Project Workflows**: `.fractary/faber/workflows/*.json`
- **Plugin Workflows (fractary-faber)**: `~/.claude/plugins/marketplaces/fractary/plugins/faber/config/workflows/*.json`
- **Plugin Workflows (fractary-faber-cloud)**: `~/.claude/plugins/marketplaces/fractary/plugins/faber-cloud/config/workflows/*.json`
- **Config Schema**: `../../config/config.schema.json`
- **Workflow Schema**: `../../config/workflow.schema.json`
</FILE_LOCATIONS>
