# Task 6 Report — QA Report Template and Generator

## Status

DONE

## Files Created

- `tests/qa/qa-report-template.md` — Markdown template with placeholders for date, test counts, and prioritized gap tables.
- `tests/qa/generate-report.ts` — TypeScript generator that reads a JSON input and produces a dated report.
- `tests/qa/sample-results.json` — Sample input data reflecting current test status and gaps from the diagnostic.
- `tests/qa/qa-report-2026-08-20.md` — Sample generated report.

## Command Run

```bash
npx tsx tests/qa/generate-report.ts tests/qa/sample-results.json
```

Output:

```
Report written to C:\Users\account\Videos\SchoolSafe V2\.worktrees\qa\2026-08-19-action-plan\tests\qa\qa-report-2026-08-20.md
```

## Test Summary

The generator produces a complete markdown report with:
- Summary counts (profiles, permissions, unit/RLS/integration/E2E tests).
- P0 / P1 / P2 gap tables.
- GO/NO-GO recommendation.

## Concerns

- The sample report uses placeholder counts for unit/RLS tests (0 passed) because the local Supabase runtime is unavailable.
- Once real test results are available, replace `sample-results.json` or pipe actual results into the generator.

## Commit

`test(qa): add QA report template and generator`
