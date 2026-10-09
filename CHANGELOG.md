# Changelog

All notable changes to the FABER project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Version Bumps

| Component | Version | Change |
|-----------|---------|--------|
| faber plugin | 5.2.0 | Minor |
| Marketplace | 5.2.0 | Minor |

### Changed

- **Model Re-tier (Claude Opus 5 / Sonnet 5)**: Agents now pick models by task complexity
  - Agent templates: architect, engineer, and engineer-validator → `claude-opus-5`. Architect-validator, configurator, debugger, and project-auditor → `claude-sonnet-5`. Inspector stays on `claude-haiku-4-5`
  - Template model enums and the SDK `ModelName` type now accept `claude-sonnet-5` and `claude-opus-5`. `claude-sonnet-4-6` and `claude-opus-4-8` are kept for back-compat; `claude-opus-4-6` is dropped
  - JS SDK: executor and workflow defaults move to `claude-sonnet-5`. The Claude API executor's default `max_tokens` rises from 8192 to 16000, because adaptive thinking tokens count toward the limit
  - Python SDK: architect phase → `claude-opus-5`, build/evaluate → `claude-sonnet-5`, frame/release stay on `claude-haiku-4-5`. Added `claude-opus-5` and `claude-sonnet-5` pricing. The retired `claude-opus-4-20250514` examples are replaced
  - Python SDK: `LLMConfig.temperature` now defaults to unset, and Anthropic requests no longer send `temperature=0.0`, which Opus 5 and Sonnet 5 reject. OpenAI/Google keep 0.0. The default `max_tokens` rises from 4096 to 16000
- **Skills no longer define a model**: Skills run inside the master agent, so model names were removed from the issue-reviewer and faber-debugger skills (prose, report footers, `model_used` output), from the `[director]` config examples, and from command frontmatter examples in the plugin framework guide

- **Model Update**: Updated model references to the latest equivalent Claude models
  - Updated Opus references from `claude-opus-4-6` to `claude-opus-4-8` (issue-reviewer skill, plugin reference docs)
  - Added `claude-opus-4-8` alongside `claude-opus-4-6` in agent template model enums and the SDK `ModelName` type
  - Normalized invalid dated Sonnet ID `claude-sonnet-4-6-20250514` to `claude-sonnet-4-6` (workflow defaults, SDK executor defaults, schema examples)
  - Replaced retired `claude-3.7` example model with `claude-sonnet-4-6` in example configs and skill docs
  - Added `claude-opus-4-8` pricing and corrected `claude-haiku-4-5` pricing in the Python SDK cost tracker

- **Skipped steps need a reason in plugin runs**: A run could skip its way past the completion gate, because a skipped step counted as done and nothing limited how many steps one state update skipped
  - The transition guard (`validate-state-transition.sh`) allows one finished step per update, whether completed, failed or skipped, and rejects a skip that does not record a `reason`. It compares each step's status, so an update that reopens one step while finishing two is also rejected
  - The completion verifier fails a run with a step skipped without a reason. Which phases are disabled comes from the plan, so a state that marks a phase disabled does not excuse its steps
  - The workflow-run skill and orchestration protocol say how to skip a step (2.6b, `skipStep`). A phase the user skips now skips each of its steps with the reason; the protocol's examples used an old state layout and left the phase's steps pending, which failed the gate
  - `state-update-step.sh` records a skipped step's `reason` from its data JSON

### Fixed

- **`workflow-execute` saves run state and can resume** (#236): Each execution is now a run (`{plan_id}-run-{timestamp}`) whose state is saved next to the plan, in `state-{timestamp}.json`, after every step starts and finishes. The format is the one the `fractary-faber-workflow-run` skill writes
  - New `--resume <run-id>` skips the steps the run completed and re-runs the interrupted or failed step
  - Command steps now receive the real `{run_id}`, and steps get `run_id` and `state_path` in their workflow context
  - JS SDK: new `RunStateStore`; `WorkflowExecutor` takes a `runState` option and reports `run_id`, `state_path`, `run_status` and `steps_already_completed`
  - `run-inspect` shows these runs: new `--run-id`, `--work-id` falls back to the latest run, and the listing adds runs (JSON: separate `runs` key)
- **Run paths for plan-scoped run IDs**: `getRunDir`, `getPlanPath` and `getStatePath` (and `runs dir`, `plan-path`, `state-path`, `verify-complete`) now resolve `{plan_id}-run-{timestamp}` to the plan's directory and its `state-{timestamp}.json`, where the workflow-run skill writes state. They previously pointed at `{run_id}/state.json`, which the skill never writes, so `runs verify-complete` could not find a run's state
- **`workflow-execute` honors step verdicts** (#235): An agent or model step's result now comes from the FABER response block at the end of its output, so a step or validator that reports `failure` fails and `on_failure: stop` halts the run. Previously every step whose session ended normally counted as a success
  - A step without a valid block is recorded as a warning with the reason `no_response_block` (or `invalid_response_block`); `pending_input` fails, since a CLI run cannot answer
  - New step field `role` (`maker` by default, or `validator`): a validator without a valid response block fails
  - Shell command steps keep their exit code, and a step its executor could not run stays failed
  - JS SDK: new `applyStepResponse`, `findResponseBlock` and `StepResponseSchema`; `ExecutorResult` gains `response`, `reason` and `response_issues`, and run state records each step's `reason`
- **`workflow-execute` runs steps in the worktree root** (#239): Steps previously ran in the plan's folder (`.fractary/faber/runs/{plan_id}/`). They now run in the root the plan belongs to: the worktree when the plan was created with one, otherwise the project root. New SDK helper `getPlanRoot`
- **Plugin completion gate passes on a finished run** (#244, #245): `/fractary-faber-workflow-run` paused every run at its completion gate
  - Plugin shell scripts are committed as executable, and three that had CRLF line endings (which bash cannot run) now use LF. `.gitattributes` keeps `*.sh` on LF, and a new CI job (`ci-plugin.yml`) checks both and runs the new script tests in `plugins/faber/tests/scripts/`
  - `state-update-step.sh` and `state-update-phase.sh` fail when the transition validator is missing or cannot run. Previously they skipped it without a word
  - `verify-workflow-completion.sh` reads the run's own state, plan and events (`runs/{plan_id}/{run_suffix}/events`). It counts steps in `.phases[].steps`, takes the required phases from the plan, so disabled phases are not required, names missing and unplanned steps, and finds `validate-plan-step-ids.sh`. It requires a `workflow_complete` event only once the state says `completed`, since the run emits that event after the gate. It no longer falls back to another run's state file
  - `validate-state-integrity.sh` checks every completed step, in each state layout, against a `step_complete` event in the run's own event log
  - The transition validator counts completed steps in `.phases[].steps`, and disabled phases no longer block completion
- **workflow-run skill records what the gate checks**: The skill now creates the run's event directory (the event tool does not create it), records disabled phases as skipped, and marks each finished phase completed with a `phase_complete` event. It passes the event tool the event run ID and the step as `step`. The orchestration protocol's examples passed `step_id`, which the tool drops, and the full run ID, which it rejects
- **Plan adherence report reads the current state layout** (#227): `verify-plan-adherence.sh` counts steps recorded in `.phases[].steps`, leaves out disabled phases (`enabled // true` read `false` as `true`) and no longer reads another run's state
- **Plugin shell fallbacks match the CLI's run paths** (#253): New `lib/run-paths.sh` mirrors the SDK's `parseRunId`, so without the CLI, `state-read.sh --run-id` and the other state scripts use `runs/{plan_id}/state-{run_suffix}.json`
  - `load-faber-config.sh` no longer consumes the caller's arguments or prints the config when sourced. This had made `state-read.sh` ignore its arguments, including `--run-id`
  - `state-read.sh` treats a `.json` path such as `.fractary/faber/state.json` as a file, not a jq query
- **`/fractary-faber-workflow-debug` exists again** (#249): Workflows across the packs name it as their `on_failure` handler, but it was removed in the agent-to-skill migration. The new `fractary-faber-workflow-debug` skill delegates to `fractary-faber-faber-debugger`, proposes fixes without applying them, and returns a `stop` recovery plan. `--auto-fix`, `--learn` and the other old flags are accepted, with no effect yet
- **CLI tests pass and run in CI** (#250): A new `CLI CI` workflow runs on `cli/**` and `sdk/js/**` changes. It installs from the workspace root, builds the SDK, and runs the CLI's lint, typecheck, tests and build. 19 CLI tests failed on main:
  - The `ConfigManager` tests still read the removed `.fractary/settings.json`. They now load a real `.fractary/config.yaml`, and cover the missing-config and migrate errors, validation errors and `work`/`repo` fallbacks
  - The `savePrivateKey` tests could not mock `os.homedir()` (an `import * as os` namespace cannot be spied on), and one wrote a key into the real `~/.github`
  - The `validatePlanId` tests expected every plan ID to end in a timestamp. Current plan IDs are `{org}-{project}-{work-id}`, so `validatePlanId` matches slug segments only; its optional timestamp group matched nothing extra
  - Lint errors fixed (`prefer-const`), and the unused `ConfigManager.findConfigFile` removed
- **`state-update-phase.sh` runs again**: It looked for the transition validator one folder too high. The guard used to skip that missing validator without a word; since the guard now fails when the validator is missing, every call failed
- **JSON arguments to state and hook scripts**: `state-update-step.sh`, `state-update-phase.sh`, `hook-execute.sh` and `hooks-execute-all.sh` defaulted their optional JSON argument with `${N:-{}}`, which appends a stray `}` whenever the argument is given, so any data or context passed was rejected as invalid JSON

## [1.5.47] - 2026-03-28

> **Note:** Patch releases 1.5.2 through 1.5.47 were not individually documented. This entry covers all changes since 1.5.1.

### Version Bumps

| Component | Version | Change |
|-----------|---------|--------|
| CLI (@fractary/faber-cli) | 1.5.47 | Patch series |
| SDK (@fractary/faber) | 2.4.40 | Patch series |
| MCP Server (@fractary/faber-mcp) | 1.1.2 | Patch |
| faber plugin | 3.8.29 | Patch series |
| Marketplace | 3.0.13 | Patch series |

### Changed

- **Model Update**: Updated all model references from Claude Sonnet 4-5 to Sonnet 4-6 (`claude-sonnet-4-5-20250514` → `claude-sonnet-4-6-20250624`)
  - Updated across all agents, skills, commands, workflows, documentation, and configuration files
  - Normalized dated Haiku model IDs (`claude-haiku-4-5-20251001`) to `claude-haiku-4-5`
  - Updated Opus references from `claude-opus-4-20250514` to `claude-opus-4-6`

- **Renamed**: `run-status` command and agent renamed to `run-inspect`
  - Aligns with `workflow-inspect` and `agent-inspect` naming pattern (noun-verb alignment)
  - Plugin command: `/fractary-faber-run-status` → `/fractary-faber-run-inspect`
  - CLI command: `fractary-faber run-status` → `fractary-faber run-inspect`
  - Agent: `run-status` → `run-inspect`
  - `workflow-status`, `status`, and `run-status` CLI commands now show deprecation warning pointing to `run-inspect`
  - Updated all documentation references

## [1.5.1] - 2026-01-16

### Version Bumps

| Component | Version | Change |
|-----------|---------|--------|
| CLI (@fractary/faber-cli) | 1.5.1 | Patch |
| faber plugin | 3.6.1 | Patch |

### Changed

- **BREAKING**: Unified workflow path configuration to `.fractary/faber/workflows/`
  - Configurator agent now writes to `faber:` section in `.fractary/config.yaml` (not standalone `.fractary/faber/config.yaml`)
  - Removed legacy fallback logic in CLI that checked `.fractary/plugins/faber/workflows/`
  - `merge-workflows.sh` project namespace now resolves to `.fractary/faber/workflows/`
  - Updated `config.schema.json` default project namespace example
  - Updated all documentation to reflect new paths

### Removed

- Backward compatibility for `.fractary/plugins/faber/workflows/` path (use `.fractary/faber/workflows/` instead)
- Legacy config fallback logic in CLI `config.ts`

## [1.5.0] - 2026-01-16

### Version Bumps

This release includes version updates across the FABER ecosystem:

| Component | Version | Change |
|-----------|---------|--------|
| SDK (@fractary/faber) | 2.1.2 | Patch |
| CLI (@fractary/faber-cli) | 1.5.0 | Minor |
| MCP Server (@fractary/faber-mcp) | 1.1.1 | Patch |
| faber plugin | 3.6.0 | Minor |
| faber-cloud plugin | 3.1.0 | Minor |
| Marketplace | 2.1.0 | Minor |

### Added

- **Migration Command**: New `fractary-faber migrate` command for converting `.fractary/settings.json` to `.fractary/config.yaml`
  - Supports `--dry-run` to preview changes
  - Supports `--no-backup` to skip backup creation
  - Warns about hardcoded secrets and recommends environment variables
  - Creates backup at `.fractary/settings.json.backup`

- **YAML Config Loader**: New unified configuration system with environment variable substitution
  - Supports `${VAR}` and `${VAR:-default}` syntax
  - Security limits on default value length (max 1000 chars)
  - Validates variable name format (uppercase, underscores only)
  - Provides clear warnings for missing environment variables

- **Entity-Level State Tracking**: New comprehensive system for tracking entity state across FABER workflows
  - **New Skill**: `entity-state` skill with 9 operations for entity lifecycle management
  - **Entity State Files**: Track current status, step execution, properties, and artifacts per entity
  - **History Tracking**: Separate history files for step execution audit trail and workflow summaries
  - **Step Hierarchy**: Three-level step system (step_id → step_action → step_type) for cross-workflow consistency
  - **Status Tracking**: Dual status system (execution_status for lifecycle, outcome_status for result quality)
  - **Query Operations**: Fast queries by type, status, step action, and recent updates
  - **Concurrent Updates**: Thread-safe operations with file locking and atomic writes
  - **Organization/Project Support**: Track entities across organizations and projects
  - **Helper Functions**: 9+ utility functions for faber-manager integration
  - **Comprehensive Tests**: 36 integration tests covering security, concurrency, and functionality
  - **Documentation**: Complete SKILL.md, architectural specs, and step hierarchy guidelines
  - Enables cross-workflow entity tracking, downstream polling, and centralized management (future Helm integration)

- **Command-Agent Pattern**: All commands now follow lightweight wrapper pattern
  - Commands reduced to ~12-18 lines (96% code reduction)
  - All implementation logic extracted to reusable agents
  - Created 4 new agents:
    - `session-manager` - Manages session artifacts and metadata
    - `workflow-audit` - Validates workflow configuration
    - `workflow-status` - Displays workflow status and progress
    - `workflow-debugger` - Diagnoses issues and proposes solutions
  - Benefits:
    - Agents are reusable across different contexts
    - Commands are maintainable and consistent
    - Clear separation of concerns (I/O vs logic)
    - Easier to test and debug

- **8 Agent Type Skills** (faber plugin): New specialized agent skills with selector
  - Agent type skills for different FABER workflow contexts
  - Agent selector for intelligent routing

- **Workflow Validation Command**: New `/workflow-audit` command
  - Validates workflow configuration files
  - Checks for common configuration errors

- **Comprehensive /config Commands**: Replaced /init with full configuration management
  - `/config show` - Display current configuration
  - `/config validate` - Validate configuration syntax
  - `/config migrate` - Migrate legacy configurations

- **Command-Agent Pattern for faber-cloud** (faber-cloud plugin): Complete refactor
  - All 15 commands converted to command-agent pattern
  - Consistent agent naming and organization

### Changed

- **BREAKING**: Migrated from `.fractary/settings.json` to unified `.fractary/config.yaml` format ([#55](https://github.com/fractary/faber/issues/55))
  - Configuration now uses YAML format with environment variable substitution (`${VAR}` and `${VAR:-default}`)
  - Secrets must be provided via environment variables (no hardcoded tokens)
  - Shared authentication sections (`github:`, `anthropic:`) at top level, used by all Fractary tools
  - FABER-specific settings moved under `faber:` section
  - Automatic migration: `fractary-faber migrate` converts old settings to new format
  - `fractary-faber init` now only manages the `faber:` section (requires config.yaml to exist)

- **BREAKING**: Config path migrated from `.fractary/plugins/faber/config.yaml` to `.fractary/faber/config.yaml`
  - Running `fractary-faber init` will automatically migrate existing configs
  - Legacy path still supported for backward compatibility (with deprecation warning)
  - Old config is deleted after successful migration
  - Aligns with non-plugin architecture (CLI, SDK, MCP)

- **BREAKING**: Command renamed from `workflow-init` to `init` for consistency
  - New command: `fractary-faber init` (simplified, lightweight)
  - Old command: `fractary-faber workflow-init` (deprecated, shows warning)
  - Init command reduced from 231 lines to 89 lines
  - All config logic centralized in SDK's `ConfigInitializer` class
  - Created `faber-initializer` agent for future enhancement
  - Removed duplicate config generation logic from CLI
  - CLI now delegates all operations to SDK methods

- **BREAKING**: Session commands renamed for clarity and consistency
  - `prime-context` → `session-load` (clearer purpose: loading session artifacts)
  - `session-end` → `session-save` (clearer purpose: saving session metadata)
  - All documentation and hook configurations updated to use new names
  - Commands now delegate to unified `session-manager` agent

- **BREAKING**: Workflow commands renamed with `workflow-` prefix for consistency
  - `audit` → `workflow-audit` (validates workflow configuration)
  - `status` → `workflow-status` (displays workflow status)
  - `debugger` → `workflow-debugger` (diagnoses workflow issues)
  - Naming now consistent: operations on workflows use `workflow-` prefix

### Fixed

- **Lint Errors**: Fixed `prefer-const` and `no-unnecessary-type-assertion` lint errors in SDK

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

- **Plan Command GitHub App Support**: Fixed async initialization error in `plan` command when using GitHub App authentication. Changed `new RepoClient(config)` to `await RepoClient.create(config)` in cli/src/commands/fractary-faber-plan/index.ts:94

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

[Unreleased]: https://github.com/fractary/faber/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/fractary/faber/compare/v1.4.4...v1.5.0
[1.4.4]: https://github.com/fractary/faber/compare/v1.4.3...v1.4.4
[1.4.3]: https://github.com/fractary/faber/compare/v1.4.1...v1.4.3
[1.4.1]: https://github.com/fractary/faber/compare/v1.3.16...v1.4.1
[1.3.16]: https://github.com/fractary/faber/compare/v1.3.15...v1.3.16
[1.3.15]: https://github.com/fractary/faber/compare/v1.3.14...v1.3.15
[1.3.14]: https://github.com/fractary/faber/compare/v1.3.13...v1.3.14
[1.3.13]: https://github.com/fractary/faber/compare/v1.3.12...v1.3.13
[1.3.12]: https://github.com/fractary/faber/compare/v1.3.11...v1.3.12
[1.3.11]: https://github.com/fractary/faber/compare/v1.3.10...v1.3.11
[1.3.10]: https://github.com/fractary/faber/compare/v1.3.9...v1.3.10
[1.3.9]: https://github.com/fractary/faber/compare/v1.3.8...v1.3.9
[1.3.8]: https://github.com/fractary/faber/compare/v1.3.7...v1.3.8
[1.3.7]: https://github.com/fractary/faber/compare/v1.3.6...v1.3.7
[1.3.6]: https://github.com/fractary/faber/compare/v1.3.5...v1.3.6
[1.3.5]: https://github.com/fractary/faber/compare/v1.3.4...v1.3.5
[1.3.4]: https://github.com/fractary/faber/compare/v1.3.2...v1.3.4
[1.3.2]: https://github.com/fractary/faber/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/fractary/faber/compare/v1.3.0...v1.3.1
