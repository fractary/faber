# SPEC: Extract Domain Plugins from faber Repository

**Date:** 2026-01-27
**Status:** Completed
**Scope:** Full extraction

## Summary

Extract `faber-cloud` and `faber-article` plugins into their own repositories, leaving only the core FABER orchestration framework in `fractary/faber`.

## Current State

```
fractary/faber (this repo)
├── plugins/
│   ├── faber/           # Core FABER (10 agents, 21 skills) - KEEP
│   ├── faber-cloud/     # Cloud infrastructure (14 agents, 4 skills) - EXTRACT
│   └── faber-article/   # Content creation (1 agent, 8 skills) - EXTRACT
├── sdk/                 # JS/Python SDKs - KEEP
└── cli/                 # Fractary CLI - KEEP
```

## Target State

| Repository | Contents |
|------------|----------|
| `fractary/faber` | Core orchestration framework + SDK + CLI |
| `fractary/faber-cloud` | Cloud/infrastructure agents & workflows |
| `fractary/faber-content` | Content creation agents & workflows |
| `fractary/faber-software` | Software development agents (already exists) |

---

## Extraction Details

### 1. faber-article → faber-content

**Feasibility: TRIVIAL (100% self-contained)**

- Zero dependencies on core faber or other plugins
- Uses only standard Claude Code tools
- Self-contained state management

**Files to move:**
- `plugins/faber-article/` → new repo's `plugins/faber-content/`

**Required changes:**
- Rename plugin from `fractary-faber-article` to `fractary-faber-content`
- Create new `marketplace.json`
- Update version to 1.1.0

### 2. faber-cloud → faber-cloud

**Feasibility: HIGH (95% self-contained)**

- Optional dependencies on `fractary-work` and `fractary-repo` in workflow files only
- All 14 agents work independently without core faber

**Files to move:**
- `plugins/faber-cloud/` → new repo

**Handling optional dependencies:**

The workflow files reference these skills:
- `fractary-work:issue-fetcher`, `fractary-work:issue-classifier`
- `fractary-repo:branch-manager`, `fractary-repo:commit-creator`, `fractary-repo:pr-manager`

**Approach:** Document as optional peer dependencies. Users who want full FABER workflow integration install fractary-work/fractary-repo; standalone users use direct commands.

**Workflow schema:** Copy schema to new repo (self-contained, allows independent evolution)

### 3. Update Core faber

**Changes to this repo:**
- Remove `plugins/faber-cloud/` directory
- Remove `plugins/faber-article/` directory
- Update `.claude-plugin/marketplace.json` to only list core faber
- Update README with links to extracted plugins

---

## New Repository Structure

Each extracted repo follows this pattern:

```
faber-{domain}/
├── plugins/
│   └── faber-{domain}/
│       ├── .claude-plugin/plugin.json
│       ├── agents/
│       ├── commands/
│       └── skills/
├── .claude-plugin/marketplace.json
├── README.md
└── LICENSE
```

---

## Forge Integration

Each repo registers independently with forge:

```bash
# Users install what they need
fractary forge install @fractary/faber          # Core framework
fractary forge install @fractary/faber-cloud    # Optional
fractary forge install @fractary/faber-content  # Optional
fractary forge install @fractary/faber-software # Optional
```

---

## Implementation Steps

### Step 1: Create faber-content repository
- [x] Create `fractary/faber-content` GitHub repo
- [x] Copy `plugins/faber-article/` contents
- [x] Rename plugin to `fractary-faber-content`
- [x] Create marketplace.json
- [x] Update version to 1.1.0
- [x] Push to GitHub

### Step 2: Create faber-cloud repository
- [x] Create `fractary/faber-cloud` GitHub repo
- [x] Copy `plugins/faber-cloud/` contents
- [x] Copy workflow schema to new repo
- [x] Add optional peer dependency documentation
- [x] Update version to 3.2.0
- [x] Push to GitHub

### Step 3: Clean up this repository
- [x] Remove `plugins/faber-cloud/`
- [x] Remove `plugins/faber-article/`
- [x] Update marketplace.json
- [x] Update README with cross-references
- [ ] Commit and push

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing installations | Clear deprecation notice, version bumps |
| Users can't find plugins | Central docs hub, README cross-references |
| Workflow schema drift | Pin versions, maintain compatibility |

---

## Verification

After extraction:
1. Install each plugin independently via forge
2. Test faber-cloud commands work standalone
3. Test faber-cloud workflows work with fractary-work/repo installed
4. Test faber-content commands work standalone
5. Verify core faber still functions without domain plugins

---

## Decisions Made

- **Plugin name:** `faber-content` (allows future expansion)
- **Workflow schema:** Copy to each repo (self-contained)
- **Scope:** Full extraction (create repos, move files, update this repo)
