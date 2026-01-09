# Changelog

All notable changes to the FABER project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.4] - 2026-01-09

### Fixed

- **Workflow Label Detection**: Now supports both `workflow:` and `faber-workflow:` label prefixes
  - Fixes issue where `faber-workflow:dataset-loader-deploy` labels were not recognized
  - Extracts workflow name correctly from either prefix format

- **Workflow Config Location**: Updated default workflow configuration paths
  - New default: `.fractary/faber/workflows/` (aligned with non-plugin architecture)
  - Legacy support: `.fractary/plugins/faber/workflows/` (backward compatible)
  - Automatically detects and uses existing workflow directories
  - Migration path from old "plugins" structure to new flat structure

## [1.4.3] - 2026-01-09

### Added

- **Manual App Configuration**: Added option to configure existing GitHub Apps without creating new ones
  - Choose between "Create new app" or "Configure existing app" at start
  - Manual mode prompts for App ID, Installation ID, and private key path
  - Validates private key file exists before saving configuration
  - Perfect for users who already created the app and just need to configure it

### Improved

- **Auth Setup UX**: Major improvements to `fractary-faber auth setup` flow:
  - Explains that example.com redirect is expected and shows where to find the code
  - Automatically opens installation URL when app creation succeeds but installation is missing
  - Guides users through installation step-by-step with clear instructions
  - Verifies installation automatically after user completes it
  - Single-flow experience - no need to re-run the command
  - Better messaging throughout the entire process

## [1.4.1] - 2026-01-08

### Fixed

- **WSL Auth Setup**: Fixed `fractary-faber auth setup` command on WSL to display Windows-formatted paths (e.g., `C:\GitHub\...`) instead of WSL paths (e.g., `/mnt/c/GitHub/...`). The command now:
  - Converts WSL paths to Windows format for easy copy-paste
  - Shows clear instructions for opening the manifest file in Windows browsers
  - Skips xdg-open on WSL to prevent opening in WSL Firefox where users aren't authenticated
  - Makes the GitHub App setup flow work seamlessly on WSL environments

## [1.3.16] - 2026-01-08

### Added

- **Enhanced GitHub Comments**: Plan command now adds detailed comments to GitHub issues including:
  - Workflow name and inheritance information
  - Summary of workflow phases with task breakdowns
  - Full path to the plan file in the worktree
  - Copy-pasteable commands to execute the workflow

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
