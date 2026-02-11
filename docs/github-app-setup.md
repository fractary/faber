# GitHub App Authentication Setup Guide

This guide explains how to set up GitHub App authentication for FABER CLI, which provides enhanced security, better audit trails, and enterprise-ready access control compared to Personal Access Tokens (PAT).

## Table of Contents

- [Why GitHub App Authentication?](#why-github-app-authentication)
- [Prerequisites](#prerequisites)
- [Method 1: Automated Setup (Recommended)](#method-1-automated-setup-recommended)
- [Method 2: Manual Setup](#method-2-manual-setup)
- [Step 1: Create a GitHub App](#step-1-create-a-github-app)
- [Step 2: Install the App](#step-2-install-the-app)
- [Step 3: Configure FABER CLI](#step-3-configure-faber-cli)
- [Configuration Examples](#configuration-examples)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)
- [Migration from PAT](#migration-from-pat)

## Why GitHub App Authentication?

| Feature | Personal Access Token (PAT) | GitHub App |
|---------|---------------------------|------------|
| **Identity** | Actions logged under your personal account | Actions logged under app name (clear audit trail) |
| **Token Lifetime** | 90-day expiration (manual renewal) | 1-hour tokens (auto-refreshed) |
| **Permissions** | Broad, user-scoped permissions | Granular, repository/org-scoped permissions |
| **Team Management** | Tokens not easily shareable | Multiple team members use same app |
| **Organizational Control** | Limited central management | Org admins can manage/revoke access |
| **Enterprise Compliance** | Challenging in regulated environments | Better suited for compliance requirements |

## Prerequisites

- GitHub organization or personal account with admin access
- FABER CLI version 1.4.0 or higher
- Repository where you want to use FABER

## Method 1: Automated Setup (Recommended)

The fastest way to set up GitHub App authentication:

```bash
cd your-project
fractary-faber auth setup
```

This command automates the entire setup process:
- Detects your GitHub organization and repository from git config
- Generates a GitHub App with correct permissions
- Guides you through a simple copy-paste flow
- Configures FABER CLI automatically

**Estimated time**: 30 seconds

**What happens:**
1. CLI detects your org/repo from git remotes
2. CLI shows you a GitHub URL to click
3. You review permissions and create the app on GitHub
4. GitHub redirects with a code in the URL
5. You copy the code from your browser's URL bar
6. You paste the code into the CLI
7. CLI fetches app credentials and saves configuration
8. Done! ✓

If the automated setup doesn't work or you prefer manual control, follow Method 2 below.

## Method 2: Manual Setup

For manual control or when the automated setup doesn't work for your environment.

## Step 1: Create a GitHub App

### 1.1 Navigate to GitHub App Settings

**For Organizations:**
1. Go to your organization on GitHub
2. Click **Settings** → **Developer settings** → **GitHub Apps**
3. Click **New GitHub App**

**For Personal Accounts:**
1. Go to your GitHub profile
2. Click **Settings** → **Developer settings** → **GitHub Apps**
3. Click **New GitHub App**

### 1.2 Configure App Settings

Fill in the required fields:

**GitHub App name:**
```
FABER CLI - [Your Org Name]
```
Example: `FABER CLI - Acme Corp`

**Homepage URL:**
```
https://github.com/fractary/faber
```

**Description:**
```
FABER CLI for automated workflow management, issue tracking, and repository operations.
```

**Webhook:**
- Uncheck **Active** (FABER CLI doesn't need webhook events)

### 1.3 Set Repository Permissions

Navigate to **Permissions** and set the following:

| Permission | Access Level | Purpose |
|------------|-------------|---------|
| **Contents** | Read & Write | Read/write repository files |
| **Issues** | Read & Write | Fetch and update issues |
| **Pull requests** | Read & Write | Create and manage PRs |
| **Metadata** | Read | Basic repository info |

**Organization Permissions** (if applicable):
| Permission | Access Level | Purpose |
|------------|-------------|---------|
| **Members** | Read | Team membership info |

### 1.4 Create the App

1. Click **Create GitHub App**
2. You'll see your App ID - **save this number** (you'll need it later)

### 1.5 Generate Private Key

1. Scroll down to **Private keys** section
2. Click **Generate a private key**
3. A `.pem` file will be downloaded
4. **Store this file securely** - you cannot download it again

## Step 2: Install the App

### 2.1 Install on Repositories

1. On your GitHub App page, click **Install App**
2. Select the organization/account where you want to install
3. Choose either:
   - **All repositories** (if you trust the app fully)
   - **Only select repositories** (recommended - choose specific repos)

4. Click **Install**
5. You'll see an Installation ID in the URL or on the installation page
   - URL format: `https://github.com/organizations/[org]/settings/installations/[INSTALLATION_ID]`
   - **Save this Installation ID** - you'll need it for configuration

## Step 3: Configure FABER CLI

### 3.1 Store the Private Key

Move the downloaded `.pem` file to a secure location:

```bash
mkdir -p ~/.github
mv ~/Downloads/your-app-name.*.private-key.pem ~/.github/faber-app.pem
chmod 600 ~/.github/faber-app.pem  # Restrict permissions (Unix/Linux/macOS)
```

### 3.2 Configure FABER Settings

Create or update `.fractary/config.yaml` in your project:

```yaml
version: "2.0"

github:
  organization: your-org-name
  project: your-repo-name
  app:
    id: "123456"
    installation_id: "12345678"
    private_key_path: ~/.github/faber-app.pem
```

**Required Fields:**
- `id`: Your GitHub App ID (from Step 1.4)
- `installation_id`: Installation ID (from Step 2.1)
- `private_key_path`: Path to the `.pem` file (supports `~` for home directory)

**Note:** If you have an existing `.fractary/settings.json`, run `fractary-faber migrate` to convert to the new format.

### 3.3 Verify Configuration

Test that authentication works:

```bash
cd your-project
fractary-faber work issue fetch 1
```

If successful, you'll see issue details. If there's an error, see [Troubleshooting](#troubleshooting).

## Configuration Examples

### File-Based Private Key (Recommended for Local Development)

```yaml
version: "2.0"

github:
  organization: acme-corp
  project: api-service
  app:
    id: "123456"
    installation_id: "12345678"
    private_key_path: ~/.github/faber-app.pem
```

### Environment Variable Private Key (Recommended for CI/CD)

```yaml
version: "2.0"

github:
  organization: acme-corp
  project: api-service
  app:
    id: "123456"
    installation_id: "12345678"
    private_key_env_var: GITHUB_APP_PRIVATE_KEY
```

Set the environment variable with base64-encoded key:

```bash
# Encode the private key
export GITHUB_APP_PRIVATE_KEY=$(cat ~/.github/faber-app.pem | base64)

# Or in one command:
export GITHUB_APP_PRIVATE_KEY=$(base64 < ~/.github/faber-app.pem)
```

**Windows PowerShell:**
```powershell
$key = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes("C:\path\to\key.pem"))
[Environment]::SetEnvironmentVariable("GITHUB_APP_PRIVATE_KEY", $key, "User")
```

### Both Methods (Environment Variable Takes Precedence)

```yaml
version: "2.0"

github:
  organization: acme-corp
  project: api-service
  app:
    id: "123456"
    installation_id: "12345678"
    private_key_path: ~/.github/faber-app.pem
    private_key_env_var: GITHUB_APP_PRIVATE_KEY
```

If both are configured, the environment variable is used first, falling back to the file path if the env var is not set.

### Using Environment Variable Substitution

The config file supports `${VAR}` and `${VAR:-default}` syntax for environment variables:

```yaml
version: "2.0"

anthropic:
  api_key: ${ANTHROPIC_API_KEY}

github:
  organization: ${GITHUB_ORG:-acme-corp}
  project: ${GITHUB_PROJECT:-api-service}
  app:
    id: ${GITHUB_APP_ID}
    installation_id: ${GITHUB_APP_INSTALLATION_ID}
    private_key_path: ${GITHUB_APP_KEY_PATH:-~/.github/faber-app.pem}
```

This allows you to:
- Keep sensitive values out of config files
- Use the same config across environments
- Override values via CI/CD secrets

## CI/CD Integration

### GitHub Actions

**Step 1: Add Private Key as Secret**

1. Go to repository **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `FABER_APP_PRIVATE_KEY`
4. Value: Base64-encoded private key:
   ```bash
   base64 < ~/.github/faber-app.pem
   ```
5. Click **Add secret**

**Step 2: Use in Workflow**

```yaml
name: FABER Workflow

on:
  workflow_dispatch:
    inputs:
      issue_id:
        description: 'Issue ID to process'
        required: true

jobs:
  faber:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install FABER CLI
        run: npm install -g @fractary/faber-cli

      - name: Run FABER Workflow
        env:
          GITHUB_APP_PRIVATE_KEY: ${{ secrets.FABER_APP_PRIVATE_KEY }}
        run: |
          fractary-faber workflow-run --work-id ${{ github.event.inputs.issue_id }}
```

### GitLab CI

```yaml
variables:
  GITHUB_APP_PRIVATE_KEY: $FABER_APP_PRIVATE_KEY

faber_workflow:
  image: node:18
  script:
    - npm install -g @fractary/faber-cli
    - fractary-faber workflow-run --work-id $ISSUE_ID
  only:
    - triggers
```

Add `FABER_APP_PRIVATE_KEY` as a masked CI/CD variable in GitLab project settings.

### Jenkins

```groovy
pipeline {
    agent any

    environment {
        GITHUB_APP_PRIVATE_KEY = credentials('faber-app-private-key')
    }

    stages {
        stage('Run FABER') {
            steps {
                sh 'npm install -g @fractary/faber-cli'
                sh 'fractary-faber workflow-run --work-id ${ISSUE_ID}'
            }
        }
    }
}
```

## Troubleshooting

### Error: "GitHub App private key not found"

**Cause:** FABER can't find the private key file or environment variable.

**Solution:**
1. Check the file path in your configuration
2. Verify the file exists: `ls -la ~/.github/faber-app.pem`
3. If using env var, verify it's set: `echo $GITHUB_APP_PRIVATE_KEY`
4. Ensure path uses absolute path or `~` for home directory

### Error: "Failed to authenticate with GitHub App"

**Cause:** Invalid App ID or private key format.

**Solution:**
1. Verify App ID matches the ID from GitHub App settings
2. Ensure private key file is in PEM format (starts with `-----BEGIN RSA PRIVATE KEY-----`)
3. Try regenerating the private key from GitHub App settings

### Error: "GitHub App installation not found"

**Cause:** Incorrect Installation ID or app not installed on repository.

**Solution:**
1. Verify Installation ID:
   - Go to GitHub App installations page
   - Check the URL: `https://github.com/settings/installations/[ID]`
2. Ensure app is installed on the repository you're trying to access
3. If recently installed, wait a few minutes for propagation

### Error: "Invalid private key format"

**Cause:** Private key is corrupted or incorrectly encoded.

**Solution:**
1. If using env var, ensure base64 encoding is correct:
   ```bash
   # Test decoding
   echo $GITHUB_APP_PRIVATE_KEY | base64 -d | head -n 1
   # Should output: -----BEGIN RSA PRIVATE KEY-----
   ```
2. If file-based, check file integrity:
   ```bash
   head -n 1 ~/.github/faber-app.pem
   # Should output: -----BEGIN RSA PRIVATE KEY----- or -----BEGIN PRIVATE KEY-----
   ```
3. Regenerate private key if corrupted

### Error: "GitHub API rate limited"

**Cause:** Too many API requests in short time.

**Solution:**
- FABER automatically caches tokens for 55 minutes to minimize API calls
- Wait for the rate limit reset time shown in the error message
- Check if multiple instances are running simultaneously

### Token Refresh Issues

If you see authentication errors after long-running workflows:

1. FABER automatically refreshes tokens 5 minutes before expiration
2. Check logs for refresh errors
3. Verify network connectivity to GitHub API
4. Ensure system clock is synchronized (JWT validation is time-sensitive)

## Migration from PAT

### Step 1: Set Up GitHub App (Follow Steps Above)

Complete the GitHub App creation and configuration as described in this guide.

### Step 2: Update Configuration

**Before (PAT with old settings.json):**
```json
{
  "github": {
    "token": "ghp_xxxxxxxxxxxx",
    "organization": "acme-corp",
    "project": "api-service"
  }
}
```

**After (GitHub App with config.yaml):**
```yaml
version: "2.0"

github:
  organization: acme-corp
  project: api-service
  app:
    id: "123456"
    installation_id: "12345678"
    private_key_path: ~/.github/faber-app.pem
```

**During Transition (Both Methods):**
```yaml
version: "2.0"

github:
  token: ${GITHUB_TOKEN}  # Use env var, not hardcoded token
  organization: acme-corp
  project: api-service
  app:
    id: "123456"
    installation_id: "12345678"
    private_key_path: ~/.github/faber-app.pem
```

**Note:** When both PAT and GitHub App are configured, GitHub App takes precedence.

### Step 3: Test GitHub App Authentication

```bash
# Test with a simple command
fractary-faber work issue fetch 1

# Verify audit log shows app name instead of personal account
```

### Step 4: Remove PAT (Optional)

Once confirmed working, remove the `token` field from configuration:

```yaml
version: "2.0"

github:
  organization: acme-corp
  project: api-service
  app:
    id: "123456"
    installation_id: "12345678"
    private_key_path: ~/.github/faber-app.pem
```

### Step 5: Update CI/CD Secrets

Replace PAT secrets with GitHub App private key in your CI/CD platform.

## Security Best Practices

### Local Development

1. **Restrict file permissions:**
   ```bash
   chmod 600 ~/.github/faber-app.pem
   ```

2. **Don't commit private keys:**
   ```bash
   # Add to .gitignore
   echo "*.pem" >> .gitignore
   echo ".fractary/config.yaml" >> .gitignore
   ```

   **Note:** While `config.yaml` can use environment variable references (making it safe to commit), it's recommended to keep it in `.gitignore` as a safety measure.

3. **Use separate apps for different environments:**
   - Development: `FABER CLI - Dev`
   - Production: `FABER CLI - Prod`

### CI/CD

1. **Use secret management:**
   - GitHub Actions: Encrypted secrets
   - GitLab CI: Masked variables
   - Jenkins: Credentials plugin

2. **Rotate keys periodically:**
   - Generate new private key every 90 days
   - Update secret in CI/CD platform
   - Delete old key from GitHub App settings

3. **Limit installation scope:**
   - Install app only on required repositories
   - Use separate installations for different projects

### Organizational

1. **Audit app installations regularly:**
   ```bash
   # Check from Organization settings
   Organization → Settings → GitHub Apps → Installed GitHub Apps
   ```

2. **Review app permissions:**
   - Ensure minimal required permissions
   - Remove unused permissions

3. **Monitor app activity:**
   - Check audit logs for app actions
   - Set up alerts for suspicious activity

## Additional Resources

- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [FABER CLI Repository](https://github.com/fractary/faber)
- [Issue Tracker](https://github.com/fractary/faber/issues)

## Need Help?

- **Documentation Issues:** [Open an issue](https://github.com/fractary/faber/issues/new?labels=documentation)
- **Authentication Problems:** Include error messages and configuration (sanitize sensitive data)
- **Feature Requests:** [Suggest enhancements](https://github.com/fractary/faber/issues/new?labels=enhancement)
