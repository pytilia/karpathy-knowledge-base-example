---
name: dispatch-review-subagent
description: Launch a fresh review sub-agent for a Phase-2 slice review (code-review-slice-<N>-<rev>.md) or a Phase-3 final integration review (code-review-final-<N>.md). Emits the canonical review brief with the verbatim standing block. Use when the orchestrator needs to dispatch a reviewer and you want the brief templated, not retyped.
---

# Dispatch review sub-agent

The orchestrator's Phase-2 step 2 and Phase-3 jobs both dispatch a fresh review sub-agent. This skill emits the canonical brief for either case — the scope differs (slice diff vs integrated diff), the standing instructions are identical.

**Why this skill exists.** The 2026-06-16 transcript-mining retro found that review-agent verdicts came back APPROVED while MUST violations remained (L.2 #1 offender), and that review reports skipped sections or used aesthetic judgement instead of file:line evidence. Templating the brief — including the verbatim "anti-patterns the reviewer must reject" block — makes the rigour reproducible.

## When to use

- **Slice review (Phase 2 step 2):** after a coding sub-agent returns from a slice and `dispatch-coding-subagent` has integrated its output. Call this skill to produce a slice review.
- **Final integration review (Phase 3):** after every slice has been committed via the per-slice loop. Call this skill to produce the final review.
- **Re-review (slice rev > 1 or final N > 1):** after a coder addresses CHANGES REQUESTED findings. The skill threads the prior review reports into the brief.

## Process

### 1. Pin the review scope

Two cases:

**Slice review:**
- `slice_number` — from the plan.
- `revision_number` — starts at 1; increments per agent-review iteration on the same slice.
- `diff_command` — `git diff <last-committed-tip>..HEAD` where `<last-committed-tip>` is the commit at the end of the previous slice (or `main` for slice 1). The diff scope is THIS slice only, not the cumulative branch.
- `prior_review_reports` — `karpathy-knowledge-base-example/docs/iterations/<story>/code-review-slice-<N>-<rev-1>.md` and all earlier revs of the same slice (empty for rev 1).
- `output_path` — `karpathy-knowledge-base-example/docs/iterations/<story>/code-review-slice-<N>-<revision_number>.md`.

**Final review:**
- `iteration_number` — starts at 1; increments per final-review iteration.
- `diff_command` — `git diff main..HEAD` (the integrated whole).
- `prior_review_reports` — every `code-review-slice-*.md` (so the reviewer knows what was already verified at slice level), plus every prior `code-review-final-<N-1>.md` if `N > 1`.
- `output_path` — `karpathy-knowledge-base-example/docs/iterations/<story>/code-review-final-<iteration_number>.md`.

### 2. Pin the spec inputs

For either case, pin:

- `plan_path` — `karpathy-knowledge-base-example/docs/iterations/<story>/plan.md`.
- `standards_path` — `karpathy-knowledge-base-example/docs/review-coding-standards.md`.
- `acceptance_criteria` — the slice-tagged ACs (slice review) or all ACs including `integration`-tagged ones (final review).

### 3. Assemble the brief

Concatenate the scope fields (above) with the **STANDING INSTRUCTIONS block** below verbatim.

```
You are a fresh review sub-agent for <slice review of slice <N>, rev <rev> |
final integration review #<N>> of <story>. You do NOT inherit any
conversation history from the main agent or from the coding sub-agent whose
work you are reviewing. Your impartiality is structural; do not violate it
by asking the orchestrator for context that isn't in this brief.

## Scope

**Diff to review:**
```
<diff_command>
```

**Plan:** <plan_path>
**Standards:** <standards_path> (apply rigorously and exhaustively)
**Acceptance criteria for this scope:**
<acceptance_criteria as a bulleted list>

**Prior review reports to read:**
<prior_review_reports as a bulleted list — empty for rev 1 slice reviews and
N=1 final reviews>

**Output path:** <output_path>

## What to do

1. Read the plan and the standards doc. Read every file listed under "Prior
   review reports".
2. For re-reviews: list every prior MUST-rule finding under the "Resolution
   of prior review findings" section of your report. Verify each one as
   RESOLVED / NOT RESOLVED / PARTIAL with file:line evidence. If ANY prior
   MUST is NOT RESOLVED or PARTIAL, the verdict is CHANGES REQUESTED — do
   not aggregate or excuse.
3. Walk the plan's acceptance criteria one by one. Each AC gets PASS / FAIL /
   PARTIAL with file:line evidence. Do not aggregate. Do not say "PASS
   because the implementation looks reasonable."
4. Walk the **triggered** sections of the standards doc per its Trigger map.
   For each triggered section, walk its rules. For each rule, record PASS /
   FAIL / NOT APPLICABLE with file:line evidence on every failure and on
   notable passes. For non-triggered sections, write a single
   `NOT TRIGGERED — <reason>` line and move on.
5. Apply the "How to verify" step from each rule. Actually grep the actual
   files. Do not infer from the plan or summary. Do not infer from prior
   slice reviews. The standards doc is mechanical; treat it mechanically.
6. Write the report to <output_path> in the format defined in
   development-workflow.md Phase 3 §Review report format. Use the EXACT
   headings — Acceptance Criteria, Resolution of prior review findings (if
   any), Coding Standards Compliance (with per-section walk), Code Quality,
   Security, Performance, Test Coverage, Behaviour changes, Verdict.
7. Verdict is mechanical: ANY MUST-rule violation OR ANY failing AC →
   CHANGES REQUESTED. Otherwise APPROVED.

## Anti-patterns you MUST reject in yourself

If your draft report exhibits any of these, rewrite it before returning:

- **"All standards appear to be followed"** without per-section evidence. The
  standards doc requires walking the whole diff. Pass-by-default is not a
  review.
- **"I spot-checked a few files."** Walk the whole diff for triggered rules.
- **"AC X is PASS because it looks reasonable."** Every AC needs file:line
  evidence. Aesthetic judgement is not a verdict.
- **Missing rule references on findings.** Every Code Quality issue cites the
  rule it violates (e.g. "violates F.5 — `__dict__` spread at admin.py:142").
  Without the citation, you cannot self-check your own application of the
  standards.
- **Aggregated AC outcomes** ("ACs all look good"). Each AC is judged
  individually. No exceptions.
- **Skipping a section without writing `NOT TRIGGERED — <reason>`.** Silence
  is not a verdict. Either the section's trigger fires (walk it) or it does
  not (write the one-liner).

## Standing rule-application priorities

These are the recurring offenders the standards doc names but reviewers keep
soft-passing. Be extra strict on:

1. **L.1 — AI attribution in commits.** Grep `git log <base>..HEAD` for
   `claude` (case-insensitive) and the 🤖 emoji. Any hit → MUST violation.
2. **L.2 — Story / slice / AC / Q references in code.** Grep the diff for
   `\bStory [0-9]+\.[0-9]+`, `\bSlice [0-9]+ of`, `\bAC-[0-9]+\.[0-9]+`,
   `\bAnchor Test [0-9]+`, `\bgrilling Q[0-9]+`. Any hit in a non-markdown
   file → MUST violation. The pre-commit hook should have caught these, but
   docstrings inside multi-line strings sometimes slip past.
3. **L.3 — Commit subjects ≤72 chars.** Walk each commit. Any over-length
   subject → MUST violation.
4. **F.9 — No legacy typing imports.** Grep for `from typing import.*\b
   (Optional|List|Dict|Tuple|Set|Union|Type|Sequence)\b`. Any hit in added
   code → MUST violation.

5. **F.2 / F.3 / F.5 — Pydantic over dict for structured data.** This is the
   single most-corrected pattern in the codebase across recent stories.
   Grep the diff for:
   - `-> dict` / `-> Dict` / `-> Any` / `params: dict` / `data: dict` in
     `backend/services/` or `backend/api/v1/` signatures → MUST violation
     (F.2). Inputs and outputs that cross function boundaries take typed
     models, not bare dicts.
   - `response.json()` followed by `["..."]` / `.get("...")` access without
     an intervening `Schema.model_validate(...)` → MUST violation (F.3).
     Every external-API response (Stripe, Cognito, NextPax, Google Places,
     S3, Lambda SQS) is parsed via a Pydantic model.
   - Route handlers returning bare dict literals (`return {"id": x, ...}`)
     without `response_model=Schema` on the decorator → MUST violation
     (F.4). The standards' F.4 verification step is mechanical here.
   - `**obj.__dict__` spreads → MUST violation (F.5). Use
     `Schema.model_validate(orm)`.
   When you find one of these, also check whether the SAME pattern appears
   in MODIFIED files' pre-existing signatures (F.2's "modified files migrate"
   clause). A slice that touches `def get_quote(data: dict) -> dict:` to
   change behaviour but leaves the dict signatures behind is incomplete.
6. **F.7 — Imports at the top of the file, including tests.** Function-local
   imports → MUST violation.
7. **F.8 — Full descriptive variable names.** Any one- or two-letter name
   outside loop counters (`i`, `j`, `k`) or short list-comprehension aliases
   → MUST violation. F.8 was promoted SHOULD → MUST on 2026-06-16.
8. **J.6 — Test labels.** Every test added must carry ANCHOR / REGRESSION /
   NEGATIVE in its docstring's first line. Missing labels → MUST violation.
9. **M.1 — Diff matches plan scope.** Every modified file is in the plan's
   "Files to create or modify" section. Out-of-scope changes → MUST violation
   unless a documented deviation note exists in summary.md / the slice
   summary.
10. **N.1 — Behaviour change visibility.** Any observable behaviour change
    must appear in summary.md's "Behaviour changes" section AND in a test
    assertion message. Missing entry → MUST violation.

## What to return

Return one structured payload:

- The verdict (APPROVED or CHANGES REQUESTED).
- The count of MUST violations.
- The count of SHOULD violations.
- The count of AC PASS / FAIL / PARTIAL.
- The path of the report you wrote.
- A one-paragraph rationale (the same paragraph you wrote into the Verdict
  section of the report).

Do NOT return the whole report — the orchestrator reads the file directly.
The structured payload is for routing.
```

### 4. Launch the sub-agent

Call `Agent()` with `subagent_type: "general-purpose"` and the assembled brief. **Do not** pass the coding sub-agent's transcript or any prior conversation context — impartiality is structural.

### 5. Append to the verdicts log

After the sub-agent returns, append one line to `karpathy-knowledge-base-example/docs/review-verdicts.log` (create the file if it does not exist):

```
<ISO-8601 timestamp>  <story>  slice-<N>-<rev>|final-<N>  <APPROVED|CHANGES_REQUESTED>  MUST=<n>  SHOULD=<n>
```

This is the grep-able audit trail. The monthly retrospective uses it to detect "verdict APPROVED while violations remained" patterns and to count progress on specific rules over time.

### 6. Route the verdict

- **APPROVED on a slice review:** surface the verdict to the human and stop the turn. Gate #4 of the workflow doctrine (Phase 2 step 4 human gate) fires next; that is not your job to advance past.
- **APPROVED on a final review:** the integrated whole is clean. Surface the verdict, then move to Phase 4 (Explainability).
- **CHANGES REQUESTED on either:** read the report. List the MUST findings to the orchestrator's working context. The next step is to re-invoke `dispatch-coding-subagent` for the affected slice with the findings included in the brief.

## Anti-patterns this skill prevents

- The orchestrator types a free-form review brief that omits the "walk EVERY triggered section" instruction; the reviewer skips Section H because "no model changes look interesting" without grepping; an actual H violation lands in main.
- The orchestrator doesn't pass the prior review reports; the reviewer doesn't verify resolution of prior findings; rev-2 marks an old MUST as gone because it didn't see the prior verdict.
- The reviewer self-aggregates ACs ("all functional") to save tokens; a missed AC ships to main.
- The review verdict goes uncaptured; nobody can later answer "how often does L.2 actually get caught at review?".
