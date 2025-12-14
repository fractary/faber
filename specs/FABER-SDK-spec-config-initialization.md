# @fractary/faber SDK: Spec Configuration Initialization

**Context**: Extracted from fractary/cli issue #5
**Original Spec**: WORK-00005-fix-cli-spec-module-blockers.md
**Target Repository**: fractary/faber

---

## Problem Statement

The `@fractary/faber` SDK's spec configuration system blocks CLI usage due to strict validation that runs before any command can execute.

### Critical Issues

1. **Config validation prevents all commands** - Even read-only operations fail without full config
2. **Chicken-and-egg problem** - Cannot run `init` command to create config because config is required to run any command
3. **No initialization support** - SDK doesn't provide config generation/initialization utilities

## Root Cause

**Location**: `@fractary/faber` SDK configuration loading

```typescript
// Current behavior in SDK
export function loadSpecConfig(): SpecConfig {
  // Throws if config file missing or invalid
  // No way to bypass for init command
  // No partial config support
}
```

The `loadSpecConfig()` function and `SpecManager` constructor require complete, valid configuration before any operation can proceed.

## Solution Design

### Task 1: Add Config Initialization Support

Create `ConfigInitializer` class in SDK:

```typescript
// In @fractary/faber/src/config/initializer.ts
export class ConfigInitializer {
  /**
   * Generate default configuration
   */
  static generateDefaultConfig(): FaberConfig {
    return {
      work: {
        platform: 'github',
        // ... sensible defaults
      },
      repo: {
        platform: 'github',
        // ... sensible defaults
      },
      artifacts: {
        specs_dir: './specs',
        logs_dir: './logs',
        // ... sensible defaults
      },
      spec: {
        templates_dir: './templates/specs',
        // ... sensible defaults
      }
    };
  }

  /**
   * Write configuration file
   */
  static writeConfig(
    config: FaberConfig,
    path: string = '.fractary/config.yaml'
  ): void {
    // Ensure directory exists
    // Serialize to YAML
    // Write file
  }

  /**
   * Check if config exists
   */
  static configExists(path: string = '.fractary/config.yaml'): boolean {
    return fs.existsSync(path);
  }
}
```

### Task 2: Make Config Loading Optional

Modify `loadSpecConfig()` to support optional/missing config:

```typescript
// In @fractary/faber/src/config/loader.ts
export function loadSpecConfig(options?: {
  allowMissing?: boolean
}): SpecConfig | null {
  try {
    // Load and validate config
    const config = loadAndValidateConfig();
    return config;
  } catch (error) {
    if (options?.allowMissing) {
      return null; // Allow missing config for init
    }
    throw new ConfigError(
      'Configuration required for this operation.\n\n' +
      'Run \'fractary init\' to generate a template configuration.'
    );
  }
}
```

### Task 3: Support Partial Config in SpecManager

Allow `SpecManager` to work with partial/missing config:

```typescript
// In @fractary/faber/src/managers/SpecManager.ts
export class SpecManager {
  constructor(config?: Partial<SpecConfig>) {
    // Use provided config or sensible defaults
    this.config = config ?? this.getDefaultConfig();
  }

  private getDefaultConfig(): SpecConfig {
    return {
      templates_dir: './templates/specs',
      specs_dir: './specs',
      // ... minimal defaults
    };
  }
}
```

## Affected Files

```
@fractary/faber/
├── src/
│   ├── config/
│   │   ├── loader.ts         # Add allowMissing option
│   │   ├── initializer.ts    # NEW: ConfigInitializer class
│   │   └── validator.ts      # Update error messages
│   ├── managers/
│   │   └── SpecManager.ts    # Accept partial config
│   └── index.ts              # Export ConfigInitializer
```

## Acceptance Criteria

- [ ] `ConfigInitializer.generateDefaultConfig()` returns valid config
- [ ] `ConfigInitializer.writeConfig()` creates `.fractary/config.yaml`
- [ ] `ConfigInitializer.configExists()` checks for existing config
- [ ] `loadSpecConfig({ allowMissing: true })` returns null without throwing
- [ ] `SpecManager` works with partial/missing config
- [ ] Error messages suggest running `fractary init`
- [ ] Generated config passes validation
- [ ] Backward compatible - existing configs still work

## Test Plan

### Unit Tests

```typescript
describe('ConfigInitializer', () => {
  it('generates valid default config', () => {
    const config = ConfigInitializer.generateDefaultConfig();
    expect(validateConfig(config)).toBe(true);
  });

  it('writes config file', () => {
    const config = ConfigInitializer.generateDefaultConfig();
    ConfigInitializer.writeConfig(config, '/tmp/test-config.yaml');
    expect(fs.existsSync('/tmp/test-config.yaml')).toBe(true);
  });

  it('checks if config exists', () => {
    expect(ConfigInitializer.configExists('/tmp/nonexistent.yaml')).toBe(false);
  });
});

describe('loadSpecConfig', () => {
  it('returns null when allowMissing=true and no config', () => {
    const config = loadSpecConfig({ allowMissing: true });
    expect(config).toBeNull();
  });

  it('throws helpful error when config missing', () => {
    expect(() => loadSpecConfig()).toThrow(/fractary init/);
  });
});

describe('SpecManager', () => {
  it('works with no config', () => {
    const manager = new SpecManager();
    expect(manager).toBeDefined();
  });

  it('works with partial config', () => {
    const manager = new SpecManager({ specs_dir: './custom' });
    expect(manager.config.specs_dir).toBe('./custom');
  });
});
```

### Integration Tests

```typescript
describe('Init workflow', () => {
  beforeEach(() => {
    // Remove config if exists
    if (fs.existsSync('.fractary/config.yaml')) {
      fs.unlinkSync('.fractary/config.yaml');
    }
  });

  it('allows init without existing config', () => {
    const config = ConfigInitializer.generateDefaultConfig();
    ConfigInitializer.writeConfig(config);

    // Verify config is valid
    const loaded = loadSpecConfig();
    expect(loaded).toEqual(config);
  });

  it('init works when called from CLI', async () => {
    // Simulate CLI calling SDK
    const manager = new SpecManager(); // Should work without config
    const config = ConfigInitializer.generateDefaultConfig();
    ConfigInitializer.writeConfig(config);

    // Now other operations should work
    const templates = manager.getTemplates();
    expect(templates.length).toBeGreaterThan(0);
  });
});
```

## Implementation Priority

1. **ConfigInitializer class** - Core initialization logic
2. **loadSpecConfig allowMissing** - Enable init to run
3. **SpecManager partial config** - Graceful degradation
4. **Error message improvements** - Better UX
5. **Tests** - Ensure reliability

## CLI Integration

Once SDK changes are complete, the CLI will add a minimal wrapper:

```typescript
// In @fractary/cli
import { ConfigInitializer } from '@fractary/faber';

program
  .command('init')
  .description('Initialize Fractary configuration')
  .option('--force', 'Overwrite existing configuration')
  .action(async (options) => {
    if (ConfigInitializer.configExists() && !options.force) {
      console.log('Configuration already exists. Use --force to overwrite.');
      return;
    }

    const config = ConfigInitializer.generateDefaultConfig();
    ConfigInitializer.writeConfig(config);
    console.log('✓ Created .fractary/config.yaml');
  });
```

## Backward Compatibility

- Existing configurations must continue to work
- No breaking changes to config schema
- Default behavior unchanged (still requires config)
- Only new optional behavior added (allowMissing)

## Related Issues

- **fractary/cli #5** - Original issue that identified these blockers
- **Blocks**: fractary/cli WORK-00359 (spec plugin CLI integration)
- **Relates to**: Work plugin CLI migration pattern

## References

- Original findings: fractary/cli WORK-00359-phase-0-findings.md
- Refined spec: fractary/cli WORK-00005-fix-cli-spec-module-blockers.md
- CLI implementation: fractary/cli src/tools/faber/commands/spec/index.ts (already has --json)
