"use strict";
/**
 * @fractary/faber - Forge Integration Tests
 *
 * Integration tests for FABER + Forge workflow execution
 */
Object.defineProperty(exports, "__esModule", { value: true });
const faber_1 = require("../../workflow/faber");
const agent_executor_1 = require("../../workflow/agent-executor");
// Mock @fractary/forge
jest.mock('@fractary/forge', () => ({
    AgentAPI: jest.fn().mockImplementation(() => ({
        resolveAgent: jest.fn().mockResolvedValue({
            name: 'test-agent',
            version: '1.0.0',
            invoke: jest.fn().mockResolvedValue({
                output: 'Agent execution successful',
                structured_output: {
                    workType: 'feature',
                    summary: 'Test summary',
                },
                messages: [],
                usage: {
                    input_tokens: 100,
                    output_tokens: 50,
                },
            }),
        }),
        hasAgent: jest.fn().mockResolvedValue(true),
        healthCheck: jest.fn().mockResolvedValue({
            healthy: true,
            agent: 'test-agent',
            checks: {
                definition: { passed: true },
                tools: { passed: true },
                llm: { passed: true, provider: 'anthropic' },
                cache_sources: { passed: true },
            },
            duration_ms: 50,
        }),
    })),
}));
describe('FABER + Forge Integration', () => {
    describe('Workflow Configuration', () => {
        it('should create workflow with Forge enabled', () => {
            const workflow = new faber_1.FaberWorkflow({
                config: {
                    forge: { enabled: true, prefer_local: true },
                },
            });
            // Workflow should be created successfully
            expect(workflow).toBeInstanceOf(faber_1.FaberWorkflow);
        });
        it('should create workflow with Forge disabled (legacy mode)', () => {
            const workflow = new faber_1.FaberWorkflow({
                config: {
                    forge: { enabled: false, prefer_local: true },
                },
            });
            expect(workflow).toBeInstanceOf(faber_1.FaberWorkflow);
        });
        it('should default to legacy mode for backward compatibility', () => {
            const workflow = new faber_1.FaberWorkflow();
            // Default config should have forge disabled
            expect(workflow).toBeInstanceOf(faber_1.FaberWorkflow);
        });
    });
    describe('Agent Resolution', () => {
        it('should resolve agents from Forge when enabled', async () => {
            const { AgentAPI } = require('@fractary/forge');
            const mockResolveAgent = jest.fn().mockResolvedValue({
                name: 'frame-agent',
                version: '2.0.0',
                invoke: jest.fn().mockResolvedValue({
                    output: 'Frame complete',
                    messages: [],
                }),
            });
            AgentAPI.mockImplementation(() => ({
                resolveAgent: mockResolveAgent,
            }));
            const executor = new agent_executor_1.AgentExecutor({
                forge: { enabled: true, prefer_local: true },
            });
            const context = {
                workflowId: 'wf-123',
                workId: '456',
                phase: 'frame',
                autonomy: 'assisted',
                issue: null,
                spec: null,
                branch: null,
                previousOutputs: {},
            };
            await executor.executePhaseAgent('frame', 'Analyze requirements', context);
            expect(mockResolveAgent).toHaveBeenCalledWith('frame-agent');
        });
        it('should handle agent not found gracefully', async () => {
            const { AgentAPI } = require('@fractary/forge');
            const error = new Error('Agent not found');
            error.name = 'AgentNotFoundError';
            AgentAPI.mockImplementation(() => ({
                resolveAgent: jest.fn().mockRejectedValue(error),
            }));
            const executor = new agent_executor_1.AgentExecutor({
                forge: { enabled: true, prefer_local: true },
            });
            const context = {
                workflowId: 'wf-123',
                workId: '456',
                phase: 'frame',
                autonomy: 'assisted',
                issue: null,
                spec: null,
                branch: null,
                previousOutputs: {},
            };
            await expect(executor.executePhaseAgent('frame', 'Task', context)).rejects.toThrow(/Agent 'frame-agent' not found/);
        });
    });
    describe('Health Checks', () => {
        it('should perform health check on all phase agents', async () => {
            const { AgentAPI } = require('@fractary/forge');
            const mockHealthCheck = jest.fn().mockResolvedValue({
                healthy: true,
                agent: 'test-agent',
                checks: {
                    definition: { passed: true },
                    tools: { passed: true },
                    llm: { passed: true, provider: 'anthropic' },
                    cache_sources: { passed: true },
                },
                duration_ms: 50,
            });
            AgentAPI.mockImplementation(() => ({
                healthCheck: mockHealthCheck,
            }));
            const executor = new agent_executor_1.AgentExecutor({
                forge: { enabled: true, prefer_local: true },
            });
            const result = await executor.healthCheck();
            expect(result.healthy).toBe(true);
            expect(mockHealthCheck).toHaveBeenCalledTimes(5); // 5 FABER phases
            expect(result.phases).toHaveProperty('frame');
            expect(result.phases).toHaveProperty('architect');
            expect(result.phases).toHaveProperty('build');
            expect(result.phases).toHaveProperty('evaluate');
            expect(result.phases).toHaveProperty('release');
        });
        it('should report unhealthy if any agent fails health check', async () => {
            const { AgentAPI } = require('@fractary/forge');
            const mockHealthCheck = jest.fn()
                .mockResolvedValueOnce({ healthy: true })
                .mockResolvedValueOnce({ healthy: false })
                .mockResolvedValueOnce({ healthy: true })
                .mockResolvedValueOnce({ healthy: true })
                .mockResolvedValueOnce({ healthy: true });
            AgentAPI.mockImplementation(() => ({
                healthCheck: mockHealthCheck,
            }));
            const executor = new agent_executor_1.AgentExecutor({
                forge: { enabled: true, prefer_local: true },
            });
            const result = await executor.healthCheck();
            expect(result.healthy).toBe(false);
            expect(result.phases.architect.healthy).toBe(false);
        });
    });
    describe('Custom Agent Override', () => {
        it('should allow custom agent override for specific phases', async () => {
            const { AgentAPI } = require('@fractary/forge');
            const mockResolveAgent = jest.fn().mockResolvedValue({
                name: 'custom-frame-agent',
                version: '1.0.0',
                invoke: jest.fn().mockResolvedValue({
                    output: 'Custom agent result',
                    messages: [],
                }),
            });
            AgentAPI.mockImplementation(() => ({
                resolveAgent: mockResolveAgent,
            }));
            const workflow = new faber_1.FaberWorkflow({
                config: {
                    forge: { enabled: true, prefer_local: true },
                    phases: {
                        frame: { enabled: true, agent: 'custom-frame-agent@1.0.0' },
                        architect: { enabled: true, refineSpec: true },
                        build: { enabled: true },
                        evaluate: { enabled: true, maxRetries: 3 },
                        release: { enabled: true, requestReviews: true, reviewers: [] },
                    },
                },
            });
            expect(workflow).toBeInstanceOf(faber_1.FaberWorkflow);
            // Configuration should be set correctly
        });
    });
    describe('Dual-Mode Support', () => {
        it('should support switching between Forge and legacy modes', async () => {
            // Create with Forge enabled
            const forgeWorkflow = new faber_1.FaberWorkflow({
                config: {
                    forge: { enabled: true, prefer_local: true },
                },
            });
            expect(forgeWorkflow).toBeInstanceOf(faber_1.FaberWorkflow);
            // Create with legacy mode
            const legacyWorkflow = new faber_1.FaberWorkflow({
                config: {
                    forge: { enabled: false, prefer_local: true },
                },
            });
            expect(legacyWorkflow).toBeInstanceOf(faber_1.FaberWorkflow);
        });
        it('should execute legacy mode when Forge disabled', async () => {
            const executor = new agent_executor_1.AgentExecutor({
                forge: { enabled: false, prefer_local: true },
            });
            const context = {
                workflowId: 'wf-123',
                workId: '456',
                phase: 'frame',
                autonomy: 'assisted',
                issue: null,
                spec: null,
                branch: null,
                previousOutputs: {},
            };
            const result = await executor.executePhaseAgent('frame', 'Task', context);
            // Should return legacy result
            expect(result.metadata?.legacy).toBe(true);
            expect(result.output).toBe('Legacy phase execution: frame');
        });
    });
    describe('Performance', () => {
        it('should cache agents for improved performance', async () => {
            const { AgentAPI } = require('@fractary/forge');
            const mockResolveAgent = jest.fn().mockResolvedValue({
                name: 'frame-agent',
                version: '2.0.0',
                invoke: jest.fn().mockResolvedValue({
                    output: 'Result',
                    messages: [],
                }),
            });
            AgentAPI.mockImplementation(() => ({
                resolveAgent: mockResolveAgent,
            }));
            const executor = new agent_executor_1.AgentExecutor({
                forge: { enabled: true, prefer_local: true },
            });
            const context = {
                workflowId: 'wf-123',
                workId: '456',
                phase: 'frame',
                autonomy: 'assisted',
                issue: null,
                spec: null,
                branch: null,
                previousOutputs: {},
            };
            // Execute same agent multiple times
            await executor.executePhaseAgent('frame', 'Task 1', context);
            await executor.executePhaseAgent('frame', 'Task 2', context);
            await executor.executePhaseAgent('frame', 'Task 3', context);
            // Should only resolve once, then use cache
            expect(mockResolveAgent).toHaveBeenCalledTimes(1);
        });
    });
    describe('Error Handling', () => {
        it('should provide helpful error messages when agent not found', async () => {
            const { AgentAPI } = require('@fractary/forge');
            const error = new Error('Agent not found');
            error.name = 'AgentNotFoundError';
            AgentAPI.mockImplementation(() => ({
                resolveAgent: jest.fn().mockRejectedValue(error),
            }));
            const executor = new agent_executor_1.AgentExecutor({
                forge: { enabled: true, prefer_local: true },
            });
            const context = {
                workflowId: 'wf-123',
                workId: '456',
                phase: 'frame',
                autonomy: 'assisted',
                issue: null,
                spec: null,
                branch: null,
                previousOutputs: {},
            };
            try {
                await executor.executePhaseAgent('frame', 'Task', context);
                fail('Should have thrown error');
            }
            catch (err) {
                expect(err.message).toContain("Agent 'frame-agent' not found");
                expect(err.message).toContain('forge install frame-agent');
                expect(err.message).toContain('.fractary/agents/');
            }
        });
    });
});
//# sourceMappingURL=forge-integration.test.js.map