## Review: Slice 2 — Search endpoint (ranked, tenant-scoped) — code-review-slice-2-1.md

**Reviewer:** code-review-agent (impartial)
**Branch:** story-2.1-full-text-search (2 commits ahead of main, slice 2 uncommitted)
**Plan:** ../../iterations/story-2.1-full-text-search/plan.md
**Standards:** ../../review-coding-standards.md (applied rigorously)
**Diff scope:** `git diff <slice-1-tip>..HEAD` — `app/services/search.py`, `app/api/bookmarks.py`, `app/schemas/bookmark.py`, `tests/integration/test_bookmark_search.py`, `tests/integration/test_bookmark_list.py`

> **Example iteration.** Round-1 slice review for the "Bookmarkr" worked example. Verdict is
> CHANGES REQUESTED for one real MUST issue — the deliberate defect the worked example carries
> to show the per-slice gate catching a security bug before it merges.

### Acceptance Criteria
- [x] **AC1** (title-word match returns the bookmark) — PASS. `search.py:24` `@@` match against the weighted vector; anchor asserts the title hit is returned (`test_bookmark_search.py:88`).
- [x] **AC2** (title outranks description-only) — PASS. `order_by(func.ts_rank(...).desc())` (`search.py:31`) + Slice-1 weighting; anchor asserts ordering (`test_bookmark_search.py:96`).
- [x] **AC3** (tag match returns the bookmark) — PASS. Tag lexemes are in the vector at weight B (Slice 1); anchor asserts the tag-only bookmark is returned (`test_bookmark_search.py:101`).
- [x] **AC4** (no matches → empty list, 200) — PASS. `q=zzzznomatch` returns `200` + `items: []` (`test_bookmark_search.py:108`). Empty `q` → 422 via `Query(min_length=1)` (`bookmarks.py:71`).
- [ ] **AC5** (never see another user's bookmarks — tenant isolation) — **FAIL (PARTIAL).** The **items** query is correctly scoped, but the **count** query backing `total` is not. See MUST-1. The anchor test only asserts on `items`, so it passes while `total` leaks — a real hole.
- [ ] **AC6** (GIN index via `EXPLAIN`) — deferred to integration per plan; not gated here.

### Coding Standards Compliance

- **Section A (General principles):** PASS — service is focused; route delegates to `search.py`.
- **Section C (Security):** **FAIL** — tenant isolation is not applied uniformly across both query paths. See MUST-1. This is the section that makes the verdict blocking.
- **Section E (Code quality):** PASS — names clear (`search_bookmarks`, `BookmarkSearchResult.rank`).
- **Section F (Code hygiene):** PASS — `websearch_to_tsquery` config `'english'` is defined once; no duplicated literals. Minor duplication of the `where` predicate between the two queries — see MUST-1 fix note and Suggestions.
- **Section G (Pydantic + FastAPI):** PASS — `q: str = Query(min_length=1)` rejects empty/whitespace query at the boundary (422); `BookmarkSearchResult` is a proper response model with `rank: float`; route declares `response_model`.
- **Section H (SQLAlchemy):** PARTIAL — the items query is correct; the count query is missing a filter (MUST-1). Both use bound parameters (no string interpolation of `q` — good, no SQLi).
- **Section J (Testing):** PARTIAL — the AC1–AC5 anchor is a real integration test but its AC5 assertion checks only `items`, not `total`, so it does not actually pin the tenant boundary on the count path. A negative test on `total` is missing (J.8). See MUST-1 and Test Coverage.
- **Section L (Git):** PASS — not yet committed; message prepared `slice 2: add ranked tenant-scoped search endpoint`.
- **Section M (Plan compliance):** PASS — files and endpoint shape match the plan; accepted `paginate` refactor landed as agreed (see Behaviour changes).
- **Section N (Behaviour visibility):** PASS — new endpoint documented in schema + route; response shape `{items, total}` matches plan.
- **Section D (Performance):** PASS — single query per path, index-backed `@@`. No N+1 (tags are materialised in the vector, not lazy-loaded per row).
- Sections B, I, K, O, P, Q — NOT TRIGGERED.

### Code Quality
- **MUST violations (blocking):**
  - **MUST-1 — `app/services/search.py:38` — C (tenant isolation) / H — the `total` count query is missing the `user_id` filter.** The items query correctly does `.where(Bookmark.search_vector.op('@@')(tsquery), Bookmark.user_id == user_id)` (`search.py:24`), but the count query is built as `select(func.count()).select_from(Bookmark).where(Bookmark.search_vector.op('@@')(tsquery))` — the `Bookmark.user_id == user_id` clause was dropped. Effect: a user searching a term that also matches **another** user's bookmarks gets the correct `items` (scoped) but an inflated `total` that counts the other tenant's rows. That both violates AC5 (a user learns another tenant's data exists / its count) and desynchronises `total` from `items`. **Proposed fix:** build the match+tenant predicate **once** and feed both queries from it, so they cannot drift — e.g. `predicate = (Bookmark.search_vector.op('@@')(tsquery), Bookmark.user_id == user_id)`, then `.where(*predicate)` on both. Add a regression test asserting `total` for user A excludes user B's matches (a J.8 negative test).
- **SHOULD violations (non-blocking):** none.
- **Suggestions (CONSIDER):** `search.py:31` — the `ts_rank` weight coefficients use the `ts_rank` default; if the plan's tunable-weights risk is exercised later, thread them as a named constant rather than an inline literal so the tuning surface is one place.

### Security
- Section C walked. The `q` value is passed as a bound parameter to `websearch_to_tsquery` — no SQL injection. The failure is **tenant isolation on the count path** (MUST-1): the security invariant "a user only ever sees their own bookmarks" (Q3 in grilling, AC5) is enforced on `items` but not on `total`. Blocking.

### Performance
- Section D — no N+1, index-backed match, single round-trip per path. Fine.

### Test Coverage
- **Anchors that demonstrably anchor:** `test_search_returns_ranked_tenant_scoped_results` — failed pre-implementation with 404. Genuine anchor for AC1–AC4 and the AC5 *items* boundary.
- **Tests that pass before AND after:** `test_list_pagination_characterization` (added to pin the list route before the `paginate` extraction — correct use of a characterization test, regression coverage by design).
- **Coverage gaps:** **no test asserts on `total` under a cross-tenant match** — which is exactly why MUST-1 slipped past the anchor. A negative test (`test_search_total_excludes_other_users`) must be added with the fix.

### Behaviour changes
- New `GET /bookmarks/search` endpoint returning `{items: [BookmarkSearchResult], total}`. Documented in schema/route.
- Accepted refactor `paginate(query, limit, offset)` extracted and both routes switched to it; pinned by a characterization test first (behaviour-preserving). Landed as signed off at plan approval — no scope expansion.

### Verdict: CHANGES REQUESTED
One MUST violation: the count query backing `total` omits the `user_id` tenant filter
(`search.py:38`), violating AC5 and Section C — a user's `total` leaks the existence/count of
another tenant's matching bookmarks even though `items` is correctly scoped. Fix by deriving
one match+tenant predicate and applying it to both the items and count queries, and add a
regression test asserting `total` excludes other users' matches. Re-review as
`code-review-slice-2-2.md` once addressed.
