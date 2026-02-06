# Asset Configurator Standards

This document defines the standards, best practices, and validation rules for creating configurator agents.

## Overview

Configurator agents manage project configuration with safety guarantees. They provide interactive setup wizards, validate configuration before applying changes, and offer preview, backup, and rollback capabilities.

## Required Standards

### 1. User Safety First

Configurator agents MUST prioritize user safety above all else:

- **Never modify files without confirmation** - Always get explicit user approval
- **Always show previews** - Display exactly what will change before applying
- **Maintain backups** - Create timestamped backups before any modification
- **Automatic rollback** - Restore from backup on any failure

### 2. Input Validation

All user input MUST be validated:

```
Dangerous patterns to reject:
- Shell metacharacters: | ; & > < ` $
- Control characters: \x00-\x1f
- Path traversal: ../
- Null bytes: \x00
```

### 3. Transparency

Users MUST always understand what's happening:

- Show current vs proposed values in update mode
- List all files that will be created/modified
- Explain the purpose of each change
- Provide clear success/failure messages

### 4. Idempotency

Operations MUST be safe to run multiple times:

- Detect existing configuration
- Offer update vs overwrite choices
- Handle partial states gracefully
- Support migration from legacy formats

## Recommended Patterns

### Auto-Detection

Configurators SHOULD auto-detect sensible defaults from:

1. **Git information**
   - Repository owner from remote URL
   - Repository name from remote URL
   - Default branch from HEAD reference

2. **Environment**
   - Available CLI tools (gh, npm, etc.)
   - Environment variables
   - Platform-specific paths

3. **Project structure**
   - Package manager (package.json, Cargo.toml, etc.)
   - Existing configuration files
   - Directory conventions

### Interactive Flow

The recommended interaction pattern:

1. **Detect** - Auto-detect values silently
2. **Confirm** - Present each value for user confirmation
3. **Customize** - Allow modification via "Other" option
4. **Preview** - Show complete proposed changes
5. **Apply** - Make changes only after final confirmation

### Backup Strategy

Recommended backup approach:

```bash
# Generate timestamp (cross-platform)
if date +%N >/dev/null 2>&1 && [ "$(date +%N)" != "N" ]; then
  timestamp=$(date +%Y%m%d%H%M%S%N)  # Linux: nanosecond precision
else
  timestamp="$(date +%Y%m%d%H%M%S)_$$_$RANDOM"  # macOS: seconds + PID + random
fi

# Create backup
backup_file="${config_path}.backup.${timestamp}"
cp "$config_path" "$backup_file"
```

### Error Messages

Error messages SHOULD be:

- **Clear** - Explain what went wrong
- **Actionable** - Suggest how to fix it
- **Contextual** - Include relevant file paths and values

Example:
```
ERROR: Invalid configuration syntax

File: .fractary/config.yaml (faber: section)
Error: Unexpected mapping at line 42

Recovery:
1. Check for syntax errors (missing colons, quotes)
2. Validate YAML with: yamllint .fractary/config.yaml
3. Restore from backup if available
```

## Section Requirements

### Required Sections

Every configurator agent MUST have:

| Section | Purpose |
|---------|---------|
| `<CONTEXT>` | Define role and responsibility |
| `<ARGUMENT_SYNTAX>` | Document all supported arguments |
| `<CRITICAL_RULES>` | Safety rules (must include the 6 core rules) |
| `<IMPLEMENTATION>` | Step-by-step algorithm |
| `<OUTPUTS>` | Output format specifications |

### Recommended Sections

| Section | Purpose |
|---------|---------|
| `<INPUT_VALIDATION>` | Validation functions and patterns |
| `<ERROR_HANDLING>` | Error scenarios and recovery |
| `<RELATED_COMMANDS>` | Links to related functionality |
| `<OPTIONAL_FEATURES>` | Additional capabilities |

## Anti-Patterns

Avoid these common mistakes:

### 1. Silent Modifications
```
# BAD: Modifying without preview
write(config_path, new_config)

# GOOD: Preview then confirm
display_preview(current, proposed)
if confirm():
    backup()
    write(config_path, new_config)
```

### 2. Overwriting Unrelated Sections
```
# BAD: Replacing entire file
config = { "my_section": data }
write(config_path, config)

# GOOD: Surgical edit
config = read(config_path)
config["my_section"] = data
write(config_path, config)
```

### 3. Ignoring Validation Failures
```
# BAD: Continuing after validation error
if not validate(config):
    print("Warning: invalid config")
# continues anyway

# GOOD: Stop and rollback
if not validate(config):
    rollback_from_backup()
    exit(1)
```

### 4. Hardcoded Paths
```
# BAD: Hardcoded path
config_path = "/home/user/.config/app/config.yaml"

# GOOD: Use unified config location
unified_config = ".fractary/config.yaml"  # All plugins share this file
```

## Security Considerations

### Path Validation

Always validate file paths:

```python
def is_safe_path(path, base_dir):
    # Resolve to absolute path
    resolved = os.path.realpath(path)
    base = os.path.realpath(base_dir)

    # Ensure path is within base directory
    return resolved.startswith(base + os.sep)
```

### Input Sanitization

Sanitize all user input:

```python
def sanitize_input(value):
    # Remove dangerous characters
    dangerous = set('|;&><`$\x00')
    return ''.join(c for c in value if c not in dangerous)
```

### Environment Variable Handling

Be cautious with environment variables:

```bash
# BAD: Directly using env var in path
config_path="$USER_PROVIDED_PATH/config.yaml"

# GOOD: Validate before use
if [[ "$USER_PROVIDED_PATH" == *".."* ]]; then
    echo "Error: Path traversal not allowed"
    exit 1
fi
```

---

# Validation Rules

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
  - Valid values: `claude-haiku-4-5`, `claude-sonnet-4-5`, `claude-opus-4-6`
  - Recommended: `claude-sonnet-4-5` for configurators

- [ ] **MUST have** `tools` field
  - Must be an array
  - **MUST include** `AskUserQuestion` (required for configurators)
  - Should include `Read`, `Write` for file operations

### Optional Fields

- [ ] **MAY have** `color` field
  - Valid values: red, orange, yellow, green, blue, purple, pink, gray, cyan

- [ ] **SHOULD have** `agent_type` field
  - Value: `asset-configurator`
  - Links to this template for updates and validation

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

## Common Validation Failures

| Issue | Solution |
|-------|----------|
| Missing AskUserQuestion tool | Add to tools array in frontmatter |
| No backup implementation | Add backup step before file writes |
| Missing preview step | Add display preview step before confirmation |
| No input validation | Add INPUT_VALIDATION section with patterns |
| Hardcoded paths | Use configurable paths with fallbacks |

## Testing Configurators

Test these scenarios:

1. **Fresh initialization** - No existing config
2. **Update existing** - Config already exists
3. **Migration** - Legacy config format
4. **Validation failure** - Invalid config values
5. **Write failure** - Permission denied
6. **User cancellation** - Cancel at each step
7. **Rollback** - Failure after partial changes
8. **Idempotency** - Run multiple times

## Examples

See these configurator agents for reference:

- `plugins/faber/agents/configurator.md` - Full-featured FABER configurator
- Plugin initializers in various fractary plugins
