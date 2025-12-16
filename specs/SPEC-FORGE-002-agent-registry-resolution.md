# SPEC-FORGE-002: Agent Registry & Resolution

| Field | Value |
|-------|-------|
| **Status** | Draft |
| **Created** | 2025-12-14 |
| **Author** | Claude (with human direction) |
| **Project** | `@fractary/forge` |
| **Related** | SPEC-FORGE-001, SPEC-FABER-002, SPEC-MIGRATION-001 |
| **Phase** | Phase 1: Foundation |

## 1. Executive Summary

This specification defines the **Agent & Tool Registry and Resolution System** for `@fractary/forge`, establishing how agents and tools are discovered, cached, versioned, and resolved from multiple sources (local, global, Stockyard).

### 1.1 Scope

This document covers:
- Multi-source registry architecture (local → global → Stockyard)
- Resolution algorithm and priority rules
- Version management and constraints
- Caching strategy and cache invalidation
- Forking and customization workflows
- Update notifications and version tracking
- Package metadata and manifests
- Dependency resolution (agents that reference other agents/tools)

### 1.2 Design Goals

1. **Hierarchical Resolution** - Local overrides global overrides Stockyard
2. **Fast Lookups** - In-memory cache, filesystem cache, network fallback
3. **Version Aware** - Support semantic versioning and constraints
4. **Fork Friendly** - Easy to fork and customize while tracking upstream
5. **Update Safe** - Notify about updates, opt-in to upgrade
6. **Offline Capable** - Works without network after initial download
7. **Dependency Tracking** - Resolve transitive dependencies automatically

## 2. Registry Architecture

### 2.1 Three-Tier Registry

```
┌─────────────────────────────────────────────────────────┐
│                   Resolution Order                      │
├─────────────────────────────────────────────────────────┤
│ 1. Project-Local Registry (.fractary/agents/)          │
│    - Highest priority                                   │
│    - Project-specific customizations                    │
│    - Not shared across projects                         │
├─────────────────────────────────────────────────────────┤
│ 2. Global Registry (~/.fractary/registry/)             │
│    - Shared across all projects                        │
│    - User-wide installations                            │
│    - Cached downloads from Stockyard                    │
├─────────────────────────────────────────────────────────┤
│ 3. Stockyard (https://stockyard.fractary.dev)          │
│    - Remote marketplace                                 │
│    - Canonical source of truth                          │
│    - Ratings, versions, premium packages                │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Registry Storage Structure

```
# Project-Local Registry
project-root/
├── .fractary/
│   ├── agents/
│   │   ├── my-custom-agent.yaml
│   │   └── frame-agent.yaml  # Customized version
│   │
│   ├── tools/
│   │   └── my-tool.yaml
│   │
│   └── plugins/
│       └── forge/
│           ├── config.json
│           └── lockfile.json  # Pinned versions

# Global Registry
~/.fractary/
├── registry/
│   ├── agents/
│   │   ├── frame-agent@2.0.0.yaml
│   │   ├── frame-agent@2.1.0.yaml
│   │   ├── architect-agent@1.5.0.yaml
│   │   └── corthion-loader@3.2.1.yaml
│   │
│   ├── tools/
│   │   ├── terraform-deploy@1.2.0.yaml
│   │   └── docker-build@2.0.0.yaml
│   │
│   └── manifests/
│       ├── frame-agent.json       # Version metadata
│       ├── architect-agent.json
│       └── corthion-loader.json
│
├── cache/
│   └── stockyard/
│       └── [cached API responses]
│
└── config/
    └── forge.json  # Global Forge configuration
```

## 3. Resolution Algorithm

### 3.1 Agent Resolution Flow

```typescript
// forge/src/definitions/registry/resolver.ts
export class AgentResolver {
  async resolve(
    name: string,
    constraint?: VersionConstraint
  ): Promise<ResolvedAgent> {
    // 1. Parse name (supports versioning)
    const parsed = this.parseName(name);
    // Examples:
    //   "frame-agent"           → { name: "frame-agent", version: "latest" }
    //   "frame-agent@2.0.0"     → { name: "frame-agent", version: "2.0.0" }
    //   "frame-agent@>=2.0.0"   → { name: "frame-agent", version: ">=2.0.0" }

    // 2. Check project-local registry first
    const local = await this.checkLocalRegistry(parsed.name);
    if (local) {
      this.logger.debug(`Resolved ${name} from project-local registry`);
      return {
        definition: local,
        source: 'local',
        version: local.version,
      };
    }

    // 3. Check global registry
    const global = await this.checkGlobalRegistry(parsed.name, parsed.version);
    if (global) {
      this.logger.debug(`Resolved ${name} from global registry`);
      return {
        definition: global,
        source: 'global',
        version: global.version,
      };
    }

    // 4. Fetch from Stockyard
    if (this.config.stockyard.enabled) {
      this.logger.debug(`Fetching ${name} from Stockyard`);
      const stockyard = await this.fetchFromStockyard(parsed.name, parsed.version);

      if (stockyard) {
        // Cache to global registry
        await this.cacheToGlobalRegistry(stockyard);

        return {
          definition: stockyard,
          source: 'stockyard',
          version: stockyard.version,
        };
      }
    }

    // 5. Not found
    throw new AgentNotFoundError(
      `Agent '${name}' not found in any registry`
    );
  }

  private async checkLocalRegistry(name: string): Promise<AgentDefinition | null> {
    const localPath = path.join(
      process.cwd(),
      '.fractary/agents',
      `${name}.yaml`
    );

    if (await fs.pathExists(localPath)) {
      return await this.loadYaml(localPath);
    }

    return null;
  }

  private async checkGlobalRegistry(
    name: string,
    version: string
  ): Promise<AgentDefinition | null> {
    const registryPath = path.join(
      os.homedir(),
      '.fractary/registry/agents'
    );

    // If version specified, try exact match first
    if (version !== 'latest') {
      const exactPath = path.join(registryPath, `${name}@${version}.yaml`);
      if (await fs.pathExists(exactPath)) {
        return await this.loadYaml(exactPath);
      }
    }

    // Find all versions and pick best match
    const pattern = path.join(registryPath, `${name}@*.yaml`);
    const files = await glob(pattern);

    if (files.length === 0) return null;

    // Extract versions and find best match
    const versions = files.map(f => {
      const match = f.match(/@([\d.]+)\.yaml$/);
      return match ? match[1] : null;
    }).filter(Boolean) as string[];

    const bestVersion = this.findBestVersion(versions, version);
    if (!bestVersion) return null;

    const bestPath = path.join(registryPath, `${name}@${bestVersion}.yaml`);
    return await this.loadYaml(bestPath);
  }

  private findBestVersion(
    available: string[],
    constraint: string
  ): string | null {
    // Use semver to find best matching version
    const satisfying = available.filter(v => semver.satisfies(v, constraint));

    if (satisfying.length === 0) return null;

    // Return highest matching version
    return semver.maxSatisfying(satisfying, constraint);
  }
}
```

### 3.2 Version Constraint Syntax

```typescript
// Supported constraint formats:
"frame-agent"              // Latest version
"frame-agent@2.0.0"        // Exact version
"frame-agent@^2.0.0"       // Compatible with 2.x.x
"frame-agent@~2.0.0"       // Compatible with 2.0.x
"frame-agent@>=2.0.0"      // Greater than or equal
"frame-agent@>=2.0.0 <3.0.0"  // Range
```

## 4. Package Manifests

### 4.1 Manifest Format

Each agent/tool in the global registry has a manifest with metadata:

```json
// ~/.fractary/registry/manifests/frame-agent.json
{
  "name": "frame-agent",
  "type": "agent",
  "description": "FABER Frame phase agent - gathers requirements and classifies work",

  // Available versions
  "versions": [
    {
      "version": "2.1.0",
      "released": "2025-12-10T18:30:00Z",
      "status": "stable",
      "changelog_url": "https://stockyard.fractary.dev/agents/frame-agent/changelog#2.1.0"
    },
    {
      "version": "2.0.0",
      "released": "2025-11-15T10:00:00Z",
      "status": "stable"
    },
    {
      "version": "1.5.2",
      "released": "2025-10-01T14:20:00Z",
      "status": "deprecated",
      "deprecation_message": "Upgrade to 2.x for improved classification"
    }
  ],

  // Latest stable version
  "latest": "2.1.0",

  // Dependency information
  "dependencies": {
    "tools": {
      "fetch_issue": ">=1.0.0",
      "classify_work_type": "^2.0.0"
    },
    "agents": {}  // No agent dependencies
  },

  // Stockyard metadata
  "stockyard": {
    "author": "Fractary Team",
    "license": "MIT",
    "homepage": "https://stockyard.fractary.dev/agents/frame-agent",
    "repository": "https://github.com/fractary/agents/tree/main/frame-agent",
    "downloads": 15420,
    "rating": 4.8,
    "tags": ["faber", "workflow", "classification"]
  },

  // Fork tracking
  "fork_of": null,  // Not a fork
  "forks": [
    {
      "name": "acme-frame-agent",
      "author": "ACME Corp",
      "url": "https://stockyard.fractary.dev/agents/acme-frame-agent"
    }
  ],

  // Local installation metadata
  "installed_versions": ["2.0.0", "2.1.0"],
  "active_version": "2.0.0",  // What the lockfile pins
  "last_checked": "2025-12-14T10:00:00Z",
  "update_available": true
}
```

### 4.2 Manifest Syncing

```typescript
// forge/src/definitions/registry/manifest-sync.ts
export class ManifestSync {
  async syncManifests(options: { force?: boolean } = {}): Promise<void> {
    const manifestsDir = path.join(
      os.homedir(),
      '.fractary/registry/manifests'
    );

    // Load all local manifests
    const localManifests = await this.loadLocalManifests();

    for (const manifest of localManifests) {
      // Check if update needed
      const timeSinceCheck = Date.now() - new Date(manifest.last_checked).getTime();
      const ttl = this.config.manifest_ttl || 3600000; // 1 hour

      if (!options.force && timeSinceCheck < ttl) {
        continue; // Skip, recently checked
      }

      // Fetch latest metadata from Stockyard
      const latest = await this.stockyard.getAgentMetadata(manifest.name);

      // Update manifest
      manifest.versions = latest.versions;
      manifest.latest = latest.latest;
      manifest.stockyard = latest.stockyard;
      manifest.last_checked = new Date().toISOString();

      // Check if update available
      manifest.update_available = semver.gt(
        latest.latest,
        manifest.active_version
      );

      // Save updated manifest
      await this.saveManifest(manifest);

      // Notify if update available
      if (manifest.update_available) {
        this.logger.info(
          `Update available: ${manifest.name}@${manifest.active_version} → ${latest.latest}`
        );
      }
    }
  }
}
```

## 5. Lockfile

### 5.1 Lockfile Format

Project-specific lockfile pins exact versions:

```json
// .fractary/plugins/forge/lockfile.json
{
  "version": 1,
  "generated": "2025-12-14T10:30:00Z",

  "agents": {
    "frame-agent": {
      "version": "2.0.0",
      "resolved": "global",
      "integrity": "sha256-abc123...",
      "dependencies": {
        "tools": {
          "fetch_issue": "1.2.0",
          "classify_work_type": "2.1.0"
        }
      }
    },
    "architect-agent": {
      "version": "1.5.0",
      "resolved": "global",
      "integrity": "sha256-def456...",
      "dependencies": {
        "tools": {
          "create_specification": "3.0.0",
          "validate_specification": "2.5.1"
        }
      }
    },
    "my-custom-agent": {
      "version": "1.0.0",
      "resolved": "local",
      "integrity": "sha256-custom123...",
      "dependencies": {}
    }
  },

  "tools": {
    "fetch_issue": {
      "version": "1.2.0",
      "resolved": "global",
      "integrity": "sha256-tool123..."
    },
    "classify_work_type": {
      "version": "2.1.0",
      "resolved": "global",
      "integrity": "sha256-tool456..."
    }
  }
}
```

### 5.2 Lockfile Generation

```typescript
// forge/src/definitions/registry/lockfile.ts
export class LockfileManager {
  async generateLockfile(): Promise<Lockfile> {
    const lockfile: Lockfile = {
      version: 1,
      generated: new Date().toISOString(),
      agents: {},
      tools: {},
    };

    // Discover all agents used in project
    const usedAgents = await this.discoverUsedAgents();

    for (const agentName of usedAgents) {
      // Resolve agent
      const resolved = await this.resolver.resolve(agentName);

      // Add to lockfile
      lockfile.agents[agentName] = {
        version: resolved.version,
        resolved: resolved.source,
        integrity: await this.calculateIntegrity(resolved.definition),
        dependencies: await this.resolveDependencies(resolved.definition),
      };

      // Add tools to lockfile
      for (const [toolName, toolVersion] of Object.entries(
        resolved.definition.tools || {}
      )) {
        if (!lockfile.tools[toolName]) {
          const toolResolved = await this.resolver.resolveTool(
            `${toolName}@${toolVersion}`
          );

          lockfile.tools[toolName] = {
            version: toolResolved.version,
            resolved: toolResolved.source,
            integrity: await this.calculateIntegrity(toolResolved.definition),
          };
        }
      }
    }

    return lockfile;
  }

  private async discoverUsedAgents(): Promise<string[]> {
    // Scan .fractary/agents/ for local agents
    const localAgents = await this.scanLocalAgents();

    // Scan workflow files for agent references
    const workflowAgents = await this.scanWorkflows();

    return [...new Set([...localAgents, ...workflowAgents])];
  }
}
```

## 6. Forking & Customization

### 6.1 Fork Workflow

```bash
# Fork an agent from Stockyard
forge fork frame-agent my-frame-agent

# This creates:
# 1. .fractary/agents/my-frame-agent.yaml (customized copy)
# 2. Updates manifest to track fork relationship
# 3. Allows customization while tracking upstream updates
```

```typescript
// forge/src/definitions/commands/fork.ts
export class ForkCommand {
  async fork(sourceName: string, targetName: string): Promise<void> {
    // 1. Resolve source agent
    const source = await this.resolver.resolve(sourceName);

    // 2. Create customized copy
    const forked = {
      ...source.definition,
      name: targetName,
      fork_of: {
        name: sourceName,
        version: source.version,
        forked_at: new Date().toISOString(),
      },
    };

    // 3. Save to project-local registry
    const targetPath = path.join(
      process.cwd(),
      '.fractary/agents',
      `${targetName}.yaml`
    );

    await this.writeYaml(targetPath, forked);

    // 4. Track fork in manifest
    await this.manifestManager.trackFork(sourceName, targetName);

    this.logger.success(
      `Forked ${sourceName}@${source.version} → ${targetName}`
    );
    this.logger.info(`Edit at: ${targetPath}`);
  }

  async checkUpstreamUpdates(forkedName: string): Promise<void> {
    // Load forked agent
    const forked = await this.loader.loadLocal(forkedName);

    if (!forked.fork_of) {
      throw new Error(`${forkedName} is not a fork`);
    }

    // Check upstream for updates
    const upstream = await this.resolver.resolve(forked.fork_of.name);

    if (semver.gt(upstream.version, forked.fork_of.version)) {
      this.logger.info(
        `Upstream update available: ${forked.fork_of.version} → ${upstream.version}`
      );
      this.logger.info(`Run: forge merge-upstream ${forkedName}`);
    } else {
      this.logger.success('Fork is up to date with upstream');
    }
  }

  async mergeUpstream(forkedName: string): Promise<void> {
    // Load forked agent
    const forked = await this.loader.loadLocal(forkedName);

    // Fetch latest upstream
    const upstream = await this.resolver.resolve(forked.fork_of!.name);

    // Perform 3-way merge
    const merged = await this.merger.merge({
      base: forked.fork_of!,
      local: forked,
      upstream: upstream.definition,
    });

    // Present diff to user
    await this.showDiff(forked, merged);

    // Confirm merge
    const confirmed = await this.promptConfirm('Apply merge?');

    if (confirmed) {
      // Update fork
      merged.fork_of.version = upstream.version;
      merged.fork_of.merged_at = new Date().toISOString();

      await this.writeYaml(
        path.join(process.cwd(), '.fractary/agents', `${forkedName}.yaml`),
        merged
      );

      this.logger.success('Upstream changes merged successfully');
    }
  }
}
```

## 7. Caching Strategy

### 7.1 Multi-Level Cache

```
┌─────────────────────────────────────────────┐
│  In-Memory Cache                            │
│  - Parsed definitions (AgentDefinition)     │
│  - Lifetime: Process duration               │
│  - Invalidation: Never (process restart)    │
└─────────────────────────────────────────────┘
                    ↓ miss
┌─────────────────────────────────────────────┐
│  Global Registry Cache                      │
│  - YAML files on disk                       │
│  - Lifetime: Until manual update            │
│  - Invalidation: forge update command       │
└─────────────────────────────────────────────┘
                    ↓ miss
┌─────────────────────────────────────────────┐
│  Stockyard API Cache                        │
│  - HTTP response cache                      │
│  - Lifetime: TTL-based (1 hour default)     │
│  - Invalidation: TTL expiry, manual refresh │
└─────────────────────────────────────────────┘
                    ↓ miss
┌─────────────────────────────────────────────┐
│  Stockyard (Network Request)                │
│  - Remote API call                          │
│  - Always fresh data                        │
└─────────────────────────────────────────────┘
```

### 7.2 Cache Implementation

```typescript
// forge/src/definitions/registry/cache.ts
export class RegistryCache {
  private memoryCache = new Map<string, AgentDefinition>();
  private cacheMetadata = new Map<string, CacheMetadata>();

  async get(name: string): Promise<AgentDefinition | null> {
    // Check in-memory cache first
    if (this.memoryCache.has(name)) {
      const metadata = this.cacheMetadata.get(name)!;

      // Verify freshness
      if (this.isFresh(metadata)) {
        this.logger.debug(`Cache hit (memory): ${name}`);
        return this.memoryCache.get(name)!;
      }

      // Stale, evict
      this.memoryCache.delete(name);
      this.cacheMetadata.delete(name);
    }

    return null;
  }

  async set(name: string, definition: AgentDefinition): Promise<void> {
    this.memoryCache.set(name, definition);
    this.cacheMetadata.set(name, {
      cachedAt: Date.now(),
      ttl: this.config.cache_ttl || 3600000, // 1 hour
    });
  }

  private isFresh(metadata: CacheMetadata): boolean {
    const age = Date.now() - metadata.cachedAt;
    return age < metadata.ttl;
  }

  async invalidate(name?: string): Promise<void> {
    if (name) {
      this.memoryCache.delete(name);
      this.cacheMetadata.delete(name);
    } else {
      this.memoryCache.clear();
      this.cacheMetadata.clear();
    }
  }
}
```

## 8. Update Notifications

### 8.1 Update Check

```typescript
// forge/src/definitions/commands/update.ts
export class UpdateCommand {
  async checkUpdates(): Promise<UpdateReport> {
    const lockfile = await this.lockfileManager.load();
    const updates: Update[] = [];

    // Check each installed agent
    for (const [name, entry] of Object.entries(lockfile.agents)) {
      // Skip local agents
      if (entry.resolved === 'local') continue;

      // Fetch latest metadata
      const manifest = await this.manifestManager.getManifest(name);

      if (semver.gt(manifest.latest, entry.version)) {
        updates.push({
          type: 'agent',
          name,
          current: entry.version,
          latest: manifest.latest,
          breaking: semver.major(manifest.latest) > semver.major(entry.version),
        });
      }
    }

    // Similar for tools...

    return {
      total: updates.length,
      breaking: updates.filter(u => u.breaking).length,
      updates,
    };
  }

  async applyUpdates(options: { breaking?: boolean } = {}): Promise<void> {
    const report = await this.checkUpdates();

    if (report.total === 0) {
      this.logger.success('All agents and tools are up to date');
      return;
    }

    // Filter updates
    const toApply = options.breaking
      ? report.updates
      : report.updates.filter(u => !u.breaking);

    if (toApply.length === 0) {
      this.logger.info('No non-breaking updates available');
      this.logger.info(`Run 'forge update --breaking' to see breaking changes`);
      return;
    }

    // Show updates
    console.log('\nUpdates available:\n');
    for (const update of toApply) {
      const symbol = update.breaking ? '⚠️ ' : '✓ ';
      console.log(
        `${symbol} ${update.name}: ${update.current} → ${update.latest}`
      );
    }

    // Confirm
    const confirmed = await this.promptConfirm('\nApply updates?');

    if (!confirmed) {
      this.logger.info('Update cancelled');
      return;
    }

    // Apply updates
    for (const update of toApply) {
      await this.applyUpdate(update);
    }

    // Regenerate lockfile
    await this.lockfileManager.generateLockfile();

    this.logger.success(`Updated ${toApply.length} agent(s)/tool(s)`);
  }
}
```

## 9. Dependency Resolution

### 9.1 Transitive Dependencies

```typescript
// forge/src/definitions/registry/dependency-resolver.ts
export class DependencyResolver {
  async resolveDependencies(
    agent: AgentDefinition
  ): Promise<DependencyTree> {
    const tree: DependencyTree = {
      agents: {},
      tools: {},
    };

    // Resolve tool dependencies
    for (const toolName of agent.tools || []) {
      await this.resolveToolDependency(toolName, tree);
    }

    // Resolve custom tools (inline, no external deps)
    for (const customTool of agent.custom_tools || []) {
      tree.tools[customTool.name] = {
        version: customTool.version,
        source: 'inline',
      };
    }

    return tree;
  }

  private async resolveToolDependency(
    toolName: string,
    tree: DependencyTree
  ): Promise<void> {
    // Avoid circular dependencies
    if (tree.tools[toolName]) return;

    // Resolve tool
    const tool = await this.resolver.resolveTool(toolName);

    tree.tools[toolName] = {
      version: tool.version,
      source: tool.source,
    };

    // Tools don't have further dependencies (for now)
    // Future: tools could depend on other tools
  }
}
```

## 10. CLI Commands

### 10.1 Command Reference

```bash
# List installed agents
forge list agents [--tags data-engineering]

# List available tools
forge list tools

# Install agent
forge install frame-agent@2.0.0

# Update check
forge update --check

# Apply updates
forge update [--breaking]

# Fork agent
forge fork frame-agent my-frame-agent

# Check upstream updates for fork
forge upstream-check my-frame-agent

# Merge upstream changes
forge merge-upstream my-frame-agent

# Show agent info
forge info frame-agent

# Search Stockyard
forge search "terraform"

# Validate definitions
forge validate [--all]

# Generate lockfile
forge lock
```

## 11. Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Resolve (cached) | < 10ms | In-memory cache hit |
| Resolve (global) | < 100ms | Disk read + parse |
| Resolve (network) | < 2s | Stockyard API call |
| Lockfile generation | < 5s | For typical project (10-20 agents) |
| Update check | < 3s | Parallel manifest fetches |

## 12. Success Criteria

- [ ] Three-tier resolution works (local → global → Stockyard)
- [ ] Version constraints correctly resolved
- [ ] Lockfile pins exact versions
- [ ] Fork workflow supports customization + upstream tracking
- [ ] Update notifications work reliably
- [ ] Cache invalidation is correct
- [ ] Performance targets met
- [ ] Offline mode works after initial download
- [ ] Dependency resolution handles transitive deps

## 13. Open Questions

1. **Circular Dependencies**: How do we prevent/handle circular agent dependencies?
2. **Private Registries**: Should we support private Stockyard instances?
3. **CDN**: Should Stockyard serve definitions via CDN for better performance?
4. **Integrity**: Should we verify definition integrity with checksums?
5. **Conflict Resolution**: How do we handle merge conflicts when merging upstream?

## 14. Related Specifications

- **SPEC-FORGE-001**: Agent & Tool Definition System Architecture
- **SPEC-FABER-002**: Forge Integration Interface
- **SPEC-MIGRATION-001**: Cross-Project Migration Guide
