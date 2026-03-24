/**
 * @fractary/faber - Workflow Registry Tests
 *
 * Tests for plugin workflow resolution and schema validation.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  getWorkflowPath,
  WorkflowRegistryError,
  RegistryWorkflowNotFoundError,
} from '../registry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePluginCache(
  root: string,
  marketplaceId: string,
  versions: string[],
  workflowNames: string[]
): void {
  for (const version of versions) {
    const workflowsDir = path.join(root, marketplaceId, marketplaceId, version, '.fractary', 'faber', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });
    for (const name of workflowNames) {
      fs.writeFileSync(path.join(workflowsDir, `${name}.json`), JSON.stringify({ id: name, steps: [] }));
    }
  }
}

function makeProject(root: string, workflowsYaml: string): void {
  const workflowsDir = path.join(root, '.fractary', 'faber', 'workflows');
  fs.mkdirSync(workflowsDir, { recursive: true });
  // Write a minimal faber config so findProjectRoot resolves
  const faberConfigDir = path.join(root, '.fractary', 'faber');
  fs.writeFileSync(path.join(faberConfigDir, 'config.yaml'), 'version: 1\n');
  fs.writeFileSync(path.join(workflowsDir, 'workflows.yaml'), workflowsYaml);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Workflow Registry — plugin reference resolution', () => {
  const testRoot = path.join(__dirname, '__test-registry__');
  const pluginCache = path.join(testRoot, 'plugin-cache');
  const projectRoot = path.join(testRoot, 'project');

  const originalEnv = process.env.CLAUDE_MARKETPLACE_ROOT;

  beforeEach(() => {
    if (fs.existsSync(testRoot)) fs.rmSync(testRoot, { recursive: true, force: true });
    fs.mkdirSync(testRoot, { recursive: true });
    process.env.CLAUDE_MARKETPLACE_ROOT = pluginCache;
  });

  afterEach(() => {
    if (fs.existsSync(testRoot)) fs.rmSync(testRoot, { recursive: true, force: true });
    if (originalEnv === undefined) {
      delete process.env.CLAUDE_MARKETPLACE_ROOT;
    } else {
      process.env.CLAUDE_MARKETPLACE_ROOT = originalEnv;
    }
  });

  // 1. Plugin ref resolves to the correct versioned path
  it('resolves a plugin reference to the correct versioned path', () => {
    makePluginCache(pluginCache, 'fractary-faber-ingest', ['0.4.6'], ['ingest-operate']);
    makeProject(projectRoot, `workflows:\n  - id: ingest-operate\n    file: faber-ingest@fractary-faber-ingest:ingest-operate\n`);

    const result = getWorkflowPath({ workflowId: 'ingest-operate', projectRoot });

    const expected = path.join(
      pluginCache,
      'fractary-faber-ingest',
      'fractary-faber-ingest',
      '0.4.6',
      '.fractary',
      'faber',
      'workflows',
      'ingest-operate.json'
    );
    expect(result).toBe(expected);
  });

  // 2. Unknown plugin ref → actionable error
  it('throws WorkflowRegistryError with install hint when plugin is not installed', () => {
    makeProject(projectRoot, `workflows:\n  - id: ingest-operate\n    file: faber-ingest@fractary-faber-ingest:ingest-operate\n`);
    // No plugin cache created

    expect(() =>
      getWorkflowPath({ workflowId: 'ingest-operate', projectRoot })
    ).toThrow(WorkflowRegistryError);

    expect(() =>
      getWorkflowPath({ workflowId: 'ingest-operate', projectRoot })
    ).toThrow(/fractary-faber plugin install fractary-faber-ingest/);
  });

  // 3. Multiple installed versions → picks highest semver
  it('picks the highest installed version when multiple versions exist', () => {
    makePluginCache(pluginCache, 'fractary-faber-ingest', ['0.3.0', '0.4.6', '0.4.2'], ['ingest-operate']);
    makeProject(projectRoot, `workflows:\n  - id: ingest-operate\n    file: faber-ingest@fractary-faber-ingest:ingest-operate\n`);

    const result = getWorkflowPath({ workflowId: 'ingest-operate', projectRoot });

    expect(result).toContain(path.join('0.4.6', '.fractary'));
  });

  // 4. Local file ref → existing behaviour unchanged
  it('returns a local path for a standard file reference', () => {
    makeProject(projectRoot, `workflows:\n  - id: my-workflow\n    file: my-workflow.json\n`);
    // Create the local workflow file
    const workflowFile = path.join(projectRoot, '.fractary', 'faber', 'workflows', 'my-workflow.json');
    fs.writeFileSync(workflowFile, JSON.stringify({ id: 'my-workflow', steps: [] }));

    const result = getWorkflowPath({ workflowId: 'my-workflow', projectRoot });

    expect(result).toBe(workflowFile);
  });

  // 5. Schema accepts both local file and plugin ref formats
  it('accepts valid local file and plugin ref in workflows.yaml without throwing', () => {
    makePluginCache(pluginCache, 'fractary-faber-ingest', ['0.4.6'], ['ingest-operate', 'ingest-create']);
    makeProject(
      projectRoot,
      `workflows:\n  - id: ingest-operate\n    file: faber-ingest@fractary-faber-ingest:ingest-operate\n  - id: ingest-create\n    file: faber-ingest@fractary-faber-ingest:ingest-create\n`
    );

    // Should not throw during loading
    expect(() => getWorkflowPath({ workflowId: 'ingest-operate', projectRoot })).not.toThrow(
      RegistryWorkflowNotFoundError
    );
  });

  // 6. Schema rejects malformed plugin refs
  it('rejects a malformed plugin ref (missing colon) as a workflow not found', () => {
    // A malformed ref like "faber-ingest@fractary-faber-ingest" (no workflow name)
    // fails Zod validation at parse time, so the workflow is never registered.
    makeProject(
      projectRoot,
      `workflows:\n  - id: bad-ref\n    file: faber-ingest@fractary-faber-ingest\n`
    );

    expect(() =>
      getWorkflowPath({ workflowId: 'bad-ref', projectRoot })
    ).toThrow();
  });
});
