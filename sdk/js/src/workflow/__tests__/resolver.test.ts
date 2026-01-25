/**
 * @fractary/faber - Workflow Resolver Tests
 *
 * Unit tests for the WorkflowResolver class, focusing on context overlay merging.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  WorkflowResolver,
  WorkflowFileConfig,
  WorkflowNotFoundError,
} from '../resolver.js';

describe('WorkflowResolver', () => {
  let testDir: string;
  let marketplaceRoot: string;
  let projectRoot: string;
  let resolver: WorkflowResolver;

  beforeEach(() => {
    // Create temp directory for test workflows
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faber-resolver-test-'));
    marketplaceRoot = path.join(testDir, 'marketplaces');
    projectRoot = path.join(testDir, 'project');

    // Create directory structures
    fs.mkdirSync(path.join(marketplaceRoot, 'fractary-faber/plugins/faber/config/workflows'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(projectRoot, '.fractary/faber/workflows'), { recursive: true });

    resolver = new WorkflowResolver({
      marketplaceRoot,
      projectRoot,
    });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper to create a workflow file
   */
  function createWorkflow(
    namespace: 'fractary-faber' | 'project',
    name: string,
    config: Partial<WorkflowFileConfig>
  ): void {
    const basePath =
      namespace === 'fractary-faber'
        ? path.join(marketplaceRoot, 'fractary-faber/plugins/faber/config/workflows')
        : path.join(projectRoot, '.fractary/faber/workflows');

    const fullConfig: WorkflowFileConfig = {
      id: config.id || name,
      phases: config.phases || {
        frame: { enabled: true },
        architect: { enabled: true },
        build: { enabled: true },
        evaluate: { enabled: true },
        release: { enabled: true },
      },
      autonomy: config.autonomy || { level: 'guarded' },
      ...config,
    };

    fs.writeFileSync(path.join(basePath, `${name}.json`), JSON.stringify(fullConfig, null, 2));
  }

  describe('Context Overlay Merging', () => {
    describe('Single Workflow (No Inheritance)', () => {
      it('should return undefined context when no context is defined', async () => {
        createWorkflow('project', 'no-context', {
          id: 'no-context',
        });

        const resolved = await resolver.resolveWorkflow('no-context');

        expect(resolved.context).toBeUndefined();
      });

      it('should preserve global context from single workflow', async () => {
        createWorkflow('project', 'global-only', {
          id: 'global-only',
          context: {
            global: 'Follow coding standards in docs/STANDARDS.md',
          },
        });

        const resolved = await resolver.resolveWorkflow('global-only');

        expect(resolved.context).toBeDefined();
        expect(resolved.context?.global).toBe('Follow coding standards in docs/STANDARDS.md');
        expect(resolved.context?.phases).toBeUndefined();
        expect(resolved.context?.steps).toBeUndefined();
      });

      it('should preserve phase contexts from single workflow', async () => {
        createWorkflow('project', 'phase-only', {
          id: 'phase-only',
          context: {
            phases: {
              build: 'Use React patterns',
              evaluate: 'Require 90% coverage',
            },
          },
        });

        const resolved = await resolver.resolveWorkflow('phase-only');

        expect(resolved.context).toBeDefined();
        expect(resolved.context?.global).toBeUndefined();
        expect(resolved.context?.phases?.build).toBe('Use React patterns');
        expect(resolved.context?.phases?.evaluate).toBe('Require 90% coverage');
        expect(resolved.context?.phases?.frame).toBeUndefined();
      });

      it('should preserve step contexts from single workflow', async () => {
        createWorkflow('project', 'step-only', {
          id: 'step-only',
          context: {
            steps: {
              implement: 'Prefer composition over inheritance',
              'generate-spec': 'Include API versioning',
            },
          },
        });

        const resolved = await resolver.resolveWorkflow('step-only');

        expect(resolved.context).toBeDefined();
        expect(resolved.context?.steps?.implement).toBe('Prefer composition over inheritance');
        expect(resolved.context?.steps?.['generate-spec']).toBe('Include API versioning');
      });

      it('should preserve all context levels from single workflow', async () => {
        createWorkflow('project', 'full-context', {
          id: 'full-context',
          context: {
            global: 'Global standard',
            phases: {
              build: 'Build phase context',
            },
            steps: {
              implement: 'Step context',
            },
          },
        });

        const resolved = await resolver.resolveWorkflow('full-context');

        expect(resolved.context).toBeDefined();
        expect(resolved.context?.global).toBe('Global standard');
        expect(resolved.context?.phases?.build).toBe('Build phase context');
        expect(resolved.context?.steps?.implement).toBe('Step context');
      });
    });

    describe('Two-Level Inheritance', () => {
      beforeEach(() => {
        // Create parent workflow in marketplace
        createWorkflow('fractary-faber', 'base', {
          id: 'base',
          context: {
            global: 'Base global context',
            phases: {
              build: 'Base build context',
              evaluate: 'Base evaluate context',
            },
            steps: {
              implement: 'Base implement step',
            },
          },
        });
      });

      it('should prepend ancestor global context to child global context', async () => {
        createWorkflow('project', 'child', {
          id: 'child',
          extends: 'fractary-faber:base',
          context: {
            global: 'Child global context',
          },
        });

        const resolved = await resolver.resolveWorkflow('child');

        expect(resolved.context?.global).toBe('Base global context\n\nChild global context');
      });

      it('should prepend ancestor phase context to child phase context', async () => {
        createWorkflow('project', 'child-phase', {
          id: 'child-phase',
          extends: 'fractary-faber:base',
          context: {
            phases: {
              build: 'Child build context',
            },
          },
        });

        const resolved = await resolver.resolveWorkflow('child-phase');

        expect(resolved.context?.phases?.build).toBe('Base build context\n\nChild build context');
        // Evaluate should come from base only
        expect(resolved.context?.phases?.evaluate).toBe('Base evaluate context');
      });

      it('should override ancestor step context with child step context', async () => {
        createWorkflow('project', 'child-step', {
          id: 'child-step',
          extends: 'fractary-faber:base',
          context: {
            steps: {
              implement: 'Child implement step (overrides base)',
            },
          },
        });

        const resolved = await resolver.resolveWorkflow('child-step');

        // Child overrides ancestor for same step ID
        expect(resolved.context?.steps?.implement).toBe('Child implement step (overrides base)');
      });

      it('should merge step contexts when different step IDs', async () => {
        createWorkflow('project', 'child-new-step', {
          id: 'child-new-step',
          extends: 'fractary-faber:base',
          context: {
            steps: {
              'new-step': 'Child new step context',
            },
          },
        });

        const resolved = await resolver.resolveWorkflow('child-new-step');

        // Both step contexts should be present
        expect(resolved.context?.steps?.implement).toBe('Base implement step');
        expect(resolved.context?.steps?.['new-step']).toBe('Child new step context');
      });

      it('should inherit ancestor context when child has none', async () => {
        createWorkflow('project', 'no-child-context', {
          id: 'no-child-context',
          extends: 'fractary-faber:base',
          // No context defined
        });

        const resolved = await resolver.resolveWorkflow('no-child-context');

        expect(resolved.context?.global).toBe('Base global context');
        expect(resolved.context?.phases?.build).toBe('Base build context');
        expect(resolved.context?.steps?.implement).toBe('Base implement step');
      });

      it('should use child context when ancestor has none', async () => {
        // Create ancestor without context
        createWorkflow('fractary-faber', 'no-ctx-base', {
          id: 'no-ctx-base',
        });

        createWorkflow('project', 'child-only-context', {
          id: 'child-only-context',
          extends: 'fractary-faber:no-ctx-base',
          context: {
            global: 'Child only global',
          },
        });

        const resolved = await resolver.resolveWorkflow('child-only-context');

        expect(resolved.context?.global).toBe('Child only global');
      });
    });

    describe('Three-Level Inheritance', () => {
      beforeEach(() => {
        // Create grandparent (core)
        createWorkflow('fractary-faber', 'core', {
          id: 'core',
          context: {
            global: 'Core global',
            phases: {
              frame: 'Core frame',
              build: 'Core build',
            },
            steps: {
              'core-step': 'Core step context',
            },
          },
        });

        // Create parent extending core
        createWorkflow('fractary-faber', 'default', {
          id: 'default',
          extends: 'fractary-faber:core',
          context: {
            global: 'Default global',
            phases: {
              build: 'Default build',
              evaluate: 'Default evaluate',
            },
            steps: {
              'default-step': 'Default step context',
            },
          },
        });
      });

      it('should accumulate global context from all ancestors (grandparent → parent → child)', async () => {
        createWorkflow('project', 'grandchild', {
          id: 'grandchild',
          extends: 'fractary-faber:default',
          context: {
            global: 'Grandchild global',
          },
        });

        const resolved = await resolver.resolveWorkflow('grandchild');

        expect(resolved.context?.global).toBe('Core global\n\nDefault global\n\nGrandchild global');
      });

      it('should accumulate phase context through inheritance chain', async () => {
        createWorkflow('project', 'grandchild-phase', {
          id: 'grandchild-phase',
          extends: 'fractary-faber:default',
          context: {
            phases: {
              build: 'Grandchild build',
            },
          },
        });

        const resolved = await resolver.resolveWorkflow('grandchild-phase');

        // Build: Core → Default → Grandchild
        expect(resolved.context?.phases?.build).toBe(
          'Core build\n\nDefault build\n\nGrandchild build'
        );
        // Frame: Core only
        expect(resolved.context?.phases?.frame).toBe('Core frame');
        // Evaluate: Default only
        expect(resolved.context?.phases?.evaluate).toBe('Default evaluate');
      });

      it('should resolve step contexts with proper override chain', async () => {
        createWorkflow('project', 'grandchild-step', {
          id: 'grandchild-step',
          extends: 'fractary-faber:default',
          context: {
            steps: {
              'core-step': 'Grandchild overrides core step',
              'grandchild-step': 'New grandchild step',
            },
          },
        });

        const resolved = await resolver.resolveWorkflow('grandchild-step');

        // core-step: grandchild overrides
        expect(resolved.context?.steps?.['core-step']).toBe('Grandchild overrides core step');
        // default-step: from default
        expect(resolved.context?.steps?.['default-step']).toBe('Default step context');
        // grandchild-step: from grandchild
        expect(resolved.context?.steps?.['grandchild-step']).toBe('New grandchild step');
      });

      it('should preserve inheritance chain in resolved workflow', async () => {
        createWorkflow('project', 'grandchild-chain', {
          id: 'grandchild-chain',
          extends: 'fractary-faber:default',
        });

        const resolved = await resolver.resolveWorkflow('grandchild-chain');

        expect(resolved.inheritance_chain).toEqual([
          'grandchild-chain',
          'fractary-faber:default',
          'fractary-faber:core',
        ]);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty context object gracefully', async () => {
        createWorkflow('project', 'empty-context', {
          id: 'empty-context',
          context: {},
        });

        const resolved = await resolver.resolveWorkflow('empty-context');

        expect(resolved.context).toBeUndefined();
      });

      it('should handle empty string context values', async () => {
        createWorkflow('project', 'empty-string', {
          id: 'empty-string',
          context: {
            global: '',
            phases: {
              build: '',
            },
          },
        });

        const resolved = await resolver.resolveWorkflow('empty-string');

        // Empty strings should not create context
        expect(resolved.context).toBeUndefined();
      });

      it('should handle context with only whitespace', async () => {
        createWorkflow('project', 'whitespace-context', {
          id: 'whitespace-context',
          context: {
            global: '  ',
          },
        });

        const resolved = await resolver.resolveWorkflow('whitespace-context');

        // Whitespace is still a value (preserved)
        expect(resolved.context?.global).toBe('  ');
      });

      it('should handle special characters in context', async () => {
        const specialChars = 'Use patterns from docs/GUIDE.md. Key: "value" & \'other\'';
        createWorkflow('project', 'special-chars', {
          id: 'special-chars',
          context: {
            global: specialChars,
          },
        });

        const resolved = await resolver.resolveWorkflow('special-chars');

        expect(resolved.context?.global).toBe(specialChars);
      });

      it('should handle multiline context strings', async () => {
        const multiline = 'Line 1\nLine 2\n\nLine 4';
        createWorkflow('project', 'multiline', {
          id: 'multiline',
          context: {
            global: multiline,
          },
        });

        const resolved = await resolver.resolveWorkflow('multiline');

        expect(resolved.context?.global).toBe(multiline);
      });

      it('should handle all five phases in context', async () => {
        createWorkflow('project', 'all-phases', {
          id: 'all-phases',
          context: {
            phases: {
              frame: 'Frame context',
              architect: 'Architect context',
              build: 'Build context',
              evaluate: 'Evaluate context',
              release: 'Release context',
            },
          },
        });

        const resolved = await resolver.resolveWorkflow('all-phases');

        expect(resolved.context?.phases?.frame).toBe('Frame context');
        expect(resolved.context?.phases?.architect).toBe('Architect context');
        expect(resolved.context?.phases?.build).toBe('Build context');
        expect(resolved.context?.phases?.evaluate).toBe('Evaluate context');
        expect(resolved.context?.phases?.release).toBe('Release context');
      });
    });

    describe('Backward Compatibility', () => {
      it('should work with workflows that have no context field', async () => {
        createWorkflow('fractary-faber', 'legacy', {
          id: 'legacy',
          description: 'Legacy workflow without context',
        });

        createWorkflow('project', 'extends-legacy', {
          id: 'extends-legacy',
          extends: 'fractary-faber:legacy',
          context: {
            global: 'New context on child',
          },
        });

        const resolved = await resolver.resolveWorkflow('extends-legacy');

        expect(resolved.context?.global).toBe('New context on child');
        expect(resolved.inheritance_chain).toEqual(['extends-legacy', 'fractary-faber:legacy']);
      });

      it('should preserve other workflow properties alongside context', async () => {
        createWorkflow('project', 'full-workflow', {
          id: 'full-workflow',
          description: 'Full workflow with all features',
          asset_type: 'software-feature',
          context: {
            global: 'Context value',
          },
          autonomy: {
            level: 'autonomous',
          },
        });

        const resolved = await resolver.resolveWorkflow('full-workflow');

        expect(resolved.id).toBe('full-workflow');
        expect(resolved.description).toBe('Full workflow with all features');
        expect(resolved.autonomy?.level).toBe('autonomous');
        expect(resolved.context?.global).toBe('Context value');
      });
    });
  });

  describe('Basic Workflow Resolution', () => {
    it('should resolve a simple workflow without inheritance', async () => {
      createWorkflow('project', 'simple', {
        id: 'simple',
        description: 'Simple workflow',
      });

      const resolved = await resolver.resolveWorkflow('simple');

      expect(resolved.id).toBe('simple');
      expect(resolved.description).toBe('Simple workflow');
      expect(resolved.inheritance_chain).toEqual(['simple']);
    });

    it('should throw WorkflowNotFoundError for non-existent workflow', async () => {
      await expect(resolver.resolveWorkflow('non-existent')).rejects.toThrow(WorkflowNotFoundError);
    });

    it('should clear cache correctly', async () => {
      createWorkflow('project', 'cached', {
        id: 'cached',
        description: 'First version',
      });

      // First resolution
      const first = await resolver.resolveWorkflow('cached');
      expect(first.description).toBe('First version');

      // Update the file
      createWorkflow('project', 'cached', {
        id: 'cached',
        description: 'Second version',
      });

      // Without clearing cache, should get old version
      const stillCached = await resolver.resolveWorkflow('cached');
      expect(stillCached.description).toBe('First version');

      // Clear cache and resolve again
      resolver.clearCache();
      const fresh = await resolver.resolveWorkflow('cached');
      expect(fresh.description).toBe('Second version');
    });
  });
});
