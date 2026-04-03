# SPEC-20260105: Unified YAML Configuration Migration

**Status:** Approved
**Created:** 2026-01-05
**Author:** Claude Sonnet 4.5
**Type:** Breaking Change / Architecture

## Overview

Migrate Fractary Core from fragmented plugin-specific JSON configurations to a unified YAML configuration structure. This is a **breaking change** that consolidates all plugin configs into a single `.fractary/core/config.yaml` file with improved developer experience through environment variable substitution.

## Problem Statement

**Current Issues:**
1. **Fragmented Configuration:** Each of 6 plugins maintains separate config files in `.fractary/plugins/{name}/config.json`
2. **Inconsistent Formats:** CLI uses `.fractary/core/config.json` while plugins use plugin-specific paths
3. **Poor DX:** Users must initialize each plugin separately and manage multiple config files
4. **Semantic Mismatch:** "plugins" directory doesn't reflect that these are also CLI tools and MCP servers
5. **Format Limitation:** JSON doesn't support comments or environment variable references well

**Impact:**
- 1,115 lines of config spread across 6 separate files
- 12 different config loaders across TypeScript, Python, and Bash
- 5 separate init commands for users to remember

## Goals

1. **Unified Configuration:** Single `.fractary/core/config.yaml` file for all plugins
2. **Better Organization:** All core-related files within `.fractary/core/` directory
3. **Improved DX:** Single `fractary-core:init` command, environment variable substitution
4. **Consistency:** YAML format across all config files (aligning with codex project)
5. **Clean Migration:** Clear breaking change with no backward compatibility

## Non-Goals

- Automatic migration from v1.x (force re-init approach)
- Backward compatibility with old config structure
- Gradual rollout (all-at-once breaking change)

## Proposed Solution

### Directory Structure

```
.fractary/
├── core/
│   ├── config.yaml          # Main unified config (NEW)
│   ├── config.example.yaml  # Example template (NEW)
│   └── ...                   # Other core-related files
├── plugins/                  # DEPRECATED
│   ├── work/
│   │   └── config.json      # OLD - to be removed
│   └── ...
```

### Unified YAML Schema

```yaml
version: "2.0"

work:
  active_handler: github  # or jira, linear
  handlers:
    github:
      owner: myorg
      repo: my-project
      token: ${GITHUB_TOKEN}  # Environment variable reference
      classification:
        feature: [feature, enhancement, story]
        bug: [bug, fix, defect]
        chore: [chore, maintenance, docs]
      states:
        open: OPEN
        in_progress: OPEN
        done: CLOSED
      labels:
        prefix: faber-
    jira:
      url: https://company.atlassian.net
      project_key: PROJ
      token: ${JIRA_TOKEN}
    linear:
      workspace_id: workspace-uuid
      token: ${LINEAR_API_KEY}
  defaults:
    auto_assign: false
    auto_label: true
    close_on_merge: true

repo:
  active_handler: github
  handlers:
    github:
      token: ${GITHUB_TOKEN}
  defaults:
    default_branch: main
    branch_naming:
      pattern: "{prefix}/{issue_id}-{slug}"
    merge_strategy: no-ff

logs:
  storage:
    local_path: /logs
    cloud_archive_path: archive/logs/{year}/{month}
  retention:
    default:
      local_days: 30
      cloud_days: forever
  session_logging:
    enabled: true
    redact_sensitive: true

file:
  active_handler: local
  handlers:
    local:
      base_path: .
      create_directories: true

spec:
  storage:
    local_path: /specs
    cloud_archive_path: archive/specs/{year}
  integration:
    work_plugin: fractary-work

docs:
  doc_types:
    adr:
      enabled: true
      path: docs/architecture/ADR
  validation:
    lint_on_generate: true
```

### Environment Variable Substitution

Support `${VAR_NAME}` and `${VAR_NAME:-default}` syntax:
- Runtime substitution when loading config
- Warn if required variables missing
- Clear error messages for missing required vars

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

**1.1 Add YAML Dependencies**
- `cli/package.json` - Add `js-yaml@^4.1.1` and `@types/js-yaml@^4.0.9`
- `mcp/server/package.json` - Add `js-yaml@^4.1.1` and `@types/js-yaml@^4.0.9`

**1.2 Create Unified YAML Loaders**
- **NEW:** `sdk/js/src/common/yaml-config.ts`
  - `loadYamlConfig()` - Load and parse `.fractary/core/config.yaml`
  - `writeYamlConfig()` - Write config with proper formatting
  - `substituteEnvVars()` - Replace `${VAR}` placeholders
  - `findProjectRoot()` - Auto-discover project root

- **NEW:** `sdk/py/fractary_core/common/yaml_config.py`
  - Python equivalent using `pyyaml`

**1.3 Update SDK Config Loaders**
- `sdk/js/src/common/config.ts` - Extract plugin sections from YAML
- `sdk/py/fractary_core/work/manager.py` - Load from `.fractary/core/config.yaml`
- `sdk/py/fractary_core/repo/manager.py` - Load from `.fractary/core/config.yaml`

**1.4 Update CLI & MCP Config Loaders**
- `cli/src/utils/config.ts` - Complete rewrite for YAML
- `mcp/server/src/config.ts` - Update to load YAML

**1.5 Update Shell Script Loaders**
- `plugins/work/skills/fractary-faber-work-common/scripts/config-loader.sh` - Use Python to extract YAML
- `plugins/docs/skills/_shared/lib/config-resolver.sh` - Update for YAML

### Phase 2: Schema & Examples (Week 2)

**2.1 Create Example Config**
- **NEW:** `.fractary/core/config.example.yaml` - Full schema with all plugins

**2.2 Update Plugin Examples**
- Convert JSON examples to reference unified YAML
- Add migration notes to old examples

### Phase 3: Init System (Week 2-3)

**3.1 Create Unified Init Agent**
- **NEW:** `plugins/core/agents/fractary-faber-init.md` - Command: `fractary-core:init`
  - Detects platforms from git remote
  - Validates authentication
  - Creates `.fractary/core/config.yaml`
  - Initializes all plugins at once

**3.2 Deprecate Individual Inits**
- `plugins/work/agents/fractary-faber-init.md` - Add deprecation notice, delegate to unified
- `plugins/repo/agents/fractary-faber-init.md` - Add deprecation notice, delegate to unified
- `plugins/spec/agents/fractary-faber-spec-init.md` - Add deprecation notice, delegate to unified
- `plugins/logs/agents/fractary-faber-logs-init.md` - Add deprecation notice, delegate to unified
- `plugins/file/agents/fractary-faber-file-init.md` - Add deprecation notice, delegate to unified

### Phase 4: Validation & Documentation (Week 3)

**4.1 Config Validation**
- **NEW:** `cli/src/commands/fractary-faber-config.ts`
  - `fractary-core:config validate` - Validate config structure
  - `fractary-core:config show` - Display config (redacted)

**4.2 Update Documentation**
- `docs/guides/configuration.md` - Update all examples to YAML
- Add migration guide with step-by-step instructions
- Document breaking changes

**4.3 Update CHANGELOG**
- `CHANGELOG.md` - Add v2.0 breaking changes section

## Migration Path for Users

```bash
# 1. Backup
tar czf fractary-backup-$(date +%Y%m%d).tar.gz .fractary/

# 2. Upgrade
npm install -g @fractary/core-cli@2.0.0

# 3. Re-initialize
mv .fractary .fractary.v1
fractary-core:init

# 4. Merge custom settings (manual)
vim .fractary/core/config.yaml

# 5. Validate
fractary-core:config validate

# 6. Test
fractary-work:issue list

# 7. Clean up
rm -rf .fractary.v1
```

## Breaking Changes

**Removed:**
- Individual plugin init commands (use `fractary-core:init`)
- `.fractary/plugins/{name}/config.json` files
- `.fractary/core/config.json` (CLI JSON config)
- Automatic migration from v1.x

**Added:**
- Unified `.fractary/core/config.yaml` configuration
- All core files within `.fractary/core/` directory
- Single `fractary-core:init` command
- Environment variable substitution
- Config validation commands

**Unchanged:**
- Environment variable names (GITHUB_TOKEN, etc.)
- Directory structures (/logs, /specs, /docs)
- Plugin functionality and APIs
- CLI command syntax

## Critical Files

### New Files (4)
1. `sdk/js/src/common/yaml-config.ts` - YAML loader (TypeScript)
2. `sdk/py/fractary_core/common/yaml_config.py` - YAML loader (Python)
3. `.fractary/core/config.example.yaml` - Example template
4. `cli/src/commands/fractary-faber-config.ts` - Validation commands
5. `plugins/core/agents/fractary-faber-init.md` - Unified init agent

### Modified Files (16)
6. `cli/package.json` - Add YAML dependency
7. `mcp/server/package.json` - Add YAML dependency
8. `sdk/js/src/common/config.ts` - Update stub loaders
9. `sdk/py/fractary_core/work/manager.py` - Load from YAML
10. `sdk/py/fractary_core/repo/manager.py` - Load from YAML
11. `cli/src/utils/config.ts` - Rewrite for YAML
12. `mcp/server/src/config.ts` - Update for YAML
13. `plugins/work/skills/fractary-faber-work-common/scripts/config-loader.sh` - Python YAML extraction
14. `plugins/docs/skills/_shared/lib/config-resolver.sh` - YAML support
15. `plugins/work/agents/fractary-faber-init.md` - Add deprecation
16. `plugins/repo/agents/fractary-faber-init.md` - Add deprecation
17. `plugins/spec/agents/fractary-faber-spec-init.md` - Add deprecation
18. `plugins/logs/agents/fractary-faber-logs-init.md` - Add deprecation
19. `plugins/file/agents/fractary-faber-file-init.md` - Add deprecation
20. `docs/guides/configuration.md` - Update examples
21. `CHANGELOG.md` - Add v2.0 section

## Naming Conventions

All commands follow pattern: `fractary-{namespace}:init`
- `fractary-core:init` - Main unified command
- `fractary-work:init` - Plugin-specific (deprecated)
- `fractary-core:config validate` - Config validation
- `fractary-core:config show` - Config display

## Success Criteria

- [ ] All 6 plugins work with unified YAML config
- [ ] Init creates valid `.fractary/core/config.yaml`
- [ ] Config validation detects common errors
- [ ] Documentation complete with migration guide
- [ ] Environment variable substitution works correctly
- [ ] No data loss during migration
- [ ] Shell scripts extract config sections properly
- [ ] All core files organized under `.fractary/core/`

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Users lose custom configs | Clear backup instructions in migration guide |
| Breaking changes block adoption | Version bump to 2.0, clear communication |
| Environment var bugs | Extensive testing, clear error messages |
| YAML parsing inconsistencies | Use well-tested libraries (js-yaml, pyyaml) |

## Timeline

- **Week 1:** Core infrastructure (YAML loaders, dependencies)
- **Week 2:** Schema, examples, unified init
- **Week 3:** Validation, documentation, testing
- **Week 4:** Release v2.0, monitor adoption

## Related Specifications

- SPEC-20251217202523: Plugin v3 Architecture
- SPEC-00026: Distributed Plugin Architecture
- Configuration Guide: `docs/guides/configuration.md`

## References

- Codex project: `.fractary/codex/` directory pattern
- JS-YAML: https://github.com/nodeca/js-yaml
- PyYAML: https://pyyaml.org/
