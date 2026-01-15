# Migration Guide: settings.json to config.yaml

This guide explains how to migrate from the old `.fractary/settings.json` format to the new unified `.fractary/config.yaml` format.

## Why the Migration?

The unified config format addresses several issues (see [Issue #55](https://github.com/fractary/faber/issues/55)):

1. **Configuration Duplication**: FABER's settings.json duplicated GitHub settings that exist in fractary-core work/repo plugin configs
2. **Security Risk**: API keys stored in files that could be accidentally committed
3. **Format Inconsistency**: Using JSON when the Fractary ecosystem standardized on YAML
4. **Poor Separation**: Authentication mixed with workflow configuration

## What Changed

| Before | After |
|--------|-------|
| `.fractary/settings.json` | `.fractary/config.yaml` |
| JSON format | YAML format |
| Hardcoded secrets | Environment variable references |
| FABER-only config | Unified config shared with fractary-core plugins |

### Configuration Structure Change

**Before (settings.json):**
```json
{
  "anthropic": {
    "api_key": "sk-ant-xxxxx"
  },
  "github": {
    "organization": "acme-corp",
    "project": "api-service",
    "app": { ... }
  },
  "worktree": {
    "location": "~/.claude-worktrees"
  },
  "workflow": {
    "config_path": ".fractary/faber/workflows"
  }
}
```

**After (config.yaml):**
```yaml
version: "2.0"

# Shared authentication (used by FABER and fractary-core plugins)
anthropic:
  api_key: ${ANTHROPIC_API_KEY}

github:
  organization: acme-corp
  project: api-service
  app:
    id: "123456"
    installation_id: "12345678"
    private_key_path: ~/.github/faber-app.pem

# FABER-specific settings
faber:
  worktree:
    location: ~/.claude-worktrees
    inherit_from_claude: true
  workflow:
    config_path: .fractary/faber/workflows
```

Key differences:
- `anthropic` and `github` are now at the **top level** (shared with other tools)
- FABER-specific settings (`worktree`, `workflow`) are under the `faber:` section
- Secrets use environment variable references: `${VAR}` or `${VAR:-default}`

## Migration Methods

### Method 1: Automated Migration (Recommended)

Run the migrate command:

```bash
cd your-project
fractary-faber migrate
```

This will:
1. Read your existing `.fractary/settings.json`
2. Convert to the new unified format
3. Write to `.fractary/config.yaml`
4. Backup old settings to `.fractary/settings.json.backup`

**Options:**
- `--dry-run` - Preview changes without writing
- `--no-backup` - Skip creating backup file
- `--json` - Output as JSON (for scripting)

### Method 2: Manual Migration

1. **Create the config.yaml file:**

```bash
touch .fractary/config.yaml
```

2. **Copy and transform your settings:**

Copy your settings from `settings.json` and restructure as shown in the "After" example above.

3. **Replace hardcoded secrets:**

Replace any hardcoded API keys or tokens with environment variable references:

```yaml
# Instead of:
anthropic:
  api_key: sk-ant-xxxxx

# Use:
anthropic:
  api_key: ${ANTHROPIC_API_KEY}
```

4. **Move FABER-specific settings:**

Move `worktree`, `workflow`, and `backlog_management` under the `faber:` section.

5. **Backup and remove old file:**

```bash
mv .fractary/settings.json .fractary/settings.json.backup
```

## Environment Variables

The new config format supports environment variable substitution:

| Syntax | Behavior |
|--------|----------|
| `${VAR}` | Replace with env var value, warn if not set |
| `${VAR:-default}` | Replace with env var value, or use default if not set |

**Example:**
```yaml
github:
  organization: ${GITHUB_ORG:-acme-corp}
  project: ${GITHUB_PROJECT}
```

**Setting environment variables:**

```bash
# In your shell profile (~/.bashrc, ~/.zshrc)
export ANTHROPIC_API_KEY="sk-ant-xxxxx"
export GITHUB_TOKEN="ghp_xxxxx"

# Or in .env file (not committed to git)
ANTHROPIC_API_KEY=sk-ant-xxxxx
GITHUB_TOKEN=ghp_xxxxx
```

## Common Issues

### Error: "Found old configuration at .fractary/settings.json"

This means you haven't migrated yet. Run:

```bash
fractary-faber migrate
```

### Error: "No .fractary/config.yaml found"

If you're starting fresh (no old settings.json):

```bash
# Initialize shared config first
fractary-core:init

# Then initialize FABER section
fractary-faber init
```

### Warning: "Missing 'github' section"

The FABER init command only manages the `faber:` section. You need to set up shared configuration first:

```bash
fractary-core:init
```

Or manually add the `github:` and `anthropic:` sections to your config.yaml.

### Environment variable not substituted

Check that:
1. The variable name uses uppercase letters and underscores only
2. The variable is exported in your shell
3. You've reloaded your shell after adding to profile

```bash
# Verify variable is set
echo $ANTHROPIC_API_KEY
```

## Rollback (If Needed)

If you need to revert to the old format:

1. Delete the new config:
   ```bash
   rm .fractary/config.yaml
   ```

2. Restore the backup:
   ```bash
   mv .fractary/settings.json.backup .fractary/settings.json
   ```

3. Downgrade FABER CLI to a version before this change

**Note:** Rollback is only temporary. Future FABER versions will require the unified config format.

## Integration with fractary-core

The unified config is designed to be shared across all Fractary tools:

```yaml
version: "2.0"

# Shared by all tools
anthropic:
  api_key: ${ANTHROPIC_API_KEY}

github:
  organization: acme-corp
  project: api-service
  app: { ... }

# FABER-specific
faber:
  worktree: { ... }
  workflow: { ... }

# Work plugin (fractary-core)
work:
  active_handler: github
  handlers:
    github: { }  # Uses shared github config

# Repo plugin (fractary-core)
repo:
  active_handler: github
```

This eliminates duplication - GitHub authentication is configured once and used by all tools.

## Additional Resources

- [GitHub App Setup Guide](./github-app-setup.md)
- [FABER CLI Documentation](../cli/README.md)
- [Issue #55: Unified Configuration](https://github.com/fractary/faber/issues/55)
