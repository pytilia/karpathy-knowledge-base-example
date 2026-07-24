---
name: Review Coding Standards
description: 17-section enforceable checklist (A–Q). Any MUST violation → CHANGES REQUESTED.
status: active
topic: process
last_reviewed: 2026-05-19
---

# Review Coding Standards

The canonical checklist a reviewer applies in **Phase 3 — Review** of the development workflow. Every standard here is sourced from the global `~/.claude/CLAUDE.md` and the project-level `CLAUDE.md`. The development workflow binds the review agent to this document — the review verdict cannot be APPROVED while any **MUST** rule is violated.

Each standard is structured as:
- **Rule** — the standard, in one sentence.
- **Why** — the reasoning, so you can judge edge cases instead of pattern-matching.
- **How to verify** — concrete steps a reviewer can take (grep, read, test).

Severity:
- **MUST** — blocks approval. Violation → CHANGES REQUESTED.
- **SHOULD** — strong default; a deviation requires an explicit justification in the diff or summary.
- **CONSIDER** — non-blocking suggestion.

---

## Trigger map (apply before walking sections)

The Phase 3 review walks each section only when its **Triggers when** condition fires for the diff under review. A section whose trigger does not fire is recorded as a single line — `NOT TRIGGERED — <reason>` — in the report. Do not synthesise "PASS by non-applicability" prose for inapplicable sections; that is the largest single source of review-phase token waste.

| Section | Triggers when |
|---|---|
| **A. General principles** | any code change |
| **B. Architecture** | backend services, new modules, or shared cross-domain code touched |
| **C. Security** | backend code, route handlers, secrets, user input, queries, error responses, or external-system surface touched |
| **D. Performance** | DB queries, pagination, sort/filter, or external-call loops touched |
| **E. Code quality** | any code change |
| **F. Code hygiene** | any code change |
| **G. Framework / API-layer specifics** | API route handlers or request/response schemas touched |
| **H. ORM / data-access specifics** | data models or session/query code touched |
| **I. Database migrations** | migration files touched |
| **J. Testing** | any code change (tests anchor every behavioural slice) |
| **K. Frontend specifics** | frontend source touched |
| **L. Git and commits** | always (applies to the commit set on the branch) |
| **M. Plan compliance** | a `plan.md` exists for this iteration |
| **N. Behaviour change visibility** | observable behaviour changed (wire, API, UI, persisted state, error code) |
| **O. Infrastructure** | `infra/` or equivalent IaC files touched |
| **P. Docker** | `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`, or build files touched |
| **Q. CI/CD** | `.github/workflows/` touched |

Re-reviews — whether per-slice (`code-review-slice-<N>-<rev>.md` for `<rev>` > 1) or final integration (`code-review-final-<N>.md` for N > 1) — walk only the **delta diff** since the prior review of the same scope (`git diff <prior-review-tip>..HEAD`) plus the resolution of each prior finding. Per-slice reviews are scoped to a single slice's diff; final reviews are scoped to the integrated branch. In both cases: sections whose triggers newly fire because of the delta are walked; sections that were `NOT TRIGGERED` and remain so are skipped. See [`development-workflow.md`](development-workflow.md) Phase 2 and Phase 3 for the per-slice gate + final integration review flow.

---

## A. General principles

### A.1 Solve the actual problem (MUST)
**Rule.** Code must address the requirement that motivated the change, not a tangent or surrounding cleanup.
**Why.** Scope creep produces un-reviewable PRs and dilutes the review's focus on the real change.
**How to verify.** Cross-reference the diff against `plan.md`'s scope section. Anything modifying files outside the plan's "Files to create or modify" list needs a written justification.

### A.2 Minimal surface area (MUST)
**Rule.** No features, configuration options, or abstractions beyond what the task requires.
**Why.** Premature abstraction obscures intent and creates carrying cost.
**How to verify.** For each new abstraction (helper, base class, decorator, config flag), confirm it has at least one *current* concrete user. Single-call-site abstractions are usually wrong.

### A.3 Make one change at a time (MUST)
**Rule.** No refactoring while fixing bugs; no feature additions while refactoring.
**Why.** Conflated changes are hard to review, hard to revert, and hide defects.
**How to verify.** Read the diff and ask: "is each modified hunk in service of the same logical change?" If a hunk would not survive `git revert` of the bug fix without breaking, it doesn't belong in this PR.

### A.4 Fail loudly (MUST)
**Rule.** Errors must surface immediately with enough context to diagnose them. No silent failures, no swallowed exceptions, no fallback-on-error.
**Why.** Silent failures hide bugs in production until they become incidents.
**How to verify.** Grep for `except:` (bare), `except Exception:` (overly broad), and `pass` inside except blocks. Every catch must (a) catch a specific exception type, (b) log with context, and (c) either re-raise, return an explicit error response, or take a documented mitigation.

### A.5 Obvious over clever (SHOULD)
**Rule.** A future reader should understand the code without running it.
**How to verify.** Read each non-trivial expression aloud. If you can't explain it in one sentence, the abstraction or syntax trick is not earning its complexity.

---

## B. Architecture

### B.1 Separation of concerns (MUST)
**Rule.** HTTP layer, business logic, and data access are separate. Side effects (email, external APIs, files) are injectable/mockable. Route handlers are thin: parse input, call a service, return a typed response.
**Why.** Coupling these layers makes business logic untestable and tightly bound to the framework.
**How to verify.** For every modified route handler: confirm it does not contain SQL queries beyond simple lookups, does not embed business rules, and does not call external services directly. Complex logic belongs in `services/`.

### B.2 No state in process memory (MUST for backend services)
**Rule.** Sessions, uploaded files, caches that need consistency — all live in the database, distributed cache, or object storage. Never in process memory or local filesystem.
**Why.** The application runs as multiple instances; state in one instance is invisible to the others.
**How to verify.** Grep for module-level mutable state (`_cache: dict = {}`, class-level lists, file writes to anywhere except `/tmp` for transient working files). Each match needs a rationale or a relocation.

### B.3 Boring technology by default (SHOULD)
**Rule.** Postgres before specialised databases. REST before GraphQL. Synchronous before async. Add complexity only when a measured problem demands it.
**How to verify.** New dependencies, new service boundaries, new async queues need a one-paragraph justification in the plan or summary.

### B.4 Discriminator-by-null requires DB-level enforcement (MUST)
**Rule.** Any model with a polymorphic FK pair (e.g. `bookmark_id` OR `collection_id`) MUST have a `CHECK` constraint enforcing exactly-one-set. If more than two consumers branch on the discriminator, define a named helper (typed union, `is_*()` method, or split endpoints) — the discriminator must not be readable in scattered `if/elif` blocks.
**Why.** NULL-as-type-tag scatters branching across routers, schemas, and services; without DB enforcement the invariant is convention-only and bad rows accumulate silently.
**How to verify.** For new or modified models with mutually-exclusive FKs, the migration MUST include a DB-level check constraint. Grep the API, service, and schema layers for scattered branches on the discriminator FK — more than two hits without a named helper is a CHANGES REQUESTED.

### B.5 No speculative seams (MUST)
**Rule.** Do not introduce an enum, column, or interface "in case it diverges later." If a value is always equal to another value at every call site today, it is one value, not two.
**Why.** Speculative seams cost every reader a question, force every schema/test/migration to validate the duplicate, and create silent-divergence bugs when one side is updated without the other.
**How to verify.** For each new enum or column, the plan MUST cite at least one current consumer that branches on it differently from any existing field. `grep -rn "<new_name>" backend/api backend/services frontend/src` MUST find at least one production read site (not just write sites or schema declarations); otherwise the seam is rejected.

### B.6 State fields are typed enums with single-owner transitions (MUST)
**Rule.** Mutable state columns (`status`, `payment_status`, lifecycle flags) MUST be backed by a Python `Enum` and a Postgres native enum or `CHECK` constraint. Transitions MUST go through a single function or method that owns the state machine — direct attribute assignment from multiple modules is rejected.
**Why.** Free-string state columns with naked assignments scattered across the codebase silently expand the state space and prevent transition guards.
**How to verify.** For state columns: model uses `Enum(MyEnum)` (not `String`). Grep all assignments to the column — they MUST be inside one service module or go through a `set_status()` / `transition_to()` helper.

### B.7 Business policy lives in one place (MUST)
**Rule.** Values and rule-sets that encode *business policy* — fee percentages, quota limits, "active" status sets, eligibility predicates, policy text, error-classification tables — MUST be defined once and imported. Inline literal duplicates of policy values are rejected. This rule does NOT apply to algorithmic constants (loop bounds, pagination defaults, retry counts) where a literal is local to its use.
**Why.** When a policy changes, every duplicate must update in lockstep or the system gives different answers to the same question (e.g., one path uses a 10% limit, another 12%).
**How to verify.** For each touched literal that encodes policy: `grep -rn "<literal>" <source-root>` — matches outside the canonical definition site MUST reference the named constant. Inline status-set lists (`[Status.PENDING, Status.CONFIRMED]`) MUST use a named constant/immutable set.

### B.8 Don't braid happy path with error recovery (SHOULD)
**Rule.** `except Exception` blocks that mutate state and continue (rollback + re-add, swallow + log at `debug`) are rejected unless the recovery is an intentional, documented contract. Catch *specific* domain exceptions; let unknowns propagate.
**Why.** Defensive try/except hides root causes and creates fragile recovery paths that work most of the time and silently corrupt data the rest.
**How to verify.** New `except Exception` blocks MUST catch a specific domain exception class or be justified in the plan with the recovery contract spelled out. Generic `except Exception` + log + continue is rejected.

---

## C. Security

### C.1 No hardcoded secrets (MUST)
**Rule.** No API keys, passwords, tokens, or credentials in source. Environment variables or secrets manager only. Never commit `.env` files.
**Why.** A secret in source is a secret in git history — treat it as compromised.
**How to verify.** Run `grep -rEi "(api[_-]?key|secret|token|password|sk_test|sk_live)" backend/ frontend/` on the diff. Every match must be a variable name, not a string literal value. Pre-commit hooks (gitleaks) catch the obvious cases; check for clever encodings too.

### C.2 Input validation at boundaries (MUST)
**Rule.** Every system boundary (HTTP body, query params, file uploads, webhook payloads) validates input via a typed validation layer, not manual `if` checks.
**Why.** Manual validation forgets edge cases the framework already handles.
**How to verify.** Each new endpoint declares typed models for request bodies and query parameters. No untyped, free-form request bodies.

### C.3 Authentication ≠ authorisation (MUST)
**Rule.** Both must be implemented. Resource ownership must be verified server-side before returning or modifying. Frontend guards are UX, not security.
**How to verify.** Each endpoint that touches a user-owned resource checks the requesting user owns or is allowed to access it. Look for a fetch-by-id (e.g. `get(Bookmark, bookmark_id)`) without a follow-up `if resource.user_id != current_user.id` — that's a missing ownership check. (This is exactly the class of bug the Story 2.1 search review caught.)

### C.4 Return 404 before 403 (SHOULD)
**Rule.** When access is denied, prefer 404 ("not found") over 403 ("forbidden") to avoid leaking which IDs exist.
**How to verify.** Read the deny path of authorisation checks; ensure the error response doesn't reveal resource existence to unauthorised callers.

### C.5 Parameterised queries only (MUST)
**Rule.** All database queries use parameterised queries / parameter binding. Never string-format user-supplied data into SQL.
**How to verify.** Grep for `f"SELECT`, `f"INSERT`, `f"UPDATE`, `.format(` in any SQL context. Each match must use bind parameters.

### C.6 No leak of internal details in errors (MUST)
**Rule.** HTTP error responses must not include `str(e)`, stack traces, database schema, or third-party SDK internals.
**Why.** Stack traces in error responses are a recon goldmine for attackers.
**How to verify.** Grep route handlers for `detail=str(e)`, `detail=f"...{exc}"`. Logs should have the detail; the response gets a generic user-facing message.

### C.7 No sensitive fields on the wire (MUST)
**Rule.** Response schemas must never declare `hashed_password`, raw payment tokens, or other internal-only fields. ORM `__dict__` spreads are forbidden.
**How to verify.** Grep for `**.*\.__dict__` in `api/v1/`. Confirm zero matches. Check response schemas (`schemas/*.py`) for fields that should never be returned.

---

## D. Performance

### D.1 No premature optimisation (MUST against speculative perf changes)
**Rule.** Optimisations require a measured baseline. Speculative perf changes without a benchmark are rejected.
**How to verify.** Any performance-justified hunk must reference a specific benchmark (in `tests/benchmark/`) or production metric.

### D.2 No N+1 queries (MUST)
**Rule.** Don't iterate over a query result and then issue another query per row. Use `joinedload`/`selectinload` or batched queries.
**How to verify.** Read each loop over a query result. Check whether the loop body accesses related objects (`row.user.name`, `row.bookmark.tags`). If yes, the parent query must eager-load the relationship rather than lazy-loading per row. Serializers/validators that access relationships are an extra trap — they amplify N+1 if invoked over a list.

### D.3 Database-level pagination, sorting, filtering (MUST)
**Rule.** Never load a full table into memory. Pagination uses `LIMIT`/`OFFSET`; sorting uses `ORDER BY`; filtering uses `WHERE`. No in-application sorts/filters of full result sets.
**How to verify.** Grep for `.all()` followed by `sorted(`, `filter(`, or list slicing. Each match needs justification.

### D.4 Index foreign keys and frequent filter columns (SHOULD)
**Rule.** Any column appearing in `WHERE`, `ORDER BY`, or `JOIN` for a frequent query gets an index.
**How to verify.** When reviewing a new query pattern, check the column's `Mapped[]` declaration for `index=True` or a partial index in a recent migration.

---

## E. Code quality

### E.1 Names describe purpose, not implementation (MUST)
**Rule.** Identifiers state *what something does*, not *how it's built*. Boolean variables read as a statement (`is_available`, `has_permission`).
**How to verify.** Spot-check new variables, functions, and classes. Names like `data2`, `helper`, `process`, `utils` are red flags. Names that encode the implementation (`json_string_amenities`) age badly.

### E.2 Functions do one thing (MUST)
**Rule.** A function's purpose can be stated in one sentence without "and". Functions over ~40 lines need a refactor justification.
**How to verify.** For each new/modified function over 40 lines, ask: "what does this function do?" If the answer requires "and" or has more than two clauses, split it.

### E.3 No bare `except:` (MUST)
**Rule.** Catch the narrowest exception type that makes sense. Never a bare or catch-all handler unless it re-raises. Catch the specific error type each call site can actually raise (the payment-SDK error, the database error, the cloud-SDK error).
**How to verify.** Grep `except:` and `except Exception:` in the diff. Each match needs a specific type.

### E.4 No leftover dead code (MUST)
**Rule.** Unused imports, unreachable branches, commented-out code, unused variables — all deleted. Stubs and placeholders must log clearly and return valid typed responses.
**How to verify.** Run your linter (unused-import / unused-variable rules). Grep the diff for `# TODO:` and `# FIXME:` without a linked issue.

### E.5 Comments explain WHY, not WHAT (MUST)
**Rule.** Code explains what it does via names. Comments explain why a non-obvious choice was made — a hidden constraint, a workaround for a specific bug, a SQL gotcha.
**How to verify.** Read each new comment. If it restates what the next line obviously does (`# increment counter`), it's noise — flag for removal. If it explains a constraint or a quirk, it stays.

### E.6 Trust internal code (MUST against speculative validation)
**Rule.** Don't add error handling, fallbacks, or validation for scenarios that can't happen. Validate at system boundaries; trust framework guarantees.
**How to verify.** Look for defensive null-checks or try/catch blocks around code that can't legitimately produce the failure mode. Especially: re-validation of input already validated at the boundary.

### E.7 Structured logging, not `print`/stdout (MUST)
**Rule.** All logging goes through the project's structured logger, emitting machine-parseable records. No ad-hoc `print`/stdout writes, and no unstructured default-logger calls in production code.
**Why.** Structured logs can be parsed, queried, and alarmed on by the monitoring pipeline. Unstructured output is invisible to it.
**How to verify.** Grep for direct stdout writes and unstructured logger calls in new production code. Each match needs migration to the structured logger.

### E.8 Timezone-aware timestamps only (MUST)
**Rule.** Always construct and store timezone-aware timestamps (UTC). Never use APIs that produce naive (timezone-less) datetimes that silently miscompare with aware values.
**Why.** A naive timestamp compared against a timezone-aware one either errors or produces wrong results. Standardising on aware-UTC timestamps removes the ambiguity.
**How to verify.** Grep for your language's naive-timestamp constructors in the diff and across modified files. Each match must be replaced with the timezone-aware equivalent.

---

## F. Code hygiene

### F.1 No magic strings or numbers (MUST)
**Rule.** Domain-meaningful literals are extracted into named constants, enums, or config. Status comparisons against string literals are forbidden when an enum exists.
**Why.** Bare `"succeeded"` or `300` in business logic ages badly and is fragile to typos.
**How to verify.** Grep for status comparisons (`payment_status == "succeeded"`, `status == "pending"`) and confirm an enum is used (`PaymentStatus.SUCCEEDED`). For numerics in business logic, confirm there's a named constant (not just a comment explaining the value).

### F.2 No raw untyped maps for structured data between layers (MUST)
**Rule.** Functions that pass or return structured data use a typed model (a schema/model class, struct, record, or equivalent). Never an untyped free-form map/dictionary in a public signature for data with a fixed shape. **New code must not introduce untyped service-layer signatures.** When a story modifies a function whose existing signature is untyped for structured data, the migration to a typed model is part of the same change. A lightweight typed map is acceptable for wire-format payloads where full validation is not needed (e.g., outbound HTTP query params).
**Why.** Key sniffing (`.get("key")`, `"key" in data`) is silently fragile. A typed model proves the shape at the boundary. Schema drift in an upstream producer surfaces as a validation error, not a silent `None` deep in business logic.
**How to verify.** Grep the service and API layers for untyped map return types and parameters. Each match in the diff needs a typed model. Modified files with pre-existing untyped signatures must be migrated as part of the change.

### F.3 No external API responses parsed as raw untyped data (MUST)
**Rule.** Every external API response (payment webhooks, auth-provider responses, third-party APIs, object storage) is parsed and validated through a typed model — never trusted as raw untyped data.
**Why.** External APIs change; without validation, schema drift causes silent failures in production.
**How to verify.** Grep for raw response access (`response.json()`, `response['key']`, deep attribute chains on decoded payloads). Each match must precede a typed-model validation call.

### F.4 All route responses use a typed response contract (MUST)
**Rule.** Every route declares a concrete response type. Returns are typed-model instances — never raw untyped maps.
**How to verify.** Confirm each route handler declares its response type in whatever mechanism the framework provides. Grep for raw map literals returned directly from route handler bodies; each match must be a typed-model construction or a genuine multi-shape error path.

### F.5 No spreading of internal object internals into responses (MUST)
**Rule.** Never spread a persistence object's raw internal attribute bag (e.g. an ORM instance's `__dict__` / equivalent) into a response. Map through an explicit typed model.
**Why.** Raw internal state exposes framework internals, private columns (password hashes, tokens), and undeclared fields the response contract would otherwise filter out.
**How to verify.** Grep the API layer for raw-internal spreads into responses; expect zero matches.

### F.6 Enum consistency (MUST)
**Rule.** When a column or field stores enum values, every comparison and assignment uses the enum type — never raw strings.
**How to verify.** For each enum in the domain, grep for raw-string comparisons against its values. Convert to the enum type.

### F.7 All imports at the top of the file (MUST)
**Rule.** No inline or function-local imports. Follow the language's conventional import ordering and grouping. **Tests are not exempt** — the rule applies to test files too.
**Why.** Inline imports hide dependencies and complicate static analysis. Failure mode is silent: linters may not flag them in every context, and the violation only surfaces when a reviewer reads the file linearly.
**How to verify.** For each modified file (including tests), scan for imports not at the top. Catches include imports after declarations, imports inside test bodies, and re-aliased imports placed near their usage.

### F.8 Full descriptive variable names (MUST)
**Rule.** No cryptic abbreviations like `bd`, `bt`, `pf`, `epd`, `vt`. Use full names like `price_breakdown`, `booking_total`, `platform_fee`. Code is self-documenting; abbreviations save keystrokes at the cost of every reader's time. The only acceptable short names are loop counters in genuinely-short loops (`i`, `j`, `k`) and conventional iteration aliases in short comprehensions where the type is obvious from context.
**Why.** Repeated retrospectives have flagged abbreviated names as a recurring source of confusion (`bd` → `booking_data` or `price_breakdown`?).
**How to verify.** Walk the diff. Any one- or two-letter name outside the loop-counter exception → MUST violation. Three- or four-letter abbreviations that aren't standard domain terms (e.g. `usd`, `eur`, `iso`, `sql`, `jwt`) → MUST violation.

### F.9 Modern, idiomatic type syntax (MUST)
**Rule.** Use your language's current, idiomatic type-annotation syntax. Do not carry deprecated or legacy typing constructs where the language now provides a built-in or more concise equivalent.
**Why.** Legacy typing constructs add visual noise and signal that the code was written against an older toolchain. Aligning on the current idiom keeps annotations consistent and reduces reviewer friction.
**How to verify.** Grep the diff for the deprecated typing constructs your language flags, and confirm the modern equivalent is used instead.

---

## G. Framework / API-layer specifics (fill in for your stack)

This section holds the conventions specific to your web framework and API layer. Fill it in with your stack's rules for:

- **Request validation** — how untrusted input is typed and validated at the boundary.
- **Response serialization** — how responses declare a typed contract and are serialized.
- **Dependency injection** — how request-scoped dependencies (auth context, DB session) are wired and mocked.
- **Error-to-HTTP mapping** — how domain errors map to status codes without leaking internals (see C.6).

> Template note: the original repo carried web-framework and serialization-library rules here. Replace this section with your framework's conventions.

---

## H. ORM / data-access specifics (fill in for your stack)

This section holds the conventions specific to your ORM or data-access layer. Fill it in with your stack's rules for:

- **Query patterns** — the idiomatic query API to use, and legacy patterns to avoid.
- **N+1 avoidance** — how relationships are eager-loaded when results are iterated (see D.2).
- **Transaction boundaries** — where transactions and sessions open, commit, and close (including long-running processes with no request scope).
- **Column typing** — timezone-aware timestamps, structured-data column types, enum-backed columns.

> Template note: the original repo carried ORM-specific rules here. Replace this section with your data-access layer's conventions.

---

## I. Database migrations (fill in for your stack)

This section holds the conventions specific to your migration tool. Fill it in with your stack's rules for:

- **Reversible migrations** — every migration has a working, tested down/rollback path.
- **No data loss** — destructive changes are staged, and schema changes are separated from data backfills.
- **Review generated migrations** — auto-generated migrations are read and corrected, never merged blind.
- **Immutability once applied** — a migration merged and deployed to production is never edited in place.

> Template note: the original repo carried migration-tool rules here. Replace this section with your migration tool's conventions.

---

## J. Testing

### J.1 Tests anchor each slice via TDD (MUST)
**Rule.** Each vertical slice has a failing integration test written **first**, then the minimum implementation to make it pass. The Code phase MUST produce `karpathy-knowledge-base-example/docs/iterations/<story>/tdd-trace.md` with a per-slice entry documenting the red-green-refactor evidence (failing test name, command, red confirmation timestamp, implementation summary, green confirmation timestamp). Without the trace, the slice is treated as J.1 FAIL.
**Why.** A "test" that passes both before and after the change is regression coverage, not an anchor — it doesn't prove the slice did anything. TDD prevents this failure mode by construction: a test that hasn't run red cannot be written to fit the existing implementation. Demanding a trace artifact (rather than just a process claim) is what makes the rule auditable.
**How to verify.** Open `tdd-trace.md` in the iteration folder. Confirm one entry per slice in `plan.md`. For each entry: (a) the failing test name matches a real test in the diff, (b) the red confirmation shows the test failed for the *expected* reason (assertion failure or `NotImplementedError`, not import / syntax / fixture errors), (c) the green confirmation shows the same test passed after implementation. If the trace is missing, retrospectively-written, or contains `[VIOLATION]` markers without remediation, J.1 FAILs and the slice must be redone or the violation explicitly accepted in `summary.md`'s "What's left".

### J.2 Integration tests run against real dependencies (SHOULD)
**Rule.** Test hierarchy: integration (real HTTP, real database) > unit with real deps > unit with mocks. Mocks only at true external boundaries (payment provider, auth provider, email, third-party APIs).
**How to verify.** New integration tests use the running stack. Tests that mock the database or session are flagged for migration.

### J.3 Test behaviour, not implementation (MUST)
**Rule.** Tests assert on observable outcomes — response shape, persisted state, sent messages. They don't assert on which functions were called or how internals are organised.
**How to verify.** Look for `mock_x.assert_called_with(...)` patterns that check internal call structure. Each must justify why behaviour-level coverage isn't enough.

### J.4 Every bug fix gets a regression test (MUST)
**Rule.** A fix without a test is a fix that will regress.
**How to verify.** For each behaviour-changing hunk, find the test that would have failed before the fix.

### J.5 Tests teardown external resources (MUST)
**Rule.** External resources created during tests (auth-provider users, object-storage files, payment-provider test data) are cleaned up in fixtures.
**How to verify.** Read fixture teardowns. Anything that creates external state must clean it up.

### J.6 Anchor-vs-regression test labelling (MUST)
**Rule.** In each test class header (or test docstring), label whether tests are *anchors* (would have failed pre-change) or *regression coverage* (pass before AND after). The plan's anchor count must match the actual anchor count in the diff. Anchors should outnumber regression tests for a given slice — if they don't, the slice is under-anchored.
**Why.** A "test" that passes both before and after the change does not prove the slice did anything; it's a guard against future drift, not evidence of present correctness. Conflating the two produces reviews that mistake regression coverage for anchor coverage and miss missing tests.
**How to verify.** For each test in a slice, mentally roll back the corresponding implementation hunks and ask "would this assertion fail?" If yes, it's a real anchor. If no, label as regression and confirm an anchor exists elsewhere for the same slice.

### J.7 API-schema contract test when adding typed responses to many endpoints (SHOULD)
**Rule.** When a story adds or modifies the typed response contract on three or more routes, include a parameterised test that reads the generated API schema (if your framework exposes one) and asserts each endpoint's success-response type matches its expected schema.
**Why.** Live-shape integration tests require fixture chains per endpoint and grow expensive. A schema assertion proves the contract directly with one read and N parameterised cases. It also catches the untyped-response anti-pattern, which silently produces an open/permissive schema instead of a concrete typed one.
**How to verify.** When a story adds typed responses to ≥3 endpoints, look for a parameterised schema-contract test covering every changed endpoint.

### J.8 Hardcode-→-state-derived fixes need a NEGATIVE test case (MUST)
**Rule.** When a fix changes a previously-hardcoded value to a state-derived one, the test suite must include a case where the new derivation produces the *opposite* value of the hardcode. Without this case, tests only prove the happy path agrees with the old hardcode — not that the derivation actually runs.
**Why.** If a hardcoded `can_cancel=True` is replaced with state-derivation, a test that only covers PENDING bookings (where the new derivation returns `True`) doesn't prove the validator runs — it could pass even if the validator was a no-op. A CANCELLED test case, where derivation must return `False` and the old hardcode would have returned `True`, is the test that actually proves the change.
**How to verify.** For each "X was hardcoded; now state-derived" change, find the test asserting the *not-hardcoded* value. If only the agreeing-with-hardcode value is tested, the slice is under-anchored.

---

## K. Frontend specifics (fill in for your stack)

This section holds the conventions specific to your frontend framework and tooling. Fill it in with your stack's rules for:

- **Component structure** — the component model (e.g. functional vs class), where reusable behaviour lives, and type-safety expectations (no untyped escapes).
- **State management** — how server and client state are fetched and cached, and how loading/error/success/empty states are all handled explicitly.
- **Accessibility** — semantic markup, keyboard navigation, and contrast requirements.
- **Design-token usage** — colours, spacing, radii, and fonts come from the design-token system, never hardcoded literals.

> Template note: the original repo carried TypeScript/React/MUI rules here. Replace this section with your frontend stack's conventions.

---

## L. Git and commits

### L.1 No AI attribution in commit messages (MUST)
**Rule.** Never include "Co-Authored-By: Claude", "Generated by Claude", or any AI attribution.
**How to verify.** `git log --format=%B main..manual_dicts | grep -i claude`.

### L.2 No ticket IDs in commits or code (MUST)
**Rule.** No story numbers, issue IDs, or ticket references in commit messages, code comments, docstrings, or error messages. Traceability lives in the branch name and PR description.
**How to verify.** Grep for `Story \d`, `STORY-`, `JIRA-`, `#\d+` in the diff. Each match needs removal.

### L.3 Imperative mood, ≤72 chars subject (MUST)
**Rule.** Commit subjects are imperative ("Add", "Fix", "Refactor"). Subject ≤72 chars; detail in body.
**How to verify.** Read commit subjects in `git log main..manual_dicts`. Past tense or run-on subjects are flags.

### L.4 No `--no-verify`, no skipping pre-commit hooks (MUST)
**Rule.** Pre-commit hooks must pass before commit. If a hook fails, fix the underlying issue.
**How to verify.** Check for any commit message indicating bypass; check that linting/typecheck were run.

---

## M. Plan compliance

### M.1 Diff matches plan scope (MUST)
**Rule.** Every modified file is listed in `plan.md`'s "Files to create or modify" section.
**How to verify.** Diff against the plan's file list. Out-of-scope changes need a written deviation note in the summary.

### M.2 Acceptance criteria are explicitly evaluated (MUST)
**Rule.** Each AC in `plan.md` gets a PASS or FAIL verdict in the review report, with file:line evidence.
**How to verify.** Walk every AC. Don't aggregate or skip. PARTIAL is permitted only with a remediation plan.

### M.3 Plan deviations are documented (MUST)
**Rule.** When implementation diverges from the plan, the deviation appears in (a) the validator/function docstring (for code-level deviations), and (b) `summary.md`'s "Why it was built this way" section (for design deviations).
**How to verify.** For each AC marked PARTIAL or each behavioural change found in the diff that isn't in the plan, find the documentation.

---

## N. Behaviour change visibility

### N.1 Behaviour changes (incidental or intentional) must be flagged (MUST)
**Rule.** When a fix or refactor incidentally changes the wire output, response semantics, or observable behaviour of an endpoint or function, the change is documented in `summary.md` AND in a test assertion message. `summary.md` must include a level-2 heading **"Behaviour changes"** (or equivalent prominent heading) listing each observable change in 1–3 lines: (a) what changed on the wire, (b) why (bug fix, refactor side-effect, intentional), (c) frontend / QA action item.
**Why.** Frontends, downstream consumers, and QA need to know what changed and why. Without an explicit prominently-headed section, behaviour changes get lost in a long summary doc. The 1–3-line-per-change format makes them discoverable via Cmd-F by an interested reader.
**How to verify.** Search `summary.md` for the "Behaviour changes" heading. For each behavioural diff visible in the code, confirm a matching entry exists with the three required components. A summary doc that buries behaviour changes inside a "Why it was built this way" narrative does not satisfy this rule.

---

## O. Infrastructure (when the diff touches `infra/` or equivalent IaC)

### O.1 Infrastructure as code only (MUST)
**Rule.** All cloud resources are defined in your IaC tool. Never created manually via a console.
**Why.** Manual changes are invisible to the rest of the team, drift from code state, and cannot be reviewed or rolled back.
**How to verify.** Any new cloud resource that appears in production but not in the diff is a flag. PRs that add a `# created manually` comment fail this rule.

### O.2 Plan/preview before apply (MUST)
**Rule.** A preview/plan step must be run and reviewed before every apply. The plan output is part of the PR description for non-trivial infra changes.
**How to verify.** For PRs that modify IaC, look for a plan-output paste in the PR description or a CI artifact. Apply-without-plan is rejected.

### O.3 Resource tagging (MUST)
**Rule.** Every cloud resource carries `Name`, `Environment`, and `ManagedBy` tags at minimum.
**How to verify.** New resource definitions in the diff must include the standard tag set.

### O.4 No secrets in IaC files or state (MUST)
**Rule.** Database passwords, API keys, and other secrets must not appear in IaC source files or committed state. Use a secrets manager / parameter store or equivalent runtime injection.
**How to verify.** Grep diff for `password = "`, `secret = "`, `api_key = "`. Each match needs migration to a runtime reference.

---

## P. Docker

### P.1 Pinned base image versions (MUST)
**Rule.** Base images pinned to specific digests or minor versions. Never `latest`.
**Why.** `latest` makes builds non-reproducible and silently introduces breaking changes.
**How to verify.** Grep modified Dockerfiles for `FROM .*:latest`. Each match needs a pinned version.

### P.2 Comprehensive `.dockerignore` (MUST)
**Rule.** `.dockerignore` excludes `.git`, `node_modules`, `__pycache__`, `.env`, test directories, and any build-context content not needed at runtime.
**How to verify.** Read `.dockerignore` against the diff. New build artifacts that shouldn't ship to production must be added.

### P.3 No secrets in images (MUST)
**Rule.** `.env` files, secrets, and cloud credentials are never baked into Docker images. Use runtime injection (env vars, volume mounts, secrets manager).
**How to verify.** Read modified Dockerfiles for `COPY .env`, `ENV API_KEY=...`, hardcoded credentials. Zero matches.

### P.4 Non-root runtime user (MUST)
**Rule.** Application processes run as a non-root user inside the container. The Dockerfile creates the user, sets file ownership, and switches via `USER`.
**How to verify.** Modified Dockerfiles include a `USER <name>` directive before `CMD`/`ENTRYPOINT`. The user is not `root`.

### P.5 Multi-stage builds for production images (SHOULD)
**Rule.** Production images use multi-stage builds to drop build dependencies (compilers, dev tooling) from the final image.
**How to verify.** Modified Dockerfiles for prod targets show at least two `FROM` stages — a build stage and a slim runtime stage that copies only necessary artifacts.

---

## Q. CI/CD

### Q.1 Fail fast — cheap checks before expensive ones (MUST)
**Rule.** Workflows order steps so the cheapest checks (lint, format, type check) run before expensive ones (tests, builds, integration). A failed lint check should not require a full test run to surface.
**How to verify.** Read modified workflow YAML. Steps appear in cost order; expensive steps gate on cheap ones via `needs:`.

### Q.2 Short-lived deploy credentials (MUST)
**Rule.** Deployment workflows authenticate via OIDC or short-lived credentials (e.g. cloud IAM role assumption). Never via static long-lived keys committed to repo secrets.
**Why.** Static keys in CI are a credential-leak risk; OIDC issues per-job credentials that expire automatically.
**How to verify.** Modified deploy workflows assume a short-lived role via OIDC, rather than reading static long-lived access keys from repo secrets.

### Q.3 No skipping CI checks (MUST)
**Rule.** Required CI checks must pass before merge. If CI is blocking a deploy, fix the CI issue — don't bypass it.
**How to verify.** PR descriptions or commit messages claiming "skipped CI to deploy" → flag immediately. Branch protection rules should make this impossible at the platform level.

---

## How the reviewer applies this document

1. **Open the plan.** Walk every AC; for each, find the diff hunk that satisfies it.
2. **Walk this document by section.** For each MUST, run the verification step. Record PASS / FAIL / PARTIAL with file:line evidence.
3. **Walk the diff freshly.** Look for each anti-pattern listed under "How to verify" — even if no AC mentions it.
4. **Produce the report.** Use the format in `development-workflow.md` Phase 3, with one row per MUST/SHOULD violation.
5. **Verdict.** Any MUST violation → CHANGES REQUESTED. SHOULD violations are flagged but non-blocking unless they aggregate.
