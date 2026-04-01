# Validate Protocol

Validates the current FABER configuration. This is a read-only operation that never modifies files.

## Arguments

| Argument | Description |
|---|---|
| `--json` | Output result as JSON |

## Steps

### 1. Run Validation

Run:

```
fractary-faber config validate [--json]
```

### 2. Handle Success (exit code 0)

Report that validation passed. Then show a summary of the current configuration by running:

```
fractary-faber config get faber --json
```

Display the key fields: `workflows.path`, `workflows.default`, `workflows.autonomy`, `runs.path`, `worktree.enabled`.

### 3. Handle Failure (exit code 1)

List each error and warning from the validation output. For each issue, suggest a specific fix:

| Issue | Suggested fix |
|---|---|
| Missing faber section | Run `config-init` to create the FABER configuration |
| Invalid autonomy value | Run `config-update --context "set autonomy to guarded"` with a valid level |
| Missing directories | Run `config-init --force` to recreate the directory structure |
| Deprecated fields | Run `config migrate` to update to the current schema |

Present the fixes as actionable commands the user can run directly.
