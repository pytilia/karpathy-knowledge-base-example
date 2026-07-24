# Story 2.1 — Full-text search over bookmarks — Summary

> **Example iteration.** The Phase-4 explainability report for the "Bookmarkr" worked example,
> written for a future engineer or stakeholder who was not in the room. It shows what a
> `summary.md` looks like when the [development workflow](../../development-workflow.md) is
> followed end to end. **Shipped:** 2026-07-03.

## What changed

A signed-in user can now search their own bookmarks by keyword and get the most relevant
matches first. `GET /bookmarks/search?q=<query>` returns the caller's matching bookmarks
ranked by relevance, as `{ "items": [...], "total": N }`. Matching spans a bookmark's title,
tags, description, and url; a title hit ranks above a tag hit, which ranks above a
description hit, which ranks above a url hit. Search is strictly tenant-isolated — a user can
never see another user's bookmarks, on either the results list or the count. This is
backend-only; the React search box is a follow-up.

## Why it was built this way

- **PostgreSQL full-text search, not Elasticsearch** ([ADR-0001](../../decisions/0001-postgres-fts-over-elasticsearch.md)).
  The data is small and per-user, search is always scoped to one `user_id`, and the team has
  no ops capacity for a new datastore. Elasticsearch would add a whole service to run, sync,
  secure, and upgrade for relevance we don't need yet. FTS is a single migration and zero new
  infrastructure. Revisit triggers (cross-user search, ~1M rows/user, fuzzy matching) are
  recorded in the ADR.
- **Ranking via weighted `tsvector` (`setweight`).** AC2 ("title match outranks
  description-only") is satisfied declaratively in the generated column: title = A, tags = B,
  description = C, url = D, ranked at query time with `ts_rank`. Weighting the *index* rather
  than post-sorting in Python keeps ranking correct and index-backed. The exact weight
  coefficients are a deliberate first guess — tunable later at query time with no schema
  migration (recorded as a risk in the plan).
- **Empty query is a client error (422), no-match is a 200.** Decided in grilling (Q5): an
  empty `q` is a bad request (enforced with `Query(min_length=1)`), whereas a valid query with
  zero hits returns `200` + `[]` (AC4). Two different states, deliberately not conflated.

## How it fits together

Two vertical slices:

1. **Migration (Slice 1)** adds a generated `search_vector tsvector` column on `bookmarks`
   (weighted across title/tags/description/url) plus a **GIN index**. The column is
   `GENERATED ALWAYS ... STORED`, so Postgres maintains it on every write; the ORM maps it
   read-only (`FetchedValue`, deferred). Tag text is materialised into the vector at write
   time because tags are a separate many-to-many relation.
2. **Endpoint (Slice 2)** adds `app/services/search.py`, which parses the query with
   `websearch_to_tsquery('english', :q)`, matches with `@@` against the vector, ranks with
   `ts_rank`, and filters by `user_id`. The route in `app/api/bookmarks.py` validates `q`,
   applies the shared `paginate` helper, and returns `BookmarkSearchResult` rows (which carry
   a `rank` field). Slice 2 depends entirely on Slice 1's column — the endpoint is untestable
   without it, which is why the two shipped as one iteration.

Data flow: request → auth dependency (yields `user_id`) → `search_bookmarks(session, user_id,
q, limit, offset)` → one predicate `(vector @@ tsquery AND user_id = caller)` feeding both the
ranked items query and the count query → JSON `{items, total}`.

## The bug caught in review (and how)

The round-1 slice-2 agent review ([code-review-slice-2-1.md](code-review-slice-2-1.md)) caught
a **real tenant-isolation defect**: the `items` query was correctly scoped to `user_id`, but
the **count query backing `total` had the `user_id` filter dropped**. A user searching a term
that also matched another user's bookmarks would get correctly-scoped `items` but an inflated
`total` that counted the other tenant's rows — a Section C / AC5 violation that leaks the
existence and count of another user's data. The original AC1–AC5 anchor missed it because it
asserted on `items`, not `total`. Fixed by deriving the match+tenant predicate **once** and
feeding both queries from it (so they can't drift), plus a dedicated regression test
`test_search_total_excludes_other_users`. Round 2
([code-review-slice-2-2.md](code-review-slice-2-2.md)) confirmed APPROVED. This is the
per-slice gate doing exactly its job — surfacing a security issue at the slice where it was
introduced, before merge.

## Deferred / what's left

- **Typo tolerance / fuzzy matching** — deferred, product-signed-off for launch. A misspelled
  query returns nothing. It is an ADR-0001 revisit trigger.
- **Tag *filtering* (`?tag=`)** → **Story 2.2**. This story matches tags but does not filter by
  them.
- **Sort toggles (relevance / recency)** → **Story 2.3**.
- **Frontend search UI** — backend-only this iteration; the React search box is a follow-up.
- **Ranking weight coefficients** are a first guess; tune at query time, no migration needed.

## Deferred refactors

None carried. The one accepted refactor (`paginate` extraction) landed inside Slice 2, pinned
by a characterization test.

## Review iterations

- **Slice 1** ([code-review-slice-1-1.md](code-review-slice-1-1.md)): APPROVED with one
  non-blocking suggestion (pull the AC6 `EXPLAIN` index-usage check forward). Actioned — the
  integration test now exists.
- **Slice 2** rounds 1→2: CHANGES REQUESTED (missing tenant filter on the count path) → fixed →
  APPROVED.
- **Final integration** ([code-review-final-1.md](code-review-final-1.md)): APPROVED. AC1–AC6
  all PASS, including AC6 (`EXPLAIN` confirms the GIN index is used) and the cross-slice
  ranking interaction.

## TDD trace digest

TDD was followed for both slices (full record in [tdd-trace.md](tdd-trace.md)). Slice 1's
anchor `test_inserted_bookmark_has_populated_search_vector` failed red with
`column bookmarks.search_vector does not exist`, then passed once the migration added the
weighted generated column + GIN index (no refactor — new code only). Slice 2's anchor
`test_search_returns_ranked_tenant_scoped_results` failed red with a 404, then passed covering
AC1–AC5 once the service, route, and schema landed; the accepted `paginate` refactor was
applied inside the green window after pinning the list route with a characterization test. A
second red/green cycle in Slice 2 covered the review-surfaced tenant-filter fix via
`test_search_total_excludes_other_users` (`total==2` red → `total==1` green). No `[VIOLATION]`
markers — TDD was followed throughout.
