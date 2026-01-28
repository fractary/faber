---
id: KB-perm-001
title: Deployment permission denied
category: permissions
severity: high
symptoms:
  - "Permission denied"
  - "Authentication failed"
  - "Access denied"
  - "Unauthorized"
  - "403 Forbidden"
agents:
  - deployer
  - release-manager
phases:
  - release
context_type: agent
tags:
  - deployment
  - permissions
  - authentication
  - ci-cd
created: 2026-01-28
verified: true
success_count: 7
---

# Deployment Permission Denied

## Symptoms

The release phase fails due to permission or authentication issues:
- `Permission denied` when pushing to repository
- `Authentication failed` during deployment
- `403 Forbidden` from deployment target
- `Access denied` to cloud resources
- GitHub Actions failing with credential errors

## Root Cause

Permission failures during deployment typically result from:
- Expired or invalid credentials/tokens
- Missing required permissions on service account
- Repository branch protection blocking push
- Incorrect secret/environment variable configuration
- Token scope insufficient for required operations

## Solution

Diagnose and resolve the permission issue.

### Actions

1. Identify the specific permission error from logs

2. For GitHub authentication issues:
   - Verify `GITHUB_TOKEN` has required permissions
   - Check repository settings for Actions permissions
   - For fine-grained tokens, verify scope includes required permissions

3. For cloud deployment (AWS/GCP/Azure):
   - Verify service account credentials are valid
   - Check IAM role has required permissions
   - Ensure secrets are correctly configured in CI/CD

4. For branch protection issues:
   - Check if PR is required for protected branches
   - Verify bot/service account is allowed to bypass protections
   - Use proper merge method (PR vs direct push)

5. Refresh or rotate credentials if expired:
   ```bash
   # Example: Re-authenticate with GitHub CLI
   gh auth refresh
   ```

6. Verify environment variables are set:
   ```bash
   # Check if secret is available (shows if set, not value)
   echo "Token is set: ${GITHUB_TOKEN:+yes}"
   ```

7. Re-attempt deployment after fixing credentials

## Prevention

- Set up credential expiration monitoring
- Use OIDC for cloud authentication when possible
- Document required permissions for deployment
- Test deployment permissions in staging first
- Rotate credentials on a schedule before expiration
