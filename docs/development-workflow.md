---
name: Development Workflow
description: Plan → Code (per-slice agent + human gate) → Final integration review → Explain. Mandatory for non-trivial changes.
status: active
topic: process
last_reviewed: 2026-06-16
---

# Development Workflow

Every major change follows a four-phase cycle: **Plan → Code → Review → Explain**. Inside Code, slices are implemented **one at a time**; each slice passes through two review gates — an agent slice review and a human-in-the-loop slice review — and is committed before the next slice begins. Phase 3 is the final integration review across all committed slices. No phase is skipped. Reviews loop back to code until the slice (or, at final review, the integrated whole) meets the quality bar defined in the plan.

**Why per-slice gates (added 2026-05-19).** Prior practice batched the whole change into a single end-of-cycle review. The failure mode in recent stories was vast rework surfaced at that final review, cascading across multiple already-coded slices. Reviewing each slice immediately after it is coded — and forcing a human gate before the next slice begins — surfaces issues where they were introduced; fixes stay local. This trades elapsed time for shorter rework cycles, by design.

**When the work is research, not code** — "what's the state of X", "compare A vs B", "would adopting Z work" — and the user explicitly invokes the research workflow, follow [`research-workflow.md`](research-workflow.md) instead. That cycle is Plan → Research → Review (fan-out/fan-in) and lands its output in `karpathy-knowledge-base-example/docs/research/<topic>/`, not in `iterations/`. Story plans cite the research folder as Phase 1 input.

**Skill selection within each phase** — when to apply `grill-with-docs`, `tdd`, `improve-codebase-architecture`, `design-an-interface`, etc. — is governed by `karpathy-knowledge-base-example/docs/references/02-claude-code-skills-strategy.md`. This document defines the workflow; the strategy document defines which skills slot in where.

---

## Gates that override auto-mode

Six points in this workflow are **human-only**. The agent does not advance past any of them without an explicit human reply, regardless of any auto-mode, dynamic-loop, or "work without stopping for clarifying questions" framing the harness may be running under.

1. **Grilling answers** (Phase 1 step 1) — every load-bearing grilling question is answered by the human, never auto-answered by the agent.
2. **Plan approval** (Phase 1 exit) — no code is written until the human approves the plan.
3. **Visual checkpoint** (Phase 2 step 4, UI slices only) — for slices whose user-facing outcome is visual (badges, chips, pills, layout reshuffles, colour swaps, card surfaces, hero strips), the human must view the change in a running browser before approving. Agent reviews can verify spec compliance and standards; they cannot judge whether something looks good.
4. **Per-slice commit** (Phase 2 step 5) — the slice is committed only after the human has signalled approval at step 4. An APPROVED agent verdict at step 2 does **not** authorise the commit on its own.
5. **PR creation** — opening a PR is human-triggered. The agent may prepare the title and body; the human runs `gh pr create`.
6. **Merge** — merging to main is human-only.

**The doctrine.** Auto-mode is about implementation steps where the agent's reasonable call is recoverable. These six points are not recoverable downstream without rework — a self-answered grilling question, a self-approved commit, a self-merged PR all masquerade as resolved decisions and cost more to unwind than to gate upfront. When you reach one of these points: surface the situation in plain text, then **stop the turn**. For the commit gate specifically, do not use `AskUserQuestion` — it implies a discrete choice when the answer is open-ended (changes the user may want to add, files they may want to inspect, etc.). State the situation and wait.

If the agent advances past any of these gates without an explicit human reply, treat it as a process incident — flag it in `summary.md` under "What's left" and surface it in the next session's first-message context so the failure mode is not silently absorbed.

---

## Story-size tiering — what artifacts are mandatory

Match the artifact set to story size. The skill stack is already tiered in [`references/02-claude-code-skills-strategy.md`](references/02-claude-code-skills-strategy.md); the artifact set tiers the same way. Above the tier ceiling, you are buying ceremony, not quality.

| Size | Examples | Mandatory artifacts | Skipped at this tier |
|---|---|---|---|
| **Trivial** (<0.25 SP) | typo, config value, copy change, single-line bug fix | none — no iteration folder | the entire workflow |
| **Small** (0.25–0.5 SP) | small task inside a story (e.g. 1.2.1, 2.1.1) | combined `iteration.md` (objective + 1-paragraph plan + AC + outcome) plus `code-review-slice-<n>-<rev>.md` per slice per agent-review iteration (usually one slice, one revision). Human gate per slice still applies. | separate `plan.md`, separate `grilling.md`, separate `code-review-final-*.md` (collapses into the single slice review for single-slice work), walkthrough, persistent TDD trace |
| **Medium** (0.5–2 SP) | most stories (e.g. 2.1 full-text search) | `plan.md` (with grilling decisions inline as `## Decisions from grilling`), `code-review-slice-<n>-<rev>.md` per slice per agent-review iteration, `code-review-final-<n>.md` per final-review iteration, `summary.md` | separate `grilling.md`, `code-review-walkthrough.md`, persistent `tdd-trace.md` |
| **Large / critical-path** (2+ SP, payment-touching, sync, auth) | a search/auth/payments core module | full set: `plan.md`, `tdd-trace.md`, `code-review-slice-<n>-<rev>.md` per slice per agent-review iteration, `code-review-final-<n>.md` per final-review iteration, `summary.md`, `code-review-walkthrough.md` | nothing — full set |

**Rules:**

- **Tier is set in `plan.md`** under a `## Tier` line so the review agent knows which artifact set to expect. Tier escalates if the work grows mid-flight; downgrade is rare and should be flagged to the user before the review runs.
- **Grilling output folds into `plan.md`** under `## Decisions from grilling` for medium and large stories. A separate `grilling.md` is produced only when the transcript itself contains material future readers will want — usually the resolved decisions are the durable signal, and saving the transcript burns tokens twice (once writing, once on every review load).
- **`tdd-trace.md` is ephemeral by default for medium stories.** It exists during the Code phase as enforcement evidence. At Phase 4, summarise it into one paragraph in `summary.md` (slices, anchor tests, any `[VIOLATION]` markers) and delete the file. Persist `tdd-trace.md` only at the large/critical-path tier where the audit trail is load-bearing (payment, sync, auth).
- **`code-review-walkthrough.md` is large-tier only.** For medium stories the diff plus `summary.md` covers it. Producing both for a 1 SP plumbing change duplicates content for no compounding gain.
- **Sequential per-slice execution is the default.** Each slice runs TDD → agent slice review → human-in-the-loop slice review → commit, in that order, before the next slice begins. Parallel sub-agents are an **opt-in exception** requiring explicit user direction, and are only valid for slices that are genuinely independent (no shared files, no shared mutable state, no logical ordering dependency from the plan). Even when parallel is opted in, each slice still passes through its own agent + human gate on completion before its commit lands — parallel only overlaps the implementation step, not the review gates or the commit ordering.
- **Fresh sub-agents are the default for both coding (medium+ tier) and reviewing (all tiers above trivial).** Each slice's implementation runs in a fresh coding sub-agent (medium and large tiers — small tier may use the main agent). Each slice's review and the final integration review run in fresh review sub-agents that did not see the coding sub-agent's conversation. Clean context per agent matters more than the small one-time priming cost — main-agent context pollution by slice 4 degrades code quality, and a reviewer that watched the slice being coded is not impartial. The main agent's Phase 2 job is orchestration, not implementation or review.

If the work doesn't fit any tier above, ask the user before improvising a new artifact set.

---

## Model selection — which model runs which phase

Sub-agents inherit the session model unless a model is passed explicitly. That default is almost always wrong for this workflow, so the model is chosen deliberately per phase. [`research-workflow.md`](research-workflow.md) carries the equivalent table for the research cycle.

| Phase | Default | Large / critical-path | Alias to pass |
|---|---|---|---|
| **Phase 1 — planning agent** | Latest Opus | **Latest Fable** | `"opus"` / `"fable"` |
| **Phase 2 — coding sub-agent (per slice)** | Latest Sonnet | Latest Sonnet | `"sonnet"` |
| **Phase 2 step 2 — slice review sub-agent** | Latest Opus | Latest Opus | `"opus"` |
| **Phase 3 — final integration review** | Latest Opus | **Latest Fable** | `"opus"` / `"fable"` |

The aliases resolve to the latest model in the family at invocation time — prefer the alias over a pinned model ID so a newer model is picked up automatically.

**"Large / critical-path" means the same thing it means in the tiering table above**, plus anything touching security, auth, or money. When in doubt, treat it as critical-path — the cost of the stronger model at the two ends of the loop is trivial next to the cost of a missed finding in a payment or auth path.

**Rationale.** Coding a well-specified slice is throughput work, which is Sonnet's strength — and the slice brief plus the standing block already constrain it tightly. Review is adversarial reasoning over a diff against a large rule set, which wants Opus. Planning and final integration review are where a miss is most expensive and least recoverable (a plan-pointer miss propagates into every slice; a final-review miss ships), so critical-path work buys the strongest model at exactly those two points.

**Ask the user at grilling.** Phase 1 step 1 confirms the model assignment for the story along with the other load-bearing decisions, and the answer is recorded in `plan.md` under `## Decisions from grilling`. The table above is the default when the user expresses no preference — not a substitute for asking.

---

## Phase 1: Plan

**Trigger:** User requests a feature, story, bug fix, or refactor.

### Iteration folder naming (mandatory)

Iteration folders live under `karpathy-knowledge-base-example/docs/iterations/`. The folder name is set **once** at the start of Phase 1 and **never** changed afterwards (renames break ADR cross-references, log links, and PR descriptions).

**Naming convention:**

- **Story-tracked work** (the request maps to a JIRA story in `karpathy-knowledge-base-example/docs/references/01-jira-board-structure.md`): `story-<epic>.<story>-<kebab-name>`. Examples: `story-2.1-full-text-search`, `story-1.3-tag-a-bookmark`, `story-2.1-2.3-residual` (multi-story residual).
- **Sub-task within a story**: `story-<epic>.<story>.<task>-<kebab-name>` if the sub-task is large enough to warrant its own folder (most sub-tasks share the parent's folder).
- **Non-story iterations** (spikes, proposals, hotfixes, epic-level plans, declined work): `<kebab-name>` with no `story-` prefix. Examples: `funnel-proposal-response`, `security-hardening-owasp-top-10`, `creative-redesign`, `dev-auth-bypass`.

**Rules:**

- The `story-` prefix is **only** used for JIRA-tracked stories. Don't prefix spikes, proposals, or epics with `story-` — that lies about the work's status in the board.
- The numeric portion uses **dots** (`3.3`), not dashes or underscores. Multi-story residual folders use a range with a dash (`1.5-1.9`).
- The descriptive tail is **kebab-case** (lowercase, words joined by single hyphens). No spaces, no underscores, no camel-case.
- A sub-agent or user message asking for "an iteration folder for story 2.1 full-text search" produces `story-2.1-full-text-search`, not `2.1-full-text-search` and not `full-text-search`.
- If the workflow accidentally creates a folder with the wrong name, **rename it before any cross-references land** (ADRs, log entries, PR descriptions). After cross-references exist, renames cost more than they save.

If the work doesn't fit any of the patterns above, ask the user before inventing a new folder name.

### Process

> Throughout the rest of this document, `<story>` is the placeholder for the iteration folder name set above — whether or not the work is technically a JIRA story.

1. **Grilling first — human-in-the-loop, always.** Before any plan is written, a `grill-with-docs` session is run against the request. The grilling agent interrogates assumptions, branches, ambiguities, edge cases, and unstated constraints, **and stress-tests them against the existing domain model in `backend/CONTEXT.md` and the decisions captured in `karpathy-knowledge-base-example/docs/decisions/`** — sharpening terminology and updating those documents inline as decisions crystallise. The grilling continues until every load-bearing question has been resolved. Output is captured in `karpathy-knowledge-base-example/docs/iterations/<story>/grilling.md` — the resolved questions, the decisions reached, and any explicit deferrals; doc updates land in `CONTEXT.md` / ADRs as the conversation progresses, not as a separate cleanup pass. **No plan is written until grilling has flushed every load-bearing assumption.** If the grilling exposes that the request itself is not yet well-formed, the loop returns to the user before the planning agent runs.

   **Grilling questions MUST be answered by the human.** This rule overrides any auto-mode, plan-mode, or "work without stopping for clarifying questions" framing the harness may be running under. The grilling agent must:
   - **Pause and surface each question to the human** before progressing — via `AskUserQuestion` for discrete choices, or by stopping its turn and waiting for the human's reply for open-ended questions. The agent must not generate the human's answer for them.
   - **Never self-answer "by making the reasonable call."** Grilling exists precisely because the agent's reasonable call has been wrong in ways that only the human can see — domain context, stakeholder priorities, prior conversations, unstated constraints. An auto-answered grilling defeats the entire purpose of the phase.
   - **Treat assumed answers as load-bearing risks.** If the human is unreachable for a specific question and the grilling cannot proceed without an answer, the agent stops the session, records the unanswered question in `grilling.md` as `[BLOCKED — awaiting human answer]`, and waits. It does not draft a plan around an assumed answer.
   - **Record provenance in `grilling.md`.** Every resolved question gets its source tagged: `(answered by human)` or `(deferred — see plan.md risks)`. A grilling.md with no `(answered by human)` tags is a process failure — flag it before progressing to step 2.

   This applies even when the harness is in auto mode, dynamic-loop mode, or has been told "work without stopping for clarifying questions." Those harness modes are about implementation steps where the reasonable call is recoverable; grilling answers are not recoverable downstream without rework, so the human gate is non-negotiable.
2. **Planning agent writes the spec.** Informed by the grilling output, the planning agent produces a full specification. Resolutions from grilling appear in the plan as decisions, not as open questions. If something is genuinely unresolved, it is listed as an explicit risk with the consequence of deciding wrong.
3. **Plan-pointer verification.** Before the plan is presented to the user, the planning agent walks every file path, function name, and architectural seam named in the spec and **grep-confirms** each one exists and behaves as the plan describes. For each pointer:
   - **File:** confirm the path exists (`ls` / `Read`). A plan that names a file Claude assumed into existence is the most expensive bug to find post-merge.
   - **Function or seam:** grep for the symbol and read enough surrounding code to confirm it actually does what the plan says it does. A plan saying "extend `drift.compare_engine_to_quote` to filter by `pricing_type`" is wrong if that function never queries rates — it receives an already-computed breakdown. That's a plan-pointer miss and the plan must be revised before approval, not corrected mid-implementation.
   - **Behaviour claim:** if the plan asserts "this endpoint returns X today" or "this validator rejects Y today" or "the backend filter applies universally", verify against the actual code, not against memory, inference, or what the docs say.
   - **External shape:** if the plan asserts "the payments sandbox returns N records" or "this auth attribute is required", verify against the integration's `gotchas.md` and (where cheap) against a live sandbox call.

   Plan-pointer misses are the single biggest source of merged regressions in this codebase — when the plan misreads what the code does, the coder builds against the wrong abstraction and review can't catch it because review compares code-to-plan, not plan-to-reality. Verification is cheap (5–10 min) compared to a post-merge regression (hours of forensic work plus a remediation iteration).
4. **The spec is saved as a plan file (`karpathy-knowledge-base-example/docs/iterations/<story>/plan.md`) and presented to the user for approval.**

**Spec contents:**
- **Objective** — What problem this solves, in one sentence. Take a note of the exact prompt the user has given along with the one sentence summary.
- **Scope** — What is in scope and what is explicitly out of scope.
- **Vertical slices** — Break the work into tracer-bullet slices, per the `tdd` skill. Each slice is end-to-end (failing test → minimum implementation → integration → green), independently committable, and small enough to be implemented in a single red-green-refactor loop. Slices are both the unit of work AND the unit of review — each slice is gated by an agent review and a human review before the next slice starts. List the slices in implementation order, with the failing test that anchors each one. Keep slices small enough that a per-slice review is genuinely scoped (rule of thumb: if the slice diff is more than ~600 lines or touches more than 10 files, split it).
- **Slice ordering and dependencies** — Slices execute **sequentially by default**. State each slice's dependencies explicitly (e.g. "Slice 3 depends on the schema added in Slice 1"). Separately, note any slices that are genuinely independent (no shared files, no shared mutable state, no logical ordering dependency) in case the user opts into parallel execution for that subset — but parallel is the exception, not the default, and the per-slice gate still applies per slice. The plan does not pre-assign sub-agents; that is a Code-phase concern.
- **Files to create or modify** — Every file that will be touched, with a summary of the change. Tag each file with the slice that touches it so per-slice review has a clear scope (and so parallel sub-agents, if the user opts in, do not collide).
- **Refactor opportunities (slices that touch existing code)** — For every slice that *modifies* existing code (not pure new-file work), the planning agent inspects what it touches and lists concrete opportunities to simplify or clean it up: dead code, duplicated logic, leaky abstractions, stale names, or a shape that would make the slice's own tests easier to write. Each opportunity is a **discrete, separately-acceptable suggestion** tagged with the slice it rides on, stating *what* to change, *why now* (proximity — we're already in this file), and the *risk* of doing it. These are **proposals, not commitments** — the **default is to not refactor** — and the human accepts or rejects each one at plan approval. A slice that only creates new files records `none (new code only)`. Source candidates with the `simplify` / `improve-codebase-architecture` skills per [`references/02-claude-code-skills-strategy.md`](references/02-claude-code-skills-strategy.md).
- **API changes** — New or modified endpoints, request/response schemas, status codes.
- **Database changes** — New migrations, schema changes, index additions.
- **Frontend changes** — New routes, components, state changes, UI behaviour.
- **Infrastructure changes** — Terraform resources, environment variables, CI workflows.
- **Acceptance criteria** — Concrete, testable conditions that define "done". These are what the slice reviews (per-slice ACs) and the final integration review (whole-change ACs) evaluate against. Tag each AC with the slice that satisfies it, or `integration` if the AC can only be judged across multiple slices.
- **Test plan** — The failing tests that anchor each slice, plus any tests covering integration between slices.
- **Risks and trade-offs** — Anything the user should be aware of before approving.

**How accepted refactors flow into the Code phase.** An accepted refactor becomes part of its slice's scope and is implemented under the same TDD discipline as the rest of the slice — the existing code is pinned by a test before it changes (a characterization test if none exists), then refactored inside a green window. A small, local refactor folds into the touching slice as a clearly-delineated commit (e.g. `slice 2: extract quote validator (accepted refactor)`). A refactor large enough to need its own review scope becomes its own slice, ordered **before** the feature slice that motivated it — make the change easy, then make the easy change. Rejected refactors are dropped from scope; a deferred one worth revisiting later is recorded under a `## Deferred refactors` heading in `summary.md` at Phase 4 rather than carried as hidden scope. The per-slice human gate (Phase 2 step 4) confirms the accepted refactor landed as agreed and did not quietly expand.

### Scope guard

Before the plan is presented for approval, the planning agent applies a scope guard with explicit split triggers. The **default is to split**, not to fold in. The triggers:

- **More than 4 slices estimated** → split into 2+ iterations. A 5-slice plan usually signals two coherent units of work being treated as one. The second iteration's folder name is proposed at plan-close.
- **Mid-flow concerns** (anything raised during grilling or implementation that wasn't in the original request) → spin out to a new iteration unless the human **explicitly** says "fix in this branch". The default response to "while you're here, also fix X" is "I'll open `<kebab-name>` for that", not in-branch absorption.
- **Auth / infra / CI / security-sensitive changes** → always its own iteration, never folded into an unrelated story. These need different review framing (security-sensitive checklist) and need to land independently for traceability and rollback.
- **Cross-cutting refactors that touch >10 files outside the story's core seam** → its own iteration. Refactor-by-proximity (Phase 1 "Refactor opportunities") is one slice's adjacent change, not a codebase sweep.

The planning agent surfaces the scope-guard verdict explicitly at plan-close in the form: *"This is N slices touching M files; thresholds are 4 slices / 10 cross-cutting files. Splitting / keeping because [reason]."* If the verdict is **keep**, the human sees the reasoning and can override to split. If the verdict is **split**, the agent proposes the second iteration's folder name and what scope moves where.

**`/compact` is the smoke for scope creep.** Three or more compactions in a single iteration's Code phase is a strong signal the scope guard failed at Phase 1. When this happens, stop, surface it, and propose retro-splitting — the residual moves to a new iteration carried forward — rather than pushing through with degraded post-compaction context. Sub-agent reintroductions of standards violations (especially L.2) cluster immediately after compaction; pushing through is paying that tax for the rest of the story.

**Exit criteria:** User approves the plan (or revises it until approved). No code is written until the plan is approved.

---

## Phase 2: Code

**Trigger:** Plan is approved.

### TDD is mandatory. Every coding agent uses the `tdd` skill.

**Every coding agent that touches a slice — fresh coding sub-agent (default at medium/large tier), main agent (small-tier carve-out only), or parallel sub-agent (opt-in) — MUST invoke the `tdd` skill at the start of the slice and follow its red-green-refactor loop.** This is non-negotiable. Writing tests after the implementation is a process failure regardless of whether the resulting tests pass.

**For the main agent (small-tier carve-out only):** invoke `Skill('tdd')` (or the slash-command equivalent) at the start of the slice. Follow its red-green-refactor instructions exactly.

**For coding sub-agents (default at medium/large tier, and any parallel slices):** the launching brief MUST instruct the sub-agent to follow TDD per the `tdd` skill, with the red-green-refactor steps spelled out:
1. Write the failing integration test(s) first.
2. Run the test. Confirm it fails for the expected reason (not import error, not syntax error, not fixture failure — actual assertion failure or `NotImplementedError`).
3. Implement the minimum code to make the test pass.
4. Run the test again. Confirm it passes.
5. Refactor inside the green window if needed; rerun the test after each refactor step.

A sub-agent brief that does not include these five steps is incomplete; treat as a planning miss and fix the brief before launching.

### TDD trace artifact

Each slice produces an entry in `karpathy-knowledge-base-example/docs/iterations/<story>/tdd-trace.md` capturing the red-green-refactor evidence as the slice progresses. The trace is the auditable record that TDD was actually followed, not just claimed.

**Persistence rule (per the tiering above):** at the **large/critical-path** tier the trace persists as a permanent artifact. At the **medium** tier it is ephemeral — at Phase 4, summarise it into one paragraph in `summary.md` (slices, anchor tests, any `[VIOLATION]` markers) and delete the file. At the **small** tier the trace is omitted entirely; the single combined `iteration.md` records anchor-test names inline. Enforcement evidence is at-time-of-coding regardless of tier — what differs is how long the file lives afterwards.

Format:

```markdown
## Slice N — <slice name>

**Coding agent:** <fresh coding sub-agent (default at medium/large tier) | main (small tier carve-out) | sub-agent in worktree <path> (parallel opt-in)>
**Started:** <timestamp>

### Red
- **Failing test:** <full test ID, e.g., `tests/integration/test_x.py::TestClass::test_method`>
- **Command:** `<exact pytest invocation>`
- **Result:** FAILED — <one-line summary of the assertion failure or NotImplementedError>
- **Confirmed at:** <timestamp>

### Green
- **Implementation:** <one-line summary of the minimal change>
- **Files modified:** <list>
- **Command:** `<same pytest invocation as red>`
- **Result:** PASSED
- **Confirmed at:** <timestamp>

### Refactor (if any)
- **Change:** <one-line summary>
- **Confirmed green again:** <timestamp>
```

If a slice contains multiple anchor tests (e.g., a NEGATIVE test per J.8), each gets its own Red/Green block.

The trace is updated **as the slice is being coded**, not retrospectively. A trace written after the fact is fabricated evidence — flag and reject.

### Process

The Code phase implements slices **sequentially, one at a time**. Each slice passes through two review gates — an agent slice review and a human-in-the-loop slice review — and is committed before the next slice begins.

**The per-slice loop.** For each slice in the plan, in plan order:

1. **Implement the slice in a fresh coding sub-agent.** The main agent launches a fresh coding sub-agent with a clean context window for each slice (medium and large tiers — see "Small-tier carve-out" below for the exception). **Use the `dispatch-coding-subagent` skill to assemble the brief.** The skill templates the verbatim STANDING INSTRUCTIONS block (no-commit-without-go-ahead, no-L.2-refs, F.9, J.6 labels, lint-before-done, sibling-grep, F.8 names) so the standing block can't be dropped under context pressure. The brief is self-contained (see "Sub-agent briefing" below for the field list the skill fills in); it does NOT inherit the conversational history of prior slices, prior grilling, or prior slice reviews. Inside the sub-agent, the coding agent invokes the `tdd` skill and follows red-green-refactor exactly. The sub-agent produces the slice's `tdd-trace.md` entry as it progresses, per the trace format above. Deviations from the plan are surfaced back to the main agent (and through to the human) before the sub-agent continues within the slice. When the sub-agent returns, the main agent integrates its output (commit-staged changes, trace entry, any flagged deviations) and proceeds to step 2.
2. **Agent slice review in a fresh review sub-agent.** Once the slice is green and refactored, the main agent launches a **separate** fresh review sub-agent — distinct from the coding sub-agent — to run the slice review. **Use the `dispatch-review-subagent` skill to assemble the brief.** The skill templates the standing rule-application priorities (extra strict on L.1/L.2/L.3/F.9/F.7/F.8/J.6/M.1/N.1) and the anti-patterns the reviewer must reject in its own draft (pass-by-default, spot-checks, aesthetic AC judgements, missing rule references, aggregated outcomes). The review sub-agent runs against the **slice diff only** (`git diff <last-committed-tip>..HEAD`, scoped to what this slice introduced — not the full branch). It does NOT see the coding sub-agent's conversation or reasoning; it sees only the diff, the plan, the standards doc, and any prior slice review reports on this story. This is the Developer-+-QA pattern from `~/.claude/CLAUDE.md` made non-optional — a review agent that watched the slice being coded is not an impartial reviewer.

   Output: `karpathy-knowledge-base-example/docs/iterations/<story>/code-review-slice-<N>-<rev>.md`, where `<N>` is the slice number from the plan and `<rev>` is the agent-review iteration for that slice (starts at 1). The review applies `karpathy-knowledge-base-example/docs/review-coding-standards.md` exhaustively, using the same rigour and report format as Phase 3, but scoped to the slice diff. Verdict is mechanical: any MUST violation or any failing slice-level AC → CHANGES REQUESTED; otherwise APPROVED. The skill also appends a one-line entry to `karpathy-knowledge-base-example/docs/review-verdicts.log` for the monthly retrospective.
3. **If the agent slice review verdict is CHANGES REQUESTED:** loop back to step 1 for this slice. The coding agent addresses each finding with rule references. A new agent-review iteration produces `code-review-slice-<N>-<rev+1>.md`, walking the delta since the prior agent review (resolution-of-prior-findings section + new delta diff). Continue until the agent verdict is APPROVED.
4. **Human-in-the-loop slice review.** Once the agent's verdict is APPROVED, the slice goes to the human. The human reads the slice diff, the latest agent slice review report, and the slice's `tdd-trace.md` entry. If the slice carried a refactor accepted at plan approval (Phase 1), the human also confirms it landed as agreed and did not quietly expand beyond what was signed off.

   **Visual checkpoint for UI slices.** If the slice's user-facing outcome is fundamentally visual (badges, chips, pills, layout reshuffles, colour swaps, card surfaces, hero strips, anything where "does it look right?" is a real question), the human gate **MUST** include viewing the change in a running browser before approving — not just reading the diff. The agent is responsible for surfacing a screenshot, a dev-server URL, or step-by-step "click here to see X" instructions so the visual check is one keystroke away. Functional changes (data fetching, business logic, validation, route handlers) don't need this — code review and unit tests cover them. The smell test: if a reasonable human could read the diff, agree the code does what was asked, and still say "but it looks bad / wrong / off" — the visual gate applies. This rule exists because purely-static code review cannot judge brand fit, visual hierarchy, or interaction feel; a past badge iteration shipped three slices that passed every agent gate and were then rejected on visual grounds at Phase 4, costing the slices and a branch rewrite.

   The human's options at step 4:
   - **Approve** — proceed to step 5 (commit).
   - **Request changes** — feedback is captured and passed to the coding agent; the loop returns to step 1 for this slice. After the changes land, a new agent-review iteration runs (step 2 → step 3 → step 4) before the human gate retries.

   The human is the final gate per slice and can override an APPROVED agent verdict if something the agent missed (especially anything visual or interaction-level) concerns them. Human approval is signalled by greenlighting step 5 (in a session: a direct "approve" / "looks good, commit" or equivalent). The agent must not auto-advance past step 4 without explicit human sign-off — this is gate #4 in the "Gates that override auto-mode" doctrine at the top of this document.
5. **Commit the slice.** A single commit captures the slice's changes (code, tests, any migration, any infra/config changes attributable to this slice). The commit message follows Section L of the standards and references the slice number (e.g. `slice 2: add quote schema`). The commit's tip becomes the baseline for the next slice's review diff.
6. **Move to the next slice.** Repeat from step 1 with the next slice in the plan.

Phase 2 is complete only when every slice in the plan has been committed via this loop.

**Main agent's role: orchestrator, not implementer.** The main agent's job in Phase 2 is to brief sub-agents, receive their output, brief the next sub-agent in the chain (coder → reviewer → next slice's coder), relay status to the human at each gate, and commit on the human's approval. The main agent carries the cross-slice integration context (what's been committed, what's coming next, what prior slice reviews surfaced) but does NOT do the implementation or the review work itself at medium and large tiers. This keeps the coding sub-agent and review sub-agent contexts pristine.

**Small-tier carve-out.** At the small tier (0.25–0.5 SP, usually one slice), the **coding sub-agent rule is relaxed** — the main agent may code the slice directly, because a single short slice does not produce the context-pollution problem the sub-agent default exists to solve. The **review sub-agent rule still applies** at every tier above trivial: the slice review is always run in a fresh sub-agent with no implementation context, because review impartiality matters even at small tier (and especially when the human will rely on the agent review as a filter). Trivial changes (per the Exceptions section) skip both sub-agents entirely.

**Parallel as opt-in exception.** Sequential per-slice execution is the default — one coding sub-agent at a time, with the main agent waiting for its return before launching the next slice's coding sub-agent. The user can explicitly opt into running a subset of slices in *parallel* coding sub-agents (each in its own isolated git worktree), but only when those slices are genuinely independent (no shared files, no shared mutable state, no logical ordering dependency per the plan). When parallel is in use:
- Each parallel slice still gets its own coding sub-agent AND its own review sub-agent, both fresh.
- Each parallel slice still produces its own `tdd-trace.md` entry and its own `code-review-slice-<N>-<rev>.md` on completion.
- Each parallel slice still passes through the agent + human gate before its commit lands.
- Parallel only overlaps step 1 (implementation) — review sub-agents, the human gate, and commit ordering remain serialised in plan order. If two parallel slices finish step 1 at the same time, they queue for the review-sub-agent + human-gate pipeline one after the other in plan-number order.
- If integration of a parallel slice surfaces a dependency the plan did not anticipate, that is a planning miss — flag it, fix it, and update the plan so the next story's slice ordering benefits.

**Sub-agent briefing.** Every sub-agent — coding or review, sequential or parallel — gets a self-contained brief and does NOT inherit conversational context from the main agent.

A **coding sub-agent brief** must contain:
- The slice number and slice boundary (what this slice does, what it does not do)
- The failing test that anchors the slice (full test ID)
- The files in scope (from the plan's "Files to create or modify" tagged with this slice)
- The acceptance criteria for the slice in isolation
- The explicit TDD red-green-refactor instructions (the five steps from the "TDD is mandatory" section above)
- The `tdd-trace.md` reporting requirement (where to write, what format)
- The explicit instruction that the slice ends at step 1 — the agent slice review and the human gate are run by the main agent (via a separate review sub-agent), NOT by the coding sub-agent
- Any prior-slice context the coder needs to know (e.g. "Slice 1 added the `Quote` schema at backend/schemas/quote.py; this slice uses it but does not modify it")

A **review sub-agent brief** must contain:
- The slice number and the slice's review iteration number (`<N>-<rev>`)
- The slice diff command (`git diff <last-committed-tip>..HEAD`)
- The paths to: the plan, the standards doc, and (for `<rev>` > 1) all prior `code-review-slice-<N>-*.md` files for this slice
- The acceptance criteria the slice is gated against (slice-tagged ACs from the plan)
- The review report format and output path (`code-review-slice-<N>-<rev>.md`)
- The explicit instruction that the review sub-agent must NOT read the coding sub-agent's transcript, only the diff and the docs — impartiality is structural here, not aspirational

A brief that omits any of these is a planning miss; fix it before launching the sub-agent.

**Standards applicability.** All code follows `karpathy-knowledge-base-example/docs/review-coding-standards.md` (which consolidates `~/.claude/CLAUDE.md` and the project's `CLAUDE.md`). The plan does not override the standards — if they conflict, raise it before coding. Coders should treat the standards document as the same source of truth the slice review agent will apply, so issues are caught during step 1 rather than surfaced in step 2.

**What gets committed (per slice, after both gates pass):**
- The slice's application code changes
- The slice's database migrations
- The slice's test additions or updates
- The slice's configuration or infrastructure changes

**What does not get committed:**
- Anything from a slice that has not passed BOTH the agent slice review AND the human slice review. The slice is held as uncommitted work until both gates APPROVE. No partial commits across the gates.

### Detecting a TDD violation

If a coding agent skips TDD (writes implementation before the failing test, or writes tests after the implementation):
1. **Stop immediately.** Do not paper over the violation by writing tests retrospectively to match the existing implementation — that produces tests that pass before AND after the change (regression coverage, not anchors), which is a J.6 failure waiting to happen.
2. **Document the violation honestly** in `tdd-trace.md` with a `[VIOLATION]` marker and a one-paragraph note covering: which slice, what was built before the test, why TDD was skipped, and what the consequences are likely to be.
3. **Either redo the slice properly** (revert the implementation, write the failing test, re-implement) **or** accept the violation as a process failure and flag it in `summary.md`'s "What's left" + a CLAUDE.md note for future sessions. The former is preferred for non-trivial slices; the latter is acceptable only for slices where the cost of redoing exceeds the benefit and the user explicitly accepts.
4. **The agent slice review WILL flag this** via the strengthened J.1 rule (and the final integration review backstops it). Do not assume it will be missed.

---

## Phase 3: Final Integration Review

**Trigger:** Every slice in the plan has been committed via the Phase 2 per-slice loop.

**Where it runs:** A **fresh review sub-agent** with a clean context window — same impartiality rule as the per-slice review sub-agents. The final-review sub-agent does NOT see the coding sub-agents' conversations and does NOT inherit the main agent's accumulated context. It sees only the docs and diffs listed in step 1 below.

**Use the `dispatch-review-subagent` skill to assemble the brief.** The same skill that dispatches slice reviews dispatches the final review — the scope differs (integrated diff vs slice diff, the full set of `code-review-slice-*.md` reports threaded in as prior-review context) but the standing block, anti-patterns, and rule-application priorities are identical. The skill also appends one line to `karpathy-knowledge-base-example/docs/review-verdicts.log`.

The final review is the **integration safety net**. Each slice was already approved by both the agent and the human at slice-level (Phase 2 steps 2–4), so the focus of this review is the cross-slice surface that no individual slice review could see: behaviour interactions between slices, AC coverage across the whole change, drift between the plan and the assembled implementation, and any standards rules whose triggers fire only at the integration level (e.g. cross-slice transaction boundaries, end-to-end test coverage, security postures that emerge from the combination of slices).

A MUST violation inside a single slice that final review catches is a **slice-review miss** — flag it in the final report, fix it (returning to Phase 2 for the affected slice), and call it out in `summary.md` so the next story's slice reviews can adjust. Repeated misses of the same kind warrant a `process-change` log entry against the slice-review brief.

### Canonical standards

The review agent **MUST** apply `karpathy-knowledge-base-example/docs/review-coding-standards.md` rigorously and exhaustively. That document is the source of truth — not a reference, not a suggestion list, not an "if relevant" supplement. It consolidates the coding standards from `~/.claude/CLAUDE.md` (global) and the project's `CLAUDE.md` into a per-rule checklist with explicit verification steps.

The review agent's prompt **MUST** instruct the agent to:
1. Walk every triggered section of `review-coding-standards.md` in order, with explicit attention to integration-level concerns the slice reviews could not see.
2. Run each section's "How to verify" step against the integrated diff (grep the actual files, read the actual code, do not infer from the plan or summary or from slice review reports).
3. Record a per-rule outcome (PASS / FAIL / NOT APPLICABLE) with file:line evidence for every failure.
4. **Treat any MUST-rule violation as blocking.** A single MUST violation produces a CHANGES REQUESTED verdict. SHOULD violations are flagged but non-blocking unless they aggregate or compound.

A review report that does not show evidence of walking `review-coding-standards.md` is incomplete and must be re-run. The same rule applies to slice reviews (Phase 2 step 2) — the format and rigour are identical; only the diff scope differs.

### Process

1. The review agent reads:
   - `karpathy-knowledge-base-example/docs/iterations/<story>/plan.md` (acceptance criteria and scope)
   - `karpathy-knowledge-base-example/docs/review-coding-standards.md` (canonical standards)
   - **Every `code-review-slice-*.md` in the iteration folder** — so the agent knows what was already verified and resolved at slice level. Final review must not re-litigate findings already closed in a slice review unless the integration shows the resolution was incomplete.
   - The full integrated diff against base (`git diff main..<branch>`)
   - Any prior final-review iterations (`code-review-final-*.md`) if this is a re-review of the final integration
2. The agent walks the plan's ACs against the integrated whole. Then it walks the **triggered** sections of `review-coding-standards.md` per the Trigger map at the top of that document, with explicit focus on integration-level concerns — cross-slice consistency, behaviour interactions, AC coverage that no single slice review could have judged in isolation, and rules whose triggers fire only at the integration boundary. A section whose trigger does not fire is recorded as a single `NOT TRIGGERED — <reason>` line, not as a "PASS by non-applicability" walkthrough. Findings already resolved in a slice review are not re-litigated unless the integration shows the resolution was incomplete.
3. **Re-reviews (`code-review-final-N.md` for N > 1) walk deltas only.** The agent reads every prior `code-review-final-*.md` in this iteration's folder, lists each prior finding under "Resolution of prior review findings", and walks only the delta diff since the prior final review (`git diff <prior-final-review-tip>..HEAD`). Sections whose triggers newly fire because of the delta are walked; sections that were `NOT TRIGGERED` and remain so are skipped. Every prior MUST-rule violation must show RESOLVED with file:line evidence before the verdict can be APPROVED.
4. The agent produces a structured report (format below) and writes it to `karpathy-knowledge-base-example/docs/iterations/<story>/code-review-final-<N>.md`.
5. The verdict is mechanical: any MUST-rule violation or any failing AC → **CHANGES REQUESTED**. Otherwise → **APPROVED**.
6. **If CHANGES REQUESTED at final review:** the loop returns to Phase 2 for the affected slice(s). The fix runs through the per-slice loop (TDD if a new anchor test is needed, agent slice review, human gate) before being committed — either as a follow-up commit on top of the original slice's commit, or, when the original slice's commit can be cleanly amended without rewriting downstream slice commits, as an amendment. Once the affected slices are reapproved and recommitted, a new `code-review-final-<N+1>.md` runs.
7. **If APPROVED:** Phase 3 is complete. Move to Phase 4.

### Review report format

The same report format is used for both **slice reviews** (`code-review-slice-<N>-<rev>.md`, Phase 2 step 2) and **final integration reviews** (`code-review-final-<N>.md`, Phase 3). Only the diff scope and the "Branch" line context differ.

```
## Review: [Change Title] — <code-review-slice-N-M.md | code-review-final-N.md>

**Reviewer:** code-review-agent (impartial)
**Branch:** <branch> (N commits ahead of main)
**Plan:** karpathy-knowledge-base-example/docs/iterations/<story>/plan.md
**Standards:** karpathy-knowledge-base-example/docs/review-coding-standards.md (applied rigorously)

### Acceptance Criteria
- [ ] AC-1.1 — PASS / FAIL / PARTIAL (explanation, file:line)
- [ ] AC-1.2 — ...
- [...all ACs from plan.md, none aggregated]

### Resolution of prior review findings (re-reviews only)
- [BLOCKER from review-N-1] description — RESOLVED / NOT RESOLVED / PARTIAL — file:line
- [...one row per prior finding]

### Coding Standards Compliance

Walk only the sections whose **Triggers when** condition fires for this diff (per the Trigger map at the top of `review-coding-standards.md`). For triggered sections, record failures and notable PASSes with file:line evidence. For non-triggered sections, record one line — `NOT TRIGGERED — <reason>` — and move on.

- **Section A (General principles):** [triggered if any code change]
- **Section B (Architecture):** [trigger per map]
- **Section C (Security):** [trigger per map]
- **Section D (Performance):** [trigger per map]
- **Section E (Code quality):** [triggered if any code change]
- **Section F (Code hygiene):** [triggered if any code change]
- **Section G (Pydantic + FastAPI):** [triggered if `backend/api/` or `backend/schemas/` touched]
- **Section H (SQLAlchemy):** [triggered if `backend/models/` or session/query code touched]
- **Section I (Alembic):** [triggered if `backend/migrations/` touched]
- **Section J (Testing):** [triggered if any code change]
- **Section K (Frontend):** [triggered if `frontend/src/` touched]
- **Section L (Git and commits):** [always]
- **Section M (Plan compliance):** [triggered if a `plan.md` exists]
- **Section N (Behaviour change visibility):** [triggered if observable behaviour changed]
- **Section O (Infrastructure):** [triggered if `infra/` touched]
- **Section P (Docker):** [triggered if `Dockerfile` or build files touched]
- **Section Q (CI/CD):** [triggered if `.github/workflows/` touched]

### Code Quality
- **MUST violations (blocking):** file:line — rule reference (e.g. F.5) — description and proposed fix
- **SHOULD violations (non-blocking unless aggregated):** file:line — rule reference — description
- **Suggestions (CONSIDER):** file:line — note

### Security
- Walk Section C of standards. Note any new attack surface, leakage, or auth gap.

### Performance
- Walk Section D of standards. Note any N+1, missing index, or memory-bound query.

### Test Coverage
- Anchors that demonstrably anchor (would have failed pre-change): list with assertion-level reasoning
- Tests that pass before AND after the change (regression coverage, not anchors): list
- Coverage gaps: list

### Behaviour changes
- For each observable change in code/wire output: what changed, why, whether documented in code/summary.

### Verdict: APPROVED / CHANGES REQUESTED
[One paragraph rationale. If APPROVED, confirm zero MUST violations. If CHANGES REQUESTED, list each blocker with its rule reference.]
```

**On CHANGES REQUESTED** (slice or final): the report lists specific issues with rule references from `review-coding-standards.md`. The next iteration MUST verify each prior finding is resolved (in the "Resolution of prior review findings" section above). The slice or final loop continues until the verdict is **APPROVED**.

**On APPROVED** (slice): the slice goes to the human gate (Phase 2 step 4).
**On APPROVED** (final): Phase 3 is complete, move to Phase 4. (Slice commits already landed at Phase 2 step 5.)

### Anti-patterns the review agent must reject

These are common review-agent failure modes. If a review report exhibits any of these, it must be re-run:

- "All standards appear to be followed" — without per-section evidence, this is a pass-by-default. Re-run.
- "I spot-checked a few files" — the standards document requires walking the whole diff. Re-run.
- "AC X is PASS because it looks reasonable" — every AC needs file:line evidence, not aesthetic judgement.
- Missing rule references on findings — every Code Quality issue must cite the rule it violates (e.g., "violates F.5 — `__dict__` spread at admin.py:142"). Without the reference, the reviewer cannot self-check their own application of the standards.
- **Verifying an integration test by running it in isolation** — an integration test must be exercised **within the suite** (or at least after a known prior trigger), never standalone. Running it alone masks suite-ordering flakes: shared global state another test mutates (structlog config, cached loggers, env, DB fixtures) is absent in isolation, so a test that is green alone can fail in the run. If the review re-runs an integration test, it re-runs it in-suite or names the trigger it ran after. (Added after a capstone iteration passed every isolated review yet flaked in-suite — a cached logger bypassed the log-capture fixture once a prior test reconfigured logging without restoring it.)

---

## Phase 4: Explainability Report

**Trigger:** Review verdict is **APPROVED** and changes are committed.

**Process:**
After the commit, produce a final `summary.md` in the iteration folder (`karpathy-knowledge-base-example/docs/iterations/<story>/summary.md`). This document is separate from the code reviews — it is a narrative explanation of the completed work aimed at a reader who was not involved in the implementation.

**Report contents:**

- **What changed** — Plain-language summary of what was built or modified. Not a file list — describe the capability that now exists.
- **Why it was built this way** — Key design decisions and the reasoning behind them. What alternatives were considered and why they were rejected. Reference the plan where appropriate, but focus on decisions that emerged *during* implementation that the plan didn't anticipate.
- **How it fits together** — How the new code integrates with the existing system. Data flow, dependencies, and interaction points. A reader should understand where this sits in the architecture without reading every file.
- **What was learned** — Anything discovered during implementation that wasn't known at planning time: API behaviour that differed from the spec, edge cases found during testing, assumptions that proved wrong, sandbox limitations, performance characteristics observed.
- **Review iterations** — Brief summary of what each review cycle found and how it was resolved. This gives future readers context on why certain patterns were chosen (e.g., "SAVEPOINT per property was added after review identified a transaction safety issue").
- **What's left** — Explicit list of things this change does NOT cover that a reader might expect it to. Known limitations, deferred work, and dependencies on future stories.

**Principles:**

- Write for a **future engineer** joining the project six months from now. They should be able to read this document and understand the change without asking the original author.
- Write for **stakeholders** reviewing progress. They should be able to understand what was delivered and why without reading code.
- **Decisions are more valuable than descriptions.** "We chose X over Y because Z" is more useful than "We implemented X."
- **Be honest about gaps.** If something is a workaround, say so. If the sandbox data was insufficient to fully verify a feature, say so.

### Code review walkthrough (large/critical-path tier only)

As part of explainability for **large/critical-path** stories, produce a `code-review-walkthrough.md` in the iteration folder. This is a diff-level guide that walks a reviewer through the changes block by block. **Skip at the medium and small tiers** — the diff plus `summary.md` covers it, and producing both for routine work duplicates content for no compounding gain.

**Process:**
1. Generate the diff against the base branch (`git diff origin/main...HEAD`)
2. Group changes into logical blocks (not per-file — a single feature may span multiple files, and a single file may contain multiple logical changes)
3. For each block, explain:
   - **What the code does** — plain-language description of the block's purpose
   - **Why it exists** — the design decision or requirement that motivated it
   - **Key things to verify** — what a reviewer should pay attention to (correctness risks, subtle behaviors, things that look wrong but are intentional)
4. Call out any changes to existing code (vs new files) and explain why existing behavior was modified

**Principles:**
- Group by **logical concern**, not by file. "Configuration plumbing" is one block even if it touches 4 files. "Field mapper" is one block even if it has 10 helper functions.
- A reviewer reading this document and the diff side by side should understand every change without needing to ask the author.
- Flag anything that looks surprising — a `pop()` that mutates kwargs, an optional field that the spec says is required, a parameter that seems unused. These are the things reviewers will question.

### Wiki updates: `log.md`, `index.md`, ADRs, and the Jira board

`summary.md` and `code-review-walkthrough.md` are story-local. The wiki updates below are how each iteration **compounds** into the project's shared knowledge — without them, decisions stay buried in iteration folders that no one re-reads.

These updates are **not optional** for any iteration that ships, is declined, or produces a load-bearing decision. They take ~5 minutes; skipping them is the difference between a wiki and a graveyard of summary files.

#### 1. Append to `karpathy-knowledge-base-example/docs/log.md` (mandatory)

For every iteration that reaches Phase 4, append at least one entry to `log.md` and **one entry per load-bearing decision the iteration produced** (not per file changed, not per AC — per *decision*).

**Entry format** (parseable; do not deviate):

```
## [YYYY-MM-DD] type | one-line title
- [Plan](iterations/<story>/plan.md) · [Summary](iterations/<story>/summary.md) · commit `<sha>` (PR #<n>)
- Optional one-paragraph note. Only include if the rationale isn't obvious from the linked artifact.
```

**Types** (use exactly one per entry):
- `iteration` — a story or change shipped, was declined, or was parked.
- `decision` — a load-bearing design choice. Almost always paired with an iteration entry on the same date. If the decision is significant enough to be re-litigated later, it also gets an ADR (see §3).
- `process-change` — a change to `development-workflow.md`, `review-coding-standards.md`, or `references/02-claude-code-skills-strategy.md`. Link to the changed file.
- `incident` — something broke, was discovered to be wrong, or surprised us. Link to the fix or postmortem.
- `meeting` — entry for a meeting whose outcome shaped subsequent work. Link to `minutes/`.
- `ingest` — external document, report, or analysis pulled into the wiki. Link to the artifact.
- `epic-plan` / `proposal` — multi-story plan or proposal drafted but not yet shipped.

**What counts as a "load-bearing decision"** (so you know when to add a `decision` entry):
- A choice that future stories will inherit by default (e.g. the search-ranking approach, a provider-abstraction shape, a caching strategy).
- A plan deviation accepted during implementation or review (e.g. the tenant-filter fix surfaced in the story-2.1 search review).
- An option deliberately rejected (a proposal declined, a scheduler approach rejected, a search engine not adopted — see ADR-0001).
- A workaround you'd otherwise have to rediscover (a subtle HTTP-client encoding quirk, a migration-ordering trap).

**What does NOT need a `decision` entry:**
- Routine implementation choices fully determined by the standards doc or the plan.
- File renames, formatting, copy edits, dependency bumps without behaviour change.
- Anything where a future agent would arrive at the same answer in 30 seconds by reading the code.

**No retrospective entries.** Append at Phase 4, not weeks later — same rule as `tdd-trace.md`. If you discover a missed entry from a prior iteration, append it dated for **today** with a `(backfill: original date YYYY-MM-DD)` suffix on the title.

#### 2. Update `karpathy-knowledge-base-example/docs/index.md` (mandatory if applicable)

Update `index.md` if any of the following are true for this iteration:

- A new iteration folder was created → add a row to the **Iterations** table with status (`shipped <date>` / `declined <date>` / `planned` / `spike` / `proposal`) and a one-line summary.
- An existing doc was superseded → change its status to `superseded by <new doc>` and add the link.
- A new doc was added to `karpathy-knowledge-base-example/docs/` (numbered, in `minutes/`, in `decisions/`, etc.) → add a row in the appropriate section.
- A new domain term was introduced that warrants its own page → add it under the right topic and create the page.

If none of the above apply, skip — do not edit `index.md` for cosmetic updates.

The status taxonomy is documented at the bottom of `index.md`. Stick to it.

#### 3. Write an ADR if the decision is load-bearing enough to be re-litigated (judgement call)

**Where:** `karpathy-knowledge-base-example/docs/decisions/NNNN-<kebab-title>.md` (sequential numbering, no gaps).

**When to write one** — the decision passes at least one of:
- It will be referenced by 2+ future stories.
- It overrides an earlier doc, an earlier ADR, or a written recommendation in `karpathy-knowledge-base-example/docs/references/12-aggregation-plan-revised.md` etc.
- A reasonable engineer could plausibly come to the opposite conclusion six months from now without context.
- It was rejected — declining a proposal is institutional memory; the reasoning rots fast otherwise.

**When NOT to write one** — most `decision` log entries don't need an ADR. The log is the chronological record; ADRs are the small set of decisions worth their own re-readable page.

**ADR format** (terse — these are not essays):

```markdown
---
adr: NNNN
status: accepted | superseded by ADR-MMMM | deprecated
date: YYYY-MM-DD
supersedes: NNNN  # optional
---

# ADR-NNNN: <title>

## Context
One paragraph. What problem? What forces are in play?

## Decision
One paragraph. What we chose, in active voice.

## Alternatives considered
- **Option A** — one line on what it was, one line on why rejected.
- **Option B** — ...

## Consequences
- What this enables.
- What this constrains or makes harder.
- What we will need to revisit if the world changes (and what triggers that revisit).

## References
- Originating iteration: `iterations/<story>/summary.md`
- Related: ADR-MMMM, doc XX, log entry [YYYY-MM-DD]
```

The ADR is the durable artifact; the `log.md` `decision` entry should link to the ADR when one is written.

#### 4. Strike through the completed story and tasks on the Jira board (mandatory when the story ships)

`karpathy-knowledge-base-example/docs/references/01-jira-board-structure.md` is the live backlog. When an iteration **ships** (Phase 4 reached and the work is committed — not merely planned or parked), acknowledge the completed work by striking it through so the board reflects reality at a glance and nobody re-picks finished work.

Apply the convention the board already uses:

- **Story heading** — wrap the title in `~~ ~~` and append `✅ COMPLETE`:
  `### ~~Story 3.15c — Search Infra Hardening~~ ✅ COMPLETE`
  Add a short parenthetical after `COMPLETE` only when the story shipped with a known caveat (e.g. `✅ COMPLETE (prod cutover deferred to Story X)`).
- **Task rows** — strike the task name **and** its points cell, and set the description's status marker to `**SHIPPED**` (or `**DONE**` for zero-point / already-satisfied tasks):
  `| 3.15c.1 ~~Provision sync-runner IAM + SSM primitives~~ | ~~0.5~~ | **SHIPPED** (`374f9d6`) — ... |`
- **Partial completion** — strike only the tasks that actually shipped. A story with some tasks struck and some live keeps its heading un-struck until every in-scope task is done. Tasks explicitly de-scoped are struck with a `**CUT**` / `**SUPERSEDED by <story>**` marker, not `SHIPPED`.

This is a board-hygiene step, not a source-of-truth change: the `log.md` iteration entry (§1) remains the authoritative record of what shipped and when. If the story was **declined or parked** rather than shipped, do not strike it — update its `**Status:**` line instead.

#### Phase 4 completion checklist

A Phase 4 is not complete until the tier-appropriate artifacts plus the wiki updates are done:

1. ✅ `summary.md` written (medium and large tiers) — or the `iteration.md` outcome section completed (small tier).
2. ✅ `code-review-walkthrough.md` written **at the large/critical-path tier only**. Skip at medium and small.
3. ✅ `tdd-trace.md` summarised into `summary.md` and deleted (medium tier) or kept as a permanent artifact (large tier).
4. ✅ One `iteration` entry appended to `log.md`. Plus one `decision` entry per load-bearing decision (zero or more). Plus one `process-change` entry if any of the canonical docs were edited as part of the work.
5. ✅ `index.md` updated if a new iteration folder was created, a new doc was added, or an existing doc was superseded.
6. ✅ ADRs written for any decision passing the §3 bar.
7. ✅ Completed story + shipped tasks struck through on the Jira board (`references/01-jira-board-structure.md`) per §4 — when the iteration shipped.

If any of 4–7 is skipped without explicit user sign-off, that is a Phase 4 process failure — flag it in the next session's `summary.md` "What's left" section and remediate.

---

## The Loop

```
User Request
    │
    ▼
┌─────────┐
│  PLAN   │◄──── User revises
└────┬────┘
     │ User approves plan (slices defined in order)
     ▼
┌──────────────────────────────────────────────────────────┐
│  CODE — per-slice loop (sequential by default)           │
│                                                          │
│  For each slice in plan order:                           │
│                                                          │
│      ┌─► TDD (red → green → refactor)                    │
│      │       │                                           │
│      │       ▼                                           │
│      │   Agent slice review                              │
│      │   (writes code-review-slice-N-<rev>.md)           │
│      │       │                                           │
│      │       ├── CHANGES REQUESTED ──┐                   │
│      │       │                       │                   │
│      │       │ APPROVED              │                   │
│      │       ▼                       │                   │
│      │   Human-in-the-loop review    │                   │
│      │       │                       │                   │
│      │       ├── Request changes ────┤                   │
│      │       │                       │                   │
│      │       │ Approve               │                   │
│      │       ▼                       │                   │
│      │   Commit slice                │                   │
│      │       │                       │                   │
│      └───────┴───────────────────────┘                   │
│              │ (back to TDD for fixes)                   │
│              ▼                                           │
│       Next slice in plan                                 │
│                                                          │
│  All slices committed → Phase 3                          │
└────┬─────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────┐
│  FINAL INTEGRATION REVIEW    │
│  (cross-slice concerns,      │
│   AC coverage across whole,  │
│   plan vs implementation)    │
│                              │
│  Writes code-review-final-N.md
│                              │
│       │                      │
│       ├── CHANGES REQUESTED ─┼─► Back to affected slice's per-slice loop
│       │                      │
│       │ APPROVED             │
└───────┼──────────────────────┘
        ▼
     EXPLAIN (Phase 4)
```

---

## Exceptions

- **Trivial changes** (typo fixes, config value changes, single-line bug fixes) do not require the full cycle. Use judgement — if the change touches logic, it gets the cycle.
- **Urgent hotfixes** may compress the cycle but must still have an agent review pass AND a human review pass before merging to main. The per-slice gate collapses to a single slice for a hotfix, but both gates still apply.
- **The user can override** any phase or any gate. If the user says "skip the plan", "skip the agent slice review", or "commit without the human gate", comply — but note the deviation in the iteration's `summary.md` so the override is auditable.

---

## Ingest workflow (out-of-cycle inputs)

Not all wiki content arrives as a feature request. Meeting transcripts, Slack threads, PO emails, vendor comms, new API docs, articles, security advisories — these come in without triggering Plan → Code and still carry signal the wiki should absorb. The rule for any inbound material:

1. **Raw stays raw and immutable.** Drop the original into the right home: `docs/minutes/<YYYY-MM-DD>-<topic>.md` for meetings (verbatim or near-verbatim), `docs/<provider>_api/` (a vendor folder) for API docs, `iterations/<story>/notes.md` if it attaches to an active iteration. Do not edit raw sources to "improve" them — distillation is a separate artifact.
2. **Distill into a wiki page if the content has reusable signal.** A meeting that produced decisions → log entries (one `decision` per load-bearing call) and an ADR if it passes the Phase 4 bar. An API doc that surfaces gotchas → append a section in `docs/integrations/<provider>/gotchas.md`. A Slack thread that became a refusal of scope (e.g. funnel proposal) → an iteration folder with the engineering response. A research article that genuinely shaped an approach → an entry in `log.md` plus a one-paragraph distillation in the relevant topic doc.
3. **Append an `ingest` entry to `log.md`.** Format: `## [YYYY-MM-DD] ingest | <one-line title>` linking the raw artifact and any distilled wiki page.

**The bar for distillation:** if a future agent or future-you would want this content reachable through `index.md` rather than only through grep of raw folders, distill. Otherwise raw-only is fine. Don't distill to look thorough — distill when the rolled-up form is more useful than the raw form.

---

## Principles

- **Grill before plan, with the human answering.** Every load-bearing assumption is flushed before a single line of spec is written. **Grilling questions are answered by the human, never auto-answered by the agent**, regardless of auto-mode or "work without clarifying questions" framing — those harness modes do not apply to Phase 1 grilling. Surprises caught in grilling are cheap; surprises caught in code review are expensive; surprises caused by the agent self-answering grilling questions are the worst of the three because they masquerade as resolved decisions.
- **Slices are the unit of work AND the unit of review.** Plans break into vertical, independently committable slices. Code phases implement them one slice at a time, TDD-style. Tests are written *with* each slice, never after. Each slice is reviewed in isolation — by the agent and by a human — before the next slice begins.
- **Sequential is the default. Per-slice gates are non-negotiable.** Reviewing each slice immediately after it is coded surfaces issues where they were introduced; fixes stay local and cheap. Reviewing an integrated lump at the end pushes rework backwards across multiple already-coded slices — the failure mode this workflow exists to prevent. Parallel sub-agents remain available as an opt-in for genuinely independent slices, but the per-slice agent + human gate still applies on completion.
- **The human is the final gate per slice.** Agent slice review is the cheap filter; human slice review is the authoritative one. The human can override an APPROVED agent verdict. Without the human gate, slice review collapses back into the same end-of-cycle purge the per-slice cycle exists to prevent.
- **Fresh context per agent, by construction.** Each slice's coding runs in a fresh sub-agent (medium+ tier); each slice's review and the final review run in fresh review sub-agents. The main agent orchestrates but does not implement or review. This is structural impartiality and structural context hygiene — neither relies on the agent remembering to clean up after itself, and both prevent the "main agent's context is poisoned by slice 1's debate" failure mode.
- **Small, reviewed slices over large, reviewed lumps.** If a slice's diff is so large that the per-slice review feels indistinguishable from a final review, the slice was too big — split it and revisit the plan, even mid-Code-phase.
- **Refactor by proximity, with the human's consent.** When a slice touches existing code, the plan surfaces concrete simplification opportunities for that code — but the default is to leave it alone. Refactoring expands scope and risk, so each opportunity is a proposal the human accepts or rejects at plan approval; accepted ones flow into the slice under TDD, rejected ones are dropped. Opportunistic cleanup no one signed off on is scope creep, not craft.
- **The plan is a contract.** It sets expectations for what will be built, including the slices and their dependencies. Surprises in the code phase mean the plan was incomplete.
- **The review is impartial.** It evaluates the code as written, not the intent behind it. A good plan with poor implementation still fails review.
- **The loop converges.** Each review cycle should have fewer issues than the last. If the same issues recur, the root cause is in the approach, not the fix — escalate to the user.
- **Nothing is personal.** Review findings are about the code, not the coder. The goal is the best possible solution.
