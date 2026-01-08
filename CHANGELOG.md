# Changelog

All notable changes to the FABER project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.15] - 2026-01-08

### Fixed

- **JWT Clock Skew**: Reduced JWT expiry from 10 minutes to 5 minutes to handle clock skew between local system and GitHub servers. This fixes the "Expiration time claim ('exp') is too far in the future" error.

## [1.3.14] - 2026-01-08

### Fixed

- **Worktree Error Detection**: Improved error detection for existing worktrees by matching "exit code 128" in error messages

## [1.3.13] - 2026-01-08

### Fixed

- **GitHub API Error Logging**: Added detailed error response logging for authentication failures

## [1.3.12] - 2026-01-08

### Fixed

- **Label Error Detection**: Improved error detection for missing labels by matching multiple error patterns

## [1.3.11] - 2026-01-08

### Fixed

- **Branch Creation**: Changed to use `git branch` instead of `git checkout -b` to avoid switching the main repository when creating branches for worktrees
- **Existing Worktree Handling**: Plan command now gracefully handles existing worktrees by reusing them instead of failing with an error

## [1.3.10] - 2026-01-08

### Fixed

- **Authentication Debug**: Added debug logging for GitHub App authentication to diagnose connection issues

## [1.3.9] - 2026-01-08

### Fixed

- **Missing Label Handling**: Plan command now gracefully handles missing 'faber:planned' label by adding comment without label. Shows warning instead of failing when label doesn't exist in repository.

## [1.3.8] - 2026-01-08

### Fixed

- **Worktree Branch Conflict**: Fixed plan command creating branches that conflict with worktree creation. Now skips separate branch creation when creating worktrees, since `git worktree add` creates the branch automatically without checking it out in the main repository.
  - Changed branch creation to only run when `--no-worktree` is specified
  - Fixes error: "fatal: 'feature/N' is already used by worktree"

## [1.3.7] - 2026-01-08

### Fixed

- **Output Buffering**: Added debug logging to diagnose CLI output buffering issues
- **Unbuffered stdout**: Added setBlocking() call attempt to force unbuffered terminal output
- **Plan Command Output**: Added debug statements to trace execution flow

## [1.3.6] - 2026-01-08

### Fixed

- **Config File Discovery**: Fixed ConfigManager to search upwards through parent directories for `.fractary/settings.json`, similar to how git finds `.git` directory. This allows commands to work correctly when run from subdirectories (e.g., running `fractary-faber` from the `cli/` directory).
  - Added `findConfigFile()` method that traverses upward from current working directory
  - Changed from `path.join(process.cwd(), '.fractary', 'settings.json')` to upward search
  - Fixes error: "GitHub organization and project must be configured in .fractary/settings.json"

## [1.3.5] - 2026-01-08

### Fixed

- **Plan Command GitHub App Support**: Fixed async initialization error in `plan` command when using GitHub App authentication. Changed `new RepoClient(config)` to `await RepoClient.create(config)` in cli/src/commands/plan/index.ts:94

## [1.3.4] - 2026-01-08

### Fixed

- **GitHub App Manifest Flow**: Fixed manifest validation error by adding required `redirect_url` field to manifest
- **WSL Browser Compatibility**: Fixed "file not found" error on WSL by detecting WSL environment and saving HTML file to Windows-accessible directory
- **HTML Form Generation**: Implemented proper GitHub App manifest flow using HTML form POST instead of simple URL navigation
- **Cross-Platform Browser Opening**: Added secure cross-platform browser opening using `execFile` instead of `exec` for Windows/macOS/Linux support

### Added
- **GitHub App Authentication** - Alternative to Personal Access Tokens with enhanced security
  - JWT generation and automatic token exchange
  - Token caching with 55-minute validity
  - Automatic token refresh 5 minutes before expiration
  - Support for file-based private keys and base64-encoded environment variables
  - Rate limiting handling with exponential backoff
  - Comprehensive documentation in `docs/github-app-setup.md`
  - Full backward compatibility with existing PAT authentication

- **Automated GitHub App Setup** - One-command setup using GitHub App Manifest flow
  - New `fractary-faber auth setup` command
  - Reduces setup from 15+ manual steps to single command with copy-paste
  - Auto-detects GitHub organization and repository from git remotes
  - Guides users through app creation with clear step-by-step instructions
  - Automatic credential configuration and private key storage
  - Cross-platform support (macOS, Linux, Windows)
  - Setup completes in ~30 seconds

### Changed
- Updated `GitHubConfig` type to include optional `app` configuration
- Enhanced SDK config adapter with async initialization methods
- Modified `RepoClient` to support both sync (PAT) and async (GitHub App) initialization

### Documentation
- Added comprehensive GitHub App setup guide (`docs/github-app-setup.md`)
- Updated CLI README with authentication section
- Created CHANGELOG for tracking project changes

## [1.3.2] - 2026-01-07

### Fixed
- Add missing ajv dependency to CLI package

## [1.3.1] - 2026-01-07

### Fixed
- ES modules compatibility - add .js extensions and update forge dependency

## [1.3.0] - Previous Release

### Added
- Initial FABER CLI release
- Workflow management commands
- Work tracking integration (GitHub, Jira, Linear)
- Repository operations
- Specification management
- Logging capabilities

[Unreleased]: https://github.com/fractary/faber/compare/v1.3.2...HEAD
[1.3.2]: https://github.com/fractary/faber/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/fractary/faber/compare/v1.3.0...v1.3.1
