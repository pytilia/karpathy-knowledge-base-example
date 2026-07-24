## Review: Story 2.1 — Full-text search over bookmarks (integration) — code-review-final-1.md

**Reviewer:** code-review-agent (impartial)
**Branch:** story-2.1-full-text-search (2 commits ahead of main)
**Plan:** ../../iterations/story-2.1-full-text-search/plan.md
**Standards:** ../../review-coding-standards.md (applied rigorously)
**Prior slice reviews read:** [code-review-slice-1-1.md](code-review-slice-1-1.md), [code-review-slice-2-1.md](code-review-slice-2-1.md), [code-review-slice-2-2.md](code-review-slice-2-2.md)
**Diff scope:** `git diff main..story-2.1-full-text-search` (integrated whole, both slices)

> **Example iteration.** Phase-3 final integration review for the "Bookmarkr" worked example.
> Focus is the cross-slice surface no single slice review could see: AC coverage across the
> whole change, the Slice-1 column feeding the Slice-2 query, and integration-only AC6.

### Acceptance Criteria (whole change)
- [x] **AC1** (title-word match returns bookmark) — PASS. Weighted vector from Slice 1 (`bookmark.py:33`) `@@`-matched in Slice 2 service (`search.py:25`); anchor `test_search_returns_ranked_tenant_scoped_results` asserts it.
- [x] **AC2** (title outranks description-only) — PASS. Cross-slice: Slice-1 `setweight` (A=title, C=description) + Slice-2 `ts_rank` ordering (`search.py:27`). The ranking only works because both slices agree on the weight scheme — verified the migration DDL weights and the query's reliance on them are consistent.
- [x] **AC3** (tag match returns bookmark) — PASS. Tag lexemes materialised at weight B in the generated column (Slice 1); returned by the Slice-2 query. Anchor asserts the tag-only bookmark surfaces.
- [x] **AC4** (no matches → empty list, 200; empty q → 422) — PASS. `200`+`[]` for no-match; `Query(min_length=1)` → 422 for empty `q` (`bookmarks.py:71`).
- [x] **AC5** (tenant isolation) — PASS. Both items and count queries filter `user_id` via one shared predicate (`search.py:22`). Regression `test_search_total_excludes_other_users` covers the count path — the round-1 slice miss is closed and confirmed at integration, not re-litigated.
- [x] **AC6** (search uses the GIN index, via `EXPLAIN`) — PASS. This is the integration-only AC. `test_search_uses_gin_index` runs `EXPLAIN (FORMAT JSON)` on the service query and asserts a `Bitmap Index Scan` on `ix_bookmarks_search_vector` (`test_bookmark_search.py:150`). Confirms Slice-1's index is actually exercised by Slice-2's query — the exact cross-slice interaction no single slice review could judge.

### Resolution of prior review findings
- **[MUST-1, slice-2-1] count query missing tenant filter — RESOLVED** at slice level (slice-2-2) and re-confirmed here against the integrated diff (`search.py:22,25,29`). Integration does not show the resolution was incomplete.
- **[Slice-1-1 suggestion] pull AC6 `EXPLAIN` forward — partially actioned:** AC6 stayed integration-tagged per plan, but the integration test now exists and passes, so the guard is in place. Non-blocking either way.

### Coding Standards Compliance (integration-level focus)

- **Section A (General principles):** PASS — two coherent slices, one outcome; no dead or speculative code across the assembled change.
- **Section C (Security):** PASS — tenant isolation holds end-to-end: the only read path to `bookmarks` in the search service filters `user_id`; `q` is bound-parameterised (no SQLi). No cross-tenant leakage in vector contents (tags are user-scoped).
- **Section E / F (Code quality / hygiene):** PASS — no duplicated query logic across slices; `paginate` extraction removed the pre-existing list/search duplication.
- **Section G (Pydantic + FastAPI):** PASS — `GET /bookmarks/search` declares `response_model=Page[BookmarkSearchResult]`, `q` validated at boundary, `401` on unauth (inherited auth dependency), `422` on empty `q`.
- **Section H (SQLAlchemy):** PASS — generated column mapped read-only; queries index-backed and parameterised; no N+1 (tags in-vector, not per-row lazy loads).
- **Section I (Alembic):** PASS — migration reversible; `down_revision` chained; column+index co-migrated.
- **Section J (Testing):** PASS — anchors demonstrably anchor (404/missing-column pre-change); AC5 count-path negative test present; AC6 `EXPLAIN` integration test present; `paginate` pinned by characterization test. Integration tests run in-suite against real Postgres.
- **Section L (Git):** PASS — two clean slice commits (`slice 1: ...`, `slice 2: ...`), no AI attribution.
- **Section M (Plan compliance):** PASS — implementation matches plan scope; the one accepted refactor (`paginate`) landed as signed off; deferrals (typo tolerance, tag filter, sort) stayed out of scope.
- **Section N (Behaviour visibility):** PASS — new endpoint + response shape documented in schema and summary.
- **Section D (Performance):** PASS — GIN index used (AC6 EXPLAIN); single round-trip per path.
- **ADR check:** [ADR-0001](../../decisions/0001-postgres-fts-over-elasticsearch.md) records the FTS-over-Elasticsearch decision (status `accepted`, 2026-06-30) with revisit triggers — the load-bearing decision is captured, not buried in the plan.
- Sections B, K, O, P, Q — NOT TRIGGERED (no architecture seam change, no frontend, no infra/Docker/CI — consistent with the plan's "no infrastructure changes, that's the point of ADR-0001").

### Code Quality
- **MUST violations (blocking):** none across the integrated whole.
- **SHOULD violations:** none.
- **Suggestions (CONSIDER):** ranking weight coefficients remain inline (tunable per plan risk) — fine for launch.

### Security
- Section C walked at integration. Tenant boundary enforced on every `bookmarks` read path; no SQLi surface; vector contents cannot carry cross-tenant data. Clear.

### Performance
- Section D. `EXPLAIN` confirms the GIN index is used (AC6). No N+1, no full-table scan on search. Migration write-lock risk flagged for future scale, negligible now.

### Test Coverage
- **Anchors that demonstrably anchor:** `test_inserted_bookmark_has_populated_search_vector` (missing-column pre-change); `test_search_returns_ranked_tenant_scoped_results` (404 pre-change); `test_search_total_excludes_other_users` (`total==2` pre-fix).
- **Integration-only coverage:** `test_search_uses_gin_index` (AC6 EXPLAIN) — the cross-slice guard.
- **Regression coverage:** `test_list_pagination_characterization` pinning the `paginate` extraction.
- **Coverage gaps:** none blocking. Typo tolerance intentionally untested (out of scope, ADR-0001).

### Behaviour changes
- New capability: relevance-ranked, tenant-isolated full-text search over a user's own bookmarks. Response `{items, total}` both correctly tenant-scoped. No change to existing list/CRUD behaviour beyond the behaviour-preserving `paginate` extraction.

### Verdict: APPROVED
Zero MUST violations across the integrated change. AC1–AC6 all PASS with file:line evidence,
including the integration-only AC6 (`EXPLAIN` confirms the GIN index is used) and AC5 (tenant
isolation on both items and count paths, the round-1 slice miss now closed and re-confirmed at
integration). ADR-0001 records the load-bearing FTS decision. Phase 3 complete; proceed to
Phase 4.
