# Migration Guide: Standalone CLI → Fractary CLI + API

This guide helps you migrate from the standalone `faber` CLI to the unified Fractary CLI and programmatic API.

## Overview

FABER v1.0.0 removes the standalone `faber` command in favor of:
1. **Fractary CLI**: Unified `fractary faber` commands for CLI users
2. **Python API**: `faber.api` module for programmatic access

## For CLI Users

### Installation

**Before (v0.x):**
```bash
pip install faber
```

**After (v1.0+):**
```bash
npm install -g @fractary/cli
```

### Command Changes

| Old Command (v0.x) | New Command (v1.0+) |
|-------------------|---------------------|
| `faber run 123` | `fractary faber run 123` |
| `faber init` | `fractary faber init` |
| `faber workflow list` | `fractary faber workflow list` |
| `faber workflow view WF-123` | `fractary faber workflow view WF-123` |
| `faber version` | `fractary faber --version` |

### Configuration

Configuration files remain in the same location:
- `.faber/config.yaml` - Workflow configuration (unchanged)
- `.faber/checkpoints.db` - Workflow checkpoints (unchanged)
- `.faber/logs/` - Workflow logs (unchanged)

**No migration of config files needed.**

### Examples

**Before:**
```bash
faber run 123 --autonomy assisted --max-retries 5
```

**After:**
```bash
fractary faber run 123 --autonomy assisted --max-retries 5
```

## For Programmatic Users

### Python API Migration

**Before (v0.x):**
```python
from faber.workflows.graph import run_faber_workflow_sync
from faber.workflows.config import load_workflow_config

config = load_workflow_config()
result = run_faber_workflow_sync("123", config)
```

**After (v1.0+):**
```python
from faber.api import run_workflow_sync, WorkflowOptions

result = run_workflow_sync("123", WorkflowOptions(
    autonomy="assisted"
))
```

### Key Changes

1. **Import from `faber.api`** instead of `faber.workflows`
2. **Use `WorkflowOptions`** dataclass instead of `WorkflowConfig`
3. **`WorkflowResult`** returned instead of state dict
4. **Exceptions** are `WorkflowError`, `ConfigError` instead of generic exceptions

### API Examples

**Initialize configuration:**
```python
from faber.api import init_config

result = init_config()
if result.success:
    print(f"Config created at {result.path}")
```

**Run workflow with options:**
```python
from faber.api import run_workflow_sync, WorkflowOptions, AutonomyLevel

result = run_workflow_sync("123", WorkflowOptions(
    autonomy=AutonomyLevel.ASSISTED,
    max_retries=3,
    budget_usd=10.0,
    trace=True,
))

print(f"Status: {result.status}")
if result.pr_url:
    print(f"PR: {result.pr_url}")
```

**List workflows:**
```python
from faber.api import list_workflows

workflows = list_workflows(status="completed", limit=10)
for wf in workflows:
    print(f"{wf.workflow_id}: {wf.status}")
```

**Handle errors:**
```python
from faber.api import run_workflow_sync, WorkflowError

try:
    result = run_workflow_sync("123")
except WorkflowError as e:
    print(f"Workflow failed: {e.message}")
    print(f"Phase: {e.phase}")
```

### Advanced: Direct Graph Access

If you need low-level control, graph access still works:

```python
# Still supported for advanced users
from faber import create_faber_workflow, FaberState
from faber.workflows.config import load_workflow_config

config = load_workflow_config()
graph = create_faber_workflow(config)
# ... use LangGraph directly
```

## Rollback (Emergency)

If you need to rollback temporarily:

1. Install old version:
   ```bash
   pip install faber==0.1.0
   ```

2. Use `faber` commands as before

3. Report issue: https://github.com/fractary/faber/issues

## Timeline

- **v0.1.0** (Dec 2025): Deprecation warnings added
- **v1.0.0** (Dec 2025): CLI entry point removed (current)
- **v1.1.0** (Q1 2026): CLI code deleted (planned)

## Support

- Documentation: https://fractary.dev/docs
- Issues: https://github.com/fractary/faber/issues
- Discussions: https://github.com/fractary/faber/discussions

## FAQ

**Q: Can I still use Python to run workflows?**

Yes! Use `faber.api`:
```python
from faber.api import run_workflow_sync
result = run_workflow_sync("123")
```

**Q: Will my existing config files work?**

Yes, `.faber/config.yaml` format is unchanged.

**Q: What about my workflow logs?**

All logs remain in `.faber/logs/` and can be viewed with:
```bash
fractary faber workflow list
fractary faber workflow view WF-123
```

**Q: Can I run workflows without Node.js?**

Yes, use the Python API:
```python
from faber.api import run_workflow_sync
```

**Q: What if I have CI/CD using `faber` commands?**

Update to:
```bash
npm install -g @fractary/cli
fractary faber run $ISSUE_NUMBER
```

Or use Python API:
```bash
python -c "from faber.api import run_workflow_sync; run_workflow_sync('$ISSUE_NUMBER')"
```

**Q: Do I need to change my import statements?**

Only if you were using internal imports. The recommended approach is now:
```python
from faber.api import run_workflow_sync  # Recommended
# vs
from faber.workflows.graph import run_faber_workflow_sync  # Still works but not recommended
```

## Breaking Changes Summary

### Removed
- ❌ `faber` CLI command (install `@fractary/cli` instead)

### Changed
- ⚠️ Version bumped from 0.1.0 to 1.0.0 (semantic versioning)
- ⚠️ Recommended imports changed from `faber.workflows` to `faber.api`

### Unchanged
- ✅ Configuration file format (`.faber/config.yaml`)
- ✅ Workflow logs location (`.faber/logs/`)
- ✅ Checkpoint database (`.faber/checkpoints.db`)
- ✅ Python package name (`pip install faber`)
- ✅ Advanced/internal APIs still available

## Migration Checklist

- [ ] Install Fractary CLI: `npm install -g @fractary/cli`
- [ ] Update CI/CD scripts to use `fractary faber` commands
- [ ] Update programmatic code to use `faber.api` imports
- [ ] Test workflows with new CLI/API
- [ ] Update documentation/README in your projects
- [ ] Remove old `faber` CLI if installed: `pip uninstall faber && pip install faber`

## Need Help?

If you encounter issues during migration:

1. Check this guide first
2. Review the [API documentation](./public/api.md)
3. Search [existing issues](https://github.com/fractary/faber/issues)
4. Ask in [discussions](https://github.com/fractary/faber/discussions)
5. File a [new issue](https://github.com/fractary/faber/issues/new)
