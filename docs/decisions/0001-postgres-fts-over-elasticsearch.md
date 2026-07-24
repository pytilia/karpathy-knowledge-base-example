---
adr: 0001
status: accepted
date: 2026-06-30
---

# ADR-0001: Use PostgreSQL full-text search for bookmark search, not Elasticsearch

> **Example ADR.** This records a load-bearing decision made during the worked example
> iteration [`story-2.1-full-text-search`](../iterations/story-2.1-full-text-search/plan.md).
> It shows the ADR format this knowledge base uses: Context → Decision → Alternatives
> considered → Consequences → References, with a revisit trigger. Replace with your own.

## Context

Story 2.1 needs full-text search over a user's bookmarks (title, description, url, tags),
ranked by relevance, with strict per-user tenant isolation (AC5). The data is small and
per-user: a heavy user has thousands of bookmarks, not millions. Search is always scoped to
one `user_id` — there is no cross-user or global search requirement, now or on the near
roadmap. We are a small team with no dedicated ops capacity, running one Postgres instance
and one application container.

The question: adopt a dedicated search engine (Elasticsearch / OpenSearch) now, or use
PostgreSQL's built-in full-text search?

## Decision

Use **PostgreSQL full-text search**:

- A generated `search_vector tsvector` column on `bookmarks`, built with `setweight` so
  title matches (weight A) outrank tags (B), description (C), and url (D) — this satisfies
  AC2's ranking requirement directly in the index.
- A **GIN index** on `search_vector`.
- Query with `websearch_to_tsquery` (forgiving of user-entered syntax) and rank with
  `ts_rank`, always filtered by `user_id`.

No new infrastructure, no separate datastore to run, sync, secure, or back up.

## Alternatives considered

- **Elasticsearch / OpenSearch.** Best-in-class relevance, fuzzy/typo tolerance, faceting.
  Rejected for *now*: it adds a whole service to operate (provisioning, security, index
  sync from the source of truth, version upgrades) for a workload Postgres handles at this
  scale. The relevance ceiling it buys is not a requirement yet. Introducing it now is
  buying capability we can't justify operating.
- **`ILIKE '%q%'` substring matching.** Simplest possible. Rejected: no relevance ranking
  (fails AC2), can't use a normal B-tree index for leading-wildcard matches, and degrades
  linearly. FTS is barely more code and is correct.
- **Application-level search (load rows, rank in Python).** Rejected outright: pulls the
  whole table into memory, doesn't scale, and reimplements what the database already does
  well.

## Consequences

- **Positive:** zero new infra; search is transactional and always consistent with writes
  (no sync lag); tenant isolation is a plain `WHERE user_id = ...`; ranking is declarative
  via `setweight`.
- **Negative / accepted limits:** no fuzzy/typo tolerance (a misspelled query misses);
  relevance tuning is coarser than a dedicated engine; the `tsvector` column and GIN index
  add write-time cost and storage (negligible at our volume).
- **Operational:** one migration adds the column + index; `EXPLAIN` in the test suite asserts
  the GIN index is actually used, so a future regression that drops it is caught.

## Revisit trigger

Reopen this decision if **any** of the following becomes real:

- Cross-user or global/public search is required (Epic 3 sharing could pull this in).
- A single user's bookmark count approaches ~1M rows, or search latency exceeds budget under `EXPLAIN ANALYZE`.
- Fuzzy matching / typo tolerance / synonyms become product requirements.

## References

- Iteration: [`story-2.1-full-text-search/plan.md`](../iterations/story-2.1-full-text-search/plan.md)
- JIRA: Story 2.1 in [`references/01-jira-board-structure.md`](../references/01-jira-board-structure.md)
- PostgreSQL docs: Text Search Controls (`tsvector`, `setweight`, `ts_rank`, `websearch_to_tsquery`)
