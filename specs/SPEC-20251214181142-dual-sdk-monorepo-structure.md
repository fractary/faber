---
spec_id: SPEC-20251214181142-dual-sdk-monorepo-structure
title: "Dual SDK Monorepo Structure for FABER"
type: infrastructure
status: draft
created: 2025-12-14
author: Claude (with human direction)
validated: false
depends_on:
  - SPEC-MIGRATION-001 (Forge Migration)
  - SPEC-FORGE-001 (Agent/Tool Definition System)
  - SPEC-FABER-002 (Forge Integration)
---

# Infrastructure Specification: Dual SDK Monorepo Structure for FABER

**Type**: Infrastructure
**Status**: Draft
**Created**: 2025-12-14
**Prerequisite**: Complete Forge migration (SPEC-MIGRATION-001)

## 1. Executive Summary

This specification defines the restructuring of the FABER project from a single flat repository into a **monorepo** with parallel `packages/js` and `packages/python` directories. This reorganization enables:

1. **Clear separation** between JavaScript and Python SDKs
2. **Independent versioning** for each package
3. **Shared resources** (specs, docs) at root level
4. **Cleaner CI/CD pipelines** per package
5. **Better developer experience** for consumers of either SDK

### 1.1 Timing

This restructuring should occur **AFTER** the Forge migration (SPEC-MIGRATION-001) is complete. The migration will:
- Remove `/python/faber/definitions/` (moves to Forge)
- Remove `/python/faber/agents/` (moves to Forge as YAML)
- Simplify what needs to be moved into the new structure

### 1.2 Scope Exclusions

Per user direction, this spec does **NOT** cover:
- Agent/tool creation features (moving to Forge)
- LangGraph workflow definitions (moving to Forge)
- Agent definitions (moving to Forge)

## 2. Current State Analysis

### 2.1 Existing Structure

```
/mnt/c/GitHub/fractary/faber/
├── src/                    # TypeScript SDK source
│   ├── config/            # Configuration management
│   ├── work/              # Issue tracking integration
│   ├── repo/              # Git operations
│   ├── spec/              # Specification management
│   ├── logs/              # Log management
│   ├── state/             # Workflow state
│   ├── workflow/          # FABER orchestration
│   └── storage/           # Artifact storage
│
├── python/                 # Python framework
│   └── faber/
│       ├── api/           # Public workflow API
│       ├── workflows/     # LangGraph workflows
│       ├── agents/        # AI agents (MOVING TO FORGE)
│       ├── definitions/   # Registry (MOVING TO FORGE)
│       ├── tools/         # Tool definitions
│       ├── primitives/    # Core implementations
│       ├── checkpointing/ # State persistence
│       ├── observability/ # Monitoring
│       └── cost/          # Token tracking
│
├── dist/                   # Compiled JS output
├── specs/                  # Design documents
├── docs/                   # Documentation
├── package.json           # npm config
├── pyproject.toml         # Python config (in python/)
└── tsconfig.json          # TypeScript config
```

### 2.2 Current Relationships

| Component | JavaScript SDK | Python Framework |
|-----------|---------------|------------------|
| **Purpose** | Platform integration layer | AI workflow orchestration |
| **Package Name** | `@fractary/faber` | `faber` |
| **Registry** | npm | PyPI |
| **Primary Use** | CLI tools, Node.js apps | LangGraph-based AI workflows |
| **Shared Concepts** | FABER methodology, configuration | FABER methodology, configuration |

### 2.3 Post-Forge Migration State

After Forge migration completes, the following will be **removed**:
- `/python/faber/definitions/` (schemas, registry, factory, executor, converters)
- `/python/faber/agents/` (frame, architect, build, evaluate, release)

Remaining Python code:
- `/python/faber/api/` - Public workflow API
- `/python/faber/workflows/` - Workflow orchestration (consumes Forge)
- `/python/faber/tools/` - Tool definitions
- `/python/faber/primitives/` - Core implementations
- `/python/faber/checkpointing/` - State persistence
- `/python/faber/observability/` - Monitoring
- `/python/faber/cost/` - Token tracking

## 3. Target State

### 3.1 Proposed Monorepo Structure

```
faber/
├── package.json                    # Root monorepo config (workspaces)
├── pnpm-workspace.yaml            # pnpm workspace config (alternative)
│
├── packages/
│   ├── js/                        # JavaScript SDK
│   │   ├── package.json           # @fractary/faber
│   │   ├── tsconfig.json
│   │   ├── jest.config.js
│   │   ├── .eslintrc.js
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── config/
│   │   │   ├── work/
│   │   │   ├── repo/
│   │   │   ├── spec/
│   │   │   ├── logs/
│   │   │   ├── state/
│   │   │   ├── workflow/
│   │   │   └── storage/
│   │   ├── dist/
│   │   └── tests/
│   │
│   └── python/                    # Python SDK
│       ├── pyproject.toml         # faber
│       ├── pytest.ini
│       ├── mypy.ini
│       ├── faber/
│       │   ├── __init__.py
│       │   ├── api/
│       │   ├── workflows/
│       │   ├── tools/
│       │   ├── primitives/
│       │   ├── checkpointing/
│       │   ├── observability/
│       │   └── cost/
│       └── tests/
│
├── specs/                         # Shared specifications
├── docs/                          # Shared documentation
│
├── .github/
│   └── workflows/
│       ├── js-ci.yaml            # JS-specific CI
│       ├── python-ci.yaml        # Python-specific CI
│       └── release.yaml          # Unified release workflow
│
├── .gitignore
├── README.md                      # Root README
└── CONTRIBUTING.md
```

### 3.2 Package Details

#### JavaScript Package (`packages/js/`)

**package.json:**
```json
{
  "name": "@fractary/faber",
  "version": "2.0.0",
  "description": "FABER methodology SDK - platform integration layer",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./config": "./dist/config/index.js",
    "./work": "./dist/work/index.js",
    "./repo": "./dist/repo/index.js",
    "./spec": "./dist/spec/index.js",
    "./logs": "./dist/logs/index.js",
    "./state": "./dist/state/index.js",
    "./workflow": "./dist/workflow/index.js",
    "./storage": "./dist/storage/index.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "peerDependencies": {
    "@fractary/forge": "^1.0.0"
  }
}
```

#### Python Package (`packages/python/`)

**pyproject.toml:**
```toml
[project]
name = "faber"
version = "2.0.0"
description = "FABER methodology SDK - AI workflow orchestration"
requires-python = ">=3.10"
dependencies = [
    "langgraph>=0.2.0",
    "langchain>=0.3.0",
    "langchain-anthropic>=0.1.0",
    "pyyaml>=6.0",
    "httpx>=0.27.0",
    "pydantic>=2.0.0",
    "rich>=13.0.0"
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "mypy>=1.8.0",
    "ruff>=0.1.0"
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

### 3.3 Root Monorepo Configuration

**Root package.json:**
```json
{
  "name": "faber-monorepo",
  "private": true,
  "workspaces": [
    "packages/js"
  ],
  "scripts": {
    "build:js": "npm -w packages/js run build",
    "test:js": "npm -w packages/js run test",
    "lint:js": "npm -w packages/js run lint",
    "build:python": "cd packages/python && python -m build",
    "test:python": "cd packages/python && pytest",
    "lint:python": "cd packages/python && ruff check .",
    "build": "npm run build:js && npm run build:python",
    "test": "npm run test:js && npm run test:python"
  }
}
```

## 4. Implementation Plan

### 4.1 Prerequisites

- [ ] Forge migration (SPEC-MIGRATION-001) is complete
- [ ] `/python/faber/definitions/` removed
- [ ] `/python/faber/agents/` removed
- [ ] All tests pass in current structure
- [ ] CI/CD pipelines are green

### 4.2 Phase 1: Preparation

**Objective**: Prepare the codebase for restructuring

**Tasks**:
- [ ] Create backup branch from current state
- [ ] Document all import paths currently in use
- [ ] Identify all CI/CD workflows that need updating
- [ ] Review and update `.gitignore` patterns
- [ ] Create migration checklist

**Estimated Scope**: Low risk, no code changes

### 4.3 Phase 2: Create Monorepo Structure

**Objective**: Create the new directory structure

**Tasks**:
- [ ] Create `/packages/` directory
- [ ] Create `/packages/js/` directory structure
- [ ] Create `/packages/python/` directory structure
- [ ] Create root `package.json` with workspaces config
- [ ] Move shared docs to root level if not already

**Estimated Scope**: Directory structure only, no code moves yet

### 4.4 Phase 3: Migrate JavaScript SDK

**Objective**: Move TypeScript/JavaScript code to packages/js

**Tasks**:
- [ ] Move `/src/` → `/packages/js/src/`
- [ ] Move `/dist/` → `/packages/js/dist/`
- [ ] Move `package.json` → `/packages/js/package.json`
- [ ] Move `tsconfig.json` → `/packages/js/tsconfig.json`
- [ ] Move `jest.config.js` → `/packages/js/jest.config.js`
- [ ] Move `.eslintrc.js` → `/packages/js/.eslintrc.js`
- [ ] Update all relative import paths
- [ ] Update tsconfig.json paths
- [ ] Run build to verify compilation
- [ ] Run tests to verify functionality

**Estimated Scope**: Medium risk, path updates required

### 4.5 Phase 4: Migrate Python SDK

**Objective**: Move Python code to packages/python

**Tasks**:
- [ ] Move `/python/faber/` → `/packages/python/faber/`
- [ ] Move `/python/tests/` → `/packages/python/tests/`
- [ ] Move `/python/pyproject.toml` → `/packages/python/pyproject.toml`
- [ ] Update pyproject.toml package discovery paths
- [ ] Update any hardcoded paths in Python code
- [ ] Run `pip install -e .` to verify installation
- [ ] Run pytest to verify tests pass

**Estimated Scope**: Medium risk, path updates required

### 4.6 Phase 5: Update CI/CD

**Objective**: Create separate CI pipelines for each package

**Tasks**:
- [ ] Create `/packages/js/.github/workflows/ci.yaml` (or root-level with path filters)
- [ ] Create `/packages/python/.github/workflows/ci.yaml` (or root-level with path filters)
- [ ] Update release workflow for dual-package publishing
- [ ] Update npm publish to use packages/js path
- [ ] Update PyPI publish to use packages/python path
- [ ] Test CI pipelines with PR

**Estimated Scope**: Medium complexity, CI expertise required

### 4.7 Phase 6: Cleanup and Documentation

**Objective**: Remove old structure and update docs

**Tasks**:
- [ ] Remove empty `/src/` directory (if any remnants)
- [ ] Remove empty `/python/` directory (if any remnants)
- [ ] Update root README.md with monorepo instructions
- [ ] Update CONTRIBUTING.md with package-specific guidelines
- [ ] Update any internal documentation references
- [ ] Create migration guide for existing users

**Estimated Scope**: Low risk, documentation focused

## 5. File Migration Map

### 5.1 JavaScript Files

| Source | Destination |
|--------|-------------|
| `/src/**/*` | `/packages/js/src/**/*` |
| `/dist/**/*` | `/packages/js/dist/**/*` |
| `/package.json` | `/packages/js/package.json` |
| `/package-lock.json` | `/packages/js/package-lock.json` |
| `/tsconfig.json` | `/packages/js/tsconfig.json` |
| `/jest.config.js` | `/packages/js/jest.config.js` |
| `/.eslintrc.js` | `/packages/js/.eslintrc.js` |

### 5.2 Python Files

| Source | Destination |
|--------|-------------|
| `/python/faber/**/*` | `/packages/python/faber/**/*` |
| `/python/tests/**/*` | `/packages/python/tests/**/*` |
| `/python/pyproject.toml` | `/packages/python/pyproject.toml` |
| `/python/pytest.ini` | `/packages/python/pytest.ini` (if exists) |
| `/python/mypy.ini` | `/packages/python/mypy.ini` (if exists) |

### 5.3 Shared Resources (Stay at Root)

| Location | Purpose |
|----------|---------|
| `/specs/` | Specification documents |
| `/docs/` | Public documentation |
| `/.github/` | GitHub workflows and configs |
| `/README.md` | Root project README |
| `/CONTRIBUTING.md` | Contribution guidelines |
| `/LICENSE` | License file |

## 6. Configuration Changes Required

### 6.1 TypeScript Configuration

**packages/js/tsconfig.json updates:**
```json
{
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {
      "@fractary/faber/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 6.2 Python Configuration

**packages/python/pyproject.toml updates:**
```toml
[tool.hatch.build.targets.wheel]
packages = ["faber"]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"

[tool.mypy]
python_version = "3.10"
strict = true

[tool.ruff]
line-length = 88
target-version = "py310"
```

### 6.3 GitHub Actions Updates

**Example path filter for JS CI:**
```yaml
on:
  push:
    paths:
      - 'packages/js/**'
      - '.github/workflows/js-ci.yaml'
  pull_request:
    paths:
      - 'packages/js/**'
```

**Example path filter for Python CI:**
```yaml
on:
  push:
    paths:
      - 'packages/python/**'
      - '.github/workflows/python-ci.yaml'
  pull_request:
    paths:
      - 'packages/python/**'
```

## 7. Risks and Mitigations

### 7.1 Breaking Changes for Consumers

**Risk**: Existing users may have hardcoded paths
**Impact**: High - users unable to upgrade
**Mitigation**:
- Publish as major version bump (v2.0.0)
- Maintain published package names unchanged (@fractary/faber, faber)
- Document migration steps
- Consider temporary backward-compatible shim (not recommended for long-term)

### 7.2 CI/CD Pipeline Failures

**Risk**: Workflows may break during transition
**Impact**: Medium - temporary build failures
**Mitigation**:
- Test workflows on feature branch first
- Update workflows before moving files
- Have rollback branch ready

### 7.3 Import Path Breakage

**Risk**: Internal imports may break after move
**Impact**: High - code won't compile/run
**Mitigation**:
- Use IDE/tooling to update imports
- Run full test suite after each move
- Commit incrementally to track issues

### 7.4 Version Synchronization

**Risk**: JS and Python versions may drift
**Impact**: Low - expected behavior for independent packages
**Mitigation**:
- Document versioning strategy
- Consider coordinated releases for major features
- Use changelog to track compatibility

## 8. Testing Strategy

### 8.1 Pre-Migration Testing

- [ ] All existing tests pass
- [ ] Build outputs are correct
- [ ] Package can be installed from source

### 8.2 Post-Migration Testing

- [ ] JS package builds successfully (`npm run build` in packages/js)
- [ ] JS tests pass (`npm test` in packages/js)
- [ ] Python package builds (`python -m build` in packages/python)
- [ ] Python tests pass (`pytest` in packages/python)
- [ ] Root scripts work (`npm run build` at root)
- [ ] CI pipelines pass for both packages
- [ ] Package can be published to registry (test with dry-run)

### 8.3 Integration Testing

- [ ] JS package can import all modules
- [ ] Python package can import all modules
- [ ] Forge integration works from both packages
- [ ] CLI tools work correctly

## 9. Acceptance Criteria

- [ ] All code successfully migrated to packages/ structure
- [ ] JavaScript SDK builds and tests pass
- [ ] Python SDK builds and tests pass
- [ ] CI/CD pipelines updated and passing
- [ ] No breaking changes to public API
- [ ] Package names preserved (@fractary/faber, faber)
- [ ] Documentation updated
- [ ] Both packages can be published independently
- [ ] Root-level scripts work for common operations

## 10. Dependencies

- **SPEC-MIGRATION-001**: Forge migration must complete first
- **SPEC-FORGE-001**: Agent/tool definitions must be in Forge
- **SPEC-FABER-002**: Forge integration interface must be stable

## 11. Open Questions

1. **Package Manager**: Should we use npm workspaces, yarn workspaces, or pnpm?
   - Recommendation: pnpm for better monorepo support and disk efficiency

2. **Python Monorepo**: Should Python be in the same workspace or managed separately?
   - Recommendation: Manage via root scripts, not npm workspace

3. **Shared Types**: Should there be a shared types package?
   - Recommendation: Not initially - keep packages independent

4. **Version Coordination**: Should versions be synchronized across packages?
   - Recommendation: Independent versioning with documented compatibility matrix

## 12. Implementation Notes

### Recommended Execution Order

1. Wait for Forge migration to complete
2. Create feature branch `chore/monorepo-restructure`
3. Follow phases in order (don't skip)
4. Test thoroughly after each phase
5. Create PR for review
6. Merge only when all tests pass

### Commands Cheat Sheet

```bash
# Create structure
mkdir -p packages/js packages/python

# Move JS (after creating target)
mv src packages/js/
mv package.json packages/js/
mv tsconfig.json packages/js/

# Move Python (after creating target)
mv python/faber packages/python/
mv python/tests packages/python/
mv python/pyproject.toml packages/python/

# Verify JS
cd packages/js && npm install && npm run build && npm test

# Verify Python
cd packages/python && pip install -e ".[dev]" && pytest
```

## 13. Related Specifications

- **SPEC-MIGRATION-001**: Cross-Project Migration Guide (prerequisite)
- **SPEC-FORGE-001**: Agent & Tool Definition System Architecture
- **SPEC-FORGE-002**: Agent Registry & Resolution
- **SPEC-FABER-002**: Forge Integration Interface
