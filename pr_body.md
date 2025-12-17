## Summary

Migrates all 90+ FABER CLI commands from the centralized `fractary/cli` repository to a separate `@fractary/faber-cli` package within the `fractary/faber` monorepo, following SPEC-00026's distributed plugin architecture.

### Changes

**New Package Structure**
- Created `/cli/` directory at repository root
- Package name: `@fractary/faber-cli`
- Binary name: `fractary-faber`
- Version: 1.0.0

**Commands Migrated** (90+ total)
- **Workflow** (7): init, run, status, resume, pause, recover, cleanup
- **Work** (23): issue, comment, label, milestone operations
- **Repo** (30+): branch, commit, PR, tag, worktree operations  
- **Spec** (8): create, get, list, update, validate, refine, delete
- **Logs** (8): capture, stop, write, read, search, list, archive

**SDK Updates**
- Removed SDK CLI from `sdk/js/src/cli/` directory
- Removed `bin` field from `sdk/js/package.json`
- Updated SDK version from 1.2.2 → 2.0.0 (breaking change)
- CLI now imports directly from `@fractary/faber` SDK

**Monorepo Configuration**
- Updated root `package.json` workspaces to include CLI
- Added CLI build/test/lint scripts
- CLI uses workspace reference for SDK dependency

**Documentation**
- Created comprehensive `/cli/README.md` with full command reference
- Updated root `README.md` with new CLI structure and examples
- All commands documented with usage examples

### Architecture

Follows **SPEC-00026: Distributed Plugin Architecture**:
- ✅ CLI as separate package from SDK
- ✅ Proper naming: `@fractary/faber-cli`
- ✅ Binary follows `fractary-{domain}` pattern
- ✅ Clean separation of concerns
- ✅ TypeScript compilation passes with 0 errors
- ✅ CLI builds successfully

### Testing

- TypeScript compilation: ✅ Passed
- CLI build: ✅ Successful  
- All imports updated to use `@fractary/faber`
- Command files type-checked and compiled

### Migration Path

Existing users of `fractary` binary should migrate to `fractary-faber`:
```bash
# Old
fractary run issue 123

# New
fractary-faber run --work-id 123
```

See `/cli/README.md` for comprehensive documentation.

---

Closes #16
