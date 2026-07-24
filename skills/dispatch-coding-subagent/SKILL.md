---
name: dispatch-coding-subagent
description: Launch a fresh coding sub-agent for a Phase-2 slice with the canonical brief — slice-specific fields plus the verbatim STANDING INSTRUCTIONS block. Use when the orchestrator needs to dispatch a coder for a slice and you want the standing block templated (not retyped from memory). Required when the workflow's development-workflow.md Phase 2 step 1 fires at medium/large tier.
---

# Dispatch coding sub-agent

The orchestrator's Phase-2 job is to brief a fresh coding sub-agent per slice and integrate its output. This skill emits the canonical brief: slice-specific fields plus the verbatim STANDING INSTRUCTIONS block that survived every prior retrospective.

**Why this skill exists.** The 2026-06-16 transcript-mining retro found that free-form briefs drop the standing block under context pressure — sub-agents committed despite "do not commit" instructions; sub-agents reintroduced L.2 violations the orchestrator had just fixed; sub-agents skipped the lint pass before declaring done. Templating the standing block makes it immune to context drift.

## When to use

- Phase 2 step 1 of `karpathy-knowledge-base-example/docs/development-workflow.md` at the **medium** or **large/critical-path** tier, every slice.
- Any time the orchestrator launches a coder via `Agent()` for a story-tracked iteration.
- **Skip** at the small tier when the carve-out applies (main agent codes the slice directly).
- **Skip** for trivial changes (typo, config value, copy edit).

## Process

### 1. Collect slice-specific fields from the plan

Read `karpathy-knowledge-base-example/docs/iterations/<story>/plan.md` and pull:

- `slice_number` — the slice's number from the plan's "Vertical slices" section.
- `slice_boundary` — what the slice does, and explicitly what it does NOT do (one sentence each).
- `anchor_test` — the failing integration test that anchors the slice (full test ID, e.g. `backend/tests/integration/test_x.py::TestClass::test_method`).
- `files_in_scope` — every file the plan tags with this slice number under "Files to create or modify".
- `slice_acceptance_criteria` — the ACs the plan tags with this slice (slice-scoped subset of the plan's ACs).
- `accepted_refactor` — if the plan's "Refactor opportunities" section assigns an accepted refactor to this slice, name it; otherwise `none`.
- `prior_slice_context` — what prior slices committed that this slice relies on (one or two sentences max, e.g. "Slice 1 added the `Quote` schema at backend/schemas/quote.py; this slice uses it but does not modify it").

If any field is missing from the plan, **stop and surface to the human** — the plan is incomplete. Do not improvise.

### 2. Assemble the brief

Concatenate the slice fields (above) with the **STANDING INSTRUCTIONS block** below verbatim. The standing block is non-negotiable — every coder gets it, every time. Do not paraphrase, condense, or omit.

```
You are a fresh coding sub-agent for slice <slice_number> of <story>. You do
NOT inherit any conversation history from the main agent, prior slices, or
prior reviews. Your context is exactly this brief.

## Slice <slice_number>: <slice_boundary>

**What this slice does:** <slice_boundary — what it does>
**What this slice does NOT do:** <slice_boundary — what it does not do>

**Anchor test:** <anchor_test>

**Files in scope (from plan.md):**
<files_in_scope as a bulleted list — every file is tagged to this slice; do not touch any file outside this list>

**Acceptance criteria for this slice (in isolation):**
<slice_acceptance_criteria as a bulleted list>

**Accepted refactor (if any):** <accepted_refactor>

**Prior-slice context you need:** <prior_slice_context>

## TDD red-green-refactor — non-negotiable

You MUST follow the tdd skill's red-green-refactor loop exactly. Invoke
Skill('tdd') at the start. The five steps:

1. Write the failing integration test first (the anchor test above, plus any
   NEGATIVE / REGRESSION anchors per J.6/J.8).
2. Run the test. Confirm it fails for the EXPECTED REASON (assertion failure
   or NotImplementedError — not import error, not syntax error, not fixture
   failure).
3. Implement the MINIMUM code to make the test pass. Do not add features,
   speculative seams, or "while I'm here" cleanup beyond the accepted-refactor
   line above.
4. Run the test again. Confirm it passes.
5. Refactor only inside the green window. Re-run the test after each step.

Write each anchor test's red/green/refactor entry into
`karpathy-knowledge-base-example/docs/iterations/<story>/tdd-trace.md` AS THE SLICE PROGRESSES — not
retrospectively. The trace format is in development-workflow.md Phase 2 §TDD
trace artifact. A trace written after the fact is fabricated evidence.

## STANDING INSTRUCTIONS — read every line, follow every line

These rules apply at every slice, every story, every sub-agent. They are the
recurring violations the review agent keeps catching. Move them to commit-time
by following them now.

1. **Do not commit or stage anything.** The slice ends when your green window
   closes. The agent slice review and the human gate run after you return.
   Commits are the orchestrator's job after both gates pass. If you find
   yourself reaching for `git commit` or `git add`, stop.

2. **No L.2 references in code.** Never write a story number, slice number,
   AC number, decision number, grilling question number, or "Anchor Test N"
   label inside any code, comment, docstring, test name, error message, or
   variable name. The traceability lives in the branch name and PR. Translate:
   - "Story 4.1.7 substrate" → "optional-fee opt-in substrate"
   - "AC-2.1 anchor" → "pets-fee folding anchor"
   - "Anchor Test 3" → "rate-plan-mismatch anchor"
   The pre-commit hook at scripts/check-staged-violations.sh will block the
   commit if you slip — and the orchestrator will not unblock it for you.

3. **No legacy `typing` imports (F.9).** Use built-in generics and PEP 604
   unions only: `list[X]`, `dict[K, V]`, `tuple[X, ...]`, `X | None`, `X | Y`.
   Never import `Optional`, `List`, `Dict`, `Tuple`, `Set`, `Union`, `Type`,
   or `Sequence` from `typing` in new code. The project runs Python 3.14.

4. **Pydantic over dict for structured data (F.2 / F.3).** Structured data
   that crosses a function boundary — service-layer arguments, service-layer
   return values, external-API responses, route handler returns — uses
   Pydantic `BaseModel` (or `dataclass` / `TypedDict` for narrow cases),
   NEVER raw `dict[str, Any]` and NEVER `dict` without a value-type
   parameter. The defaults Claude reaches for are wrong here; this is the
   single most-corrected pattern in this codebase across recent stories.

   The specific anti-patterns to refuse:
   - `def some_service(data: dict) -> dict:` — both the input and output
     need a Pydantic model. Inputs are validated at the boundary; outputs
     are constructed as `Schema(...)`, not as `{"key": value}` dicts.
   - `response.json()` followed by `response_data["field"]` or
     `response_data.get("field")` — every external-API response (Stripe,
     Cognito, NextPax, Google Places, S3, Lambda SQS) is parsed via
     `Schema.model_validate(response.json())` before any field access.
   - FastAPI routes returning `{"id": x, "name": y, ...}` literals — every
     route declares `response_model=Schema` and returns a `Schema(...)`
     instance, never a bare dict.
   - `**obj.__dict__` spreads (F.5) — never. Use `Schema.model_validate(orm)`.

   `TypedDict` is acceptable ONLY for lightweight wire-format dicts where
   Pydantic validation isn't needed (e.g. outbound HTTP query params). Even
   then, prefer Pydantic when the dict is constructed by your code and
   passed to another seam of your code.

   If a function you are TOUCHING (not just calling) already has an untyped
   `dict` signature, migrate it to a typed model as part of the slice. This
   is the "modified files migrate" half of F.2; don't leave the untyped
   signature behind because "the slice doesn't strictly need it."

5. **Label every test by purpose (J.6/J.8).** Every test you add is one of:
   - **ANCHOR** — would have failed pre-change, demonstrates the new behaviour.
   - **REGRESSION** — protects against a specific past defect.
   - **NEGATIVE** — confirms the system rejects bad inputs / disallowed states.
   The label goes in the test's docstring's first line (e.g.
   `"""ANCHOR: pets=1 folds the PCL fee into mandatory."""`). Tests that pass
   before AND after the change are regression coverage, not anchors — name
   them so.

6. **Run the linter / typechecker before declaring done.** Backend: `flake8`
   and `mypy` from `backend/` with the venv activated. Frontend: `npm run
   lint` and `npx tsc --noEmit` from `frontend/`. If either fails, fix and
   rerun. Do not return to the orchestrator while red.

7. **Full descriptive variable names (F.8 — MUST as of 2026-06-16).** No
   `bd`, `bt`, `pf`, `epd`, `vt`. Use `booking_total`, `platform_fee`,
   `extra_person_data`, `vendor_tax`. Short loop counters (`i`, `j`, `k`)
   and conventional list-comp aliases are the only exception. Code should
   be self-documenting.

8. **Sibling-grep when fixing a violation.** When you fix one site, run a
   repo-wide grep for the same pattern. Report all sites in your return
   message. Fix all of them or explicitly justify scoping to one. The
   "we caught one, three more remained" pattern is the single most common
   review-rejection mode in this codebase.

9. **Do not write documentation files unless the plan named them.** Do not
   create `summary.md`, `notes.md`, `README.md`, or any other markdown the
   plan did not assign to this slice. Summaries are Phase 4's job.

10. **Defensive code only at system boundaries.** Do not add try/except for
    impossible cases, do not add fallbacks for code paths that can't occur,
    do not validate inputs the framework already validated. Internal calls
    trust their callers. Validation belongs at the outer boundary (user
    input, external API).

11. **No backwards-compatibility shims for code you're changing.** If you
    are removing a function, remove its callers. Do not rename to `_old`
    and keep around. Do not add deprecation comments. The git history is
    the record.

## What to return

When the green window closes and all standing instructions are honoured,
return a structured summary:

- Files changed (the actual paths).
- The anchor test ID and final result.
- The tdd-trace.md entries you appended (slice header + each red/green/
  refactor block).
- Any plan deviations you had to make (list them — if there are zero, say
  "no plan deviations"; if there are any, the orchestrator surfaces them to
  the human before proceeding to step 2).
- The sibling-grep results for any standing-instruction fix you made.

Do NOT return prose narrative about your process — return the structured
fields. The orchestrator integrates your output and proceeds to the agent
slice review (a separate fresh sub-agent).
```

### 3. Launch the sub-agent

Call `Agent()` with `subagent_type: "general-purpose"` and the assembled brief as the prompt. Do not set `isolation: "worktree"` unless the slice is part of an opt-in parallel run (per Phase 2's "Parallel as opt-in exception" rules).

### 4. Integrate the return

When the sub-agent returns:

- Read its structured summary.
- Verify the staged-changes count against `git diff --name-only` and the files-in-scope list. Any file changed outside the in-scope list is a planning miss — surface to the human before proceeding.
- Verify the tdd-trace.md entries actually exist in the iteration folder.
- If the sub-agent flagged plan deviations, surface those to the human as plain text and **stop the turn** before launching the review sub-agent. Gate #4 of the workflow doctrine applies even mid-slice when the plan changed.
- If everything is clean, proceed to Phase 2 step 2 by invoking `dispatch-review-subagent` for `slice <N>` rev 1.

## Anti-patterns this skill prevents

- The orchestrator retypes the standing block from memory, drops one bullet under context pressure, and the sub-agent commits / introduces L.2 / skips the linter as a result.
- The orchestrator forgets to name the anchor test, and the sub-agent writes "implementation that satisfies the slice" tests after the fact.
- The orchestrator briefs the sub-agent with conversational context from prior slices, polluting the fresh-context premise.
- The orchestrator treats sibling-grep as optional; one fix lands, three siblings remain, review catches them, rev-2 fixes one more, rev-3 catches the next, and the slice spends three review cycles on a single rule.
