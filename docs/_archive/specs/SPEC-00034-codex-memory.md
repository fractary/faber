# SPEC-00034: Codex Memory System (Institutional Memory)

**Status**: Draft
**Created**: 2026-02-12
**Author**: System
**Related**: SPEC-00024 (Codex SDK)

## 1. Overview & Motivation

### Why Memories Belong in Codex

FABER's workflow-debugger currently maintains a knowledge base of resolved issues at two levels:

- **Plugin-level**: `plugins/faber/knowledge-base/` (8 pre-seeded entries)
- **Project-level**: `.fractary/faber/knowledge-base/`

This KB is tightly coupled to FABER and limited to the debug use case. But "institutional memory" is a broader concept -- teams accumulate knowledge about conventions, architectural decisions, integration gotchas, and performance tuning that spans projects and workflows. This knowledge belongs in Codex, the system whose purpose is cross-project knowledge management.

### Current State Limitations

| Limitation | Detail |
|------------|--------|
| No cross-project sharing | KB entries are local to the project that created them |
| No typed templates | Entries follow an ad-hoc structure; no enforced schema per memory type |
| No auditing | No mechanism to detect memories that contradict current project state |
| FABER-coupled | Only the workflow-debugger reads/writes KB entries |
| Plugin-level pre-seeding | 8 entries baked into the faber plugin directory with no distribution mechanism |

### Benefits of Codex Memory

- **Bidirectional sync**: Projects contribute memories to the codex repo and pull shared memories from it via existing `to_codex`/`from_codex` sync
- **Typed templates**: Memory types (troubleshooting, ADR, pattern, etc.) each have a dedicated template with required sections and frontmatter fields
- **Validity auditing**: A `memory-audit` command analyzes memories against actual project state to find contradictions and outdated information
- **Universal access**: Any agent or user can create memories via `codex:memory-create`, not just the debugger
- **Cross-project distribution**: Shared org-wide memories live in the codex repo and sync to all projects automatically

## 2. Memory Artifact Type

Add `memory` to `BUILT_IN_TYPES` in `sdk/js/src/types/built-in.ts` (codex repo):

```typescript
memory: {
  name: 'memory',
  description: 'Institutional memory entries (troubleshooting, decisions, patterns)',
  patterns: [
    'memory/**',
    '.fractary/codex/memory/**',
    '**/knowledge-base/**',  // backward compatibility
  ],
  defaultTtl: ONE_MONTH,       // 2592000s -- memories are long-lived
  archiveAfterDays: 365,       // archive deprecated memories after 1 year
  archiveStorage: 'cloud',
  syncPatterns: [
    'memory/**',
    '.fractary/codex/memory/**',
  ],
},
```

This follows the existing pattern established by `docs`, `specs`, `logs`, etc. in `built-in.ts`. The `**/knowledge-base/**` pattern provides backward compatibility with FABER's existing KB paths during migration.

## 3. Memory Types & Templates

`memory` is a single artifact type. Categories are expressed via the `memory_type` frontmatter field. Six memory types are defined, each with a built-in template.

| Type | Description | Template Sections |
|------|-------------|-------------------|
| `troubleshooting` | Error diagnosis and resolution | Symptoms, Root Cause, Solution, Prevention |
| `architectural-decision` | ADR-style records | Context, Decision, Consequences |
| `performance` | Optimization discoveries | Baseline, Change, Result, Caveats |
| `pattern` | Reusable patterns | Context, Pattern, Usage, Anti-patterns |
| `integration` | Cross-system gotchas | Setup, Issue, Resolution, Configuration |
| `convention` | Team standards and rules | Rule, Rationale, Examples, Exceptions |

### Template System

**Built-in templates** ship with the codex plugin at `templates/memory/{type}.md`. These define required and recommended frontmatter fields plus body sections.

**Custom templates** are project-level, registered via a `manifest.yaml` referenced in codex config:

```yaml
# .fractary/codex/memory/manifest.yaml
templates:
  security-incident:
    file: templates/security-incident.md
    description: Security incident post-mortem
    required_sections: [Timeline, Impact, Remediation, Lessons]
```

**Usage**: `codex:memory-create --template troubleshooting --context "description of what happened"`

### Example Built-in Template: `troubleshooting.md`

```markdown
---
title: "{title}"
description: "{one-paragraph summary}"
memory_type: troubleshooting
memory_id: "MEM-TS-{seq}-{slug}"
category: "{category}"
severity: medium
status: draft
symptoms:
  - "{primary symptom}"
tags:
  - "{tag}"
agents:
  - "{agent}"
phases:
  - "{phase}"
created: "{date}"
verified: false
success_count: 0
---

# {title}

## Symptoms

{Describe observable symptoms: error messages, unexpected behavior, failed checks}

## Root Cause

{Explain why the problem occurs: incorrect configuration, missing dependency, logic error}

## Solution

### Actions

1. {Step-by-step fix instructions}

## Prevention

{How to prevent this from recurring: config changes, validation, pre-commit hooks}
```

## 4. Frontmatter Schema

All memory files use YAML frontmatter. The `MetadataSchema` in codex SDK uses `.passthrough()`, so these additional fields are allowed without schema changes.

### Standard Codex Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Human-readable title |
| `description` | string | Yes | One-paragraph summary enabling frontmatter-first search |
| `tags` | string[] | No | Searchable tags |
| `visibility` | enum | No | `public`, `internal`, `private` |
| `created` | string | Yes | ISO 8601 date |
| `updated` | string | No | ISO 8601 date |
| `codex_sync_include` | string[] | No | Override sync inclusion patterns |
| `codex_sync_exclude` | string[] | No | Override sync exclusion patterns |

### Memory-Specific Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `memory_type` | enum | Yes | One of: `troubleshooting`, `architectural-decision`, `performance`, `pattern`, `integration`, `convention` |
| `memory_id` | string | Yes | Unique ID: `MEM-{type_prefix}-{seq}-{slug}` |
| `category` | string | No | Problem category (e.g., `type_system`, `build_failure`, `missing_dependency`) |
| `severity` | enum | No | `low`, `medium`, `high`, `critical` |
| `status` | enum | Yes | `draft`, `unverified`, `verified`, `deprecated` |

### Search Hints

| Field | Type | Description |
|-------|------|-------------|
| `symptoms` | string[] | Error messages or observable behaviors for matching |
| `keywords` | string[] | Additional search terms |

### Applicability

| Field | Type | Description |
|-------|------|-------------|
| `agents` | string[] | Agents this memory is relevant to |
| `phases` | string[] | FABER phases (frame, architect, build, evaluate, release) |
| `languages` | string[] | Programming languages |
| `frameworks` | string[] | Frameworks (React, Express, etc.) |

### Metrics

| Field | Type | Description |
|-------|------|-------------|
| `success_count` | number | Times this memory successfully resolved an issue |
| `last_used` | string | ISO 8601 date of last use |
| `usage_count` | number | Total times accessed |
| `confidence` | number | 0.0 - 1.0, derived from success/usage ratio |

### Audit Fields

| Field | Type | Description |
|-------|------|-------------|
| `last_audited` | string | ISO 8601 date of last validity audit |
| `deprecated_reason` | string | Why this memory was deprecated |
| `superseded_by` | string | Memory ID of the replacement |

The `description` field is the key enabler for frontmatter-first search -- a concise summary means the searcher can score relevance without loading full body content.

## 5. Storage Architecture

### Project Memories

Local memories created within a project:

```
.fractary/codex/memory/
  troubleshooting/
    MEM-TS-001-typescript-module-resolution.md
    MEM-TS-002-esm-import-extensions.md
  architectural-decision/
    MEM-AD-001-monorepo-structure.md
  pattern/
    MEM-PT-001-error-handling-pattern.md
  manifest.yaml  (optional, for custom templates)
```

### Shared Org Memories

Org-wide memories live in the codex repo itself:

```
# In the codex repo (e.g., codex.corthos.ai)
.fractary/codex/memory/
  troubleshooting/
    MEM-TS-001-typescript-module.md       # migrated from faber KB
    MEM-TS-002-esm-import-extensions.md
    MEM-TS-003-pr-creation-failed.md
    ...
  pattern/
    MEM-PT-001-error-handling.md
```

These sync down to every project via `from_codex`.

### Synced Memories from Other Projects

Projects that push memories via `to_codex` make them available in the codex cache:

```
.fractary/codex/cache/
  projects/
    {org}/
      {project}/
        .fractary/codex/memory/
          troubleshooting/
            MEM-TS-005-api-timeout.md
```

### Frontmatter Index Cache

For fast search without parsing every file:

```
.fractary/codex/cache/memory-index.json
```

Structure:

```json
{
  "version": 1,
  "built_at": "2026-02-12T10:00:00Z",
  "entries": [
    {
      "file_path": ".fractary/codex/memory/troubleshooting/MEM-TS-001-typescript-module.md",
      "mtime": "2026-02-10T08:30:00Z",
      "source": "local",
      "frontmatter": {
        "memory_id": "MEM-TS-001",
        "memory_type": "troubleshooting",
        "title": "TypeScript module resolution failure",
        "description": "Build fails with Cannot find module errors due to missing packages or incorrect import paths",
        "category": "missing_dependency",
        "severity": "medium",
        "status": "verified",
        "symptoms": ["Cannot find module", "TS2307"],
        "agents": ["software-engineer"],
        "phases": ["build"],
        "tags": ["typescript", "imports"],
        "success_count": 12,
        "confidence": 0.95
      }
    }
  ]
}
```

The index is rebuilt when any memory file's mtime is newer than the index's `built_at` timestamp.

## 6. Default Sync Configuration

Config init adds bidirectional memory sync by default:

```yaml
codex:
  sync:
    to_codex:
      include:
        - ".fractary/codex/memory/*"   # Push project memories to codex repo
    from_codex:
      include:
        - "codex://corthosai/codex.corthos.ai/.fractary/codex/memory/**"  # Pull shared memories
```

This uses the existing `DirectionalSyncSchema` from `sdk/js/src/schemas/config.ts`. The `from_codex` pattern uses the required `codex://` URI format validated by `FromCodexSyncConfigSchema`.

Note: The `CodexConfigSchema` uses `.strict()`, so no schema changes are needed for the config -- sync patterns are already supported. The memory artifact type patterns in `BUILT_IN_TYPES` handle type detection.

## 7. Codex Plugin: `memory-create` Command + Agent

### Skill Definition

New skill `/fractary-codex:memory-create` in the codex plugin:

```yaml
---
name: memory-create
description: Create a new memory entry with template support
tools: Read, Write, Glob, AskUserQuestion
---
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `--template` | string | No | Memory type template to use (e.g., `troubleshooting`) |
| `--context` | string | No | Description of what happened / what to record |
| `--title` | string | No | Memory title (auto-generated if not provided) |
| `--memory-type` | string | No | Memory type (inferred from `--template` if provided) |

### Agent Behavior

1. If `--template` is provided, load the built-in template for that type. Otherwise, ask the user which memory type to use via `AskUserQuestion`.
2. If `--context` is provided, use it to pre-populate the template. Otherwise, guide the user interactively.
3. Generate the memory ID: `MEM-{type_prefix}-{seq}-{slug}`
   - Type prefixes: `TS` (troubleshooting), `AD` (architectural-decision), `PF` (performance), `PT` (pattern), `IN` (integration), `CV` (convention)
   - Sequence number: next available in the type directory
   - Slug: sanitized from title (max 50 chars)
4. Populate frontmatter fields, including `status: draft` and `created: {now}`.
5. Write the file to `.fractary/codex/memory/{memory_type}/MEM-{id}.md`.
6. Invalidate the frontmatter index cache.

## 8. MemorySearcher (Codex SDK)

New `MemorySearcher` class in `sdk/js/src/memory/searcher.ts` (codex repo) implementing cascading search:

### Search Scopes

| Scope | Path | Priority |
|-------|------|----------|
| 1 -- Project memories | `.fractary/codex/memory/` | Highest (local knowledge) |
| 2 -- Synced memories | `.fractary/codex/cache/projects/*/*/.fractary/codex/memory/*` | Lower (shared knowledge) |

### Algorithm

```
function search(query: MemorySearchQuery): MemorySearchResult[] {
  // 1. Load or rebuild frontmatter index
  index = loadOrRebuildIndex()

  // 2. Filter by explicit criteria
  candidates = index.entries.filter(entry => {
    if (query.memory_type && entry.memory_type !== query.memory_type) return false
    if (query.category && entry.category !== query.category) return false
    if (query.phase && !entry.phases?.includes(query.phase)) return false
    if (query.agent && !entry.agents?.includes(query.agent)) return false
    if (query.tags && !query.tags.some(t => entry.tags?.includes(t))) return false
    if (query.status && entry.status !== query.status) return false
    return true
  })

  // 3. Score candidates (frontmatter only -- no body loading)
  scored = candidates.map(entry => ({
    entry,
    score: calculateRelevanceScore(entry, query),
    source: entry.source  // 'local' or project name
  }))

  // 4. Sort by score descending, return top N
  return scored.sort((a, b) => b.score - a.score).slice(0, query.limit || 20)
}
```

### Relevance Scoring

Adapted from the knowledge-aggregator algorithm in `plugins/faber/skills/core/knowledge-aggregator.md`:

| Factor | Points | Logic |
|--------|--------|-------|
| Success count | 0-40 | `min(success_count * 2, 40)` |
| Verified status | +10 | `status === 'verified'` |
| Agent match | +20 | Query agent in `agents` array |
| Phase match | +10 | Query phase in `phases` array |
| Source priority | +10/+5 | Local = 10, synced = 5 |
| Symptom match | +15 | Query text matches any `symptoms` entry |
| Keyword match | +5 | Query text matches any `keywords` entry |

### Index Management

- The index is stored at `.fractary/codex/cache/memory-index.json`
- On search, check if any memory file has `mtime > index.built_at` -- if so, rebuild
- On write (via `MemoryWriter`), invalidate the index
- Index contains frontmatter only (no body content), keeping it fast to load

### TypeScript Interface

```typescript
interface MemorySearchQuery {
  text?: string;          // free-text search against symptoms/keywords/description
  memory_type?: MemoryType;
  category?: string;
  phase?: string;
  agent?: string;
  tags?: string[];
  status?: MemoryStatus;
  limit?: number;
}

interface MemorySearchResult {
  entry: MemoryIndexEntry;
  score: number;
  source: 'local' | string;  // 'local' or project name for synced
  filePath: string;
}
```

### FABER Integration

FABER's `knowledge-aggregator.md` is adapted to call `MemorySearcher` via `codex-adapter.ts`:

```typescript
// In codex-adapter.ts -- new methods
async searchMemories(query: MemorySearchQuery): Promise<MemorySearchResult[]> {
  await this.ensureInitialized();
  if (!this.codex) {
    return [];  // graceful fallback
  }
  const searcher = new MemorySearcher(/* config */);
  return searcher.search(query);
}
```

The knowledge-aggregator falls back to the legacy filesystem paths (`.fractary/faber/knowledge-base/`, `.fractary/plugins/*/knowledge-base/`) if `MemorySearcher` returns no results or codex is unavailable.

## 9. MemoryWriter (Codex SDK)

New `MemoryWriter` class in `sdk/js/src/memory/writer.ts` (codex repo):

### Responsibilities

1. **ID generation**: `MEM-{type_prefix}-{seq}-{slug}`
   - Scans the target type directory for existing IDs to determine next sequence number
2. **Deduplication**: Before creating a new memory, check existing memories for >0.95 similarity (based on symptom overlap and title similarity)
3. **File writing**: Renders the template with populated frontmatter and body, writes to `.fractary/codex/memory/{type}/`
4. **Index invalidation**: Deletes or marks stale the frontmatter index cache after write

### TypeScript Interface

```typescript
interface MemoryWriteOptions {
  memory_type: MemoryType;
  title: string;
  description: string;
  body: string;
  frontmatter: Partial<MemoryFrontmatter>;
  template?: string;  // template name to use for body scaffold
}

interface MemoryWriteResult {
  memory_id: string;
  file_path: string;
  deduplicated: boolean;  // true if merged with existing
  existing_id?: string;   // ID of existing memory if deduplicated
}

class MemoryWriter {
  write(options: MemoryWriteOptions): Promise<MemoryWriteResult>;
  update(memory_id: string, changes: Partial<MemoryFrontmatter>): Promise<void>;
  deprecate(memory_id: string, reason: string, superseded_by?: string): Promise<void>;
}
```

### FABER Integration

FABER's workflow-debugger `create_kb_entry` (step 9 in `workflow-debugger.md`) is adapted to call `MemoryWriter` via `codex-adapter.ts`:

```typescript
// In codex-adapter.ts -- new method
async writeMemory(options: MemoryWriteOptions): Promise<MemoryWriteResult> {
  await this.ensureInitialized();
  if (!this.codex) {
    throw new FaberError('Codex not available', 'CODEX_NOT_AVAILABLE', {});
  }
  const writer = new MemoryWriter(/* config */);
  return writer.write(options);
}
```

## 10. Triggers & User Prompting (FABER Side)

### Existing Flags

The `--learn` and `--auto-learn` flags on `workflow-debug` continue working. The implementation changes from writing directly to `.fractary/faber/knowledge-base/` to calling `MemoryWriter` via `codex-adapter.ts`.

### New: Post-Fix Save Prompt

After successful fix verification when `--auto-learn` is NOT enabled, print a prompt to the user:

```
This solution resolved the issue. To save it to the knowledge base:
/fractary-faber:workflow-debug --work-id {work_id} --learn
```

This is implemented in the workflow-debugger agent's step 9 logic. It checks:
1. Fix was applied and verified successful
2. `--auto-learn` was NOT passed
3. `--learn` was NOT passed
4. Print the suggestion

### Future Work (out of scope)

- Interactive confirmation via `AskUserQuestion` before saving
- Auto-suggest memory type based on problem characteristics
- Prompt in CLI mode after any successful workflow completion

## 11. Memory Audit

### Command + Agent

New `/fractary-codex:memory-audit` skill and `memory-auditor` agent in the codex plugin.

This is **not** age-based pruning. It analyzes memories against actual project state to find knowledge that has become invalid.

### Audit Categories

| Category | Detection Method |
|----------|-----------------|
| Contradictions | Memory says X (e.g., "use `fs.readFile`") but code consistently does Y (e.g., `fs.promises.readFile`) |
| Outdated references | Memory references APIs, packages, or patterns no longer present in `package.json`, imports, or config |
| Superseded memories | Multiple memories cover the same topic with conflicting advice |
| Low-confidence | Memories with `success_count: 0` and `status: unverified` older than 30 days |

### Algorithm

```
1. Load all project memories from .fractary/codex/memory/
2. For each memory:
   a. Parse frontmatter and body
   b. Extract key claims (package names, API calls, config patterns, file paths)
   c. Check each claim against current project state:
      - Does the referenced file/package/API still exist?
      - Does the solution approach match current patterns?
      - Are there newer memories on the same topic?
   d. Score validity: 0.0 (definitely outdated) to 1.0 (definitely valid)
3. For memories with validity < 0.5, present to user via AskUserQuestion:
   - Explain what seems invalid and why
   - Options: "Keep as-is", "Update", "Deprecate", "Delete", "Mark superseded by..."
4. Apply user decisions:
   - Update: open memory for editing
   - Deprecate: set status=deprecated, add deprecated_reason
   - Delete: remove file
   - Superseded: set superseded_by field, deprecate
5. Update last_audited timestamp on all reviewed memories
```

### User Interaction

The auditor uses `AskUserQuestion` to present each issue:

```
Memory MEM-TS-001 "TypeScript module resolution failure" may be outdated:
- References `npm run typecheck` but project uses `pnpm run typecheck`
- Last verified 45 days ago

What would you like to do?
  [Keep as-is] - Memory is still valid
  [Update] - Edit to fix inaccuracies
  [Deprecate] - Mark as no longer applicable
  [Delete] - Remove permanently
```

## 12. Cross-Project Distribution

### Mechanism

Standard codex sync -- no new distribution mechanisms needed.

### Flow

```
Project A creates memory
  → to_codex sync pushes to codex repo
    → from_codex sync pulls to Project B, C, D
      → MemorySearcher in Project B finds it in scope 2 (synced)
```

### Bidirectional by Default

Config init adds both `to_codex` and `from_codex` includes for memory patterns (see section 6). Every project both contributes and consumes memories.

### Source Attribution

Synced memories preserve their origin through the codex cache path structure:

```
.fractary/codex/cache/projects/{org}/{project}/.fractary/codex/memory/...
```

`MemorySearcher` extracts the source project from this path and includes it in `MemorySearchResult.source`.

### Shared Org-Wide Memories

Memories that apply across all projects (e.g., "always use pnpm, not npm") live directly in the codex repo's `.fractary/codex/memory/` directory. These are authored directly in the codex repo or promoted from a project via review.

## 13. Migration Path

### Phase 1: Enrich Existing Entries

The 8 existing FABER plugin KB entries are enriched with the new frontmatter schema:

| Current File | New Location (codex repo) |
|--------------|---------------------------|
| `KB-type-001-type-mismatch.md` | `.fractary/codex/memory/troubleshooting/MEM-TS-001-type-mismatch.md` |
| `KB-dep-001-typescript-module.md` | `.fractary/codex/memory/troubleshooting/MEM-TS-002-typescript-module.md` |
| `KB-test-001-timeout.md` | `.fractary/codex/memory/troubleshooting/MEM-TS-003-test-timeout.md` |
| `KB-test-002-assertion-failure.md` | `.fractary/codex/memory/troubleshooting/MEM-TS-004-assertion-failure.md` |
| `KB-net-001-research-timeout.md` | `.fractary/codex/memory/troubleshooting/MEM-TS-005-research-timeout.md` |
| `KB-net-002-pr-creation-failed.md` | `.fractary/codex/memory/troubleshooting/MEM-TS-006-pr-creation-failed.md` |
| `KB-perm-001-deploy-permission.md` | `.fractary/codex/memory/troubleshooting/MEM-TS-007-deploy-permission.md` |
| `KB-val-001-incomplete-spec.md` | `.fractary/codex/memory/troubleshooting/MEM-TS-008-incomplete-spec.md` |

Enrichment adds: `memory_type`, `memory_id`, `description`, `status`, `keywords`, `languages`, `frameworks`, and `confidence` fields to each entry's frontmatter.

### Phase 2: Project-Level Migration

Projects with entries in `.fractary/faber/knowledge-base/` get them moved to `.fractary/codex/memory/`. A migration script:

1. Reads each entry from `.fractary/faber/knowledge-base/**/*.md`
2. Parses frontmatter, maps `id` to `memory_id`, adds missing fields
3. Writes to `.fractary/codex/memory/{category}/MEM-{type_prefix}-{seq}-{slug}.md`
4. Leaves originals in place (backward compatibility)

### Phase 3: Backward Compatibility Period

During transition, the knowledge-aggregator searches both paths:

```
# Priority order:
1. .fractary/codex/memory/           # New location (via MemorySearcher)
2. .fractary/faber/knowledge-base/   # Legacy project-level
3. .fractary/plugins/*/knowledge-base/  # Legacy plugin-level
```

Deduplication by `memory_id` / legacy `id` prevents double-counting.

### Phase 4: Deprecation

After all projects have migrated:

- Remove `.fractary/faber/knowledge-base/` search from knowledge-aggregator
- Remove `plugins/faber/knowledge-base/` directory from FABER plugin
- Remove `**/knowledge-base/**` from memory type patterns in `built-in.ts`

## 14. Changes Per Repository

### Codex SDK (`/mnt/c/GitHub/fractary/codex/sdk/js/src/`)

| File | Change |
|------|--------|
| `types/built-in.ts` | Add `memory` to `BUILT_IN_TYPES` with patterns, TTL, archive config |
| `memory/searcher.ts` | **New.** `MemorySearcher` class with cascading search, frontmatter index, relevance scoring |
| `memory/writer.ts` | **New.** `MemoryWriter` class for creation, update, dedup, ID generation |
| `memory/types.ts` | **New.** TypeScript interfaces: `MemoryType`, `MemoryStatus`, `MemoryFrontmatter`, `MemorySearchQuery`, `MemorySearchResult`, `MemoryIndexEntry` |

### Codex Plugin (`/mnt/c/GitHub/fractary/codex/plugins/codex/`)

| File | Change |
|------|--------|
| `skills/memory-create.md` | **New.** Skill definition for memory creation |
| `agents/memory-creator.md` | **New.** Agent for interactive memory creation with template loading |
| `skills/memory-audit.md` | **New.** Skill definition for memory auditing |
| `agents/memory-auditor.md` | **New.** Agent for validity-focused memory auditing |
| `templates/memory/troubleshooting.md` | **New.** Built-in template |
| `templates/memory/architectural-decision.md` | **New.** Built-in template |
| `templates/memory/performance.md` | **New.** Built-in template |
| `templates/memory/pattern.md` | **New.** Built-in template |
| `templates/memory/integration.md` | **New.** Built-in template |
| `templates/memory/convention.md` | **New.** Built-in template |
| Config init logic | Add `to_codex` and `from_codex` includes for memory patterns |

### Codex Repository (`/mnt/c/GitHub/fractary/codex.fractary.com/`)

| File | Change |
|------|--------|
| `.fractary/codex/memory/troubleshooting/*.md` | **New.** 8 migrated memories from FABER's pre-seeded KB |

### FABER Plugin (`/mnt/c/GitHub/fractary/faber/`)

| File | Change |
|------|--------|
| `plugins/faber/skills/core/knowledge-aggregator.md` | Call `MemorySearcher` via codex-adapter with filesystem fallback |
| `plugins/faber/agents/workflow-debugger.md` | Use `MemoryWriter` via codex-adapter for `--learn`; add save prompt after fix verification |
| `sdk/js/src/storage/codex-adapter.ts` | Add `searchMemories()` and `writeMemory()` methods exposing `MemorySearcher` and `MemoryWriter` |
| `plugins/faber/knowledge-base/` | Kept as deprecated fallback during transition; eventually removed |

## 15. Future Work (Out of Scope)

- `codex_search` MCP tool -- general-purpose frontmatter search across all codex artifact types, not just memory
- Interactive save-to-memory prompts in CLI mode
- Automated periodic audit scheduling (cron-based or on-sync triggers)
- Memory quality scoring and community curation (upvote/downvote)
- `memory review` and `memory prune` commands for bulk operations
- Cross-org memory sharing beyond a single organization
- Memory versioning and diff tracking

## Appendix A: Critical Files Referenced

| File | Repo | Relevance |
|------|------|-----------|
| `sdk/js/src/types/built-in.ts` | codex | Pattern for adding new built-in type; defines `ArtifactType` interface, TTL constants (`ONE_MONTH = 2592000`), 8 existing types |
| `sdk/js/src/types/registry.ts` | codex | `TypeRegistry` class with `detectType()` pattern matching via micromatch, `getTtl()`, `getArchiveConfig()` |
| `sdk/js/src/schemas/metadata.ts` | codex | `MetadataSchema` with `.passthrough()` -- allows memory-specific frontmatter without schema changes |
| `sdk/js/src/schemas/config.ts` | codex | `CodexConfigSchema` (`.strict()`), `DirectionalSyncSchema`, `FromCodexSyncConfigSchema` requiring `codex://` URIs |
| `plugins/faber/skills/core/knowledge-aggregator.md` | faber | Current search logic, scoring algorithm (success_count, verified bonus, agent/phase match, source priority) |
| `plugins/faber/agents/workflow-debugger.md` | faber | Current KB read/write integration, `create_kb_entry_markdown()` function, `--learn`/`--auto-learn` flags |
| `plugins/faber/knowledge-base/**/*.md` | faber | 8 existing entries to migrate; frontmatter fields: `id`, `title`, `category`, `severity`, `symptoms`, `agents`, `phases`, `tags`, `created`, `verified`, `success_count` |
| `sdk/js/src/storage/codex-adapter.ts` | faber | FABER-Codex bridge with `CodexAdapter` class, runtime detection, `store()`/`retrieve()` methods, `createStorage()` factory |

## Appendix B: Memory ID Prefixes

| Memory Type | Prefix | Example |
|-------------|--------|---------|
| `troubleshooting` | `TS` | `MEM-TS-001-module-not-found` |
| `architectural-decision` | `AD` | `MEM-AD-001-monorepo-structure` |
| `performance` | `PF` | `MEM-PF-001-query-optimization` |
| `pattern` | `PT` | `MEM-PT-001-error-boundary` |
| `integration` | `IN` | `MEM-IN-001-github-api-rate-limit` |
| `convention` | `CV` | `MEM-CV-001-pnpm-not-npm` |
