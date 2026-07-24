---
name: lint-wiki
description: Lint the Karpathy-style wiki at karpathy-knowledge-base-example/docs/ — flag stale docs, orphan pages, broken links, supersession-integrity issues, ADR-sequence gaps, log.md format drift, iteration-folder naming violations, and concept-without-a-page candidates. Use quarterly or after a large doc refactor. Invoke when user mentions "lint", "wiki health", "stale docs", "/lint-wiki", or wants to audit karpathy-knowledge-base-example/docs/.
---

# Lint Wiki

Audit `karpathy-knowledge-base-example/docs/` for the rot patterns that turn a maintained wiki into a graveyard. Run quarterly or after a large doc refactor — not after every iteration (that's what Phase 4 of the development workflow handles).

The agent runs deterministic checks via a bundled script first, then does a small LLM-judgement pass for things scripts can't see (contradictions, orphan concepts). Output is a structured report with file:line evidence and severity levels.

## Process

### 1. Run the deterministic check script

Run `~/.claude/skills/lint-wiki/lint.sh` from any working directory. The script is self-contained and operates on hardcoded paths in `karpathy-knowledge-base-example/docs/`. It performs eight passes:

1. **Frontmatter completeness** — every `.md` doc in `karpathy-knowledge-base-example/docs/` (top-level + `decisions/`) carries `name`, `description`, `status`, `topic`, `last_reviewed`. Missing fields are BLOCKERs.
2. **Staleness** — any doc with `last_reviewed > 90 days ago` is a WARNING. Doc list sorted oldest-first.
3. **Orphan pages** — any `.md` doc not referenced from `index.md` is a WARNING. `index.md`, `log.md`, the doc itself, and `decisions/*.md` (transitively listed via the ADR table) are exempt.
4. **Broken intra-doc links** — any `[text](path)` link to a relative path that doesn't resolve is a BLOCKER.
5. **Supersession integrity** — if doc A has `superseded_by: B`, then doc B must have `supersedes: A`. Symmetry violations are BLOCKERs.
6. **ADR sequence** — `decisions/` must contain `NNNN-*.md` files numbered 0001, 0002, … with no gaps. A gap (or a duplicate number) is a BLOCKER.
7. **`log.md` format** — every `## [...]` heading in `log.md` must match `## [YYYY-MM-DD] <type> | <title>` where `<type>` is one of the allowed values from `development-workflow.md` Phase 4. Format violations are WARNINGs.
8. **Iteration-folder naming** — every folder under `iterations/` matches one of: `story-<epic>.<story>(-<task>)?-<kebab-name>` or bare `<kebab-name>`. Numeric-prefix folders without `story-` (e.g. `3.3-...`) are BLOCKERs (the convention from Phase 1 of the workflow).

The script writes a machine-parseable report to stdout. Severity counts in the trailing summary line.

### 2. Read the script output and the wiki

After the script runs, read its output. If there are zero findings across all eight passes, write a short "wiki is clean" report and stop.

If there are findings, read the affected files yourself before reporting. The script identifies issues; you assess severity in context (e.g. a stale doc may be deliberately stable — like an immutable reference — and acceptable to leave).

### 3. LLM-judgement pass

The script can't see semantic problems. Walk the wiki and look for:

- **Contradictions between docs.** When two `active` docs describe the same concept in incompatible ways. Common pattern: an old planning doc still says "we'll do X" while a more recent iteration shipped "Y" instead. Use the index's topic groupings to scope the comparison — only compare docs in the same topic.
- **Concepts mentioned but lacking their own page.** Domain terms or architectural patterns that appear in 3+ docs without a dedicated page in `backend/CONTEXT.md` (for domain) or `decisions/` (for architectural choices). Candidates for promotion.
- **ADRs that should be marked `superseded`.** An ADR claiming a decision still active when a later ADR or iteration overrode it. Cross-reference the ADR's "Triggers for revisit" section against recent log entries.
- **Stale `index.md` summaries.** The one-line summary in `index.md` no longer matches the doc's current content. Spot-check a sample of 5 active docs.

These judgement calls are case-by-case. Don't pad the report with speculation; only flag if you can cite specific file:line evidence.

### 4. Write the report

Output as a structured markdown report in this format:

```markdown
# `/lint-wiki` report — <YYYY-MM-DD>

## Summary
- BLOCKER: N findings
- WARNING: N findings
- INFO: N findings
- Docs scanned: N (top-level) + N (ADRs) + N (iterations)

## Blockers (require action)
For each blocker:
- **<short description>** — rule reference (e.g. "Frontmatter completeness")
  - File: `<path>:<line>`
  - Detail: <one-paragraph explanation>
  - Suggested fix: <one-line>

## Warnings (consider action)
Same format. Sorted by severity heuristic (oldest stale first, oldest broken link last).

## Judgement findings
For each LLM-judgement finding:
- **<short description>**
  - Files: `<path>` and `<path>`
  - Evidence: <quote or paraphrase + line refs>
  - Recommendation: <one-line>

## What's clean
List passes that produced zero findings (e.g. "ADR sequence: 5 ADRs, no gaps").
```

### 5. Append to `log.md` (per Phase 4)

After writing the report, append one entry to `karpathy-knowledge-base-example/docs/log.md`:

```
## [YYYY-MM-DD] process-change | `/lint-wiki` run — <N blockers / N warnings>
- Report: <path or inline summary>
- One-line on what action was taken or what's outstanding.
```

This keeps a chronological record of wiki-health checks.

## Principles

- **Don't fix anything in this skill.** The job is to surface findings and recommend action. Edits happen in subsequent invocations or in the next iteration's Phase 4.
- **Cite file:line for every finding.** Vague claims rot the report; specific evidence makes it actionable.
- **Prefer fewer high-quality findings over a long list.** A 30-finding report nobody reads is worse than a 5-finding report acted on.
- **Don't flag what's intentional.** If a doc is explicitly called out as "kept for history; do not act on" (e.g. a superseded plan retained for the record), don't WARN that it's stale — that's the point.
- **Don't run during a normal iteration.** Phase 4 of `karpathy-knowledge-base-example/docs/development-workflow.md` already enforces per-iteration hygiene. This skill is the periodic safety net.

## When to skip this skill

- An iteration just shipped (Phase 4 already ran). Run no sooner than 30 days after the previous lint pass.
- The user is asking to *fix* a known issue in a single doc — use Edit directly.
- The user wants a code-level review — use `review-coding-standards` or `/review`, not this.
