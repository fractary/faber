# Spec: Plugin Workflow Resolution in `@fractary/faber`

**Target project:** `fractary/faber` (specifically `@fractary/faber` SDK and `fractary-faber` CLI)
**Submitted by:** core.corthovore.ai
**Date:** 2026-03-24
**Status:** Proposed

---

## Summary

The `workflows.yaml` manifest supports a plugin reference format for the `file` field
(e.g., `faber-ingest@fractary-faber-ingest:ingest-operate`), but the registry that reads
this manifest has no logic to resolve plugin references to actual file paths. When a project
uses this format, workflow planning fails entirely with a misleading "Workflow not found" error.

---

## Background

FABER projects register workflows in `.fractary/faber/workflows/workflows.yaml`. Workflows
provided by installed plugins (e.g., `fractary-faber-ingest`) are referenced using a plugin
reference format in the `file` field:

```yaml
workflows:
  - id: ingest-operate
    name: Operate Ingest Source (Local)
    file: faber-ingest@fractary-faber-ingest:ingest-operate
```

This format was presumably designed so that consumer projects can point at a plugin-owned
workflow without copying its JSON locally — giving them automatic updates as the plugin
evolves. That is the correct design goal.

---

## The Problem

There are two bugs in `@fractary/faber/dist/workflows/registry.js` that make this format
completely non-functional.

### Bug 1 — Schema validation rejects the format at parse time

`WorkflowEntrySchema` validates the `file` field with this regex (line 26):

```javascript
.regex(
  /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(yaml|yml|json)$/,
  'File must be a .yaml, .yml, or .json file'
)
```

The plugin reference `faber-ingest@fractary-faber-ingest:ingest-operate` fails this regex
because:
- It contains `@` and `:` characters, which are not in the character class
- It has no `.yaml`, `.yml`, or `.json` suffix

The manifest parse fails silently (or with a generic validation error), and the workflow
is never registered — so `getWorkflow()` throws `RegistryWorkflowNotFoundError` with
`"Workflow 'ingest-operate' not found"`.

### Bug 2 — No resolver exists for plugin references

Even if validation was relaxed, `getWorkflowPath()` (line 154) contains no plugin
resolution logic:

```javascript
export function getWorkflowPath(options) {
    const workflowsDir = /* ... */;
    const workflow = getWorkflow(options);
    return path.join(workflowsDir, workflow.file);  // ← blind path.join, no plugin handling
}
```

`path.join(".fractary/faber/workflows", "faber-ingest@fractary-faber-ingest:ingest-operate")`
produces a nonsensical local path and `fs.existsSync()` returns `false`.

### Consequence

A consumer project that uses the plugin reference format in `workflows.yaml` (as this
project does, following the implied convention) cannot use any plugin-provided workflow
without copying the JSON file locally — creating a maintenance problem where local copies
silently diverge from the plugin as it updates.

---

## Analysis of the Plugin Reference Format

The format observed in the wild:

```
{alias}@{marketplace-id}:{workflow-name}
```

Examples:
- `faber-ingest@fractary-faber-ingest:ingest-operate`
- `faber-ingest@fractary-faber-ingest:ingest-create`
- `faber@fractary-faber-core`

Based on the plugin cache structure at `~/.claude/plugins/cache/`:

```
~/.claude/plugins/cache/
  {marketplace-id}/
    {package-name}/
      {version}/
        .fractary/faber/workflows/
          {workflow-name}.json
```

For `faber-ingest@fractary-faber-ingest:ingest-operate`, the resolution is:
1. Parse: `alias=faber-ingest`, `marketplace-id=fractary-faber-ingest`, `workflow-name=ingest-operate`
2. Plugin cache root: `~/.claude/plugins/cache/fractary-faber-ingest/`
3. Find installed package directory: `fractary-faber-ingest/{latest-version}/`
4. Resolve file: `.fractary/faber/workflows/ingest-operate.json`

Confirmed on disk:
```
~/.claude/plugins/cache/fractary-faber-ingest/fractary-faber-ingest/0.4.6/
  .fractary/faber/workflows/
    ingest-create.json
    ingest-update.json
    ingest-inspect.json
    ingest-operate.json   ← ✓ exists
```

---

## Proposed Solution

Three changes are needed in `@fractary/faber/dist/workflows/registry.js`.

### Change 1 — Update schema to accept plugin references

Replace the `file` field validation with a union that accepts either a local filename or a
plugin reference:

```typescript
// Local file: ends in .yaml/.yml/.json, no special characters
const LocalFileSchema = z
  .string()
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9._/-]*\.(yaml|yml|json)$/,
    'Local file must be a .yaml, .yml, or .json path'
  );

// Plugin reference: {alias}@{marketplace-id}:{workflow-name}
const PluginRefSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9-]*@[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/,
    'Plugin reference must match {alias}@{marketplace-id}:{workflow-name}'
  );

const WorkflowEntrySchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z][a-z0-9-]*$/),
  file: z.union([LocalFileSchema, PluginRefSchema]),
  description: z.string().max(500).optional(),
});
```

### Change 2 — Add a plugin reference resolver

```typescript
const PLUGIN_REF_PATTERN = /^([a-z][a-z0-9-]*)@([a-z][a-z0-9-]*):([a-z][a-z0-9-]*)$/;

function isPluginRef(file: string): boolean {
  return PLUGIN_REF_PATTERN.test(file);
}

function resolvePluginWorkflow(file: string): string | null {
  const match = file.match(PLUGIN_REF_PATTERN);
  if (!match) return null;

  const [, , marketplaceId, workflowName] = match;

  // Plugin cache root: $CLAUDE_MARKETPLACE_ROOT or ~/.claude/plugins/cache
  const pluginCacheRoot = process.env.CLAUDE_MARKETPLACE_ROOT
    ?? path.join(os.homedir(), '.claude', 'plugins', 'cache');

  const packageDir = path.join(pluginCacheRoot, marketplaceId, marketplaceId);

  if (!fs.existsSync(packageDir)) return null;

  // Find the highest installed version
  const versions = fs.readdirSync(packageDir)
    .filter(v => /^\d+\.\d+\.\d+/.test(v))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  if (versions.length === 0) return null;

  // Try each extension in priority order
  for (const version of versions.slice(0, 1)) {  // use latest
    for (const ext of ['json', 'yaml', 'yml']) {
      const candidate = path.join(
        packageDir, version,
        '.fractary', 'faber', 'workflows',
        `${workflowName}.${ext}`
      );
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return null;
}
```

### Change 3 — Use the resolver in `getWorkflowPath`

```typescript
export function getWorkflowPath(options: GetWorkflowOptions): string {
  const projectRoot = options.projectRoot || findProjectRoot();
  const workflowsPath = options.config?.workflows?.path || FABER_DEFAULTS.paths.workflows;
  const workflowsDir = path.isAbsolute(workflowsPath)
    ? workflowsPath
    : path.join(projectRoot, workflowsPath);

  const workflow = getWorkflow(options);

  // Resolve plugin reference if needed
  if (isPluginRef(workflow.file)) {
    const resolved = resolvePluginWorkflow(workflow.file);
    if (!resolved) {
      throw new WorkflowRegistryError(
        `Cannot resolve plugin workflow '${workflow.file}'. ` +
        `Is the plugin installed? Run: fractary-faber plugin install ${workflow.file.split('@')[1].split(':')[0]}`
      );
    }
    return resolved;
  }

  return path.join(workflowsDir, workflow.file);
}
```

---

## Version Selection Behaviour

The resolver above always uses the highest installed version. This is the right default:
plugin updates should be picked up automatically when the consumer project runs
`fractary-faber plugin update`. An optional `version` field in `WorkflowEntrySchema`
could be added later to pin a specific version when needed.

---

## Error Messages

The current error when a plugin reference fails is:

```
Error: Workflow not found: ingest-operate
```

This is misleading — the workflow *is* defined in `workflows.yaml`, it just can't be
resolved. With this fix, the error when the plugin is not installed becomes:

```
Error: Cannot resolve plugin workflow 'faber-ingest@fractary-faber-ingest:ingest-operate'.
Is the plugin installed? Run: fractary-faber plugin install fractary-faber-ingest
```

---

## Files to Change

| File | Change |
|---|---|
| `src/workflows/registry.ts` | Schema update, resolver function, updated `getWorkflowPath` |
| `src/workflows/registry.d.ts` | Type exports if `resolvePluginWorkflow` is made public |
| Tests | Add cases for plugin ref validation, resolution, and not-installed error |

No changes needed to `fractary-faber` CLI or `workflows.yaml` format — this is purely a
registry layer fix.

---

## Testing

1. `workflows.yaml` with a valid plugin ref → resolves to the correct versioned path
2. `workflows.yaml` with an unknown plugin ref → throws the actionable error message
3. `workflows.yaml` with multiple installed versions → picks the highest
4. `workflows.yaml` with a local file ref (existing behaviour) → unchanged
5. Schema validation accepts both local and plugin ref formats
6. Schema validation rejects malformed plugin refs

---

## Notes for Implementor

The `CLAUDE_MARKETPLACE_ROOT` environment variable should be the authoritative way to
override the plugin cache location, consistent with how the orchestration protocol
references it elsewhere in FABER tooling.

The `alias` component of the reference format (e.g., `faber-ingest` in
`faber-ingest@fractary-faber-ingest:ingest-operate`) is not used in the resolution
path — only `marketplace-id` and `workflow-name` are needed. The alias exists in the
reference format for human readability and could be validated against a declared alias
in the plugin's own manifest if that concept is introduced later.
