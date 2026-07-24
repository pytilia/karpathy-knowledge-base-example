# Story 2.1 — Full-text search over bookmarks — Plan

> **Example iteration.** This is a worked example of a Phase-1 plan for the fictional
> "Bookmarkr" project, so an adopter can see what a real `plan.md` looks like against the
> [development workflow](../../development-workflow.md). The supporting artifacts in this
> folder (`grilling.md`, `tdd-trace.md`, `code-review-*.md`, `summary.md`,
> `code-review-walkthrough.md`) are the rest of the same worked example.

**User prompt (verbatim):** "Let users search their bookmarks by keyword and get the most relevant ones first."

**Objective:** Give a signed-in user relevance-ranked, tenant-isolated full-text search over their own bookmarks (title, description, url, tags).

## Scope

**In scope**
- A `GET /bookmarks/search?q=<query>` endpoint returning the caller's matching bookmarks, ranked by relevance.
- Postgres full-text search infrastructure (a weighted `tsvector` column + GIN index).
- Tenant isolation: a user can only ever see their own bookmarks.

**Out of scope (explicit)**
- Tag filtering (Story 2.2) and sort toggles (Story 2.3).
- Fuzzy / typo-tolerant matching (see [ADR-0001](../../decisions/0001-postgres-fts-over-elasticsearch.md) revisit triggers).
- Frontend search UI — this iteration is backend-only; the React search box is a follow-up.

## Design decision

Full-text search is implemented in PostgreSQL, not Elasticsearch. Rationale and rejected
alternatives are recorded in [ADR-0001](../../decisions/0001-postgres-fts-over-elasticsearch.md).
Ranking (AC2) is achieved with `setweight`: title = A, tags = B, description = C, url = D.

## Vertical slices

Two tracer-bullet slices, sequential (Slice 2 depends on the column from Slice 1).

### Slice 1 — Search-vector column + GIN index (migration)
- **Anchor (failing) test:** `test_inserted_bookmark_has_populated_search_vector` — insert a bookmark, assert `search_vector` is non-null and contains the title lexemes.
- End-to-end: Alembic migration adds a generated `search_vector tsvector` column (weighted) + GIN index; model reflects the column as read-only.

### Slice 2 — Search endpoint (ranked, tenant-scoped)
- **Anchor (failing) test:** `test_search_returns_ranked_tenant_scoped_results` covering AC1–AC5.
- End-to-end: `GET /bookmarks/search?q=` parses the query with `websearch_to_tsquery`, ranks with `ts_rank`, filters by `user_id`, returns a 200 with a (possibly empty) ranked list.

## Slice ordering and dependencies

- Slice 1 → Slice 2 (sequential). Slice 2 depends on the `search_vector` column from Slice 1.
- No independent/parallelisable subset — the endpoint cannot be tested without the column.

## Files to create or modify

| File | Slice | Change |
|------|-------|--------|
| `alembic/versions/xxxx_add_bookmark_search_vector.py` | 1 | New migration: generated `tsvector` column + GIN index |
| `app/models/bookmark.py` | 1 | Map `search_vector` as a deferred, read-only column |
| `app/api/bookmarks.py` | 2 | New `GET /bookmarks/search` route |
| `app/schemas/bookmark.py` | 2 | `BookmarkSearchResult` response schema (adds `rank`) |
| `app/services/search.py` | 2 | New: builds the tsquery + ranked, tenant-scoped query |
| `tests/integration/test_bookmark_search.py` | 1,2 | Anchor tests for both slices + AC1–AC5 |

## Refactor opportunities

- **Slice 2** — `app/api/bookmarks.py` already has an inline pagination helper duplicated from
  the list endpoint. *What:* extract `paginate(query, limit, offset)`. *Why now:* the search
  route needs the same pagination. *Risk:* low (pure extraction, covered by existing list tests).
  → **Accepted at plan approval.**
- **Slice 1** — none (new code only).

## API changes

- **New:** `GET /bookmarks/search?q=<str>&limit=<int>&offset=<int>` → `200` with `{ "items": [BookmarkSearchResult], "total": int }`. `401` if unauthenticated. Empty query `q` → `422`.

## Database changes

- Migration adds `bookmarks.search_vector tsvector GENERATED ALWAYS AS (...) STORED`, weighted across title/tags/description/url, plus `CREATE INDEX ... USING GIN (search_vector)`. Reversible (drops index + column on downgrade).

## Frontend changes

- None this iteration (backend-only). Follow-up story wires the React search box.

## Infrastructure changes

- None. No new services (that's the whole point of ADR-0001).

## Acceptance criteria

| AC | Description | Satisfied by |
|----|-------------|--------------|
| AC1 | Title-word match returns the bookmark | Slice 2 |
| AC2 | Title match outranks description-only match | Slice 2 (relies on Slice 1 weighting) |
| AC3 | Tag match returns the bookmark | Slice 2 |
| AC4 | No matches → empty list, `200` | Slice 2 |
| AC5 | Never see another user's bookmarks | Slice 2 |
| AC6 | Search uses the GIN index (`EXPLAIN`) | integration |

## Test plan

- Slice 1 anchor: `search_vector` populated on insert.
- Slice 2 anchor: single test exercising AC1–AC5 with two users' data seeded.
- Integration: `EXPLAIN (FORMAT JSON)` on the search query asserts a `Bitmap Index Scan` on the GIN index (AC6) — guards against a future change silently dropping the index.

## Risks and trade-offs

- **No typo tolerance** — accepted per ADR-0001; a misspelled query returns nothing. Product-signed-off for launch.
- **Generated-column migration on a large table** would lock writes; negligible here (small tables), but the migration note flags it for future scale.
- **Ranking weights are a guess** (title > tags > description > url). Cheap to tune later; no schema change needed to adjust `ts_rank` weight coefficients at query time.

## Scope-guard verdict

2 slices touching 6 files; thresholds are 4 slices / 10 cross-cutting files. **Keeping** as one iteration — both slices serve a single coherent outcome and Slice 2 is untestable without Slice 1.
