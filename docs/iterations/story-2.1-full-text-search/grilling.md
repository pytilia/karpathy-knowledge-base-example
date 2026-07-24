# Story 2.1 — Full-text search over bookmarks — Grilling

> **Example iteration.** This is the pre-plan grilling record for the fictional "Bookmarkr"
> worked example. It shows what a `grilling.md` looks like when the
> [development workflow](../../development-workflow.md) Phase-1 grilling rules are followed:
> every load-bearing question resolved before a line of plan was written, each tagged with
> its provenance (`answered by human` / `deferred`). PO in this example is "Priya".

**Session date:** 2026-06-29 (before [`plan.md`](plan.md); before [ADR-0001](../../decisions/0001-postgres-fts-over-elasticsearch.md))
**Participants:** the engineer (grilling agent), Priya (PO, answering)
**Domain check:** stress-tested against `CONTEXT.md` (Bookmark / Tag / SearchQuery glossary) and `decisions/`.

The grilling continued until every load-bearing assumption was flushed. No question below
was self-answered by the agent — grilling answers are a human gate.

---

## Q1 — Postgres FTS or Elasticsearch? *(answered by human)*

**Why it matters:** determines the entire infrastructure surface of the story — one migration
vs. a new service to run, sync, secure, and back up.

**Resolution:** PostgreSQL full-text search. The dataset is per-user and small (thousands of
rows per heavy user), search is always scoped to a single `user_id`, and the team has no ops
capacity for a new datastore. Elasticsearch's relevance/fuzzy ceiling is not a requirement
today. **Recorded as [ADR-0001](../../decisions/0001-postgres-fts-over-elasticsearch.md)**
with an explicit revisit trigger (cross-user search / ~1M rows-per-user / typo tolerance).

## Q2 — Should a title match rank above a description-only match? *(answered by human)*

**Why it matters:** this is AC2. It dictates whether the `tsvector` needs weighting or a flat
vector is enough.

**Resolution:** Yes. A title hit is a stronger signal of relevance than a body hit. Implement
with `setweight` in the generated column: **title = A, tags = B, description = C, url = D**,
ranked at query time with `ts_rank`. Priya confirmed the ordering; the exact weight
*coefficients* are a tunable guess (flagged as a risk in the plan, cheap to change at query
time with no schema migration).

## Q3 — Does search ever cross users (global / shared bookmarks)? *(answered by human)*

**Why it matters:** tenant isolation (AC5) is a security invariant, and cross-user search
would have reopened Q1 (it's a revisit trigger for the ADR).

**Resolution:** No — out of scope, and out of scope for the near roadmap. Every query is
filtered by the authenticated caller's `user_id`; a user must never see another user's
bookmarks. Public/shared search belongs to Epic 3 (Sharing), which is DEFERRED. This makes
the tenant filter a non-negotiable `WHERE user_id = :caller` on every code path, and AC5 the
anchor test's most important assertion.

## Q4 — Typo tolerance / fuzzy matching? *(deferred — see [plan.md](plan.md) risks)*

**Why it matters:** users misspell queries; a strict match returns nothing for "javscript".

**Resolution:** Deferred, product-signed-off. Postgres FTS with `websearch_to_tsquery` does
lexeme matching, not fuzzy matching, so a misspelled query returns an empty list. Priya
accepted this for launch. It is one of the explicit ADR-0001 revisit triggers and is recorded
under **Risks and trade-offs** in the plan ("No typo tolerance — accepted per ADR-0001").

## Q5 — What does an empty query (`?q=`) return? *(answered by human)*

**Why it matters:** an empty or whitespace-only `q` is an ambiguous request — "everything",
"nothing", or "bad request". `websearch_to_tsquery('')` produces an empty tsquery that matches
nothing, so the behaviour must be decided deliberately, not fall out of the driver.

**Resolution:** **`422 Unprocessable Entity`.** An empty search is a client error, not a
"return all bookmarks" shortcut (that's what the existing paginated list endpoint is for).
Enforce with a `min_length=1` (post-strip) constraint on the query param so FastAPI rejects it
before the service runs. A *no-match* query (valid word, zero hits) is different — that is
**AC4: `200` with an empty list**, never a 404.

## Q6 — Should tag matches surface a bookmark, and how are tags folded into the vector? *(answered by human)*

**Why it matters:** AC3 requires tag matches. Tags are a many-to-many relation, not a column
on `bookmarks`, so the generated `tsvector` needs the tag text materialised at write time.

**Resolution:** Yes, tag matches count (weight B, below title). Confirmed the generated column
concatenates the user's tag labels for that bookmark into the vector. Noted as a dependency:
the generated-column expression must include tag text; a follow-up (**Story 2.2**) adds tag
*filtering* (`?tag=`) which is a different feature and stays out of scope here.

---

## Deferrals carried into the plan

| Item | Disposition | Where recorded |
|------|-------------|----------------|
| Fuzzy / typo tolerance | Deferred, launch-signed-off | plan.md risks; ADR-0001 revisit trigger |
| Tag *filtering* (`?tag=`) | Out of scope → Story 2.2 | plan.md scope |
| Sort toggles (relevance/recency) | Out of scope → Story 2.3 | plan.md scope |
| Ranking weight coefficients | Ship the guess, tune later (no migration) | plan.md risks |

**Grilling exit:** all six load-bearing questions resolved (five answered by human, one
deferred with sign-off). Cleared to write the plan.
