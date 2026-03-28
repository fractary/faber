#!/usr/bin/env node
/**
 * copy-workflows.js — Prebuild script
 *
 * Copies the plugin's bundled workflow definitions from the repo into
 * sdk/js/workflows/ so they are included in the published npm package.
 * This mirrors the pattern used by @fractary/core for its doc/log templates.
 *
 * Source:  plugins/faber/.fractary/faber/workflows/   (repo root relative)
 * Dest:    sdk/js/workflows/                          (same level as src/ and dist/)
 *
 * At runtime, WorkflowResolver locates this directory via __dirname:
 *   dist/workflow/resolver.js  →  ../../workflows/  →  sdk/js/workflows/
 *   (published npm package)    →  ../../workflows/  →  @fractary/faber/workflows/
 *
 * Run automatically as the "prebuild" npm script.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { resolve, join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Repo root is 3 levels up from sdk/js/scripts/
const repoRoot = resolve(__dirname, '../../..');
const src = join(repoRoot, 'plugins', 'faber', '.fractary', 'faber', 'workflows');
const dest = join(__dirname, '..', 'workflows');

if (!existsSync(src)) {
  console.error(`Source workflows directory not found: ${src}`);
  process.exit(1);
}

// Clean destination first
if (existsSync(dest)) {
  rmSync(dest, { recursive: true });
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });

const files = readdirSync(dest).filter(f => f.endsWith('.json') || f.endsWith('.yaml'));
console.log(`Copied ${files.length} bundled workflow(s) → ${relative(process.cwd(), dest)}/`);
files.forEach(f => console.log(`  ${f}`));
