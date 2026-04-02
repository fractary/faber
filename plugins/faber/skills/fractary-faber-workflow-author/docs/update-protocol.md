# Workflow Update Protocol

Step-by-step protocol for updating an existing FABER workflow definition.

## Steps

### 1. Parse Arguments

Extract from args:
- `workflow_name` (positional, required)
- `--context` (optional context string)

### 2. Load Existing Workflow

1. Resolve path: `.fractary/faber/workflows/{workflow_name}.json`
2. **SECURITY**: Validate that the resolved path stays within the project root directory. Reject any path traversal attempts (e.g., `../../etc/passwd`)
3. Read and parse the JSON file
4. If file not found, return an error with available workflow names

### 3. Display Current Configuration

Show the user a summary of the loaded workflow:
- **ID**: workflow identifier
- **Autonomy**: level and approval requirements
- **Phases**: list each phase with its step count
  - Example: `frame (3 steps) | architect (2 steps) | build (5 steps) | evaluate (3 steps) | release (2 steps)`

### 4. Ask Update Type

Use AskUserQuestion to present update options (multi-select):
- **Add steps** - append new steps to existing phases
- **Modify steps** - edit, remove, or reorder existing steps
- **Change autonomy** - update autonomy level or approval requirements
- **Restructure phases** - enable/disable phases or change phase configuration

### 5. Ask Which Phases to Modify

For step-related updates (add, modify), ask the user which phases they want to change.

### 6. Execute Updates by Type

**Add steps**:
1. Generate new steps for the selected phases
2. Append to existing phase steps arrays
3. Skip any step whose ID already exists (report skipped IDs)

**Change autonomy**:
1. Ask for new autonomy level (autonomous, guarded, supervised, manual)
2. Ask for updated `require_approval_for` list
3. Apply changes to the autonomy object

**Restructure phases**:
1. Ask which phases should be enabled/disabled
2. Update the `enabled` field on each phase
3. Preserve existing steps in disabled phases

**Modify steps**:
1. List all existing steps in the selected phases (ID + name)
2. Ask the user for each step: keep, remove, or reorder
3. Apply removals and reordering

### 7. Validate Updated Workflow

Run the same validation as create-protocol Step 9:
1. Required fields present: `id`, `phases`
2. `extends` references a valid parent workflow
3. Phase structure is correct
4. Autonomy defaults are sensible
5. Step ID uniqueness across all phases
6. Step ID conflict check against parent workflow
7. Schema validation

### 8. Preview and Write

1. Display a diff-style preview of changes via AskUserQuestion
2. Show what was added, removed, or modified
3. Wait for user confirmation
4. On confirm: write back to the original path (`.fractary/faber/workflows/{workflow_name}.json`)
5. On reject: discard changes, optionally return to Step 4
