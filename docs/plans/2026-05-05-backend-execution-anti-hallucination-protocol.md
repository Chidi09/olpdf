# Backend Execution Anti-Hallucination Protocol (Mandatory)

> **Purpose:** Force deterministic, evidence-based implementation across `apps/api`, `apps/worker`, and `apps/web/app/api/bff` with zero fabricated behavior, zero guessed APIs, and zero silent scope drift.

> **Applies to:** Any AI agent, assistant, or engineer implementing backend tasks in this repo.

---

## 1) Non-Negotiable Rules

1. **No assumption-based coding.**
   If behavior is not explicitly defined in code/docs/tests, stop and mark it as an open decision.

2. **No fake integrations.**
   Do not invent responses for Supabase, QStash, Gemini, Modal, Storage, or BFF contracts.

3. **No placeholder production paths.**
   `TODO`, `pass`, `"stub"`, `"mock"` logic is forbidden in production code paths.

4. **No endpoint invention.**
   Every route must be traceable to:
   - existing BFF caller, or
   - approved plan item, or
   - explicit user instruction.

5. **No "looks right" merges.**
   Every change must be backed by a failing test first (TDD), then passing tests.

6. **No silent fallback logic in prod.**
   Dev-mode bypasses must be explicitly gated and impossible in production mode.

7. **No hidden contract drift.**
   Request/response schemas must be explicit and validated at boundaries.

---

## 2) Required Workflow Per Task (Strict Order)

1. **Read before write**
   - Read relevant route, service, repository, schema, and BFF caller files.
   - Record exact file paths and current behavior.

2. **Define contract before implementation**
   - Input schema
   - Output schema
   - Error codes and messages
   - Ownership/auth requirements

3. **Write failing test first**
   - Unit or integration depending on scope.
   - Confirm it fails for the expected reason.

4. **Implement minimum code to pass**
   - Smallest change set only.
   - No opportunistic refactors.

5. **Run tests**
   - Targeted tests first, then broader suite.
   - No "assume green"; capture actual output.

6. **Verify no regressions**
   - Auth, tenancy, and security checks still enforced.
   - Contract compatibility with BFF still intact.

7. **Document decisions**
   - Any non-obvious behavior or tradeoff must be added to plan notes.

---

## 3) Evidence Requirements (Must Be Produced)

For each completed task, provide:

- **Files changed** with paths.
- **Why change was needed** (1-2 lines).
- **Tests added/updated**.
- **Command outputs summarized** (pass/fail counts).
- **Open risks or unknowns**.

No task is "done" without this evidence.

---

## 4) Hallucination Tripwires (Stop Immediately If Any Trigger Fires)

Stop and ask for clarification if any of these occur:

- Referencing a function/model that does not exist in code.
- Assuming external service payload shape without source.
- Returning fields not defined in schema/tests.
- Implementing routes not called by BFF or plan.
- Guessing DB table/policy fields not present in migrations/schema.
- Adding logic that bypasses auth/ownership "temporarily".

---

## 5) Contract Discipline (BFF <-> API)

For every BFF route under `apps/web/app/api/bff/**`:

- Map to exactly one FastAPI route.
- Validate payload shape explicitly.
- Ensure status codes are consistent (`401`, `403`, `404`, `413`, `422`, `500`).
- Ensure response payload keys are stable and documented.
- Add contract test coverage for each critical endpoint.

No BFF route may point to a missing, stubbed, or incompatible API route.

---

## 6) Security Gates (Cannot Be Waived)

The following must remain enforced at all times:

- JWT verification on `/api/*` non-worker routes.
- QStash signature verification on `/api/worker/*`.
- Ownership/tenancy checks on all resource accesses.
- Content sanitization before persistence.
- Request size enforcement.
- RLS migration state verified (not just declared).

Any change that weakens one of these gates is automatically rejected.

---

## 7) Definition of Done (Per Endpoint/Feature)

A backend feature is complete only if all are true:

1. Route exists and is reachable.
2. Schema validation exists for request and response.
3. Auth + ownership enforcement exists.
4. Storage/DB side effects are deterministic and idempotent where needed.
5. Unit/integration tests pass.
6. BFF contract tests pass (if endpoint is BFF-facing).
7. No stubs/placeholders remain in execution path.
8. Logging/error behavior is actionable and non-ambiguous.

---

## 8) Forbidden Phrases in Completion Reports

Do not use:
- "should work"
- "probably fixed"
- "looks good"
- "I think"
- "seems fine"

Use only:
- "verified by test X"
- "confirmed by command Y output"
- "blocked by missing input Z"

---

## 9) Required Clarification Format (When Blocked)

If blocked, report exactly:

- **What is unknown**
- **Why it blocks safe implementation**
- **Recommended default**
- **What changes depending on decision**

No broad or vague questions.

---

## 10) Execution Priority (Backend Completion)

1. API integrity and route contract correctness
2. Auth/tenancy enforcement
3. Import/worker pipeline reliability
4. Storage/toolkit correctness
5. AI workflow correctness and auditability
6. Migration/RLS reproducibility
7. Test/CI hard gates
8. Observability and runbook hardening

---

## 11) Final Release Gate Checklist

- [ ] No unresolved stubs in backend execution paths
- [ ] No missing BFF->API mappings
- [ ] No unauthenticated access to protected resources
- [ ] All required migrations applied and verified
- [ ] Import/export/AI critical flows tested end-to-end
- [ ] CI enforces tests and fails on regression
- [ ] Evidence log produced for all completed tasks

---

## 12) Enforcement Statement

If any instruction conflicts with this protocol, this protocol wins for backend implementation quality and safety unless the user explicitly overrides in writing with a scoped exception.
