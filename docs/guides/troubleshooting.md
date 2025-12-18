# Troubleshooting Guide

Common issues and solutions for FABER workflows, SDK usage, and CLI operations.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Configuration Problems](#configuration-problems)
- [Authentication Errors](#authentication-errors)
- [Work Tracking Issues](#work-tracking-issues)
- [Repository Operation Errors](#repository-operation-errors)
- [Workflow Execution Problems](#workflow-execution-problems)
- [Specification Issues](#specification-issues)
- [State and Checkpoint Problems](#state-and-checkpoint-problems)
- [Performance Issues](#performance-issues)
- [Debugging Tips](#debugging-tips)

---

## Installation Issues

### CLI Not Found After Installation

**Problem:** After running `npm install -g @fractary/faber-cli`, the `fractary-faber` command is not found.

**Solutions:**

```bash
# Solution 1: Verify npm global bin path is in PATH
npm config get prefix
# Add this to your PATH if not present:
# export PATH="$(npm config get prefix)/bin:$PATH"

# Solution 2: Use npx instead
npx @fractary/faber-cli --version

# Solution 3: Reinstall globally
npm uninstall -g @fractary/faber-cli
npm install -g @fractary/faber-cli

# Solution 4: Check npm global installation directory
npm list -g --depth=0
```

### Module Import Errors in TypeScript

**Problem:** `Cannot find module '@fractary/faber/work'` or similar import errors.

**Solutions:**

```bash
# Solution 1: Ensure package is installed
npm install @fractary/faber

# Solution 2: Check your tsconfig.json moduleResolution
# Add or update in tsconfig.json:
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}

# Solution 3: Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Solution 4: Use root import instead
import { WorkManager } from '@fractary/faber';
```

### Python Import Errors

**Problem:** `ModuleNotFoundError: No module named 'faber'`

**Solutions:**

```bash
# Solution 1: Install the Python package
pip install faber

# Solution 2: Install in development mode
cd sdk/py
pip install -e ".[dev]"

# Solution 3: Check Python version (requires 3.8+)
python --version

# Solution 4: Use virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install faber
```

---

## Configuration Problems

### Configuration File Not Found

**Problem:** `ConfigurationError: No configuration file found`

**Solutions:**

```bash
# Solution 1: Initialize FABER in your project
fractary-faber init

# Solution 2: Create configuration manually
mkdir -p .fractary/faber
cat > .fractary/faber/config.json <<EOF
{
  "version": "1.0.0",
  "preset": "default"
}
EOF

# Solution 3: Check if you're in the correct directory
pwd
# Navigate to project root if needed

# Solution 4: Specify config path explicitly
export FABER_CONFIG_DIR=/path/to/.fractary/faber
```

### Invalid Configuration Schema

**Problem:** `ConfigurationError: Invalid configuration schema`

**Solutions:**

```bash
# Solution 1: Validate JSON syntax
cat .fractary/faber/config.json | jq .

# Solution 2: Check required fields
# Minimum valid configuration:
{
  "version": "1.0.0"
}

# Solution 3: Reinitialize with preset
fractary-faber init --preset default --force

# Solution 4: Check error message for specific field
fractary-faber --debug run --work-id 123
```

### Environment Variable Not Substituted

**Problem:** Configuration shows `${GITHUB_TOKEN}` instead of actual token.

**Solutions:**

```bash
# Solution 1: Verify environment variable is set
echo $GITHUB_TOKEN

# Solution 2: Export the variable
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Solution 3: Add to shell profile for persistence
echo 'export GITHUB_TOKEN=ghp_xxxxx' >> ~/.bashrc
source ~/.bashrc

# Solution 4: Use .env file
npm install dotenv
# In your code:
import 'dotenv/config';
```

---

## Authentication Errors

### GitHub Authentication Failed

**Problem:** `ProviderError: GitHub authentication failed (401)`

**Solutions:**

```bash
# Solution 1: Verify token has required scopes
# Required scopes: repo, read:org, write:discussion
# Create new token at: https://github.com/settings/tokens

# Solution 2: Check token is not expired
# Tokens can expire - create a new one if needed

# Solution 3: Verify token in environment
echo $GITHUB_TOKEN | cut -c1-10  # Show first 10 chars

# Solution 4: Test authentication manually
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user

# Solution 5: Update configuration
cat > .fractary/plugins/work/config.json <<EOF
{
  "platform": "github",
  "owner": "your-org",
  "repo": "your-repo",
  "authentication": {
    "token": "${GITHUB_TOKEN}"
  }
}
EOF
```

### Jira Authentication Failed

**Problem:** `ProviderError: Jira authentication failed`

**Solutions:**

```bash
# Solution 1: Verify API token
# Generate at: https://id.atlassian.com/manage-profile/security/api-tokens

# Solution 2: Check username format
# Use email address, not username
export JIRA_USERNAME=user@example.com

# Solution 3: Test credentials
curl -u "$JIRA_USERNAME:$JIRA_API_TOKEN" \
  "$JIRA_BASE_URL/rest/api/3/myself"

# Solution 4: Verify base URL format
# Correct: https://your-domain.atlassian.net
# Incorrect: https://your-domain.atlassian.net/

export JIRA_BASE_URL=https://your-domain.atlassian.net
```

### Rate Limiting Errors

**Problem:** `ProviderError: API rate limit exceeded (429)`

**Solutions:**

```bash
# Solution 1: Wait for rate limit reset
# GitHub: 5000 requests/hour for authenticated users
# Check reset time in error message

# Solution 2: Use authenticated requests
# Ensure GITHUB_TOKEN is set

# Solution 3: Implement retry logic
# FABER automatically retries with exponential backoff

# Solution 4: Reduce request frequency
# Add delays between operations in scripts:
sleep 1  # Wait 1 second between operations
```

---

## Work Tracking Issues

### Issue Not Found

**Problem:** `IssueNotFoundError: Issue #123 not found`

**Solutions:**

```bash
# Solution 1: Verify issue number
# Check the issue exists in the repository

# Solution 2: Check repository configuration
cat .fractary/plugins/work/config.json
# Ensure owner and repo are correct

# Solution 3: Verify permissions
# Token needs 'repo' scope to access issues

# Solution 4: Try fetching with full details
fractary-faber work issue fetch 123 --debug
```

### Cannot Create Issue

**Problem:** `ProviderError: Failed to create issue`

**Solutions:**

```bash
# Solution 1: Check required fields
fractary-faber work issue create \
  --title "Required title" \
  --body "Optional body"

# Solution 2: Verify repository permissions
# Token needs 'repo' scope for private repos
# Token needs 'public_repo' scope for public repos

# Solution 3: Check repository settings
# Issues may be disabled in repository settings

# Solution 4: Validate label names
# Ensure labels exist before assigning
fractary-faber work label list
```

### Label Operations Fail

**Problem:** `ProviderError: Failed to add labels`

**Solutions:**

```bash
# Solution 1: Create missing labels first
fractary-faber work label create --name "bug" --color "d73a4a"

# Solution 2: Check label name exactness
# Label names are case-sensitive

# Solution 3: List available labels
fractary-faber work label list

# Solution 4: Use multiple label format
fractary-faber work label add 123 --label "bug,critical"
# Not: --label "bug critical"
```

---

## Repository Operation Errors

### Branch Already Exists

**Problem:** `BranchExistsError: Branch 'feature/add-export' already exists`

**Solutions:**

```bash
# Solution 1: Delete existing branch first
fractary-faber repo branch delete feature/add-export

# Solution 2: Use different branch name
fractary-faber repo branch create feature/add-export-v2

# Solution 3: Checkout existing branch instead
git checkout feature/add-export

# Solution 4: Force delete if needed
fractary-faber repo branch delete feature/add-export --force
```

### Push Rejected

**Problem:** `ProviderError: Push rejected - non-fast-forward`

**Solutions:**

```bash
# Solution 1: Pull latest changes first
fractary-faber repo pull

# Solution 2: Rebase on latest
git pull --rebase origin main

# Solution 3: Force push (dangerous - use carefully)
fractary-faber repo push --force
# Warning: This overwrites remote history

# Solution 4: Create new branch
git checkout -b feature/add-export-rebased
```

### PR Merge Conflict

**Problem:** `MergeConflictError: Pull request has conflicts`

**Solutions:**

```bash
# Solution 1: Resolve conflicts locally
git checkout feature-branch
git pull origin main
# Resolve conflicts in editor
git add .
git commit -m "Resolve merge conflicts"
fractary-faber repo push

# Solution 2: Use PR review workflow
fractary-faber repo pr review <number> --action analyze
# Check suggested conflict resolution

# Solution 3: Rebase on target branch
git rebase main
# Resolve conflicts
git rebase --continue
fractary-faber repo push --force

# Solution 4: Close and create new PR
fractary-faber repo pr close <number>
# Create fresh branch and PR
```

### Protected Branch Error

**Problem:** `ProviderError: Cannot push to protected branch`

**Solutions:**

```bash
# Solution 1: Create PR instead of direct push
fractary-faber repo pr create \
  --title "Changes" \
  --base main

# Solution 2: Verify you're not on main
git branch
# Switch to feature branch
git checkout -b feature/changes

# Solution 3: Check branch protection rules
# In GitHub: Settings → Branches → Branch protection rules

# Solution 4: Request admin to adjust protection rules
# If you need to push directly (not recommended)
```

---

## Workflow Execution Problems

### Workflow Hangs or Times Out

**Problem:** Workflow runs indefinitely or times out.

**Solutions:**

```bash
# Solution 1: Check workflow status
fractary-faber status --work-id 123

# Solution 2: Increase timeout in configuration
# Edit .fractary/faber/config.json:
{
  "workflow": {
    "phases": {
      "build": {
        "timeout": 3600000  # 60 minutes
      }
    }
  }
}

# Solution 3: Pause and inspect
# In another terminal:
fractary-faber pause <workflow-id>
fractary-faber status --workflow-id <workflow-id>

# Solution 4: Check for infinite loops in hooks
# Review pre/post hook commands
cat .fractary/faber/config.json | jq '.workflow.hooks'
```

### Phase Fails Repeatedly

**Problem:** Specific FABER phase fails repeatedly.

**Solutions:**

```bash
# Solution 1: Check error details
fractary-faber status --workflow-id <id> --json | jq '.phases'

# Solution 2: Skip failing phase temporarily
fractary-faber run --work-id 123 --skip-phases evaluate

# Solution 3: Adjust retry configuration
{
  "workflow": {
    "phases": {
      "evaluate": {
        "maxRetries": 5  # Increase from default 3
      }
    },
    "errorHandling": {
      "retryOnFailure": true
    }
  }
}

# Solution 4: Run phase manually
# Review what the phase does and replicate manually

# Solution 5: Check hooks
# Pre/post hooks may be failing
fractary-faber run --work-id 123 --debug
```

### Checkpoint Restore Fails

**Problem:** `StateError: Cannot restore from checkpoint`

**Solutions:**

```bash
# Solution 1: List available checkpoints
fractary-faber checkpoint list --workflow-id <id>

# Solution 2: Try earlier checkpoint
fractary-faber recover <workflow-id> \
  --checkpoint <earlier-checkpoint>

# Solution 3: Start from specific phase instead
fractary-faber recover <workflow-id> --from-phase build

# Solution 4: Clear corrupted state
rm -rf .fractary/faber/state/<workflow-id>
# Start fresh
fractary-faber run --work-id 123
```

### User Input Not Received

**Problem:** Workflow pauses but doesn't receive user input.

**Solutions:**

```typescript
// Solution 1: Verify callback is set
faber.setUserInputCallback(async (request) => {
  console.log('Input requested:', request.message);
  // Return boolean response
  return true; // or false
});

// Solution 2: Check autonomy level
// 'assisted' requires user input
// 'autonomous' does not
const result = await faber.run({
  workId: '123',
  autonomy: 'assisted'  // Requires callbacks
});

// Solution 3: Use dry-run to test
const result = await faber.run({
  workId: '123',
  autonomy: 'dry-run'  // Preview only
});

// Solution 4: Check event listeners
faber.addEventListener((event, data) => {
  if (event === 'workflow:pause') {
    console.log('Workflow paused:', data.message);
  }
});
```

---

## Specification Issues

### Spec Validation Fails

**Problem:** `SpecError: Specification validation failed`

**Solutions:**

```bash
# Solution 1: Check validation details
fractary-faber spec validate SPEC-001 --json

# Solution 2: Reduce minimum completeness
# Edit .fractary/plugins/spec/config.json:
{
  "validation": {
    "minCompleteness": 0.5  # Lower from 0.7
  }
}

# Solution 3: Refine specification
fractary-faber spec refine SPEC-001
# Answer refinement questions

# Solution 4: Review missing sections
fractary-faber spec get SPEC-001
# Fill in required sections manually
```

### Cannot Create Spec

**Problem:** `SpecError: Failed to create specification`

**Solutions:**

```bash
# Solution 1: Check spec directory exists
mkdir -p .fractary/faber/specs

# Solution 2: Verify write permissions
ls -la .fractary/faber/specs

# Solution 3: Use valid template
fractary-faber spec create "Title" --template feature
# Valid templates: feature, bug, chore

# Solution 4: Check for duplicate ID
# Spec IDs must be unique
fractary-faber spec list
```

---

## State and Checkpoint Problems

### Corrupted State File

**Problem:** `StateError: Failed to parse state file`

**Solutions:**

```bash
# Solution 1: Validate JSON
cat .fractary/faber/state/<workflow-id>/state.json | jq .

# Solution 2: Restore from checkpoint
fractary-faber recover <workflow-id> --checkpoint latest

# Solution 3: Delete corrupted state
mv .fractary/faber/state/<workflow-id> \
   .fractary/faber/state/<workflow-id>.corrupted
# Start workflow fresh

# Solution 4: Enable state compression
# Edit .fractary/plugins/state/config.json:
{
  "persistence": {
    "compress": false  # Set to false if compression causes issues
  }
}
```

### Workflow State Not Found

**Problem:** `StateError: Workflow state not found`

**Solutions:**

```bash
# Solution 1: List active workflows
fractary-faber status

# Solution 2: Check state directory
ls -la .fractary/faber/state/

# Solution 3: Use work ID instead
fractary-faber status --work-id 123

# Solution 4: Check retention settings
# State may have been cleaned up
cat .fractary/plugins/state/config.json | jq '.cleanup'
```

---

## Performance Issues

### Slow Workflow Execution

**Problem:** Workflows take longer than expected to execute.

**Solutions:**

```bash
# Solution 1: Enable checkpoints for resume capability
{
  "workflow": {
    "checkpoints": true  # Resume from failures
  }
}

# Solution 2: Skip unnecessary phases
fractary-faber run --work-id 123 \
  --skip-phases frame,architect

# Solution 3: Optimize hooks
# Remove or optimize slow pre/post hooks
# Use background processes: command &

# Solution 4: Increase parallelism
# Check if hooks can run in parallel

# Solution 5: Profile phase execution
fractary-faber status --workflow-id <id> --json | \
  jq '.phases[] | {phase: .phase, duration: .duration_ms}'
```

### Large State Files

**Problem:** State files grow too large.

**Solutions:**

```bash
# Solution 1: Enable compression
{
  "state": {
    "persistence": {
      "compress": true
    }
  }
}

# Solution 2: Clean up old state
fractary-faber cleanup --max-age 30

# Solution 3: Reduce checkpoint frequency
{
  "state": {
    "checkpoints": {
      "frequency": "per-phase"  # Not "per-step"
    }
  }
}

# Solution 4: Archive completed workflows
fractary-faber state archive --completed
```

---

## Debugging Tips

### Enable Debug Mode

```bash
# CLI debug mode
fractary-faber --debug run --work-id 123

# Environment variable
export FABER_DEBUG=true
fractary-faber run --work-id 123

# Programmatic debug
import { FaberWorkflow } from '@fractary/faber/workflow';
const faber = new FaberWorkflow({ debug: true });
```

### Inspect Workflow State

```bash
# Get detailed status
fractary-faber status --workflow-id <id> --json | jq .

# View specific phase
fractary-faber status --workflow-id <id> --json | \
  jq '.phases[] | select(.phase == "build")'

# Check checkpoints
fractary-faber checkpoint list --workflow-id <id>
```

### View Logs

```bash
# Capture logs
fractary-faber logs capture <workflow-id>

# Read logs
fractary-faber logs read <session-id>

# Export logs for analysis
fractary-faber logs export <session-id> --format markdown > debug.md
```

### Test Configuration

```typescript
import { loadWorkConfig, loadRepoConfig } from '@fractary/faber';

// Verify configuration loads
try {
  const workConfig = loadWorkConfig();
  console.log('Work config:', workConfig);

  const repoConfig = loadRepoConfig();
  console.log('Repo config:', repoConfig);
} catch (error) {
  console.error('Configuration error:', error.message);
}
```

### Network Debugging

```bash
# Test GitHub API connectivity
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user

# Test Jira API connectivity
curl -u "$JIRA_USERNAME:$JIRA_API_TOKEN" \
  "$JIRA_BASE_URL/rest/api/3/myself"

# Check DNS resolution
nslookup api.github.com

# Test with verbose curl
curl -v -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/owner/repo/issues/123
```

### Common Error Codes

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `ENOENT` | File/directory not found | Check paths, create directories |
| `EACCES` | Permission denied | Check file permissions, use `sudo` if needed |
| `ECONNREFUSED` | Connection refused | Check network, API endpoints |
| `401` | Unauthorized | Check authentication tokens |
| `403` | Forbidden | Check permissions/scopes |
| `404` | Not found | Verify resource exists |
| `409` | Conflict | Resource already exists, use different name |
| `422` | Validation error | Check request parameters |
| `429` | Rate limited | Wait for rate limit reset |
| `500` | Server error | Retry later, check service status |

---

## Getting Help

If you've tried these solutions and still have issues:

1. **Check GitHub Issues**: [https://github.com/fractary/faber/issues](https://github.com/fractary/faber/issues)
2. **Create New Issue**: Include:
   - FABER version: `fractary-faber --version`
   - Node.js version: `node --version`
   - Operating system
   - Full error message
   - Configuration (with secrets redacted)
   - Steps to reproduce
3. **Enable Debug Mode**: Run with `--debug` flag and include output
4. **Check Documentation**: [https://fractary.dev/docs/faber](https://fractary.dev/docs/faber)

---

## See Also

- [Configuration Guide](./configuration.md) - Complete configuration reference
- [API Reference](./api-reference.md) - SDK API documentation
- [CLI Integration Guide](./cli-integration.md) - CLI usage patterns
- [Getting Started](/docs/public/getting-started.md) - Installation guide
