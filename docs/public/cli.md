---
title: CLI Reference
description: Complete command-line interface documentation for the Faber SDK
visibility: public
---

# CLI Reference

The Faber SDK includes a command-line interface for quick access to all functionality.

## Installation

```bash
# Install globally
npm install -g @fractary/faber

# Verify
fractary --version
```

## Global Options

```bash
fractary [command] [options]

Options:
  -V, --version  Output version number
  -h, --help     Display help for command
```

## Commands Overview

| Command | Description |
|---------|-------------|
| `work` | Work tracking operations |
| `repo` | Repository operations |
| `spec` | Specification management |
| `logs` | Log management |
| `workflow` | FABER workflow orchestration |

---

## Work Commands

Work tracking for GitHub Issues, Jira, and Linear.

### work fetch

Fetch issue details.

```bash
fractary work fetch <issue>
```

**Arguments:**
- `<issue>` - Issue number or ID

**Example:**
```bash
fractary work fetch 123
```

### work create

Create a new issue.

```bash
fractary work create [options]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-t, --title <title>` | Issue title (required) | - |
| `-b, --body <body>` | Issue body | - |
| `--type <type>` | Work type (feature, bug, chore, patch) | feature |
| `-l, --labels <labels>` | Comma-separated labels | - |
| `-a, --assignee <assignee>` | Assignee username | - |

**Example:**
```bash
fractary work create \
  --title "Add CSV export" \
  --body "Users need to export data" \
  --type feature \
  --labels "enhancement,priority:medium"
```

### work search

Search issues.

```bash
fractary work search [query] [options]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-s, --state <state>` | Issue state (open, closed, all) | open |
| `-l, --limit <limit>` | Maximum results | 10 |

**Example:**
```bash
fractary work search "authentication" --state open --limit 20
```

### work close

Close an issue.

```bash
fractary work close <issue>
```

### work comment

Add a comment to an issue.

```bash
fractary work comment <issue> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-b, --body <body>` | Comment body (required) |

**Example:**
```bash
fractary work comment 123 --body "Implementation complete"
```

### work classify

Classify issue work type.

```bash
fractary work classify <issue>
```

**Output:**
```
Work type: feature
```

---

## Repo Commands

Repository and Git operations.

### repo branch create

Create a new branch.

```bash
fractary repo branch create <name> [options]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--base <branch>` | Base branch | Default branch |

**Example:**
```bash
fractary repo branch create feature/add-auth --base main
```

### repo branch list

List branches.

```bash
fractary repo branch list [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--merged` | Show only merged branches |
| `--stale` | Show stale branches |

### repo branch delete

Delete a branch.

```bash
fractary repo branch delete <name> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--force` | Force delete |
| `--remote` | Delete from remote |

### repo pr create

Create a pull request.

```bash
fractary repo pr create [options]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--title <title>` | PR title (required) | - |
| `--body <body>` | PR body | - |
| `--head <branch>` | Source branch | Current branch |
| `--base <branch>` | Target branch | Default branch |
| `--draft` | Create as draft | false |

**Example:**
```bash
fractary repo pr create \
  --title "Add CSV export feature" \
  --head feature/add-export \
  --base main
```

### repo pr list

List pull requests.

```bash
fractary repo pr list [options]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--state <state>` | PR state (open, closed, all) | open |
| `--limit <limit>` | Maximum results | 10 |

### repo pr merge

Merge a pull request.

```bash
fractary repo pr merge <number> [options]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--strategy <strategy>` | Merge strategy (merge, squash, rebase) | merge |
| `--delete-branch` | Delete branch after merge | false |

### repo commit

Create a commit.

```bash
fractary repo commit [options]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-m, --message <message>` | Commit message (required) | - |
| `--type <type>` | Commit type (feat, fix, chore, etc.) | feat |
| `--scope <scope>` | Commit scope | - |
| `--breaking` | Mark as breaking change | false |

**Example:**
```bash
fractary repo commit \
  --message "Add export button" \
  --type feat \
  --scope ui
```

### repo push

Push to remote.

```bash
fractary repo push [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--branch <branch>` | Branch to push |
| `--set-upstream` | Set upstream tracking |
| `--force` | Force push (use carefully) |

### repo pull

Pull from remote.

```bash
fractary repo pull [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--rebase` | Rebase instead of merge |

---

## Spec Commands

Specification management.

### spec create

Create a new specification.

```bash
fractary spec create <title> [options]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--template <template>` | Template (basic, feature, bug, api, infrastructure) | basic |
| `--work-id <id>` | Associated work item ID | - |

**Example:**
```bash
fractary spec create "Add user authentication" \
  --template feature \
  --work-id 123
```

### spec list

List specifications.

```bash
fractary spec list [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--status <status>` | Filter by status (draft, review, approved) |
| `--work-id <id>` | Filter by work item |

### spec validate

Validate a specification.

```bash
fractary spec validate <spec-id>
```

**Output:**
```
Validation Status: warn
Completeness: 75%
Suggestions:
  - Add acceptance criteria
  - Define error handling approach
```

### spec refine

Interactive spec refinement.

```bash
fractary spec refine <spec-id>
```

### spec export

Export a specification.

```bash
fractary spec export <spec-id> [options]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--format <format>` | Output format (markdown, json) | markdown |
| `--output <path>` | Output file path | stdout |

---

## Logs Commands

Session logging and management.

### logs list

List log entries.

```bash
fractary logs list [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--type <type>` | Filter by type (session, error, audit) |
| `--limit <limit>` | Maximum entries |

### logs show

Show log details.

```bash
fractary logs show <log-id>
```

### logs export

Export a log.

```bash
fractary logs export <log-id> [options]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--format <format>` | Output format (markdown, json) | markdown |
| `--output <path>` | Output file path | stdout |

### logs delete

Delete a log.

```bash
fractary logs delete <log-id>
```

---

## Workflow Commands

FABER workflow orchestration.

### workflow run

Run the FABER workflow.

```bash
fractary workflow run <work-id> [options]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--autonomy <level>` | Autonomy level (dry-run, assisted, guarded, autonomous) | assisted |

**Example:**
```bash
fractary workflow run 123 --autonomy assisted
```

**Output:**
```
Starting FABER workflow for work item #123

Phase: Frame
  - Fetching issue... done
  - Classifying work type... feature

Phase: Architect
  - Creating specification... done
  - Spec ID: SPEC-001

Phase: Build
  - Creating branch: feature/123-add-csv-export... done
  - Starting session capture... done

Phase: Evaluate
  - Validating specification... pass

Phase: Release
  - Pushing changes... done
  - Creating PR... done
  - PR #45: https://github.com/org/repo/pull/45

Workflow completed successfully!
```

### workflow status

Check workflow status.

```bash
fractary workflow status <workflow-id>
```

**Output:**
```
Workflow: wf_abc123
Work Item: #123
Status: in_progress
Current Phase: build
Progress: 60%

Phases:
  [x] frame - completed
  [x] architect - completed
  [ ] build - in_progress
  [ ] evaluate - pending
  [ ] release - pending
```

### workflow resume

Resume a paused workflow.

```bash
fractary workflow resume <workflow-id>
```

### workflow pause

Pause a running workflow.

```bash
fractary workflow pause <workflow-id>
```

### workflow list

List workflows.

```bash
fractary workflow list [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--status <status>` | Filter by status (active, completed, failed, paused) |
| `--limit <limit>` | Maximum results |

---

## Configuration

The CLI reads configuration from `.fractary/plugins/{module}/config.json`.

### Initialize Configuration

Create configuration files manually:

```bash
mkdir -p .fractary/plugins/work
cat > .fractary/plugins/work/config.json << EOF
{
  "platform": "github",
  "owner": "your-org",
  "repo": "your-repo"
}
EOF
```

### Configuration Locations

| Module | Path |
|--------|------|
| Work | `.fractary/plugins/work/config.json` |
| Repo | `.fractary/plugins/repo/config.json` |
| Spec | `.fractary/plugins/spec/config.json` |
| Logs | `.fractary/plugins/logs/config.json` |
| State | `.fractary/plugins/state/config.json` |

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Configuration error |
| 3 | Provider error |
| 4 | Workflow error |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub API token (if not using `gh` CLI) |
| `FABER_CONFIG_PATH` | Custom config directory path |
| `FABER_LOG_LEVEL` | Log verbosity (debug, info, warn, error) |

---

## See Also

- [Getting Started](./getting-started.md) - Installation and setup
- [Concepts](./concepts.md) - Core concepts
- [API Reference](./api.md) - Programmatic API
