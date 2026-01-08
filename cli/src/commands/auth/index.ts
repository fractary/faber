/**
 * Authentication setup command
 */

import { Command } from 'commander';
import * as readline from 'readline/promises';
import chalk from 'chalk';
import fs from 'fs/promises';
import {
  generateAppManifest,
  getManifestCreationUrl,
  exchangeCodeForCredentials,
  validateAppCredentials,
  getInstallationId,
  savePrivateKey,
  formatPermissionsDisplay,
} from '../../lib/github-app-setup.js';
import {
  parseCodeFromUrl,
  validateManifestCode,
  detectGitHubContext,
  isGitRepository,
} from '../../utils/github-manifest.js';

interface SetupOptions {
  org?: string;
  repo?: string;
  configPath?: string;
  showManifest?: boolean;
  noSave?: boolean;
}

/**
 * Create the auth setup command
 */
export function createAuthSetupCommand(): Command {
  return new Command('setup')
    .description('Set up GitHub App authentication for FABER CLI')
    .option('--org <name>', 'GitHub organization name')
    .option('--repo <name>', 'GitHub repository name')
    .option(
      '--config-path <path>',
      'Path to config file',
      '.fractary/settings.json'
    )
    .option('--show-manifest', 'Display manifest JSON before setup')
    .option('--no-save', 'Display credentials without saving')
    .action(async (options: SetupOptions) => {
      await runSetup(options);
    });
}

/**
 * Run the setup flow
 */
async function runSetup(options: SetupOptions): Promise<void> {
  console.log(chalk.bold('\n🔐 GitHub App Authentication Setup\n'));

  // Step 1: Detect or prompt for GitHub context
  let org = options.org;
  let repo = options.repo;

  if (!org || !repo) {
    if (!isGitRepository()) {
      console.error(
        chalk.red('❌ Error: Not a git repository\n') +
          'Run this command from a git repository or provide --org and --repo flags.'
      );
      process.exit(1);
    }

    const context = detectGitHubContext();
    if (!context) {
      console.error(
        chalk.red('❌ Error: Could not detect GitHub organization/repository\n') +
          'Please provide --org and --repo flags.'
      );
      process.exit(1);
    }

    org = context.org;
    repo = context.repo;
  }

  console.log('Detected GitHub context:');
  console.log(`  Organization: ${chalk.cyan(org)}`);
  console.log(`  Repository: ${chalk.cyan(repo)}\n`);

  // Step 2: Check if already configured
  const configPath = options.configPath || '.fractary/settings.json';
  const existingConfig = await checkExistingConfig(configPath);

  if (existingConfig) {
    console.log(
      chalk.yellow('⚠️  GitHub App already configured in ' + configPath)
    );
    console.log(
      'This will create a new app and replace the existing configuration.\n'
    );

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await rl.question('Continue? (y/N): ');
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('Setup cancelled.');
      return;
    }
    console.log();
  }

  // Step 3: Generate manifest
  const manifest = generateAppManifest({ organization: org, repository: repo });

  if (options.showManifest) {
    console.log(chalk.bold('\n📋 App Manifest:\n'));
    console.log(JSON.stringify(manifest, null, 2));
    console.log();
  }

  // Step 4: Display creation instructions
  console.log(chalk.bold('━'.repeat(60)));
  console.log(chalk.bold('📋 STEP 1: Create the GitHub App'));
  console.log(chalk.bold('━'.repeat(60)));
  console.log();

  const creationUrl = getManifestCreationUrl(manifest);
  console.log('Please click this URL to create your GitHub App:\n');
  console.log(chalk.cyan.bold(`👉 ${creationUrl}\n`));

  console.log('The app will request these permissions:');
  console.log(formatPermissionsDisplay(manifest));
  console.log();

  const rl1 = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await rl1.question('Press Enter when you have created the app...');
  rl1.close();

  // Step 5: Prompt for code
  console.log();
  console.log(chalk.bold('━'.repeat(60)));
  console.log(chalk.bold('📋 STEP 2: Copy the code from the redirect URL'));
  console.log(chalk.bold('━'.repeat(60)));
  console.log();
  console.log('After creating the app, GitHub will redirect you to a URL like:');
  console.log(
    chalk.gray('https://github.com/settings/apps/your-app?code=XXXXXXXXXXXXX')
  );
  console.log();
  console.log('Copy the entire code from the URL bar and paste it below:\n');

  let code: string | null = null;
  let attempts = 0;
  const maxAttempts = 3;

  const rl2 = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  while (!code && attempts < maxAttempts) {
    const input = await rl2.question(chalk.bold('Code: '));

    // Try to parse code from URL or use directly
    code = parseCodeFromUrl(input);

    if (!code || !validateManifestCode(code)) {
      attempts++;
      if (attempts < maxAttempts) {
        console.log(
          chalk.red(
            `\n❌ Invalid code format. Please try again (${maxAttempts - attempts} attempts remaining).\n`
          )
        );
        code = null;
      }
    }
  }

  rl2.close();

  if (!code) {
    console.error(
      chalk.red('\n❌ Error: Could not validate code after multiple attempts.\n')
    );
    console.log('Please run the command again and ensure you copy the complete code.');
    process.exit(1);
  }

  // Step 6: Exchange code for credentials
  console.log(chalk.gray('\nExchanging code for credentials...'));

  let conversionResponse;
  try {
    conversionResponse = await exchangeCodeForCredentials(code);
    validateAppCredentials(conversionResponse);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(chalk.red('\n❌ Error: ' + error.message + '\n'));
    } else {
      console.error(chalk.red('\n❌ Unknown error occurred\n'));
    }
    process.exit(1);
  }

  console.log(chalk.green('✓ App created successfully!'));
  console.log(`  App ID: ${chalk.cyan(conversionResponse.id)}`);
  console.log(`  App Name: ${chalk.cyan(conversionResponse.name)}\n`);

  // Step 7: Fetch installation ID
  console.log(chalk.gray('Fetching installation ID...'));

  let installationId: string;
  try {
    installationId = await getInstallationId(
      conversionResponse.id.toString(),
      conversionResponse.pem,
      org
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(chalk.red('\n❌ Error: ' + error.message + '\n'));
    } else {
      console.error(chalk.red('\n❌ Unknown error occurred\n'));
    }
    console.log('The app was created but could not find the installation.');
    console.log(
      `Please install the app on your organization: ${chalk.cyan(
        `https://github.com/apps/${conversionResponse.slug}/installations/new`
      )}`
    );
    process.exit(1);
  }

  console.log(chalk.green(`✓ Installation ID: ${chalk.cyan(installationId)}\n`));

  // Step 8: Save private key
  if (!options.noSave) {
    console.log(chalk.gray(`Saving private key to ~/.github/faber-${org}.pem...`));

    let keyPath: string;
    try {
      keyPath = await savePrivateKey(conversionResponse.pem, org);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(chalk.red('\n❌ Error saving private key: ' + error.message + '\n'));
      } else {
        console.error(chalk.red('\n❌ Unknown error saving private key\n'));
      }
      console.log('You can manually save the private key to ~/.github/ directory.');
      process.exit(1);
    }

    console.log(chalk.green(`✓ Private key saved (permissions: 0600)\n`));

    // Step 9: Update configuration
    console.log(chalk.gray('Updating configuration...'));

    try {
      await updateConfig(configPath, {
        id: conversionResponse.id.toString(),
        installation_id: installationId,
        private_key_path: keyPath.replace(process.env.HOME || '', '~'),
        org,
        repo,
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(chalk.red('\n❌ Error updating config: ' + error.message + '\n'));
      } else {
        console.error(chalk.red('\n❌ Unknown error updating config\n'));
      }
      console.log('You can manually update .fractary/settings.json with:');
      console.log(
        JSON.stringify(
          {
            github: {
              organization: org,
              project: repo,
              app: {
                id: conversionResponse.id.toString(),
                installation_id: installationId,
                private_key_path: `~/.github/faber-${org}.pem`,
              },
            },
          },
          null,
          2
        )
      );
      process.exit(1);
    }

    console.log(chalk.green(`✓ Configuration saved to ${configPath}\n`));
  } else {
    // Display credentials without saving
    console.log(chalk.bold('\n📋 App Credentials:\n'));
    console.log(
      JSON.stringify(
        {
          app_id: conversionResponse.id,
          installation_id: installationId,
          app_slug: conversionResponse.slug,
          private_key: '[PEM key not shown]',
        },
        null,
        2
      )
    );
  }

  // Step 10: Success message
  console.log(chalk.bold('━'.repeat(60)));
  console.log(chalk.bold.green('✨ Setup Complete!'));
  console.log(chalk.bold('━'.repeat(60)));
  console.log();
  console.log('Test your configuration:');
  console.log(chalk.cyan('  fractary-faber work issue fetch 1'));
  console.log();
  console.log('View your app:');
  console.log(
    chalk.cyan(
      `  https://github.com/organizations/${org}/settings/apps/${conversionResponse.slug}`
    )
  );
  console.log();
}

/**
 * Check if configuration already exists
 */
async function checkExistingConfig(configPath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    return !!(config.github?.app);
  } catch {
    return false;
  }
}

/**
 * Update configuration file
 */
async function updateConfig(
  configPath: string,
  appConfig: {
    id: string;
    installation_id: string;
    private_key_path: string;
    org: string;
    repo: string;
  }
): Promise<void> {
  let config: any = {};

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(content);
  } catch {
    // File doesn't exist, start with empty config
  }

  // Update GitHub config
  config.github = config.github || {};
  config.github.organization = appConfig.org;
  config.github.project = appConfig.repo;
  config.github.app = {
    id: appConfig.id,
    installation_id: appConfig.installation_id,
    private_key_path: appConfig.private_key_path,
    created_via: 'manifest-flow',
    created_at: new Date().toISOString(),
  };

  // Ensure directory exists
  const lastSlash = configPath.lastIndexOf('/');
  if (lastSlash > 0) {
    const dir = configPath.substring(0, lastSlash);
    await fs.mkdir(dir, { recursive: true });
  }

  // Write config
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
}

/**
 * Create the main auth command
 */
export function createAuthCommand(): Command {
  const command = new Command('auth').description('Authentication management');

  command.addCommand(createAuthSetupCommand());

  return command;
}
