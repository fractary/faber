# FABER CLI (Deprecated)

This directory contains the deprecated standalone FABER CLI code.

## Status: REMOVED

As of FABER v1.0.0, the standalone `faber` command has been removed.

## Migration

Use the unified Fractary CLI instead:

```bash
# Install
npm install -g @fractary/cli

# Instead of:
faber run 123 --autonomy assisted

# Use:
fractary faber run 123 --autonomy assisted
```

## Programmatic Use

For programmatic access, use the `faber.api` module:

```python
from faber.api import run_workflow_sync, WorkflowOptions

result = run_workflow_sync("123", WorkflowOptions(
    autonomy="assisted"
))
```

## Removal Timeline

- **v0.1.0** - Deprecation warnings added
- **v1.0.0** - CLI entry point removed (current)
- **v1.1.0** - CLI code will be deleted (planned)

## Code Preserved For

This code is preserved temporarily for:
1. Reference during fractary/cli integration
2. Documentation of CLI→API refactoring patterns
3. Rollback capability if needed

Will be deleted in v1.1.0 after fractary/cli integration is confirmed stable.
