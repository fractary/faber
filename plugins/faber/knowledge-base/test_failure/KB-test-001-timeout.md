---
id: KB-test-001
title: Test suite timeout
category: test_failure
severity: medium
symptoms:
  - "Test timeout"
  - "Exceeded timeout of"
  - "Tests did not complete"
  - "Jest did not exit"
agents:
  - test-runner
  - software-engineer
phases:
  - evaluate
context_type: agent
tags:
  - tests
  - timeout
  - jest
  - performance
created: 2026-01-28
verified: true
success_count: 10
---

# Test Suite Timeout

## Symptoms

The evaluate phase fails because tests take too long or hang:
- `Exceeded timeout of 5000 ms for a test`
- `Jest did not exit one second after the test run has completed`
- Tests run indefinitely without completing
- CI/CD pipeline times out during test phase

## Root Cause

Test timeouts typically result from:
- Async operations not properly awaited or resolved
- Database connections not being closed
- Open handles (timers, sockets, file descriptors)
- Slow external API calls in tests
- Missing mocks for expensive operations
- Infinite loops or blocking code

## Solution

Identify and fix the timeout cause.

### Actions

1. Run tests with `--detectOpenHandles` to find unclosed handles:
   ```bash
   npm test -- --detectOpenHandles
   ```

2. For specific slow tests, increase timeout:
   ```typescript
   test('slow operation', async () => {
     // test code
   }, 30000); // 30 second timeout
   ```

3. Mock external services and APIs:
   ```typescript
   jest.mock('./api-client', () => ({
     fetchData: jest.fn().mockResolvedValue({ data: 'mocked' })
   }));
   ```

4. Ensure all async operations complete:
   ```typescript
   afterAll(async () => {
     await database.close();
     await server.stop();
   });
   ```

5. Clear timers and intervals in cleanup:
   ```typescript
   afterEach(() => {
     jest.clearAllTimers();
   });
   ```

6. Re-run tests:
   ```bash
   npm test
   ```

## Prevention

- Always mock external dependencies in unit tests
- Use `jest.useFakeTimers()` for time-dependent tests
- Close all connections in `afterAll` hooks
- Set reasonable global timeout in Jest config
- Run tests with `--forceExit` in CI as last resort
