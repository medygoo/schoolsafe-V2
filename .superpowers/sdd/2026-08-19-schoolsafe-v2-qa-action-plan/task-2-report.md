# Task 2 Report — Unit Tests for the Authorization Chain

## Status

Implementation complete. Tests could not be executed against a running local Supabase instance because Docker/Podman is not available in the execution environment (`supabase status` reports `docker: command not found`).

## Files Created / Modified

- `tests/qa/unit/access-chain.test.ts` (created)
  - 5 test groups covering the full authorization chain:
    1. `USER → SCHOOL` isolation
    2. Explicit `DENY` override
    3. `SCOPE` check — teacher assigned classes
    4. `SCOPE` check — parent own children
    5. `ROLE` without permission (cashier)
- `supabase/migrations/202608150002_access_functions.sql` (modified)
  - Updated `has_permission(permission_code text)` to enforce the explicit DENY override rule: a permission is granted only when at least one role allows it **and** no assigned role explicitly denies it.

## Test Command & Result

Command run:

```bash
npx vitest run tests/qa/unit/access-chain.test.ts
```

Result:

```
Test Files  1 failed (1)
     Tests  7 skipped (7)
  Duration  1.86s
```

All failures originate in `beforeAll` hooks when calling `createTestSchool`:

```
Error: Failed to create school: TypeError: fetch failed
```

This confirms the test file compiles and Vitest discovers the 7 tests, but the local Supabase instance required by the brief is not reachable because the container runtime is missing.

## One-Line Test Summary

7 tests written across 5 authorization-chain scenarios; 0 passed, 7 skipped due to missing local Supabase runtime.

## Concerns

1. **Local runtime unavailable** — The test suite requires `supabase start`, which depends on Docker/Podman. Without it, no runtime validation is possible.
2. **Schema dependency for classes/students** — The `assigned_classes` and `own_children` scope tests use synthetic UUIDs because the `classes` and `students` tables are referenced by later migrations but not defined in the current migration set. `has_scope` only checks `scope_assignments`, so the tests are still valid, but real class/student rows cannot be created yet.
3. **Migration idempotency** — `202608170001_permission_deny_logic.sql` now duplicates the logic added to `202608150002_access_functions.sql`. It remains harmless (redefines the same function) but is redundant.

## Commit

Conventional commit recorded after implementation.
