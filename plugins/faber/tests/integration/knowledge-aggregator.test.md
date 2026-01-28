# Knowledge Aggregator Integration Tests

This document defines integration test scenarios for validating knowledge-aggregator functionality.

## Test Categories

1. **KB Entry Parsing Tests** - Verify markdown and JSON parsing
2. **Cache Behavior Tests** - Verify mtime caching and invalidation
3. **Multi-Source Search Tests** - Verify aggregation across sources
4. **Filter Tests** - Verify category, phase, agent filtering

---

## Test 1: Markdown KB Entry Parsing - Valid Entry

**Scenario**: Parse a well-formed markdown KB entry with YAML front matter

**Setup**:
Create test file `.fractary/faber/knowledge-base/test/valid-entry.md`:
```markdown
---
id: KB-test-001
title: Test Entry Title
phase: build
step: implement
agent: software-engineer
category: test_failure
severity: medium
symptoms:
  - "Test failed"
  - "Assertion error"
tags:
  - testing
  - unit-tests
created: 2026-01-28
verified: true
success_count: 5
---

# Test Entry Title

## Symptoms

Test fails with assertion error during unit test execution.

## Root Cause

Missing mock for external API call in test setup.

## Solution

Add mock for the external API:

1. Create mock file for API responses
2. Import mock in test setup
3. Configure mock to return expected data
4. Re-run tests

## Prevention

Always mock external dependencies in unit tests.
```

**Expected Behavior**:
- YAML front matter parsed correctly
- All metadata fields extracted
- Markdown sections parsed (Symptoms, Root Cause, Solution, Prevention)
- Actions extracted from numbered list in Solution section

**Verification**:
```bash
# Run aggregator and check output
/fractary-faber:knowledge-aggregator --category test_failure --format json | jq '.entries[] | select(.id == "KB-test-001")'

# Expected fields present:
# - id: "KB-test-001"
# - title: "Test Entry Title"
# - phase: "build"
# - category: "test_failure"
# - solution.actions: array with 4 items
```

---

## Test 2: JSON KB Entry Parsing - Legacy Format

**Scenario**: Parse a legacy JSON KB entry

**Setup**:
Create test file `.fractary/faber/knowledge-base/legacy-entry.json`:
```json
{
  "id": "KB-legacy-001",
  "problem_pattern": "Build fails with missing dependency",
  "category": "missing_dependency",
  "phase": "build",
  "root_cause": "Package not in package.json",
  "solution": {
    "actions": [
      "Run: npm install missing-package",
      "Add to package.json dependencies"
    ],
    "rationale": "Install missing dependency"
  },
  "success_rate": 0.9,
  "usage_count": 15
}
```

**Expected Behavior**:
- JSON parsed correctly
- All fields extracted
- Entry included in search results

**Verification**:
```bash
# Run aggregator and check output
/fractary-faber:knowledge-aggregator --category missing_dependency --format json | jq '.entries[] | select(.id == "KB-legacy-001")'

# Expected: Entry present with all fields
```

---

## Test 3: Cache Behavior - Unchanged File

**Scenario**: KB file unchanged between invocations

**Setup**:
1. Create KB file with known mtime
2. Run knowledge-aggregator (first call)
3. Run knowledge-aggregator again (second call)
4. Check cache behavior

**Expected Behavior**:
- First call: File parsed, entry added to cache with mtime
- Second call: mtime matches, cached entry used (no re-parsing)
- Performance improvement on second call

**Verification**:
```bash
# First call - populates cache
time /fractary-faber:knowledge-aggregator --format json > /dev/null

# Second call - uses cache
time /fractary-faber:knowledge-aggregator --format json > /dev/null

# Check cache file
cat .fractary/cache/kb-aggregator-cache.json | jq '.entries | keys | length'
# Expected: Number of KB files

# Verify mtime stored
cat .fractary/cache/kb-aggregator-cache.json | jq '.entries | to_entries[0].value.mtime'
# Expected: mtime value present
```

---

## Test 4: Cache Behavior - Modified File

**Scenario**: KB file modified between invocations

**Setup**:
1. Run knowledge-aggregator (populates cache)
2. Modify a KB file (change content)
3. Run knowledge-aggregator again
4. Verify new content used

**Expected Behavior**:
- File mtime changes after modification
- Cached mtime no longer matches
- File re-parsed
- New content in results
- Cache updated with new mtime and entry

**Verification**:
```bash
# Get current mtime from cache
old_mtime=$(cat .fractary/cache/kb-aggregator-cache.json | jq -r '.entries["some-file.md"].mtime')

# Modify file
echo "# Updated content" >> .fractary/faber/knowledge-base/some-file.md

# Run aggregator
/fractary-faber:knowledge-aggregator --format json > /dev/null

# Check new mtime
new_mtime=$(cat .fractary/cache/kb-aggregator-cache.json | jq -r '.entries["some-file.md"].mtime')

# Verify mtime changed
[ "$old_mtime" != "$new_mtime" ] && echo "PASS: Cache updated" || echo "FAIL: Cache not updated"
```

---

## Test 5: Multi-Source Search - Core and Plugin KB

**Scenario**: Search aggregates entries from core and plugin knowledge bases

**Setup**:
1. Core KB: `.fractary/faber/knowledge-base/core-entry.md`
2. Plugin KB: `.fractary/plugins/test-plugin/knowledge-base/plugin-entry.md`

**Expected Behavior**:
- Both sources discovered
- Entries from both sources in results
- Source attribution correct ("core" vs "test-plugin")
- Core entries have higher priority

**Verification**:
```bash
# Run aggregator
/fractary-faber:knowledge-aggregator --format json | jq '.total_sources'
# Expected: 2 (core + plugin)

# Check source attribution
/fractary-faber:knowledge-aggregator --format json | jq '.entries[] | {id, source}'
# Expected: mix of "core" and "test-plugin" sources
```

---

## Test 6: Filter - Category Filter

**Scenario**: Filter entries by category

**Setup**:
- Entry 1: category = "type_system"
- Entry 2: category = "test_failure"
- Entry 3: category = "build_failure"

**Expected Behavior**:
- Filter `--category type_system` returns only Entry 1
- Other entries excluded

**Verification**:
```bash
# Filter by category
/fractary-faber:knowledge-aggregator --category type_system --format json | jq '.entries | length'
# Expected: 1 (only type_system entries)

# Verify category matches
/fractary-faber:knowledge-aggregator --category type_system --format json | jq '.entries[].category'
# Expected: all "type_system"
```

---

## Test 7: Filter - Phase and Agent Combined

**Scenario**: Filter by both phase and agent

**Setup**:
- Entry 1: phase = "build", agent = "software-engineer"
- Entry 2: phase = "build", agent = "test-runner"
- Entry 3: phase = "evaluate", agent = "software-engineer"

**Expected Behavior**:
- Filter `--phase build --agent software-engineer` returns only Entry 1
- Agent match provides relevance boost

**Verification**:
```bash
# Filter by phase and agent
/fractary-faber:knowledge-aggregator --phase build --agent software-engineer --format json | jq '.entries[0]'
# Expected: Entry 1 with highest relevance score

# Check relevance score includes agent boost
/fractary-faber:knowledge-aggregator --phase build --agent software-engineer --format json | jq '.entries[0].relevance_score'
# Expected: Higher than without agent match
```

---

## Test 8: Filter - Tags Filter

**Scenario**: Filter entries by tags

**Setup**:
- Entry 1: tags = ["typescript", "imports"]
- Entry 2: tags = ["python", "imports"]
- Entry 3: tags = ["javascript"]

**Expected Behavior**:
- Filter `--tags typescript` returns Entry 1
- Filter `--tags imports` returns Entry 1 and Entry 2

**Verification**:
```bash
# Filter by single tag
/fractary-faber:knowledge-aggregator --tags typescript --format json | jq '.entries | length'
# Expected: 1

# Filter by shared tag
/fractary-faber:knowledge-aggregator --tags imports --format json | jq '.entries | length'
# Expected: 2
```

---

## Test 9: Relevance Scoring - Verified Entries

**Scenario**: Verified entries get relevance boost

**Setup**:
- Entry 1: verified = true, success_count = 10
- Entry 2: verified = false, success_count = 10

**Expected Behavior**:
- Entry 1 has higher relevance score (verified bonus)
- Entry 1 appears before Entry 2 in results

**Verification**:
```bash
# Get entries sorted by relevance
/fractary-faber:knowledge-aggregator --format json | jq '.entries | sort_by(-.relevance_score) | .[0:2] | .[] | {id, verified, relevance_score}'
# Expected: verified=true entry has higher score
```

---

## Test 10: Limit Parameter

**Scenario**: Limit number of returned entries

**Setup**:
- 30 KB entries in knowledge base
- Request limit = 5

**Expected Behavior**:
- Only 5 entries returned
- Entries sorted by relevance
- Total counts still accurate

**Verification**:
```bash
# Get limited results
result=$(/fractary-faber:knowledge-aggregator --limit 5 --format json)

# Check returned count
echo "$result" | jq '.returned_count'
# Expected: 5

# Check total still accurate
echo "$result" | jq '.total_entries'
# Expected: 30 (or actual total)

# Verify only 5 entries in array
echo "$result" | jq '.entries | length'
# Expected: 5
```

---

## Test 11: Empty Knowledge Base

**Scenario**: No KB entries exist

**Setup**:
- Empty `.fractary/faber/knowledge-base/` directory
- No plugin KB directories

**Expected Behavior**:
- No errors thrown
- Empty results returned
- Appropriate counts (0)

**Verification**:
```bash
# Temporarily move KB
mv .fractary/faber/knowledge-base .fractary/faber/knowledge-base.bak

# Run aggregator
/fractary-faber:knowledge-aggregator --format json | jq '{total_entries, returned_count}'
# Expected: both 0

# Restore KB
mv .fractary/faber/knowledge-base.bak .fractary/faber/knowledge-base
```

---

## Test 12: Path Traversal Prevention in Aggregator

**Scenario**: Malicious file path in KB directory

**Setup**:
Create symlink or file with traversal path (simulated)

**Expected Behavior**:
- `validate_kb_file_path()` rejects paths with ".."
- Warning logged
- Entry skipped
- No file outside allowed directories read

**Verification**:
```bash
# Verify validation function rejects bad paths
# (In actual code, this happens automatically)

# Check logs for warning
grep "Path traversal attempt" .fractary/logs/*.log 2>/dev/null
# Expected: Warning if bad path encountered
```

---

## Performance Tests

### Test P1: Large Knowledge Base

**Scenario**: 100+ KB entries

**Setup**:
- Create 100 test KB entries
- Run aggregator multiple times

**Expected Behavior**:
- First run: < 5 seconds
- Subsequent runs with cache: < 1 second
- Memory usage reasonable

**Verification**:
```bash
# Time first run (no cache)
rm -f .fractary/cache/kb-aggregator-cache.json
time /fractary-faber:knowledge-aggregator --format json > /dev/null
# Expected: Reasonable time

# Time cached run
time /fractary-faber:knowledge-aggregator --format json > /dev/null
# Expected: Significantly faster
```

---

## Test Summary

| Test | Category | Priority | Status |
|------|----------|----------|--------|
| 1 | Parsing | High | Must Pass |
| 2 | Parsing | Medium | Must Pass |
| 3 | Cache | High | Must Pass |
| 4 | Cache | High | Must Pass |
| 5 | Multi-Source | High | Must Pass |
| 6 | Filtering | Medium | Must Pass |
| 7 | Filtering | Medium | Must Pass |
| 8 | Filtering | Medium | Should Pass |
| 9 | Scoring | Low | Should Pass |
| 10 | Limits | Medium | Must Pass |
| 11 | Edge Case | Medium | Must Pass |
| 12 | Security | Critical | Must Pass |
| P1 | Performance | Medium | Should Pass |

## Running Tests

```bash
# Run all knowledge-aggregator tests
./scripts/run-kb-tests.sh

# Run specific test
./scripts/run-kb-tests.sh --test 1

# Run category
./scripts/run-kb-tests.sh --category parsing
./scripts/run-kb-tests.sh --category cache
./scripts/run-kb-tests.sh --category security
```
