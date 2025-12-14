---
spec_id: WORK-00008-config-initialization-support
work_id: 8
issue_url: https://github.com/fractary/faber/issues/8
title: Add config initialization support to @fractary/faber SDK
type: feature
status: draft
created: 2025-12-14
updated: 2025-12-14
author: jmcwilliam
validated: false
source: conversation+issue
refinement_rounds: 1
---

# Feature Specification: Add config initialization support to @fractary/faber SDK

**Issue**: [#8](https://github.com/fractary/faber/issues/8)
**Type**: Feature
**Status**: Draft
**Created**: 2025-12-14

## Summary

The `@fractary/faber` SDK's spec configuration system blocks CLI usage due to strict validation that runs before any command can execute. This creates a chicken-and-egg problem where users cannot run the `init` command to create a configuration because the configuration is required to run any command. This feature adds config initialization utilities, optional config loading, and partial config support to unblock CLI integration.

**Key Changes**: This implementation will migrate the config format from JSON to YAML for improved human readability, replace existing `initFaberConfig()` and `writeConfig()` functions with a cleaner `ConfigInitializer` API, and change config loading behavior to throw by default with an `allowMissing` option.

## User Stories

### CLI User Initialization
**As a** CLI user
**I want** to run `fractary init` without existing configuration
**So that** I can set up a new project with Fractary tooling

**Acceptance Criteria**:
- [ ] Can run init command in a project without existing `.fractary/plugins/faber/config.yaml`
- [ ] Generated config contains sensible defaults for all required fields
- [ ] Generated config passes validation when loaded
- [ ] Config is written in YAML format for human readability

### Developer SDK Integration
**As a** developer integrating with the @fractary/faber SDK
**I want** to handle missing or partial configurations gracefully
**So that** my application doesn't crash when configuration is incomplete

**Acceptance Criteria**:
- [ ] SDK provides option to allow missing config without throwing (`allowMissing: true`)
- [ ] SpecManager works with partial configuration using defaults
- [ ] Error messages guide users to run `fractary init`
- [ ] Default behavior throws when config is missing (explicit handling required)

## Functional Requirements

- **FR1**: `ConfigInitializer.generateDefaultConfig()` must return a complete, valid `FaberConfig` object with sensible defaults for all sections (work, repo, artifacts, workflow)
- **FR2**: `ConfigInitializer.writeConfig()` must create the `.fractary/plugins/faber/config.yaml` file with proper YAML serialization
- **FR3**: `ConfigInitializer.configExists()` must accurately check if configuration file exists at the specified path
- **FR4**: `loadFaberConfig()` must throw by default when config is missing; with `allowMissing: true`, return `null`
- **FR5**: `loadSpecConfig()` must throw by default when config is missing; with `allowMissing: true`, return `null`
- **FR6**: `SpecManager` constructor must accept optional/partial configuration and use defaults for missing values
- **FR7**: Error messages must suggest running `fractary init` when config is missing
- **FR8**: All changes must be backward compatible - existing JSON configs must continue to work during migration period
- **FR9**: Replace existing `initFaberConfig()` and `writeConfig()` functions with ConfigInitializer API

## Non-Functional Requirements

- **NFR1**: Config generation must complete in under 100ms (performance)
- **NFR2**: Generated configs must use YAML format for human readability (usability)
- **NFR3**: Default config values must follow security best practices (security)
- **NFR4**: API changes must not break existing SDK consumers (compatibility)
- **NFR5**: Support reading existing JSON configs during migration period (backward compatibility)

## Technical Design

### Architecture Changes

Add a new `ConfigInitializer` class to handle configuration initialization operations. This class will **replace** the existing `initFaberConfig()` and `writeConfig()` functions in `src/config.ts` with a cleaner, more focused API.

The existing config loading functions will be modified to:
1. Throw by default when config is missing
2. Accept an `allowMissing` option to return `null` instead of throwing
3. Support both YAML (preferred) and JSON (legacy) formats

The `SpecManager` class constructor will be updated to accept partial configuration and merge with defaults.

### Data Model

**FaberConfig Structure** (matching actual implementation in `src/types.ts`):

```typescript
interface FaberConfig {
  schema_version: string;  // default: '1.0'
  work: WorkConfig;
  repo: RepoConfig;
  artifacts: {
    specs: { use_codex: boolean; local_path: string };  // default: { use_codex: false, local_path: '/specs' }
    logs: { use_codex: boolean; local_path: string };   // default: { use_codex: false, local_path: '.fractary/logs' }
    state: { use_codex: boolean; local_path: string };  // default: { use_codex: false, local_path: '.fractary/plugins/faber' }
  };
  workflow: WorkflowConfig;
  llm?: {
    defaultModel: string;
    modelOverrides?: Record<FaberPhase, string>;
  };
}

interface WorkConfig {
  platform: 'github' | 'jira' | 'linear';  // default: 'github'
  owner?: string;
  repo?: string;
  project?: string;
  token?: string;
}

interface RepoConfig {
  platform: 'github' | 'gitlab' | 'bitbucket';  // default: 'github'
  owner?: string;
  repo?: string;
  defaultBranch?: string;  // default: 'main'
  token?: string;
  branchPrefix?: BranchPrefixConfig;
}

interface WorkflowConfig {
  autonomy: 'dry-run' | 'assisted' | 'guarded' | 'autonomous';  // default: 'guarded'
  phases: {
    frame: { enabled: boolean };
    architect: { enabled: boolean; refineSpec: boolean };
    build: { enabled: boolean };
    evaluate: { enabled: boolean; maxRetries: number };
    release: { enabled: boolean; requestReviews: boolean; reviewers: string[] };
  };
  hooks?: WorkflowHooks;
}
```

### API Design

No REST APIs - this is SDK-only functionality.

**New Static Methods on ConfigInitializer** (replaces existing functions):
- `generateDefaultConfig(): FaberConfig` - Returns complete config with sensible defaults
- `writeConfig(config: FaberConfig, path?: string): void` - Writes config to YAML file
- `configExists(path?: string): boolean` - Checks if config exists
- `readConfig(path?: string): FaberConfig | null` - Reads config supporting both YAML and JSON

**Modified Config Loading Functions**:
- `loadFaberConfig(options?: { allowMissing?: boolean }): FaberConfig | null` - Throws by default
- `loadSpecConfig(options?: { allowMissing?: boolean }): SpecConfig | null` - Throws by default
- `loadWorkConfig(options?: { allowMissing?: boolean }): WorkConfig | null` - Throws by default
- `loadRepoConfig(options?: { allowMissing?: boolean }): RepoConfig | null` - Throws by default

**Deprecated Functions** (to be removed in future version):
- `initFaberConfig()` - Replaced by `ConfigInitializer.generateDefaultConfig()` + `ConfigInitializer.writeConfig()`
- `writeConfig()` (in src/config.ts) - Replaced by `ConfigInitializer.writeConfig()`

### Config File Locations

**New (YAML)**:
- `.fractary/plugins/faber/config.yaml` - Main FABER config

**Legacy (JSON, still supported for reading)**:
- `.fractary/plugins/faber/config.json`
- `.fractary/plugins/work/config.json`
- `.fractary/plugins/repo/config.json`

### UI/UX Changes

No UI changes - SDK-only functionality. CLI will wrap these SDK methods in a user-facing `fractary init` command.

## Implementation Plan

### Phase 1: ConfigInitializer Class
**Status**: Not Started

**Objective**: Create the core ConfigInitializer class with default generation capabilities

**Tasks**:
- [ ] Create `src/config/initializer.ts` file with ConfigInitializer class
- [ ] Implement `generateDefaultConfig()` static method returning full FaberConfig
- [ ] Implement `writeConfig()` static method with YAML serialization and directory creation
- [ ] Implement `configExists()` static method
- [ ] Implement `readConfig()` supporting both YAML and JSON formats
- [ ] Export ConfigInitializer from `src/index.ts`
- [ ] Add `js-yaml` dependency to package.json

**Estimated Scope**: Core initialization logic

### Phase 2: Config Loading Behavior Change
**Status**: Not Started

**Objective**: Change config loading to throw by default with `allowMissing` option

**Tasks**:
- [ ] Add `LoadConfigOptions` interface with `allowMissing` flag
- [ ] Modify `loadFaberConfig()` to throw by default, return null when `allowMissing: true`
- [ ] Modify `loadSpecConfig()` to throw by default, return null when `allowMissing: true`
- [ ] Modify `loadWorkConfig()` to throw by default, return null when `allowMissing: true`
- [ ] Modify `loadRepoConfig()` to throw by default, return null when `allowMissing: true`
- [ ] Update error messages to suggest running `fractary init`

**Estimated Scope**: Config loader modification

### Phase 3: SpecManager Partial Config Support
**Status**: Not Started

**Objective**: Allow SpecManager to work without full configuration

**Tasks**:
- [ ] Update SpecManager constructor to use `loadSpecConfig({ allowMissing: true })`
- [ ] Implement `getDefaultSpecConfig()` private method
- [ ] Merge provided config with defaults in constructor when config is null
- [ ] Update type definitions to accept `Partial<SpecConfig>`

**Estimated Scope**: Manager update

### Phase 4: Deprecate Old Functions
**Status**: Not Started

**Objective**: Mark old functions as deprecated and migrate usage

**Tasks**:
- [ ] Add `@deprecated` JSDoc to `initFaberConfig()` function
- [ ] Add `@deprecated` JSDoc to old `writeConfig()` function
- [ ] Update internal SDK usage to use ConfigInitializer
- [ ] Document migration path in CHANGELOG

**Estimated Scope**: API cleanup

### Phase 5: Testing
**Status**: Not Started

**Objective**: Ensure reliability with comprehensive tests

**Tasks**:
- [ ] Write unit tests for ConfigInitializer methods
- [ ] Write unit tests for loadSpecConfig with allowMissing
- [ ] Write unit tests for SpecManager with partial config
- [ ] Write integration tests for full init workflow
- [ ] Test backward compatibility with existing JSON configs
- [ ] Test YAML config generation and parsing

**Estimated Scope**: Test coverage

## Files to Create/Modify

### New Files
- `src/config/initializer.ts`: ConfigInitializer class with static methods for config generation and file operations

### Modified Files
- `src/config.ts`: Add `allowMissing` option to all load functions, change default behavior to throw, add YAML support
- `src/spec/manager.ts`: Update constructor to handle missing config gracefully
- `src/errors.ts`: Enhance ConfigValidationError with init suggestion
- `src/index.ts`: Export ConfigInitializer class
- `package.json`: Add `js-yaml` dependency

## Testing Strategy

### Unit Tests

```typescript
describe('ConfigInitializer', () => {
  it('generates valid default config with all sections', () => {
    const config = ConfigInitializer.generateDefaultConfig();
    expect(config.schema_version).toBe('1.0');
    expect(config.work.platform).toBe('github');
    expect(config.repo.platform).toBe('github');
    expect(config.artifacts.specs.local_path).toBe('/specs');
    expect(config.workflow.autonomy).toBe('guarded');
    expect(validateConfig(config)).toBe(true);
  });

  it('writes config file in YAML format', () => {
    const config = ConfigInitializer.generateDefaultConfig();
    ConfigInitializer.writeConfig(config, '/tmp/test-config.yaml');
    expect(fs.existsSync('/tmp/test-config.yaml')).toBe(true);
    const content = fs.readFileSync('/tmp/test-config.yaml', 'utf-8');
    expect(content).toContain('schema_version:');  // YAML format
  });

  it('creates parent directories if needed', () => {
    const config = ConfigInitializer.generateDefaultConfig();
    ConfigInitializer.writeConfig(config, '/tmp/nested/dir/config.yaml');
    expect(fs.existsSync('/tmp/nested/dir/config.yaml')).toBe(true);
  });

  it('reads both YAML and JSON configs', () => {
    // YAML
    const yamlConfig = ConfigInitializer.readConfig('/tmp/test-config.yaml');
    expect(yamlConfig).not.toBeNull();

    // JSON (legacy)
    const jsonConfig = ConfigInitializer.readConfig('/tmp/test-config.json');
    expect(jsonConfig).not.toBeNull();
  });
});

describe('loadFaberConfig', () => {
  it('throws when config missing and allowMissing not set', () => {
    expect(() => loadFaberConfig()).toThrow(/fractary init/);
  });

  it('returns null when allowMissing is true', () => {
    const config = loadFaberConfig({ allowMissing: true });
    expect(config).toBeNull();
  });

  it('returns config when it exists', () => {
    ConfigInitializer.writeConfig(ConfigInitializer.generateDefaultConfig());
    const config = loadFaberConfig();
    expect(config).not.toBeNull();
  });
});
```

### Integration Tests

```typescript
describe('Init workflow', () => {
  beforeEach(() => {
    // Clean up any existing config
    const configPath = '.fractary/plugins/faber/config.yaml';
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  });

  it('allows init without existing config', () => {
    const config = ConfigInitializer.generateDefaultConfig();
    ConfigInitializer.writeConfig(config);
    const loaded = loadFaberConfig();
    expect(loaded).toEqual(config);
  });

  it('SpecManager works with allowMissing after init', () => {
    // Before init - should work with defaults
    const manager = new SpecManager();
    expect(manager).toBeDefined();

    // After init - should use config
    ConfigInitializer.writeConfig(ConfigInitializer.generateDefaultConfig());
    const templates = manager.getTemplates();
    expect(templates.length).toBeGreaterThan(0);
  });

  it('backward compatible with existing JSON configs', () => {
    // Write JSON config (legacy format)
    const jsonConfig = ConfigInitializer.generateDefaultConfig();
    fs.writeFileSync('.fractary/plugins/faber/config.json', JSON.stringify(jsonConfig, null, 2));

    // Should still be readable
    const loaded = loadFaberConfig();
    expect(loaded).toEqual(jsonConfig);
  });
});
```

### E2E Tests

End-to-end tests will be handled by the CLI project (fractary/cli) which consumes this SDK. The SDK focuses on unit and integration tests.

### Performance Tests

- Verify `generateDefaultConfig()` completes in < 100ms
- Verify `writeConfig()` handles concurrent access safely

## Dependencies

- `js-yaml`: YAML serialization for config files (new dependency)
- `zod`: Schema validation (existing)
- `fs`: File system operations (Node.js built-in)
- Existing @fractary/faber internal modules

## Risks and Mitigations

- **Risk**: Breaking changes for existing SDK consumers
  - **Likelihood**: Medium (behavior change: throw vs return null)
  - **Impact**: High
  - **Mitigation**: Default behavior throws, but existing code using defaults continues to work. Document migration in CHANGELOG.

- **Risk**: JSON to YAML migration causes issues
  - **Likelihood**: Low
  - **Impact**: Medium
  - **Mitigation**: Support reading both formats during migration period. YAML for new configs, JSON for legacy.

- **Risk**: Default config values become outdated
  - **Likelihood**: Medium
  - **Impact**: Medium
  - **Mitigation**: Centralize defaults in ConfigInitializer, update when config schema changes

- **Risk**: Config file write failures in restricted environments
  - **Likelihood**: Low
  - **Impact**: Medium
  - **Mitigation**: Clear error messages with permission troubleshooting, suggest checking directory permissions

## Documentation Updates

- `README.md`: Add initialization section with `fractary init` usage
- `docs/configuration.md`: Document ConfigInitializer API and YAML format
- `CHANGELOG.md`: Document new features, behavior changes, and API deprecations
- `MIGRATION.md`: Document JSON to YAML migration path

## Rollout Plan

1. Implement and test in @fractary/faber SDK
2. Publish new SDK version with changelog (mark as minor version bump)
3. Update fractary/cli to use new ConfigInitializer
4. Add `fractary init` command to CLI
5. Update documentation across all packages
6. Future version: Remove deprecated functions and JSON support

## Success Metrics

- CLI init command works on first run: 100% success rate
- Existing JSON configs continue to work: No regressions
- New projects use YAML configs: 100% adoption
- Error messages helpful: Users can resolve config issues without external help

## Implementation Notes

- This specification was refined based on analysis of the actual codebase (`src/config.ts`, `src/spec/manager.ts`, `src/types.ts`)
- The existing spec document at `/specs/FABER-SDK-spec-config-initialization.md` contains initial design that should be updated to match this refined spec
- The CLI integration (fractary/cli) depends on these SDK changes being complete
- Related issue: fractary/cli #5 (original issue that identified these blockers)

## Changelog

| Date | Changes |
|------|---------|
| 2025-12-14 | Initial spec created |
| 2025-12-14 | Refined: Updated data model to match actual FaberConfig structure. Clarified config format migration (JSON to YAML). Changed default behavior to throw when config missing. Documented that ConfigInitializer replaces existing functions. Updated file paths to match actual codebase structure. 4/4 questions answered by user. |
