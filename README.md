# Project Memory — a Karpathy-style knowledge base (starter template)

This repo is a **starter template** for a Karpathy-style project-memory wiki: a small,
cross-referenced set of docs that Claude Code agents (and humans) maintain alongside a
codebase. The *code* lives in a separate repo; this folder is the *thinking* — decisions,
plans, iteration histories, domain language, meeting records, and the standards that govern
day-to-day work.

The pattern is **"compile once, query forever":** instead of re-deriving context every
conversation, you maintain a handful of wiki pages that compound with each iteration. New
agents start here; future-you starts here; cross-worktree continuity flows through here.

> 📄 **Companion article:** [Building a Karpathy-style knowledge base for AI-assisted project management](https://pytilia.atlassian.net/wiki/x/AQDrbw) — the write-up this template accompanies.

Everything below the surface is a **worked example** built around a deliberately boring
fictional product, **"Bookmarkr"** (a link-saving app). The example exists so you can see the
shape of every artifact — a JIRA board, an ADR, a full iteration, a log, an index — before
you replace it with your own. Nothing here is tied to a real project.

---

## Structure

```
.
├── README.md                 ← this file
├── CLAUDE.md.root            ← example of the user-global ~/.claude/CLAUDE.md (persona, sub-agent patterns, tooling rules)
├── CLAUDE.md.project         ← example of a project-root CLAUDE.md (build commands, structure, integrations)
├── mkdocs.yml                ← serves docs/ as a browsable site (mkdocs-material)
├── restart-wiki.sh           ← starts/restarts `mkdocs serve` on 127.0.0.1:8765
├── skills/                   ← a curated set of Claude Code agent skills (see skills/README.md)
└── docs/                     ← the wiki itself
    ├── index.md              ← topic-organised catalog of every doc — READ THIS FIRST
    ├── log.md                ← append-only chronological log: decisions, iterations, meetings, incidents
    ├── development-workflow.md          ← the Plan → Code → Review → Explain cycle. Mandatory for non-trivial changes.
    ├── research-workflow.md             ← opt-in Plan → Research → Review fan-out cycle for non-code questions
    ├── review-coding-standards.md       ← enforceable rule set (sections A–Q). Any MUST violation → CHANGES REQUESTED.
    ├── references/           ← 01-jira-board-structure.md, 02-claude-code-skills-strategy.md
    ├── decisions/            ← ADRs — load-bearing architecture decisions
    ├── iterations/           ← per-story artifacts: grilling, plan, tdd-trace, code-review-*, summary, walkthrough
    ├── integrations/         ← one distilled gotchas.md per external provider
    ├── minutes/              ← meeting records
    └── retrospectives/       ← monthly friction-mining retro + escalation ladder
```

---

## How to use this wiki

**Looking for a concept, decision, or domain term?** Open [`docs/index.md`](docs/index.md)
first. It's a topic-organised catalog with status fields and one-line summaries.

**Asking "when did we decide X?" / "what shipped last month?"** Grep
[`docs/log.md`](docs/log.md). Newest entries at the bottom; format is
`## [YYYY-MM-DD] <type> | <title>`.

**Starting a new piece of work?** The cycle is in
[`docs/development-workflow.md`](docs/development-workflow.md): Plan → Code → Review → Explain.
Phase 4 (Explain) is what keeps the wiki alive — every iteration writes a `summary.md`,
appends to `log.md`, and updates `index.md` if a new doc was created. Skipping any of those
is a Phase 4 process failure. The structure compounds *only* if discipline holds.

**Want to see it end to end?** Read the worked example iteration
[`docs/iterations/story-2.1-full-text-search/`](docs/iterations/story-2.1-full-text-search/plan.md)
alongside [ADR-0001](docs/decisions/0001-postgres-fts-over-elasticsearch.md) and the
[JIRA board](docs/references/01-jira-board-structure.md). That trio shows how a story flows
from board → grilling → plan → TDD → review → summary, with the load-bearing decision pulled
out into an ADR.

---

## Serving the wiki locally

```bash
pip install mkdocs-material     # one-time
./restart-wiki.sh               # serves http://127.0.0.1:8765 (detached)
```

The site auto-discovers `docs/`; numbered prefixes sort correctly and `index.md` is the home page.

---

## Adopting this for your project

1. **Fork / copy** this repo to wherever you keep cross-project memory (conventionally
   outside any single worktree, e.g. `karpathy-knowledge-base-example/`, so it survives branch switches).
2. **Point your CLAUDE.md files at it.** Copy `CLAUDE.md.root` into your user-global
   `~/.claude/CLAUDE.md` and `CLAUDE.md.project` into your project repo's root, then edit
   both for your reality. They reference the shared docs by path.
3. **Replace the Bookmarkr example** with your own: rewrite the JIRA board, delete the
   example ADR/iteration/log entries, and fill in the stack-specific standards sections
   (G/H/I/K).
4. **Keep the process docs.** `development-workflow.md`, `research-workflow.md`, the
   generic sections of `review-coding-standards.md`, and the retrospective cadence are the
   reusable core — that's the actual product here.
5. **Run Phase 4 every iteration.** The wiki is worthless if it isn't maintained; it
   compounds if it is.

---

## Conventions

**Iteration folder names:**

- Story-tracked work: `story-<epic>.<story>-<kebab-name>` (e.g. `story-2.1-full-text-search`).
- Multi-story residuals: `story-<epic>.<from>-<to>-<kebab>`.
- Non-story iterations (spikes, proposals, declined work, epic plans, hotfixes): bare
  kebab-case, no `story-` prefix.

The folder name is set **once** at the start of Phase 1 and never renamed (renames break ADR
cross-references, log links, and PR descriptions). Full rules in Phase 1 of the workflow doc.

**Frontmatter** on every `docs/` page carries `name`, `description`, `status`, `topic`,
`last_reviewed` (ADRs use `adr`, `status`, `date`). `last_reviewed` reflects the content's
actual age so the lint pass can flag genuine staleness.

**Cross-repo paths:** never hard-code a specific worktree directory name — use repo-relative
paths (`backend/CONTEXT.md`) or the placeholder `<project-root>/...`.

---

## Lint

The `lint-wiki` skill (in `skills/lint-wiki/`) runs deterministic passes over `docs/` —
frontmatter completeness, staleness (>90 days), orphan pages, broken links, supersession
integrity, ADR-sequence gaps, `log.md` format, and iteration-folder naming — plus an
LLM-judgement pass. Recommended cadence: quarterly, or after a large doc refactor. Phase 4
already enforces per-story hygiene, so this is the periodic safety net.

---

## Skills

`skills/` is a curated set of Claude Code agent skills (MIT-licensed, see `skills/LICENSE`)
that pair with this workflow — `tdd`, `grill-me`, `lint-wiki`, `write-a-skill`,
`setup-pre-commit`, and more. See `skills/README.md`. Prune the ones you don't want; add your
own with the `write-a-skill` skill.
