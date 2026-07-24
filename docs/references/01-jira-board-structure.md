---
name: JIRA Board Structure
description: Example epics, stories, sub-tasks, acceptance criteria and story-points for the Bookmarkr example project. Source of truth for what's planned vs deferred.
status: active
topic: programme
last_reviewed: 2026-06-25
---

# Bookmarkr — JIRA Board Structure (EXAMPLE)

> **This is an example board for a fictional product ("Bookmarkr"), included so an
> adopter of this knowledge base can see the shape of a real board — epics, stories,
> sub-tasks, acceptance criteria, story-point estimates, and how "done"/"deferred" are
> recorded. Replace this file wholesale with your own board.**

All estimates use **story points** (1 SP ≈ 1 day with AI-assisted development). Estimates
assume AI tooling throughout. Where a story has sub-tasks, the parent's points are the sum
of its children.

**The product in one line:** Bookmarkr lets a signed-in user save a URL, title and tags it,
and later searches across their saved bookmarks.

---

## Epic 1: Core CRUD

**Goal:** A user can create, read, update, and delete their own bookmarks, and tag them.
**Total:** ~4 SP — ✅ COMPLETE

### ~~Story 1.1 — Save a bookmark~~ ✅ COMPLETE
**Points:** 1 SP
**Priority:** Highest — the product does nothing without this.

**As a** signed-in user **I want to** save a URL with a title and description **so that** I can find it again later.

**Acceptance criteria**
- Given a valid URL and title, when I POST `/bookmarks`, then a bookmark is created and returned with a generated `id` and `created_at`.
- Given a missing or malformed URL, when I POST `/bookmarks`, then I get `422` with a field-level error.
- Given I am not signed in, when I POST `/bookmarks`, then I get `401`.
- A created bookmark is owned by the calling user and never visible to another user.

| Task | Points | Description |
|------|--------|-------------|
| 1.1.1 `Bookmark` model + migration | 0.25 | `id`, `user_id`, `url`, `title`, `description`, `created_at`, `updated_at` |
| 1.1.2 `POST /bookmarks` endpoint + request/response schemas | 0.5 | Validation, owner binding from auth context |
| 1.1.3 Tests: happy path, validation, authz | 0.25 | Integration tests against real DB |

### ~~Story 1.2 — Edit / delete a bookmark~~ ✅ COMPLETE
**Points:** 1 SP
**Priority:** High.

**Acceptance criteria**
- Given a bookmark I own, when I PATCH it, then the mutable fields update and `updated_at` advances.
- Given a bookmark I do **not** own, when I PATCH or DELETE it, then I get `404` (not `403` — don't leak existence).
- Given a bookmark I own, when I DELETE it, then it is removed and a subsequent GET returns `404`.

| Task | Points | Description |
|------|--------|-------------|
| 1.2.1 `PATCH /bookmarks/{id}` | 0.4 | Partial update, ownership check returns 404 on miss |
| 1.2.2 `DELETE /bookmarks/{id}` | 0.3 | Hard delete, ownership check |
| 1.2.3 Tests incl. cross-tenant 404 | 0.3 | Tenant-isolation is the load-bearing case |

### ~~Story 1.3 — Tag a bookmark~~ ✅ COMPLETE
**Points:** 1.5 SP
**Priority:** High — search (Epic 2) ranks tags, so tags must exist first.

**Acceptance criteria**
- Given a bookmark I own, when I attach tags, then tags are lowercased and trimmed, and duplicates within the request collapse to one.
- A tag is scoped to the user: two users may both have a `python` tag without collision.
- Given I remove all tags, when I GET the bookmark, then `tags` is an empty list (never `null`).

| Task | Points | Description |
|------|--------|-------------|
| 1.3.1 `Tag` model + `bookmark_tags` join table + migration | 0.5 | Many-to-many, `(user_id, name)` unique |
| 1.3.2 Attach/detach tags on create + update | 0.5 | Normalisation (lowercase, trim, dedupe) |
| 1.3.3 Tests: normalisation, per-user scoping | 0.5 | |

### ~~Story 1.4 — List a user's bookmarks (paginated)~~ ✅ COMPLETE
**Points:** 0.5 SP
**Priority:** Medium.

**Acceptance criteria**
- Given I have N bookmarks, when I GET `/bookmarks?limit=20&offset=0`, then I get at most 20, newest first, with a total count.
- Pagination is database-level (LIMIT/OFFSET), never in-memory.

| Task | Points | Description |
|------|--------|-------------|
| 1.4.1 `GET /bookmarks` with limit/offset + ordering | 0.3 | Index on `(user_id, created_at desc)` |
| 1.4.2 Tests | 0.2 | |

---

## Epic 2: Search

**Goal:** A user can find their bookmarks by typing a query, with relevant results ranked first.
**Total:** ~4 SP — 🚧 IN PROGRESS

### Story 2.1 — Full-text search over bookmarks 🚧 IN PROGRESS
**Points:** 2 SP
**Priority:** Highest in this epic — everything else in Epic 2 builds on it.
**Iteration:** [`iterations/story-2.1-full-text-search/`](../iterations/story-2.1-full-text-search/plan.md) — this is the **worked example iteration** for this knowledge base.

**As a** signed-in user **I want to** type a query and get my matching bookmarks ranked by relevance **so that** I can find a saved link without scrolling.

**Acceptance criteria**
- **AC1** Given I have bookmarks, when I search a word in a bookmark's title, then that bookmark appears in results.
- **AC2** Given a query matching title *and* description, when I search, then results are ranked by relevance — a title match outranks a description-only match.
- **AC3** Given a query matching a tag, when I search, then bookmarks with that tag appear.
- **AC4** Given no matches, when I search, then I get an empty list with `200` (not `404`).
- **AC5** Given another user's bookmarks match the query, when I search, then I never see them (tenant isolation).

**Design decision:** [ADR-0001 — Postgres full-text search over Elasticsearch](../decisions/0001-postgres-fts-over-elasticsearch.md).

| Task | Points | Description |
|------|--------|-------------|
| 2.1.1 `search_vector` generated column + GIN index (migration) | 0.75 | Weighted `tsvector` over title (A), tags (B), description (C), url (D) |
| 2.1.2 `GET /bookmarks/search?q=` — ranked, tenant-scoped | 0.75 | `ts_rank`, `websearch_to_tsquery`, `user_id` filter |
| 2.1.3 Tests: AC1–AC5, index-usage assertion | 0.5 | `EXPLAIN` confirms GIN index is used |

### Story 2.2 — Filter search by tag
**Points:** 1 SP · **Priority:** Medium · Planned (blocked by 2.1).

**Acceptance criteria**
- Given a search query and a `tag` filter, when I search, then results match the text query **and** carry the tag.
- Given only a `tag` filter and no text query, when I search, then I get all my bookmarks with that tag, newest first.

### Story 2.3 — Sort results (relevance / recency)
**Points:** 1 SP · **Priority:** Low · Planned (blocked by 2.1).

**Acceptance criteria**
- Given search results, when I pass `sort=relevance` (default) or `sort=recent`, then ordering changes accordingly.

---

## Epic 3: Sharing — ⏸ DEFERRED

**Goal:** Users can share bookmarks or collections with others.
**Status:** Deferred pre-launch. Recorded here so the *decision to defer* is visible rather than
forgotten. See `log.md` for the dated rationale (scope control — sharing needs an access-control
model that isn't worth building before the core product has users).

### Story 3.1 — Public share links — ⏸ DEFERRED
Turn a bookmark or a set into a read-only public URL.

### Story 3.2 — Collaborative collections — ⏸ DEFERRED
Multiple users contributing to one shared collection. Requires a permissions model; out of scope pre-launch.

---

## How to read this board

- **Strikethrough + ✅** = shipped. The story stays on the board (with its ACs) as a historical record; don't delete completed stories.
- **🚧** = in progress; the linked iteration folder carries the live plan, TDD trace, and reviews.
- **⏸ DEFERRED** = consciously scoped out. The rationale lives in `log.md` and, if load-bearing, an ADR — never as a silent omission.
- Sub-task points sum to the parent story's points. Stories sum to the epic total.
