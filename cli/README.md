# @fractary/faber-cli

Command-line interface for FABER development toolkit. Execute and manage FABER workflows, work items, repository operations, and logs.

## Installation

```bash
npm install -g @fractary/faber-cli
```

Or use directly with `npx`:

```bash
npx @fractary/faber-cli --help
```

## Quick Start

### 1. Install

```bash
npm install -g @fractary/faber-cli
```

Or use directly with `npx`:

```bash
npx @fractary/faber-cli --help
```

### 2. Authenticate with GitHub

**Option A: Automated Setup (Recommended)**

```bash
cd your-project
fractary-faber auth setup
```

This command will:
1. Detect your GitHub organization and repository
2. Show you a URL to create a GitHub App
3. Guide you through copying the authorization code
4. Automatically configure FABER CLI

All in ~30 seconds!

**Option B: Manual Setup**

See [GitHub App Setup Guide](../docs/github-app-setup.md) for detailed manual instructions.

### 3. Initialize a FABER project

```bash
fractary-faber config init
fractary-faber config init --autonomy guarded
```

### Workflow Commands

```bash
# Plan a workflow (creates plan, branch, worktree)
fractary-faber workflow-plan --work-id 123

# Start a FABER workflow
fractary-faber workflow-run --work-id 123

# Check workflow status
fractary-faber run-inspect
fractary-faber run-inspect --work-id 123

# Pause/resume workflows
fractary-faber workflow-pause <workflow-id>
fractary-faber workflow-resume <workflow-id>

# Recover from checkpoint
fractary-faber workflow-recover <workflow-id>

# Clean up old workflows
fractary-faber workflow-cleanup --max-age 30

# Create/update workflow definitions
fractary-faber workflow-create
fractary-faber workflow-update

# Inspect and debug workflows
fractary-faber workflow-inspect
fractary-faber workflow-debugger
```

### Session Commands

```bash
# Save current session state
fractary-faber session-save

# Load a previous session
fractary-faber session-load --work-id 123
```

### Work Commands

```bash
# Issue operations
fractary-faber work issue fetch 123
fractary-faber work issue create --title "New feature"
fractary-faber work issue update 123 --title "Updated"
fractary-faber work issue close 123
fractary-faber work issue search --query "bug fix"

# Comment operations
fractary-faber work comment create 123 --body "This is a comment"
fractary-faber work comment list 123

# Label operations
fractary-faber work label add 123 --label "bug,critical"
fractary-faber work label remove 123 --label "wontfix"
fractary-faber work label list

# Milestone operations
fractary-faber work milestone create --title "v1.0" --due-on "2025-12-31"
fractary-faber work milestone list
fractary-faber work milestone set 123 --milestone "v1.0"
```

### Repository Commands

```bash
# Branch operations
fractary-faber repo branch create "feat/new-feature"
fractary-faber repo branch list
fractary-faber repo branch delete feat/old-feature

# Commit operations
fractary-faber repo commit "feat: add new feature"

# Pull request operations
fractary-faber repo pr create "Add new feature" --body "Description"
fractary-faber repo pr list
fractary-faber repo pr merge 42
fractary-faber repo pr review 42

# Tag operations
fractary-faber repo tag create v1.0.0
fractary-faber repo tag push v1.0.0
fractary-faber repo tag list

# Worktree operations
fractary-faber repo worktree create feat/new-feature
fractary-faber repo worktree list
fractary-faber repo worktree remove feat/new-feature
```

### Logs Commands

```bash
# Capture logs
fractary-faber logs capture <workflow-id>

# Stop capturing logs
fractary-faber logs stop <session-id>

# Write logs
fractary-faber logs write --message "Log message"

# Read logs
fractary-faber logs read <session-id>

# Search logs
fractary-faber logs search --query "error"

# List logs
fractary-faber logs list

# Archive logs
fractary-faber logs archive --older-than 30

# Delete logs
fractary-faber logs delete <session-id>
```

### Configuration Commands

```bash
# Get configuration values
fractary-faber config get
fractary-faber config get faber.workflows.autonomy

# Show config file path
fractary-faber config path

# Check if config exists
fractary-faber config exists

# Initialize config with defaults
fractary-faber config init --autonomy guarded

# Set a value
fractary-faber config set faber.workflows.autonomy autonomous

# Validate configuration
fractary-faber config validate

# Migrate legacy config format
fractary-faber config migrate
fractary-faber config migrate --dry-run
```

### Run Management Commands

```bash
# Manage run directories and paths
fractary-faber runs dir
fractary-faber runs plan-path <plan-id>
fractary-faber runs state-path <plan-id>
```

## Configuration

FABER is configured via `.fractary/config.yaml`:

```yaml
faber:
  workflows:
    path: .fractary/faber/workflows
    default: default
    autonomy: guarded
  runs:
    path: .fractary/faber/runs
  worktree:
    location: ~/.claude-worktrees
    inherit_from_claude: true
```

## Options

All commands support:

- `--json` - Output as JSON
- `--debug` - Enable debug output
- `--help` - Show command help

## Authentication

### GitHub App Authentication (Recommended)

For enhanced security, audit trails, and enterprise readiness, use GitHub App authentication instead of Personal Access Tokens.

**Quick Setup (Automated):**

```bash
fractary-faber auth setup
```

This command will guide you through creating and configuring a GitHub App in ~30 seconds.

**Manual Configuration (`.fractary/config.yaml`):**
```yaml
github:
  organization: your-org
  project: your-repo
  app:
    id: "123456"
    installation_id: "12345678"
    private_key_path: ~/.github/faber-app.pem
```

**For CI/CD (environment variable):**
```yaml
github:
  organization: your-org
  project: your-repo
  app:
    id: "123456"
    installation_id: "12345678"
    private_key_env_var: GITHUB_APP_PRIVATE_KEY
```

```bash
export GITHUB_APP_PRIVATE_KEY=$(cat ~/.github/faber-app.pem | base64)
```

**See detailed setup guide:** [docs/github-app-setup.md](../docs/github-app-setup.md)

### Personal Access Token (Legacy)

Still supported for backward compatibility:

```bash
export GITHUB_TOKEN=<token>
```

Or in `.fractary/config.yaml`:
```yaml
github:
  token: ghp_xxxxxxxxxxxx
  organization: your-org
  project: your-repo
```

### Other Providers

```bash
# Jira
export JIRA_BASE_URL=<url>
export JIRA_USERNAME=<username>
export JIRA_API_TOKEN=<token>

# Linear
export LINEAR_API_KEY=<key>
```

## Architecture

See [SPEC-00026: Distributed Plugin Architecture](../specs/SPEC-00026-distributed-plugin-architecture.md)

The CLI follows SPEC-00026 standards:
- Package: `@fractary/faber-cli`
- Binary: `fractary-faber`
- Located: `/cli` at root of repository
- Depends on: `@fractary/faber` SDK

## License

MIT
