---
name: docs log
description: Append-only chronological log of decisions, ingests, iterations, meetings, and incidents. Grep-friendly. Newest at the bottom.
status: active
topic: process
last_reviewed: 2026-07-01
---

# Project Log (EXAMPLE)

> **Example log for the fictional "Bookmarkr" project.** It shows the format and cadence —
> every Phase 4 appends here. Replace these entries with your own. The value of this file is
> "compile once, query forever": grep it for *when* and *why* something happened.

Append-only. Newest at the bottom. Format:

```
## [YYYY-MM-DD] type | one-line title
- Link(s)
- Optional one-paragraph note (only if it isn't obvious from the linked artifact)
```

Types: `decision`, `iteration`, `meeting`, `ingest`, `incident`, `process-change`, `proposal`, `epic-plan`.

> Phase 4 of `development-workflow.md` MUST append to this file. Do not edit prior entries — supersede with a new entry instead.

---

## [2026-06-01] epic-plan | Epic 1 (Core CRUD) planned
- [JIRA board](references/01-jira-board-structure.md)
- Four stories: save, edit/delete, tag, list bookmarks. ~4 SP total.

## [2026-06-18] iteration | Epic 1 (Core CRUD) shipped
- [JIRA board — Epic 1](references/01-jira-board-structure.md)
- Stories 1.1–1.4 complete. `Bookmark` and `Tag` models, CRUD endpoints, per-user pagination. Tenant isolation established as the load-bearing invariant (cross-tenant reads return 404).

## [2026-06-27] meeting | Story 2.1 search kickoff
- [Minutes](minutes/2026-06-27-story-2.1-kickoff.md)
- Scoped Epic 2 search. Agreed Postgres FTS over Elasticsearch; deferred typo tolerance; search is per-user only.

## [2026-06-30] decision | Postgres full-text search over Elasticsearch (ADR-0001)
- [ADR-0001](decisions/0001-postgres-fts-over-elasticsearch.md)
- Per-user dataset is small; Postgres FTS adds zero new infra. Revisit if cross-user search, ~1M rows/user, or fuzzy matching become requirements.

## [2026-07-01] decision | Defer Epic 3 (Sharing) pre-launch
- [JIRA board — Epic 3](references/01-jira-board-structure.md)
- Sharing needs an access-control model not worth building before the core product has users. Recorded so the deferral is visible, not silently dropped.

## [2026-07-03] iteration | story-2.1 full-text search
- [Plan](iterations/story-2.1-full-text-search/plan.md) · [Summary](iterations/story-2.1-full-text-search/summary.md) · [Final review](iterations/story-2.1-full-text-search/code-review-final-1.md)
- Weighted `tsvector` + GIN index; ranked, tenant-scoped `GET /bookmarks/search`. Slice-2 review round 1 caught a missing `user_id` filter (would have leaked other users' bookmarks) — fixed in round 2 with a regression test. AC1–AC6 met.
