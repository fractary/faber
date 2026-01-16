# Configurator Agent Validation Rules

Use this checklist to validate configurator agent definitions.

## Frontmatter Validation

### Required Fields

- [ ] **MUST have** `name` field
  - Lowercase letters, numbers, and hyphens only
  - Must start with a letter
  - Pattern: `^[a-z][a-z0-9-]*$`

- [ ] **MUST have** `description` field
  - Maximum 200 characters
  - Should be actionable (describe what it does)

- [ ] **MUST have** `model` field
  - Valid values: `claude-haiku-4-5`, `claude-sonnet-4-5`, `claude-opus-4-5`
  - Recommended: `claude-sonnet-4-5` for configurators

- [ ] **MUST have** `tools` field
  - Must be an array
  - **MUST include** `AskUserQuestion` (required for configurators)
  - Should include `Read`, `Write` for file operations

### Optional Fields

- [ ] **MAY have** `color` field
  - Valid values: red, orange, yellow, green, blue, purple, pink, gray, cyan

## Structure Validation

### Required Sections

- [ ] **MUST have** `<CONTEXT>` section
  - Defines the agent's role and responsibility
  - Explains what configuration it manages
  - Describes initialize vs update modes

- [ ] **MUST have** `<ARGUMENT_SYNTAX>` section
  - Documents all supported command arguments
  - Includes argument table with descriptions
  - Provides usage examples

- [ ] **MUST have** `<CRITICAL_RULES>` section
  - Contains numbered safety rules
  - **MUST include** these core rules:
    1. Transparency - Preview Before Apply
    2. Safety - Backup and Rollback
    3. Input Validation
    4. User Confirmation
    5. Idempotent Operations
    6. Surgical Edits

- [ ] **MUST have** `<IMPLEMENTATION>` section
  - Step-by-step algorithm
  - **MUST include** these steps:
    - [ ] Parse arguments
    - [ ] Check existing configuration
    - [ ] Auto-detect values
    - [ ] Interactive confirmation
    - [ ] Build proposed configuration
    - [ ] Display preview
    - [ ] Get explicit confirmation
    - [ ] Apply changes with backup
    - [ ] Validate configuration

- [ ] **MUST have** `<OUTPUTS>` section
  - Documents output format
  - Includes JSON mode specification
  - Documents error output format

### Recommended Sections

- [ ] **SHOULD have** `<INPUT_VALIDATION>` section
  - Validation functions for user input
  - Pattern matching for dangerous characters
  - Length and format constraints

- [ ] **SHOULD have** `<ERROR_HANDLING>` section
  - Error scenarios table
  - Recovery actions for each scenario
  - Exit codes documentation

- [ ] **SHOULD have** `<RELATED_COMMANDS>` section
  - Links to related commands/agents
  - Integration points with other tools

## Implementation Validation

### Safety Checks

- [ ] **MUST** create backup before modifying existing files
- [ ] **MUST** restore from backup on failure
- [ ] **MUST** validate input against dangerous patterns
- [ ] **MUST** use AskUserQuestion for confirmations
- [ ] **MUST** show preview before applying changes

### Code Quality

- [ ] **SHOULD** handle cross-platform timestamp generation
- [ ] **SHOULD** support both YAML and JSON config formats
- [ ] **SHOULD** preserve comments in existing files when possible
- [ ] **SHOULD** handle missing parent directories

### User Experience

- [ ] **SHOULD** auto-detect sensible defaults
- [ ] **SHOULD** allow user to modify auto-detected values
- [ ] **SHOULD** provide clear progress indicators
- [ ] **SHOULD** show actionable next steps after completion

## Content Validation

### Documentation Quality

- [ ] **MUST** explain what configuration is managed
- [ ] **MUST** document all supported arguments
- [ ] **MUST** provide usage examples
- [ ] **SHOULD** include error message examples
- [ ] **SHOULD** document exit codes

### Security

- [ ] **MUST NOT** allow path traversal (`../`)
- [ ] **MUST NOT** allow shell metacharacters in input
- [ ] **MUST NOT** execute user-provided strings as commands
- [ ] **SHOULD** validate file paths before operations

## Validation Severity Legend

| Marker | Meaning | Impact |
|--------|---------|--------|
| **MUST** | Required | Agent will not function correctly without this |
| **MUST NOT** | Prohibited | Security or safety violation |
| **SHOULD** | Recommended | Best practice, improves quality |
| **MAY** | Optional | Nice to have, not required |

## Automated Validation

To validate a configurator agent programmatically:

```bash
# Check frontmatter
grep -q "^name:" agent.md || echo "Missing: name"
grep -q "^tools:.*AskUserQuestion" agent.md || echo "Missing: AskUserQuestion tool"

# Check required sections
for section in CONTEXT ARGUMENT_SYNTAX CRITICAL_RULES IMPLEMENTATION OUTPUTS; do
  grep -q "<$section>" agent.md || echo "Missing: <$section>"
done

# Check critical rules
grep -q "Preview Before Apply" agent.md || echo "Missing rule: Preview Before Apply"
grep -q "Backup and Rollback" agent.md || echo "Missing rule: Backup and Rollback"
```

## Common Validation Failures

| Issue | Solution |
|-------|----------|
| Missing AskUserQuestion tool | Add to tools array in frontmatter |
| No backup implementation | Add backup step before file writes |
| Missing preview step | Add display preview step before confirmation |
| No input validation | Add INPUT_VALIDATION section with patterns |
| Hardcoded paths | Use configurable paths with fallbacks |
