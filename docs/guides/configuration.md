# Configuration Guide

Complete reference for configuring FABER workflows, work tracking, repository management, and all SDK modules.

## Table of Contents

- [Configuration File Locations](#configuration-file-locations)
- [Creating Configuration](#creating-configuration)
- [Configuration Schema](#configuration-schema)
  - [Root Configuration](#root-configuration)
  - [Work Module](#work-module)
  - [Repo Module](#repo-module)
  - [Spec Module](#spec-module)
  - [Logs Module](#logs-module)
  - [State Module](#state-module)
  - [Workflow Module](#workflow-module)
  - [Storage Module](#storage-module)
- [Platform-Specific Configuration](#platform-specific-configuration)
- [Environment Variables](#environment-variables)
- [Presets](#presets)
- [Best Practices](#best-practices)
- [Examples](#examples)

---

## Configuration File Locations

FABER uses a unified YAML configuration file:

```
.fractary/
├── config.yaml                  # Unified configuration (GitHub, Anthropic, FABER)
└── faber/
    ├── workflows/               # Workflow definitions
    │   ├── workflows.yaml       # Workflow manifest
    │   └── default.yaml         # Default workflow config
    └── runs/                    # Run artifacts
```

### Search Order

1. Current directory: `./.fractary/config.yaml`
2. Parent directories (walks up until found)
3. Home directory: `~/.fractary/config.yaml`
4. Default built-in configuration

---

## Creating Configuration

### Using the CLI (Recommended)

```bash
# Initialize FABER section in config.yaml
fractary-faber configure

# Or use config init with options
fractary-faber config init --autonomy guarded

# Force reinitialize
fractary-faber configure --force
```

### Manual Creation

**TypeScript:**
```typescript
import { findProjectRoot } from '@fractary/faber';
import * as fs from 'fs';
import * as path from 'path';

const root = findProjectRoot() || process.cwd();
const configDir = path.join(root, '.fractary', 'faber');
fs.mkdirSync(configDir, { recursive: true });

const config = {
  version: '1.0.0',
  preset: 'default',
  work: { provider: 'github' },
  repo: { provider: 'github', defaultBranch: 'main' },
};

fs.writeFileSync(
  path.join(configDir, 'config.json'),
  JSON.stringify(config, null, 2)
);
```

**Python:**
```python
import os
import json

config_dir = os.path.join(os.getcwd(), '.fractary', 'faber')
os.makedirs(config_dir, exist_ok=True)

config = {
    "version": "1.0.0",
    "preset": "default",
    "work": {"provider": "github"},
    "repo": {"provider": "github", "defaultBranch": "main"}
}

with open(os.path.join(config_dir, 'config.json'), 'w') as f:
    json.dump(config, f, indent=2)
```

---

## Configuration Schema

### Root Configuration

`.fractary/faber/config.json`:

```json
{
  "version": "1.0.0",
  "preset": "default",
  "work": {
    "provider": "github"
  },
  "repo": {
    "provider": "github"
  },
  "spec": {
    "directory": ".fractary/faber/specs"
  },
  "logs": {
    "directory": ".fractary/faber/logs"
  },
  "state": {
    "directory": ".fractary/faber/state"
  },
  "workflow": {
    "defaultAutonomy": "guarded"
  },
  "storage": {
    "provider": "local"
  }
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `version` | string | Yes | `"1.0.0"` | Configuration version |
| `preset` | string | No | `"default"` | Preset name: `minimal`, `default`, `enterprise` |
| `work` | object | No | - | Work module configuration |
| `repo` | object | No | - | Repo module configuration |
| `spec` | object | No | - | Spec module configuration |
| `logs` | object | No | - | Logs module configuration |
| `state` | object | No | - | State module configuration |
| `workflow` | object | No | - | Workflow orchestration configuration |
| `storage` | object | No | - | Storage configuration |

---

### Work Module

`.fractary/plugins/work/config.json`:

```json
{
  "platform": "github",
  "owner": "fractary",
  "repo": "faber",
  "authentication": {
    "token": "${GITHUB_TOKEN}"
  },
  "defaults": {
    "assignOnCreate": true,
    "labelPrefix": "faber:"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `platform` | string | Yes | Work tracking platform: `github`, `jira`, `linear` |
| `owner` | string | Yes* | GitHub organization/user or Jira project key |
| `repo` | string | Yes* | GitHub repository name |
| `baseUrl` | string | No | Custom API base URL (for self-hosted) |
| `authentication.token` | string | Yes | API authentication token |
| `authentication.type` | string | No | Auth type: `token`, `oauth`, `basic` |
| `defaults.assignOnCreate` | boolean | No | Auto-assign creator to new issues |
| `defaults.labelPrefix` | string | No | Prefix for auto-generated labels |

*Required for GitHub/Jira, not for Linear

#### GitHub Configuration

```json
{
  "platform": "github",
  "owner": "fractary",
  "repo": "faber",
  "authentication": {
    "token": "${GITHUB_TOKEN}",
    "type": "token"
  },
  "defaults": {
    "assignOnCreate": true,
    "labelPrefix": "faber:",
    "defaultLabels": ["automated"],
    "defaultMilestone": null
  }
}
```

#### Jira Configuration

```json
{
  "platform": "jira",
  "baseUrl": "https://your-domain.atlassian.net",
  "projectKey": "PROJ",
  "authentication": {
    "type": "basic",
    "username": "${JIRA_USERNAME}",
    "token": "${JIRA_API_TOKEN}"
  },
  "defaults": {
    "issueType": "Task",
    "priority": "Medium"
  }
}
```

#### Linear Configuration

```json
{
  "platform": "linear",
  "authentication": {
    "token": "${LINEAR_API_KEY}"
  },
  "teamId": "TEAM-ID",
  "defaults": {
    "assignOnCreate": false,
    "labelPrefix": "faber:"
  }
}
```

---

### Repo Module

`.fractary/plugins/repo/config.json`:

```json
{
  "platform": "github",
  "owner": "fractary",
  "repo": "faber",
  "authentication": {
    "token": "${GITHUB_TOKEN}"
  },
  "defaultBranch": "main",
  "branchNaming": {
    "prefix": true,
    "includeWorkId": true,
    "separator": "/"
  },
  "commit": {
    "conventionalCommits": true,
    "signCommits": false,
    "gpgKey": null
  },
  "pullRequest": {
    "defaultBase": "main",
    "requestReviewsOnCreate": true,
    "defaultReviewers": ["@team/reviewers"],
    "enableAutoMerge": false
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `platform` | string | Yes | Repository platform: `github`, `gitlab`, `bitbucket` |
| `owner` | string | Yes | Organization or username |
| `repo` | string | Yes | Repository name |
| `authentication.token` | string | Yes | Git platform token |
| `defaultBranch` | string | No | Default branch name (e.g., `main`, `master`) |
| `branchNaming.prefix` | boolean | No | Use type prefixes (`feature/`, `bugfix/`) |
| `branchNaming.includeWorkId` | boolean | No | Include work ID in branch name |
| `commit.conventionalCommits` | boolean | No | Enforce conventional commit format |
| `commit.signCommits` | boolean | No | GPG sign commits |
| `pullRequest.requestReviewsOnCreate` | boolean | No | Auto-request reviews on PR creation |
| `pullRequest.defaultReviewers` | string[] | No | Default reviewers for PRs |

#### GitHub Repo Configuration

```json
{
  "platform": "github",
  "owner": "fractary",
  "repo": "faber",
  "authentication": {
    "token": "${GITHUB_TOKEN}",
    "type": "token"
  },
  "defaultBranch": "main",
  "branchNaming": {
    "prefix": true,
    "includeWorkId": true,
    "separator": "/",
    "format": "{type}/{workId}-{description}"
  },
  "commit": {
    "conventionalCommits": true,
    "signCommits": false,
    "gpgKey": null,
    "includeCoAuthors": true
  },
  "pullRequest": {
    "defaultBase": "main",
    "requestReviewsOnCreate": true,
    "defaultReviewers": ["@fractary/core"],
    "enableAutoMerge": false,
    "requireStatusChecks": true,
    "allowSquashMerge": true,
    "allowMergeCommit": false,
    "allowRebaseMerge": true
  },
  "protectedBranches": ["main", "production"]
}
```

#### GitLab Repo Configuration

```json
{
  "platform": "gitlab",
  "baseUrl": "https://gitlab.com",
  "owner": "fractary",
  "repo": "faber",
  "authentication": {
    "token": "${GITLAB_TOKEN}",
    "type": "token"
  },
  "defaultBranch": "main",
  "branchNaming": {
    "prefix": true,
    "includeWorkId": true,
    "separator": "/"
  },
  "mergeRequest": {
    "defaultBase": "main",
    "removeSourceBranch": true,
    "squash": true
  }
}
```

---

### Spec Module

`.fractary/plugins/spec/config.json`:

```json
{
  "directory": ".fractary/faber/specs",
  "format": "markdown",
  "templates": {
    "feature": {
      "sections": [
        "Overview",
        "Requirements",
        "Architecture",
        "Implementation",
        "Testing",
        "Acceptance Criteria"
      ]
    },
    "bug": {
      "sections": [
        "Problem Description",
        "Root Cause",
        "Solution",
        "Testing",
        "Prevention"
      ]
    }
  },
  "validation": {
    "requireAllSections": false,
    "minCompleteness": 0.6
  },
  "refinement": {
    "enabled": true,
    "maxQuestions": 5
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `directory` | string | Yes | Directory for specification files |
| `format` | string | No | Spec format: `markdown`, `json` |
| `templates` | object | No | Custom spec templates |
| `validation.requireAllSections` | boolean | No | All sections must be filled |
| `validation.minCompleteness` | number | No | Minimum completeness score (0-1) |
| `refinement.enabled` | boolean | No | Enable AI-powered refinement |
| `refinement.maxQuestions` | number | No | Max refinement questions to generate |

---

### Logs Module

`.fractary/plugins/logs/config.json`:

```json
{
  "directory": ".fractary/faber/logs",
  "format": "jsonl",
  "capture": {
    "enabled": true,
    "autoStart": false,
    "includeSystemLogs": true
  },
  "retention": {
    "maxAgeDays": 90,
    "maxSizeMB": 1000,
    "autoArchive": true
  },
  "export": {
    "defaultFormat": "markdown",
    "includeMetadata": true
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `directory` | string | Yes | Directory for log files |
| `format` | string | No | Log format: `jsonl`, `json` |
| `capture.enabled` | boolean | No | Enable log capture |
| `capture.autoStart` | boolean | No | Auto-start capture on workflow run |
| `capture.includeSystemLogs` | boolean | No | Include system/debug logs |
| `retention.maxAgeDays` | number | No | Auto-delete logs older than N days |
| `retention.maxSizeMB` | number | No | Max total log size in MB |
| `retention.autoArchive` | boolean | No | Auto-archive old logs |
| `export.defaultFormat` | string | No | Default export format: `markdown`, `json` |

---

### State Module

`.fractary/plugins/state/config.json`:

```json
{
  "directory": ".fractary/faber/state",
  "checkpoints": {
    "enabled": true,
    "autoCreate": true,
    "frequency": "per-phase"
  },
  "persistence": {
    "format": "json",
    "compress": false
  },
  "cleanup": {
    "autoCleanup": true,
    "retentionDays": 30,
    "keepCompleted": true
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `directory` | string | Yes | Directory for state files |
| `checkpoints.enabled` | boolean | No | Enable checkpoint system |
| `checkpoints.autoCreate` | boolean | No | Auto-create checkpoints |
| `checkpoints.frequency` | string | No | Checkpoint frequency: `per-phase`, `per-step`, `manual` |
| `persistence.format` | string | No | State file format: `json`, `yaml` |
| `persistence.compress` | boolean | No | Compress state files |
| `cleanup.autoCleanup` | boolean | No | Auto-cleanup old state files |
| `cleanup.retentionDays` | number | No | Days to retain completed workflows |

---

### Workflow Module

`.fractary/faber/config.json` (workflow section):

```json
{
  "workflow": {
    "defaultAutonomy": "guarded",
    "phases": {
      "frame": {
        "enabled": true,
        "timeout": 300000
      },
      "architect": {
        "enabled": true,
        "refineSpec": true,
        "minSpecCompleteness": 0.7,
        "timeout": 600000
      },
      "build": {
        "enabled": true,
        "skipTests": false,
        "timeout": 1800000
      },
      "evaluate": {
        "enabled": true,
        "maxRetries": 3,
        "requireTests": true,
        "timeout": 600000
      },
      "release": {
        "enabled": true,
        "requestReviews": true,
        "reviewers": ["@team/reviewers"],
        "autoMerge": false,
        "timeout": 300000
      }
    },
    "hooks": {
      "pre_frame": null,
      "post_frame": null,
      "pre_architect": null,
      "post_architect": null,
      "pre_build": "npm run lint",
      "post_build": "npm test",
      "pre_evaluate": null,
      "post_evaluate": null,
      "pre_release": null,
      "post_release": "npm run deploy:staging"
    },
    "checkpoints": true,
    "maxDuration": 7200000,
    "errorHandling": {
      "retryOnFailure": true,
      "maxRetries": 3,
      "escalateOnFailure": true
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `defaultAutonomy` | string | Default autonomy level: `dry-run`, `assisted`, `guarded`, `autonomous` |
| `phases.{phase}.enabled` | boolean | Enable/disable specific phase |
| `phases.{phase}.timeout` | number | Phase timeout in milliseconds |
| `phases.architect.refineSpec` | boolean | Enable spec refinement in architect phase |
| `phases.architect.minSpecCompleteness` | number | Minimum spec completeness (0-1) |
| `phases.build.skipTests` | boolean | Skip running tests during build |
| `phases.evaluate.maxRetries` | number | Max retry attempts for evaluation |
| `phases.evaluate.requireTests` | boolean | Require tests to pass |
| `phases.release.requestReviews` | boolean | Auto-request PR reviews |
| `phases.release.reviewers` | string[] | Default reviewers |
| `phases.release.autoMerge` | boolean | Auto-merge PR after approval |
| `hooks.{hook}` | string | Shell command to run at hook point |
| `checkpoints` | boolean | Enable checkpoint system |
| `maxDuration` | number | Max workflow duration in milliseconds |
| `errorHandling.retryOnFailure` | boolean | Retry failed operations |
| `errorHandling.maxRetries` | number | Max retry attempts |
| `errorHandling.escalateOnFailure` | boolean | Escalate to user on failure |

---

### Storage Module

`.fractary/plugins/storage/config.json`:

```json
{
  "provider": "local",
  "local": {
    "basePath": ".fractary/faber/storage"
  },
  "codex": {
    "enabled": false,
    "repository": "fractary/codex-core",
    "branch": "main",
    "syncOnStore": false
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `provider` | string | Storage provider: `local`, `codex` |
| `local.basePath` | string | Local storage base path |
| `codex.enabled` | boolean | Enable Codex integration |
| `codex.repository` | string | Codex repository (org/repo) |
| `codex.branch` | string | Codex branch name |
| `codex.syncOnStore` | boolean | Auto-sync to Codex on store |

---

## Platform-Specific Configuration

### GitHub Self-Hosted

```json
{
  "work": {
    "platform": "github",
    "baseUrl": "https://github.company.com/api/v3",
    "owner": "engineering",
    "repo": "platform",
    "authentication": {
      "token": "${GITHUB_ENTERPRISE_TOKEN}"
    }
  },
  "repo": {
    "platform": "github",
    "baseUrl": "https://github.company.com/api/v3",
    "owner": "engineering",
    "repo": "platform",
    "authentication": {
      "token": "${GITHUB_ENTERPRISE_TOKEN}"
    }
  }
}
```

### Jira Cloud

```json
{
  "work": {
    "platform": "jira",
    "baseUrl": "https://your-domain.atlassian.net",
    "projectKey": "PROJ",
    "authentication": {
      "type": "basic",
      "username": "${JIRA_USERNAME}",
      "token": "${JIRA_API_TOKEN}"
    }
  }
}
```

### GitLab

```json
{
  "repo": {
    "platform": "gitlab",
    "baseUrl": "https://gitlab.com",
    "owner": "fractary",
    "repo": "faber",
    "authentication": {
      "token": "${GITLAB_TOKEN}"
    },
    "defaultBranch": "main"
  }
}
```

---

## Environment Variables

### Authentication

```bash
# GitHub
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Jira
export JIRA_BASE_URL=https://your-domain.atlassian.net
export JIRA_USERNAME=user@example.com
export JIRA_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Linear
export LINEAR_API_KEY=lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# GitLab
export GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx

# Bitbucket
export BITBUCKET_USERNAME=username
export BITBUCKET_APP_PASSWORD=xxxxxxxxxxxxxxxxxxxxx
```

### Configuration Paths

```bash
# Override configuration directory
export FABER_CONFIG_DIR=/custom/path/.fractary/faber

# Override specific module configs
export FABER_WORK_CONFIG=/custom/work/config.json
export FABER_REPO_CONFIG=/custom/repo/config.json
```

### Runtime Behavior

```bash
# Default autonomy level
export FABER_AUTONOMY=guarded

# Enable debug logging
export FABER_DEBUG=true

# Disable telemetry
export FABER_TELEMETRY=false
```

---

## Presets

### Minimal Preset

```json
{
  "version": "1.0.0",
  "preset": "minimal",
  "workflow": {
    "defaultAutonomy": "assisted",
    "phases": {
      "frame": { "enabled": true },
      "architect": { "enabled": false },
      "build": { "enabled": true },
      "evaluate": { "enabled": true },
      "release": { "enabled": false }
    }
  }
}
```

Use for: Quick prototyping, simple workflows

### Default Preset

```json
{
  "version": "1.0.0",
  "preset": "default",
  "workflow": {
    "defaultAutonomy": "guarded",
    "phases": {
      "frame": { "enabled": true },
      "architect": { "enabled": true, "refineSpec": true },
      "build": { "enabled": true },
      "evaluate": { "enabled": true, "maxRetries": 2 },
      "release": { "enabled": true, "requestReviews": true }
    }
  }
}
```

Use for: Standard development workflows

### Enterprise Preset

```json
{
  "version": "1.0.0",
  "preset": "enterprise",
  "workflow": {
    "defaultAutonomy": "guarded",
    "phases": {
      "frame": { "enabled": true, "timeout": 300000 },
      "architect": { "enabled": true, "refineSpec": true, "minSpecCompleteness": 0.8 },
      "build": { "enabled": true, "skipTests": false },
      "evaluate": { "enabled": true, "maxRetries": 3, "requireTests": true },
      "release": { "enabled": true, "requestReviews": true, "autoMerge": false }
    },
    "hooks": {
      "pre_build": "npm run lint && npm run type-check",
      "post_build": "npm test && npm run integration-test",
      "post_release": "npm run deploy:staging"
    },
    "checkpoints": true,
    "errorHandling": {
      "retryOnFailure": true,
      "maxRetries": 3,
      "escalateOnFailure": true
    }
  },
  "logs": {
    "capture": {
      "enabled": true,
      "autoStart": true
    },
    "retention": {
      "maxAgeDays": 90,
      "autoArchive": true
    }
  },
  "state": {
    "checkpoints": {
      "enabled": true,
      "autoCreate": true,
      "frequency": "per-phase"
    }
  }
}
```

Use for: Production environments, compliance requirements

---

## Best Practices

### 1. Use Environment Variables for Secrets

```json
{
  "authentication": {
    "token": "${GITHUB_TOKEN}"
  }
}
```

Never commit secrets directly to configuration files.

### 2. Version Your Configuration

```json
{
  "version": "1.0.0"
}
```

Include version field for future compatibility.

### 3. Start with Presets

```bash
fractary-faber init --preset default
```

Then customize as needed.

### 4. Use Hooks for Custom Validation

```json
{
  "hooks": {
    "pre_build": "npm run lint && npm run type-check",
    "post_build": "npm test"
  }
}
```

### 5. Configure Timeouts Appropriately

```json
{
  "phases": {
    "build": {
      "timeout": 1800000  // 30 minutes for complex builds
    }
  }
}
```

---

## Examples

### Full Enterprise Configuration

`.fractary/faber/config.json`:

```json
{
  "version": "1.0.0",
  "preset": "enterprise",
  "work": {
    "provider": "github",
    "owner": "fractary",
    "repo": "faber"
  },
  "repo": {
    "provider": "github",
    "owner": "fractary",
    "repo": "faber",
    "defaultBranch": "main",
    "branchNaming": {
      "prefix": true,
      "includeWorkId": true,
      "format": "{type}/{workId}-{description}"
    },
    "commit": {
      "conventionalCommits": true,
      "signCommits": true,
      "gpgKey": "${GPG_KEY_ID}"
    },
    "pullRequest": {
      "requestReviewsOnCreate": true,
      "defaultReviewers": ["@fractary/core"],
      "requireStatusChecks": true
    }
  },
  "workflow": {
    "defaultAutonomy": "guarded",
    "phases": {
      "frame": { "enabled": true },
      "architect": { "enabled": true, "refineSpec": true, "minSpecCompleteness": 0.8 },
      "build": { "enabled": true },
      "evaluate": { "enabled": true, "maxRetries": 3, "requireTests": true },
      "release": { "enabled": true, "requestReviews": true }
    },
    "hooks": {
      "pre_build": "npm run lint && npm run type-check",
      "post_build": "npm test && npm run integration-test"
    },
    "checkpoints": true
  },
  "storage": {
    "provider": "codex",
    "codex": {
      "enabled": true,
      "repository": "fractary/codex-core",
      "syncOnStore": true
    }
  }
}
```

---

## See Also

- [API Reference](./api-reference.md) - SDK API documentation
- [CLI Integration Guide](./cli-integration.md) - CLI usage patterns
- [Troubleshooting Guide](./troubleshooting.md) - Common configuration issues
- [Getting Started](/docs/public/getting-started.md) - Quick start guide
