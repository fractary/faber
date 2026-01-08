# FABER Workflow Templates

This directory contains workflow template files for the FABER plugin. These templates define the complete workflow structure including phases, steps, hooks, and autonomy settings.

## Overview

Workflows are now stored as separate JSON files instead of being embedded in the main `config.json`. This provides:

- **Better maintainability**: Each workflow is in its own file
- **Easier version control**: Fewer merge conflicts
- **Plugin extensibility**: Specialized plugins can provide workflow templates
- **Clearer configuration**: Config file just references workflows

## Available Workflows

### core.json
**Base workflow** that all other workflows inherit from.

- **Phases**: Frame → Architect → Build → Evaluate → Release
- **Use case**: Foundation for all specialized workflows
- **Autonomy**: Guarded (pauses before release)
- **Features**: Issue fetching, commit/push hooks, GitHub comments
- **Note**: Not used directly, only extended by other workflows

### default.json
**General-purpose workflow** for various development tasks.

- **Extends**: core.json
- **Phases**: Frame → Architect → Build → Evaluate → Release
- **Use case**: General development, maintenance, chores, refactoring
- **Autonomy**: Guarded (pauses before release)
- **Specification**: Generic spec template
- **Testing**: Full test suite with 3 retry attempts

### bug.json
**Optimized workflow** for bug fixes and regression prevention.

- **Extends**: core.json
- **Phases**: Frame → Architect → Build → Evaluate → Release
- **Use case**: Bug fixes, defects, regressions, urgent issues
- **Autonomy**: Guarded (pauses before release)
- **Specification**: Bug template emphasizing root cause analysis
- **Key Features**:
  - Clarifies bug reproduction steps in Frame
  - Focuses on minimal scope and root cause in Architect
  - Verifies bug reproduction before fixing in Build
  - Explicit bug validation and regression testing in Evaluate
  - Documents fix in changelog during Release

### feature.json
**Comprehensive workflow** for new feature development.

- **Extends**: core.json
- **Phases**: Frame → Architect → Build → Evaluate → Release
- **Use case**: New features, enhancements, significant changes
- **Autonomy**: Guarded (pauses before release)
- **Specification**: Feature template with full technical design
- **Key Features**:
  - Clarifies user value and requirements in Frame
  - Comprehensive spec with API, data model, testing strategy in Architect
  - Validates technical design before implementation
  - Implements with full documentation in Build
  - Comprehensive testing and acceptance criteria validation in Evaluate
  - Documents feature release in changelog and README

## File Structure

Each workflow file follows the workflow.schema.json structure:

```json
{
  "$schema": "../workflow.schema.json",
  "id": "workflow-name",
  "description": "Human-readable description",
  "phases": {
    "frame": { ... },
    "architect": { ... },
    "build": { ... },
    "evaluate": { ... },
    "release": { ... }
  },
  "hooks": { ... },
  "autonomy": { ... }
}
```

## Using Workflows

### In Config File

Reference workflows in `.fractary/plugins/faber/config.json`:

```json
{
  "workflows": [
    {
      "id": "default",
      "file": "./workflows/default.json"
    },
    {
      "id": "hotfix",
      "file": "./workflows/hotfix.json"
    }
  ]
}
```

### Selecting Workflow

FABER uses an intelligent **multi-tier workflow selection strategy** to automatically choose the most appropriate workflow based on issue characteristics. This ensures optimal workflows are used without requiring manual specification.

#### Selection Priority (Highest to Lowest)

##### 1. Explicit Override (Highest Priority)

Use the `--workflow` flag to explicitly specify which workflow to use:

```bash
# Use specific workflow
/fractary-faber:run --work-id 123 --workflow fractary-faber:bug
/fractary-faber:run --work-id 456 --workflow fractary-faber:feature
```

##### 2. Target-Based Override

When using target-based planning, target definitions can specify workflow overrides:

```json
{
  "targets": {
    "definitions": [
      {
        "name": "ipeds-datasets",
        "pattern": "ipeds/*",
        "workflow_override": "data-pipeline"
      }
    ]
  }
}
```

##### 3. Label-Based Selection (Smart Default)

**Explicit `workflow:` Label Prefix:**

Issues with `workflow:` label prefix explicitly specify the workflow:

```bash
# Issue has label "workflow:hotfix" → uses hotfix workflow
/fractary-faber:run --work-id 123

# Issue has label "workflow:custom" → uses custom workflow
/fractary-faber:run --work-id 456
```

**Label Mapping Configuration:**

Configure `workflow_inference.label_mapping` to map common labels to workflows:

```json
{
  "workflow_inference": {
    "label_mapping": {
      "bug": "fractary-faber:bug",
      "defect": "fractary-faber:bug",
      "feature": "fractary-faber:feature",
      "enhancement": "fractary-faber:feature"
    }
  }
}
```

**Note**: If an issue has multiple labels that match the mapping, the first matching label (in iteration order) wins.

```bash
# Issue #123 has label "bug" → automatically uses bug workflow
/fractary-faber:run --work-id 123

# Issue #456 has label "feature" → automatically uses feature workflow
/fractary-faber:run --work-id 456
```

##### 4. WorkType Classification (Intelligent Fallback)

When no labels match, FABER classifies the issue's work type based on labels and title keywords, then maps to a workflow:

**Classification Logic:**
- Checks labels for: bug, defect, regression, feature, enhancement, patch, hotfix, chore, maintenance
- Falls back to title keyword analysis: fix, bug, error, add, implement, feature, refactor, cleanup

**Default WorkType Mapping:**
```json
{
  "workflow_inference": {
    "work_type_mapping": {
      "bug": "fractary-faber:bug",
      "feature": "fractary-faber:feature",
      "patch": "fractary-faber:bug",
      "chore": "fractary-faber:default",
      "infrastructure": "fractary-faber:default"
    }
  }
}
```

```bash
# Issue title: "Fix login error" → classifies as bug → uses bug workflow
/fractary-faber:run --work-id 789

# Issue title: "Add user authentication" → classifies as feature → uses feature workflow
/fractary-faber:run --work-id 101
```

##### 5. Default Fallback (Lowest Priority)

If no selection method applies, uses `default_workflow` from config (or `fractary-faber:default`):

```json
{
  "default_workflow": "fractary-faber:default"
}
```

**Configuration** (`config.json`):
```json
{
  "workflow_inference": {
    "label_mapping": {
      "hotfix": "hotfix",
      "urgent": "hotfix",
      "critical": "hotfix",
      "security": "hotfix",
      "bug": "default",
      "feature": "default",
      "enhancement": "default"
    }
  }
}
```

**How it works:**
1. FABER fetches issue labels from the work tracking system (GitHub, Jira, Linear)
2. Checks if any label matches a key in `label_mapping`
3. Uses the mapped workflow (e.g., label "urgent" → workflow "hotfix")
4. If multiple labels match, uses the first match
5. If no labels match, falls back to first workflow in config

#### 3. Default Fallback (Last Resort)

If no `--workflow` flag is provided AND no labels match, uses the first workflow in the `workflows` array:

```bash
# No --workflow flag, issue has no matching labels → uses workflows[0] (typically "default")
/fractary-faber:run 789
```

**Selection Priority:**
```
1. --workflow flag (explicit)
   ↓
2. Issue label mapping (inferred)
   ↓
3. First workflow in config (fallback)
```

## Creating Custom Workflows

1. **Copy a template**:
   ```bash
   cp plugins/faber/config/workflows/default.json .fractary/plugins/faber/workflows/custom.json
   ```

2. **Edit workflow** to meet your needs:
   - Modify phase steps
   - Add/remove hooks
   - Adjust autonomy level
   - Customize validation

3. **Reference in config**:
   ```json
   {
     "workflows": [
       {
         "id": "custom",
         "file": "./workflows/custom.json",
         "description": "My custom workflow"
       }
     ]
   }
   ```

4. **Validate**:
   ```bash
   /fractary-faber:audit
   ```

## Workflow Schema

All workflow files must validate against `workflow.schema.json`. This ensures:

- Required fields are present (id, phases, autonomy)
- Phase structure is correct
- Step definitions are valid
- Hook configurations are proper
- Autonomy settings are valid

## Plugin-Provided Workflows

Specialized FABER plugins (like `faber-cloud`, `faber-app`) provide domain-specific workflow templates:

**Example**: `plugins/faber-cloud/workflows/`
- `infrastructure.json` - Infrastructure deployment workflow
- `terraform-aws.json` - Terraform + AWS workflow

During plugin initialization, these templates are copied to your project's workflows directory and referenced in config.json.

## Best Practices

1. **Start with templates**: Use default.json or hotfix.json as starting points
2. **Version control**: Commit workflow files to share across team
3. **Document changes**: Add description fields to custom workflows
4. **Test workflows**: Use `--autonomy dry-run` to test changes
5. **Keep workflows focused**: One workflow per use case
6. **Use meaningful IDs**: `infrastructure-aws`, `api-deployment`, etc.

## Migration from v1.x

Old TOML configs embedded workflows inline. To migrate:

1. Extract workflow from `.faber.config.toml`
2. Convert to JSON format
3. Save as `workflows/default.json`
4. Update config.json to reference file
5. Validate with `/fractary-faber:audit`

See [docs/MIGRATION-v2.md](../../docs/MIGRATION-v2.md) for detailed migration guide.

## See Also

- [workflow.schema.json](../workflow.schema.json) - Workflow validation schema
- [config.schema.json](../config.schema.json) - Main config validation schema
- [FABER Configuration Guide](../../docs/CONFIGURATION.md) - Complete configuration documentation
- [Plugin Extension Guide](../../docs/PLUGIN-EXTENSION.md) - Creating plugin-specific workflows
