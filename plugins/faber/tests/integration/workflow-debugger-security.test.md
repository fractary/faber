# Workflow Debugger Security Tests

This document defines integration test scenarios for validating workflow-debugger security features.

## Test Categories

1. **Command Injection Prevention Tests** - Verify shell sanitization and file-based approach
2. **Path Traversal Prevention Tests** - Verify KB file path validation
3. **YAML Parsing Error Tests** - Verify error handling for malformed input
4. **Auto-Fix Verification Tests** - Verify post-fix validation logic

---

## Test 1: Command Injection Prevention - Malicious Title

**Scenario**: Issue title contains shell injection characters

**Setup**:
```json
{
  "issue_title": "Fix bug'; rm -rf /; echo '",
  "issue_body": "Normal body content"
}
```

**Expected Behavior**:
- `sanitize_for_shell()` removes all dangerous characters
- Title written to temp file, not interpolated in shell command
- gh CLI reads title from file using `$(cat ...)` pattern
- No shell command execution from user input
- Issue created with sanitized title: "Fix bug rm -rf  echo"

**Verification**:
```bash
# Verify dangerous characters are stripped
echo "Fix bug'; rm -rf /; echo '" | tr -d "\`\$\\\\\"';|&><\n\r"
# Expected: "Fix bug rm -rf  echo"

# Verify no command injection occurred
ls / # Should still have all files
```

---

## Test 2: Command Injection Prevention - Backtick Injection

**Scenario**: Issue title contains backtick command substitution

**Setup**:
```json
{
  "issue_title": "Bug report `whoami`",
  "issue_body": "Details"
}
```

**Expected Behavior**:
- Backticks removed by sanitize_for_shell()
- No command substitution occurs
- Issue created with title: "Bug report whoami"

**Verification**:
```bash
# Verify backticks stripped
sanitized=$(echo "Bug report \`whoami\`" | tr -d '`')
echo "$sanitized"
# Expected: "Bug report whoami"
```

---

## Test 3: Command Injection Prevention - Dollar Sign Injection

**Scenario**: Issue title contains $() command substitution

**Setup**:
```json
{
  "issue_title": "Error $(cat /etc/passwd)",
  "issue_body": "Details"
}
```

**Expected Behavior**:
- Dollar sign removed by sanitize_for_shell()
- No command substitution occurs
- Issue created with title: "Error (cat /etc/passwd)"

**Verification**:
```bash
# Verify $ stripped
sanitized=$(echo 'Error $(cat /etc/passwd)' | tr -d '$')
echo "$sanitized"
# Expected: "Error (cat /etc/passwd)"
```

---

## Test 4: Path Traversal Prevention - Parent Directory Traversal

**Scenario**: KB file path attempts to escape allowed directory

**Setup**:
```json
{
  "kb_file_path": ".fractary/faber/knowledge-base/../../../etc/passwd",
  "allowed_base_paths": [".fractary/faber/knowledge-base/", ".fractary/plugins/"]
}
```

**Expected Behavior**:
- `validate_kb_file_path()` returns false
- Warning logged: "Path traversal attempt detected"
- File is NOT read
- Entry skipped, processing continues

**Verification**:
```bash
# Verify path contains ..
echo ".fractary/faber/knowledge-base/../../../etc/passwd" | grep -c '\.\.'
# Expected: 1 (contains ..)

# validate_kb_file_path should return false for this path
```

---

## Test 5: Path Traversal Prevention - Invalid Extension

**Scenario**: KB file path has non-allowed extension

**Setup**:
```json
{
  "kb_file_path": ".fractary/faber/knowledge-base/malicious.sh",
  "allowed_base_paths": [".fractary/faber/knowledge-base/"]
}
```

**Expected Behavior**:
- `validate_kb_file_path()` returns false
- Warning logged: "Invalid KB file extension"
- File is NOT read or executed
- Entry skipped

**Verification**:
```bash
# Verify extension is not .md or .json
echo ".fractary/faber/knowledge-base/malicious.sh" | grep -E '\.(md|json)$'
# Expected: no match (exit code 1)
```

---

## Test 6: Path Traversal Prevention - Outside Allowed Directory

**Scenario**: KB file path is absolute path outside allowed directories

**Setup**:
```json
{
  "kb_file_path": "/etc/passwd",
  "allowed_base_paths": [".fractary/faber/knowledge-base/", ".fractary/plugins/"]
}
```

**Expected Behavior**:
- `validate_kb_file_path()` returns false
- Warning logged: "KB file path outside allowed directories"
- File is NOT read
- Entry skipped

**Verification**:
```bash
# Verify path does not start with allowed base
realpath /etc/passwd | grep -c '\.fractary'
# Expected: 0 (not in .fractary directory)
```

---

## Test 7: YAML Parsing Error - Malformed YAML

**Scenario**: KB entry has malformed YAML front matter

**Setup**:
Create test file `.fractary/faber/knowledge-base/test/malformed.md`:
```markdown
---
id: test-malformed
title: Test Entry
phase: [invalid yaml syntax
---

# Test Entry
```

**Expected Behavior**:
- `parse_yaml()` throws error
- TRY/CATCH catches the error
- Warning logged: "Failed to parse YAML front matter"
- Function returns null
- Entry skipped, processing continues

**Verification**:
```bash
# Attempt to parse malformed YAML
echo "phase: [invalid yaml syntax" | python3 -c "import yaml, sys; yaml.safe_load(sys.stdin)" 2>&1
# Expected: Error about invalid syntax
```

---

## Test 8: YAML Parsing Error - Missing Required Fields

**Scenario**: KB entry is missing required id field

**Setup**:
Create test file `.fractary/faber/knowledge-base/test/missing-id.md`:
```markdown
---
title: Entry Without ID
phase: build
---

# Entry Without ID
```

**Expected Behavior**:
- YAML parses successfully
- Validation check fails (missing id)
- Warning logged: "KB entry missing required fields"
- Function returns null
- Entry skipped

**Verification**:
```bash
# Check state.json for skipped entry
grep -c "missing-id" .fractary/faber/knowledge-base/**/*.md
# Expected: 0 (not in any valid entry list)
```

---

## Test 9: Auto-Fix Verification - Build Success

**Scenario**: Auto-fix runs build command and verifies success

**Setup**:
```json
{
  "solution": {
    "category": "build_failure",
    "actions": ["Run: npm run build"]
  },
  "build_output": "Build completed successfully"
}
```

**Expected Behavior**:
- `verify_fix_resolved_problem()` runs `npm run build`
- Output does not contain "error" or "failed"
- Returns `{ resolved: true }`
- Solution logged to KB

**Verification**:
```bash
# Simulate successful build
echo "Build completed successfully" | grep -ci 'error\|failed'
# Expected: 0 (no errors)
```

---

## Test 10: Auto-Fix Verification - Build Failure

**Scenario**: Auto-fix runs but build still fails

**Setup**:
```json
{
  "solution": {
    "category": "build_failure",
    "actions": ["Run: npm run build"]
  },
  "build_output": "Error: Module not found"
}
```

**Expected Behavior**:
- `verify_fix_resolved_problem()` runs `npm run build`
- Output contains "error"
- Returns `{ resolved: false, reason: "Build still showing errors" }`
- Warning displayed: "Commands ran but verification failed"
- Solution NOT logged to KB

**Verification**:
```bash
# Simulate failed build
echo "Error: Module not found" | grep -ci 'error'
# Expected: 1 (contains error)
```

---

## Test 11: Command Injection Prevention - Newline Injection

**Scenario**: Issue title contains newline characters

**Setup**:
```json
{
  "issue_title": "Bug report\nmalicious command\nend"
}
```

**Expected Behavior**:
- Newline characters removed by sanitize_for_shell()
- No command injection via newline
- Issue created with title: "Bug reportmalicious commandend"

**Verification**:
```bash
# Verify newlines stripped
echo -e "Bug report\nmalicious command\nend" | tr -d '\n\r'
# Expected: "Bug reportmalicious commandend"
```

---

## Test 12: Cache Invalidation - Deleted Files

**Scenario**: KB file is deleted but cache still has entry

**Setup**:
1. Create KB file `.fractary/faber/knowledge-base/test/temp-entry.md`
2. Run knowledge-aggregator (populates cache)
3. Delete `temp-entry.md`
4. Run knowledge-aggregator again

**Expected Behavior**:
- First run: Entry added to cache and results
- After deletion: File no longer exists
- get_file_mtime() fails or returns different value
- Entry removed from results (but may remain in cache as stale)
- Results should NOT include deleted entry

**Verification**:
```bash
# After deletion, verify entry not in results
cat .fractary/cache/kb-aggregator-cache.json | jq '.entries | keys | map(select(contains("temp-entry")))'
# May still be in cache, but...

# Verify not in actual search results (file doesn't exist)
ls .fractary/faber/knowledge-base/test/temp-entry.md 2>/dev/null
# Expected: File not found
```

---

## Security Test Summary

| Test | Category | Risk Level | Status |
|------|----------|------------|--------|
| 1 | Command Injection | Critical | Must Pass |
| 2 | Command Injection | Critical | Must Pass |
| 3 | Command Injection | Critical | Must Pass |
| 4 | Path Traversal | Critical | Must Pass |
| 5 | Path Traversal | High | Must Pass |
| 6 | Path Traversal | Critical | Must Pass |
| 7 | YAML Parsing | Medium | Must Pass |
| 8 | YAML Parsing | Medium | Must Pass |
| 9 | Auto-Fix | Medium | Should Pass |
| 10 | Auto-Fix | Medium | Should Pass |
| 11 | Command Injection | Critical | Must Pass |
| 12 | Cache | Low | Should Pass |

## Running Tests

These tests should be run as part of CI/CD pipeline:

```bash
# Run all security tests
./scripts/run-security-tests.sh

# Run specific category
./scripts/run-security-tests.sh --category "command-injection"
./scripts/run-security-tests.sh --category "path-traversal"
./scripts/run-security-tests.sh --category "yaml-parsing"
```
