---
id: KB-dep-001
title: TypeScript module resolution failure
category: missing_dependency
severity: medium
symptoms:
  - "Cannot find module"
  - "TS2307: Cannot find module"
  - "Module not found"
agents:
  - software-engineer
  - architect
phases:
  - build
  - evaluate
context_type: agent
tags:
  - typescript
  - imports
  - dependencies
created: 2026-01-28
verified: true
success_count: 15
---

# TypeScript Module Resolution Failure

## Symptoms

The build phase fails with TypeScript module resolution errors:
- `Cannot find module 'package-name'`
- `TS2307: Cannot find module 'package-name' or its corresponding type declarations`
- `Module '"./path"' has no exported member 'Name'`

## Root Cause

Module resolution fails due to:
- Package not installed in node_modules
- Incorrect import path (relative vs absolute)
- Missing TypeScript path mappings in tsconfig.json
- Package missing from dependencies in package.json
- Type definitions not installed (@types/package)

## Solution

Diagnose and fix the module resolution issue.

### Actions

1. Identify the missing module from the error message

2. Check if the package is installed:
   ```bash
   npm ls <package-name>
   ```

3. If missing, install the package:
   ```bash
   npm install <package-name>
   ```

4. For type definitions, also install:
   ```bash
   npm install -D @types/<package-name>
   ```

5. Verify the import path is correct:
   - Relative imports: `./path/to/file`
   - Absolute imports with path alias: `@/path/to/file`

6. Check tsconfig.json for path mappings if using aliases:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```

7. Re-run the build:
   ```bash
   npm run build
   ```

## Prevention

- Use `npm ci` in CI environments for consistent dependencies
- Configure path aliases in tsconfig.json for cleaner imports
- Add pre-commit hooks to verify imports resolve correctly
- Keep package.json and package-lock.json in sync
