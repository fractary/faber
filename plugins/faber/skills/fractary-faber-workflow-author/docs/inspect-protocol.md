# Workflow Inspection / Validation Protocol

Step-by-step protocol for inspecting and validating FABER workflow definitions.

## Steps

### 1. Parse Arguments

Extract from args:
- Target (positional, optional): workflow name, file path, or config reference
- `--verbose` - show detailed validation output
- `--fix` - auto-fix simple issues where possible
- `--check` - scope of checks: `phases`, `hooks`, `integrations`, or `all` (default: `all`)

### 2. Resolve Target

Determine which workflow(s) to validate:
- **No target provided**: validate all workflows referenced in the project config
- **`.json` file path**: load the workflow directly from that path
- **Name string**: find in `.fractary/faber/workflows/{name}.json`

If the target cannot be resolved, report an error and exit.

### 3. Validate Required Fields

Check for mandatory fields:
- `id` - must be present (ERROR if missing)
- `phases` - must be present and be an object (ERROR if missing)

### 4. Validate Extends

Check the `extends` field:
- If missing: emit a WARNING (most workflows should extend a parent)
- If present: verify the referenced parent workflow exists and is loadable

### 5. Validate Phases

For each phase in the workflow:
- Check that the `enabled` field has a sensible default (true if omitted)
- Verify each expected phase exists: `frame`, `architect`, `build`, `evaluate`, `release`
- Missing expected phases: emit INFO (not all workflows need every phase)

### 6. Validate Autonomy

Check the `autonomy` configuration:
- If missing entirely: apply defaults and emit INFO
  - Default `level`: `guarded`
  - Default `require_approval_for`: `["release"]`
- If present: validate `level` is one of: `autonomous`, `guarded`, `supervised`, `manual`

### 7. Validate Step IDs

Check step ID uniqueness:
- Collect all step IDs across all phases in this workflow
- ERROR if any duplicate IDs found within the workflow
- If the workflow extends a parent: load parent and check for ID conflicts between child and parent steps

### 8. Validate Step Structure

For each step in every phase:
- `id` field: REQUIRED (ERROR if missing)
- `name` field: RECOMMENDED (WARNING if missing)
- Additional fields checked but not required

### 9. Schema Validation

If the schema file exists at `plugins/faber/config/workflow.schema.json`:
- Validate the entire workflow JSON against the schema
- Report schema violations as ERRORs

If the schema file is not available, skip this step and emit INFO.

### 10. Completeness Scoring

Calculate a completeness score from 0-100%:

| Category | Points | Criteria |
|---|---|---|
| Required fields | 30 | `id`, `phases`, and other mandatory fields present |
| Phase coverage | 25 | All five standard phases defined and configured |
| Step quality | 20 | Steps have `id`, `name`, `description`; meaningful content |
| Autonomy config | 15 | Autonomy level set, approval list defined |
| Schema compliance | 10 | Passes full schema validation |

### 11. Generate Report

Compile findings into a structured report with four severity levels:
- **ERRORS** (must fix): missing required fields, duplicate IDs, schema violations
- **WARNINGS** (should fix): missing recommended fields, no extends, unusual config
- **INFO** (informational): skipped checks, applied defaults, missing optional phases
- **Completeness score**: X/100% with breakdown by category

If `--fix` flag is set:
- Auto-fix simple issues (add missing defaults, set enabled fields, add missing autonomy defaults)
- Report what was fixed
- Write corrected workflow back to file

### 12. Exit Codes

- `0` - workflow is valid (may have warnings/info)
- `1` - errors found (workflow has problems that must be addressed)
