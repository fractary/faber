# Logs Plugin Template Migration Specification

## Overview

Migrate the logs plugin from skill-based log type definitions to language-agnostic YAML/Markdown templates, following the same pattern established for the docs plugin in PR #72.

## Problem Statement

The logs plugin currently defines log types as Claude Code skills (`plugins/logs/skills/fractary-faber-log-type-*`), which creates the same problems we solved for docs:

1. **SDK/CLI inaccessibility** - Log types are only accessible to Claude agents, not programmatically
2. **Context inflation** - Loading each skill inflates agent context unnecessarily
3. **No custom types** - Projects cannot define custom log types without creating skills
4. **Language coupling** - Types are embedded in markdown skill format, not reusable by other SDKs

## Current State

### Log Type Skills (10 types)
```
plugins/logs/skills/
├── log-type-audit/       # Security events, access logs, compliance tracking
├── log-type-build/       # CI/CD builds, compilation output
├── log-type-changelog/   # Version changes, feature updates
├── log-type-debug/       # Troubleshooting, bug investigation
├── log-type-deployment/  # Production deploys, rollbacks
├── log-type-operational/ # System events, service health
├── log-type-selector/    # Type selection logic
├── log-type-session/     # Claude Code conversation tracking
├── log-type-test/        # Test runs, QA results
└── log-type-workflow/    # FABER phases, ETL pipelines
```

Each skill contains:
- `SKILL.md` - Type definition with embedded schema, template, and standards

### Docs Template Structure (Reference)
```
templates/docs/
├── manifest.yaml         # Lists all doc types with URLs
├── adr/
│   ├── type.yaml        # Type definition (schema, frontmatter, file naming)
│   ├── template.md      # Mustache template
│   └── standards.md     # Writing standards
├── api/
└── ... (11 doc types)
```

## Proposed Solution

### 1. Create `templates/logs/` Directory

Mirror the docs template structure:

```
templates/logs/
├── manifest.yaml         # Lists all log types
├── audit/
│   ├── type.yaml
│   ├── template.md
│   └── standards.md
├── build/
│   ├── type.yaml
│   ├── template.md
│   └── standards.md
├── changelog/
├── debug/
├── deployment/
├── operational/
├── session/
├── test/
└── workflow/
```

### 2. Manifest Format

```yaml
# templates/logs/manifest.yaml
version: "1.0"

base_url: https://raw.githubusercontent.com/fractary/core/main/templates/logs

log_types:
  - id: audit
    display_name: Audit Log
    description: Security events, access logs, compliance tracking, change audits
    path: ./audit
    url: ${base_url}/audit/type.yaml

  - id: build
    display_name: Build Log
    description: CI/CD builds, compilation output, npm/cargo/make builds
    path: ./build
    url: ${base_url}/build/type.yaml

  - id: changelog
    display_name: Changelog Log
    description: Version changes, feature updates, release notes
    path: ./changelog
    url: ${base_url}/changelog/type.yaml

  - id: debug
    display_name: Debug Log
    description: Troubleshooting, bug investigation, error analysis
    path: ./debug
    url: ${base_url}/debug/type.yaml

  - id: deployment
    display_name: Deployment Log
    description: Production deploys, staging releases, rollbacks
    path: ./deployment
    url: ${base_url}/deployment/type.yaml

  - id: operational
    display_name: Operational Log
    description: System events, service health, monitoring alerts
    path: ./operational
    url: ${base_url}/operational/type.yaml

  - id: session
    display_name: Session Log
    description: Claude Code sessions, conversation tracking, token usage
    path: ./session
    url: ${base_url}/session/type.yaml

  - id: test
    display_name: Test Log
    description: Test runs, QA results, coverage reports
    path: ./test
    url: ${base_url}/test/type.yaml

  - id: workflow
    display_name: Workflow Log
    description: FABER phases, ETL pipelines, automation steps
    path: ./workflow
    url: ${base_url}/workflow/type.yaml
```

### 3. Log Type Definition Format

Example `templates/logs/session/type.yaml`:

```yaml
id: session
display_name: Session Log
description: Claude Code session logs for conversation tracking, AI session records, token usage, interaction history

output_path: .fractary/logs/sessions

file_naming:
  pattern: "{date}-{session_id}.md"
  date_format: "YYYYMMDD-HHmmss"
  slug_source: session_id
  slug_max_length: 36

frontmatter:
  required_fields:
    - log_type
    - title
    - session_id
    - date
    - status
  optional_fields:
    - conversation_id
    - repository
    - branch
    - model
    - token_count
    - duration_seconds
    - work_id
    - tags
  defaults:
    log_type: session
    status: active

structure:
  required_sections:
    - Metadata
    - Conversation
  optional_sections:
    - Summary
    - Decisions
    - Follow-ups
  section_order:
    - Metadata
    - Conversation
    - Summary
    - Decisions
    - Follow-ups

status:
  allowed_values:
    - active
    - stopped
    - archived
    - error
  default: active

retention:
  default_local_days: 7
  default_cloud_days: forever
  auto_archive: true
  cleanup_after_archive: false
```

### 4. SDK Changes

#### 4.1 Create LogTypeRegistry

New file: `sdk/js/src/logs/type-registry.ts`

```typescript
export interface LogType {
  id: string;
  display_name: string;
  description: string;
  output_path: string;
  file_naming: {
    pattern: string;
    date_format?: string;
    slug_source?: string;
    slug_max_length?: number;
  };
  frontmatter: {
    required_fields: string[];
    optional_fields: string[];
    defaults: Record<string, unknown>;
  };
  structure: {
    required_sections: string[];
    optional_sections: string[];
    section_order: string[];
  };
  status: {
    allowed_values: string[];
    default: string;
  };
  retention?: {
    default_local_days: number;
    default_cloud_days: number | 'forever';
    auto_archive: boolean;
    cleanup_after_archive: boolean;
  };
}

export class LogTypeRegistry {
  private types: Map<string, LogType> = new Map();

  loadCoreTypes(): LogType[];
  loadCustomTypes(manifestPath: string): LogType[];
  getAllTypes(): LogType[];
  getType(id: string): LogType | null;

  static getCoreManifestUrl(): string {
    return 'https://raw.githubusercontent.com/fractary/core/main/templates/logs/manifest.yaml';
  }
}
```

#### 4.2 Update LogsManager

Modify `sdk/js/src/logs/manager.ts` to use LogTypeRegistry:

```typescript
class LogsManager {
  private typeRegistry: LogTypeRegistry;

  constructor(config: LogsConfig) {
    this.typeRegistry = new LogTypeRegistry();
    this.typeRegistry.loadCoreTypes();

    if (config.custom_templates_path) {
      this.typeRegistry.loadCustomTypes(config.custom_templates_path);
    }
  }

  async createLog(options: {
    logType: string;
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<Log>;

  async getLogTypes(): Promise<LogType[]>;
  async getLogType(id: string): Promise<LogType | null>;
}
```

### 5. CLI Changes

#### 5.1 New Commands

Add to `cli/src/commands/fractary-faber-logs/index.ts`:

```bash
# List available log types (core + custom)
fractary-core logs types [--json]

# Get log type definition
fractary-core logs type-info <type> [--json]

# Create log with type
fractary-core logs create <log_type> --title "<title>" [--content "<content>"] [--json]

# Validate log against type
fractary-core logs validate <file> [--log-type <type>]
```

#### 5.2 Command Examples

```bash
# List all log types
$ fractary-core logs types
Available log types:
  - audit      : Security events, access logs, compliance tracking
  - build      : CI/CD builds, compilation output
  - session    : Claude Code sessions, conversation tracking
  ...

# Get type definition
$ fractary-core logs type-info session --json
{
  "id": "session",
  "display_name": "Session Log",
  "frontmatter": { ... },
  "structure": { ... }
}

# Create a session log
$ fractary-core logs create session --title "Debugging auth flow" --json
{
  "success": true,
  "file": ".fractary/logs/sessions/20260119-143022-abc123.md"
}
```

### 6. Plugin Changes

#### 6.1 Update logs-capture Agent

Modify `plugins/logs/agents/fractary-faber-logs-capture.md` to use CLI:

```markdown
<CLI_COMMANDS>
## Get Type Definition
fractary-core logs type-info <type> --json

## Create Log
fractary-core logs create <log_type> --title "<title>" --content "<content>" --json

## List Types
fractary-core logs types --json
</CLI_COMMANDS>
```

#### 6.2 Update log-type-selector Skill

Keep `log-type-selector` but update to use CLI:

```markdown
<WORKFLOW>
1. Run: fractary-core logs types --json
2. Parse response to get available types
3. Present type options to user
4. Return selected type ID for agent use
</WORKFLOW>
```

#### 6.3 Remove Log Type Skills

Archive or delete these skills (moved to SDK):
- `log-type-audit/`
- `log-type-build/`
- `log-type-changelog/`
- `log-type-debug/`
- `log-type-deployment/`
- `log-type-operational/`
- `log-type-session/`
- `log-type-test/`
- `log-type-workflow/`

### 7. Configuration Support

#### 7.1 Custom Templates Path

Already added to configurator (this spec):

```yaml
logs:
  custom_templates_path: .fractary/logs/templates/manifest.yaml
```

#### 7.2 Custom Log Type Example

Projects can create `.fractary/logs/templates/manifest.yaml`:

```yaml
version: "1.0"

log_types:
  - id: incident
    display_name: Incident Log
    description: Production incidents, outages, postmortems
    path: ./incident
```

With corresponding `.fractary/logs/templates/incident/type.yaml`.

## Implementation Phases

### Phase 1: Create Templates Structure
1. Create `templates/logs/` directory
2. Create `manifest.yaml` listing all log types
3. Convert each log-type-* skill to YAML/Markdown format:
   - Extract schema to `type.yaml`
   - Extract template to `template.md`
   - Extract standards to `standards.md`

### Phase 2: SDK Implementation
1. Create `LogTypeRegistry` class in `sdk/js/src/logs/type-registry.ts`
2. Update `LogsManager` to use type registry
3. Add YAML loading for log types (similar to docs)
4. Write unit tests for type loading

### Phase 3: CLI Implementation
1. Add `logs types` command
2. Add `logs type-info <type>` command
3. Add `--log-type` flag to `logs create`
4. Add `logs validate` command

### Phase 4: Plugin Migration
1. Update `logs-capture` agent to use CLI commands
2. Update `log-type-selector` skill to use CLI
3. Archive log-type-* skills (keep for reference)
4. Update marketplace manifest

### Phase 5: Version Updates
1. SDK: 0.4.0 → 0.5.0 (new LogTypeRegistry)
2. CLI: 0.3.0 → 0.4.0 (new logs commands)
3. Plugin: Update manifest version

## Verification Checklist

- [ ] `templates/logs/manifest.yaml` lists all 9 log types
- [ ] Each log type has: `type.yaml`, `template.md`, `standards.md`
- [ ] `fractary-core logs types` lists all types
- [ ] `fractary-core logs type-info session` returns type definition
- [ ] `fractary-core logs create session --title "Test"` creates valid log
- [ ] Custom types in `.fractary/logs/templates/` are loaded
- [ ] Plugin agents create logs via CLI
- [ ] Old log-type-* skills archived
- [ ] All tests pass

## Files to Create/Modify

### Create
| File | Description |
|------|-------------|
| `templates/logs/manifest.yaml` | Log types manifest |
| `templates/logs/*/type.yaml` | Type definitions (9 files) |
| `templates/logs/*/template.md` | Templates (9 files) |
| `templates/logs/*/standards.md` | Standards (9 files) |
| `sdk/js/src/logs/type-registry.ts` | LogTypeRegistry class |

### Modify
| File | Change |
|------|--------|
| `sdk/js/src/logs/manager.ts` | Use LogTypeRegistry |
| `sdk/js/src/logs/index.ts` | Export LogTypeRegistry |
| `cli/src/commands/fractary-faber-logs/index.ts` | Add type commands |
| `plugins/logs/agents/fractary-faber-logs-capture.md` | Use CLI |
| `plugins/logs/skills/fractary-faber-log-type-selector/SKILL.md` | Use CLI |

### Archive/Delete
| File | Reason |
|------|--------|
| `plugins/logs/skills/fractary-faber-log-type-audit/` | Moved to templates |
| `plugins/logs/skills/fractary-faber-log-type-build/` | Moved to templates |
| `plugins/logs/skills/fractary-faber-log-type-changelog/` | Moved to templates |
| `plugins/logs/skills/fractary-faber-log-type-debug/` | Moved to templates |
| `plugins/logs/skills/fractary-faber-log-type-deployment/` | Moved to templates |
| `plugins/logs/skills/fractary-faber-log-type-operational/` | Moved to templates |
| `plugins/logs/skills/fractary-faber-log-type-session/` | Moved to templates |
| `plugins/logs/skills/fractary-faber-log-type-test/` | Moved to templates |
| `plugins/logs/skills/fractary-faber-log-type-workflow/` | Moved to templates |

## Dependencies

- Docs SDK migration (PR #72) - COMPLETED
- Configurator custom_templates_path settings - COMPLETED (this session)

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing log creation | Keep skill files during transition, deprecate gradually |
| Custom log types in projects | Document migration path, provide CLI migration tool |
| SDK version compatibility | Maintain backward-compatible API signatures |

## Success Criteria

1. All log types accessible via `fractary-core logs types`
2. Logs created via CLI match previous skill-based output
3. Custom log types work via `custom_templates_path`
4. Plugin context reduced (no skill loading per type)
5. Python SDK can reuse YAML type definitions
