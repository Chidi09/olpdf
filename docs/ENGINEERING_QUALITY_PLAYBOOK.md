# OLPDF Engineering Quality Playbook

Version: 1.0
Owner: Engineering
Scope: `apps/web`, `apps/api`, `apps/worker`, `packages/*`

---

## 1) Purpose

This playbook defines mandatory engineering standards for building and operating OLPDF as a production-grade, structure-first AI document system.

Goals:
- Ship safely and predictably.
- Preserve data integrity and user trust.
- Keep architecture evolvable under rapid product growth.
- Avoid accidental complexity.

---

## 2) Non-Negotiable Principles

- Structure first, AI second.
- Async by default for heavy operations.
- Deterministic mutations for document model changes.
- Idempotent job and webhook handling.
- Evidence before completion claims.
- Simplicity first (YAGNI), then extensibility where justified.

---

## 3) Engineering Checklist (Definition of Ready / Done)

## 3.1 Definition of Ready (DoR)

- [ ] Problem statement is clear (user pain + expected outcome).
- [ ] Scope includes explicit in/out boundaries.
- [ ] API contracts are defined (request, response, error).
- [ ] Data model impact is documented.
- [ ] Security and privacy impact assessed.
- [ ] Observability plan included (logs/metrics/traces).
- [ ] Rollback strategy prepared.

## 3.2 Definition of Done (DoD)

- [ ] Feature implemented behind stable contracts.
- [ ] Unit/integration tests pass.
- [ ] Lint/typecheck/build pass in monorepo.
- [ ] Idempotency confirmed for write-heavy endpoints/jobs.
- [ ] Failure paths tested (timeouts, retries, partial failures).
- [ ] Audit logging present for irreversible mutations.
- [ ] Docs updated (behavior, config, runbook).
- [ ] Metrics and alerts wired.

---

## 4) Core Quality Practices

## 4.1 ACID (Transactional Integrity)

Use ACID guarantees for critical data writes:
- Atomicity: multi-step writes should commit or fail as one unit.
- Consistency: enforce schema and domain invariants.
- Isolation: avoid race conditions on shared records.
- Durability: persisted writes survive process crashes.

Implementation guidance:
- Use database transactions when mutating coupled tables.
- Enforce status transition constraints in write paths.
- For external side effects (queue, storage), use outbox pattern where needed.

Checklist:
- [ ] Transaction boundaries identified.
- [ ] Invariants enforced in service layer.
- [ ] Concurrent update strategy defined (versioning/locks).

## 4.2 Idempotency

All retry-prone operations must be idempotent:
- Webhooks (QStash), async workers, import/export starts, apply template.
- Accept/reject AI logs, snapshot creation, background indexing.

Patterns:
- Idempotency-Key header + persistence table.
- Natural idempotency keys (`document_id`, `job_id`, `log_id`).
- Upsert semantics with conflict handling.

Checklist:
- [ ] Duplicate request returns safe same-result behavior.
- [ ] Side effects are not duplicated.
- [ ] Idempotency key retention/TTL defined.

## 4.3 DRY (Do not repeat yourself)

Avoid duplicated logic in:
- BFF forwarding and error translation.
- Document model transforms.
- Shared UI primitives/tokens.
- Route auth/rate-limit guards.

Checklist:
- [ ] Common logic extracted to shared modules.
- [ ] Repeated constants promoted to config/tokens.
- [ ] No copy-paste business logic across layers.

Note: user wording included "FRY"; the intended principle is DRY.

## 4.4 YAGNI (You Aren't Gonna Need It)

Do not add speculative abstractions.

Allowed:
- Minimal extension points with real near-term use.

Disallowed:
- Generic frameworks for one current use-case.
- Feature flags for features not planned in current quarter.

Checklist:
- [ ] Every abstraction has at least two concrete use cases.
- [ ] Unused options removed.

## 4.5 KISS (Keep it simple)

- Prefer straightforward control flow.
- Avoid deep inheritance trees.
- Use composition over complicated class hierarchies.

## 4.6 SOLID (When writing object-oriented/service modules)

- Single Responsibility.
- Open/Closed.
- Liskov Substitution.
- Interface Segregation.
- Dependency Inversion.

Checklist:
- [ ] Services each own one reason to change.
- [ ] Concrete dependencies hidden behind interfaces for key integrations.

## 4.7 Separation of Concerns

- UI rendering != orchestration != domain logic != persistence.
- BFF should shape requests, not reimplement backend business rules.

---

## 5) Required Design Patterns

## 5.1 Factory Pattern

Use factories for provider/model and exporter creation.

Examples:
- `AIProviderFactory`: Gemini/OpenAI/Anthropic/local providers.
- `ExportEngineFactory`: pdf, pdfa, tagged, epub.
- `ToolkitOperationFactory`: merge/split/compress/rotate/etc.

Checklist:
- [ ] Creation logic is centralized.
- [ ] Callers depend on stable interfaces.

## 5.2 Strategy Pattern

Use for replaceable algorithms:
- Vision routing strategies (native, OCR, table extraction, preserve).
- AI model routing per task.
- Redaction and extraction variants.

## 5.3 Adapter Pattern

Use for third-party SDK wrapping:
- Gemini/OpenAI/Anthropic adapters normalized to one AI interface.
- Storage adapter for Supabase/local dev storage.

## 5.4 Repository Pattern

Use repositories for data access boundaries:
- `DocumentRepository`, `BookRepository`, `TemplateRepository`, `AuditLogRepository`.

## 5.5 Unit of Work Pattern

For grouped changes requiring transaction semantics.

## 5.6 Command Pattern

For deterministic document mutations:
- RewriteBlock, InsertBlock, DeleteBlock, ReorderBlocks, UpdateStyle.

## 5.7 Outbox Pattern

For reliable side effects after DB commit:
- emit job events only when source write succeeds.

## 5.8 Saga Pattern (orchestrated)

For long-running multi-step flows:
- import -> classify -> extract -> OCR -> merge blocks -> finalize.

## 5.9 Circuit Breaker / Retry with backoff

For external dependencies (AI, storage, queues).

## 5.10 Cache-Aside

For read-heavy metadata/template listing with safe invalidation.

---

## 6) API and Contract Rules

## 6.1 Contract-first

- Define schemas before implementation.
- Keep request/response backwards compatible unless versioning.

Checklist:
- [ ] Schema validated at boundaries.
- [ ] Error response shape standardized.
- [ ] Breaking changes versioned.

## 6.2 Error Model

Return structured errors:
```
{
  "error": "machine_code",
  "message": "human readable",
  "details": {...},
  "request_id": "..."
}
```

## 6.3 Idempotent HTTP semantics

- `GET`: no side effects.
- `PUT`: full replace or deterministic update.
- `POST`: use idempotency key when retryable.
- `DELETE`: safe to repeat.

---

## 7) Data Modeling Rules

- Use explicit enums for statuses (`draft/review/final`, `queued/processing/ready/failed`).
- Preserve append-only audit history for AI actions.
- Keep immutable event records for critical transitions.
- Prefer additive schema changes.

Checklist:
- [ ] Constraints and indexes defined.
- [ ] RLS policies reviewed.
- [ ] Migration includes rollback plan.

---

## 8) Security, Privacy, Compliance

## 8.1 Security checklist

- [ ] AuthN/AuthZ validated on all sensitive routes.
- [ ] Rate limits applied by route class.
- [ ] Input validated and sanitized.
- [ ] Worker routes verify signatures.
- [ ] Secrets never logged.

## 8.2 Privacy checklist

- [ ] Guest mode data remains local by default.
- [ ] Data retention and deletion behavior documented.
- [ ] PII handling in logs redacted.

## 8.3 Document safety checklist

- [ ] True redaction removes underlying vectors.
- [ ] Export preflight enforces accessibility warnings/errors.
- [ ] Placeholder unresolved warnings included pre-export.

---

## 9) Reliability and Async Operations

## 9.1 Background job rules

- Use queue for operations likely to exceed HTTP budgets.
- Persist job state transitions.
- Retry with exponential backoff and max attempts.
- Dead-letter failed jobs and alert.

Checklist:
- [ ] Job status persisted.
- [ ] Retries bounded.
- [ ] Duplicate deliveries handled idempotently.

## 9.2 Partial progress UX rules

- Never block UI with indefinite spinners.
- Show deterministic progress where possible.
- Provide cancel and resume semantics for imports.

---

## 10) AI Engineering Practices

## 10.1 Tool-calling discipline

- Use function-calling mode for model-to-state changes.
- Validate tool args strictly before apply.
- Reject unknown block IDs/types safely.

## 10.2 Prompt safety

- Delimit user instructions.
- Keep context minimal and scoped.
- Never allow model direct DB writes.

## 10.3 Auditability

- Persist tool calls and before/after snapshots.
- Separate `pending_review`, `accepted`, `rejected` states.

Checklist:
- [ ] Every AI mutation is auditable.
- [ ] Accept/reject path tested.

---

## 11) Frontend Architecture Practices

- Shared UI components from `packages/ui` only for common primitives.
- Tokenized theme variables; no random hardcoded colors for core UI.
- Keep page composition thin; put complex logic in hooks/services.
- Use React Query for server state, local store for UI state only.

Checklist:
- [ ] No duplicated primitive components in app layer.
- [ ] Loading/error/empty states implemented on all data screens.
- [ ] Accessibility checks for interactive controls.

---

## 12) Testing Strategy

## 12.1 Pyramid

- Unit tests: pure logic (transformers, classifiers, preflight rules).
- Integration tests: routes + repositories + external mocks.
- E2E tests: critical user journeys (import/edit/export, AI review, book flow).

## 12.2 Required test cases

- Idempotency replay tests.
- Status transition guard tests.
- Preflight rule coverage.
- Redaction correctness regression tests.
- AI accept/reject integrity tests.

---

## 13) Observability and Operations

- Structured logs with `request_id`, `user_id`, `document_id`, `job_id`.
- Metrics: latency, error rate, queue depth, job success, AI token cost.
- Traces across BFF -> API -> queue -> worker.

Checklist:
- [ ] Alert thresholds defined for critical paths.
- [ ] Runbook exists for import/export/AI incidents.

---

## 14) Performance Practices

- Budget critical route latency.
- Stream large files when practical.
- Avoid N+1 DB access patterns.
- Batch vector operations.

Checklist:
- [ ] Hot paths benchmarked.
- [ ] Slow query logging enabled.

---

## 15) Code Review Checklist

- [ ] Correctness: fulfills requirement and edge cases.
- [ ] Security/privacy impacts handled.
- [ ] Idempotency and retry safety verified.
- [ ] Simplicity: YAGNI/KISS respected.
- [ ] Reuse: DRY maintained.
- [ ] Tests and docs updated.

---

## 16) Anti-Patterns to Avoid

- Business logic inside BFF route handlers.
- AI-generated free-form state writes without tool validation.
- Long synchronous imports/exports in request path.
- Hardcoded secrets, IDs, or token strings.
- Over-engineered abstraction without second real use case.

---

## 17) OLPDF-Specific Flow Completeness Checklist

## 17.1 Onboarding/Auth
- [ ] Guest mode with explicit local-only banner.
- [ ] Google auth path and callback.
- [ ] Upgrade prompts from guest to account.

## 17.2 Landing Trust Surface
- [ ] Explicit open-source statement.
- [ ] GitHub stars live badge.
- [ ] Docs, Privacy, Terms, Contribute links visible.

## 17.3 Document Studio
- [ ] Import queue + progress + strategy breakdown.
- [ ] Needs-review visual indicators from confidence score.
- [ ] Preflight gate before export.

## 17.4 Templates
- [ ] At least 10 curated templates.
- [ ] Search/filter/category and usage count.
- [ ] Apply template with idempotent behavior.

## 17.5 Toolkit
- [ ] Merge, split, compress, rotate, watermark, protect.
- [ ] True redaction and form detect/fill.
- [ ] Extract images and OCR kickoff.

## 17.6 Book Maker
- [ ] Chapter lifecycle guard.
- [ ] Embedding index trigger on review transition.
- [ ] Consistency check with provenance citations.

---

## 18) Governance and Change Control

- Changes to this playbook require engineering lead approval.
- Breaking-standard exceptions must include risk signoff and expiry date.

---

## 19) Quick Start Quality Gate (Copy/Paste)

Before merge:
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] Endpoint idempotency checked
- [ ] Error payload shape confirmed
- [ ] Security and privacy checklist completed
- [ ] Docs updated
