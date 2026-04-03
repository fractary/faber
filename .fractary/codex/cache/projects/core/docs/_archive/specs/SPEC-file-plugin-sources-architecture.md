# SPEC: File Plugin Sources Architecture

**Status:** Draft
**Created:** 2026-01-15
**Author:** Claude Code
**Related Issues:** #49, #50

## Overview

This specification defines the migration of the file plugin to a sources-based architecture that integrates with the codex plugin for unified resource management. The file plugin will focus on managing local project artifacts (specs, logs, assets) with push/pull operations to cloud storage, while the codex plugin will handle cross-project access and URI resolution.

## Problem Statement

### Current Limitations

1. **Configuration Structure**: Current config uses handler-based structure focused on switching between storage providers, not managing multiple sources within a project
2. **Path Organization**: Artifacts stored in suboptimal locations:
   - `/specs/` and `/logs/` at repo root (gets cluttered)
   - `.fractary/plugins/logs/` and `.fractary/plugins/spec/` for indices (plugin-centric, not data-centric)
3. **Tight Coupling**: Logs and specs plugins directly call S3 handler scripts, hardcoded to S3
4. **No Unified Interface**: No high-level push/pull operations; plugins call low-level handler scripts
5. **Plugin vs Data**: "Plugins" folder contains both plugin code and runtime data

### Goals

1. **Sources-Based Config**: Multiple named sources per project (specs, logs, assets) with independent cloud destinations
2. **Cleaner Paths**: Move artifacts to `.fractary/` directory structure
3. **Unified Operations**: High-level push/pull commands that plugins can use
4. **Handler Agnostic**: Plugins shouldn't care if storage is S3, R2, GCS, or local
5. **Codex Integration**: File sources automatically available in codex namespace for current project

## Architecture

### Configuration Structure

**Location:** `.fractary/config.yaml`

```yaml
file:
  schema_version: "2.0"

  sources:
    specs:
      type: s3                        # Handler type: s3 | r2 | gcs | gdrive | local
      bucket: {project-name}-files    # Explicit bucket name
      prefix: specs/                  # Path prefix within bucket
      region: us-east-1
      local:
        base_path: .fractary/specs    # Local storage path
      push:
        compress: false               # Compression settings
        keep_local: true             # Keep local copy after push
      auth:
        profile: default             # AWS profile for credentials

    logs:
      type: s3
      bucket: {project-name}-files    # Same bucket, different prefix
      prefix: logs/
      region: us-east-1
      local:
        base_path: .fractary/logs
      push:
        compress: true               # Enable compression for logs
        keep_local: true
      auth:
        profile: default

    assets:
      type: s3
      bucket: {project-name}-files
      prefix: assets/
      region: us-east-1
      local:
        base_path: .fractary/assets
      push:
        compress: false
        keep_local: false            # Delete local after push (CDN source)
      public: true                   # Public read access
      auth:
        profile: default
```

**Key Features:**
- Each source has independent configuration
- Type-based (s3, r2, gcs, local, gdrive)
- Explicit bucket names (no auto-derivation)
- Local paths clearly defined
- Push behavior configurable per source
- Authentication per source

### Bucket Naming Convention

**Pattern:** `{project-name}-files`

Where `{project-name}` is the full project name from codex namespace:
- Simple projects: `core-files`, `faber-files`
- Compound projects: `corthodex-core-files`, `corthodex-api-files`
- Projects with dots: `etl-corthion-ai-files` (sanitize dots to hyphens)

**Examples:**
- `codex://fractary/core/...` → bucket: `core-files`
- `codex://corthos/corthodex-core/...` → bucket: `corthodex-core-files`
- `codex://corthos/etl.corthion.ai/...` → bucket: `etl-corthion-ai-files`

**Default:** Single bucket with prefixes (specs/, logs/, assets/)
**Custom:** Users can override to separate buckets per source if needed

### Directory Structure

```
.fractary/
├── config.yaml                  # Unified system config (file, codex, logs, specs, etc.)
├── logs/                        # Logs plugin data (NEW location)
│   ├── issue-123.log
│   └── archive-index.json
├── specs/                       # Specs plugin data (NEW location)
│   ├── SPEC-001.md
│   └── archive-index.json
├── assets/                      # Assets (future)
│   └── diagram.png
└── codex/
    └── cache/                   # Codex cache for external projects
        └── {org}/
            └── {project}/
```

**Rationale:**
- `.fractary/config.yaml` = unified system configuration (simpler, single source of truth)
- `.fractary/{plugin-data}/` = plugin runtime data
- Flat structure, easy to locate
- Aligned with "not plugins, but capabilities"

### Operations

#### Push Operation

**Purpose:** Upload local file to cloud storage

**Command:**
```bash
fractary-file push <path> [--source <source-name>]
```

**Examples:**
```bash
# Explicit source
fractary-file push specs/SPEC-001.md --source specs

# Auto-detect source from path
fractary-file push specs/SPEC-001.md
# → Finds source where local.base_path matches "specs/"

# Push all files in a source
fractary-file push --source logs --all
```

**Behavior:**
1. Resolve source from `--source` flag or path pattern
2. Read source config (type, bucket, prefix, local, push, auth)
3. Determine handler from type (s3, r2, gcs, etc.)
4. Apply compression if configured
5. Call handler upload script with source config
6. Handle keep_local setting (delete or keep)
7. Return cloud URL and metadata

**Return Format:**
```json
{
  "source": "specs",
  "local_path": ".fractary/specs/SPEC-001.md",
  "cloud_url": "s3://core-files/specs/SPEC-001.md",
  "public_url": "https://core-files.s3.amazonaws.com/specs/SPEC-001.md",
  "size_bytes": 12345,
  "compressed": false,
  "checksum": "sha256:abc123...",
  "uploaded_at": "2026-01-15T10:30:00Z"
}
```

#### Pull Operation

**Purpose:** Download file from cloud storage to local

**Command:**
```bash
fractary-file pull <path> [--source <source-name>]
```

**Examples:**
```bash
# Pull specific file
fractary-file pull specs/SPEC-001.md --source specs

# Pull with auto-detect
fractary-file pull specs/SPEC-001.md

# Pull all files in a source
fractary-file pull --source logs --all
```

**Behavior:**
1. Resolve source
2. Check if file exists locally (skip if exists unless --force)
3. Call handler download script
4. Decompress if needed
5. Save to local.base_path

#### Read Operation

**Purpose:** Read file content (local first, pull from cloud if needed)

**Command:**
```bash
fractary-file read <path> [--source <source-name>]
```

**Behavior:**
1. Resolve source
2. Check local path first
3. If exists locally → return content
4. If not exists locally → pull from cloud
5. Return content (not for codex MCP - that's codex responsibility)

**Note:** This operation is for plugin/script use. Codex plugin handles MCP URI resolution.

### Integration with Logs Plugin

**Current Integration:**
- Hardcoded S3 handler calls in `plugins/logs/scripts/upload-to-cloud.sh`
- Reads config from `.fractary/plugins/file/config.json`
- Stores index at `.fractary/plugins/logs/archive-index.json`

**New Integration:**
```bash
# In logs plugin archive script
LOG_DIR=$(yq eval '.file.sources.logs.local.base_path' .fractary/config.yaml)
# → ".fractary/logs"

# Write logs to correct location
echo "$log_entry" >> "${LOG_DIR}/issue-123.log"

# Archive using file plugin push
fractary-file push "${LOG_DIR}/issue-123.log" --source logs

# Update archive index at new location
INDEX_FILE="${LOG_DIR}/archive-index.json"
```

**Config Updates:**
```yaml
logs:
  storage:
    local_path: .fractary/logs              # NEW (was /logs)
    archive_index_file: archive-index.json  # Relative to local_path
```

### Integration with Specs Plugin

**Current Integration:**
- Hardcoded S3 handler calls in `plugins/spec/scripts/upload-to-cloud.sh`
- Stores index at `.fractary/plugins/spec/archive-index.json`
- References file plugin in config: `integration.file_plugin: fractary-file`

**New Integration:**
```bash
# In spec plugin
SPEC_DIR=$(yq eval '.file.sources.specs.local.base_path' .fractary/config.yaml)
# → ".fractary/specs"

# Write specs to correct location
cat > "${SPEC_DIR}/SPEC-001.md" << EOF
...
EOF

# Archive using file plugin push
fractary-file push "${SPEC_DIR}/SPEC-001.md" --source specs

# Update archive index
INDEX_FILE="${SPEC_DIR}/archive-index.json"
```

**Config Updates:**
```yaml
spec:
  storage:
    local_path: .fractary/specs                      # NEW (was /specs)
    archive_index:
      local_cache: .fractary/specs/archive-index.json  # NEW location
```

### Integration with Codex Plugin

**File Plugin Responsibility:**
- Manage local sources for THIS project
- Push/pull operations to/from cloud
- Provide configuration schema

**Codex Plugin Responsibility:**
- Auto-import file sources for current project
- Resolve `codex://` URIs
- Handle cross-project dependencies
- Manage MCP interface
- Optimize current project access (no cache copy)

**Interaction:**
```yaml
# In codex plugin initialization
def load_sources():
    file_config = load_config('.fractary/config.yaml')['file']
    codex_config = load_config('.fractary/config.yaml')['codex']

    current_project = codex_config['project']

    # Auto-import file sources for current project
    sources = {
        current_project: file_config['sources'],  # specs, logs, assets
        **codex_config['dependencies']           # external projects
    }

    return sources
```

**URI Resolution (codex plugin handles):**
```
codex://specs/SPEC-001.md
→ Current project
→ Check file.sources.specs.local.base_path (.fractary/specs/)
→ If exists: read local file (no cache)
→ If not exists: pull from cloud using file.sources.specs config
→ Return content
```

## Migration Path

### Phase 1: Update File Plugin Config Schema

1. Update config schema to v2.0 with sources structure
2. Keep backward compatibility with v1.0 (detect and migrate)
3. Update config validation and loading logic

### Phase 2: Update Local Paths

1. Create new directory structure:
   ```bash
   mkdir -p .fractary/logs
   mkdir -p .fractary/specs
   ```
2. Move archive indices:
   ```bash
   mv .fractary/plugins/logs/archive-index.json .fractary/logs/
   mv .fractary/plugins/spec/archive-index.json .fractary/specs/
   ```
3. Update logs plugin config (local_path)
4. Update specs plugin config (local_path)
5. Add migration script for existing projects

### Phase 3: Implement Push/Pull Commands

1. Create high-level push command
2. Create high-level pull command
3. Source resolution logic (by name or path pattern)
4. Handler routing based on source type
5. Update plugin integration

### Phase 4: Update Logs/Specs Plugin Integration

1. Update `upload-to-cloud.sh` scripts to use `fractary-file push`
2. Update path reading logic to use file config
3. Update archive index locations
4. Test archival workflows

### Phase 5: Update Core Init

1. Create default file sources (specs, logs)
2. Use new config structure (v2.0)
3. Create .fractary/ directories
4. Generate bucket names from project name

## Core Init Configuration

**Default config created by `fractary-core:init`:**

```yaml
file:
  schema_version: "2.0"

  sources:
    specs:
      type: s3
      bucket: {project-name}-files       # Derived from project
      prefix: specs/
      region: us-east-1                  # Default, user can override
      local:
        base_path: .fractary/specs
      push:
        compress: false
        keep_local: true
      auth:
        profile: default

    logs:
      type: s3
      bucket: {project-name}-files       # Same bucket, different prefix
      prefix: logs/
      region: us-east-1
      local:
        base_path: .fractary/logs
      push:
        compress: true                   # Enable for logs
        keep_local: true
      auth:
        profile: default

codex:
  schema_version: "2.0"
  organization: {org}                    # Detected from git or prompted
  project: {project}                     # Detected from repo name
  dependencies: {}                       # Empty, user adds as needed
```

**Organization/Project Detection:**
1. Try `git remote get-url origin` → parse `org/project`
2. If not git repo or ambiguous → prompt user
3. Use for codex namespace and bucket naming

## Backward Compatibility

### Config Migration

**v1.0 → v2.0:**
```yaml
# Old v1.0 config
file:
  schema_version: "1.0"
  active_handler: local
  handlers:
    local:
      base_path: .

# Migrated to v2.0
file:
  schema_version: "2.0"
  sources:
    default:
      type: local
      local:
        base_path: .
```

**Detection:**
```bash
if [[ $(yq eval '.file.schema_version' config.yaml) == "1.0" ]]; then
  echo "Migrating file config from v1.0 to v2.0..."
  fractary-core migrate-config --file
fi
```

### Path Migration

**Old paths → New paths:**
- `/specs/` → `.fractary/specs/`
- `/logs/` → `.fractary/logs/`
- `.fractary/plugins/logs/archive-index.json` → `.fractary/logs/archive-index.json`
- `.fractary/plugins/spec/archive-index.json` → `.fractary/specs/archive-index.json`

**Migration script:**
```bash
fractary-core migrate-paths
# 1. Checks if old paths exist
# 2. Moves files to new locations
# 3. Updates gitignore
# 4. Updates config references
# 5. Validates new structure
```

## Testing Strategy

### Unit Tests
- Config schema validation (v2.0)
- Source resolution logic (by name, by path)
- Handler routing (type → handler)
- Push/pull operations

### Integration Tests
- Logs plugin archival workflow
- Specs plugin archival workflow
- Config migration (v1.0 → v2.0)
- Path migration (old → new)

### End-to-End Tests
1. **Fresh Init:**
   - Run `fractary-core:init` in new project
   - Verify default file sources created
   - Verify directories created
   - Verify bucket names derived correctly

2. **Logs Workflow:**
   - Create log file
   - Run logs:archive command
   - Verify push to S3
   - Verify archive index updated
   - Verify local file handling (keep/delete)

3. **Specs Workflow:**
   - Create spec file
   - Run spec:archive command
   - Verify push to S3
   - Verify archive index updated

4. **Codex Integration:**
   - Access current project spec via codex URI
   - Verify no cache copy created
   - Pull external project spec
   - Verify cache created for external

## Out of Scope

The following are handled by the codex plugin (separate project):
- `codex://` URI resolution logic
- Cross-project dependency management
- MCP server integration for codex URIs
- External project caching strategy
- Organization namespace handling

## Success Criteria

1. ✅ File plugin uses sources-based config (v2.0)
2. ✅ Artifacts stored in `.fractary/specs/` and `.fractary/logs/`
3. ✅ High-level push/pull commands available
4. ✅ Logs plugin uses file plugin push (not direct handler calls)
5. ✅ Specs plugin uses file plugin push (not direct handler calls)
6. ✅ Core init creates default sources with correct bucket names
7. ✅ Backward compatibility with v1.0 config (auto-migrate)
8. ✅ Migration path for existing projects
9. ✅ Integration with codex plugin (auto-import sources)

## References

- Issue #49: Refactor plugin commands to use Task tool delegation
- Issue #50: Move plugin configuration files from .fractary/plugins to .fractary/core
- File Plugin README: `/plugins/file/README.md`
- Current Config: `.fractary/config.yaml`
