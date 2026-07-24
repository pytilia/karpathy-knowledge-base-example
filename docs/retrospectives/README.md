---
name: Friction-mining retrospectives
description: Monthly cadence for mining transcripts and code reviews for recurring friction, comparing against prior months, and feeding the workflow/standards docs.
status: active
topic: process
last_reviewed: 2026-06-16
---

# Retrospectives

A monthly retrospective runs a friction-mining pass over the **last 30 days** of Claude Code
transcripts and any new `code-review-*.md` files, looking for recurring pain points. Each retro
lands as `karpathy-knowledge-base-example/docs/retrospectives/<YYYY-MM>.md` plus an entry in `karpathy-knowledge-base-example/docs/log.md`.

The retros are the **feedback loop** for everything in `development-workflow.md`,
`review-coding-standards.md`, and the dispatch skills. Without them, process interventions
(a new pre-commit hook, a gate, a standards rule) decay into "rules that were written and
forgotten." With them, each month either confirms the intervention worked (the theme drops
off) or escalates it (the theme is still bleeding; the next intervention is sharper
enforcement).

## How to run

```
Workflow({scriptPath: "karpathy-knowledge-base-example/docs/retrospectives/scripts/run-friction-retro.js", args: { period_label: "2026-07" }})
```

> Requires the multi-agent Workflow harness. If you don't use it, run the same passes by hand:
> skim the period's transcripts and code reviews, cluster the friction, compare to last month.

Pass `period_label` as the YYYY-MM the retro covers (the month just ended). The workflow:

1. Lists transcripts in your Claude Code projects directory (`~/.claude/projects/<your-project-slug>/`) modified in the last 30 days.
2. Fans out one mining agent per transcript (parallel), looking for friction patterns by category.
3. Fans out an evidence-mining agent over the iteration folders' `code-review-*.md` files for the period.
4. Reads the prior month's retro (if any) and the current memory index, standards doc, and workflow doc.
5. Synthesizes themes, comparing against prior — "still bleeding" vs "fixed by [intervention]" vs "new".
6. (Optional) counts "APPROVED with MUST violations > 0" patterns if you keep a review-verdicts log.
7. Writes the report to `karpathy-knowledge-base-example/docs/retrospectives/<period_label>.md`.
8. Appends a `process-change` entry to `karpathy-knowledge-base-example/docs/log.md` ONLY if new themes emerged or a still-bleeding theme warrants escalation.

## What to look at in each retro

When the retro lands, ask:

1. **Did the prior interventions work?** If last month you added a hook for a recurring standards violation, this month's retro should show that theme dropping out of the top. If it didn't, the hook is broken, being bypassed, or the patterns are escaping it.
2. **Is any theme bleeding for 2+ months?** That's the escalation signal. The next intervention is sharper enforcement (hook, skill update, doc move), not another memory.
3. **Is the memory index growing?** Memory is a holding pen for new friction. If it grows without entries graduating into docs, the memory-hygiene rule is failing.
4. **Are reviews catching MUSTs the hooks should have caught?** That's a hook gap; sharpen the regex.

## Escalation ladder

When a theme appears in 2+ consecutive retros, walk up this ladder one rung at a time:

| Rung | Intervention | Cost | When to use |
|---|---|---|---|
| 1 | Memory entry | minutes | New friction; need to characterise before systematising |
| 2 | Sub-agent skill standing-block bullet | 10 min | The friction has a clear rule and a sub-agent can be reminded |
| 3 | Workflow doc edit | 30 min | The friction is process-level (a gate, a brief field, a verification step) |
| 4 | Standards doc rule (SHOULD or MUST) | 30 min | The friction is a code-level rule with a clear verification step |
| 5 | Pre-commit hook | 1–2 hours | The rule is mechanical and the regex can be written without false positives |
| 6 | Local guard / lint plugin | half-day | The rule needs AST awareness, repo-wide context, or per-file scoping |

Don't skip rungs. Climbing too fast (going straight to a hook for a still-fuzzy pattern) produces false positives that erode trust in the entire gate.
