# SPEC-00029: GitHub App Manifest Flow for Simplified Authentication Setup

**Type**: Feature Enhancement
**Status**: Draft
**Created**: 2026-01-07
**Author**: System
**Related**: WORK-00041 (GitHub App Authentication)
**Labels**: enhancement, UX improvement, authentication

---

## Executive Summary

Add a simplified GitHub App setup flow using GitHub's App Manifest API, reducing the setup process from 15+ manual steps in the GitHub UI to a single CLI command with simple copy-paste interaction. This enhancement makes FABER CLI's GitHub App authentication as easy to set up as third-party GitHub Apps like Claude or AWS Amplify.

## Motivation

### Current State: High Setup Friction

The current GitHub App authentication setup (WORK-00041) requires users to:
1. Navigate to GitHub App settings (5 clicks)
2. Fill in app details manually (name, URL, description)
3. Configure permissions individually (Contents, Issues, PRs, Metadata)
4. Generate and download private key
5. Find and save Installation ID from URL
6. Move private key to secure location
7. Update `.fractary/settings.json` with 3 IDs
8. Set file permissions correctly

**Result**: 15+ manual steps, ~5-10 minutes, error-prone

### Desired State: One-Command Setup

Similar to public GitHub Apps (Claude, AWS Amplify, GitHub Copilot), users should be able to:
```bash
fractary-faber auth setup

# CLI shows URL → User clicks → Reviews permissions → Creates app
# User copies code from redirect URL → Pastes into CLI → Done ✓
```

**Result**: 1 command, ~30 seconds, automated

### User Feedback

> "why do I have to go and create the github app manually in the interface? I am used to GitHub apps just being something I can install and they get added... Can we make this easier to install just like those third party apps"

## Goals

1. **Simplify UX**: Reduce setup from 15+ steps to 1 command + copy-paste
2. **Maintain Security**: Users still own their credentials (private key stored locally)
3. **No Infrastructure**: No hosted services required (unlike public GitHub Apps)
4. **Backward Compatible**: Existing manual setup continues to work
5. **Cross-Platform**: Works on macOS, Linux, Windows

## Non-Goals

- Public hosted FABER GitHub App (future enhancement)
- Automatic migration of existing PAT configurations
- Direct API app creation (GitHub requires App Manifest flow for this use case)
- Multi-org support in single setup command

## Solution: GitHub App Manifest Flow

### Technical Approach

Use GitHub's [App Manifest API](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest) to automate app creation:

1. **CLI generates manifest** - JSON with FABER's required permissions
2. **Display creation URL** - User clicks to visit GitHub
3. **User reviews and creates** - GitHub shows manifest, user confirms
4. **GitHub redirects with code** - One-time code in URL parameter
5. **User copies code** - From browser URL bar
6. **User pastes into CLI** - CLI prompts for code
7. **CLI exchanges code** - API call to get app credentials
8. **CLI saves credentials** - Updates `.fractary/settings.json`
9. **CLI fetches installation ID** - Separate API call
10. **Setup complete** - Ready to use

### User Experience Flow

```
$ fractary-faber auth setup

Detected GitHub context:
  Organization: fractary
  Repository: faber

✓ This will create a new GitHub App for FABER CLI

Creating GitHub App manifest...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 STEP 1: Create the GitHub App
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please click this URL to create your GitHub App:

👉 https://github.com/settings/apps/new

The app will request these permissions:
  • Contents: Read & Write
  • Issues: Read & Write
  • Pull Requests: Read & Write
  • Metadata: Read

Press Enter when ready...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 STEP 2: Copy the code from the redirect URL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After creating the app, GitHub will redirect you to a URL like:
https://github.com/settings/apps/your-app?code=XXXXXXXXXXXXX

Copy the entire code from the URL bar and paste it below:

Code: █

Exchanging code for credentials...
✓ App created successfully!
  App ID: 123456
  App Name: FABER CLI - fractary

Fetching installation ID...
✓ Installation ID: 12345678

Saving private key to ~/.github/faber-fractary.pem
✓ Private key saved (permissions: 0600)

Updating configuration...
✓ Configuration saved to .fractary/settings.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ Setup Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test your configuration:
  fractary-faber work issue fetch 1

View your app:
  https://github.com/organizations/fractary/settings/apps/faber-cli-fractary
```

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    fractary-faber auth setup                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ├─► Detect Git Context (org/repo)
                  │   └─ Parse git remote URL safely
                  │
                  ├─► Generate App Manifest
                  │   └─ github-app-setup.ts
                  │       └─ generateAppManifest()
                  │
                  ├─► Display Creation URL
                  │   └─ GitHub App creation page with manifest
                  │
                  ├─► User Creates App (GitHub UI)
                  │   └─ User clicks, reviews, creates
                  │
                  ├─► User Copies Code
                  │   └─ From redirect URL parameter
                  │
                  ├─► CLI Prompts for Code
                  │   └─ readline.question()
                  │
                  ├─► Exchange Code for Credentials
                  │   └─ POST /app-manifests/{code}/conversions
                  │       ├─ Returns: app_id, pem, slug
                  │       └─ Does NOT return: installation_id
                  │
                  ├─► Fetch Installation ID
                  │   └─ GET /orgs/{org}/installation
                  │       └─ Authenticate with JWT from pem
                  │
                  ├─► Save Private Key
                  │   └─ ~/.github/faber-{org}.pem (0600)
                  │
                  └─► Update Configuration
                      └─ .fractary/settings.json
                          └─ github.app: { id, installation_id, private_key_path }
```

### New Files

#### 1. Core Service Module

**File**: `cli/src/lib/github-app-setup.ts`

**Purpose**: Handle GitHub App creation via manifest flow

**Key Functions**:
- `generateAppManifest(config: ManifestConfig): GitHubAppManifest` - Create manifest JSON
- `getManifestCreationUrl(manifest: GitHubAppManifest): string` - Generate GitHub URL
- `exchangeCodeForCredentials(code: string): Promise<AppCredentials>` - Exchange manifest code for credentials via API
- `validateAppCredentials(response: ManifestConversionResponse): AppCredentials` - Validate returned data
- `getInstallationId(appId: string, privateKey: string, org: string): Promise<string>` - Fetch installation ID for the app
- `savePrivateKey(privateKey: string, organization: string): Promise<string>` - Save private key with secure permissions
- `formatPermissionsDisplay(manifest: GitHubAppManifest): string` - Format permissions for display

**Key Types**:
```typescript
interface GitHubAppManifest {
  name: string;
  url: string;
  hook_attributes: { url: string };
  permissions: {
    contents: 'read' | 'write';
    issues: 'read' | 'write';
    pull_requests: 'read' | 'write';
    metadata: 'read';
  };
  events: string[];
  public: boolean;
  default_permissions: 'read' | 'write';
}

interface AppCredentials {
  id: string;
  installation_id: string;
  private_key: string;
}
```

**Implementation Notes**:
- Use `@octokit/rest` for GitHub API calls
- Use `@octokit/auth-app` for JWT generation
- Private key must be saved with 0600 permissions
- Installation ID must be fetched separately (not included in manifest conversion response)
- All git operations should use safe command execution (no shell injection)

#### 2. Helper Utilities

**File**: `cli/src/utils/github-manifest.ts`

**Purpose**: Helper functions for manifest flow

**Key Functions**:
- `parseCodeFromUrl(url: string): string | null` - Extract code parameter from URL
- `validateManifestCode(code: string): boolean` - Validate code format before API call
- `detectGitHubContext(): { org: string; repo: string } | null` - Auto-detect from git remote (safely)
- `isGitRepository(): boolean` - Check if current directory is a git repository

**Implementation Notes**:
- URL parsing should handle both full URLs and code-only input
- Git operations must be executed safely (use Bash tool or safe wrapper)
- All validation should fail closed (reject if uncertain)

#### 3. Auth Command

**File**: `cli/src/commands/auth/index.ts`

**Purpose**: CLI command implementation

**Command**: `fractary-faber auth setup`

**Options**:
- `--org <name>` - Override detected organization
- `--repo <name>` - Override detected repository
- `--config-path <path>` - Where to save settings (default: `.fractary/settings.json`)
- `--show-manifest` - Display manifest JSON before showing URL
- `--no-save` - Display credentials without saving to file

**Flow**:
1. Detect or prompt for GitHub context (org/repo)
2. Check if already configured (prompt to overwrite)
3. Generate app manifest with FABER permissions
4. Display clickable URL to GitHub app creation page
5. Show clear instructions: "Click URL → Create app → Copy code from redirect URL"
6. Prompt user to paste the code from URL bar (with retry logic)
7. Exchange code for app credentials via GitHub API
8. Fetch installation ID for the organization
9. Save private key to `~/.github/faber-{org}.pem`
10. Write configuration to `.fractary/settings.json`
11. Display success message with verification command

**Interactive Prompts**:
- Use Node.js `readline` module for input
- Show colored output with `chalk`
- Display step-by-step instructions clearly
- Allow 3 attempts for code entry
- Handle Ctrl+C gracefully

### Files to Modify

#### 1. CLI Entry Point

**File**: `cli/src/index.ts`

**Change**: Register new auth command group

```typescript
// Add import
import { createAuthCommand } from './commands/auth/index.js';

// Add command (after other commands)
program.addCommand(createAuthCommand());
```

#### 2. Configuration Types

**File**: `cli/src/types/config.ts`

**Change**: Add tracking fields to GitHubAppConfig

```typescript
export interface GitHubAppConfig {
  id: string;
  installation_id: string;
  private_key_path?: string;
  private_key_env_var?: string;
  created_via?: 'manifest-flow' | 'manual';  // NEW: Track how app was created
  created_at?: string;                        // NEW: Timestamp of creation
}
```

#### 3. CLI README

**File**: `cli/README.md`

**Change**: Add automated setup as primary authentication method

Add new section before existing commands:

```markdown
## Quick Start

### 1. Install

```bash
npm install -g @fractary/faber-cli
```

### 2. Authenticate with GitHub

**Option A: Automated Setup (Recommended)**

```bash
cd your-project
fractary-faber auth setup
```

This command will:
1. Detect your GitHub organization and repository
2. Show you a URL to create a GitHub App
3. Guide you through copying the authorization code
4. Automatically configure FABER CLI

All in ~30 seconds!

**Option B: Manual Setup**

See [GitHub App Setup Guide](../docs/github-app-setup.md) for detailed manual instructions.

### 3. Initialize FABER

```bash
fractary-faber init
```
```

#### 4. GitHub App Setup Documentation

**File**: `docs/github-app-setup.md`

**Change**: Add automated setup as Method 1

Insert at the beginning of the setup section:

```markdown
## Setup Methods

### Method 1: Automated Setup (Recommended)

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

### Method 2: Manual Setup

If you prefer manual control or the automated setup doesn't work for your environment, follow the detailed manual setup guide below.

[Continue with existing manual setup instructions...]
```

#### 5. CHANGELOG

**File**: `CHANGELOG.md`

**Change**: Add to [Unreleased] section

```markdown
### Added
- **Automated GitHub App Setup** - One-command setup using GitHub App Manifest flow
  - New `fractary-faber auth setup` command
  - Reduces setup from 15+ manual steps to single command with copy-paste
  - Automatic credential configuration and private key storage
  - Cross-platform support (macOS, Linux, Windows)
  - Auto-detects GitHub context from git remotes
```

## GitHub App Manifest API

### Endpoint: Convert Manifest Code

```
POST https://api.github.com/app-manifests/{code}/conversions
```

**Request**: No body required, code is in URL path

**Response**:
```json
{
  "id": 123456,
  "slug": "faber-cli-acme",
  "name": "FABER CLI - Acme Corp",
  "node_id": "...",
  "owner": {
    "login": "acme-corp",
    "id": 789
  },
  "description": "FABER CLI for automated workflow management...",
  "external_url": "https://github.com/fractary/faber",
  "html_url": "https://github.com/apps/faber-cli-acme",
  "created_at": "2026-01-07T12:00:00Z",
  "updated_at": "2026-01-07T12:00:00Z",
  "permissions": {
    "contents": "write",
    "issues": "write",
    "metadata": "read",
    "pull_requests": "write"
  },
  "events": [],
  "installations_count": 1,
  "client_id": "Iv1.abcd1234",
  "client_secret": "...",
  "webhook_secret": null,
  "pem": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
}
```

**Note**: Installation ID must be fetched separately using:
- `GET /orgs/{org}/installation` (for organizations)
- `GET /users/{username}/installation` (for personal accounts)

## Implementation Sequence

### Phase 1: Core Service Module (2-3 hours)
1. Create `cli/src/lib/github-app-setup.ts`
2. Implement manifest generation
3. Implement API code exchange
4. Implement installation ID fetching
5. Implement private key storage
6. Add comprehensive error handling

### Phase 2: Helper Utilities (1 hour)
1. Create `cli/src/utils/github-manifest.ts`
2. Implement safe code parsing
3. Implement safe git context detection
4. Add validation functions

### Phase 3: Auth Command (2-3 hours)
1. Create `cli/src/commands/auth/index.ts`
2. Implement interactive prompts with readline
3. Implement step-by-step workflow
4. Add comprehensive error messages
5. Add colored output with chalk

### Phase 4: Integration (1 hour)
1. Update `cli/src/index.ts` to register auth command
2. Update `cli/src/types/config.ts` with new fields
3. Test command registration and help text

### Phase 5: Documentation (1 hour)
1. Update `cli/README.md` with quick start section
2. Update `docs/github-app-setup.md` with automated method
3. Update `CHANGELOG.md` with new feature

### Phase 6: Testing (2-3 hours)
1. Write unit tests for github-app-setup.ts
2. Write unit tests for github-manifest.ts
3. Write integration tests for auth command
4. Test error scenarios
5. Test on multiple platforms (if available)

### Phase 7: Manual Testing (1 hour)
1. Test full flow end-to-end
2. Test error cases manually
3. Test on different platforms
4. Verify configuration correctness
5. Verify private key permissions

**Total Estimated Time**: 10-12 hours

## Testing Strategy

### Unit Tests

**File**: `cli/src/lib/__tests__/github-app-setup.test.ts`

Test coverage:
- ✅ Manifest generation with correct permissions
- ✅ Custom app name support
- ✅ Credential validation (missing ID, missing PEM, invalid PEM format)
- ✅ Private key storage with correct permissions
- ✅ Installation ID fetching with proper authentication
- ✅ Error handling for API failures

**File**: `cli/src/utils/__tests__/github-manifest.test.ts`

Test coverage:
- ✅ Parse code from full URL
- ✅ Parse code-only input
- ✅ Reject invalid input
- ✅ Validate correct code format
- ✅ Reject short or invalid codes
- ✅ Git context detection (HTTPS and SSH URLs)
- ✅ Git repository validation

### Integration Tests

**File**: `cli/src/commands/auth/__tests__/setup.integration.test.ts`

Test coverage:
- ✅ Complete setup flow with mocked GitHub API
- ✅ Invalid code handling
- ✅ Existing configuration detection and overwrite prompt
- ✅ Command with --org and --repo flags outside git repo
- ✅ --show-manifest flag
- ✅ --no-save flag

### Manual Testing Checklist

- [ ] Run `fractary-faber auth setup` in a git repository
- [ ] Verify URL is displayed correctly
- [ ] Create GitHub App via URL
- [ ] Copy code from redirect URL
- [ ] Paste code into CLI
- [ ] Verify app credentials are saved correctly
- [ ] Verify private key has 0600 permissions
- [ ] Verify `.fractary/settings.json` format
- [ ] Run `fractary-faber work issue fetch 1` to test authentication
- [ ] Test with `--org` and `--repo` flags outside git repo
- [ ] Test `--show-manifest` flag
- [ ] Test `--no-save` flag
- [ ] Test error: invalid code
- [ ] Test error: expired code
- [ ] Test error: app not installed on org
- [ ] Test on macOS (if available)
- [ ] Test on Linux (if available)
- [ ] Test on Windows (if available)

## Error Handling

### User Errors

| Error | Message | Recovery |
|-------|---------|----------|
| Not in git repo | "This directory is not a Git repository. Run from a project with GitHub remotes or use --org and --repo flags." | Provide flags or cd to git repo |
| Cannot detect context | "Could not detect GitHub organization/repository. Please provide --org and --repo flags." | Use command flags |
| Invalid code format | "Invalid code format. The code should be a long alphanumeric string from the GitHub redirect URL." | Retry with correct code (3 attempts) |
| Code expired/used | "The code has expired or been used. Please run 'fractary-faber auth setup' again to generate a new URL." | Run command again to get new URL |
| App not installed | "GitHub App not installed on organization '{org}'. Please install the app first by visiting the app settings." | Visit installation URL provided |
| Already configured | "GitHub App already configured in .fractary/settings.json." | Confirm overwrite or cancel |

### System Errors

| Error | Message | Recovery |
|-------|---------|----------|
| API network error | "Failed to exchange code: {error}. Please check your internet connection and try again." | Retry when online |
| Permission denied (config) | "Cannot save config to {path}. Check file permissions." | Fix permissions or use --config-path |
| Permission denied (key) | "Error saving private key: {error}. You can manually save the private key to ~/.github/ directory." | Provide manual save instructions |
| API rate limited | "GitHub API rate limit exceeded. Please wait a few minutes and try again." | Wait and retry |

## Success Criteria

- ✅ Users can run single command to create GitHub App
- ✅ Setup takes < 1 minute with 1 copy-paste operation
- ✅ No manual GitHub UI navigation (except review/create step)
- ✅ Credentials automatically saved to correct locations
- ✅ Private key has secure permissions (0600 on Unix)
- ✅ Clear step-by-step instructions displayed
- ✅ Comprehensive error handling with recovery guidance
- ✅ Works on macOS, Linux, Windows
- ✅ >80% test coverage on new code
- ✅ Documentation updated with automated setup as primary method
- ✅ Backward compatible with manual setup

## Security Considerations

1. **Private Key Storage**
   - Stored in `~/.github/` directory with 0600 permissions (Unix)
   - Path uses tilde (`~`) for home directory portability
   - Never logged or displayed in output (except with --no-save flag)
   - Validated as proper PEM format before saving

2. **Code Validation**
   - Validate code format before making API call
   - Codes are single-use only (cannot be reused)
   - Expiry handled automatically by GitHub

3. **Command Injection Prevention**
   - All git operations must use safe command execution
   - No shell evaluation of user input
   - Use parameterized commands, not string concatenation

4. **Configuration Storage**
   - `.fractary/settings.json` should be in `.gitignore`
   - Contains paths only, not actual secrets
   - Private key referenced by file path, not embedded

5. **Error Messages**
   - Don't expose sensitive data in error messages
   - Generic messages for security-related failures
   - Detailed logs only in debug mode (if implemented)

## Migration Path

### For New Users
1. Run `fractary-faber auth setup`
2. Done ✓

### For Existing PAT Users
1. Run `fractary-faber auth setup`
2. Confirm overwriting existing config when prompted
3. Old PAT removed from active config (can be added back manually if needed)

### For Existing Manual GitHub App Users
1. Run `fractary-faber auth setup`
2. Creates new app (doesn't interfere with existing app)
3. Updates config to use new app
4. Old app can be deleted manually from GitHub settings if desired

## Future Enhancements

1. **Additional Auth Commands**
   - `fractary-faber auth validate` - Test current authentication
   - `fractary-faber auth list` - Show all installed apps
   - `fractary-faber auth revoke` - Uninstall and remove app
   - `fractary-faber auth refresh` - Force token refresh

2. **Public FABER GitHub App**
   - Hosted app for true one-click install
   - No local private key needed
   - Managed by Fractary organization
   - Requires hosting infrastructure

3. **Enhanced Features**
   - Multi-org support in single command
   - Keychain integration for private key storage
   - Automatic PAT to GitHub App migration
   - Interactive app permission customization

## Dependencies

### Production Dependencies (Already Available)
- `@octokit/rest` - GitHub API client
- `@octokit/auth-app` - GitHub App authentication
- `commander` - CLI framework
- `chalk` - Colored terminal output
- `readline` - User input (Node.js built-in)

### No New Dependencies Required ✓

## References

- [GitHub App Manifest Documentation](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest)
- [GitHub Apps API Reference](https://docs.github.com/en/rest/apps)
- [WORK-00041: GitHub App Authentication](./WORK-00041-github-app-authentication.md)
- [FABER CLI Documentation](../cli/README.md)
- [FABER SDK Documentation](../README.md)

## Approval Checklist

- [x] User requirements understood and documented
- [x] Technical approach validated
- [x] Security considerations addressed
- [x] Testing strategy defined
- [x] Documentation plan outlined
- [x] Implementation sequence clear
- [x] Success criteria measurable
- [x] Backward compatibility ensured
- [x] No new dependencies required
- [x] Command injection risks mitigated
