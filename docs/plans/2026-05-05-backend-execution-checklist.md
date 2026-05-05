# Backend Production Execution Checklist

> **Protocol Binding:** This checklist is governed by `docs/plans/2026-05-05-backend-execution-anti-hallucination-protocol.md`.

> **Scope:** `apps/api`, `apps/worker`, `apps/web/app/api/bff`.

> **Rule:** A task is not complete until all required evidence is captured.

---

## 0) Pre-Flight Gate (Run Before Any Implementation)

- [ ] Confirm scope files and folders exist and are readable.
- [ ] Confirm no task starts without a documented contract (input/output/errors/auth).
- [ ] Confirm testing command baseline is known for API, worker, and BFF paths.
- [ ] Confirm protocol file is linked in task notes.

**Required evidence:**
- Files inspected (paths)
- Baseline command outputs summary

---

## 1) API Integrity and Module Structure

- [ ] Resolve undefined symbols and broken imports in API route modules.
- [ ] Move monolithic route logic to domain routers.
- [ ] Add shared exception handlers and consistent API error model.
- [ ] Add/verify startup app factory behavior.

**Required evidence:**
- Changed files list
- Route table load success output
- Failing test -> passing test proof

---

## 2) BFF-to-API Contract Completion

- [ ] Inventory all BFF routes under `apps/web/app/api/bff/**/route.ts`.
- [ ] Map each BFF route to one concrete FastAPI endpoint.
- [ ] Implement missing API endpoints (no stubs).
- [ ] Validate payload and response schema compatibility.

**Required evidence:**
- Route map matrix (BFF path -> API path)
- Contract test results
- Any unresolved mapping explicitly listed

---

## 3) Authentication, Authorization, and Tenancy

- [ ] Enforce JWT auth for all non-worker `/api/*` routes.
- [ ] Enforce QStash signature checks for all `/api/worker/*` routes.
- [ ] Enforce ownership checks for documents/books/chapters/templates/logs/toolkit operations.
- [ ] Remove production-path auth fallbacks.

**Required evidence:**
- 401/403 test matrix output
- Files containing auth guards/dependencies
- Negative-case tests (unauthenticated and cross-tenant)

---

## 4) Import and Worker Pipeline Reliability

- [ ] Implement `/api/documents/import/start` and `/api/documents/import/{job_id}/status` fully.
- [ ] Confirm dispatch path to worker and callback/update flow.
- [ ] Add idempotency and retry-safe behavior for async jobs.
- [ ] Persist and expose deterministic progress states.

**Required evidence:**
- End-to-end import flow test output
- Retry/idempotency test output
- State transition table (`queued/processing/partial/ready/failed`)

---

## 5) Storage and PDF Toolkit Completion

- [ ] Implement/verify storage upload/download helpers used in API routes.
- [ ] Validate server-side file type and size checks beyond headers.
- [ ] Complete redact/forms detect/forms fill storage roundtrip behavior.
- [ ] Ensure export artifacts are persisted and discoverable.

**Required evidence:**
- Toolkit integration test output
- Error-path coverage (missing file, invalid type, oversize)
- Storage key/path examples from test runs

---

## 6) AI Workflow Completion and Audit Safety

- [ ] Validate instruction route and tool-call argument checks.
- [ ] Ensure accept/reject routes enforce ownership and status constraints.
- [ ] Ensure ai logs include before/after snapshots and actor context.
- [ ] Implement/verify consistency check endpoint contract.

**Required evidence:**
- AI route integration test output
- Sample audit log record fields from test verification
- Failure behavior tests for invalid tool calls

---

## 7) Database Migrations and RLS Reproducibility

- [ ] Ensure all backend-used tables are migration-managed.
- [ ] Ensure RLS is enabled with policies matching ownership model.
- [ ] Add migration apply/verify steps to CI or deployment pipeline.
- [ ] Verify policy behavior with role-based tests.

**Required evidence:**
- Migration files list and apply log summary
- RLS verification test results
- CI job reference showing migration/verification step

---

## 8) Testing and CI Hard Gates

- [ ] Replace placeholder API test command with real test runner.
- [ ] Add unit tests for core helpers/security/sanitization.
- [ ] Add integration tests for all major route groups.
- [ ] Add contract tests for BFF/API compatibility.
- [ ] Enforce coverage threshold and fail-on-regression.

**Required evidence:**
- Test command outputs (unit/integration/contract)
- Coverage report summary
- CI run summary with pass/fail gates

---

## 9) Observability and Release Readiness

- [ ] Add request ID propagation and structured logging.
- [ ] Add health/readiness endpoints and dependency checks.
- [ ] Validate cron behavior for cleanup routes.
- [ ] Document runbooks for rollback, outage, key rotation, and incident triage.

**Required evidence:**
- Logging sample lines with request IDs
- Health endpoint output examples
- Cron config reference and execution proof
- Runbook file paths

---

## 10) Final Sign-Off Gate

- [ ] No backend production path contains `TODO`, `pass`, stub logic, or placeholder behavior.
- [ ] All BFF routes map to real, tested API endpoints.
- [ ] AuthN/AuthZ/RLS gates are verified by tests.
- [ ] Import, export, and AI critical flows pass end-to-end tests.
- [ ] CI blocks merges on regression.
- [ ] Evidence bundle is complete.

**Required evidence bundle format (mandatory):**

For each completed task:
- Files changed
- Why change was needed
- Tests added/updated
- Command output summary
- Remaining risks or unknowns

---

## Appendix A: Task Report Template

Use this exact template per task:

```md
### Task: <name>

- Files changed:
  - `path/to/file1`
  - `path/to/file2`
- Reason:
  - <1-2 lines>
- Tests:
  - Added: `path/to/test`
  - Updated: `path/to/test`
- Commands run:
  - `<command 1>` -> <result summary>
  - `<command 2>` -> <result summary>
- Risks/unknowns:
  - <item or "none">
```

## Appendix B: Blocker Report Template

```md
### Blocker

- Unknown:
  - <what is unknown>
- Why blocked:
  - <why this prevents safe implementation>
- Recommended default:
  - <default choice>
- What changes if different:
  - <impact>
```
