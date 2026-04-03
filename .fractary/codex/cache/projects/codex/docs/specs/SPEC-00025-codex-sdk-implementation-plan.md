# SPEC-00025: Codex SDK Implementation Plan

| Field | Value |
|-------|-------|
| **ID** | SPEC-00025 |
| **Title** | Codex SDK Implementation Plan |
| **Status** | Active |
| **Created** | 2025-12-11 |
| **Author** | Fractary Engineering |
| **Related** | SPEC-00024 (Codex SDK), fractary-codex plugin |

## 1. Overview

This specification defines the implementation plan for the `@fractary/codex` SDK, transforming the current foundation into a complete SDK by porting mature code from `claude-plugins/plugins/codex` and adding new components per SPEC-00024.

### 1.1 Scope

- **In Scope**: Pure SDK library (references, types, storage, cache, sync, MCP, permissions, migration)
- **Out of Scope**: CLI commands (lives in separate `fractary/cli` project)
- **MCP Server**: Included with `bin/codex-mcp.js` entry point

### 1.2 Current State

| Component | Status | Notes |
|-----------|--------|-------|
| Metadata parsing | Done | `src/core/metadata/` |
| Pattern matching | Done | `src/core/patterns/` |
| Routing evaluator | Done | `src/core/routing/` |
| Configuration | Done | `src/core/config/` |
| Custom destinations | Done | `src/core/custom/` |
| Zod schemas | Done | `src/schemas/` |
| Error classes | Done | `src/errors/` |

**Completion**: ~15-20% of SPEC-00024 vision

### 1.3 Primary Resource

The `claude-plugins/plugins/codex` plugin contains ~6,000+ lines of production code to port:

| Plugin File | Lines | SDK Target |
|-------------|-------|------------|
| `lib/cache-manager.sh` | 484 | `cache/manager.ts` |
| `lib/resolve-uri.sh` | 223 | `references/resolver.ts` |
| `lib/fetch-github.sh` | 231 | `storage/github.ts` |
| `lib/fetch-http.sh` | 180 | `storage/http.ts` |
| `mcp-server/src/index.ts` | 706 | `mcp/server.ts` |

---

## 2. Architecture

### 2.1 SDK Consumers

```
@fractary/codex SDK (this project)
├── References    → Parse/resolve codex:// URIs
├── Types         → Built-in + custom artifact types with TTL
├── Storage       → Fetch from GitHub, HTTP, local (extensible)
├── Cache         → TTL-based caching with <100ms hits
├── Sync          → Bidirectional project/org sync
├── MCP           → Model Context Protocol server
├── Permissions   → Frontmatter-based access control
├── Migration     → v2→v3 config/reference conversion
└── Config        → Configuration loading (mostly done)

External Consumers:
├── fractary/cli           → `fractary codex fetch|sync|cache|...`
└── claude-plugins/codex   → Thin wrapper invoking SDK
```

### 2.2 Dependency Graph

```
                    ┌─────────────────────────────────────────┐
                    │              Config (done)               │
                    └───────────────────┬─────────────────────┘
                                        │
                    ┌───────────────────▼─────────────────────┐
                    │           References (Phase 1)           │
                    │      codex:// URI parsing/resolution     │
                    └───────────────────┬─────────────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           │                            │                            │
┌──────────▼──────────┐    ┌───────────▼───────────┐    ┌──────────▼──────────┐
│   Types (Phase 1)   │    │  Storage (Phase 2)    │    │ Permissions (partial)│
│   Built-in types    │    │  GitHub, HTTP, Local  │    │  Pattern matching    │
│   Custom types      │    │  Provider interface   │    │  Frontmatter parsing │
│   TTL configs       │    │                       │    │                      │
└──────────┬──────────┘    └───────────┬───────────┘    └──────────┬──────────┘
           │                            │                            │
           └────────────────────────────┼────────────────────────────┘
                                        │
                    ┌───────────────────▼─────────────────────┐
                    │           Cache (Phase 2)                │
                    │      Index, TTL, lookup/store            │
                    │      <100ms hits, auto-cleanup          │
                    └───────────────────┬─────────────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           │                            │                            │
┌──────────▼──────────┐    ┌───────────▼───────────┐    ┌──────────▼──────────┐
│   MCP (Phase 3)     │    │   Sync (Phase 3)      │    │ Migration (Phase 4) │
│   Server            │    │   Project sync        │    │   v2→v3             │
│   Resources         │    │   Org sync            │    │   Reference update  │
│   Tools             │    │   Bidirectional       │    │                     │
└─────────────────────┘    └───────────────────────┘    └─────────────────────┘
```

---

## 3. Phase 1: Foundation (References + Types)

**Goal**: Establish the URI system and type registry that everything else depends on

### 3.1 References Module

**Source**: Port from `plugins/codex/lib/resolve-uri.sh` (223 lines) + `mcp-server/src/index.ts` (parseUri function)

**Structure**:
```
src/references/
├── parser.ts         # Parse codex://org/project/path URIs
├── resolver.ts       # Resolve URIs to filesystem paths
├── validator.ts      # Security validation (path traversal prevention)
└── index.ts          # Public exports
```

**Key Interfaces**:
```typescript
// parser.ts
interface ParsedReference {
  uri: string;           // Original URI
  org: string;           // Organization
  project: string;       // Project name
  path: string;          // File path within project
}

function parseReference(uri: string): ParsedReference | null;
function isValidUri(uri: string): boolean;

// resolver.ts
interface ResolvedReference extends ParsedReference {
  cachePath: string;     // Path in cache directory
  isCurrentProject: boolean;
  localPath?: string;    // If current project, local file path
}

interface ResolveOptions {
  cacheDir?: string;
  currentOrg?: string;
  currentProject?: string;
}

function resolveReference(uri: string, options?: ResolveOptions): Promise<ResolvedReference>;

// validator.ts
function validatePath(path: string): boolean;  // Prevent directory traversal
function sanitizePath(path: string): string;
```

### 3.2 Types Module

**Source**: New implementation per SPEC-00024 section 4

**Structure**:
```
src/types/
├── registry.ts       # Type registration and lookup
├── built-in.ts       # Built-in types (docs, specs, logs, etc.)
├── custom.ts         # Custom type loading from config
└── index.ts          # Public exports
```

**Built-in Types**:
```typescript
const BUILT_IN_TYPES: Record<string, ArtifactType> = {
  docs: {
    name: 'docs',
    description: 'Documentation files',
    patterns: ['docs/**', 'README.md', 'CLAUDE.md'],
    defaultTtl: 604800,      // 7 days
    archiveAfterDays: 365,
    archiveStorage: 'cloud'
  },
  specs: {
    name: 'specs',
    description: 'Technical specifications',
    patterns: ['specs/**', 'SPEC-*.md'],
    defaultTtl: 1209600,     // 14 days
    archiveAfterDays: null,  // Never archive
    archiveStorage: null
  },
  logs: {
    name: 'logs',
    description: 'Session and workflow logs',
    patterns: ['.fractary/**/logs/**'],
    defaultTtl: 86400,       // 1 day
    archiveAfterDays: 30,
    archiveStorage: 'cloud'
  },
  standards: {
    name: 'standards',
    description: 'Organization standards and guides',
    patterns: ['standards/**', 'guides/**'],
    defaultTtl: 2592000,     // 30 days
    archiveAfterDays: null,
    archiveStorage: null
  },
  templates: {
    name: 'templates',
    description: 'Reusable templates',
    patterns: ['templates/**', '.templates/**'],
    defaultTtl: 1209600,     // 14 days
    archiveAfterDays: 180,
    archiveStorage: 'cloud'
  },
  state: {
    name: 'state',
    description: 'Workflow state files',
    patterns: ['.fractary/**/state.json', '.fractary/**/state/**'],
    defaultTtl: 3600,        // 1 hour
    archiveAfterDays: 7,
    archiveStorage: 'local'
  }
};
```

**Key Interface**:
```typescript
interface ArtifactType {
  name: string;
  description: string;
  patterns: string[];
  defaultTtl: number;
  archiveAfterDays: number | null;
  archiveStorage: 'local' | 'cloud' | 'drive' | null;
  syncPatterns?: string[];
  excludePatterns?: string[];
  permissions?: {
    include: string[];
    exclude: string[];
  };
}

class TypeRegistry {
  get(name: string): ArtifactType | undefined;
  register(type: ArtifactType): void;
  detectType(path: string): string;
  list(): ArtifactType[];
  getTtl(path: string): number;
}
```

---

## 4. Phase 2: Core Value (Storage + Cache)

**Goal**: Deliver the core value proposition - fast document retrieval with caching

### 4.1 Storage Module

**Source**: Port from `plugins/codex/lib/fetch-github.sh` (231 lines), `fetch-http.sh` (180 lines)

**Structure**:
```
src/storage/
├── provider.ts       # StorageProvider interface
├── github.ts         # GitHub fetcher (sparse checkout)
├── http.ts           # HTTP/HTTPS fetcher
├── local.ts          # Local filesystem
├── manager.ts        # Storage manager with routing
└── index.ts          # Public exports
```

**Key Interfaces**:
```typescript
interface StorageProvider {
  name: string;
  type: 'github' | 'http' | 'local' | 's3' | 'r2' | 'gcs' | 'drive';

  fetch(reference: ResolvedReference): Promise<FetchResult>;
  exists(reference: ResolvedReference): Promise<boolean>;
}

interface FetchResult {
  content: Buffer;
  contentType: string;
  size: number;
  source: string;
}

interface FetchOptions {
  timeout?: number;
  maxRetries?: number;
  token?: string;
  branch?: string;
}
```

**GitHub Provider Features**:
- Sparse checkout for efficiency
- Authentication via GITHUB_TOKEN
- Retry logic with exponential backoff
- Branch selection (environment-aware)

### 4.2 Cache Module

**Source**: Port from `plugins/codex/lib/cache-manager.sh` (484 lines)

**Structure**:
```
src/cache/
├── manager.ts        # Main cache manager
├── index-file.ts     # Cache index operations (index.json)
├── ttl.ts            # TTL calculation and freshness checking
├── health.ts         # Health checks and diagnostics
├── metrics.ts        # Cache statistics
├── cleanup.ts        # Automatic cleanup
└── index.ts          # Public exports
```

**Cache Index Structure**:
```typescript
interface CacheIndex {
  version: '3.0';
  entries: CacheEntry[];
  stats: {
    totalEntries: number;
    totalSizeBytes: number;
    lastCleanup: string | null;
  };
}

interface CacheEntry {
  uri: string;              // codex://org/project/path
  path: string;             // Relative cache path
  source: string;           // Origin (github, http, local)
  cachedAt: string;         // ISO timestamp
  expiresAt: string;        // ISO timestamp
  ttl: number;              // TTL in seconds
  sizeBytes: number;
  hash: string;             // Content hash (SHA256)
  lastAccessed: string;
  syncedVia?: string;       // Sync source if applicable
}
```

**Key Interface**:
```typescript
interface CacheLookupResult {
  cached: boolean;
  fresh: boolean;
  reason: 'valid' | 'expired' | 'not_in_cache' | 'not_in_index';
  entry?: CacheEntry;
}

interface ClearOptions {
  scope: 'all' | 'expired' | 'project' | 'pattern' | 'type';
  filter?: {
    project?: string;
    pattern?: string;
    type?: string;
  };
  dryRun?: boolean;
}

class CacheManager {
  lookup(uri: string): Promise<CacheLookupResult>;
  store(uri: string, content: Buffer, options?: StoreOptions): Promise<CacheEntry>;
  retrieve(uri: string): Promise<Buffer | null>;
  remove(uri: string): Promise<boolean>;
  clear(options: ClearOptions): Promise<ClearResult>;
  getStats(): Promise<CacheStats>;
  healthCheck(options?: { fix?: boolean }): Promise<HealthCheckResult>;
}
```

**Performance Target**: <100ms cache hits

---

## 5. Phase 3: Integration (MCP + Sync + Permissions)

**Goal**: Expose the SDK via MCP and enable full synchronization

### 5.1 MCP Server Module

**Source**: Port from `plugins/codex/mcp-server/src/index.ts` (706 lines TypeScript)

**Structure**:
```
src/mcp/
├── server.ts         # MCP server implementation
├── resources.ts      # Resource listing and reading
├── tools.ts          # MCP tools (codex_fetch, codex_cache_status, etc.)
└── index.ts          # Public exports
```

**Binary Entry Point**:
```
bin/
└── codex-mcp.js      # #!/usr/bin/env node entry point
```

**MCP Tools**:
- `codex_fetch` - Fetch document by URI with optional force refresh
- `codex_cache_status` - Cache statistics (entries, size, freshness)
- `codex_sync_status` - Sync information

**Key Change**: The plugin's MCP server shells out to bash scripts. The SDK version will use TypeScript modules directly.

### 5.2 Sync Module

**Source**: Port from `plugins/codex/skills/fractary-faber-handler-sync-github/`, `project-syncer/`, `org-syncer/`

**Structure**:
```
src/sync/
├── manager.ts        # Sync orchestration
├── project.ts        # Single project sync
├── organization.ts   # Organization-wide sync (parallel)
├── routing.ts        # From src/core/routing/
├── destinations.ts   # From src/core/custom/
├── handlers/
│   └── github.ts     # GitHub sync handler
└── index.ts          # Public exports
```

**Key Interfaces**:
```typescript
interface ProjectSyncOptions {
  project: string;
  organization: string;
  codexRepo: string;
  direction: 'to-codex' | 'from-codex' | 'bidirectional';
  environment?: string;  // dev, test, staging, prod
  patterns?: string[];
  dryRun?: boolean;
}

interface SyncResult {
  success: boolean;
  project: string;
  direction: string;
  filesAdded: number;
  filesModified: number;
  filesDeleted: number;
  details: SyncFileDetail[];
  commits?: string[];
  errors?: string[];
}

interface OrgSyncOptions extends Omit<ProjectSyncOptions, 'project'> {
  exclude?: string[];
  parallel?: number;  // Default: 5
}

class SyncManager {
  syncProject(options: ProjectSyncOptions): Promise<SyncResult>;
  syncOrganization(options: OrgSyncOptions): Promise<OrgSyncResult>;
  getSyncStatus(project?: string): Promise<SyncStatus>;
}
```

**Environment-Aware Sync**:
- `dev`/`test` → `test` branch
- `staging`/`prod` → `main` branch
- Auto-detection from current git branch

### 5.3 Permissions Module

**Source**: Existing code + new checker

**Structure**:
```
src/permissions/
├── checker.ts        # Permission checking logic (NEW)
├── patterns.ts       # From src/core/patterns/
├── frontmatter.ts    # From src/core/metadata/
└── index.ts          # Public exports
```

**Key Interface**:
```typescript
interface DocumentPermissions {
  include: string[];
  exclude: string[];
}

interface PermissionResult {
  allowed: boolean;
  reason: 'allowed' | 'denied' | 'excluded' | 'not_in_list';
  matchedPattern?: string;
}

class PermissionChecker {
  checkPermission(document: string, requestingProject: string): Promise<PermissionResult>;
  parsePermissions(content: string): DocumentPermissions;
}
```

**Permission Rules**:
1. Check exclude list (deny if matched)
2. Check include list (allow if matched)
3. If include = `["*"]` → public
4. Default: deny if not in include list

---

## 6. Phase 4: Polish (Migration + Restructure)

**Goal**: Complete the SDK with migration tools and clean up structure

### 6.1 Migration Module

**Source**: Port from `plugins/codex/skills/fractary-faber-config-migrator/`

**Structure**:
```
src/migration/
├── detector.ts       # Detect config version
├── converter.ts      # Convert v2 → v3
├── references.ts     # Convert @codex/ → codex:// in files
└── index.ts          # Public exports
```

**Key Interface**:
```typescript
interface MigrationResult {
  success: boolean;
  sourceVersion: string;
  targetVersion: string;
  backupPath?: string;
  changes: string[];
  warnings: string[];
}

class MigrationConverter {
  detectVersion(config: unknown): '2.0' | '3.0' | 'unknown';
  needsMigration(config: unknown): boolean;
  migrate(options: MigrateOptions): Promise<MigrationResult>;
  convertReference(ref: string): string;  // @codex/x/y → codex://org/x/y
}
```

### 6.2 Code Restructure

**Move existing modules**:

| Current Location | New Location | Notes |
|------------------|--------------|-------|
| `src/core/metadata/` | `src/permissions/frontmatter.ts` | Rename for clarity |
| `src/core/patterns/` | `src/permissions/patterns.ts` | Part of permissions |
| `src/core/routing/` | `src/sync/routing.ts` | Part of sync |
| `src/core/custom/` | `src/sync/destinations.ts` | Part of sync |
| `src/core/config/` | `src/config/` | Move up one level |

**Keep unchanged**:
- `src/schemas/` - Already correct
- `src/errors/` - Already correct

### 6.3 Main Entry Point

```typescript
// src/codex.ts
export class Codex {
  readonly references: ReferenceResolver;
  readonly types: TypeRegistry;
  readonly cache: CacheManager;
  readonly storage: StorageManager;
  readonly sync: SyncManager;
  readonly permissions: PermissionChecker;
  readonly migration: MigrationConverter;

  constructor(options?: CodexOptions);

  // Convenience methods
  async fetch(uri: string, options?: FetchOptions): Promise<FetchResult>;
  async resolve(uri: string): Promise<ResolvedReference>;
}
```

---

## 7. Final SDK Structure

```
@fractary/codex/
├── src/
│   ├── index.ts              # Main exports
│   ├── codex.ts              # Main Codex class
│   │
│   ├── references/           # Phase 1
│   │   ├── parser.ts
│   │   ├── resolver.ts
│   │   ├── validator.ts
│   │   └── index.ts
│   │
│   ├── types/                # Phase 1
│   │   ├── registry.ts
│   │   ├── built-in.ts
│   │   ├── custom.ts
│   │   └── index.ts
│   │
│   ├── storage/              # Phase 2
│   │   ├── provider.ts
│   │   ├── github.ts
│   │   ├── http.ts
│   │   ├── local.ts
│   │   ├── manager.ts
│   │   └── index.ts
│   │
│   ├── cache/                # Phase 2
│   │   ├── manager.ts
│   │   ├── index-file.ts
│   │   ├── ttl.ts
│   │   ├── health.ts
│   │   ├── metrics.ts
│   │   ├── cleanup.ts
│   │   └── index.ts
│   │
│   ├── mcp/                  # Phase 3
│   │   ├── server.ts
│   │   ├── resources.ts
│   │   ├── tools.ts
│   │   └── index.ts
│   │
│   ├── sync/                 # Phase 3
│   │   ├── manager.ts
│   │   ├── project.ts
│   │   ├── organization.ts
│   │   ├── routing.ts
│   │   ├── destinations.ts
│   │   ├── handlers/
│   │   │   └── github.ts
│   │   └── index.ts
│   │
│   ├── permissions/          # Phase 3
│   │   ├── checker.ts
│   │   ├── patterns.ts
│   │   ├── frontmatter.ts
│   │   └── index.ts
│   │
│   ├── migration/            # Phase 4
│   │   ├── detector.ts
│   │   ├── converter.ts
│   │   ├── references.ts
│   │   └── index.ts
│   │
│   ├── config/               # Exists (reorganize)
│   │   ├── loader.ts
│   │   ├── organization.ts
│   │   ├── defaults.ts
│   │   ├── schema.ts
│   │   └── index.ts
│   │
│   ├── schemas/              # Exists
│   │   ├── config.ts
│   │   ├── metadata.ts
│   │   └── index.ts
│   │
│   └── errors/               # Exists
│       ├── CodexError.ts
│       ├── ValidationError.ts
│       ├── ConfigurationError.ts
│       └── index.ts
│
├── bin/
│   └── codex-mcp.js          # MCP server entry point
│
├── tests/
│   ├── unit/
│   │   ├── references/
│   │   ├── types/
│   │   ├── cache/
│   │   ├── storage/
│   │   ├── sync/
│   │   ├── mcp/
│   │   └── permissions/
│   └── integration/
│
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## 8. Dependencies

### 8.1 Current Dependencies (keep)
```json
{
  "dependencies": {
    "js-yaml": "^4.1.0",
    "micromatch": "^4.0.8",
    "zod": "^3.23.8"
  }
}
```

### 8.2 New Dependencies (add)
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0"
  }
}
```

### 8.3 Future Dependencies (optional)
```json
{
  "optionalDependencies": {
    "@aws-sdk/client-s3": "^3.0.0",
    "@google-cloud/storage": "^7.0.0",
    "googleapis": "^130.0.0"
  }
}
```

---

## 9. Testing Strategy

### 9.1 Unit Tests
- All modules have corresponding test files
- Target: >80% coverage
- Use Vitest (already configured)

### 9.2 Integration Tests
- Cache + Storage integration
- MCP server protocol compliance
- Sync with mock GitHub API

### 9.3 Test Fixtures
- Sample markdown files with frontmatter
- Cache index examples
- Configuration files (v2 and v3)

---

## 10. Implementation Checklist

### Phase 1: Foundation
- [ ] Create `src/references/parser.ts`
- [ ] Create `src/references/resolver.ts`
- [ ] Create `src/references/validator.ts`
- [ ] Create `src/references/index.ts`
- [ ] Create `src/types/built-in.ts`
- [ ] Create `src/types/registry.ts`
- [ ] Create `src/types/custom.ts`
- [ ] Create `src/types/index.ts`
- [ ] Add unit tests for references
- [ ] Add unit tests for types

### Phase 2: Core Value
- [ ] Create `src/storage/provider.ts`
- [ ] Create `src/storage/github.ts`
- [ ] Create `src/storage/http.ts`
- [ ] Create `src/storage/local.ts`
- [ ] Create `src/storage/manager.ts`
- [ ] Create `src/storage/index.ts`
- [ ] Create `src/cache/index-file.ts`
- [ ] Create `src/cache/ttl.ts`
- [ ] Create `src/cache/manager.ts`
- [ ] Create `src/cache/health.ts`
- [ ] Create `src/cache/metrics.ts`
- [ ] Create `src/cache/cleanup.ts`
- [ ] Create `src/cache/index.ts`
- [ ] Add unit tests for storage
- [ ] Add unit tests for cache

### Phase 3: Integration
- [ ] Create `src/mcp/server.ts`
- [ ] Create `src/mcp/resources.ts`
- [ ] Create `src/mcp/tools.ts`
- [ ] Create `src/mcp/index.ts`
- [ ] Create `bin/codex-mcp.js`
- [ ] Move routing to `src/sync/routing.ts`
- [ ] Move destinations to `src/sync/destinations.ts`
- [ ] Create `src/sync/manager.ts`
- [ ] Create `src/sync/project.ts`
- [ ] Create `src/sync/organization.ts`
- [ ] Create `src/sync/handlers/github.ts`
- [ ] Create `src/sync/index.ts`
- [ ] Move metadata to `src/permissions/frontmatter.ts`
- [ ] Move patterns to `src/permissions/patterns.ts`
- [ ] Create `src/permissions/checker.ts`
- [ ] Create `src/permissions/index.ts`
- [ ] Add MCP SDK dependency
- [ ] Add unit tests for MCP
- [ ] Add unit tests for sync
- [ ] Add unit tests for permissions

### Phase 4: Polish
- [ ] Create `src/migration/detector.ts`
- [ ] Create `src/migration/converter.ts`
- [ ] Create `src/migration/references.ts`
- [ ] Create `src/migration/index.ts`
- [ ] Move config to `src/config/`
- [ ] Create `src/codex.ts` main class
- [ ] Update `src/index.ts` exports
- [ ] Remove `src/core/` directory
- [ ] Add unit tests for migration
- [ ] Update README.md
- [ ] Final cleanup and documentation

---

## 11. Changelog

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2025-12-11 | Initial implementation plan |
