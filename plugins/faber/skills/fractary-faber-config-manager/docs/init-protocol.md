# Init Protocol

Initializes the FABER configuration section in an existing Fractary project.

## Arguments

| Argument | Description |
|---|---|
| `--autonomy <level>` | Set autonomy level directly: `guarded`, `assisted`, `autonomous`, `dry-run` |
| `--force` | Skip confirmation and overwrite existing config |
| `--json` | Output result as JSON |

## Config Fields

| Field | Default |
|---|---|
| `workflows.path` | `.fractary/faber/workflows` |
| `workflows.default` | `default` |
| `workflows.autonomy` | User chooses |
| `runs.path` | `.fractary/faber/runs` |
| `worktree.enabled` | `false` (always) |

## Steps

### 1. Check Prerequisites

`.fractary/config.yaml` must exist. This file is created by `fractary-core-init`. If it does not exist, stop and tell the user to run `fractary-core-init` first.

### 2. Check for Existing Faber Section

Run:

```
fractary-faber config get faber --json
```

If a faber section already exists and `--force` was not provided, inform the user that FABER is already configured. Show the current values and suggest using `config-update` to modify individual fields or passing `--force` to reinitialize.

### 3. Auto-Detect Autonomy Level

If `--autonomy` was not provided, detect a recommendation by checking signals in this order:

1. **CI environment** -- the `$CI` environment variable is set --> recommend `autonomous`
2. **Existing FABER runs** -- previous runs exist in the runs directory --> recommend `guarded`
3. **Test infrastructure** -- test frameworks or CI config files are present --> recommend `guarded`
4. **New project** -- no significant history or infrastructure detected --> recommend `assisted`
5. **Default fallback** --> recommend `guarded`

Use the first matching signal.

### 4. Prompt for Autonomy Level

If `--autonomy` was not provided, prompt the user to choose. Present the four options with the detected recommendation highlighted:

- **Guarded** -- requires confirmation before destructive actions
- **Assisted** -- asks clarifying questions during execution
- **Autonomous** -- runs without interruption (recommended for CI)
- **Dry-run** -- preview mode, no changes applied

### 5. Show Summary and Confirm

Display the full configuration that will be written. Unless `--force` was provided, ask the user to confirm before applying.

### 6. Apply Configuration

Run:

```
fractary-faber config init --autonomy "{level}" [--force]
```

### 7. Manage .gitignore

Add the following entry to `.fractary/.gitignore` if it is not already present:

```
faber/runs/.active-run-id
```

### 8. Validate

Run:

```
fractary-faber config validate
```

Report the validation result. If validation fails, show the errors and suggest corrective actions.
