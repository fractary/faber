# @fractary/faber-cli

Command-line interface for FABER development toolkit. Execute and manage FABER workflows, work items, repository operations, specifications, and logs.

## Installation

```bash
npm install -g @fractary/faber-cli
```

Or use directly with `npx`:

```bash
npx @fractary/faber-cli --help
```

## Quick Start

### Initialize a FABER project

```bash
fractary-faber init
fractary-faber init --preset minimal
fractary-faber init --preset enterprise
```

### Workflow Commands

```bash
# Start a FABER workflow
fractary-faber run --work-id 123

# Check workflow status
fractary-faber status
fractary-faber status --workflow-id <id>

# Pause/resume workflows
fractary-faber pause <workflow-id>
fractary-faber resume <workflow-id>

# Recover from checkpoint
fractary-faber recover <workflow-id>

# Clean up old workflows
fractary-faber cleanup --max-age 30
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

### Specification Commands

```bash
# Create specifications
fractary-faber spec create "My Specification"

# Get specification
fractary-faber spec get <id>

# List specifications
fractary-faber spec list

# Update specification
fractary-faber spec update <id> --title "Updated"

# Validate specification
fractary-faber spec validate <id>

# Refine specification
fractary-faber spec refine <id>

# Delete specification
fractary-faber spec delete <id>
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

## Configuration

FABER is configured via `.fractary/faber/config.json`:

```json
{
  "version": "1.0.0",
  "preset": "default",
  "work": {
    "provider": "github"
  },
  "repo": {
    "provider": "github",
    "defaultBranch": "main"
  },
  "spec": {
    "directory": ".fractary/faber/specs"
  },
  "logs": {
    "directory": ".fractary/faber/logs"
  },
  "workflow": {
    "defaultAutonomy": "guarded",
    "phases": ["frame", "architect", "build", "evaluate", "release"],
    "checkpoints": true
  },
  "state": {
    "directory": ".fractary/faber/state"
  }
}
```

## Options

All commands support:

- `--json` - Output as JSON
- `--debug` - Enable debug output
- `--help` - Show command help

## Authentication

### GitHub App Authentication (Recommended)

For enhanced security, audit trails, and enterprise readiness, use GitHub App authentication instead of Personal Access Tokens.

**Configuration (`.fractary/settings.json`):**
```json
{
  "github": {
    "organization": "your-org",
    "project": "your-repo",
    "app": {
      "id": "123456",
      "installation_id": "12345678",
      "private_key_path": "~/.github/faber-app.pem"
    }
  }
}
```

**For CI/CD (environment variable):**
```json
{
  "github": {
    "organization": "your-org",
    "project": "your-repo",
    "app": {
      "id": "123456",
      "installation_id": "12345678",
      "private_key_env_var": "GITHUB_APP_PRIVATE_KEY"
    }
  }
}
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

Or in `.fractary/settings.json`:
```json
{
  "github": {
    "token": "ghp_xxxxxxxxxxxx",
    "organization": "your-org",
    "project": "your-repo"
  }
}
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
