# Workflow Creation Protocol

Step-by-step protocol for creating a new FABER workflow definition.

## Steps

### 1. Parse Arguments

Extract from args:
- `workflow_name` (positional, required)
- `--context` (optional context string)
- `--extends` (parent workflow, default: `fractary-faber-core`)
- `--template` (template name for scaffolding)
- `--asset-type` (asset type hint)

### 2. SECURITY: Validate Workflow Name

The workflow name MUST match the pattern:

```
^[a-z][a-z0-9-]*$
```

Reject names that start with digits, contain uppercase, underscores, or special characters. Return an error immediately if validation fails.

### 3. Template Handling (if --template specified)

1. Validate the template name exists
2. Load template from `templates/workflows/{template}/`
3. Render the Handlebars template with collected variables
4. Parse the rendered JSON result
5. Skip to Step 7 (Build workflow JSON) with the parsed template as the base

### 4. Research Project

Discover the project context:
- Glob for `.claude/skills/*/SKILL.md` to find available skills
- Glob for `.fractary/faber/workflows/*.json` to find existing workflows
- Detect project type by checking for: `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `pom.xml`, etc.

### 5. Gather Requirements (no template)

If no `--template` was specified, use AskUserQuestion to collect:
- Workflow name confirmation
- Purpose / description
- Which phases to customize (frame, architect, build, evaluate, release)
- Autonomy level (autonomous, guarded, supervised, manual)

### 6. Ask About Project-Specific Integration

Present the discovered skills from Step 4 and ask via AskUserQuestion:
- Which skills should be integrated into workflow steps
- Any project-specific tooling to invoke during phases

### 7. Build Workflow JSON

Construct the workflow JSON structure:
- `id` - the validated workflow name
- `description` - from user input or template
- `extends` - parent workflow (default: `fractary-faber-core`)
- `phases` - object with keys: `frame`, `architect`, `build`, `evaluate`, `release`
- `autonomy` - object with `level` and `require_approval_for` array

### 8. Generate Steps for Each Customized Phase

Generate steps only for phases the user chose to customize:
- **Frame**: data validation, API review, environment setup
- **Architect**: design specification, dependency analysis
- **Build**: implementation steps, integration points
- **Evaluate**: test execution, review checks, quality gates
- **Release**: PR preparation, deployment steps, documentation updates

Each step must have a unique `id`, `name`, and `description`.

### 9. Validate

Run full validation on the constructed workflow:
1. Required fields present: `id`, `phases`
2. `extends` references a valid parent workflow
3. Phase structure is correct (each phase has `steps` array)
4. Autonomy defaults are sensible
5. Step ID uniqueness across ALL phases in this workflow
6. Step ID conflict check against parent workflow (from `extends`)
7. Schema validation against workflow JSON schema

### 10. Preview and Confirm

1. Display a formatted preview of the workflow JSON via AskUserQuestion
2. Show summary: phase count, step count, autonomy level, parent workflow
3. Wait for user confirmation
4. On confirm: write to `.fractary/faber/workflows/{id}.json`
5. On reject: return to Step 5 to re-gather requirements
