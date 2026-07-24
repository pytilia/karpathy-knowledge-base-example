---
name: docs index
description: Catalog of every document in this wiki, organised by topic, with one-line summaries. Read this first to find anything.
status: active
topic: process
last_reviewed: 2026-07-01
---

# Wiki Index

Topic-organised catalog. Append-only chronological events live in [`log.md`](log.md).
Architecture decision records live in [`decisions/`](decisions/), catalogued under
[Decisions (ADRs)](#decisions-adrs) below.

> **For agents:** start here when looking for a concept, decision, or domain term. If a doc
> is missing here, it is not in scope; check the iteration folders or ask.
>
> **For adopters:** this index catalogs the *example* content shipped with the template
> (the fictional "Bookmarkr" project). As you add your own docs, add a one-line row here in
> Phase 4 — that discipline is what keeps the wiki navigable.

---

## Process & standards (canonical — read first)

| Doc | Status | Summary |
|---|---|---|
| [development-workflow.md](development-workflow.md) | active | Plan → Code → Review → Explain four-phase cycle. Phase 2 mandates TDD + `tdd-trace.md` per slice. Phase 3 binds the review agent to the standards doc. Phase 4 updates `log.md` + this index. |
| [research-workflow.md](research-workflow.md) | active | Plan → Research → Review fan-out/fan-in cycle for non-code questions. Opt-in: runs only when the user invokes it. Output lands in `research/<topic>/`. |
| [review-coding-standards.md](review-coding-standards.md) | active | Enforceable checklist, sections A–Q. Any MUST violation → CHANGES REQUESTED. Sections G/H/I/K are stack-specific placeholders — fill in for your stack. |
| [references/02-claude-code-skills-strategy.md](references/02-claude-code-skills-strategy.md) | active | When to apply each Claude Code skill (`grill-with-docs`, `tdd`, `design-an-interface`, `simplify`). Targets ~5–10% calendar overhead. |
| [retrospectives/README.md](retrospectives/README.md) | active | Monthly friction-mining retro cadence + escalation ladder (memory → hook). |
| [log.md](log.md) | active | Append-only chronological log of decisions, iterations, meetings, incidents. |

---

## Programme

| Doc | Status | Summary |
|---|---|---|
| [references/01-jira-board-structure.md](references/01-jira-board-structure.md) | active | Example epics/stories/sub-tasks with acceptance criteria and story points (Bookmarkr). Source of truth for planned vs deferred. |

---

## Iterations

Per-story artifacts live in [`iterations/<story>/`](iterations/). Each carries (per the workflow):
`grilling.md`, `plan.md`, `tdd-trace.md`, `code-review-*.md`, `summary.md`, `code-review-walkthrough.md`.

| Iteration | Status | Summary |
|---|---|---|
| [story-2.1-full-text-search](iterations/story-2.1-full-text-search/plan.md) | shipped | **The worked example.** Postgres full-text search over bookmarks — ranked, tenant-scoped. Two slices; review caught a missing tenant filter. |

---

## Decisions (ADRs)

Load-bearing choices live in [`decisions/`](decisions/). Format: Context → Decision → Alternatives → Consequences → Revisit trigger.

| ADR | Status | Summary |
|---|---|---|
| [0001 — Postgres FTS over Elasticsearch](decisions/0001-postgres-fts-over-elasticsearch.md) | accepted | Use Postgres full-text search for bookmark search; don't add a search engine at this scale. |

---

## Integrations

| Doc | Status | Summary |
|---|---|---|
| [integrations/README.md](integrations/README.md) | active | How provider knowledge is captured — one distilled `gotchas.md` per provider. |
| [integrations/example-provider/gotchas.md](integrations/example-provider/gotchas.md) | reference | Template for a provider gotchas file. |

---

## Meetings

| Doc | Status | Summary |
|---|---|---|
| [minutes/2026-06-27-story-2.1-kickoff.md](minutes/2026-06-27-story-2.1-kickoff.md) | reference | Search scope + the FTS-vs-Elasticsearch decision. |

---

## Research

Research output lands in `research/<topic>/` (one folder per question, each with a `README.md`).
None yet — see [research-workflow.md](research-workflow.md) for how to run one.
