/**
 * @fractary/faber - AgentExecutor Tests
 */

import { AgentExecutor } from '../agent-executor.js';
import type { PhaseContext } from '../types.js';
import { WorkflowError } from '../../errors.js';

// Mock @fractary/forge
jest.mock('@fractary/forge', () => ({
  AgentAPI: jest.fn().mockImplementation(() => ({
    resolveAgent: jest.fn(),
    hasAgent: jest.fn(),
    healthCheck: jest.fn(),
  })),
}));

describe('AgentExecutor', () => {
  let mockPhaseContext: PhaseContext;

  beforeEach(() => {
    mockPhaseContext = {
      workflowId: 'wf-123',
      workId: '456',
      phase: 'frame',
      autonomy: 'assisted',
      issue: null,
      spec: null,
      branch: null,
      previousOutputs: {},
    };
  });

  describe('constructor', () => {
    it('should create instance in legacy mode when forge disabled', () => {
      const executor = new AgentExecutor({
        forge: { enabled: false, prefer_local: true },
      });

      expect(executor.isForgeEnabled()).toBe(false);
    });

    it('should create instance in Forge mode when forge enabled', () => {
      const executor = new AgentExecutor({
        forge: { enabled: true, prefer_local: true },
      });

      expect(executor.isForgeEnabled()).toBe(true);
    });

    it('should default to legacy mode when no config provided', () => {
      const executor = new AgentExecutor();

      expect(executor.isForgeEnabled()).toBe(false);
    });
  });

  describe('getAgentNameForPhase', () => {
    it('should map frame phase to frame-agent', () => {
      const executor = new AgentExecutor();
      expect(executor.getAgentNameForPhase('frame')).toBe('frame-agent');
    });

    it('should map architect phase to architect-agent', () => {
      const executor = new AgentExecutor();
      expect(executor.getAgentNameForPhase('architect')).toBe('architect-agent');
    });

    it('should map build phase to build-agent', () => {
      const executor = new AgentExecutor();
      expect(executor.getAgentNameForPhase('build')).toBe('build-agent');
    });

    it('should map evaluate phase to evaluate-agent', () => {
      const executor = new AgentExecutor();
      expect(executor.getAgentNameForPhase('evaluate')).toBe('evaluate-agent');
    });

    it('should map release phase to release-agent', () => {
      const executor = new AgentExecutor();
      expect(executor.getAgentNameForPhase('release')).toBe('release-agent');
    });

    it('should generate agent name for unknown phase', () => {
      const executor = new AgentExecutor();
      expect(executor.getAgentNameForPhase('custom')).toBe('custom-agent');
    });

    it('should return custom agent name directly when it contains -agent suffix', () => {
      const executor = new AgentExecutor();
      expect(executor.getAgentNameForPhase('my-custom-frame-agent')).toBe('my-custom-frame-agent');
    });

    it('should return custom agent name directly when it contains version specifier @', () => {
      const executor = new AgentExecutor();
      expect(executor.getAgentNameForPhase('custom-frame-agent@1.0.0')).toBe('custom-frame-agent@1.0.0');
    });

    it('should return custom agent name directly for versioned agents without -agent suffix', () => {
      const executor = new AgentExecutor();
      expect(executor.getAgentNameForPhase('my-custom@2.0.0')).toBe('my-custom@2.0.0');
    });
  });

  describe('executePhaseAgent - Legacy Mode', () => {
    it('should return legacy result when in legacy mode', async () => {
      const executor = new AgentExecutor({
        forge: { enabled: false, prefer_local: true },
      });

      const result = await executor.executePhaseAgent(
        'frame',
        'Analyze requirements',
        mockPhaseContext
      );

      expect(result).toEqual({
        output: 'Legacy phase execution: frame',
        messages: [],
        metadata: {
          legacy: true,
          phase: 'frame',
        },
      });
    });
  });

  describe('executePhaseAgent - Forge Mode', () => {
    it('should resolve agent and invoke it in Forge mode', async () => {
      const mockInvoke = jest.fn().mockResolvedValue({
        output: 'Agent result',
        messages: [],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const mockAgent = {
        name: 'frame-agent',
        version: '2.0.0',
        invoke: mockInvoke,
      };

      const { AgentAPI } = require('@fractary/forge');
      const mockResolveAgent = jest.fn().mockResolvedValue(mockAgent);
      AgentAPI.mockImplementation(() => ({
        resolveAgent: mockResolveAgent,
      }));

      const executor = new AgentExecutor({
        forge: { enabled: true, prefer_local: true },
      });

      const result = await executor.executePhaseAgent(
        'frame',
        'Analyze requirements',
        mockPhaseContext
      );

      expect(mockResolveAgent).toHaveBeenCalledWith('frame-agent');
      expect(mockInvoke).toHaveBeenCalledWith('Analyze requirements', {
        workflowId: 'wf-123',
        workId: '456',
        phase: 'frame',
        autonomy: 'assisted',
        issue: null,
        spec: null,
        branch: null,
        previousOutputs: {},
      });
      expect(result).toEqual({
        output: 'Agent result',
        messages: [],
        usage: { input_tokens: 100, output_tokens: 50 },
      });
    });

    it('should cache resolved agents', async () => {
      const mockAgent = {
        name: 'frame-agent',
        version: '2.0.0',
        invoke: jest.fn().mockResolvedValue({
          output: 'Result',
          messages: [],
        }),
      };

      const { AgentAPI } = require('@fractary/forge');
      const mockResolveAgent = jest.fn().mockResolvedValue(mockAgent);
      AgentAPI.mockImplementation(() => ({
        resolveAgent: mockResolveAgent,
      }));

      const executor = new AgentExecutor({
        forge: { enabled: true, prefer_local: true },
      });

      // First call - should resolve
      await executor.executePhaseAgent('frame', 'Task 1', mockPhaseContext);
      expect(mockResolveAgent).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await executor.executePhaseAgent('frame', 'Task 2', mockPhaseContext);
      expect(mockResolveAgent).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should throw WorkflowError when agent not found', async () => {
      const error = new Error('Agent not found');
      error.name = 'AgentNotFoundError';

      const { AgentAPI } = require('@fractary/forge');
      AgentAPI.mockImplementation(() => ({
        resolveAgent: jest.fn().mockRejectedValue(error),
      }));

      const executor = new AgentExecutor({
        forge: { enabled: true, prefer_local: true },
      });

      await expect(
        executor.executePhaseAgent('frame', 'Task', mockPhaseContext)
      ).rejects.toThrow(WorkflowError);
    });

    it('should propagate other errors', async () => {
      const error = new Error('Network error');

      const { AgentAPI } = require('@fractary/forge');
      AgentAPI.mockImplementation(() => ({
        resolveAgent: jest.fn().mockRejectedValue(error),
      }));

      const executor = new AgentExecutor({
        forge: { enabled: true, prefer_local: true },
      });

      await expect(
        executor.executePhaseAgent('frame', 'Task', mockPhaseContext)
      ).rejects.toThrow('Network error');
    });
  });

  describe('clearCache', () => {
    it('should clear agent cache', async () => {
      const mockAgent = {
        name: 'frame-agent',
        version: '2.0.0',
        invoke: jest.fn().mockResolvedValue({ output: 'Result', messages: [] }),
      };

      const { AgentAPI } = require('@fractary/forge');
      const mockResolveAgent = jest.fn().mockResolvedValue(mockAgent);
      AgentAPI.mockImplementation(() => ({
        resolveAgent: mockResolveAgent,
      }));

      const executor = new AgentExecutor({
        forge: { enabled: true, prefer_local: true },
      });

      // First call - caches agent
      await executor.executePhaseAgent('frame', 'Task', mockPhaseContext);
      expect(mockResolveAgent).toHaveBeenCalledTimes(1);

      // Clear cache
      executor.clearCache();

      // Second call - should resolve again
      await executor.executePhaseAgent('frame', 'Task', mockPhaseContext);
      expect(mockResolveAgent).toHaveBeenCalledTimes(2);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy in legacy mode', async () => {
      const executor = new AgentExecutor({
        forge: { enabled: false, prefer_local: true },
      });

      const result = await executor.healthCheck();

      expect(result).toEqual({
        healthy: true,
        phases: {},
      });
    });

    it('should check health of all phase agents in Forge mode', async () => {
      const { AgentAPI } = require('@fractary/forge');
      const mockHealthCheck = jest.fn()
        .mockResolvedValueOnce({ healthy: true, agent: 'frame-agent' })
        .mockResolvedValueOnce({ healthy: true, agent: 'architect-agent' })
        .mockResolvedValueOnce({ healthy: true, agent: 'build-agent' })
        .mockResolvedValueOnce({ healthy: true, agent: 'evaluate-agent' })
        .mockResolvedValueOnce({ healthy: true, agent: 'release-agent' });

      AgentAPI.mockImplementation(() => ({
        healthCheck: mockHealthCheck,
      }));

      const executor = new AgentExecutor({
        forge: { enabled: true, prefer_local: true },
      });

      const result = await executor.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.phases.frame.healthy).toBe(true);
      expect(result.phases.architect.healthy).toBe(true);
      expect(result.phases.build.healthy).toBe(true);
      expect(result.phases.evaluate.healthy).toBe(true);
      expect(result.phases.release.healthy).toBe(true);
    });

    it('should return unhealthy if any agent fails health check', async () => {
      const { AgentAPI } = require('@fractary/forge');
      const mockHealthCheck = jest.fn()
        .mockResolvedValueOnce({ healthy: true, agent: 'frame-agent' })
        .mockResolvedValueOnce({ healthy: false, agent: 'architect-agent' })
        .mockResolvedValueOnce({ healthy: true, agent: 'build-agent' })
        .mockResolvedValueOnce({ healthy: true, agent: 'evaluate-agent' })
        .mockResolvedValueOnce({ healthy: true, agent: 'release-agent' });

      AgentAPI.mockImplementation(() => ({
        healthCheck: mockHealthCheck,
      }));

      const executor = new AgentExecutor({
        forge: { enabled: true, prefer_local: true },
      });

      const result = await executor.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.phases.architect.healthy).toBe(false);
    });

    it('should handle health check errors', async () => {
      const { AgentAPI } = require('@fractary/forge');
      const mockHealthCheck = jest.fn()
        .mockResolvedValueOnce({ healthy: true })
        .mockRejectedValueOnce(new Error('Connection failed'));

      AgentAPI.mockImplementation(() => ({
        healthCheck: mockHealthCheck,
      }));

      const executor = new AgentExecutor({
        forge: { enabled: true, prefer_local: true },
      });

      const result = await executor.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.phases.architect.healthy).toBe(false);
      expect(result.phases.architect.error).toBe('Connection failed');
    });
  });
});
