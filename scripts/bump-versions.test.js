#!/usr/bin/env node

/**
 * Unit tests for bump-versions.js
 *
 * Run: node scripts/bump-versions.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Import functions to test
const {
  bumpPatch,
  getMajorMinor,
  isValidSemver,
  checkSourceChanged,
  checkVersionBumped,
  VERSION_FILES,
  SOURCE_DIRS,
} = require('./bump-versions.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${e.message}`);
    failed++;
  }
}

function assertThrows(fn, expectedMessage) {
  let threw = false;
  let actualMessage = '';
  try {
    fn();
  } catch (e) {
    threw = true;
    actualMessage = e.message;
  }
  if (!threw) {
    throw new Error('Expected function to throw, but it did not');
  }
  if (expectedMessage && !actualMessage.includes(expectedMessage)) {
    throw new Error(`Expected error message to include "${expectedMessage}", got "${actualMessage}"`);
  }
}

// ============================================================================
// Tests for isValidSemver()
// ============================================================================

console.log('\nisValidSemver():');

test('valid semver 1.2.3', () => {
  assert.strictEqual(isValidSemver('1.2.3'), true);
});

test('valid semver 0.0.0', () => {
  assert.strictEqual(isValidSemver('0.0.0'), true);
});

test('valid semver 10.20.30', () => {
  assert.strictEqual(isValidSemver('10.20.30'), true);
});

test('invalid: only two parts', () => {
  assert.strictEqual(isValidSemver('1.2'), false);
});

test('invalid: four parts', () => {
  assert.strictEqual(isValidSemver('1.2.3.4'), false);
});

test('invalid: non-numeric', () => {
  assert.strictEqual(isValidSemver('1.2.x'), false);
});

test('invalid: negative number', () => {
  assert.strictEqual(isValidSemver('1.2.-1'), false);
});

test('invalid: leading zeros', () => {
  assert.strictEqual(isValidSemver('1.02.3'), false);
});

test('invalid: empty string', () => {
  assert.strictEqual(isValidSemver(''), false);
});

test('invalid: null', () => {
  assert.strictEqual(isValidSemver(null), false);
});

test('invalid: undefined', () => {
  assert.strictEqual(isValidSemver(undefined), false);
});

// ============================================================================
// Tests for bumpPatch()
// ============================================================================

console.log('\nbumpPatch():');

test('bump 1.2.3 to 1.2.4', () => {
  assert.strictEqual(bumpPatch('1.2.3'), '1.2.4');
});

test('bump 0.0.0 to 0.0.1', () => {
  assert.strictEqual(bumpPatch('0.0.0'), '0.0.1');
});

test('bump 1.0.9 to 1.0.10', () => {
  assert.strictEqual(bumpPatch('1.0.9'), '1.0.10');
});

test('bump 2.5.99 to 2.5.100', () => {
  assert.strictEqual(bumpPatch('2.5.99'), '2.5.100');
});

test('throws on invalid format (two parts)', () => {
  assertThrows(() => bumpPatch('1.2'), 'Invalid version format');
});

test('throws on invalid format (non-numeric)', () => {
  assertThrows(() => bumpPatch('1.2.x'), 'Invalid version format');
});

test('throws on invalid format (empty)', () => {
  assertThrows(() => bumpPatch(''), 'Invalid version format');
});

// ============================================================================
// Tests for getMajorMinor()
// ============================================================================

console.log('\ngetMajorMinor():');

test('get 1.2 from 1.2.3', () => {
  assert.strictEqual(getMajorMinor('1.2.3'), '1.2');
});

test('get 0.0 from 0.0.0', () => {
  assert.strictEqual(getMajorMinor('0.0.0'), '0.0');
});

test('get 10.20 from 10.20.30', () => {
  assert.strictEqual(getMajorMinor('10.20.30'), '10.20');
});

// ============================================================================
// Tests for checkSourceChanged()
// ============================================================================

console.log('\ncheckSourceChanged():');

test('detects SDK source change', () => {
  const changedFiles = ['sdk/js/src/index.ts', 'README.md'];
  assert.strictEqual(checkSourceChanged(changedFiles, 'sdk'), true);
});

test('detects CLI source change', () => {
  const changedFiles = ['cli/src/commands/run.ts'];
  assert.strictEqual(checkSourceChanged(changedFiles, 'cli'), true);
});

test('detects MCP source change', () => {
  const changedFiles = ['mcp/server/src/server.ts'];
  assert.strictEqual(checkSourceChanged(changedFiles, 'mcp'), true);
});

test('detects plugin-faber agents change', () => {
  const changedFiles = ['plugins/faber/agents/faber-manager.md'];
  assert.strictEqual(checkSourceChanged(changedFiles, 'plugin-faber'), true);
});

test('detects plugin-faber skills change', () => {
  const changedFiles = ['plugins/faber/skills/workflow/run.md'];
  assert.strictEqual(checkSourceChanged(changedFiles, 'plugin-faber'), true);
});

test('no change when only docs modified', () => {
  const changedFiles = ['docs/README.md', 'CHANGELOG.md'];
  assert.strictEqual(checkSourceChanged(changedFiles, 'sdk'), false);
});

test('no change for unknown component', () => {
  const changedFiles = ['sdk/js/src/index.ts'];
  assert.strictEqual(checkSourceChanged(changedFiles, 'unknown'), false);
});

test('handles empty changed files', () => {
  assert.strictEqual(checkSourceChanged([], 'sdk'), false);
});

// ============================================================================
// Tests for checkVersionBumped()
// ============================================================================

console.log('\ncheckVersionBumped():');

test('detects SDK version bump', () => {
  const changedFiles = ['sdk/js/package.json'];
  assert.strictEqual(checkVersionBumped(changedFiles, 'sdk'), true);
});

test('detects CLI version bump', () => {
  const changedFiles = ['cli/package.json'];
  assert.strictEqual(checkVersionBumped(changedFiles, 'cli'), true);
});

test('detects plugin-faber version bump', () => {
  const changedFiles = ['plugins/faber/.claude-plugin/plugin.json'];
  assert.strictEqual(checkVersionBumped(changedFiles, 'plugin-faber'), true);
});

test('no version bump when only source changed', () => {
  const changedFiles = ['sdk/js/src/index.ts'];
  assert.strictEqual(checkVersionBumped(changedFiles, 'sdk'), false);
});

// ============================================================================
// Tests for VERSION_FILES configuration
// ============================================================================

console.log('\nVERSION_FILES configuration:');

test('all version files exist', () => {
  for (const [component, versionFile] of Object.entries(VERSION_FILES)) {
    const exists = fs.existsSync(path.resolve(versionFile));
    if (!exists) {
      throw new Error(`Version file for ${component} not found: ${versionFile}`);
    }
  }
});

// ============================================================================
// Tests for SOURCE_DIRS configuration
// ============================================================================

console.log('\nSOURCE_DIRS configuration:');

test('SDK source directory exists', () => {
  const dir = SOURCE_DIRS.sdk[0];
  assert.strictEqual(fs.existsSync(path.resolve(dir)), true, `Directory not found: ${dir}`);
});

test('CLI source directory exists', () => {
  const dir = SOURCE_DIRS.cli[0];
  assert.strictEqual(fs.existsSync(path.resolve(dir)), true, `Directory not found: ${dir}`);
});

test('MCP source directory exists', () => {
  const dir = SOURCE_DIRS.mcp[0];
  assert.strictEqual(fs.existsSync(path.resolve(dir)), true, `Directory not found: ${dir}`);
});

// ============================================================================
// Script execution tests
// ============================================================================

console.log('\nScript execution:');

test('script runs with --check-only flag', () => {
  const { execSync } = require('child_process');
  // This should not throw - it either passes (exit 0) or finds issues (exit 1)
  try {
    execSync('node scripts/bump-versions.js --check-only 2>&1', { encoding: 'utf-8' });
  } catch (e) {
    // Exit code 1 is acceptable (means issues found), just check it ran
    if (!e.stdout && !e.stderr && !e.message.includes('exit')) {
      throw e;
    }
  }
});

test('script runs with --verbose flag', () => {
  const { execSync } = require('child_process');
  const output = execSync('node scripts/bump-versions.js --check-only --verbose 2>&1', {
    encoding: 'utf-8',
  });
  assert.strictEqual(output.includes('[DEBUG]'), true, 'Expected verbose output with [DEBUG] prefix');
});

// ============================================================================
// Summary
// ============================================================================

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
