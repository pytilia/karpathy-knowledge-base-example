## Review: Slice 1 — Search-vector column + GIN index (migration) — code-review-slice-1-1.md

**Reviewer:** code-review-agent (impartial)
**Branch:** story-2.1-full-text-search (1 commit ahead of main)
**Plan:** ../../iterations/story-2.1-full-text-search/plan.md
**Standards:** ../../review-coding-standards.md (applied rigorously)
**Diff scope:** `git diff main..HEAD` — `alembic/versions/a3f1c8b2e04d_add_bookmark_search_vector.py`, `app/models/bookmark.py`, `tests/integration/test_bookmark_search.py` (slice-1 test only)

> **Example iteration.** A per-slice agent review for the "Bookmarkr" worked example, in the
> canonical review format from the [development workflow](../../development-workflow.md).

### Acceptance Criteria
Slice 1 satisfies no user-facing AC directly; it is the substrate for AC1–AC3/AC6. Judged against its plan anchor:
- [x] **Slice-1 anchor** — `test_inserted_bookmark_has_populated_search_vector` — PASS. Inserting a row populates `search_vector` non-null with the title lexeme at weight A (`test_bookmark_search.py:41`). This is a genuine anchor: it fails pre-migration with `column ... does not exist` (see tdd-trace Red).
- [ ] **AC6 (GIN index used via `EXPLAIN`)** — DEFERRED to integration per plan (AC6 tagged `integration`). Not gated here. See Suggestions.

### Coding Standards Compliance

- **Section A (General principles):** PASS — minimal, single-purpose migration; no speculative columns.
- **Section E (Code quality):** PASS — index name `ix_bookmarks_search_vector` and migration revision message are descriptive; no magic literals beyond the weight labels, which are Postgres-canonical.
- **Section F (Code hygiene):** PASS — the `setweight` weight labels `'A'..'D'` are Postgres API constants, not project magic strings; `coalesce(..., '')` guards each nullable field consistently.
- **Section H (SQLAlchemy):** PASS — `search_vector` mapped `deferred=True` and read-only via `FetchedValue()` (`app/models/bookmark.py:33`); the app never writes it, which is correct for a `GENERATED ALWAYS ... STORED` column. No session/query changes in this slice.
- **Section I (Alembic):** PASS — migration is reversible: `downgrade()` drops the index then the column (`a3f1c8b2e04d_...py:38`). `down_revision` is set. The generated-column expression is identical in `upgrade` DDL and the model comment. Migration note flags the write-lock cost of adding a generated column on a large table (negligible here) per the plan's risk.
- **Section J (Testing):** PASS — anchor test is an integration test against real Postgres (testcontainers), asserts on the actual `tsvector` contents, and demonstrably failed pre-change.
- **Section D (Performance):** PASS — GIN index created in the same migration as the column; no separate-migration window where the column exists unindexed.
- **Section L (Git and commits):** PASS — single slice commit `slice 1: add bookmark search_vector column + GIN index`.
- **Section M (Plan compliance):** PASS — matches "Database changes" and "Files to create or modify" for Slice 1 exactly; no scope drift.
- **Section N (Behaviour visibility):** NOT TRIGGERED — no observable wire/behaviour change yet (column is internal until Slice 2's endpoint reads it).
- Sections B, C, G, K, O, P, Q — NOT TRIGGERED (no architecture seam change, no auth/input surface, no FastAPI/schema, no frontend, no infra/Docker/CI in this slice).

### Code Quality
- **MUST violations (blocking):** none.
- **SHOULD violations (non-blocking):** none.
- **Suggestions (CONSIDER):** see Performance below.

### Security
- Section C — NOT TRIGGERED at slice level. No new input surface or auth path here; tenant isolation lands in Slice 2. Noted for the Slice 2 reviewer: the column concatenates tag text, but tags are already user-scoped, so no cross-tenant data enters another user's vector.

### Performance
- GIN index present and co-migrated with the column. **Minor observation (non-blocking):** the plan tags AC6 (index-usage via `EXPLAIN`) as `integration`, deferring the assertion. Consider adding the `EXPLAIN (FORMAT JSON)` "uses `Bitmap Index Scan` on `ix_bookmarks_search_vector`" assertion **now**, alongside this migration, rather than at integration. The index exists in this slice, so the guard could exist in this slice — pulling it forward closes the small window where a later slice could query `search_vector` in a way that silently sequential-scans without any test noticing. This is a CONSIDER, not a blocker: AC6 is legitimately an integration-tagged AC and deferring it is plan-compliant.

### Test Coverage
- **Anchors that demonstrably anchor:** `test_inserted_bookmark_has_populated_search_vector` — would (and did) fail before the migration with a missing-column error.
- **Tests that pass before AND after:** none added in this slice.
- **Coverage gaps:** index-usage (`EXPLAIN`) not yet asserted — deferred to integration by plan (see Performance suggestion).

### Behaviour changes
- None observable externally. Internal schema addition only.

### Verdict: APPROVED
Zero MUST violations. The migration is reversible, the column is correctly modelled as
read-only/generated, and the anchor test genuinely anchors. One non-blocking suggestion:
pull the AC6 `EXPLAIN` index-usage assertion forward into this slice instead of deferring it
to integration, since the index already exists here. Approved to proceed to the human gate.
