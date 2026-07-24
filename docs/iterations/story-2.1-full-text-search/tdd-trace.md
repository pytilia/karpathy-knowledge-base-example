# Story 2.1 — Full-text search over bookmarks — TDD trace

> **Example iteration.** Red-Green-Refactor evidence for the "Bookmarkr" worked example,
> in the format the [development workflow](../../development-workflow.md) mandates (Phase 2,
> "TDD trace artifact"). Persisted here because the worked example is illustrative; a real
> *medium*-tier story would summarise this into `summary.md` and delete the file. Each slice's
> entry was written **as the slice was coded**, not retrospectively.

Tests run against a real Postgres 16 via testcontainers (per the stack), in-suite.

---

## Slice 1 — Search-vector column + GIN index (migration)

**Coding agent:** fresh coding sub-agent
**Started:** 2026-07-01 09:14

### Red
- **Failing test:** `tests/integration/test_bookmark_search.py::TestSearchVectorColumn::test_inserted_bookmark_has_populated_search_vector`
- **Command:** `pytest tests/integration/test_bookmark_search.py -k test_inserted_bookmark_has_populated_search_vector`
- **Result:** FAILED — `sqlalchemy.exc.ProgrammingError: column bookmarks.search_vector does not exist`. The test inserts a bookmark titled "Learn Rust ownership" and asserts `search_vector is not None` and contains the lexeme `'rust'`; the column is not there yet. (Fails for the expected reason — missing column, not an import/fixture error.)
- **Confirmed at:** 2026-07-01 09:21

### Green
- **Implementation:** Alembic migration `a3f1c8b2e04d_add_bookmark_search_vector.py` adds `search_vector tsvector GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title,'')),'A') || setweight(...tags...,'B') || setweight(...description...,'C') || setweight(...url...,'D')) STORED` plus `CREATE INDEX ix_bookmarks_search_vector ON bookmarks USING GIN (search_vector)`. Mapped the column on the model as `deferred`, read-only (`FetchedValue`).
- **Files modified:** `alembic/versions/a3f1c8b2e04d_add_bookmark_search_vector.py`, `app/models/bookmark.py`
- **Command:** `pytest tests/integration/test_bookmark_search.py -k test_inserted_bookmark_has_populated_search_vector`
- **Result:** PASSED — `search_vector` is non-null after insert and contains the title lexeme `'rust'` at weight A.
- **Confirmed at:** 2026-07-01 09:38

### Refactor (if any)
- None — new code only (migration + read-only column map). Slice 1 touched no existing logic to clean up (plan recorded `none (new code only)`).

---

## Slice 2 — Search endpoint (ranked, tenant-scoped)

**Coding agent:** fresh coding sub-agent
**Started:** 2026-07-02 10:02

### Red — anchor test (AC1–AC5)
- **Failing test:** `tests/integration/test_bookmark_search.py::TestSearchEndpoint::test_search_returns_ranked_tenant_scoped_results`
- **Command:** `pytest tests/integration/test_bookmark_search.py -k test_search_returns_ranked_tenant_scoped_results`
- **Result:** FAILED — `404 Not Found` for `GET /bookmarks/search?q=rust`. Route does not exist yet. The test seeds **two users**: user A has "Learn Rust ownership" (title hit) and "Notes on borrow checking" tagged `rust` (tag hit) and "A long essay that mentions rust once" (description-only hit); user B has "Rust patterns" (must never appear for A). It asserts: AC1 title hit returned; AC2 title hit ranks above description-only hit; AC3 tag hit returned; AC4 `q=zzzznomatch` → `200` + empty list; AC5 user B's bookmark absent from user A's results.
- **Confirmed at:** 2026-07-02 10:15

### Green
- **Implementation:** Added `app/services/search.py` (`search_bookmarks(session, user_id, query, limit, offset)`) building `websearch_to_tsquery('english', :q)`, filtering `Bookmark.search_vector.op('@@')(tsquery)` **and `Bookmark.user_id == user_id`**, ordering by `ts_rank(search_vector, tsquery)` desc. Added `GET /bookmarks/search` route in `app/api/bookmarks.py` (query param `q: str = Query(min_length=1)`, so empty `q` → 422) and `BookmarkSearchResult` schema (adds `rank`) in `app/schemas/bookmark.py`.
- **Files modified:** `app/services/search.py`, `app/api/bookmarks.py`, `app/schemas/bookmark.py`
- **Command:** `pytest tests/integration/test_bookmark_search.py -k test_search_returns_ranked_tenant_scoped_results`
- **Result:** PASSED — AC1–AC5 all green in the single anchor test.
- **Confirmed at:** 2026-07-02 11:07

### Refactor — extract `paginate` (accepted at plan approval)
- **Change:** Extracted the inline limit/offset slicing duplicated between the list endpoint and the new search endpoint into `paginate(query, limit, offset)` in `app/api/bookmarks.py`. Existing code (the list route) was pinned first: added a **characterization test** `tests/integration/test_bookmark_list.py::test_list_pagination_characterization` capturing the *current* list pagination behaviour (limit/offset boundaries, `total` count) so the extraction could be verified as behaviour-preserving before touching the list route.
- **Sequence:** characterization test written → confirmed GREEN against pre-refactor code → `paginate` extracted → both routes switched to it.
- **Confirmed green again:** 2026-07-02 11:29 — full file green: `pytest tests/integration/test_bookmark_search.py tests/integration/test_bookmark_list.py` → all pass, including the characterization test (behaviour unchanged) and the AC1–AC5 anchor.

> **Note (carried into review):** slice-2 review round 1 flagged that one code path in
> `search.py` — the count query backing `total` — was **missing the `user_id` filter** (the
> `WHERE user_id` was on the items query but not the count). See
> [`code-review-slice-2-1.md`](code-review-slice-2-1.md). Fixed under TDD with a dedicated
> regression test `test_search_total_excludes_other_users` before round 2
> ([`code-review-slice-2-2.md`](code-review-slice-2-2.md)).

### Red — regression for the review finding (AC5, count path)
- **Failing test:** `tests/integration/test_bookmark_search.py::TestSearchEndpoint::test_search_total_excludes_other_users`
- **Command:** `pytest tests/integration/test_bookmark_search.py -k test_search_total_excludes_other_users`
- **Result:** FAILED — `assert response.json()["total"] == 1` got `2`: user B's matching bookmark leaked into user A's `total` because the count query lacked `user_id`. (The items list was already correct; only the count was wrong, which is exactly why the original anchor didn't catch it — it asserted on `items`, not `total`.)
- **Confirmed at:** 2026-07-03 09:05

### Green
- **Implementation:** Added `Bookmark.user_id == user_id` to the count query in `search.py` (single shared `where` clause now feeds both the items and count queries, so they cannot drift again).
- **Files modified:** `app/services/search.py`
- **Command:** `pytest tests/integration/test_bookmark_search.py`
- **Result:** PASSED — both the AC1–AC5 anchor and the new count-path regression green.
- **Confirmed at:** 2026-07-03 09:18
