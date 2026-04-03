---
name: fractary-faber-config-manager
description: Initialize, update, or validate FABER configuration in .fractary/config.yaml
user-invocable: true
---

# FABER Config Manager

Manages the `faber:` section in `.fractary/config.yaml`. Three operations:

## Operations

- **init**: First-time setup of FABER configuration. Read `docs/init-protocol.md` for detailed instructions.
- **update**: Modify existing config via natural language. Read `docs/update-protocol.md` for detailed instructions.
- **validate**: Check config integrity (read-only). Read `docs/validate-protocol.md` for detailed instructions.

## Routing

Parse the first positional argument to determine operation:
- `init` or no arguments with no existing config → init operation
- `update` or `--context` present → update operation
- `validate` → validate operation

## Common Rules

1. ALL operations delegate to CLI: `fractary-faber config {operation} [flags]`
2. NEVER write YAML directly — the CLI handles file I/O, backups, and validation
3. `.fractary/config.yaml` must exist (created by `fractary-core-init`). If missing, tell user to run that first.
4. Always prompt the user interactively for confirmations and choices — never use plain text questions

## Quick Reference

| CLI Command | Purpose |
|-------------|---------|
| `fractary-faber config exists` | Check if config exists |
| `fractary-faber config get faber --json` | Read current faber config |
| `fractary-faber config init --autonomy <level>` | Initialize config |
| `fractary-faber config update --dry-run <key>=<value>` | Preview changes |
| `fractary-faber config update <key>=<value>` | Apply changes |
| `fractary-faber config validate [--json]` | Validate config |
