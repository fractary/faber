# Changelog

All notable changes to the FABER project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **GitHub App Authentication** - Alternative to Personal Access Tokens with enhanced security
  - JWT generation and automatic token exchange
  - Token caching with 55-minute validity
  - Automatic token refresh 5 minutes before expiration
  - Support for file-based private keys and base64-encoded environment variables
  - Rate limiting handling with exponential backoff
  - Comprehensive documentation in `docs/github-app-setup.md`
  - Full backward compatibility with existing PAT authentication

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
