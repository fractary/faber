---
id: KB-test-002
title: Test assertion failure
category: test_failure
severity: high
symptoms:
  - "Expected X but received Y"
  - "Assertion failed"
  - "toBe received"
  - "toEqual expected"
agents:
  - test-runner
  - software-engineer
phases:
  - evaluate
context_type: agent
tags:
  - tests
  - assertions
  - jest
  - failing-tests
created: 2026-01-28
verified: true
success_count: 25
---

# Test Assertion Failure

## Symptoms

Tests fail because assertions don't match expected values:
- `expect(received).toBe(expected)`
- `Expected: "foo", Received: "bar"`
- `Object comparison failed`
- `Array does not match expected`

## Root Cause

Assertion failures indicate:
- Implementation doesn't match expected behavior
- Test expectations are outdated after refactoring
- Edge cases not handled in implementation
- Async timing issues causing race conditions
- Floating point precision issues
- Object reference vs value comparison issues

## Solution

Determine whether to fix the implementation or update the test.

### Actions

1. Review the test assertion and expected behavior:
   - Is the expected value correct based on requirements?
   - Has the expected behavior changed intentionally?

2. If implementation is wrong, fix the code:
   - Check the function/component being tested
   - Trace the logic to find the bug
   - Fix and verify locally

3. If test is outdated, update expectations:
   ```typescript
   // Before
   expect(result).toBe('old-value');
   // After
   expect(result).toBe('new-value');
   ```

4. For object comparisons, use correct matcher:
   ```typescript
   // For value equality
   expect(obj).toEqual({ key: 'value' });
   // For partial matching
   expect(obj).toMatchObject({ key: 'value' });
   ```

5. For async assertions, ensure proper waiting:
   ```typescript
   await expect(asyncFn()).resolves.toBe(expected);
   ```

6. Re-run the specific test:
   ```bash
   npm test -- --testNamePattern="test name"
   ```

## Prevention

- Write tests before or alongside implementation (TDD)
- Keep tests focused on behavior, not implementation details
- Use descriptive test names that explain expected behavior
- Review test changes in PRs for unintentional modifications
- Use snapshot testing cautiously, review changes carefully
