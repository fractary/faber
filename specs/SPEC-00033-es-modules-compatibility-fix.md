# SPEC-00033: ES Modules Compatibility Fix for @fractary/faber SDK and CLI

**Status**: Implementation
**Created**: 2026-01-07
**Author**: System
**Related**: SPEC-00031 (SDK integration)

## Overview

Fix ES modules compatibility in the @fractary/faber SDK by adding explicit `.js` extensions to all relative import statements. This resolves runtime module resolution errors and brings the SDK to the same standard as the CLI.

## Problem Statement

The `@fractary/faber-cli` fails at runtime with:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/path/to/sdk/dist/types'
```

**Root Cause**: SDK source files lack `.js` extensions on relative imports. While TypeScript auto-adds them during compilation, this creates:
- IDE/editor tooling issues
- Test runner compatibility problems
- Developer confusion (source doesn't match runtime)
- Future Node.js strict mode incompatibility

## Current State Analysis

### SDK (sdk/js)
- **Source files**: Missing `.js` extensions on ~110+ relative imports
- **Compiled dist**: Has `.js` extensions (TypeScript auto-adds)
- **Status**: INCONSISTENT - relies on compiler magic

### CLI (cli/src)
- **Source files**: Has explicit `.js` extensions on all relative imports
- **Compiled dist**: Has `.js` extensions (passed through)
- **Status**: CONSISTENT ✅

### Configuration
- **SDK tsconfig**: `"module": "Node16"`, `"moduleResolution": "node16"` (strict)
- **CLI tsconfig**: `"module": "ES2020"`, `"moduleResolution": "node"` (lenient)

## Scope of Work

### Files to Update
- **Total SDK files**: 42 TypeScript files
- **Files with relative imports**: 34 files (81%)
- **Total import statements**: ~110+ imports to update
- **Test files**: 6 test files

### Import Patterns to Fix

| Pattern | Count | Example | Transformation |
|---------|-------|---------|----------------|
| `from '../types'` | 20 | `import { FaberConfig } from '../types'` | → `'../types.js'` |
| `from './types'` | 16 | `import { SpecTemplate } from './types'` | → `'./types.js'` |
| `from '../errors'` | 10 | `import { ConfigError } from '../errors'` | → `'../errors.js'` |
| `from '../config'` | 8 | `import { loadConfig } from '../config'` | → `'../config.js'` |
| `from './work'` | 7 | `export * from './work'` | → `'./work/index.js'` |
| `from './manager'` | 5 | `import { Manager } from './manager'` | → `'./manager.js'` |

## Implementation Plan

### Phase 1: Update SDK Import Statements

#### 1.1 Simple Relative Imports
Add `.js` extension to file imports:
```typescript
// Before
import { FaberConfig } from './types';
import { ConfigError } from '../errors';

// After
import { FaberConfig } from './types.js';
import { ConfigError } from '../errors.js';
```

**Files affected**: 34 files with relative imports

#### 1.2 Directory Imports
Add `/index.js` to directory imports:
```typescript
// Before
export * from './work';
export * from './repo';

// After
export * from './work/index.js';
export * from './repo/index.js';
```

**Files affected**: 12 files with directory imports

#### 1.3 Test Files
Update all test file imports (6 files):
- `/sdk/js/src/__tests__/config.test.ts`
- `/sdk/js/src/config/__tests__/initializer.test.ts`
- `/sdk/js/src/spec/__tests__/manager.test.ts`
- `/sdk/js/src/workflow/__tests__/agent-executor.test.ts`
- `/sdk/js/src/__tests__/integration/*.test.ts` (2 files)

### Phase 2: Build and Validate

```bash
# Build SDK
npm run build --workspace=sdk/js

# Build CLI
npm run build --workspace=cli

# Link and test
npm link --workspace=cli
fractary-faber --version
fractary-faber --help
```

## Transformation Rules

### File Imports
```
'./types' → './types.js'
'../types' → '../types.js'
'../../types' → '../../types.js'
'./errors' → './errors.js'
'./config' → './config.js'
'./manager' → './manager.js'
```

### Directory Imports
```
'./work' → './work/index.js'
'./repo' → './repo/index.js'
'./spec' → './spec/index.js'
'./logs' → './logs/index.js'
'./state' → './state/index.js'
'./workflow' → './workflow/index.js'
'./storage' → './storage/index.js'
```

### Excluded Imports (No Changes)
- External packages: `from 'zod'`, `from 'chalk'`
- Node.js modules: `from 'fs'`, `from 'path'`
- JSON files: None found (read dynamically)

## Edge Cases

### Type-Only Imports
Still need `.js` extension:
```typescript
import type { FaberConfig } from './types.js';
```

### Re-Exports
Add `.js` to re-exports:
```typescript
export * from './types.js';
export { Manager } from './manager.js';
```

### Dynamic Imports
None found in codebase (all static imports)

## Critical Files (Priority Order)

1. `/sdk/js/src/index.ts` - Main entry point
2. `/sdk/js/src/config.ts` - Core configuration
3. `/sdk/js/src/work/manager.ts` - Work manager
4. `/sdk/js/src/repo/manager.ts` - Repository manager
5. `/sdk/js/src/spec/manager.ts` - Specification manager
6. Provider files in `work/providers/` and `repo/providers/`
7. All test files

## Success Criteria

- ✅ All 42 SDK source files have `.js` extensions on relative imports
- ✅ SDK builds without TypeScript errors
- ✅ CLI builds without errors
- ✅ `fractary-faber --version` runs successfully
- ✅ `fractary-faber --help` shows command structure
- ✅ No runtime module resolution errors
- ✅ Test suite passes

## Benefits

1. **Consistency**: SDK matches CLI pattern (explicit `.js` extensions)
2. **IDE Support**: Better editor tooling and error detection
3. **Test Compatibility**: Tests run correctly with strict ESM checking
4. **Future-Proof**: Prepares for Node.js strict ESM mode
5. **Developer Clarity**: Source code reflects actual runtime imports
6. **No Compiler Magic**: Explicit is better than implicit

## Testing Validation

After implementation:

```bash
# 1. Build packages
npm run build --workspace=sdk/js
npm run build --workspace=cli

# 2. Link CLI locally
npm link --workspace=cli

# 3. Test basic commands
fractary-faber --version
fractary-faber --help
fractary-faber plan --help

# 4. Test actual plan command (with real issue)
fractary-faber plan --work-id 258
```

## Related Documentation

- TypeScript ES Modules: https://www.typescriptlang.org/docs/handbook/esm-node.html
- Node.js ES Modules: https://nodejs.org/api/esm.html
- SPEC-00031: FABER CLI Core SDK Integration

## Notes

- This fix addresses a fundamental ES modules compatibility issue
- TypeScript's auto-transformation was masking the problem
- Explicit `.js` extensions are the Node.js ES modules best practice
- CLI already follows this pattern (implemented correctly from start)
- This brings SDK to same standard, ensuring consistency across the monorepo
