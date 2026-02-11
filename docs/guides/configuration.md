# Configuration Guide

Complete reference for configuring FABER via `.fractary/config.yaml`.

## Directory Structure

```
.fractary/
├── config.yaml                  # Unified configuration
└── faber/
    ├── workflows/               # Workflow definitions
    │   ├── workflows.yaml       # Workflow manifest
    │   └── default.yaml         # Default workflow config
    └── runs/                    # Run artifacts (per-run state and plans)
        └── {run_id}/
            ├── plan.json
            └── state.json
```

## Creating Configuration

### CLI (Recommended)

```bash
# Initialize FABER section
fractary-faber config init

# With options
fractary-faber config init --autonomy guarded --default-workflow default

# Set up GitHub App authentication
fractary-faber auth setup

# Force reinitialize
fractary-faber config init --force
```

### Manual

Create `.fractary/config.yaml` in your project root:

```yaml
version: "2.0"
github:
  organization: your-org
  project: your-repo
  app:
    id: "12345"
    installation_id: "67890"
    private_key_path: ~/.github/faber-your-org.pem
anthropic:
  api_key: ${ANTHROPIC_API_KEY}
  model: claude-sonnet-4-5-20250929
faber:
  workflows:
    path: .fractary/faber/workflows
    default: default
    autonomy: guarded
  runs:
    path: .fractary/faber/runs
```

---

## Configuration Schema

### Top-Level Structure

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Config version (currently `"2.0"`) |
| `github` | object | GitHub authentication and project settings |
| `anthropic` | object | Anthropic API settings |
| `faber` | object | FABER workflow settings |
| `work` | object | Work plugin pass-through |
| `repo` | object | Repo plugin pass-through |
| `logs` | object | Logs plugin pass-through |
| `file` | object | File plugin pass-through |
| `spec` | object | Spec plugin pass-through |
| `docs` | object | Docs plugin pass-through |

### `github`

GitHub authentication. Supports both GitHub App (recommended) and personal access tokens.

```yaml
github:
  organization: your-org       # GitHub organization name
  project: your-repo           # Repository name
  repo: your-org/your-repo     # Full repo name (alternative to org+project)
  token: ${GITHUB_TOKEN}       # Personal access token (legacy)
  app:                         # GitHub App authentication (recommended)
    id: "12345"
    installation_id: "67890"
    private_key_path: ~/.github/faber-your-org.pem
    private_key_env_var: GITHUB_APP_PRIVATE_KEY  # Alternative: base64-encoded key in env var
    created_via: manifest-flow  # How the app was created (manifest-flow or manual)
    created_at: "2025-01-15T00:00:00Z"
```

**GitHub App** is the recommended authentication method. Set it up with:
```bash
fractary-faber auth setup
```

### `anthropic`

Anthropic API configuration for AI-powered features (workflow planning, code analysis).

```yaml
anthropic:
  api_key: ${ANTHROPIC_API_KEY}        # API key (use env var)
  model: claude-sonnet-4-5-20250929            # Model to use
  max_tokens: 4096                     # Max tokens per request
```

### `faber`

FABER workflow engine settings.

```yaml
faber:
  workflows:
    path: .fractary/faber/workflows    # Directory for workflow definitions
    default: default                    # Default workflow ID
    autonomy: guarded                   # Default autonomy level
  runs:
    path: .fractary/faber/runs         # Directory for run artifacts
```

#### Autonomy Levels

| Level | Description |
|-------|-------------|
| `dry-run` | Plan only, no execution |
| `assisted` | Execute with confirmation at each step |
| `guarded` | Execute with confirmation at phase boundaries |
| `autonomous` | Execute without confirmation |

Note: The CLI `workflow-run` command uses different autonomy levels (`supervised`, `assisted`, `autonomous`) than the plugin/config (`dry-run`, `assisted`, `guarded`, `autonomous`).

### `faber` (Legacy Format)

The legacy format is still supported but deprecated. Use `config migrate` to update:

```yaml
# Legacy (deprecated)
faber:
  worktree:
    location: ~/.claude-worktrees
    inherit_from_claude: true
  workflow:
    default: default
    config_path: .fractary/faber/workflows
  backlog_management:
    default_limit: 10
    default_order_by: priority
    priority_config:
      label_prefix: priority
```

Migrate with:
```bash
fractary-faber config migrate --dry-run  # Preview changes
fractary-faber config migrate            # Apply migration
```

---

## Environment Variable Substitution

Config values can reference environment variables:

```yaml
# Direct substitution
anthropic:
  api_key: ${ANTHROPIC_API_KEY}

# With default value
github:
  token: ${GITHUB_TOKEN:-ghp_default_token}
```

**Syntax:**
- `${VAR_NAME}` - Replace with environment variable value
- `${VAR_NAME:-default}` - Use default if variable is not set

Variable names must match pattern: `[A-Z_][A-Z0-9_]*`

---

## Config Search Order

The CLI looks for `.fractary/config.yaml` in:

1. Current directory
2. Parent directories (walks up until `.fractary/` or `.git/` is found)
3. Falls back to current working directory if nothing found

---

## CLI Config Commands

### Read configuration

```bash
# Full config as JSON
fractary-faber config get --json

# Specific value
fractary-faber config get faber.workflows.autonomy

# Raw value (for shell scripts)
ORG=$(fractary-faber config get github.organization --raw)
```

### Modify configuration

```bash
# Set a single value
fractary-faber config set faber.workflows.autonomy autonomous

# Update multiple values with backup
fractary-faber config update faber.workflows.autonomy=autonomous faber.workflows.default=custom

# Preview changes without applying
fractary-faber config update faber.workflows.autonomy=autonomous --dry-run
```

### Validate configuration

```bash
fractary-faber config validate
fractary-faber config validate --json
```

### Check status

```bash
# Show config file path
fractary-faber config path

# Check if config exists (exit code 0=yes, 1=no)
fractary-faber config exists && echo "Config found"
```

---

## Complete Example

```yaml
version: "2.0"

# Shared GitHub authentication
github:
  organization: acme-corp
  project: web-platform
  app:
    id: "123456"
    installation_id: "789012"
    private_key_path: ~/.github/faber-acme-corp.pem

# Shared Anthropic API
anthropic:
  api_key: ${ANTHROPIC_API_KEY}
  model: claude-sonnet-4-5-20250929

# FABER workflow settings
faber:
  workflows:
    path: .fractary/faber/workflows
    default: default
    autonomy: guarded
  runs:
    path: .fractary/faber/runs

# Plugin pass-through sections (managed by fractary-core)
work:
  platform: github
repo:
  default_branch: main
logs:
  retention_days: 90
```

---

## See Also

- [CLI Reference](../public/cli.md) - All CLI commands and options
- [Getting Started](../public/getting-started.md) - Installation and initial setup
- [Concepts](../public/concepts.md) - Core concepts
