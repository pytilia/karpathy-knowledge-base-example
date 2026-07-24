---
name: Claude Code Skills Strategy
description: When to apply each Claude Code skill within each workflow phase. Targets ~5–10% calendar overhead.
status: active
topic: process
last_reviewed: 2026-05-19
---

# Claude Code Skills — Development Strategy

How and when to apply Claude Code skills during day-to-day development. Complements `karpathy-knowledge-base-example/docs/development-workflow.md` (the Plan → Code → Review → Explain cycle); does not replace it.

> Examples throughout use the **Bookmarkr** example project shipped with this template — a small link-saving SaaS where a signed-in user saves URLs with titles and tags and searches across them. Swap in your own project when you adopt this doc.

---

## Constraints

- **Tune the ceiling to your team.** The guidance below assumes a small team optimizing for calendar time, not ceremony. A larger team, or one with a compliance floor, will move the ceiling — adjust accordingly.
- **Skills are tools, not gates.** Apply them where they earn their cost. Bureaucracy disguised as process is still bureaucracy.
- **Default bias: less is more.** A 1 SP story does not need a CONTEXT.md update, a parallel interface exploration, a grilling session, and a deepening review. Pick what matters.

The rule of thumb: **target ~5–10% calendar overhead from skills**. Above that, you are buying ceremony, not quality.

---

## Story-size tiering — what to run per story

Match the skill stack to story size. SP values are days-with-AI per the board.

| Size | Examples | Plan-phase skills | Code-phase skills | Review |
|---|---|---|---|---|
| **Trivial** (<0.25 SP) | typo, config value, copy change, single-line fix | none | none | manual eyeball |
| **Small** (0.25–0.5 SP) | a small task inside a story | none — write the plan inline in the iteration folder | `tdd` if logic-bearing; otherwise just write it | `/review` |
| **Medium** (0.5–2 SP) | most feature stories — e.g. Bookmarkr Story 2.1 full-text search | `grill-with-docs` (~30 min) | `tdd` | `/review` + `simplify` |
| **Large** (2+ SP, critical path) | a critical-path story with a wide design space — e.g. an auth, payments, or search-engine core module | `grill-with-docs` + `design-an-interface` + light `improve-codebase-architecture` pass; lazy-update `CONTEXT.md` for any new domain terms | `tdd` (mandatory — these are too expensive to rework) | `/review` + `/security-review` + `simplify` |

**Critical-path stories deserve the full stack.** Rework on a core module cascades into everything built on top of it. An hour of grilling beats a day of refactoring.

---

## Skills mapped to the development cycle

### Plan phase

| Skill | When to use | When to skip | Cost |
|---|---|---|---|
| **`grill-with-docs`** | Medium+ stories. Especially ambiguous requirements, branching design decisions, or any story where you suspect an assumption hidden in the prompt. Stress-tests the framing against `CONTEXT.md` and `karpathy-knowledge-base-example/docs/decisions/`, sharpening terminology and updating those docs inline as decisions crystallise. | Trivial fixes, copy changes, well-bounded plumbing where the input/output shape is obvious. | 30–60 min |
| **`design-an-interface`** | Large stories where the public seam of a new module matters and you can imagine 2–3 plausible shapes — e.g. the search service in Story 2.1. Run it *before* committing to one. | Internal helpers, single-implementation modules where the shape is forced by the call site. | 20–40 min |
| **`improve-codebase-architecture`** | When touching code that *already* feels gnarly, or when your new module would be the third caller of a shallow helper (deletion-test territory). Run as a light pass — don't accept every recommendation. | Greenfield modules. Stories that are pure plumbing. | 15–45 min |
| **`request-refactor-plan`** | Standalone refactors that span multiple commits and need a structured incremental plan (e.g. splitting a monolith module). | Refactors that fit in one PR. | 30–60 min |
| **`to-prd`** | New initiatives that need a written brief before planning. | Anything already on the board. | 20 min |
| **`to-issues`** | Breaking a fresh PRD or plan into stories on the board. | Existing planned work. | — |

### Code phase

| Skill | When to use | When to skip | Cost |
|---|---|---|---|
| **`tdd`** | Default for medium+ stories with non-trivial logic. Especially: ranking/scoring, tenant-isolation filters, sync orchestration, webhook idempotency, authz checks. | Pure infrastructure plumbing (Terraform, dependency upgrades), copy changes, UI tweaks where behaviour is visual. | adds ~10–20% per story; pays back in caught bugs |
| **`claude-api`** | Anything touching an LLM/agent surface — prompt caching, tool use, model migration, token budgeting. | Non-LLM code. | 0 — just invoke when relevant |
| **`frontend-design`** | When building a new page or a polished component from a fresh brief. | Iterating on existing styled pages where the design is locked. | varies |
| **`simplify`** | Mid-implementation, when a feature works but the diff feels bloated. Run before opening for review to catch reuse opportunities and dead code. | Trivial fixes. | 10–20 min |

### Review phase

Per the 2026-05-19 workflow change, reviews split into two: **per-slice reviews** (inside Phase 2, after each slice's TDD; one agent review + one human-in-the-loop review per slice before the slice commits) and the **final integration review** (Phase 3, across the integrated branch). The skills below apply to both — only the diff scope differs.

| Skill | When to use | When to skip | Cost |
|---|---|---|---|
| **`/review`** | After every slice (slice diff scope) and again at the final integration review (full integrated diff scope). This is the existing review agent — the prompt the workflow binds is the same; what changes is what diff is fed in. | Never — it's the gate. | per existing workflow, x N slices + 1 final |
| **`/security-review`** | At the slice that introduces a security-sensitive surface (authz, auth, payment, webhook handling, file upload, outbound HTTP, tenant isolation) — run *before* the slice's `/review` so findings flow into the per-slice review. Also at the final integration review for any combination-of-slices security posture. | Pure UI slices, dependency upgrades with no surface change, Terraform-only PRs (handled by CI scanners). | 5–15 min per applicable slice |
| **`simplify`** | After per-slice review feedback is addressed if the slice still feels bloated, OR after final review if the integrated diff has bloat that no individual slice carried. | Tight slices. | 10 min |

### Explain phase

The existing workflow already covers `summary.md` + `code-review-walkthrough.md`. No additional skill required.

### Bug / QA workflow (out-of-cycle)

| Skill | When to use |
|---|---|
| **`triage-issue`** | A bug surfaces (yours or a user's). The skill explores the code, identifies root cause, and creates a GitHub issue with a TDD-based fix plan. Use this *before* fixing anything reactive — keeps fixes from missing the root cause. |
| **`qa`** | Sustained QA session (e.g. pre-launch, end of an epic). Conversationally report bugs; the skill files structured GitHub issues. Useful for a launch hardening pass. |
| **`github-triage`** | Periodic issue-tracker hygiene — labelling, prioritisation, prep for AFK agent runs. Run weekly during heads-down integration work. |

### Wiki maintenance

| Skill | When to use |
|---|---|
| **`/lint-wiki`** | Quarterly health check on `karpathy-knowledge-base-example/docs/`. Eight deterministic passes (frontmatter completeness, staleness >90d, orphan pages, broken intra-doc links, supersession integrity, ADR sequence, log.md format, iteration-folder naming) plus an LLM-judgement pass for contradictions and "concept-without-a-page" candidates. Don't run after every iteration — Phase 4 of the dev workflow already enforces per-story hygiene; this is the periodic safety net. Skip if the previous pass was less than 30 days ago. |

---

## Domain-driven design — lazy build, not big bang

Cold-starting `CONTEXT.md` for the whole codebase is a 3–4 hour task. **Don't do it that way.** Instead:

1. Each medium+ story adds the domain terms it introduces. Story 1.1 adds `Bookmark`. Story 1.3 adds `Tag`. Story 2.1 adds `SearchQuery`, the `search_vector` column, and the ranking `weight` concept.
2. Each entry is short — name + one sentence + invariants. No prose.
3. After an epic finishes, `CONTEXT.md` is mostly written for free.

**Where it lives:** `CONTEXT.md` at the root of each bounded context (a single one for a monolith backend). Promote to `CONTEXT-MAP.md` only if the system splits.

**ADRs:** record load-bearing decisions and rejections in `karpathy-knowledge-base-example/docs/decisions/NNNN-<kebab-title>.md`. The full bar and format is in Phase 4 of `karpathy-knowledge-base-example/docs/development-workflow.md`. If you reject a deepening because "the seam doesn't earn its keep until two adapters exist," that's an ADR. Routine "not now" rejections don't need one.

---

## Worked example — Story 2.1 (full-text search)

Putting the full stack on a medium/critical-path story. This walks the actual Bookmarkr [`story-2.1-full-text-search/plan.md`](../iterations/story-2.1-full-text-search/plan.md) and [ADR-0001](../decisions/0001-postgres-fts-over-elasticsearch.md).

### Plan phase (~1.5h overhead)

1. **`CONTEXT.md` lazy-update** (~10 min) — add `SearchQuery` (a user's free-text query, matched against title + description + url + tags), the generated `search_vector` column, and the ranking `weight` concept. One sentence each. Note the invariant: search is always scoped to exactly one `user_id`.
2. **`grill-with-docs` on the search plan** (~45 min). Probe at minimum:
   - Storage engine: Postgres FTS or a dedicated search engine (Elasticsearch/OpenSearch)? At thousands of rows per user with no cross-user search, is a new service justified?
   - Ranking: single relevance score or weighted fields? Should a title match outrank a description-only match (AC2)?
   - Tenant isolation: how is "never see another user's bookmarks" (AC5) enforced — a `WHERE user_id` filter, and is it testable?
   - Typo tolerance: in scope, or accepted as a known limit?
   - Empty result: 200 with `[]` or 404 (AC4)?
   - Index usage: how do we guarantee the query actually uses the GIN index and doesn't silently regress?

   These decisions crystallised into **ADR-0001** (Postgres FTS over Elasticsearch) and the plan's risks section (no typo tolerance accepted; ranking weights are a tunable guess).
3. **`design-an-interface`** (~30 min). The search service seam (`app/services/search.py`) is the public boundary of the new module — the endpoint calls it, and Stories 2.2 (tag filter) and 2.3 (sort) will extend it. Sketch 2–3 shapes for "build tsquery → rank → tenant-scope" before committing, and justify the pick in the plan.
4. **Light `improve-codebase-architecture` pass** (~15 min). The plan already flags one: `app/api/bookmarks.py` has an inline pagination helper duplicated from the list endpoint. The search route needs the same — extract `paginate(query, limit, offset)`. Accepted at plan approval.
5. **Write the plan** per existing workflow (`docs/iterations/story-2.1-full-text-search/plan.md`).

### Code phase (~normal duration)

Two vertical slices (Slice 2 depends on the column from Slice 1).

1. **`tdd` — mandatory.** Write the failing integration test first, against real Postgres.
   - **Slice 1 anchor:** `test_inserted_bookmark_has_populated_search_vector` — insert a bookmark, assert `search_vector` is non-null and contains the title lexemes.
   - **Slice 2 anchor:** `test_search_returns_ranked_tenant_scoped_results` — one test seeding two users' data and exercising AC1–AC5.
2. Encode the acceptance cases as tests:
   - AC1: a word from a bookmark's title returns that bookmark.
   - AC2: a title match outranks a description-only match (relies on Slice 1's `setweight` A/B/C/D).
   - AC3: a tag match returns the bookmark.
   - AC4: no matches → empty list, `200` (not 404).
   - AC5: another user's matching bookmarks never appear (tenant isolation).
   - AC6 (integration): `EXPLAIN (FORMAT JSON)` asserts a `Bitmap Index Scan` on the GIN index — guards against a future change dropping the index.
3. Implement to green. Refactor inside the green window.
4. **`simplify`** before opening for review — this is where the accepted `paginate` extraction lands cleanly, and any duplicated tsquery-building logic gets folded.

### Review phase

1. **`/security-review`** — search is tenant-isolation-sensitive. This is exactly where a **missing `user_id` filter** would surface (the kind of bug the slice-2 review round 1 caught and round 2 fixed). Run it *before* the slice's `/review`.
2. **`/review`** against the plan's acceptance criteria (AC1–AC6). Verify AC5 has a test that actually seeds a second user, and AC6's `EXPLAIN` assertion exists.
3. Address findings, re-run. Final integration review: APPROVED.

### Explain phase

Standard `summary.md` + `code-review-walkthrough.md`. The summary should call out:
- The Postgres-FTS-vs-Elasticsearch decision (ADR-0001) and its revisit triggers — load-bearing for Epic 3 sharing, which could pull in cross-user search.
- The weighted-`tsvector` ranking choice (title > tags > description > url) — informs Story 2.3's sort work.
- The tenant-isolation pattern — the template every future per-user query follows.

### Estimated overhead vs. baseline

- Plan phase: +1.5h (vs ~30 min baseline) → +1h
- Code phase: +~20% from `tdd` discipline (often net-zero on rework-prone stories)
- Review phase: +15 min from `/security-review`

For a 2-SP story on the critical path, that's ~10% calendar overhead with strong protection against a tenant-isolation bug reaching production.

---

## One-time setup skills (run once, not per story)

Worth running once if not already done:

- **`setup-pre-commit`** — Husky + lint-staged + Prettier + type checks pre-commit. Saves CI roundtrips.
- **`git-guardrails-claude-code`** — blocks dangerous git commands (force push, reset --hard) before they execute. Cheap insurance.
- **`fewer-permission-prompts`** — scans transcripts and adds an allowlist for read-only Bash to `.claude/settings.json`. Reduces friction.
- **`update-config`** — for adjusting hooks, env vars, permissions in `settings.json`.

These are infrastructure, not workflow. Set up, then forget.

---

## Skills explicitly out of scope for now

Mentioning so they don't become a distraction:

- **`caveman`** — tonal, not a workflow tool.
- **`write-a-skill`** — meta; build new skills only when a real gap emerges.
- **`obsidian-vault`, `edit-article`, `scaffold-exercises`** — situational; invoke when the specific need arises, not as part of the standard cycle.
- **`loop`, `schedule`** — useful for background agent work post-launch (e.g. weekly issue triage). Don't introduce mid-integration.

---

## Anti-patterns to avoid

1. **Skill-stacking on trivial stories.** Running `grill-with-docs` + `design-an-interface` + `improve-codebase-architecture` on a 0.25 SP config tweak is pure ceremony.
2. **Letting `grill-with-docs` become a debate.** It's a tool to flush assumptions, not negotiate the spec. If the grilling exposes a real ambiguity, resolve it in 1–2 turns, not 10.
3. **Accepting every `improve-codebase-architecture` recommendation.** Apply the deletion test — most "deepening opportunities" are not yet load-bearing. One adapter is a hypothetical seam, not a real one.
4. **Writing CONTEXT.md as a documentation project.** Lazy-build only. Multi-hour writeup sessions are a sink.
5. **Running `tdd` on pure plumbing.** Terraform changes, dependency bumps, copy edits — TDD adds nothing.
6. **Treating `/review` as optional under deadline pressure.** It's the gate. Compressing the cycle for a hotfix is fine; skipping the review entirely is how a tenant-isolation bug ships to production.

---

## Quick-reference per-story checklist

For medium+ stories, paste into the iteration folder's `plan.md`:

```
## Skills applied this story

- [ ] CONTEXT.md updated with new domain terms (if any)
- [ ] grill-with-docs session completed — assumptions flushed, framing stress-tested against `CONTEXT.md` + `karpathy-knowledge-base-example/docs/decisions/`
- [ ] design-an-interface considered (large stories only)
- [ ] improve-codebase-architecture light pass (touching gnarly code)
- [ ] tdd: failing integration test written before implementation
- [ ] simplify: pre-review cleanup pass
- [ ] /security-review (security-adjacent code only)
- [ ] /review against acceptance criteria
- [ ] summary.md + code-review-walkthrough.md after commit
```

---

## When to revisit this strategy

- After an epic ships — review what worked, what was ceremony.
- If a critical-path story needs significant rework — diagnose whether more or less skill application would have caught it.
- When the team changes shape — the calculus shifts when a second engineer joins or when timeline pressure relaxes.
