---
id: KB-type-001
title: TypeScript type mismatch error
category: type_system
severity: high
symptoms:
  - "Type 'X' is not assignable to type 'Y'"
  - "TS2322: Type"
  - "Property does not exist on type"
  - "TS2339: Property"
agents:
  - software-engineer
  - architect
phases:
  - build
  - evaluate
context_type: agent
tags:
  - typescript
  - types
  - type-error
created: 2026-01-28
verified: true
success_count: 20
---

# TypeScript Type Mismatch Error

## Symptoms

The build phase fails with TypeScript type errors:
- `Type 'string' is not assignable to type 'number'`
- `TS2322: Type 'X' is not assignable to type 'Y'`
- `Property 'foo' does not exist on type 'Bar'`
- `Argument of type 'A' is not assignable to parameter of type 'B'`

## Root Cause

Type mismatches occur due to:
- Incorrect type annotations
- API response shape not matching expected interface
- Missing optional property markers (`?`)
- Outdated type definitions after refactoring
- Implicit `any` types causing downstream errors

## Solution

Fix the type mismatch by updating types or implementation.

### Actions

1. Locate the exact file and line from the error message

2. Compare the expected type with the actual value:
   - Check interface/type definitions
   - Verify function parameter types
   - Review return type annotations

3. Common fixes:
   - Add optional marker: `property?: string`
   - Use type assertion: `value as ExpectedType`
   - Update interface to match actual shape
   - Add type guard: `if ('prop' in obj)`

4. For API responses, ensure types match actual payload:
   ```typescript
   interface ApiResponse {
     data: ActualShape;
     // Add any missing properties
   }
   ```

5. Re-run type check:
   ```bash
   npm run typecheck
   ```

## Prevention

- Enable strict mode in tsconfig.json
- Use `unknown` instead of `any` for unknown types
- Generate types from API schemas (OpenAPI, GraphQL)
- Add type tests for critical interfaces
- Review type changes in code reviews
