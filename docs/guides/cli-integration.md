# CLI Integration Guide

Complete guide to integrating the FABER CLI into your workflows, CI/CD pipelines, and automation scripts.

## Table of Contents

- [Installation](#installation)
- [Basic CLI Usage](#basic-cli-usage)
- [Common CLI Patterns](#common-cli-patterns)
  - [Work Tracking Integration](#work-tracking-integration)
  - [Repository Automation](#repository-automation)
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
    "faber:plan": "fractary-faber workflow-plan",
    "faber:run": "fractary-faber workflow-run",
    "faber:status": "fractary-faber run-inspect"
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
# Initialize configuration
fractary-faber config init

# With options
fractary-faber config init --autonomy guarded --default-workflow default

# Set up GitHub App authentication
fractary-faber auth setup
```

This creates:
- `.fractary/config.yaml` - Unified configuration

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
  --labels "bug,critical" \
  --json)

# Extract issue number
ISSUE_NUMBER=$(echo "$OUTPUT" | jq -r '.data.number')
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
    `--labels "bug,critical" ` +
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
            "--labels", "bug,critical",
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
fractary-faber work issue search --query "bug" \
  --state open \
  --labels bug \
  --json

# Find issues by label
fractary-faber work issue search --query "" \
  --labels "assigned:alice" \
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
BRANCH_NAME="feature/${ISSUE_NUMBER}-$(echo "$TITLE" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')"
fractary-faber repo branch create "$BRANCH_NAME" \
  --base main \
  --checkout \
  --json

echo "Created branch: $BRANCH_NAME"

# Make changes...
# (Your code changes here)

# Commit and push
fractary-faber repo commit \
  --message "feat: ${TITLE}" \
  --type feat \
  --work-id "$ISSUE_NUMBER"

fractary-faber repo push --set-upstream

# Create PR
fractary-faber repo pr create \
  --title "feat: ${TITLE}" \
  --body "Resolves #${ISSUE_NUMBER}"
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
  const branchName = `feature/${issueNumber}-${issue.title.toLowerCase().replace(/ /g, '-')}`;
  const { stdout: branchJson } = await execAsync(
    `fractary-faber repo branch create "${branchName}" ` +
    `--base main ` +
    `--checkout ` +
    `--json`
  );
  const branch = JSON.parse(branchJson);

  console.log(`Created branch: ${branch.name}`);
  return branch;
}

async function commitAndCreatePR(issueNumber: number, message: string) {
  // Commit
  await execAsync(
    `fractary-faber repo commit ` +
    `--message "${message}" ` +
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
    branch_name = f"feature/{issue_number}-{issue['title'].lower().replace(' ', '-')}"
    branch_result = subprocess.run(
        [
            "fractary-faber", "repo", "branch", "create",
            branch_name,
            "--base", "main",
            "--checkout",
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
            "fractary-faber", "repo", "commit",
            "--message", message,
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
fractary-faber repo pr review "$PR_NUMBER" --approve

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

### Workflow Orchestration

#### Run Complete Workflow

**Bash:**
```bash
#!/bin/bash

WORK_ID=$1
AUTONOMY="${2:-supervised}"

# Run workflow
fractary-faber workflow-run --work-id "$WORK_ID" --autonomy "$AUTONOMY"

# Check status
fractary-faber run-inspect --work-id "$WORK_ID"
```

**TypeScript:**
```typescript
async function runWorkflow(
  workId: string,
  autonomy: 'supervised' | 'assisted' | 'autonomous' = 'supervised'
) {
  try {
    const { stdout } = await execAsync(
      `fractary-faber workflow-run --work-id ${workId} --autonomy ${autonomy} --json`
    );
    return JSON.parse(stdout);
  } catch (error) {
    console.error('Workflow failed:', error);

    // Get status for debugging
    const { stdout: statusJson } = await execAsync(
      `fractary-faber run-inspect --work-id ${workId} --json`
    );
    const status = JSON.parse(statusJson);
    console.error('Workflow status:', status);

    throw error;
  }
}
```

**Python:**
```python
def run_workflow(work_id: str, autonomy: str = "supervised") -> dict:
    try:
        result = subprocess.run(
            [
                "fractary-faber", "workflow-run",
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
            ["fractary-faber", "run-inspect", "--work-id", work_id, "--json"],
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
        run: fractary-faber config init --autonomy guarded
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Run FABER Workflow
        run: |
          fractary-faber workflow-run \
            --work-id ${{ github.event.issue.number }} \
            --autonomy supervised
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
    - fractary-faber config init --autonomy guarded
    - fractary-faber workflow-run --work-id $CI_MERGE_REQUEST_IID --autonomy supervised
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
                sh 'fractary-faber config init --autonomy guarded'
            }
        }

        stage('Run Workflow') {
            steps {
                script {
                    def result = sh(
                        script: """
                            fractary-faber workflow-run \
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
                fractary-faber run-inspect --work-id ${params.ISSUE_NUMBER} || true
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

  async runWorkflow(workId: string, autonomy: string = 'supervised') {
    const output = await this.execute([
      'workflow-run',
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
        autonomy: str = "supervised"
    ) -> Dict:
        output = self.execute([
            "workflow-run",
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

`.fractary/config.yaml`:

```yaml
version: "2.0"
github:
  organization: your-org
  project: your-repo
  app:
    id: "12345"
    installation_id: "67890"
    private_key_path: ~/.github/faber-your-org.pem
faber:
  workflows:
    path: .fractary/faber/workflows
    default: default
    autonomy: guarded
  runs:
    path: .fractary/faber/runs
```

See [Configuration Guide](./configuration.md) for full details.

---

## Error Handling

### Handling CLI Errors

**TypeScript:**
```typescript
async function safeRunWorkflow(workId: string) {
  try {
    const { stdout } = await execAsync(
      `fractary-faber workflow-run --work-id ${workId} --json`
    );
    return JSON.parse(stdout);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('FABER CLI not installed');
    } else if (error.stderr?.includes('ConfigurationError')) {
      console.error('Configuration error - run fractary-faber config init');
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
            ["fractary-faber", "workflow-run", "--work-id", work_id, "--json"],
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
            print("Configuration error - run fractary-faber config init")
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

if fractary-faber config validate; then
  echo "Config is valid"
  fractary-faber workflow-run --work-id 123
else
  echo "Config validation failed"
  exit 1
fi
```

### 3. Use Configuration Files for Repeatability

Instead of passing flags every time:

```bash
# Set configuration values
fractary-faber config set faber.workflows.autonomy guarded

# Now run without specifying options
fractary-faber workflow-run --work-id 123
```

### 4. Log CLI Output for Debugging

```typescript
import * as fs from 'fs';

async function runWithLogging(workId: string) {
  const logFile = `logs/workflow-${workId}.log`;

  const proc = spawn('fractary-faber', ['workflow-run', '--work-id', workId]);
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
        ["fractary-faber", "workflow-run", "--work-id", work_id],
        check=True
    )
```

---

## See Also

- [CLI Reference](../public/cli.md) - Complete CLI command reference
- [API Reference](./api-reference.md) - Complete SDK API documentation
- [Configuration Guide](./configuration.md) - Configuration options
