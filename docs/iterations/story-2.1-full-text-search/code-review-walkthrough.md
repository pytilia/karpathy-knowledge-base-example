# Story 2.1 — Full-text search over bookmarks — Code-review walkthrough

> **Example iteration.** A narrative, diff-level walkthrough of the "Bookmarkr" worked example
> for a future reader — the shape of the change, block by block, per the
> [development workflow](../../development-workflow.md) Phase-4 "Code review walkthrough"
> guidance (large/critical-path tier). Grouped by **logical concern**, not by file.
> Diff base: `git diff main...story-2.1-full-text-search`.

## Orientation

The change is two tracer-bullet slices: a migration that adds a searchable, weighted column
(Slice 1), and a service + endpoint that queries it (Slice 2). Read them in that order — the
endpoint is meaningless without the column. Six files move:

| File | Slice | Role |
|------|-------|------|
| `alembic/versions/a3f1c8b2e04d_add_bookmark_search_vector.py` | 1 | Generated `tsvector` column + GIN index |
| `app/models/bookmark.py` | 1 | Maps the column read-only |
| `app/services/search.py` | 2 | Builds the ranked, tenant-scoped query |
| `app/api/bookmarks.py` | 2 | New `GET /bookmarks/search` route + `paginate` extraction |
| `app/schemas/bookmark.py` | 2 | `BookmarkSearchResult` (adds `rank`) |
| `tests/integration/test_bookmark_search.py` (+ `test_bookmark_list.py`) | 1,2 | Anchors, AC coverage, characterization test |

---

## Block 1 — The search vector and index (the substrate)

**What the code does.** The migration adds one column:

```
search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')),       'A') ||
    setweight(to_tsvector('english', coalesce(tag_text, '')),    'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(url, '')),         'D')
) STORED
```

and a GIN index on it. The model change (`bookmark.py`) maps `search_vector` as a `deferred`,
read-only column via `FetchedValue()`.

**Why it exists.** This is where relevance ranking lives (ADR-0001). The `setweight` labels
A–D are not cosmetic — they are what makes a title match outrank a description match (AC2),
computed once at write time and stored, so ranking is index-backed rather than a Python sort.
`STORED` means Postgres maintains it on every insert/update; the application must never write
it, which is why the model maps it read-only.

**Key things to verify.**
- The column is **generated**, not application-populated — a reviewer should confirm nothing
  in the app writes `search_vector` (it can't; `FetchedValue()` + no setter).
- `coalesce(..., '')` on every field — without it, a null title would null the whole
  concatenated vector. Check all four fields are guarded.
- Tag text is materialised into the vector (weight B). Tags are a many-to-many relation, so
  the generated expression depends on `tag_text` being available on the row — verify how that
  is sourced (a denormalised column / trigger-maintained aggregate), because a plain join
  can't appear in a generated-column expression.
- The migration `downgrade()` drops the index **then** the column, and `down_revision` chains
  correctly — this migration is reversible.

---

## Block 2 — The search service (ranking + the tenant guard)

**What the code does.** `app/services/search.py` exposes
`search_bookmarks(session, user_id, query, limit, offset)`. It builds
`websearch_to_tsquery('english', :q)`, then constructs **one** predicate:

```
predicate = (
    Bookmark.search_vector.op('@@')(tsquery),
    Bookmark.user_id == user_id,
)
```

and applies it to **both** the ranked items query (`order_by(ts_rank(search_vector,
tsquery).desc())`, paginated) **and** the count query (`select(func.count())...where(*predicate)`).

**Why it exists.** This is the core of the feature: parse a user's raw query forgivingly
(`websearch_to_tsquery` tolerates the kind of syntax users type), match it against the
weighted vector, and rank. The single shared `predicate` is the load-bearing design detail —
see the next paragraph.

**Key things to verify — this is where the review bug was.** The tenant filter
(`Bookmark.user_id == user_id`) must be on **both** queries. In slice-2 review round 1 it was
present on the items query but **missing on the count query**, so `total` counted other users'
matches while `items` was correctly scoped — a tenant-isolation leak (AC5 / Section C). The
fix was structural: build the predicate once and splat it into both `.where(*predicate)` calls
so they physically cannot diverge again. A reviewer should confirm there is exactly one
predicate definition and no second, hand-rolled `where` anywhere in the service. The
regression test `test_search_total_excludes_other_users` pins this: seed a cross-tenant match,
assert user A's `total == 1`.

Also verify: `q` reaches `websearch_to_tsquery` as a **bound parameter**, never string-
interpolated (no SQL injection surface).

---

## Block 3 — The route, the schema, and the `paginate` extraction

**What the code does.** `app/api/bookmarks.py` gains `GET /bookmarks/search`. It declares
`q: str = Query(min_length=1)`, resolves `user_id` from the existing auth dependency, calls
`search_bookmarks`, and returns `{items, total}`. `app/schemas/bookmark.py` adds
`BookmarkSearchResult` — the existing bookmark shape plus a `rank: float`. The inline
limit/offset slicing that the list route and the new search route both needed is extracted
into `paginate(query, limit, offset)`.

**Why it exists.** `min_length=1` is the enforcement point for the grilling decision that an
empty `q` is a client error — FastAPI returns `422` before the service runs (contrast AC4: a
valid query with no hits returns `200` + `[]`). The `paginate` extraction was an accepted
refactor at plan approval: the search route needed the same pagination the list route already
had inline, so the duplication was pulled into one helper rather than copied.

**Key things to verify.**
- `422` on empty/whitespace `q` (boundary validation), **`200` + empty list** on a valid
  no-match query — these are two different behaviours and both are tested.
- The `paginate` extraction is **behaviour-preserving** for the pre-existing list route. It
  was pinned first by `test_list_pagination_characterization` (a characterization test written
  against the *old* behaviour), then the list route switched to the helper. A reviewer should
  confirm the list route's observable pagination (limit/offset boundaries, `total`) is
  unchanged — that is what the characterization test guards.
- `BookmarkSearchResult.rank` is populated from `ts_rank`, and the route declares it as its
  `response_model` so the field is part of the documented contract.

---

## Block 4 — Tests (what actually anchors)

**What the code does.** `tests/integration/test_bookmark_search.py` carries:
`test_inserted_bookmark_has_populated_search_vector` (Slice 1 anchor);
`test_search_returns_ranked_tenant_scoped_results` (Slice 2 anchor, AC1–AC5, two users
seeded); `test_search_total_excludes_other_users` (the AC5 count-path regression from review);
`test_search_uses_gin_index` (AC6, `EXPLAIN (FORMAT JSON)` asserts a `Bitmap Index Scan` on
`ix_bookmarks_search_vector`). `test_bookmark_list.py` carries the `paginate` characterization
test.

**Why it exists.** These are the evidence the ACs hold. Two are worth a reviewer's attention:
- `test_search_uses_gin_index` (AC6) is the **cross-slice guard** — it proves Slice-2's query
  actually uses Slice-1's index rather than sequential-scanning. A future change that breaks
  index usage fails here.
- `test_search_total_excludes_other_users` exists **because the anchor didn't catch the count
  leak** — it asserts on `total` specifically, the field the original anchor ignored.

**Key things to verify.** All are integration tests against real Postgres (testcontainers) and
run **in-suite**, not standalone — the `EXPLAIN` and `tsvector` behaviour depend on a real
database, and in-suite execution avoids masking suite-ordering flakes. Confirm each anchor
would have failed before its slice (Slice 1: missing-column error; Slice 2: 404;
count-regression: `total == 2`), which is what makes them anchors rather than regression
coverage bolted on afterward.
