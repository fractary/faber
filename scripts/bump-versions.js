#!/usr/bin/env node

/**
 * FABER Version Bump Script
 *
 * Automatically bumps component versions when source files change.
 * Used by the Husky pre-commit hook to ensure versions stay in sync.
 *
 * Usage:
 *   node scripts/bump-versions.js           # Bump versions based on branch diff
 *   node scripts/bump-versions.js --staged  # Bump versions based on staged files (for pre-commit)
 *   node scripts/bump-versions.js --check-only  # Check only, don't modify (for CI)
 *   node scripts/bump-versions.js --verbose # Show detailed output
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// CONFIGURATION - Customize for your project
// ============================================================================

// Version file locations
const VERSION_FILES = {
  sdk: 'sdk/js/package.json',
  cli: 'cli/package.json',
  mcp: 'mcp/server/package.json',
  'plugin-faber': 'plugins/faber/.claude-plugin/plugin.json',
  'plugin-article': 'plugins/faber-article/.claude-plugin/plugin.json',
  'plugin-cloud': 'plugins/faber-cloud/.claude-plugin/plugin.json',
};

// Source directories that trigger version bumps
const SOURCE_DIRS = {
  sdk: ['sdk/js/src/'],
  cli: ['cli/src/'],
  mcp: ['mcp/server/src/'],
  'plugin-faber': [
    'plugins/faber/agents/',
    'plugins/faber/commands/',
    'plugins/faber/skills/',
    'plugins/faber/config/',
    'plugins/faber/gateway/',
    'plugins/faber/presets/',
    'plugins/faber/schemas/',
    'plugins/faber/templates/',
  ],
  'plugin-article': [
    'plugins/faber-article/agents/',
    'plugins/faber-article/commands/',
    'plugins/faber-article/skills/',
  ],
  'plugin-cloud': [
    'plugins/faber-cloud/agents/',
    'plugins/faber-cloud/commands/',
    'plugins/faber-cloud/skills/',
    'plugins/faber-cloud/config/',
    'plugins/faber-cloud/templates/',
    'plugins/faber-cloud/scripts/',
  ],
};

// Hardcoded version locations that need to be synced
// Format: { component: [{ file, pattern }] }
const HARDCODED_VERSIONS = {
  cli: [
    {
      file: 'cli/src/index.ts',
      pattern: /const version = '(\d+\.\d+\.\d+)';/,
      replacement: (v) => `const version = '${v}';`,
    },
  ],
  mcp: [
    {
      file: 'mcp/server/src/index.ts',
      pattern: /export const version = '(\d+\.\d+\.\d+)';/,
      replacement: (v) => `export const version = '${v}';`,
    },
    {
      file: 'mcp/server/src/server.ts',
      pattern: /version: '(\d+\.\d+\.\d+)',/,
      replacement: (v) => `version: '${v}',`,
    },
  ],
};

// Dependencies to update when SDK version changes
const SDK_DEPENDENTS = ['cli', 'mcp'];

// ============================================================================
// CLI FLAGS
// ============================================================================

const checkOnly = process.argv.includes('--check-only');
const stagedOnly = process.argv.includes('--staged');
const verbose = process.argv.includes('--verbose');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function log(msg) {
  if (verbose || !checkOnly) console.log(msg);
}

function debug(msg) {
  if (verbose) console.log(`[DEBUG] ${msg}`);
}

/**
 * Get the repository root directory
 */
function getRepoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch (e) {
    return path.resolve('.');
  }
}

/**
 * Validate that a file path is within the repository
 */
function isValidRepoPath(filePath) {
  const repoRoot = getRepoRoot();
  const resolved = path.resolve(filePath);
  return resolved.startsWith(repoRoot);
}

/**
 * Get list of changed files
 */
function getChangedFiles() {
  if (stagedOnly) {
    debug('Getting staged files...');
    try {
      const result = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
      return result.trim().split('\n').filter(Boolean).filter(isValidRepoPath);
    } catch (e) {
      debug(`Error getting staged files: ${e.message}`);
      return [];
    }
  }

  // Try origin/main first
  debug('Getting files changed vs origin/main...');
  try {
    const result = execSync('git diff --name-only origin/main...HEAD', { encoding: 'utf-8' });
    return result.trim().split('\n').filter(Boolean).filter(isValidRepoPath);
  } catch (e) {
    debug(`origin/main not available: ${e.message}`);
  }

  // Fallback to local main branch
  debug('Trying local main branch...');
  try {
    const result = execSync('git diff --name-only main...HEAD', { encoding: 'utf-8' });
    return result.trim().split('\n').filter(Boolean).filter(isValidRepoPath);
  } catch (e) {
    debug(`main branch not available: ${e.message}`);
  }

  // Final fallback to staged files
  debug('Falling back to staged files...');
  try {
    const result = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
    return result.trim().split('\n').filter(Boolean).filter(isValidRepoPath);
  } catch (e) {
    debug(`Error getting staged files: ${e.message}`);
    return [];
  }
}

/**
 * Read JSON file with validation
 */
function readJson(filePath) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  try {
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    if (!data || typeof data !== 'object') {
      throw new Error(`Invalid JSON structure in ${filePath}: expected object`);
    }
    if (typeof data.version !== 'string') {
      throw new Error(`Missing or invalid 'version' field in ${filePath}`);
    }
    return data;
  } catch (e) {
    if (e.message.includes('Invalid JSON') || e.message.includes('Missing or invalid')) {
      throw e;
    }
    throw new Error(`Failed to parse JSON in ${filePath}: ${e.message}`);
  }
}

/**
 * Write JSON file
 */
function writeJson(filePath, data) {
  const fullPath = path.resolve(filePath);
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Read text file
 */
function readText(filePath) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * Write text file
 */
function writeText(filePath, content) {
  const fullPath = path.resolve(filePath);
  fs.writeFileSync(fullPath, content);
}

/**
 * Validate semver format
 */
function isValidSemver(version) {
  if (typeof version !== 'string') return false;
  const parts = version.split('.');
  if (parts.length !== 3) return false;
  return parts.every((part) => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && String(num) === part;
  });
}

/**
 * Bump patch version: 1.2.3 -> 1.2.4
 */
function bumpPatch(version) {
  if (!isValidSemver(version)) {
    throw new Error(`Invalid version format: ${version} (expected X.Y.Z where X, Y, Z are non-negative integers)`);
  }
  const parts = version.split('.');
  const patch = parseInt(parts[2], 10);
  parts[2] = String(patch + 1);
  return parts.join('.');
}

/**
 * Get major.minor from version: 1.2.3 -> 1.2
 */
function getMajorMinor(version) {
  return version.split('.').slice(0, 2).join('.');
}

/**
 * Check if source files changed for a component
 */
function checkSourceChanged(changedFiles, component) {
  const dirs = SOURCE_DIRS[component];
  if (!dirs) return false;
  return changedFiles.some((file) => dirs.some((dir) => file.startsWith(dir)));
}

/**
 * Check if version file was modified
 */
function checkVersionBumped(changedFiles, component) {
  const versionFile = VERSION_FILES[component];
  return changedFiles.includes(versionFile);
}

/**
 * Sync hardcoded versions in source files
 */
function syncHardcodedVersions(component, newVersion) {
  const locations = HARDCODED_VERSIONS[component];
  if (!locations) return [];

  const synced = [];
  for (const loc of locations) {
    const content = readText(loc.file);
    const matches = content.match(new RegExp(loc.pattern.source, 'g'));

    // Safety check: verify exactly one occurrence
    if (!matches) {
      debug(`No match found for pattern in ${loc.file}`);
      continue;
    }
    if (matches.length > 1) {
      throw new Error(
        `Multiple matches (${matches.length}) found for version pattern in ${loc.file}. ` +
          'Please update the pattern to be more specific.'
      );
    }

    const match = content.match(loc.pattern);
    if (match && match[1] !== newVersion) {
      const updated = content.replace(loc.pattern, loc.replacement(newVersion));
      writeText(loc.file, updated);
      synced.push(loc.file);
    }
  }
  return synced;
}

/**
 * Check hardcoded versions match package version
 */
function checkHardcodedVersions(component, expectedVersion) {
  const locations = HARDCODED_VERSIONS[component];
  if (!locations) return [];

  const mismatches = [];
  for (const loc of locations) {
    const content = readText(loc.file);
    const match = content.match(loc.pattern);
    if (match && match[1] !== expectedVersion) {
      mismatches.push({ file: loc.file, found: match[1], expected: expectedVersion });
    }
  }
  return mismatches;
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function main() {
  const changedFiles = getChangedFiles();
  debug(`Changed files (${changedFiles.length}): ${changedFiles.join(', ')}`);

  if (changedFiles.length === 0) {
    log('No changed files detected');
    return;
  }

  const updates = [];
  const errors = [];
  const syncedFiles = [];

  // Track which components were bumped
  const bumpedComponents = new Set();

  // Check each component for version bumps
  for (const [component, dirs] of Object.entries(SOURCE_DIRS)) {
    const sourceChanged = checkSourceChanged(changedFiles, component);
    const versionBumped = checkVersionBumped(changedFiles, component);

    debug(`${component}: sourceChanged=${sourceChanged}, versionBumped=${versionBumped}`);

    if (sourceChanged && !versionBumped) {
      const versionFile = VERSION_FILES[component];
      if (!fs.existsSync(versionFile)) {
        debug(`Version file not found: ${versionFile}`);
        continue;
      }

      const pkg = readJson(versionFile);
      const oldVersion = pkg.version;
      const newVersion = bumpPatch(oldVersion);

      if (checkOnly) {
        errors.push(`${component}: source changed but version not bumped (${oldVersion})`);
      } else {
        pkg.version = newVersion;
        writeJson(versionFile, pkg);
        updates.push(`${component}: ${oldVersion} -> ${newVersion}`);
        bumpedComponents.add(component);

        // Sync hardcoded versions
        const synced = syncHardcodedVersions(component, newVersion);
        syncedFiles.push(...synced);
      }
    } else if (versionBumped) {
      // Version was already bumped, just sync hardcoded versions
      const versionFile = VERSION_FILES[component];
      const pkg = readJson(versionFile);
      const synced = syncHardcodedVersions(component, pkg.version);
      if (synced.length > 0) {
        syncedFiles.push(...synced);
        if (!checkOnly) {
          updates.push(`${component}: synced hardcoded versions to ${pkg.version}`);
        }
      }
    }
  }

  // Check for hardcoded version mismatches in check-only mode
  if (checkOnly) {
    for (const [component, locations] of Object.entries(HARDCODED_VERSIONS)) {
      const versionFile = VERSION_FILES[component];
      if (!fs.existsSync(versionFile)) continue;

      const pkg = readJson(versionFile);
      const mismatches = checkHardcodedVersions(component, pkg.version);
      for (const m of mismatches) {
        errors.push(`${component}: hardcoded version mismatch in ${m.file} (found ${m.found}, expected ${m.expected})`);
      }
    }
  }

  // Update SDK dependency in CLI/MCP when SDK is bumped
  if (bumpedComponents.has('sdk')) {
    const sdkPkg = readJson(VERSION_FILES.sdk);
    const sdkVersion = sdkPkg.version;
    const sdkMajorMinor = getMajorMinor(sdkVersion);

    for (const dependent of SDK_DEPENDENTS) {
      const versionFile = VERSION_FILES[dependent];
      if (!fs.existsSync(versionFile)) continue;

      const pkg = readJson(versionFile);
      const currentDep = pkg.dependencies?.['@fractary/faber'];

      if (currentDep && !currentDep.includes('*')) {
        // Update to ^major.minor.0 - we use .0 instead of the exact patch version
        // because the caret (^) range allows any patch version >= 0, and using .0
        // makes it clear this is a minimum version requirement for the major.minor series.
        // This avoids unnecessary churn when only patch versions change.
        const newDep = `^${sdkMajorMinor}.0`;
        if (currentDep !== newDep) {
          if (checkOnly) {
            errors.push(`${dependent}: SDK dependency outdated (${currentDep} -> ${newDep})`);
          } else {
            pkg.dependencies['@fractary/faber'] = newDep;
            writeJson(versionFile, pkg);
            updates.push(`${dependent}: updated @fractary/faber dependency to ${newDep}`);
          }
        }
      }
    }
  }

  // Output results
  if (checkOnly) {
    if (errors.length > 0) {
      console.log('Version issues found:');
      errors.forEach((e) => console.log(`  - ${e}`));
      console.log('\nRun: node scripts/bump-versions.js');
      process.exit(1);
    } else {
      console.log('All versions are properly aligned');
      process.exit(0);
    }
  } else {
    if (updates.length > 0) {
      console.log('Updated versions:');
      updates.forEach((u) => console.log(`  ${u}`));
    }
    if (syncedFiles.length > 0) {
      console.log('Synced hardcoded versions in:');
      syncedFiles.forEach((f) => console.log(`  ${f}`));
    }
    if (updates.length === 0 && syncedFiles.length === 0) {
      console.log('No version updates needed');
    }
  }
}

// ============================================================================
// EXPORTS FOR TESTING
// ============================================================================

module.exports = {
  bumpPatch,
  getMajorMinor,
  isValidSemver,
  isValidRepoPath,
  checkSourceChanged,
  checkVersionBumped,
  syncHardcodedVersions,
  readJson,
  VERSION_FILES,
  SOURCE_DIRS,
  HARDCODED_VERSIONS,
  SDK_DEPENDENTS,
};

// ============================================================================
// RUN
// ============================================================================

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}
