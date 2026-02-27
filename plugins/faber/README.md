# FABER Plugin for Claude Code

**Tool-agnostic SDLC workflow automation**: From work item to production in 5 phases.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Claude Code Plugin](https://img.shields.io/badge/Claude-Code%20Plugin-blue)](https://claude.com/claude-code)

## What is FABER?

FABER is a **tool-agnostic workflow framework** that automates the complete software development lifecycle:

- 📋 **Frame** - Fetch and classify work item
- 📐 **Architect** - Design solution and create specification
- 🔨 **Build** - Implement from specification
- 🧪 **Evaluate** - Test and review with retry loop
- 🚀 **Release** - Deploy and create PR

### Key Features

- **Tool-Agnostic**: Works with GitHub, Jira, Linear, GitLab, Bitbucket, etc.
- **Domain-Agnostic**: Supports engineering, design, writing, and data workflows
- **Context-Efficient**: 3-layer architecture reduces token usage by 55-60%
- **Autonomous**: Configurable automation levels (dry-run, assist, guarded, autonomous)
- **Resilient**: Automatic retry loop for failed evaluations
- **Safe**: Protected paths, confirmation gates, and audit trails

## Quick Start

### 1. Initialize FABER

```bash
cd your-project
/fractary-faber:config-init
```

This auto-detects your project settings and creates the `faber:` section in `.fractary/config.yaml`.

### 2. Configure Authentication

```bash
# For GitHub
gh auth login

# For Cloudflare R2 (optional)
aws configure
```

### 3. Plan and Execute Your First Workflow

**New in v3.4.0+**: FABER uses a two-phase approach for better efficiency:

```bash
# Phase 1: Plan (CLI - outside Claude Code)
# Creates plan, git branch, and worktree
fractary-faber workflow-plan --work-id 123

# Phase 2: Execute (Claude Code session)
# Navigate to worktree and run workflow
cd ~/.claude-worktrees/{organization}-{project}-123
claude
/fractary-faber:workflow-run 123
```

**Batch Planning**: Plan multiple workflows at once:

```bash
# Plan workflows for multiple issues
fractary-faber workflow-plan --work-id 123,124,125

# Or search by labels
fractary-faber workflow-plan --work-label "workflow:etl,status:approved"
```

That's it! FABER will:
1. **Plan Phase (CLI)**: Fetch issues, generate plans, create worktrees
2. **Execution Phase (Claude)**: Implement solution, run tests, create PR

**Benefits**:
- ✅ Plan 10+ workflows in one command
- ✅ Each workflow runs in isolated worktree
- ✅ Execute multiple workflows in parallel (different Claude sessions)
- ✅ Claude focuses only on execution (no planning confusion)

## Installation

### Prerequisites

- Claude Code CLI
- Git
- GitHub CLI (`gh`) for GitHub integration
- Python 3.7+ (for configuration parsing)
- AWS CLI (if using Cloudflare R2/S3 storage)

### Install Plugin

```bash
# Clone the repository
git clone https://github.com/fractary/claude-plugins.git

# Navigate to plugins directory
cd claude-plugins/plugins

# The plugin is now available at:
# fractary-faber/
```

Claude Code will automatically discover the plugin.

## Configuration

**FABER v2.0** uses JSON-based configuration with JSON Schema validation and IDE autocompletion.

### Quick Setup

**Option 1: Auto-Initialize** (Recommended)

```bash
/fractary-faber:config-init
```

Creates the `faber:` section in `.fractary/config.yaml` with default workflow configuration.

**Option 2: Use Templates**

```bash
# Choose a template and merge faber: section into .fractary/config.yaml:
# Minimal - Bare essentials
# Standard - Recommended for production (includes plugin integrations)
# Enterprise - Full-featured with hook examples

# Copy the faber: section from the template into your .fractary/config.yaml
# Templates available at: plugins/faber/config/templates/
```

### Configuration Structure

```json
{
  "$schema": "../config.schema.json",
  "schema_version": "2.0",
  "workflows": [{
    "id": "default",
    "phases": {
      "frame": { "enabled": true, "steps": [...] },
      "architect": { "enabled": true, "steps": [...] },
      "build": { "enabled": true, "steps": [...] },
      "evaluate": { "enabled": true, "max_retries": 3, "steps": [...] },
      "release": { "enabled": true, "require_approval": true, "steps": [...] }
    },
    "autonomy": { "level": "guarded" }
  }],
  "integrations": {
    "work_plugin": "fractary-work",
    "repo_plugin": "fractary-repo"
  }
}
```

### Configuration Documentation

- [configuration.md](docs/configuration.md) - Complete configuration reference
- [PROMPT-CUSTOMIZATION.md](docs/PROMPT-CUSTOMIZATION.md) - Workflow customization guide
- [STATE-TRACKING.md](docs/STATE-TRACKING.md) - Dual-state tracking system

## Usage

### GitHub Integration

**Trigger FABER directly from GitHub issues** using labels:

- Add `faber:run` label to trigger workflow
- Use `faber:workflow=hotfix` label to select workflow
- Use `faber:autonomy=autonomous` label to set autonomy level

**Setup** (one-time):
1. Add `.github/workflows/faber.yml` to your repository
2. Add `CLAUDE_CODE_OAUTH_TOKEN` secret
3. Create `.fractary/config.yaml` with a `faber:` section in repository root
4. Add the `faber:run` label to any issue!

Status updates post automatically to GitHub issues. See [GitHub Integration Guide](docs/github-integration.md) for complete setup instructions and examples.

### CLI Commands

**Planning Commands (FABER CLI - v3.4.0+)**:

```bash
# Plan single workflow
fractary-faber workflow-plan --work-id 123

# Plan multiple workflows
fractary-faber workflow-plan --work-id 123,124,125

# Plan by label search
fractary-faber workflow-plan --work-label "workflow:etl,status:approved"

# Override workflow type
fractary-faber workflow-plan --work-id 123 --workflow hotfix

# Skip confirmation (for automation)
fractary-faber workflow-plan --work-id 123 --skip-confirm

# JSON output
fractary-faber workflow-plan --work-id 123 --json
```

**Execution Commands (Claude Code Plugin)**:

```bash
# Initialize FABER in a project
/fractary-faber:config-init

# Execute workflow with work-id (recommended)
/fractary-faber:workflow-run 123

# Or use full plan-id
/fractary-faber:workflow-run fractary-faber-123-20260106-143022

# Check workflow status
/fractary-faber:run-inspect
```

### Advanced Usage

**Note**: Most advanced options are now configured in the plan during the planning phase. The workflow-run command focuses on execution only.

```bash
# Resume an existing workflow
/fractary-faber:workflow-run 123 --resume
```

### Supported Input Formats

FABER accepts multiple issue ID formats:

- **GitHub**: `123`, `#123`, `GH-123`, or full URL
- **Jira**: `PROJ-123` or full URL
- **Linear**: `LIN-123` or full URL

## Workflow Phases

### 1. Frame Phase
- Fetches work item from tracking system (GitHub, Jira, etc.)
- Classifies work type (bug, feature, chore, patch)
- Sets up domain-specific environment
- Creates git branch
- Posts status updates

### 2. Architect Phase
- Analyzes work item and codebase
- Generates detailed implementation specification
- Creates specification file (`.faber/specs/`)
- Commits and pushes specification
- Posts specification URL

### 3. Build Phase
- Implements solution from specification
- Follows domain best practices
- Creates tests/reviews as appropriate
- Commits implementation
- Pushes changes to remote

### 4. Evaluate Phase (with Retry Loop)
- Runs domain-specific tests
- Executes domain-specific review
- Makes GO/NO-GO decision
- **If NO-GO**: Returns to Build phase (up to 3 retries)
- **If GO**: Proceeds to Release
- **If max retries exceeded**: Fails workflow

### 5. Release Phase
- Creates pull request
- Optionally merges PR (if `auto_merge = true`)
- Uploads artifacts to storage
- Posts completion status
- Optionally closes work item

## Autonomy Levels

FABER supports 4 autonomy levels:

| Level | Behavior | Use When |
|-------|----------|----------|
| **dry-run** | Simulates workflow, no changes | Testing setup, debugging |
| **assist** | Stops before Release | Learning, cautious automation |
| **guarded** ⭐ | Pauses at Release for approval | Production workflows (recommended) |
| **autonomous** | Full automation, no pauses | Non-critical changes, internal tools |

⭐ **Recommended**: `guarded` provides the best balance of automation and control.

Set default in the `faber:` section of `.fractary/config.yaml`:

```yaml
faber:
  workflows:
    - autonomy:
        level: guarded
        pause_before_release: true
```

Override per workflow:

```bash
/fractary-faber:workflow-run 123 --autonomy autonomous
```

## Architecture

FABER uses a **3-layer architecture** for context efficiency:

```
Layer 1: Agents (Decision Logic)
   ↓
Layer 2: Skills (Adapter Selection)
   ↓
Layer 3: Scripts (Deterministic Operations)
```

### Why 3 Layers?

**Problem**: Traditional approaches load all code into LLM context (700+ lines)

**Solution**: Only load decision logic. Scripts execute outside context.

**Result**: 55-60% context reduction per manager invocation.

### Components

#### Agents (Decision Makers)
- `faber-planner` - Workflow planning
- `workflow-engineer` - Build phase implementation
- `workflow-inspector` - Audit and inspection
- `workflow-debugger` - Debugging and error handling
- `run-inspect` - Run status inspection
- `session-manager` - Session artifact management
- `configurator` - Project configuration

#### Skills (Adapters)
- `core` - Configuration, sessions, status cards
- `work-manager` - GitHub/Jira/Linear adapters
- `repo-manager` - GitHub/GitLab/Bitbucket adapters
- `file-manager` - R2/S3/local storage adapters

#### Commands (User Interface)
- `/fractary-faber:config-init` - Initialize FABER in a project (first-time setup)
- `/fractary-faber:config-update` - Update existing FABER configuration
- `/fractary-faber:config-validate` - Validate FABER configuration
- `/fractary-faber:workflow-run` - Execute workflow
- `/fractary-faber:workflow-plan` - Plan workflow
- `/fractary-faber:workflow-create` - Create workflow definition
- `/fractary-faber:workflow-update` - Update workflow definition
- `/fractary-faber:workflow-inspect` - Inspect workflow state
- `/fractary-faber:workflow-debugger` - Debug workflow issues
- `/fractary-faber:run-inspect` - Show workflow run status
- `/fractary-faber:session-load` - Load session state
- `/fractary-faber:session-save` - Save session state

## Domain Support

FABER supports multiple work domains:

### Engineering ✅ (Implemented)
- Software development workflows
- Code implementation and testing
- Pull requests and code review

**Usage**: `/fractary-faber:workflow-run 123`

### Design 🚧 (Future)
- Design brief generation
- Asset creation
- Design review and publication

**Usage**: `/fractary-faber:workflow-run 123 --workflow design`

### Writing 🚧 (Future)
- Content outlines
- Writing and editing
- Content review and publication

**Usage**: `/fractary-faber:workflow-run 123 --workflow writing`

### Data 🚧 (Future)
- Pipeline design and implementation
- Data quality checks
- Pipeline deployment

**Usage**: `/fractary-faber:workflow-run 123 --workflow data`

## Platform Support

### Work Tracking
- ✅ GitHub Issues (via `gh` CLI)
- 🚧 Jira (future)
- 🚧 Linear (future)

### Source Control
- ✅ GitHub (via `git` + `gh` CLIs)
- 🚧 GitLab (future)
- 🚧 Bitbucket (future)

### File Storage
- ✅ Cloudflare R2 (via AWS CLI)
- ✅ Local filesystem
- 🚧 AWS S3 (future)

## Examples

### Example 1: Basic Workflow (CLI-First - v3.4.0+)

```bash
# Step 1: Plan the workflow (CLI)
fractary-faber workflow-plan --work-id 123

# Output shows:
# ✓ Plan: fractary-faber-123-20260106-143022
#   Branch: feature/123
#   Worktree: ~/.claude-worktrees/fractary-myproject-123
#   To execute: cd ~/.claude-worktrees/fractary-myproject-123 && claude

# Step 2: Navigate to worktree and execute (Claude Code)
cd ~/.claude-worktrees/fractary-myproject-123
claude
/fractary-faber:workflow-run 123

# FABER executes:
# 1. Frame: Fetches issue, creates branch
# 2. Architect: Generates specification
# 3. Build: Implements solution
# 4. Evaluate: Runs tests (retries if needed)
# 5. Release: Creates PR, waits for approval

# Check status (in Claude session)
/fractary-faber:status

# Approve and merge (manual)
# - Review PR
# - Merge via GitHub UI
```

### Example 2: Batch Planning

```bash
# Plan multiple workflows at once
fractary-faber workflow-plan --work-id 123,124,125

# Or plan by label search
fractary-faber workflow-plan --work-label "workflow:etl,status:approved"

# Output shows all planned workflows with execution instructions
# Execute each in separate Claude sessions (parallel execution)
```

### Example 3: Concurrent Workflows

```bash
# Terminal 1: Execute workflow for issue #123
cd ~/.claude-worktrees/fractary-myproject-123
claude
/fractary-faber:workflow-run 123

# Terminal 2: Execute workflow for issue #124 (parallel!)
cd ~/.claude-worktrees/fractary-myproject-124
claude
/fractary-faber:workflow-run 124

# Each workflow runs in its own worktree with no conflicts
```

## Monitoring and Troubleshooting

### Check Workflow Status

```bash
# Show current workflow status
/fractary-faber:run-inspect

# Inspect workflow details
/fractary-faber:workflow-inspect
```

### View Run Details

```bash
# Run files are stored in:
.fractary/faber/runs/<plan_id>/
```

### Common Issues

#### "Configuration file not found"
**Solution**: Run `/fractary-faber:config-init` or copy a preset

#### "Authentication failed"
**Solution**: Configure platform authentication
- GitHub: `gh auth login`
- R2: `aws configure`

#### "Work item not found"
**Solution**: Verify issue ID and authentication

#### "Evaluate phase failed after 3 retries"
**Solution**: Check test failures in workflow output, review implementation

### Debug Mode

Run with dry-run to see what would happen:

```bash
/fractary-faber:workflow-run 123 --autonomy dry-run
```

## Safety Features

FABER includes multiple safety mechanisms:

### Protected Paths
Prevents modification of critical files:

```yaml
faber:
  safety:
    protected_paths:
      - ".git/"
      - "node_modules/"
      - ".env"
      - "*.key"
      - "*.pem"
```

### Confirmation Gates
Requires approval before critical operations:

```yaml
faber:
  workflows:
    - phases:
        release:
          require_approval: true
      autonomy:
        pause_before_release: true
        require_approval_for:
          - release
```

### Audit Trail
All workflow steps are logged via fractary-logs plugin with complete history.

### Retry Limits
Prevents infinite loops with configurable retry limits:

```yaml
faber:
  workflows:
    - phases:
        evaluate:
          max_retries: 3
```

## Documentation

### Core Documentation
- [Configuration Guide](docs/configuration.md) - Detailed configuration reference
- [Prompt Customization](docs/PROMPT-CUSTOMIZATION.md) - Workflow customization guide
- [Workflow Guide](docs/workflow-guide.md) - In-depth workflow documentation
- [Architecture](docs/architecture.md) - System architecture and design
- [State Tracking](docs/STATE-TRACKING.md) - Dual-state system guide
- [Worktree Management](docs/WORKTREE-MANAGEMENT.md) - Worktree and CLI planning guide
- [Error Codes](docs/ERROR-CODES.md) - Complete error reference
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Problem-to-solution guide

### Technical Specifications
- [SPEC-00029](../../specs/SPEC-00029-FABER-CLI-PLANNING.md) - CLI planning architecture (v3.4.0+)
- [SPEC-00030](../../specs/SPEC-00030-FRACTARY-REPO-ENHANCEMENTS.md) - fractary-repo requirements
- [SPEC-00028](../../specs/SPEC-00028-faber-worktree-management.md) - Worktree management specification

## Development

### Project Structure

```
fractary-faber/
├── agents/           # Workflow orchestration
│   ├── faber-planner.md      # Workflow planning
│   ├── workflow-engineer.md  # Build phase implementation
│   ├── workflow-inspector.md # Audit and inspection
│   ├── workflow-debugger.md  # Debugging and error handling
│   ├── run-inspect.md        # Run status inspection
│   ├── session-manager.md    # Session management
│   └── configurator.md       # Project configuration
├── skills/           # Phase execution & core utilities
│   ├── frame/        # Frame phase skill
│   ├── architect/    # Architect phase skill
│   ├── build/        # Build phase skill
│   ├── evaluate/     # Evaluate phase skill
│   ├── release/      # Release phase skill
│   └── core/         # Core scripts (validation, audit, state)
├── commands/         # User commands
│   ├── configure.md        # Initialize configuration
│   ├── workflow-run.md     # Execute workflow
│   ├── workflow-plan.md    # Plan workflow
│   ├── workflow-create.md  # Create workflow definition
│   ├── workflow-update.md  # Update workflow definition
│   ├── workflow-inspect.md # Inspect workflow state
│   ├── workflow-debugger.md# Debug workflow issues
│   ├── run-inspect.md      # Show run status
│   ├── session-load.md     # Load session state
│   └── session-save.md     # Save session state
├── config/           # Configuration & schemas
│   ├── config.schema.json    # JSON Schema v7
│   ├── templates/            # Configuration templates
│   └── error-codes.json      # Error catalog
├── docs/             # Comprehensive documentation
│   ├── configuration.md
│   ├── PROMPT-CUSTOMIZATION.md
│   ├── workflow-guide.md
│   ├── STATE-TRACKING.md
│   ├── ERROR-CODES.md
│   └── TROUBLESHOOTING.md
└── README.md         # This file
```

### Adding a New Platform Adapter

FABER v2.0 uses companion plugins for platform operations:

- **fractary-work** - Work tracking (GitHub, Jira, Linear)
- **fractary-repo** - Source control (GitHub, GitLab, Bitbucket)
- **fractary-spec** - Specification generation
- **fractary-logs** - Workflow logging

To extend platform support, contribute to the respective plugin. FABER orchestrates via configuration.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- **Issues**: [GitHub Issues](https://github.com/fractary/claude-plugins/issues)
- **Discussions**: [GitHub Discussions](https://github.com/fractary/claude-plugins/discussions)
- **Documentation**: [docs/](docs/)

## Roadmap

### v3.8.14 (Current)
- ✅ **CLI planning architecture** - Separate planning from execution
- ✅ **Batch workflow planning** - Plan multiple workflows at once
- ✅ **Worktree management** - Isolated execution environments
- ✅ **Work-id resolution** - Simplified workflow execution
- ✅ **Organization-scoped paths** - Prevent worktree conflicts

### v2.0 (Released - 2025-11-20)
- ✅ **JSON-based configuration** with JSON Schema validation
- ✅ **Prompt customization** for flexible workflow control
- ✅ **Dual-state tracking** (current + historical logs)
- ✅ **Error handling system** (28 categorized error codes)
- ✅ **Validation & audit tools** (scoring, recommendations)
- ✅ **Atomic state management** with file locking
- ✅ Core FABER workflow (Frame → Architect → Build → Evaluate → Release)
- ✅ GitHub integration with work/repo/spec plugins
- ✅ Autonomy levels (dry-run, assist, guarded, autonomous)

### v4.0 (Planned)
- 🚧 Jira integration (fractary-work plugin)
- 🚧 Linear integration (fractary-work plugin)
- 🚧 GitLab support (fractary-repo plugin)
- 🚧 Bitbucket support (fractary-repo plugin)
- 🚧 AWS S3 storage (fractary-file plugin)
- 🚧 Multi-domain support (design, writing, data)
- 🚧 Team collaboration features
- 🚧 Workflow templates library
- 🚧 Analytics and reporting

## Credits

FABER is built on the [Claude Code](https://claude.com/claude-code) platform by Anthropic.

---

**Made with ❤️ by Fractary**

*Automate your workflow. Ship faster. Focus on what matters.*
