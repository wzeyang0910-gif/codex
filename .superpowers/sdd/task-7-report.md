# Task 7 Report

## Status

Implemented Task and Customer API routes with signed HttpOnly session cookies, ownership authorization, quota checks based on `deliveredAt`, post-response task scheduling via `after()`, and mock-backed task processing/persistence.

## RED Evidence

- `npm test -- task-contract.test.ts session-token.test.ts task-processing.test.ts`
  - Failed before implementation because `@/lib/api-contracts`, `@/lib/session-token`, and `@/server/tasks/process-task` did not exist.
- `npm test -- session-token.test.ts`
  - Added cookie-safety regression and confirmed RED: token contained percent escapes that could be double-encoded in cookies.

## GREEN Evidence

- `npm test -- task-contract.test.ts session-token.test.ts task-processing.test.ts`
  - 3 files passed, 13 tests passed.
- `npm test`
  - 14 files passed, 55 tests passed.
- `npm run typecheck`
  - TypeScript exited with code 0.

## Files

- `web/src/app/api/tasks/route.ts`
- `web/src/app/api/tasks/[taskId]/route.ts`
- `web/src/app/api/customers/[customerId]/route.ts`
- `web/src/app/api/auth/login/route.ts`
- `web/src/app/api/auth/me/route.ts`
- `web/src/lib/api-contracts.ts`
- `web/src/lib/session-token.ts`
- `web/src/lib/session.ts`
- `web/src/server/tasks/process-task.ts`
- `web/tests/api/task-contract.test.ts`
- `web/tests/unit/session-token.test.ts`
- `web/tests/unit/task-processing.test.ts`

## Commit

- `5ab2a8a feat: add task and customer API contracts`

## Self-Review

- `CreateTaskSchema` rejects browser-supplied `userId`; routes derive identity from signed session cookies.
- Session token uses HMAC SHA-256, expiry, tamper rejection, and cookie-safe base64url payloads.
- Runtime session helpers require `SESSION_SECRET`; missing or invalid session material fails closed.
- Task/customer access maps missing sessions to 401 and wrong owners to 403; admins can access across owners.
- Quota counts only delivered companies with `deliveredAt` in today's range and requests 5.
- `POST /api/tasks` creates queued work and schedules `processLeadTask(task.id)` via `after()`.
- Processing uses `createAdapterSet()` and `runLeadPipeline`, wraps search with global company dedupe, persists contacts, source evidence, each demand signal, and outreach, then maps final counts/status.

## Concerns

- The executable adapter remains mock-backed as required; live provider integration is intentionally out of scope.
- Route tests cover schemas and authorization helpers, while processing persistence is unit-tested through injectable dependencies rather than a real database.

## Review Fix Evidence

### RED

- `npm test -- tests/api/task-routes.test.ts tests/unit/session-token.test.ts tests/unit/task-processing.test.ts`
  - 3 files failed; 8 assertions failed and 10 passed.
  - Missing-session `GET /api/tasks/:taskId` returned `404` after lookup instead of `401`.
  - Missing-session `PATCH /api/customers/:customerId` returned `400` after body validation instead of `401`.
  - The Asia/Shanghai day-bounds helper was absent.
  - A rejected `after()` callback propagated outward.
  - A simulated Prisma `P2002` stopped after two creates instead of preserving the later delivery.
  - Task lookup and initial running-status failures both rejected outward.
  - A token at its exact `exp` second was accepted instead of rejected.

### GREEN

- `npm test -- tests/api/task-routes.test.ts tests/unit/session-token.test.ts tests/unit/task-processing.test.ts`
  - 3 files passed; 18 tests passed.
- `npm test`
  - 15 files passed; 65 tests passed.
- `npm run typecheck`
  - TypeScript exited with code 0.

### Review Fixes

- Protected task detail and customer update routes authenticate before parameters, validation, or database access; authenticated non-owners still receive `403`.
- Quota day bounds are a pure `Asia/Shanghai` UTC `[start, end)` helper, and the existing `deliveredAt: { gte, lt }` query uses those bounds.
- Session expiry rejects `exp <= now`.
- `processLeadTask` guards lookup, initial status, pipeline, persistence, final status, and its best-effort failed-status update so it never rejects outward.
- Prisma `P2002` is counted as a per-company rejection, preserving other creates and deriving the final status/counts from actual successful creates.
- The post-response callback catches any unexpected worker rejection without logging request/session material.

## Final Authorization and Quota Reservation Fix

### RED

- `npm test -- tests/api/task-routes.test.ts`
  - 10 tests ran; 4 new regression tests failed and 6 existing tests passed.
  - An authenticated non-owner with `{}` received `400` instead of `403` before any update.
  - Twenty delivered customers plus one queued five-customer task returned `remaining: 5` instead of `remaining: 0`.
  - Task creation did not call a Serializable Prisma transaction.
  - A simulated Prisma `P2034` serialization conflict returned `200` rather than a readable `409` retry response.

### GREEN

- `npm test -- tests/api/task-routes.test.ts`
  - 1 file passed; 10 tests passed.
- `npm test -- tests/api/task-contract.test.ts tests/api/task-routes.test.ts tests/unit/session-token.test.ts tests/unit/task-processing.test.ts`
  - 4 files passed; 27 tests passed.
- `npm test`
  - 15 files passed; 69 tests passed.
- `npm run typecheck`
  - TypeScript exited with code 0.

### Final Fixes

- Customer PATCH now follows session -> customer lookup -> ownership decision -> body parsing and validation -> update.
- Task creation now counts delivered customers and queued/running task reservations inside one `Serializable` Prisma transaction before creating the queued task.
- Only queued and running tasks reserve their `targetCount`; completed, partial, and failed tasks are excluded because delivered companies are counted directly.
- Quota denial remains `429`; Prisma `P2034` returns `409` with a retry message and does not schedule post-response processing.
