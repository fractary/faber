# Update Protocol

Updates individual fields in an existing FABER configuration section.

## Arguments

| Argument | Description |
|---|---|
| `--context "text"` | Natural language description of the desired change |
| `--force` | Skip confirmation prompt |
| `--json` | Output result as JSON |

## Steps

### 1. Verify Config Exists

Run both commands:

```
fractary-faber config exists
fractary-faber config get faber --json
```

If no faber config section exists, stop and tell the user to run `config-init` first.

### 2. Interpret --context Natural Language

Parse the `--context` value to determine which config field to update and what value to set.

#### Autonomy Keywords

| Input keywords | Resolved value |
|---|---|
| `autonomous`, `auto`, `full auto` | `autonomous` |
| `guarded`, `guard` | `guarded` |
| `assisted`, `assist` | `assisted` |
| `dry-run`, `preview` | `dry-run` |

#### Field Mapping

| Input keywords | Config field |
|---|---|
| `autonomy`, `mode` | `workflows.autonomy` |
| `default workflow` | `workflows.default` |
| `workflows path` | `workflows.path` |
| `runs path` | `runs.path` |

If the context text is ambiguous or matches multiple fields, present the possible interpretations to the user and let the user clarify which field and value they intend.

### 3. Preview Changes

Run with `--dry-run` to show what will change without applying:

```
fractary-faber config update --dry-run {changes}
```

Display the diff between current and proposed values.

### 4. Confirm

Unless `--force` was provided, ask the user:

> Apply these changes?

Show the before/after values in the prompt.

### 5. Apply Changes

Run:

```
fractary-faber config update {changes}
```

### 6. Report Result

Show the updated field values and the backup file location so the user knows where to find the previous config if they need to revert.
