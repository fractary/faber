# CLI Integration Guide

Complete guide to integrating the FABER CLI into your workflows, CI/CD pipelines, and automation scripts.

## Table of Contents

- [Installation](#installation)
- [Basic CLI Usage](#basic-cli-usage)
- [Common CLI Patterns](#common-cli-patterns)
  - [Work Tracking Integration](#work-tracking-integration)
  - [Repository Automation](#repository-automation)
  - [Specification Management](#specification-management)
  - [Workflow Orchestration](#workflow-orchestration)
- [CI/CD Integration](#cicd-integration)
- [Programmatic CLI Usage](#programmatic-cli-usage)
- [Configuration Management](#configuration-management)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

---

## Installation

### Global Installation

```bash
npm install -g @fractary/faber-cli
```

Verify installation:

```bash
fractary-faber --version
```

### Local Project Installation

```bash
npm install --save-dev @fractary/faber-cli
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "faber": "fractary-faber",
    "faber:run": "fractary-faber run",
    "faber:status": "fractary-faber status"
  }
}
```

### Using npx (No Installation)

```bash
npx @fractary/faber-cli --help
```

---

## Basic CLI Usage

### Initialize a FABER Project

```bash
# Interactive initialization
fractary-faber init

# Use a preset
fractary-faber init --preset minimal
fractary-faber init --preset enterprise
```

This creates:
- `.fractary/faber/config.json` - Main configuration
- `.fractary/plugins/work/config.json` - Work tracking config
- `.fractary/plugins/repo/config.json` - Repository config

### Get Help

```bash
# General help
fractary-faber --help

# Command-specific help
fractary-faber work --help
fractary-faber repo --help
fractary-faber work issue --help
```

### Check Version

```bash
fractary-faber --version
```

---

## Common CLI Patterns

### Work Tracking Integration

#### Fetch and Display Issue

**TypeScript:**
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function fetchIssue(issueNumber: number) {
  const { stdout } = await execAsync(
    `fractary-faber work issue fetch ${issueNumber} --json`
  );
  return JSON.parse(stdout);
}

const issue = await fetchIssue(123);
console.log(`Title: ${issue.title}`);
console.log(`State: ${issue.state}`);
```

**Python:**
```python
import subprocess
import json

def fetch_issue(issue_number: int) -> dict:
    result = subprocess.run(
        ["fractary-faber", "work", "issue", "fetch", str(issue_number), "--json"],
        capture_output=True,
        text=True,
        check=True
    )
    return json.loads(result.stdout)

issue = fetch_issue(123)
print(f"Title: {issue['title']}")
print(f"State: {issue['state']}")
```

#### Create Issue from Script

**Bash:**
```bash
#!/bin/bash

# Create issue and capture output
OUTPUT=$(fractary-faber work issue create \
  --title "Fix authentication bug" \
  --body "Users cannot log in with Google OAuth" \
  --label "bug,critical" \
  --json)

# Extract issue number
ISSUE_NUMBER=$(echo "$OUTPUT" | jq -r '.number')
echo "Created issue #$ISSUE_NUMBER"

# Add to milestone
fractary-faber work milestone set "$ISSUE_NUMBER" --milestone "v1.0"
```

**TypeScript:**
```typescript
async function createBugIssue(title: string, body: string) {
  const { stdout } = await execAsync(
    `fractary-faber work issue create ` +
    `--title "${title}" ` +
    `--body "${body}" ` +
    `--label "bug,critical" ` +
    `--json`
  );

  const issue = JSON.parse(stdout);

  // Add to milestone
  await execAsync(
    `fractary-faber work milestone set ${issue.number} --milestone "v1.0"`
  );

  return issue;
}
```

**Python:**
```python
def create_bug_issue(title: str, body: str) -> dict:
    result = subprocess.run(
        [
            "fractary-faber", "work", "issue", "create",
            "--title", title,
            "--body", body,
            "--label", "bug,critical",
            "--json"
        ],
        capture_output=True,
        text=True,
        check=True
    )

    issue = json.loads(result.stdout)

    # Add to milestone
    subprocess.run(
        [
            "fractary-faber", "work", "milestone", "set",
            str(issue["number"]),
            "--milestone", "v1.0"
        ],
        check=True
    )

    return issue
```

#### Search and Filter Issues

```bash
# Find all open bugs
fractary-faber work issue search "bug" \
  --state open \
  --label bug \
  --json

# Find issues assigned to user
fractary-faber work issue search "" \
  --assignee alice \
  --state open \
  --json
```

### Repository Automation

#### Create Branch and Open PR

**Bash:**
```bash
#!/bin/bash

ISSUE_NUMBER=$1
WORK_TYPE="feature"

# Fetch issue to get title
ISSUE=$(fractary-faber work issue fetch "$ISSUE_NUMBER" --json)
TITLE=$(echo "$ISSUE" | jq -r '.title')

# Create branch
BRANCH_NAME=$(fractary-faber repo branch create \
  --work-id "$ISSUE_NUMBER" \
  --type "$WORK_TYPE" \
  --description "$TITLE" \
  --json | jq -r '.name')

echo "Created branch: $BRANCH_NAME"

# Make changes...
# (Your code changes here)

# Commit and push
fractary-faber repo commit "feat: ${TITLE}" \
  --type feat \
  --work-id "$ISSUE_NUMBER"

fractary-faber repo push --set-upstream

# Create PR
fractary-faber repo pr create \
  --title "feat: ${TITLE}" \
  --body "Resolves #${ISSUE_NUMBER}" \
  --work-id "$ISSUE_NUMBER"
```

**TypeScript:**
```typescript
async function createFeatureBranch(issueNumber: number) {
  // Fetch issue
  const { stdout: issueJson } = await execAsync(
    `fractary-faber work issue fetch ${issueNumber} --json`
  );
  const issue = JSON.parse(issueJson);

  // Create branch
  const { stdout: branchJson } = await execAsync(
    `fractary-faber repo branch create ` +
    `--work-id ${issueNumber} ` +
    `--type feature ` +
    `--description "${issue.title}" ` +
    `--json`
  );
  const branch = JSON.parse(branchJson);

  console.log(`Created branch: ${branch.name}`);
  return branch;
}

async function commitAndCreatePR(issueNumber: number, message: string) {
  // Commit
  await execAsync(
    `fractary-faber repo commit "${message}" ` +
    `--type feat ` +
    `--work-id ${issueNumber}`
  );

  // Push
  await execAsync(`fractary-faber repo push --set-upstream`);

  // Create PR
  const { stdout: prJson } = await execAsync(
    `fractary-faber repo pr create ` +
    `--title "feat: ${message}" ` +
    `--body "Resolves #${issueNumber}" ` +
    `--work-id ${issueNumber} ` +
    `--json`
  );

  return JSON.parse(prJson);
}
```

**Python:**
```python
def create_feature_branch(issue_number: int) -> dict:
    # Fetch issue
    issue_result = subprocess.run(
        ["fractary-faber", "work", "issue", "fetch", str(issue_number), "--json"],
        capture_output=True,
        text=True,
        check=True
    )
    issue = json.loads(issue_result.stdout)

    # Create branch
    branch_result = subprocess.run(
        [
            "fractary-faber", "repo", "branch", "create",
            "--work-id", str(issue_number),
            "--type", "feature",
            "--description", issue["title"],
            "--json"
        ],
        capture_output=True,
        text=True,
        check=True
    )
    branch = json.loads(branch_result.stdout)

    print(f"Created branch: {branch['name']}")
    return branch

def commit_and_create_pr(issue_number: int, message: str) -> dict:
    # Commit
    subprocess.run(
        [
            "fractary-faber", "repo", "commit", message,
            "--type", "feat",
            "--work-id", str(issue_number)
        ],
        check=True
    )

    # Push
    subprocess.run(
        ["fractary-faber", "repo", "push", "--set-upstream"],
        check=True
    )

    # Create PR
    pr_result = subprocess.run(
        [
            "fractary-faber", "repo", "pr", "create",
            "--title", f"feat: {message}",
            "--body", f"Resolves #{issue_number}",
            "--work-id", str(issue_number),
            "--json"
        ],
        capture_output=True,
        text=True,
        check=True
    )

    return json.loads(pr_result.stdout)
```

#### Automated PR Workflow

```bash
#!/bin/bash
# pr-workflow.sh

PR_NUMBER=$1

# Review PR
fractary-faber repo pr review "$PR_NUMBER" --action analyze

# If approved, merge
read -p "Merge this PR? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    fractary-faber repo pr merge "$PR_NUMBER" \
      --strategy squash \
      --delete-branch
fi
```

### Specification Management

#### Create and Validate Spec

**Bash:**
```bash
#!/bin/bash

# Create spec from issue
SPEC_ID=$(fractary-faber spec create \
  "Add authentication" \
  --template feature \
  --work-id 123 \
  --json | jq -r '.id')

echo "Created spec: $SPEC_ID"

# Validate spec
fractary-faber spec validate "$SPEC_ID"

# Refine if needed
fractary-faber spec refine "$SPEC_ID"
```

**TypeScript:**
```typescript
async function createAndValidateSpec(
  title: string,
  workId: number
): Promise<{ id: string; valid: boolean }> {
  // Create spec
  const { stdout: specJson } = await execAsync(
    `fractary-faber spec create "${title}" ` +
    `--template feature ` +
    `--work-id ${workId} ` +
    `--json`
  );
  const spec = JSON.parse(specJson);

  // Validate
  const { stdout: validationJson } = await execAsync(
    `fractary-faber spec validate ${spec.id} --json`
  );
  const validation = JSON.parse(validationJson);

  return {
    id: spec.id,
    valid: validation.status === 'pass'
  };
}
```

**Python:**
```python
def create_and_validate_spec(title: str, work_id: int) -> dict:
    # Create spec
    spec_result = subprocess.run(
        [
            "fractary-faber", "spec", "create", title,
            "--template", "feature",
            "--work-id", str(work_id),
            "--json"
        ],
        capture_output=True,
        text=True,
        check=True
    )
    spec = json.loads(spec_result.stdout)

    # Validate
    validation_result = subprocess.run(
        ["fractary-faber", "spec", "validate", spec["id"], "--json"],
        capture_output=True,
        text=True,
        check=True
    )
    validation = json.loads(validation_result.stdout)

    return {
        "id": spec["id"],
        "valid": validation["status"] == "pass"
    }
```

### Workflow Orchestration

#### Run Complete Workflow

**Bash:**
```bash
#!/bin/bash

WORK_ID=$1
AUTONOMY="${2:-assisted}"

# Run workflow
fractary-faber run --work-id "$WORK_ID" --autonomy "$AUTONOMY"

# Check status
fractary-faber status --work-id "$WORK_ID"
```

**TypeScript:**
```typescript
async function runWorkflow(
  workId: string,
  autonomy: 'dry-run' | 'assisted' | 'guarded' | 'autonomous' = 'assisted'
) {
  try {
    const { stdout } = await execAsync(
      `fractary-faber run --work-id ${workId} --autonomy ${autonomy} --json`
    );
    return JSON.parse(stdout);
  } catch (error) {
    console.error('Workflow failed:', error);

    // Get status for debugging
    const { stdout: statusJson } = await execAsync(
      `fractary-faber status --work-id ${workId} --json`
    );
    const status = JSON.parse(statusJson);
    console.error('Workflow status:', status);

    throw error;
  }
}
```

**Python:**
```python
def run_workflow(work_id: str, autonomy: str = "assisted") -> dict:
    try:
        result = subprocess.run(
            [
                "fractary-faber", "run",
                "--work-id", work_id,
                "--autonomy", autonomy,
                "--json"
            ],
            capture_output=True,
            text=True,
            check=True
        )
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"Workflow failed: {e}")

        # Get status for debugging
        status_result = subprocess.run(
            ["fractary-faber", "status", "--work-id", work_id, "--json"],
            capture_output=True,
            text=True
        )
        status = json.loads(status_result.stdout)
        print(f"Workflow status: {status}")

        raise
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: FABER Workflow

on:
  issues:
    types: [labeled]

jobs:
  run-faber:
    runs-on: ubuntu-latest
    if: contains(github.event.issue.labels.*.name, 'automated')

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install FABER CLI
        run: npm install -g @fractary/faber-cli

      - name: Initialize FABER
        run: fractary-faber init --preset enterprise --yes
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Run FABER Workflow
        run: |
          fractary-faber run \
            --work-id ${{ github.event.issue.number }} \
            --autonomy guarded
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Comment on Issue
        if: success()
        run: |
          fractary-faber work comment create \
            ${{ github.event.issue.number }} \
            --body "✅ FABER workflow completed successfully!"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### GitLab CI

```yaml
faber-workflow:
  stage: automation
  only:
    - labels:
        - automated
  script:
    - npm install -g @fractary/faber-cli
    - fractary-faber init --preset enterprise --yes
    - fractary-faber run --work-id $CI_MERGE_REQUEST_IID --autonomy guarded
  variables:
    GITLAB_TOKEN: $CI_JOB_TOKEN
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any

    environment {
        GITHUB_TOKEN = credentials('github-token')
    }

    parameters {
        string(name: 'ISSUE_NUMBER', description: 'Issue number to process')
        choice(name: 'AUTONOMY', choices: ['dry-run', 'assisted', 'guarded', 'autonomous'])
    }

    stages {
        stage('Install FABER') {
            steps {
                sh 'npm install -g @fractary/faber-cli'
            }
        }

        stage('Initialize') {
            steps {
                sh 'fractary-faber init --preset enterprise --yes'
            }
        }

        stage('Run Workflow') {
            steps {
                script {
                    def result = sh(
                        script: """
                            fractary-faber run \
                                --work-id ${params.ISSUE_NUMBER} \
                                --autonomy ${params.AUTONOMY} \
                                --json
                        """,
                        returnStdout: true
                    )
                    def workflow = readJSON text: result
                    echo "Workflow ${workflow.workflow_id} completed with status: ${workflow.status}"
                }
            }
        }
    }

    post {
        always {
            sh """
                fractary-faber status --work-id ${params.ISSUE_NUMBER} || true
            """
        }
    }
}
```

---

## Programmatic CLI Usage

### TypeScript Integration

```typescript
import { spawn } from 'child_process';

class FaberCLI {
  async execute(command: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('fractary-faber', command);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`CLI failed: ${stderr}`));
        }
      });
    });
  }

  async runWorkflow(workId: string, autonomy: string = 'assisted') {
    const output = await this.execute([
      'run',
      '--work-id', workId,
      '--autonomy', autonomy,
      '--json'
    ]);
    return JSON.parse(output);
  }

  async fetchIssue(issueNumber: number) {
    const output = await this.execute([
      'work', 'issue', 'fetch',
      issueNumber.toString(),
      '--json'
    ]);
    return JSON.parse(output);
  }
}

// Usage
const cli = new FaberCLI();
const workflow = await cli.runWorkflow('123', 'assisted');
```

### Python Integration

```python
import subprocess
import json
from typing import Dict, List, Optional

class FaberCLI:
    def execute(self, command: List[str]) -> str:
        result = subprocess.run(
            ["fractary-faber"] + command,
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout

    def run_workflow(
        self,
        work_id: str,
        autonomy: str = "assisted"
    ) -> Dict:
        output = self.execute([
            "run",
            "--work-id", work_id,
            "--autonomy", autonomy,
            "--json"
        ])
        return json.loads(output)

    def fetch_issue(self, issue_number: int) -> Dict:
        output = self.execute([
            "work", "issue", "fetch",
            str(issue_number),
            "--json"
        ])
        return json.loads(output)

# Usage
cli = FaberCLI()
workflow = cli.run_workflow("123", "assisted")
```

---

## Configuration Management

### Environment Variables

```bash
# GitHub
export GITHUB_TOKEN=<token>

# Jira
export JIRA_BASE_URL=<url>
export JIRA_USERNAME=<username>
export JIRA_API_TOKEN=<token>

# Linear
export LINEAR_API_KEY=<key>
```

### Configuration File

`.fractary/faber/config.json`:

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
  "workflow": {
    "defaultAutonomy": "guarded",
    "phases": ["frame", "architect", "build", "evaluate", "release"],
    "checkpoints": true
  }
}
```

---

## Error Handling

### Handling CLI Errors

**TypeScript:**
```typescript
async function safeRunWorkflow(workId: string) {
  try {
    const { stdout } = await execAsync(
      `fractary-faber run --work-id ${workId} --json`
    );
    return JSON.parse(stdout);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('FABER CLI not installed');
    } else if (error.stderr?.includes('ConfigurationError')) {
      console.error('Configuration error - run fractary-faber init');
    } else {
      console.error('Workflow failed:', error.stderr);
    }
    throw error;
  }
}
```

**Python:**
```python
def safe_run_workflow(work_id: str) -> Optional[dict]:
    try:
        result = subprocess.run(
            ["fractary-faber", "run", "--work-id", work_id, "--json"],
            capture_output=True,
            text=True,
            check=True
        )
        return json.loads(result.stdout)
    except FileNotFoundError:
        print("FABER CLI not installed")
        return None
    except subprocess.CalledProcessError as e:
        if "ConfigurationError" in e.stderr:
            print("Configuration error - run fractary-faber init")
        else:
            print(f"Workflow failed: {e.stderr}")
        return None
```

---

## Best Practices

### 1. Always Use --json for Programmatic Access

```bash
# Good
fractary-faber work issue fetch 123 --json

# Bad (output format may change)
fractary-faber work issue fetch 123
```

### 2. Check Exit Codes

```bash
#!/bin/bash

if fractary-faber spec validate SPEC-001; then
  echo "Spec is valid"
  fractary-faber run --work-id 123
else
  echo "Spec validation failed"
  exit 1
fi
```

### 3. Use Configuration Files for Repeatability

Instead of passing flags every time:

```bash
# Create reusable configuration
cat > .fractary/faber/config.json <<EOF
{
  "workflow": {
    "defaultAutonomy": "guarded",
    "phases": {
      "evaluate": {
        "maxRetries": 3
      }
    }
  }
}
EOF

# Now run without specifying options
fractary-faber run --work-id 123
```

### 4. Log CLI Output for Debugging

```typescript
import * as fs from 'fs';

async function runWithLogging(workId: string) {
  const logFile = `logs/workflow-${workId}.log`;

  const proc = spawn('fractary-faber', ['run', '--work-id', workId]);
  const logStream = fs.createWriteStream(logFile);

  proc.stdout.pipe(logStream);
  proc.stderr.pipe(logStream);

  return new Promise((resolve, reject) => {
    proc.on('close', (code) => {
      logStream.end();
      code === 0 ? resolve(code) : reject(code);
    });
  });
}
```

### 5. Handle Timeouts for Long-Running Operations

```python
import subprocess
from timeout_decorator import timeout

@timeout(600)  # 10 minute timeout
def run_workflow_with_timeout(work_id: str):
    return subprocess.run(
        ["fractary-faber", "run", "--work-id", work_id],
        check=True
    )
```

---

## See Also

- [API Reference](./api-reference.md) - Complete SDK API documentation
- [Configuration Guide](./configuration.md) - Configuration options
- [Troubleshooting Guide](./troubleshooting.md) - Common CLI issues
- [CLI README](/cli/README.md) - CLI command reference
