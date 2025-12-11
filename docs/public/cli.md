---
title: CLI Reference
description: Complete reference for all Faber CLI commands
visibility: public
---

# CLI Reference

Complete documentation for the Faber command-line interface.

## Installation

```bash
# Install globally
npm install -g @fractary/faber-cli

# Verify installation
faber --version
```

## Global Options

These options work with all commands:

```bash
--help, -h          Show help
--version, -v       Show version number
--verbose           Show detailed output
--quiet, -q         Suppress non-error output
--config PATH       Path to config file (default: .faber/config.yml)
```

## Commands

### `faber init`

Initialize a new Faber project.

**Usage:**
```bash
faber init [directory] [options]
```

**Arguments:**
- `directory` - Project directory (default: current directory)

**Options:**
```bash
--org ORG              Organization identifier (e.g., acme)
--system SYSTEM        System identifier (e.g., support, engineering)
--platforms PLATFORMS  Comma-separated platform list (e.g., github,slack)
--description DESC     Project description
--force, -f           Overwrite existing project
```

**Examples:**
```bash
# Initialize in current directory
faber init

# Initialize with options
faber init my-agents \
  --org acme \
  --system support \
  --platforms github-issues,slack \
  --description "Support automation agents"

# Force reinitialize existing project
faber init --force
```

**Output:**
```
✓ Created project structure
✓ Generated config file
✓ Created context directories
✓ Project initialized successfully!
```

---

### `faber create`

Create a new concept (role, team, tool, workflow, or eval).

**Usage:**
```bash
faber create <type> <name> [options]
```

**Arguments:**
- `type` - Concept type: `role`, `team`, `tool`, `workflow`, or `eval`
- `name` - Concept name (kebab-case)

**Common Options:**
```bash
--description DESC     Concept description
--org ORG             Organization (default: from config)
--system SYSTEM       System (default: from config)
```

#### Create Role

```bash
faber create role <name> [options]
```

**Options:**
```bash
--description DESC         Role description
--platforms PLATFORMS      Comma-separated platform list
--default-platform PLATFORM Default platform
--agent-type TYPE          Agent type: autonomous, interactive, batch
--color COLOR              UI color (hex format)
```

**Examples:**
```bash
# Basic role
faber create role issue-manager \
  --description "Manages GitHub issues"

# Role with platforms
faber create role support-bot \
  --description "Multi-platform support agent" \
  --platforms github,slack,zendesk \
  --default-platform slack \
  --agent-type interactive

# Role with color
faber create role deploy-manager \
  --description "Manages deployments" \
  --color "#ff5733"
```

#### Create Team

```bash
faber create team <name> [options]
```

**Options:**
```bash
--description DESC        Team description
--members MEMBERS         Comma-separated role names
--coordination TYPE       Coordination type: parallel, sequential, dynamic
--leader ROLE            Leader role name
```

**Examples:**
```bash
# Basic team
faber create team support-team \
  --description "Customer support team"

# Team with members
faber create team devops-team \
  --description "DevOps automation team" \
  --members deploy-manager,monitor-agent,incident-responder \
  --coordination sequential \
  --leader deploy-manager
```

#### Create Tool

```bash
faber create tool <name> [options]
```

**Options:**
```bash
--description DESC       Tool description
--type TYPE             Tool type: api, mcp_server, cli, sdk, custom
--mcp                   Tool is an MCP server
--command CMD           Command to run
--protocols PROTOCOLS   Comma-separated protocols (mcp, rest, grpc)
```

**Examples:**
```bash
# API tool
faber create tool github-api \
  --description "GitHub REST API" \
  --type api

# MCP server
faber create tool slack-mcp \
  --description "Slack MCP server" \
  --type mcp_server \
  --mcp \
  --command "node ./servers/slack.js" \
  --protocols mcp
```

#### Create Workflow

```bash
faber create workflow <name> [options]
```

**Options:**
```bash
--description DESC      Workflow description
--teams TEAMS          Comma-separated team names
--triggers TRIGGERS    Comma-separated trigger types
```

**Examples:**
```bash
# Basic workflow
faber create workflow incident-response \
  --description "Incident response workflow"

# Workflow with teams and triggers
faber create workflow release-process \
  --description "Software release workflow" \
  --teams devops-team,qa-team \
  --triggers manual,scheduled
```

#### Create Eval

```bash
faber create eval <name> [options]
```

**Options:**
```bash
--description DESC        Eval description
--targets TARGETS        Comma-separated role/team names to test
--platforms PLATFORMS    Comma-separated platforms
```

**Examples:**
```bash
# Basic eval
faber create eval issue-manager-tests \
  --description "Issue manager functionality tests"

# Eval with targets
faber create eval support-team-evals \
  --description "Support team integration tests" \
  --targets issue-manager,slack-responder \
  --platforms github,slack
```

---

### `faber list`

List available concepts.

**Usage:**
```bash
faber list [type] [options]
```

**Arguments:**
- `type` - Filter by type: `role`, `team`, `tool`, `workflow`, `eval` (optional)

**Options:**
```bash
--org ORG              Filter by organization
--system SYSTEM        Filter by system
--platform PLATFORM    Filter by platform
--json                 Output as JSON
--verbose              Show detailed information
```

**Examples:**
```bash
# List all concepts
faber list

# List only roles
faber list role

# List with filters
faber list role --platform github

# JSON output
faber list --json

# Verbose output
faber list role --verbose
```

**Output:**
```
Roles:
  issue-manager     Manages and triages GitHub issues
  code-reviewer     Reviews pull requests
  deploy-manager    Manages deployments

Teams:
  support-team      Customer support team
  devops-team       DevOps automation team

Tools:
  github-api        GitHub REST API
  slack-api         Slack API integration

Total: 6 concepts
```

---

### `faber validate`

Validate a concept's structure and configuration.

**Usage:**
```bash
faber validate <type> <name> [options]
```

**Arguments:**
- `type` - Concept type: `role`, `team`, `tool`, `workflow`, `eval`
- `name` - Concept name

**Options:**
```bash
--strict              Enable strict validation
--platform PLATFORM   Validate for specific platform
```

**Examples:**
```bash
# Validate a role
faber validate role issue-manager

# Strict validation
faber validate role issue-manager --strict

# Platform-specific validation
faber validate role issue-manager --platform github
```

**Output (Success):**
```
✓ Validating role: issue-manager
✓ Metadata structure valid
✓ Prompt file exists
✓ Contexts valid
✓ Tasks valid
✓ No issues found

Validation passed!
```

**Output (Errors):**
```
✗ Validating role: issue-manager
✓ Metadata structure valid
✗ Prompt file missing
✗ Context errors:
  - contexts/platform/github.md: Missing 'category' in frontmatter
✗ Task errors:
  - tasks/triage.md: Invalid task format

Validation failed with 3 errors
```

---

### `faber build`

Build/transform a concept for a specific framework.

**Usage:**
```bash
faber build <binding> <type> <name> [options]
```

**Arguments:**
- `binding` - Target binding: `claude-code`, `langgraph`, `crewai`, etc.
- `type` - Concept type: `role`, `team`, `workflow`
- `name` - Concept name

**Options:**
```bash
--output DIR, -o DIR    Output directory (default: ./deployments)
--platform PLATFORM     Target platform
--no-overlays          Skip overlay application
--dry-run              Show what would be built without writing files
--verbose              Show detailed build process
```

**Examples:**
```bash
# Build for Claude Code
faber build claude-code role issue-manager

# Build with platform and output
faber build claude-code role issue-manager \
  --platform github \
  --output ./deployments/prod

# Build without overlays
faber build claude-code role issue-manager \
  --no-overlays

# Dry run
faber build claude-code role issue-manager \
  --dry-run \
  --verbose

# Build a team
faber build claude-code team support-team \
  --platform slack
```

**Output:**
```
Building issue-manager for claude-code...
✓ Loaded concept
✓ Resolved contexts (12 files)
✓ Applied overlays (org, platform)
✓ Transformed for claude-code
✓ Generated 8 files

Output: ./deployments/claude-code/issue-manager/

Files generated:
  - agent.md (12 KB)
  - config.json (1 KB)
  - contexts/ (6 files)

Build complete!
```

---

### `faber deploy`

Deploy a built concept to a target environment.

**Usage:**
```bash
faber deploy <binding> <type> <name> [options]
```

**Arguments:**
- `binding` - Target binding
- `type` - Concept type
- `name` - Concept name

**Options:**
```bash
--target TARGET        Deployment target (local, remote, etc.)
--platform PLATFORM    Target platform
--env ENV             Environment (dev, staging, prod)
--config FILE         Deployment config file
```

**Examples:**
```bash
# Deploy to local Claude Code
faber deploy claude-code role issue-manager --target local

# Deploy to production
faber deploy claude-code role issue-manager \
  --target remote \
  --env prod \
  --config deploy.yml
```

---

### `faber eval`

Run evaluation scenarios.

**Usage:**
```bash
faber eval <name> [options]
```

**Arguments:**
- `name` - Eval name

**Options:**
```bash
--binding BINDING      Run on specific binding (default: claude-code)
--platform PLATFORM    Run on specific platform
--scenarios SCENARIOS  Comma-separated scenario names to run
--verbose             Show detailed test output
```

**Examples:**
```bash
# Run all scenarios
faber eval issue-manager-tests

# Run specific scenarios
faber eval issue-manager-tests \
  --scenarios triage-bug,handle-incomplete

# Run with specific binding
faber eval support-team-evals \
  --binding claude-code \
  --platform github \
  --verbose
```

**Output:**
```
Running eval: issue-manager-tests
Target: issue-manager

Scenario 1/3: triage-critical-bug
  ✓ Issue labeled as 'bug'
  ✓ Priority set to critical
  ✓ Assigned to on-call
  ✓ Passed (3/3 assertions)

Scenario 2/3: handle-incomplete-issue
  ✓ Asks for clarification
  ✓ Provides guidance
  ✓ Passed (2/2 assertions)

Scenario 3/3: identify-duplicate
  ✓ Links to original issue
  ✓ Closes as duplicate
  ✓ Passed (2/2 assertions)

Results: 3/3 passed (100%)
```

---

### `faber config`

Manage project configuration.

**Usage:**
```bash
faber config <action> [key] [value] [options]
```

**Actions:**
- `get` - Get configuration value
- `set` - Set configuration value
- `list` - List all configuration

**Examples:**
```bash
# List all config
faber config list

# Get a value
faber config get org

# Set a value
faber config set org acme

# Set nested value
faber config set platforms.github github-issues

# Enable overlays
faber config set overlays.enabled true
```

---

### `faber context`

Manage contexts.

**Usage:**
```bash
faber context <action> [options]
```

**Actions:**
- `list` - List all contexts
- `show` - Show context content
- `validate` - Validate context files

**Examples:**
```bash
# List all contexts
faber context list

# List by category
faber context list --category platform

# Show context
faber context show platform/github-issues

# Validate all contexts
faber context validate

# Validate by category
faber context validate --category domain
```

---

### `faber overlay`

Manage overlays.

**Usage:**
```bash
faber overlay <action> [options]
```

**Actions:**
- `list` - List available overlays
- `create` - Create new overlay
- `apply` - Preview overlay application
- `validate` - Validate overlay structure

**Examples:**
```bash
# List overlays
faber overlay list

# Create org overlay
faber overlay create org acme

# Create platform overlay
faber overlay create platform github-enterprise

# Preview overlay application
faber overlay apply role issue-manager \
  --overlay org/acme

# Validate overlays
faber overlay validate
```

---

### `faber doctor`

Check project health and diagnose issues.

**Usage:**
```bash
faber doctor [options]
```

**Options:**
```bash
--fix                Attempt to fix issues automatically
--verbose           Show detailed diagnostic information
```

**Examples:**
```bash
# Run diagnostics
faber doctor

# Run with auto-fix
faber doctor --fix

# Verbose output
faber doctor --verbose
```

**Output:**
```
Checking Faber project health...

✓ Configuration file valid
✓ Directory structure correct
✓ All concepts valid
✗ Warning: 3 contexts missing frontmatter
✗ Error: role 'issue-manager' references missing platform 'jira'

Issues found: 1 error, 1 warning

Run 'faber doctor --fix' to auto-fix warnings
```

---

## Environment Variables

Faber respects these environment variables:

```bash
FABER_PROJECT_PATH    Project directory (overrides --project)
FABER_CONFIG_PATH     Config file path (overrides --config)
FABER_LOG_LEVEL       Log level: debug, info, warn, error
FABER_NO_COLOR        Disable colored output
```

**Usage:**
```bash
export FABER_PROJECT_PATH=/path/to/project
export FABER_LOG_LEVEL=debug
faber list
```

## Configuration File

The `.faber/config.yml` file:

```yaml
# Organization and system identifiers
org: acme
system: support

# Platform mappings
platforms:
  github-issues: github
  slack: slack
  zendesk: zendesk

# MCP server configurations (optional)
mcp_servers:
  github:
    command: node
    args:
      - ./servers/github-mcp.js
    env:
      GITHUB_TOKEN: ${GITHUB_TOKEN}

# Overlay configuration
overlays:
  enabled: true
  paths:
    - .faber/overlays
    - ../shared-overlays

# Binding configurations
bindings:
  claude-code:
    auto_activate: true
    context_loading: eager
```

## Exit Codes

Faber uses standard exit codes:

- `0` - Success
- `1` - General error
- `2` - Command usage error
- `3` - Validation error
- `4` - Build/deploy error
- `5` - Configuration error

## Tips and Tricks

### Aliases

Add these to your shell profile for faster workflows:

```bash
alias fi='faber init'
alias fc='faber create'
alias fl='faber list'
alias fv='faber validate'
alias fb='faber build'
alias fd='faber deploy'
```

### Scripting

Use JSON output for scripting:

```bash
# Get all roles as JSON
roles=$(faber list role --json)

# Build multiple agents
for role in $(echo $roles | jq -r '.[].name'); do
  faber build claude-code role $role
done
```

### Watch Mode

Use with `watch` for development:

```bash
# Rebuild on file changes
watch -n 2 faber build claude-code role issue-manager
```

### Shell Completion

Enable shell completion:

```bash
# Bash
faber completion bash >> ~/.bashrc

# Zsh
faber completion zsh >> ~/.zshrc

# Fish
faber completion fish > ~/.config/fish/completions/faber.fish
```

## Next Steps

- [API Reference](./api.md) - Use Faber programmatically
- [Core Concepts](./concepts.md) - Understand Faber architecture
- [Getting Started](./getting-started.md) - Build your first agent
