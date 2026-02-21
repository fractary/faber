# WORK-00041: GitHub App Authentication for FABER CLI

**Issue**: [#41](https://github.com/fractary/faber/issues/41)
**Type**: Feature
**Status**: Draft
**Created**: 2026-01-07
**Author**: System (spec-create agent)
**Labels**: enhancement, type: feature

---

## Executive Summary

Migrate FABER CLI from Personal Access Tokens (PAT) to GitHub App authentication for enhanced security, audit trail capabilities, and enterprise readiness. This specification covers the full implementation including automatic token refresh, interactive setup wizard, token caching, and environment variable support for CI/CD environments.

## Motivation

GitHub Apps provide significant advantages over Personal Access Tokens:

| Aspect | Personal Access Token | GitHub App |
|--------|----------------------|------------|
| **Identity** | Actions logged under personal account | Actions logged under app name (clear audit trail) |
| **Token Lifetime** | 90-day expiration | 1-hour tokens (reduced exposure window) |
| **Permissions** | Broad, user-scoped | Granular, repository/org-scoped |
| **Team Management** | Credentials shared between users | Multiple team members use same app |
| **Organizational Control** | Cannot be centrally managed | Org admins can manage/revoke access |
| **Enterprise** | Challenges in regulated environments | Better suited for compliance |

## Scope

### In Scope

1. **GitHub App Authentication Module** (`cli/src/lib/github-app-auth.ts`)
   - JWT generation from private key
   - Installation token exchange
   - Automatic token refresh before expiration
   - Token caching to minimize API calls

2. **Configuration Schema Updates**
   - Support for GitHub App credentials alongside PAT
   - Multiple private key storage methods (file path, base64 env var)

3. **Interactive Setup Wizard**
   - Guided flow for GitHub App configuration
   - Validation of App ID, Installation ID, and private key

4. **Backward Compatibility**
   - Continue supporting PAT authentication
   - Explicit failure when configured auth method fails (no silent fallback)

5. **Testing**
   - Unit tests for JWT generation and token exchange
   - Integration tests for both auth paths

6. **Documentation**
   - Setup guide for GitHub App creation
   - Migration path from PAT to GitHub App

### Out of Scope

- Automatic migration of existing PAT configurations
- GitHub App creation wizard (users create apps via GitHub UI)
- Multiple GitHub App support per configuration

## User Stories

### Story 1: Enterprise User Authentication

**As an** enterprise developer using FABER CLI
**I want** to authenticate using GitHub App credentials
**So that** my actions are logged under the app identity and comply with audit requirements

**Acceptance Criteria**:
- [ ] Can configure GitHub App credentials in `.fractary/settings.json`
- [ ] CLI uses GitHub App token for all GitHub API operations
- [ ] Actions appear in GitHub audit log under app name
- [ ] Token automatically refreshes before expiration

### Story 2: CI/CD Pipeline Integration

**As a** DevOps engineer
**I want** to provide GitHub App private key via environment variable
**So that** I can use FABER CLI in CI/CD pipelines without exposing secrets in config files

**Acceptance Criteria**:
- [ ] Can provide private key as base64-encoded environment variable
- [ ] Environment variable takes precedence over file path configuration
- [ ] Clear error message if neither method provides valid key
- [ ] Works in containerized environments (Docker, GitHub Actions)

### Story 3: Interactive Setup

**As a** new FABER CLI user
**I want** a guided setup wizard for GitHub App configuration
**So that** I can correctly configure the app without reading documentation

**Acceptance Criteria**:
- [ ] `fractary-faber workflow-init` offers GitHub App as auth option
- [ ] Wizard prompts for App ID, Installation ID, and private key path
- [ ] Validates credentials before saving configuration
- [ ] Provides clear feedback on successful/failed validation

### Story 4: Token Refresh

**As a** developer using FABER CLI
**I want** tokens to automatically refresh
**So that** long-running workflows don't fail due to token expiration

**Acceptance Criteria**:
- [ ] Tokens refresh automatically 5 minutes before expiration
- [ ] Background refresh doesn't interrupt active operations
- [ ] Failed refresh attempts are logged with actionable error messages
- [ ] Refresh logic handles rate limiting gracefully

## Functional Requirements

### FR1: Authentication Module

- **FR1.1**: The `GitHubAppAuth` class MUST generate a valid JWT using RS256 algorithm
- **FR1.2**: The JWT MUST include required claims: `iat`, `exp` (10 minutes), `iss` (App ID)
- **FR1.3**: The module MUST exchange JWT for installation token via GitHub API
- **FR1.4**: Installation tokens MUST be cached with their expiration time
- **FR1.5**: The module MUST automatically refresh tokens 5 minutes before expiration

### FR2: Private Key Handling

- **FR2.1**: The module MUST support reading private key from file path
- **FR2.2**: The module MUST support reading private key from base64-encoded environment variable
- **FR2.3**: Environment variable MUST take precedence over file path if both are configured
- **FR2.4**: The module MUST validate private key format (PEM) before use
- **FR2.5**: Private keys MUST NOT be logged or exposed in error messages

### FR3: Configuration Schema

- **FR3.1**: `GitHubConfig` MUST support optional `app` property for GitHub App credentials
- **FR3.2**: The `app` property MUST include: `id`, `installation_id`, `private_key_path`
- **FR3.3**: The system MUST detect auth method based on available configuration
- **FR3.4**: If both PAT and App credentials exist, App MUST take precedence
- **FR3.5**: Configuration MUST fail explicitly if configured auth method is unavailable

### FR4: Setup Wizard

- **FR4.1**: `workflow-init` command MUST offer choice between PAT and GitHub App
- **FR4.2**: GitHub App setup MUST prompt for App ID, Installation ID, and private key path
- **FR4.3**: Setup MUST validate credentials by attempting token generation
- **FR4.4**: Setup MUST save valid credentials to `.fractary/settings.json`
- **FR4.5**: Setup MUST provide clear error messages for invalid credentials

### FR5: Backward Compatibility

- **FR5.1**: Existing PAT configurations MUST continue to work without modification
- **FR5.2**: The CLI MUST NOT fall back to PAT if GitHub App auth fails
- **FR5.3**: Error messages MUST clearly indicate which auth method failed and why

## Non-Functional Requirements

### NFR1: Security

- **NFR1.1**: Private keys MUST be readable only by the current user (0600 permissions on Unix)
- **NFR1.2**: Tokens MUST NOT be written to disk in plaintext
- **NFR1.3**: Token cache MUST be stored in memory only
- **NFR1.4**: Error messages MUST NOT expose private key content
- **NFR1.5**: Base64-encoded keys in environment variables MUST be decoded in memory only

### NFR2: Performance

- **NFR2.1**: Token generation MUST complete in under 500ms
- **NFR2.2**: Cached tokens MUST be returned in under 10ms
- **NFR2.3**: Token refresh MUST NOT block active operations

### NFR3: Reliability

- **NFR3.1**: The module MUST handle GitHub API rate limiting gracefully
- **NFR3.2**: The module MUST retry transient failures with exponential backoff
- **NFR3.3**: The module MUST provide clear error messages for all failure modes

### NFR4: Maintainability

- **NFR4.1**: Authentication logic MUST be encapsulated in a single module
- **NFR4.2**: Module MUST be independently testable with mocked dependencies
- **NFR4.3**: TypeScript interfaces MUST be defined for all data structures

## Technical Design

### Architecture Overview

```
+------------------+     +-------------------+     +------------------+
|   FABER CLI      |     |  GitHubAppAuth    |     |   GitHub API     |
|   Commands       | --> |   Module          | --> |                  |
+------------------+     +-------------------+     +------------------+
        |                       |                         |
        |                       v                         |
        |              +-------------------+              |
        |              |   Token Cache     |              |
        |              |   (in-memory)     |              |
        |              +-------------------+              |
        |                       |                         |
        v                       v                         |
+------------------+     +-------------------+            |
|   ConfigManager  |     |   Private Key     |            |
|                  |     |   Loader          | -----------+
+------------------+     +-------------------+
                                |
                                v
                         +-------------------+
                         |  Key Sources:     |
                         |  - File path      |
                         |  - Base64 env var |
                         +-------------------+
```

### Data Model

#### Updated `GitHubConfig` Interface

```typescript
// cli/src/types/config.ts

export interface GitHubAppConfig {
  id: string;                    // GitHub App ID
  installation_id: string;       // Installation ID for the target org/repo
  private_key_path?: string;     // Path to PEM file (optional if env var used)
  private_key_env_var?: string;  // Env var name containing base64-encoded key
}

export interface GitHubConfig {
  token?: string;                // PAT (legacy, still supported)
  organization?: string;
  project?: string;
  repo?: string;
  app?: GitHubAppConfig;         // GitHub App configuration (new)
}
```

#### Token Cache Structure

```typescript
// cli/src/lib/github-app-auth.ts

interface CachedToken {
  token: string;
  expires_at: Date;
  installation_id: string;
}
```

#### JWT Claims Structure

```typescript
interface JWTPayload {
  iat: number;   // Issued at (seconds since epoch)
  exp: number;   // Expiration (max 10 minutes from iat)
  iss: string;   // Issuer (GitHub App ID)
}
```

### API Design

#### GitHubAppAuth Class

```typescript
// cli/src/lib/github-app-auth.ts

export class GitHubAppAuth {
  private cache: Map<string, CachedToken> = new Map();
  private config: GitHubAppConfig;

  constructor(config: GitHubAppConfig);

  /**
   * Get a valid installation token.
   * Returns cached token if still valid, otherwise generates new one.
   */
  async getToken(): Promise<string>;

  /**
   * Force refresh the token (for testing or error recovery).
   */
  async refreshToken(): Promise<string>;

  /**
   * Check if token needs refresh (within 5 minutes of expiration).
   */
  isTokenExpiringSoon(): boolean;

  /**
   * Validate the configuration and private key.
   * @throws Error if configuration is invalid
   */
  async validate(): Promise<void>;
}
```

#### Private Key Loader

```typescript
// cli/src/lib/github-app-auth.ts

class PrivateKeyLoader {
  /**
   * Load private key from configured sources.
   * Priority: env var > file path
   */
  static async load(config: GitHubAppConfig): Promise<string>;

  /**
   * Validate private key format.
   */
  static validate(key: string): boolean;
}
```

### Authentication Flow

```
1. CLI Command Invoked
         |
         v
2. ConfigManager.load()
         |
         v
3. Check GitHubConfig.app exists?
         |
    +----+----+
    |         |
   Yes        No
    |         |
    v         v
4. Create    5. Use PAT
   GitHubAppAuth  (legacy)
         |
         v
6. getToken() called
         |
         v
7. Check cache
         |
    +----+----+
    |         |
  Valid     Expired/
    |       Missing
    |         |
    v         v
8. Return   9. Load private key
   cached      |
   token       v
            10. Generate JWT
                  |
                  v
            11. Exchange for
                installation token
                  |
                  v
            12. Cache and return
```

### Token Refresh Strategy

```
Token Lifecycle:
|<----- 55 minutes (usable) ----->|<-- 5 min -->|
|                                 |  (refresh)  |
+------------------------------------------+----+
^                                          ^    ^
|                                          |    |
Generated                            Refresh  Expire
                                     Trigger
```

**Refresh Logic**:
1. Check token expiration before each API call
2. If within 5 minutes of expiration, trigger background refresh
3. Return current token immediately (still valid)
4. On refresh failure, log error and continue with current token
5. If token actually expired, throw error with clear message

### Error Handling

| Error Condition | Error Message | Recovery Action |
|-----------------|---------------|-----------------|
| Private key not found | `GitHub App private key not found. Check 'private_key_path' in config or set GITHUB_APP_PRIVATE_KEY env var` | Verify file path or env var |
| Invalid private key format | `Invalid private key format. Expected PEM-encoded RSA private key` | Regenerate key from GitHub App settings |
| JWT generation failed | `Failed to generate JWT: {error}` | Check private key validity |
| Installation token exchange failed | `Failed to get installation token: {status} {message}` | Verify App ID and Installation ID |
| App not installed | `GitHub App not installed for this repository. Install at: {url}` | Install app via GitHub UI |
| Rate limited | `GitHub API rate limited. Retry after {seconds} seconds` | Wait and retry |

### Configuration Examples

#### File-based Private Key

```json
// .fractary/settings.json
{
  "github": {
    "organization": "fractary",
    "project": "faber",
    "app": {
      "id": "123456",
      "installation_id": "78901234",
      "private_key_path": "~/.github/fractary-faber-cli.pem"
    }
  }
}
```

#### Environment Variable Private Key (CI/CD)

```json
// .fractary/settings.json
{
  "github": {
    "organization": "fractary",
    "project": "faber",
    "app": {
      "id": "123456",
      "installation_id": "78901234",
      "private_key_env_var": "GITHUB_APP_PRIVATE_KEY"
    }
  }
}
```

```bash
# Environment variable (base64-encoded PEM)
export GITHUB_APP_PRIVATE_KEY="LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQ0K..."
```

## Implementation Plan

### Phase 1: Core Authentication Module

**Status**: Not Started
**Estimated Effort**: 2-3 days

**Objective**: Create the foundational `GitHubAppAuth` class with JWT generation and token exchange capabilities.

**Tasks**:
- [ ] Create `cli/src/lib/github-app-auth.ts` with `GitHubAppAuth` class
- [ ] Implement `PrivateKeyLoader` class with file and env var support
- [ ] Implement JWT generation using `jsonwebtoken` library
- [ ] Implement installation token exchange via GitHub API
- [ ] Add `jsonwebtoken` dependency to `package.json`
- [ ] Write unit tests for JWT generation
- [ ] Write unit tests for token exchange (with mocked GitHub API)

**Files to Create**:
- `cli/src/lib/github-app-auth.ts`
- `cli/src/lib/__tests__/github-app-auth.test.ts`

**Dependencies to Add**:
```json
{
  "jsonwebtoken": "^9.0.0",
  "@types/jsonwebtoken": "^9.0.0"
}
```

### Phase 2: Token Caching and Refresh

**Status**: Not Started
**Estimated Effort**: 1-2 days

**Objective**: Implement token caching and automatic refresh logic.

**Tasks**:
- [ ] Implement in-memory token cache with expiration tracking
- [ ] Implement automatic refresh when token expires within 5 minutes
- [ ] Add background refresh capability (non-blocking)
- [ ] Handle rate limiting with exponential backoff
- [ ] Write unit tests for caching logic
- [ ] Write unit tests for refresh scenarios

### Phase 3: Configuration Schema Updates

**Status**: Not Started
**Estimated Effort**: 1 day

**Objective**: Update configuration types and loading logic to support GitHub App credentials.

**Tasks**:
- [ ] Update `cli/src/types/config.ts` with `GitHubAppConfig` interface
- [ ] Update `ConfigManager.load()` to read GitHub App configuration
- [ ] Implement auth method detection (App vs PAT)
- [ ] Add validation for GitHub App configuration
- [ ] Write unit tests for config loading

**Files to Modify**:
- `cli/src/types/config.ts`
- `cli/src/lib/config.ts`
- `cli/src/lib/__tests__/config.test.ts`

### Phase 4: Integration with SDK Config Adapter

**Status**: Not Started
**Estimated Effort**: 1 day

**Objective**: Update SDK config adapters to use GitHub App authentication when configured.

**Tasks**:
- [ ] Update `createWorkConfig()` to use GitHubAppAuth when available
- [ ] Update `createRepoConfig()` to use GitHubAppAuth when available
- [ ] Update `RepoClient` constructor to support dynamic token refresh
- [ ] Implement token provider pattern for SDK integration
- [ ] Write integration tests for SDK adapter

**Files to Modify**:
- `cli/src/lib/sdk-config-adapter.ts`
- `cli/src/lib/repo-client.ts`

### Phase 5: Interactive Setup Wizard

**Status**: Not Started
**Estimated Effort**: 2 days

**Objective**: Add GitHub App configuration option to the `workflow-init` command.

**Tasks**:
- [ ] Update `workflow-init` command to prompt for auth method
- [ ] Implement GitHub App credential prompts (App ID, Installation ID, key path)
- [ ] Add credential validation before saving
- [ ] Update config file generation for GitHub App settings
- [ ] Write integration tests for setup wizard flow

**Files to Modify**:
- `cli/src/commands/init.ts`

### Phase 6: Documentation and Testing

**Status**: Not Started
**Estimated Effort**: 2 days

**Objective**: Comprehensive testing and documentation.

**Tasks**:
- [ ] Write integration tests for end-to-end auth flow
- [ ] Test PAT backward compatibility
- [ ] Test CI/CD environment variable flow
- [ ] Create GitHub App setup guide in README
- [ ] Document migration path from PAT to GitHub App
- [ ] Add troubleshooting guide for common errors
- [ ] Update CHANGELOG with new feature

**Files to Create/Modify**:
- `cli/README.md`
- `docs/github-app-setup.md` (new)
- `CHANGELOG.md`

## Files Summary

### New Files

| File | Purpose |
|------|---------|
| `cli/src/lib/github-app-auth.ts` | Core authentication module with JWT generation, token exchange, and caching |
| `cli/src/lib/__tests__/github-app-auth.test.ts` | Unit tests for authentication module |
| `docs/github-app-setup.md` | Setup guide for creating and configuring GitHub App |

### Modified Files

| File | Changes |
|------|---------|
| `cli/src/types/config.ts` | Add `GitHubAppConfig` interface and update `GitHubConfig` |
| `cli/src/lib/config.ts` | Load GitHub App configuration from settings file |
| `cli/src/lib/sdk-config-adapter.ts` | Use GitHubAppAuth for token generation when configured |
| `cli/src/lib/repo-client.ts` | Support dynamic token refresh for long-running operations |
| `cli/src/commands/init.ts` | Add GitHub App setup option to workflow-init command |
| `cli/package.json` | Add `jsonwebtoken` dependency |
| `cli/README.md` | Document GitHub App authentication option |
| `CHANGELOG.md` | Document new feature |

## Testing Strategy

### Unit Tests

```typescript
describe('GitHubAppAuth', () => {
  describe('JWT Generation', () => {
    it('generates valid JWT with correct claims', async () => {
      const auth = new GitHubAppAuth({
        id: '123456',
        installation_id: '789',
        private_key_path: '/path/to/key.pem'
      });

      const jwt = await auth['generateJWT']();
      const decoded = jsonwebtoken.decode(jwt, { complete: true });

      expect(decoded.payload.iss).toBe('123456');
      expect(decoded.payload.exp - decoded.payload.iat).toBeLessThanOrEqual(600);
      expect(decoded.header.alg).toBe('RS256');
    });

    it('throws error for invalid private key', async () => {
      const auth = new GitHubAppAuth({
        id: '123456',
        installation_id: '789',
        private_key_path: '/nonexistent/key.pem'
      });

      await expect(auth.getToken()).rejects.toThrow(/private key not found/);
    });
  });

  describe('Token Caching', () => {
    it('returns cached token when valid', async () => {
      const auth = createAuthWithMockedAPI();

      const token1 = await auth.getToken();
      const token2 = await auth.getToken();

      expect(token1).toBe(token2);
      expect(mockGitHubAPI.callCount).toBe(1); // Only one API call
    });

    it('refreshes token when expired', async () => {
      const auth = createAuthWithMockedAPI();

      await auth.getToken();
      advanceTime(55 * 60 * 1000); // 55 minutes
      await auth.getToken();

      expect(mockGitHubAPI.callCount).toBe(2); // Two API calls
    });
  });
});

describe('PrivateKeyLoader', () => {
  it('loads key from file path', async () => {
    const key = await PrivateKeyLoader.load({
      id: '123',
      installation_id: '456',
      private_key_path: './test-fixtures/test-key.pem'
    });

    expect(key).toContain('-----BEGIN RSA PRIVATE KEY-----');
  });

  it('loads key from environment variable', async () => {
    process.env.GITHUB_APP_PRIVATE_KEY = Buffer.from(testKey).toString('base64');

    const key = await PrivateKeyLoader.load({
      id: '123',
      installation_id: '456',
      private_key_env_var: 'GITHUB_APP_PRIVATE_KEY'
    });

    expect(key).toContain('-----BEGIN RSA PRIVATE KEY-----');
  });

  it('prefers environment variable over file path', async () => {
    process.env.GITHUB_APP_PRIVATE_KEY = Buffer.from(envKey).toString('base64');

    const key = await PrivateKeyLoader.load({
      id: '123',
      installation_id: '456',
      private_key_path: './file-key.pem',
      private_key_env_var: 'GITHUB_APP_PRIVATE_KEY'
    });

    expect(key).toBe(envKey);
  });
});
```

### Integration Tests

```typescript
describe('GitHub App Authentication Integration', () => {
  it('successfully authenticates with GitHub App', async () => {
    // Requires valid test credentials in CI environment
    const config = await ConfigManager.load();
    const workConfig = createWorkConfig(config);
    const workManager = new WorkManager(workConfig);

    // Should not throw
    const issues = await workManager.searchIssues('test', { limit: 1 });
    expect(Array.isArray(issues)).toBe(true);
  });

  it('falls back to PAT when App not configured', async () => {
    // Config with only PAT
    const config = {
      github: {
        token: process.env.GITHUB_TOKEN,
        organization: 'fractary',
        project: 'faber'
      }
    };

    const workConfig = createWorkConfig(config);
    expect(workConfig.token).toBe(process.env.GITHUB_TOKEN);
  });

  it('fails explicitly when neither auth method available', async () => {
    const config = {
      github: {
        organization: 'fractary',
        project: 'faber'
        // No token or app config
      }
    };

    expect(() => createWorkConfig(config)).toThrow(/GitHub token not found/);
  });
});
```

### Manual Testing Checklist

- [ ] Fresh install: `workflow-init` with GitHub App option
- [ ] Token generation: Verify JWT created correctly
- [ ] Token exchange: Verify installation token obtained
- [ ] Token caching: Multiple commands don't regenerate token
- [ ] Token refresh: Long workflow (>55 min) continues working
- [ ] PAT fallback: Remove App config, verify PAT still works
- [ ] CI/CD flow: GitHub Actions with base64 env var
- [ ] Error handling: Invalid App ID shows clear error
- [ ] Error handling: Invalid Installation ID shows clear error
- [ ] Error handling: Invalid private key shows clear error

## Dependencies

### New Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `jsonwebtoken` | ^9.0.0 | JWT generation for GitHub App authentication |
| `@types/jsonwebtoken` | ^9.0.0 | TypeScript definitions |

### Existing Dependencies Used

| Package | Usage |
|---------|-------|
| `@anthropic-ai/sdk` | Anthropic API client |
| `@fractary/core` | SDK for WorkManager and RepoManager |
| `chalk` | Console output formatting |
| `commander` | CLI argument parsing |

## Risks and Mitigations

### Risk 1: Private Key Security

**Risk**: Private keys could be exposed through logs, error messages, or insecure storage
**Likelihood**: Medium
**Impact**: High (credential compromise)

**Mitigations**:
- Never log private key content
- Sanitize error messages to exclude key data
- Validate file permissions on Unix systems
- Store tokens in memory only (no disk persistence)
- Clear key material from memory after use

### Risk 2: Token Expiration During Operations

**Risk**: Long-running workflows could fail mid-execution due to token expiration
**Likelihood**: Medium
**Impact**: Medium (workflow interruption)

**Mitigations**:
- Implement proactive token refresh (5 minutes before expiration)
- Background refresh doesn't block operations
- Graceful degradation if refresh fails
- Clear error messages with retry instructions

### Risk 3: Breaking Backward Compatibility

**Risk**: Changes could break existing PAT-based configurations
**Likelihood**: Low
**Impact**: High (existing users affected)

**Mitigations**:
- PAT remains the default when App not configured
- Extensive testing with PAT-only configurations
- Clear documentation of behavior changes
- Feature flag for gradual rollout (optional)

### Risk 4: GitHub API Rate Limiting

**Risk**: Frequent token generation could hit GitHub API rate limits
**Likelihood**: Low (with caching)
**Impact**: Medium (temporary service disruption)

**Mitigations**:
- Aggressive token caching (55 minute cache duration)
- Exponential backoff on rate limit errors
- Clear error messages with retry timing
- Token reuse across multiple operations

## Success Criteria

### Functional Criteria

- [ ] GitHub App authentication works end-to-end
- [ ] PAT authentication continues to work unchanged
- [ ] Token caching reduces API calls by >95%
- [ ] Token auto-refresh works for long workflows (>1 hour)
- [ ] Setup wizard successfully configures GitHub App
- [ ] CI/CD environment variable method works in GitHub Actions

### Performance Criteria

- [ ] Token generation completes in <500ms
- [ ] Cached token lookup completes in <10ms
- [ ] No perceptible delay in CLI command execution

### Quality Criteria

- [ ] Unit test coverage >80% for new code
- [ ] All integration tests passing
- [ ] No security vulnerabilities in dependency audit
- [ ] Documentation complete and accurate

## Documentation Requirements

### README Updates

Add section covering:
- GitHub App authentication overview
- Configuration examples (file and env var)
- Migration guide from PAT
- Troubleshooting common errors

### New Documentation

Create `docs/github-app-setup.md` covering:
1. Creating a GitHub App in organization
2. Required permissions for FABER CLI
3. Generating and storing private key
4. Installing app on repositories
5. Finding Installation ID
6. Configuring FABER CLI

### API Documentation

Document public interfaces:
- `GitHubAppAuth` class
- `GitHubAppConfig` interface
- Configuration file format

## Rollout Plan

### Phase 1: Internal Testing (Week 1)

- Deploy to development environment
- Internal team testing with fractary org
- Gather feedback and fix issues

### Phase 2: Documentation (Week 2)

- Complete all documentation
- Update README with new feature
- Create setup guide with screenshots

### Phase 3: Release (Week 3)

- Release as minor version bump (e.g., 1.4.0)
- Announce in release notes
- Monitor for issues

### Phase 4: Deprecation Planning (Future)

- Plan PAT deprecation timeline (6+ months notice)
- Migration tooling if needed
- Major version bump when PAT removed

## Changelog

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-07 | spec-create agent | Initial specification created from issue #41 and clarified requirements |

---

## Appendix A: GitHub App Permissions

Required permissions for FABER CLI GitHub App:

| Permission | Access Level | Purpose |
|------------|-------------|---------|
| **Repository Permissions** | | |
| Contents | Read & Write | Read/write repository files |
| Issues | Read & Write | Fetch and update issues |
| Pull requests | Read & Write | Create and manage PRs |
| Metadata | Read | Basic repository info |
| **Organization Permissions** | | |
| Members | Read | Team membership info |

## Appendix B: JWT Structure Reference

```
Header:
{
  "alg": "RS256",
  "typ": "JWT"
}

Payload:
{
  "iat": 1609459200,        // Issued at
  "exp": 1609459800,        // Expires (iat + 600 seconds max)
  "iss": "123456"           // GitHub App ID
}

Signature:
RSASHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  private_key
)
```

## Appendix C: Installation Token Response

```json
{
  "token": "ghs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "expires_at": "2026-01-07T17:00:00Z",
  "permissions": {
    "contents": "write",
    "issues": "write",
    "pull_requests": "write",
    "metadata": "read"
  },
  "repository_selection": "selected",
  "repositories": [
    {
      "id": 123456789,
      "name": "faber",
      "full_name": "fractary/faber"
    }
  ]
}
```
