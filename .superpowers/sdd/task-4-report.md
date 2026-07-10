# Task 4 Report: Lead Scoring, Dedupe, Evidence, and Outreach Rules

## Status

DONE_WITH_CONCERNS

## Files Changed

- `web/src/lib/dedupe.ts`
- `web/src/lib/evidence.ts`
- `web/src/lib/scoring.ts`
- `web/src/lib/outreach.ts`
- `web/tests/unit/dedupe.test.ts`
- `web/tests/unit/evidence.test.ts`
- `web/tests/unit/scoring.test.ts`
- `web/tests/unit/outreach.test.ts`

## Implementation Summary

- Added deterministic company-name normalization and domain extraction helpers.
- Added source evidence normalization with trimmed fields and ISO collection timestamp.
- Added lead scoring rules using Prisma `EmailStatus` and `LeadGrade`, including rejection for missing key person or missing valid/accept-all personal work email.
- Added accept-all risk handling with the required exact risk note and grade cap at B.
- Added professional outreach letter generation using only customer-specific input facts plus Yonye factory strengths required by the brief.

## TDD Evidence

Initial red run after adding tests:

```text
npm test -- scoring.test.ts dedupe.test.ts evidence.test.ts outreach.test.ts
Exit code: 1
Failed Suites 4
Reason: Failed to resolve imports for @/lib/dedupe, @/lib/evidence, @/lib/outreach, and @/lib/scoring because the modules did not exist.
```

First implementation run:

```text
npm test -- scoring.test.ts dedupe.test.ts evidence.test.ts outreach.test.ts
Exit code: 1
8 tests passed, 1 failed
Failure: dedupe non-Latin fixture lost a private-use character during punctuation normalization.
```

Final focused test run:

```text
npm test -- scoring.test.ts dedupe.test.ts evidence.test.ts outreach.test.ts
Exit code: 0
Test Files 4 passed (4)
Tests 9 passed (9)
```

Typecheck:

```text
npm run typecheck
Exit code: 0
tsc --noEmit
```

## Commit

`7078b965fc468f6f28ae61c5197151935fd6b474`

Commit message:

```text
feat: add lead scoring dedupe and outreach rules
```

## Concerns

- Vitest prints the existing Vite CJS Node API deprecation warning during tests. It did not fail the test run.
- The required Chinese risk-note string and one non-Latin test fixture appear mojibake-encoded in the brief; implementation preserves the exact visible required string for compatibility with the provided tests.
- The report file was written after the required code commit so it could include the final commit hash.

## Fix Note: Restore Accept-All Risk Note Copy

Files changed:

- `web/src/lib/scoring.ts`
- `web/tests/unit/scoring.test.ts`
- `.superpowers/sdd/task-4-report.md`

Red check:

```text
npm test -- scoring.test.ts
Exit code: 1
Tests: 1 failed, 3 passed
Failure: expected the accept-all risk note to include `邮箱为 accept-all，只能作为 B 类客户`, but scoring returned mojibake text.
```

Verification:

```text
npm test -- scoring.test.ts
Exit code: 0
Test Files 1 passed (1)
Tests 4 passed (4)
```

```text
npm test -- scoring.test.ts dedupe.test.ts evidence.test.ts outreach.test.ts
Exit code: 0
Test Files 4 passed (4)
Tests 9 passed (9)
```

```text
npm run typecheck
Exit code: 0
tsc --noEmit
```

Concerns:

- Vitest still prints the existing Vite CJS Node API deprecation warning during test runs; it does not fail the suite.

## Fix Note: Clean Dedupe Test Copy

Files changed:

- `web/tests/unit/dedupe.test.ts`
- `.superpowers/sdd/task-4-report.md`

Verification:

```text
npm test -- dedupe.test.ts
Exit code: 0
Test Files 1 passed (1)
Tests 4 passed (4)
```

```text
npm test -- scoring.test.ts dedupe.test.ts evidence.test.ts outreach.test.ts
Exit code: 0
Test Files 4 passed (4)
Tests 11 passed (11)
```

```text
npm run typecheck
Exit code: 0
tsc --noEmit
```

Concerns:

- Vitest still prints the existing Vite CJS Node API deprecation warning during test runs; it does not fail the suite.

## Fix Note: Preserve CJK Industry Names and Add Outreach Language Selection

Files changed:

- `web/src/lib/dedupe.ts`
- `web/src/lib/outreach.ts`
- `web/tests/unit/dedupe.test.ts`
- `web/tests/unit/outreach.test.ts`
- `.superpowers/sdd/task-4-report.md`

Red check:

```text
npm test -- dedupe.test.ts outreach.test.ts
Exit code: 1
Failure: Simplified Chinese outreach case expected the subject to contain `原研`, but the helper still returned the English subject.
```

Verification:

```text
npm test -- scoring.test.ts dedupe.test.ts evidence.test.ts outreach.test.ts
Exit code: 0
Test Files 4 passed (4)
Tests 11 passed (11)
```

```text
npm run typecheck
Exit code: 0
tsc --noEmit
```

Concerns:

- Vitest still prints the existing Vite CJS Node API deprecation warning during test runs; it does not fail the suite.
