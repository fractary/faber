/**
 * Authentication setup command
 */

import { Command } from 'commander';
import * as readline from 'readline/promises';
import chalk from 'chalk';
import fs from 'fs/promises';
import {
  generateAppManifest,
  generateManifestHtml,
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
import { loadYamlConfig, writeYamlConfig, getConfigPath } from '../../lib/yaml-config.js';
import type { UnifiedConfig } from '../../types/config.js';

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
      '.fractary/config.yaml'
    )
    .option('--show-manifest', 'Display manifest JSON before setup')
    .option('--no-save', 'Display credentials without saving')
    .action(async (options: SetupOptions) => {
      await runSetup(options);
    });
}

/**
 * Manual configuration for existing GitHub App
 */
async function manualAppConfiguration(
  configPath: string,
  org: string,
  repo: string
): Promise<void> {
  const os = await import('os');
  const path = await import('path');

  console.log(chalk.bold('━'.repeat(60)));
  console.log(chalk.bold('📋 Manual GitHub App Configuration'));
  console.log(chalk.bold('━'.repeat(60)));
  console.log();

  console.log('You will need the following information from your GitHub App:');
  console.log('  • App ID (from app settings page)');
  console.log('  • Installation ID (from installations page URL)');
  console.log('  • Private key file (.pem)\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const appIdInput = await rl.question('App ID: ');
  const installationIdInput = await rl.question('Installation ID: ');
  const privateKeyPath = await rl.question('Private key path (e.g., ~/.github/faber-app.pem): ');
  rl.close();

  if (!appIdInput || !installationIdInput || !privateKeyPath) {
    console.error(chalk.red('\n❌ All fields are required\n'));
    process.exit(1);
  }

  // Validate App ID is a positive integer
  const appId = parseInt(appIdInput, 10);
  if (isNaN(appId) || appId <= 0) {
    console.error(chalk.red('\n❌ App ID must be a positive integer\n'));
    process.exit(1);
  }

  // Validate Installation ID is a positive integer
  const installationId = parseInt(installationIdInput, 10);
  if (isNaN(installationId) || installationId <= 0) {
    console.error(chalk.red('\n❌ Installation ID must be a positive integer\n'));
    process.exit(1);
  }

  // Expand tilde in path
  const expandedKeyPath = privateKeyPath.replace(/^~/, os.homedir());

  // Verify private key exists
  try {
    await fs.access(expandedKeyPath);
  } catch (error) {
    console.error(chalk.red(`\n❌ Private key file not found: ${expandedKeyPath}\n`));
    process.exit(1);
  }

  // Load existing config or create new one
  let config: UnifiedConfig = loadYamlConfig() || {
    version: '2.0',
  };

  // Update GitHub config at top level
  config.github = config.github || {};
  config.github.organization = org;
  config.github.project = repo;
  config.github.app = {
    id: appId.toString(),
    installation_id: installationId.toString(),
    private_key_path: privateKeyPath,
    created_via: 'manual',
    created_at: new Date().toISOString(),
  };

  // Write config as YAML
  writeYamlConfig(config);

  console.log(chalk.green(`\n✓ Configuration saved to ${getConfigPath()}\n`));
  console.log('Test the configuration with:');
  console.log(chalk.cyan(`  fractary-faber work issue fetch 1\n`));
}

/**
 * Run the setup flow
 */
async function runSetup(options: SetupOptions): Promise<void> {
  // Force output to flush immediately
  process.stdout.write('\n🔐 GitHub App Authentication Setup\n\n');
  process.stdout.write('Initializing...\n');

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
  const configPath = options.configPath || getConfigPath();
  const existingConfig = await checkExistingConfig();

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

  // Ask user if they want to create new or configure existing app
  const rl0 = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(chalk.bold('Choose setup method:'));
  console.log('  1. Create a new GitHub App (guided)');
  console.log('  2. Configure an existing GitHub App (manual)\n');

  const method = (await rl0.question('Enter 1 or 2: ')).trim();
  rl0.close();
  console.log();

  if (method === '2') {
    // Manual configuration for existing app
    await manualAppConfiguration(configPath, org, repo);
    return;
  }

  // Step 3: Generate manifest
  const manifest = generateAppManifest({ organization: org, repository: repo });

  if (options.showManifest) {
    console.log(chalk.bold('\n📋 App Manifest:\n'));
    console.log(JSON.stringify(manifest, null, 2));
    console.log();
  }

  // Step 4: Generate and open manifest HTML
  console.log(chalk.bold('━'.repeat(60)));
  console.log(chalk.bold('📋 STEP 1: Create the GitHub App'));
  console.log(chalk.bold('━'.repeat(60)));
  console.log();

  const htmlContent = generateManifestHtml(manifest, org);
  const os = await import('os');
  const path = await import('path');

  // Detect WSL and use Windows-accessible temp directory
  let tmpDir = os.tmpdir();
  const isWsl = process.platform === 'linux' && os.release().toLowerCase().includes('microsoft');

  if (isWsl) {
    // Use current working directory for WSL (it's usually in /mnt/c which is Windows-accessible)
    tmpDir = process.cwd();
  }

  const htmlPath = path.join(tmpDir, `faber-github-app-${Date.now()}.html`);

  try {
    await fs.writeFile(htmlPath, htmlContent, 'utf-8');
    console.log(chalk.gray(`✓ Generated manifest form\n`));
  } catch (error) {
    console.error(chalk.red('Failed to create manifest file'));
    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    }
    process.exit(1);
  }

  // Convert WSL path to Windows path if needed
  let displayPath = htmlPath;
  if (isWsl && htmlPath.startsWith('/mnt/')) {
    // Convert /mnt/c/... to C:\...
    const match = htmlPath.match(/^\/mnt\/([a-z])(\/.*)/);
    if (match) {
      const driveLetter = match[1].toUpperCase();
      const windowsPath = match[2].replace(/\//g, '\\');
      displayPath = `${driveLetter}:${windowsPath}`;
    }
  }

  console.log(chalk.bold('📄 Manifest file created!\n'));
  console.log(chalk.cyan('Open this file in your browser (copy the full path):\n'));
  console.log(chalk.bold(`  ${displayPath}\n`));

  if (isWsl) {
    console.log(chalk.gray('💡 Tip: From Windows, you can also open it with:'));
    console.log(chalk.gray(`   - Press Win+R, paste the path above, press Enter`));
    console.log(chalk.gray(`   - Or open File Explorer and paste the path\n`));
  }

  // Try to open automatically, but don't block if it fails
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  try {
    if (process.platform === 'darwin') {
      await execFileAsync('open', [htmlPath]);
      console.log(chalk.gray('(Opened in default browser)\n'));
    } else if (process.platform === 'win32') {
      await execFileAsync('cmd', ['/c', 'start', '', htmlPath]);
      console.log(chalk.gray('(Opened in default browser)\n'));
    } else if (!isWsl) {
      // Only try xdg-open on native Linux, not WSL
      await execFileAsync('xdg-open', [htmlPath]);
      console.log(chalk.gray('(Opened in default browser)\n'));
    }
  } catch (error) {
    // Silently fail - we already printed the path above
  }

  console.log(chalk.bold('In your browser:'));
  console.log('  1. Review the app permissions');
  console.log('  2. Click the green "Create GitHub App →" button');
  console.log('  3. GitHub will ask you to confirm - click "Create GitHub App" again');
  console.log('  4. After creation, GitHub will redirect to example.com');
  console.log(chalk.yellow('     (This is expected! The code you need will be in the URL)\n'));

  const rl1 = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await rl1.question('Press Enter after you have clicked the Create button in your browser...');
  rl1.close();

  // Step 5: Prompt for code
  console.log();
  console.log(chalk.bold('━'.repeat(60)));
  console.log(chalk.bold('📋 STEP 2: Copy the code from the redirect URL'));
  console.log(chalk.bold('━'.repeat(60)));
  console.log();
  console.log('After creating the app, GitHub will redirect to example.com');
  console.log(chalk.yellow('(Don\'t worry - example.com is just a placeholder!)'));
  console.log();
  console.log('The URL will look like:');
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
    // App created but not installed yet - guide user through installation
    console.log(chalk.yellow('\n⚠️  App created but not yet installed on your organization\n'));

    console.log(chalk.bold('━'.repeat(60)));
    console.log(chalk.bold('📋 STEP 3: Install the App on Your Organization'));
    console.log(chalk.bold('━'.repeat(60)));
    console.log();

    const installUrl = `https://github.com/apps/${conversionResponse.slug}/installations/new`;
    console.log('The app needs to be installed on your GitHub organization/repositories.');
    console.log('Opening installation page in your browser...\n');

    // Convert to Windows path if WSL
    const os = await import('os');
    const isWsl = process.platform === 'linux' && os.release().toLowerCase().includes('microsoft');

    // Try to open installation URL
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    console.log(chalk.cyan(`Installation URL: ${installUrl}\n`));

    try {
      if (process.platform === 'darwin') {
        await execFileAsync('open', [installUrl]);
      } else if (process.platform === 'win32') {
        await execFileAsync('cmd', ['/c', 'start', '', installUrl]);
      } else if (!isWsl) {
        await execFileAsync('xdg-open', [installUrl]);
      } else {
        // WSL - can't auto-open, show instructions
        console.log(chalk.yellow('💡 Copy the URL above and open it in your Windows browser\n'));
      }
    } catch (openError) {
      console.log(chalk.yellow('💡 Copy the URL above and open it in your browser\n'));
    }

    console.log('In your browser:');
    console.log('  1. Select which repositories to give access to:');
    console.log('     - "All repositories" (easiest) OR');
    console.log(`     - "Only select repositories" → choose "${repo}"`);
    console.log('  2. Click the green "Install" button\n');

    const rl2 = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    await rl2.question('Press Enter after you have installed the app...');
    rl2.close();

    // Try fetching installation ID again
    console.log(chalk.gray('\nVerifying installation...'));

    try {
      installationId = await getInstallationId(
        conversionResponse.id.toString(),
        conversionResponse.pem,
        org
      );
      console.log(chalk.green(`✓ Installation verified! Installation ID: ${chalk.cyan(installationId)}\n`));
    } catch (retryError) {
      console.error(chalk.red('\n❌ Still unable to find installation.\n'));
      console.log('Please ensure you:');
      console.log('  1. Clicked "Install" on the installation page');
      console.log('  2. Selected at least one repository');
      console.log(`  3. Installed on the "${org}" organization\n`);
      console.log(`Visit: ${chalk.cyan(installUrl)}`);
      console.log('\nAfter installing, run this command again to complete setup.\n');
      process.exit(1);
    }
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
      console.log('You can manually update .fractary/config.yaml with:');
      console.log(chalk.cyan(`
version: "2.0"
github:
  organization: ${org}
  project: ${repo}
  app:
    id: "${conversionResponse.id}"
    installation_id: "${installationId}"
    private_key_path: ~/.github/faber-${org}.pem
`));
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
async function checkExistingConfig(): Promise<boolean> {
  try {
    const config = loadYamlConfig();
    return !!(config?.github?.app);
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
  // Load existing config or create new one
  let config: UnifiedConfig = loadYamlConfig() || {
    version: '2.0',
  };

  // Update GitHub config at top level
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

  // Write config as YAML
  writeYamlConfig(config);
}

/**
 * Create the main auth command
 */
export function createAuthCommand(): Command {
  const command = new Command('auth').description('Authentication management');

  command.addCommand(createAuthSetupCommand());

  return command;
}
