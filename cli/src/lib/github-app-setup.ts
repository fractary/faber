/**
 * GitHub App Manifest Flow for Automated Setup
 *
 * Provides functions for creating GitHub Apps via the App Manifest flow,
 * which simplifies setup from 15+ manual steps to a single CLI command.
 */

import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Configuration for generating an app manifest
 */
export interface ManifestConfig {
  organization: string;
  repository: string;
  appName?: string;
}

/**
 * GitHub App Manifest structure
 * @see https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest
 */
export interface GitHubAppManifest {
  name: string;
  url: string;
  hook_attributes: {
    url: string;
  };
  redirect_url?: string;
  callback_urls?: string[];
  setup_url?: string;
  description: string;
  public: boolean;
  default_permissions: {
    contents: 'read' | 'write';
    issues: 'read' | 'write';
    pull_requests: 'read' | 'write';
    metadata: 'read';
  };
  default_events: string[];
}

/**
 * Response from GitHub App Manifest conversion API
 * @see https://docs.github.com/en/rest/apps/apps#create-a-github-app-from-a-manifest
 */
export interface ManifestConversionResponse {
  id: number;
  slug: string;
  node_id: string;
  owner: {
    login: string;
    id: number;
  };
  name: string;
  description: string;
  external_url: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  permissions: {
    contents?: string;
    issues?: string;
    metadata?: string;
    pull_requests?: string;
  };
  events: string[];
  installations_count: number;
  client_id: string;
  client_secret: string;
  webhook_secret: string | null;
  pem: string; // Private key in PEM format
}

/**
 * App credentials extracted from manifest conversion
 */
export interface AppCredentials {
  id: string;
  installation_id: string;
  private_key: string;
  app_slug: string;
  app_name: string;
}

/**
 * Installation response from GitHub API
 */
interface InstallationResponse {
  id: number;
  account: {
    login: string;
    id: number;
  };
  app_id: number;
  app_slug: string;
  target_id: number;
  target_type: string;
  permissions: Record<string, string>;
  events: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Generate GitHub App manifest with FABER's required permissions
 */
export function generateAppManifest(config: ManifestConfig): GitHubAppManifest {
  const appName = config.appName || `FABER CLI - ${config.organization}`;

  return {
    name: appName,
    url: 'https://github.com/fractary/faber',
    hook_attributes: {
      url: 'https://example.com/webhook', // Required but not used
    },
    redirect_url: 'https://example.com', // Required by GitHub for manifest flow
    description:
      'FABER CLI for automated workflow management, issue tracking, and repository operations.',
    public: false,
    default_permissions: {
      contents: 'write',
      issues: 'write',
      pull_requests: 'write',
      metadata: 'read',
    },
    default_events: [], // No webhook events needed
  };
}

/**
 * Generate HTML content for manifest submission
 *
 * The GitHub App Manifest flow requires POSTing a form to GitHub.
 * Since CLI cannot POST directly, we generate an HTML file that the user
 * opens in their browser and clicks to submit.
 *
 * @param manifest - The app manifest to submit
 * @param organization - GitHub organization name
 * @returns HTML content ready to save to file
 */
export function generateManifestHtml(
  manifest: GitHubAppManifest,
  organization: string
): string {
  const manifestJson = JSON.stringify(manifest, null, 2);
  const targetUrl = organization
    ? `https://github.com/organizations/${organization}/settings/apps/new`
    : 'https://github.com/settings/apps/new';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FABER CLI - Create GitHub App</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      background: #f6f8fa;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      margin-top: 0;
      color: #24292f;
    }
    .info {
      background: #dff6ff;
      border-left: 4px solid #0969da;
      padding: 12px 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    button {
      background: #2da44e;
      color: white;
      border: none;
      padding: 12px 24px;
      font-size: 16px;
      border-radius: 6px;
      cursor: pointer;
      width: 100%;
      margin-top: 20px;
    }
    button:hover {
      background: #2c974b;
    }
    .manifest {
      background: #f6f8fa;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      padding: 16px;
      margin: 16px 0;
      overflow-x: auto;
    }
    .manifest pre {
      margin: 0;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 12px;
    }
    .instructions {
      color: #57606a;
      margin: 16px 0;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Create FABER GitHub App</h1>

    <div class="info">
      <strong>Step 1 of 2:</strong> Click the button below to create your GitHub App
    </div>

    <div class="instructions">
      <p>This will create a GitHub App for <strong>${organization}</strong> with the following permissions:</p>
      <ul>
        <li>Contents: Write</li>
        <li>Issues: Write</li>
        <li>Pull Requests: Write</li>
        <li>Metadata: Read</li>
      </ul>
    </div>

    <details>
      <summary style="cursor: pointer; color: #0969da;">Show manifest JSON</summary>
      <div class="manifest">
        <pre>${manifestJson}</pre>
      </div>
    </details>

    <form action="${targetUrl}" method="post" id="manifestForm">
      <input type="hidden" name="manifest" value='${manifestJson.replace(/'/g, '&#39;')}'>
      <button type="submit">Create GitHub App →</button>
    </form>

    <div class="instructions" style="margin-top: 20px; font-size: 14px;">
      <p><strong>What happens next:</strong></p>
      <ol>
        <li>GitHub will show you the app details for review</li>
        <li>Click "Create GitHub App" to confirm</li>
        <li>GitHub will redirect you to a URL with a code</li>
        <li>Copy the code and paste it into the CLI</li>
      </ol>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Exchange manifest code for app credentials
 *
 * @param code - The code from the GitHub redirect URL
 * @returns App credentials from GitHub
 * @throws Error if code is invalid or API request fails
 */
export async function exchangeCodeForCredentials(
  code: string
): Promise<ManifestConversionResponse> {
  const url = `https://api.github.com/app-manifests/${code}/conversions`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to connect to GitHub API: ${error.message}`);
    }
    throw error;
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');

    if (response.status === 404) {
      throw new Error(
        'Invalid or expired code. The code may have already been used or is not valid. ' +
          'Please run "fractary-faber auth setup" again to generate a new URL.'
      );
    }

    if (response.status === 422) {
      throw new Error(
        'Invalid code format. The code should be from the GitHub redirect URL after creating the app.'
      );
    }

    throw new Error(`Failed to exchange code for credentials: ${response.status} ${errorBody}`);
  }

  return (await response.json()) as ManifestConversionResponse;
}

/**
 * Validate app credentials from manifest conversion
 *
 * @param response - The manifest conversion response
 * @throws Error if response is invalid
 */
export function validateAppCredentials(response: ManifestConversionResponse): void {
  if (!response.id) {
    throw new Error('Invalid response: missing app ID');
  }

  if (!response.pem) {
    throw new Error('Invalid response: missing private key');
  }

  // Validate PEM format
  const trimmed = response.pem.trim();
  const isValidPEM =
    (trimmed.startsWith('-----BEGIN RSA PRIVATE KEY-----') &&
      trimmed.endsWith('-----END RSA PRIVATE KEY-----')) ||
    (trimmed.startsWith('-----BEGIN PRIVATE KEY-----') &&
      trimmed.endsWith('-----END PRIVATE KEY-----'));

  if (!isValidPEM) {
    throw new Error('Invalid response: private key is not in PEM format');
  }
}

/**
 * Fetch installation ID for the app in the specified organization
 *
 * @param appId - The GitHub App ID
 * @param privateKey - The app's private key in PEM format
 * @param organization - The GitHub organization name
 * @returns The installation ID
 * @throws Error if installation not found or authentication fails
 */
export async function getInstallationId(
  appId: string,
  privateKey: string,
  organization: string
): Promise<string> {
  // Generate JWT for app authentication
  const jwtToken = generateJWT(appId, privateKey);

  // Fetch installation for organization
  const url = `https://api.github.com/orgs/${organization}/installation`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${jwtToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to connect to GitHub API: ${error.message}`);
    }
    throw error;
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');

    if (response.status === 404) {
      throw new Error(
        `GitHub App not installed on organization "${organization}". ` +
          `Please install the app on at least one repository in the organization. ` +
          `Visit the app settings to install it.`
      );
    }

    if (response.status === 401) {
      throw new Error(
        'Failed to authenticate with GitHub App. This should not happen with a newly created app. ' +
          'Please try running the setup command again.'
      );
    }

    throw new Error(
      `Failed to fetch installation ID: ${response.status} ${errorBody}`
    );
  }

  const installation = (await response.json()) as InstallationResponse;
  return installation.id.toString();
}

/**
 * Generate a JWT for GitHub App authentication
 *
 * @param appId - The GitHub App ID
 * @param privateKey - The app's private key in PEM format
 * @returns JWT token
 */
function generateJWT(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60, // Issued 60 seconds ago to allow for clock drift
    exp: now + 600, // Expires in 10 minutes (GitHub max)
    iss: appId,
  };

  try {
    return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate JWT: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Save private key to secure location
 *
 * @param privateKey - The private key content
 * @param organization - The organization name (for filename)
 * @returns Path to the saved private key file
 * @throws Error if file cannot be saved
 */
export async function savePrivateKey(
  privateKey: string,
  organization: string
): Promise<string> {
  const homeDir = os.homedir();
  const githubDir = path.join(homeDir, '.github');

  // Ensure .github directory exists with restricted permissions
  try {
    await fs.mkdir(githubDir, { recursive: true, mode: 0o700 });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create .github directory: ${error.message}`);
    }
    throw error;
  }

  // Generate key filename
  const keyFileName = `faber-${organization}.pem`;
  const keyPath = path.join(githubDir, keyFileName);

  // Save private key with restricted permissions
  try {
    await fs.writeFile(keyPath, privateKey, { mode: 0o600 });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to write private key file: ${error.message}`);
    }
    throw error;
  }

  // Verify file was created with correct permissions (Unix only)
  try {
    const stats = await fs.stat(keyPath);
    const mode = stats.mode & 0o777;

    if (process.platform !== 'win32' && mode !== 0o600) {
      console.warn(
        `Warning: Private key file permissions are ${mode.toString(8)}, ` +
          `expected 0600. Please restrict access with: chmod 600 ${keyPath}`
      );
    }
  } catch {
    // Ignore stat errors
  }

  return keyPath;
}

/**
 * Format permissions for display
 *
 * @param manifest - The app manifest
 * @returns Formatted permissions string
 */
export function formatPermissionsDisplay(manifest: GitHubAppManifest): string {
  const perms = manifest.default_permissions;
  return Object.entries(perms)
    .map(([key, value]) => {
      const name = key
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      const level = value.charAt(0).toUpperCase() + value.slice(1);
      return `  • ${name}: ${level}`;
    })
    .join('\n');
}
