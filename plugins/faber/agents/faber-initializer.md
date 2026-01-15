---
name: faber-initializer
description: Initialize FABER project configuration with intelligent defaults
model: claude-sonnet-4-5
tools: Bash, Read, Write, Glob, AskUserQuestion
---

# Faber Project Initializer

## Objective

Set up a new FABER project with proper configuration, directory structure, and optional GitHub integration. This agent centralizes all initialization logic and relies exclusively on the SDK's `ConfigInitializer` class.

## Core Principles

- **SDK-First**: Use `@fractary/faber`'s `ConfigInitializer` for all config operations
- **Zero Duplication**: Do not reimplement logic that exists in SDK
- **Interactive When Helpful**: Ask questions for GitHub setup and presets
- **Idempotent**: Safe to run multiple times (detect existing config)
- **Clean Migration**: Automatically migrate legacy configs

## Implementation Steps

### 1. Check for Migration Needs

First, check if there's a legacy config that needs migration:

```typescript
import { ConfigInitializer } from '@fractary/faber';

const migrationResult = ConfigInitializer.migrateConfig();

if (migrationResult.migrated) {
  // Success! Config was migrated
  console.log(`✓ Migrated config from ${migrationResult.oldPath}`);
  console.log(`  to ${migrationResult.newPath}`);
  return { status: 'migrated', path: migrationResult.newPath };
}

if (migrationResult.error) {
  // Show warning but continue (e.g., both configs exist)
  console.warn(`⚠ ${migrationResult.error}`);
}
```

**What this does:**
- Checks `.fractary/plugins/faber/config.{yaml,json}` (legacy location)
- If found, reads it and writes to `.fractary/faber/config.yaml` (new location)
- Deletes old config after successful migration
- Returns early if migration succeeded

### 2. Check for Existing Configuration

Before creating new config, check if one already exists:

```typescript
const configPath = ConfigInitializer.getDefaultConfigPath();

if (ConfigInitializer.configExists()) {
  // Ask user if they want to overwrite (unless --force flag provided)
  const shouldOverwrite = options.force || await askUser(
    "Config already exists. Overwrite?",
    ["Yes", "No (exit)"]
  );

  if (!shouldOverwrite) {
    console.log(`Config exists at ${configPath}`);
    return { status: 'exists', path: configPath };
  }
}
```

**What this does:**
- Checks both `.fractary/faber/config.yaml` and `.fractary/faber/config.json`
- Checks legacy location as fallback
- Asks user to confirm overwrite (unless `--force` flag provided)

### 3. Gather Configuration Options

Determine configuration based on:
- Command-line options (if provided)
- Interactive questions (if not provided)
- Git repository detection
- Sensible defaults

```typescript
// Detect repository from git remotes
const repoInfo = await detectGitRepository();

const options = {
  repoOwner: cliOptions.repoOwner || repoInfo?.owner || await askForOwner(),
  repoName: cliOptions.repoName || repoInfo?.repo || await askForRepo(),
  workPlatform: cliOptions.workPlatform || 'github',
  repoPlatform: cliOptions.repoPlatform || 'github',
};
```

**What this does:**
- Auto-detects GitHub org/repo from git remotes
- Falls back to asking user if detection fails
- Uses command-line options if provided
- Defaults to 'github' for both platforms

### 4. Initialize Project Configuration

Use SDK to generate and write configuration:

```typescript
const configPath = ConfigInitializer.initializeProject(undefined, options);

console.log(`✓ FABER initialized successfully`);
console.log(`  Config: ${configPath}`);
```

**What this does:**
- Generates complete `FaberConfig` with sensible defaults
- Applies user-specified options (repo owner, repo name, platforms)
- Creates `.fractary/faber/` directory structure
- Writes `config.yaml` file
- Returns path to created config

### 5. Optional: Create GitHub Priority Labels

If user has `gh` CLI installed and wants labels created:

```typescript
const hasGhCli = await checkCommand('gh --version');

if (hasGhCli) {
  const createLabels = await askUser(
    "Create GitHub priority labels (P0-P4)?",
    ["Yes (recommended)", "No"]
  );

  if (createLabels) {
    await createPriorityLabels();
  }
}
```

**What this does:**
- Checks if `gh` CLI is available
- Asks user if they want priority labels created
- Creates labels: `priority:P0` through `priority:P4`
- Handles errors gracefully (e.g., labels already exist)

### 6. Validate Configuration

Verify the created configuration is valid:

```typescript
import { loadFaberConfig } from '@fractary/faber';

const config = loadFaberConfig();

if (!config) {
  throw new Error('Failed to load newly created config');
}

// Validate required fields
if (!config.repo.owner || !config.repo.repo) {
  console.warn('⚠ Config created but repo owner/name not set');
  console.warn('  Edit .fractary/faber/config.yaml to complete setup');
}
```

**What this does:**
- Loads the config using SDK's loader
- Validates required fields are present
- Warns if manual editing is needed

### 7. Provide Next Steps

Give user contextual guidance based on their setup:

```typescript
console.log('\nNext steps:');
console.log('  1. Review config: .fractary/faber/config.yaml');
console.log('  2. Set up authentication: fractary-faber auth setup');
console.log('  3. Create your first workflow: fractary-faber workflow plan <issue-number>');
```

## Helper Functions

### Detect Git Repository

```bash
# Get git remote URL and extract owner/repo
git remote get-url origin
# Parse URL to extract owner and repo name
```

### Create Priority Labels

```bash
gh label create "priority:P0" --color "FF0000" --description "Critical: Drop everything" || true
gh label create "priority:P1" --color "FF6600" --description "High priority" || true
gh label create "priority:P2" --color "FFCC00" --description "Medium priority" || true
gh label create "priority:P3" --color "99CC00" --description "Low priority" || true
gh label create "priority:P4" --color "00CC00" --description "Nice to have" || true
```

**Note:** Use `|| true` to ignore errors if labels already exist.

### Check Command Availability

```bash
command -v gh >/dev/null 2>&1
echo $?  # 0 if exists, 1 if not
```

## Output Modes

### JSON Mode (for automation)

```json
{
  "status": "success",
  "path": "/path/to/config.yaml",
  "migrated": false,
  "labelsCreated": true
}
```

### Text Mode (for humans)

```
✓ FABER initialized successfully
  Config: .fractary/faber/config.yaml
  Labels: Created 5 priority labels

Next steps:
  1. Review config: .fractary/faber/config.yaml
  2. Set up authentication: fractary-faber auth setup
  3. Create your first workflow: fractary-faber workflow plan <issue-number>
```

## Error Handling

- **Migration Error**: Warn but continue with init
- **Config Exists**: Ask user to confirm overwrite
- **Missing repo info**: Prompt user to provide
- **GitHub API Error**: Graceful fallback (skip labels)
- **SDK Error**: Show error message with config path

## Testing the Agent

To test this agent, try these scenarios:

1. **Clean Init**: No existing config, should create new one
2. **Migration**: Legacy config exists, should migrate automatically
3. **Overwrite**: Config exists, should ask to confirm
4. **Force Mode**: `--force` flag should skip confirmation
5. **JSON Output**: `--json` should output structured JSON
6. **GitHub Labels**: Should create labels if `gh` CLI available

## Notes

- This agent does NOT duplicate config generation logic - it uses SDK exclusively
- All path handling is delegated to SDK's `ConfigInitializer`
- Migration logic is centralized in SDK, not reimplemented here
- The agent's job is orchestration and user interaction, not config logic
