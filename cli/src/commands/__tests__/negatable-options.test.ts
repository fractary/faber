/**
 * Unit tests for --no-* options
 *
 * Commander stores `--no-<name>` as `options.<name> = false`. It never sets
 * `options.no<Name>`, so each test parses the command's own arguments and
 * passes the result to the check the command makes (#280).
 */

import type { Command } from 'commander';
import { createPlanCommand, shouldCreateBranch } from '../plan/index.js';
import { createAuthSetupCommand, shouldSaveCredentials } from '../auth/index.js';

// Jest's CommonJS transform cannot load the plan builder (it uses import.meta)
// or the ES module builds of the SDKs. Parsing a command's options uses none of them.
jest.mock('../../lib/anthropic-client.js', () => ({ AnthropicClient: jest.fn() }));
jest.mock('../../lib/repo-client.js', () => ({ RepoClient: { create: jest.fn() } }));
jest.mock('@fractary/faber', () => ({}));

/**
 * Parse args with the command's own options, without running it
 */
async function parseOptions<T>(command: Command, args: string[]): Promise<T> {
  let parsed: T | undefined;
  command.action((...actionArgs: unknown[]) => {
    // Commander passes the arguments, then the options, then the command
    parsed = actionArgs[actionArgs.length - 2] as T;
  });
  await command.parseAsync(args, { from: 'user' });
  if (parsed === undefined) {
    throw new Error('The command did not run its action');
  }
  return parsed;
}

describe('workflow-plan --no-branch', () => {
  it('skips branch creation with --no-branch', async () => {
    const options = await parseOptions<Parameters<typeof shouldCreateBranch>[0]>(
      createPlanCommand(), ['278', '--no-branch']
    );

    expect(shouldCreateBranch(options)).toBe(false);
  });

  it('creates the branch without --no-branch', async () => {
    const options = await parseOptions<Parameters<typeof shouldCreateBranch>[0]>(
      createPlanCommand(), ['278']
    );

    expect(shouldCreateBranch(options)).toBe(true);
  });
});

describe('auth setup --no-save', () => {
  it('saves nothing with --no-save', async () => {
    const options = await parseOptions<Parameters<typeof shouldSaveCredentials>[0]>(
      createAuthSetupCommand(), ['--no-save']
    );

    expect(shouldSaveCredentials(options)).toBe(false);
  });

  it('saves the private key and configuration without --no-save', async () => {
    const options = await parseOptions<Parameters<typeof shouldSaveCredentials>[0]>(
      createAuthSetupCommand(), []
    );

    expect(shouldSaveCredentials(options)).toBe(true);
  });
});
