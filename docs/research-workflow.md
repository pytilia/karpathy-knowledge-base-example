---
name: Research Workflow
description: Plan → Research → Review fan-out/fan-in cycle. Opus plans and synthesises; parallel Sonnet sub-agents do the work. Triggered by user request, not the default for every task.
status: active
topic: process
last_reviewed: 2026-05-07
---

# Research Workflow

The procedure for **researching new ideas, learnings, or any non-trivial open question** — "what's the state of X", "is Y possible", "compare A vs B", "what would adopting Z look like", "draft a briefing on W". This workflow is **opt-in**: it runs only when the user explicitly invokes it (e.g. "use the research workflow for X", "research X using the fan-out cycle", "/research-workflow X"). The default for code-shaped work remains [`development-workflow.md`](development-workflow.md).

Every research task follows a three-phase fan-out/fan-in cycle: **Plan → Research → Review**. The plan and the review run in the main agent on the latest Opus. The research phase fans out to multiple parallel sub-agents on the latest Sonnet, each with a clean context window. The review phase loops back to plan or research until the synthesis meets the bar.

## When this applies (vs development-workflow.md)

| Shape of work | Use |
|---|---|
| Coding, refactoring, bug fixes, infrastructure changes — anything that produces a diff | [`development-workflow.md`](development-workflow.md) (Plan → Code → Review → Explain) |
| Researching ideas, evaluations, briefings, comparisons, "what's out there", state-of-the-art surveys, reading-list synthesis | **This document** (Plan → Research → Review) |
| One-off lookup ("what's the syntax for X", "where is Y defined") | No process. Read or grep directly. |
| Ingesting a single external source already in hand | "Ingest workflow (out-of-cycle inputs)" section of [`development-workflow.md`](development-workflow.md). Use this document only if multiple parallel research streams are warranted. |

If a research task converges on a load-bearing decision, hand off to the ADR path in Phase 4 of [`development-workflow.md`](development-workflow.md): apply `grill-with-docs`, then write the ADR under `decisions/`, citing the research folder as Context.

## Where artifacts live

All research output — both the audit trail and the deliverable — lives in **`karpathy-knowledge-base-example/docs/research/<topic>/`**. this wiki keeps everything in one place: the research folder *is* the durable artifact. Future iterations, ADRs, and provider gotchas link to it as a citation source.

The folder contains, at minimum:

- `README.md` — index page (mandatory; see template below)
- `plan.md` — the Phase 1 plan (acceptance criteria, stream decomposition, sources)
- `grilling.md` — optional, when the question needed grilling first
- `stream-N-<short>.md` — one per Phase 2 sub-agent (the raw fan-out outputs, kept verbatim)
- `synthesis.md` — the Phase 3 synthesis (the deliverable; what future readers cite)

Promotion to other parts of the wiki happens **on top of**, not instead of, `research/<topic>/`:

| Synthesis shape | Where it lands (in addition to `research/<topic>/`) |
|---|---|
| Load-bearing decision | New `karpathy-knowledge-base-example/docs/decisions/NNNN-<kebab>.md` (ADR), citing `research/<topic>/synthesis.md` as Context. Apply `grill-with-docs` first per Phase 4 of `development-workflow.md`. |
| Vendor / integration insight | Append a bullet to `karpathy-knowledge-base-example/docs/integrations/<provider>/gotchas.md`, with a link back to `research/<topic>/`. |
| Foundational reference-level doc (rare) | New `karpathy-knowledge-base-example/docs/references/<NN>-<kebab>.md` with the next free number — only when the synthesis itself rises to the same bar as the existing 01–15 docs. |
| Story-specific input | Linked from the relevant `karpathy-knowledge-base-example/docs/iterations/<story>/plan.md` under Phase 1 "Prior work consulted". The research stays in `research/<topic>/` — do not duplicate it into the iteration folder. |

**Skill selection within each phase** — when to apply `grill-with-docs`, `tdd`, `improve-codebase-architecture`, `design-an-interface`, etc. — is governed by [`references/02-claude-code-skills-strategy.md`](references/02-claude-code-skills-strategy.md). This document defines the workflow; the strategy doc defines which skills slot in where.

## Models

Bind these explicitly in every invocation of the Agent tool — do **not** rely on inheritance:

| Phase | Model | Agent tool `model` arg |
|---|---|---|
| Plan | Latest Opus (currently `claude-opus-4-7`) | `"opus"` |
| Research (each parallel sub-agent) | Latest Sonnet (currently `claude-sonnet-4-6`) | `"sonnet"` |
| Synthesise & Review | Latest Opus (currently `claude-opus-4-7`) | `"opus"` |

The aliases `"opus"` / `"sonnet"` resolve to the latest model in the family at invocation time. The specific IDs above document the bar the workflow was designed against — if a newer model in the family ships, prefer it; the alias picks it up automatically.

**Rationale.** Opus's strength is reasoning over heterogeneous context — exactly the work in planning (decomposing the question) and synthesis (reconciling multiple sub-agent outputs). Sonnet's strength is throughput on focused, well-scoped tasks — exactly the work in each fan-out stream. Mixing this way buys parallelism cheaply without sacrificing the load-bearing thinking at the ends of the loop.

---

## Phase 1: Plan (Opus)

**Trigger:** User explicitly invokes the workflow on a research question.

### Topic folder naming

Research folders live under `karpathy-knowledge-base-example/docs/research/`. The folder name is set **once** at the start of Phase 1 and **never** changed afterwards (renames break log links and forward-references from ADRs, gotchas, and future iteration plans).

**Naming convention:**

- `<kebab-name>` — short, descriptive, lowercase, hyphenated. Examples: `apscheduler-4-migration-survey`, `postgres-fts-vs-elasticsearch`, `provider-abstraction-patterns`, `slug-generation-libraries`.
- Date-stamp the folder name only if the research is explicitly time-bounded (a "state of X as of Y" snapshot whose conclusions will rot quickly): `<kebab-name>-<YYYY-MM>`. Example: `local-ai-coding-models-2026-05`.
- If the research is initiated *for* a specific story, do **not** prefix with `story-X.Y-` — research is folder-typed by topic, not by the story that triggered it. The story's plan links to the research folder under "Prior work consulted". Multiple stories may end up citing the same research over time.

If the research overlaps an existing topic folder, **do not create a new folder** — extend the existing one with a new dated synthesis or update the existing synthesis in place (and append a log entry recording the update).

### Topic folder README (mandatory)

Every research folder must contain a `README.md` index page. Without it, MkDocs (the wiki served on `127.0.0.1:8765`) cannot resolve `[link](research/<topic>/)` to a navigable page — the served site silently 404s on the folder root, breaking back-pointers from `log.md`, `index.md`, ADRs, and iteration plans.

Write the README **at the moment the folder is created in Phase 1**, with placeholder bullets for streams that don't exist yet. Update it as streams land and the synthesis publishes:

```markdown
---
name: Research — <topic title>
description: Audit trail for the <N>-stream fan-out cycle. Conducted <YYYY-MM-DD>.
status: active
topic: research
last_reviewed: <YYYY-MM-DD>
---

# Research — <topic title>

Audit trail for the [research-workflow.md](../../research-workflow.md) cycle. <One-sentence summary of the question.>

## Phase 1 — plan
- [plan.md](plan.md)

## Phase 2 — research streams (Sonnet × <N>, parallel)
- [Stream 1 — <title>](stream-1-<short>.md)
- ... (one bullet per stream)

## Phase 3 — synthesis & review
- [synthesis.md](synthesis.md)

## Promoted output
- <forward-link, filled in at Phase 3 publication: ADR / gotcha / references doc / iteration plan>

## Cited by
- <appended over time as iterations and ADRs reference this research>

## Headline findings
- <3–5 bullet summary, written at synthesis time>
```

Update the README at three checkpoints: (a) Phase 1 when streams are listed, (b) Phase 3 when synthesis lands, (c) Phase 3 publication when promoted-output forward-links are filled in. The "Cited by" section grows over time as future stories link in.

### Process

1. **Grilling first (when warranted).** If the question is loose or the user's framing has hidden ambiguity, run a `grill-with-docs` pass before planning — stress-test the framing against `backend/CONTEXT.md` and `karpathy-knowledge-base-example/docs/decisions/` so domain language and prior calls shape the question. Output goes in `<topic>/grilling.md`. Skip if the question is already crisp.
2. **Wiki query first (mandatory).** Read [`index.md`](index.md) and search the relevant sections (`references/`, `decisions/`, `integrations/`, prior `research/<topic>/` folders, `iterations/`) for prior work. Cite anything found in the plan; an existing wiki page on the topic shapes the plan (it reframes the question as "what's missing or stale", not "what's out there").
3. **Planning agent (Opus) writes the research plan.** The plan is saved as `<topic>/plan.md` and presented to the user for approval. The main agent then **stops** and waits — see the **Approval gate** below.

**Plan contents:**

- **Question** — The exact research question, in one sentence. Capture the user's prompt verbatim alongside it.
- **Why this matters** — One paragraph on the motivation. What decision, story, or follow-on work does this research enable? (If nothing — it's a lookup, not research.)
- **Prior work consulted** — Every wiki page, ADR, gotcha entry, or raw source already read. Explicitly list the gaps the existing material does **not** cover.
- **Research streams** — Decompose the question into independent research streams. Each stream is something a Sonnet sub-agent can investigate end-to-end with a self-contained brief and produce a focused report from. Streams must have **no shared state** (each is read-only over the world; outputs land in separate files). Aim for **3–7 streams** — fewer means the parallelism wasn't worth it; more means the decomposition is too fine-grained and synthesis will struggle. List each stream with:
  - **Stream N — \<title\>**
  - **Question:** the specific sub-question this stream answers.
  - **Sources to consult:** named docs, URLs, codebases, wiki pages, packages, or "open web search on \<terms\>".
  - **Out of scope:** what the stream must *not* drift into (kept inside the lane of an adjacent stream).
  - **Expected output shape:** what the report should contain (a comparison table? a list with citations? a code snippet plus commentary?).
- **Reconciliation strategy** — How the synthesis will combine the streams. Where overlaps are expected. Which contradictions to flag. What the final deliverable looks like (a recommendation? an ADR seed? a gotchas-file appendix?).
- **Acceptance criteria** — Concrete, testable conditions that define "the synthesis is good enough to ship". Examples: "every claim cited to a primary source", "covers all five candidate libraries", "produces a recommendation with three named alternatives rejected".
- **Risks** — Where the research is most likely to come back thin, contradictory, or stale. What we do if a stream returns weak material.

---

## Approval gate (between Phase 1 and Phase 2 — mandatory, enforced)

**No Phase 2 sub-agents are dispatched until the user has explicitly approved the plan in a follow-up message.** This gate is non-negotiable. A bad decomposition multiplies cost across N parallel sub-agents — the cost of pausing to confirm is one turn; the cost of fanning out the wrong question is the entire cycle.

**Process at the gate:**

1. The main agent writes `<topic>/plan.md` and posts the plan summary (or a link to it) to the user in chat.
2. The main agent **stops**. It does not pre-emptively launch sub-agents, draft stream briefs in tool calls, or "kick off Stream 1 while waiting" — all of these violate the gate.
3. The user replies with one of:
   - **Approval** — an unambiguous "approve", "approved", "go ahead", "proceed", "looks good, run it", "yes", or equivalent. Approval is for *this specific plan* — if the plan changes after approval, re-approve.
   - **Revisions** — concrete changes to the plan. The main agent edits `plan.md`, posts the diff or revised plan, and **returns to step 2** (the gate re-arms; prior approval does not carry over).
   - **Abandon** — user kills the cycle. The folder is left in place with `status: abandoned` in the README frontmatter.
4. Only after explicit approval may the main agent enter Phase 2.

**What does NOT count as approval:**

- User silence or absence of objection. ("They didn't push back" is not approval.)
- A reaction to an unrelated topic in the same message. Approval must reference the plan.
- The user approving an *earlier* plan in a related cycle. Each cycle's gate is independent.
- Implicit approval inferred from "OK" responses to clarifying questions about the plan itself.

**Override.** The user can bypass the gate explicitly ("skip the plan and just run it", "auto mode — no need to approve"). This is the only legitimate way to proceed without approval; record the bypass in `plan.md` under a `Gate bypassed by user:` line so the audit trail shows the deviation. Auto mode being active in the harness is **not** an automatic bypass — the user must say so for this cycle.

**Failure mode this gate exists to prevent.** Prior cycles have rolled directly from "plan written" into "Agent calls launched" in a single turn, treating the plan as a formality. That collapses Phase 1 + Phase 2 into one beat and removes the user's only opportunity to redirect cheap planning effort before expensive parallel dispatch.

---

## Phase 2: Research — fan out (Sonnet × N)

**Trigger:** User has explicitly approved the plan per the Approval gate above. If the gate has not closed, do not enter this phase.

### Sub-agent briefs are self-contained

Each Sonnet sub-agent runs in its own clean context window — it cannot see this conversation, the plan document, or sibling sub-agents' work. The brief MUST stand alone. Treat the briefing rules from `~/.claude/CLAUDE.md` § Sub-agent patterns as binding here:

- **Goal** — the stream's question, verbatim from the plan.
- **Context** — the minimum background needed to act. Paste relevant excerpts from prior wiki pages rather than telling the agent to "go read the wiki" (the agent will not have time/budget to do that thoroughly).
- **Sources to consult** — the explicit list from the plan. Include URLs in full.
- **Scope and out-of-scope** — both, explicitly.
- **Acceptance criteria** — the stream's slice of the plan's overall acceptance criteria.
- **Expected output shape** — the structure of the report (headers, tables, citation format).
- **Citation discipline** — every factual claim links to a primary source (URL, file path, package version). No claim without a citation. Mark uncited claims as opinion or hypothesis explicitly.
- **What "thin" looks like** — instruct the agent to flag back if a stream is producing weak material, rather than padding. A short, honest "couldn't find good sources on X" beats a confident-sounding fabrication.

A brief that does not include all of the above is incomplete; treat as a planning miss and fix the brief before launching.

### Process

1. **Launch sub-agents in parallel.** Make a single Agent tool call per stream, all in one message — they run concurrently. Each one passes `model: "sonnet"` explicitly; do not rely on inheritance. The default `subagent_type` is appropriate (`general-purpose` or `Explore` for read-only search-heavy streams).
2. **Each stream writes to its own file.** The sub-agent's output is saved as `<topic>/stream-N-<short-name>.md`. Do not let two sub-agents write to the same file — that's a shared-state violation and breaks the fan-out invariant.
3. **No mid-flight cross-talk between streams.** If Stream 2 needs Stream 1's output, the decomposition was wrong — those should have been one stream, or sequential. Stop, fix the plan, relaunch.
4. **The main agent does not also do stream work.** The main agent's job in this phase is dispatch and coordination, nothing else. Doing one of the streams "as well" in the main context defeats the clean-context property and risks polluting the synthesis with planning-time biases.
5. **Collect and verify.** When each sub-agent returns, save its full output to `<topic>/stream-N-<short-name>.md` and skim for: did it answer the assigned question? did it cite? did it flag thin material? If any stream came back weak, decide whether to relaunch with a tightened brief or accept the gap and flag it in the synthesis.

### Detecting fan-out failures

- A stream that came back with no citations → relaunch with citation-discipline emphasised, or downgrade its claims to "hypothesis" in the synthesis.
- Two streams that produced contradictory facts → flag for the synthesis phase to reconcile against primary sources, do **not** average them.
- A stream whose scope drifted into another stream's lane → trim back to scope before passing to synthesis. Drift produces double-counting in the synthesis.

---

## Phase 3: Synthesise & Review — fan in (Opus)

**Trigger:** All streams have returned and been saved as files.

### Synthesis agent

Run as the **main agent on Opus**, or spawn a dedicated synthesis sub-agent with `model: "opus"` if the main context has been polluted by extensive dispatch logging. The synthesis agent reads:

- `<topic>/plan.md` (acceptance criteria, reconciliation strategy)
- Every `<topic>/stream-N-*.md` (the raw fan-out outputs)
- Any prior wiki pages cited in the plan (not just summaries — read the actual pages)

It produces `<topic>/synthesis.md`. The synthesis is the durable deliverable — future readers cite this, not the stream files.

### Synthesis structure

```markdown
## Synthesis: <topic>

**Question:** <verbatim from plan>
**Streams:** N (links to each stream-N file)
**Acceptance criteria:** <list, with PASS / FAIL / PARTIAL beside each>

### Findings
[The actual content. Section structure is determined by the plan's "expected output shape".
Every claim cites a primary source — a URL, a file:line, a package@version.
Claims that came from a stream cite the *original* primary source, not the stream file
(citation transitivity is a fabrication risk — see Anti-patterns below).]

### Contradictions and unresolved questions
[Flag every place two streams disagreed and explain how the synthesis resolved it.
List every question the streams could not answer. These become Open questions in
follow-on iterations or future research.]

### Recommendation (if applicable)
[Where the plan asked for a recommendation, give one. State the alternatives rejected
and why. If a load-bearing decision is implied, this seeds the ADR.]

### What's left
[Things this research deliberately did not cover. Stale-by date, if applicable —
the date past which conclusions should be re-checked before being acted on.]
```

### Review

The synthesis is then reviewed against the plan's acceptance criteria. Review is mechanical:

1. Every acceptance criterion has a PASS / FAIL / PARTIAL with file evidence.
2. Every claim is checked for citation. Uncited claims are downgraded to hypothesis or removed.
3. Cross-stream contradictions are confirmed resolved or explicitly flagged as open.
4. The synthesis covers the full scope of the plan; nothing in scope was silently dropped.

**Verdict: ACCEPTED / CHANGES REQUESTED.**

- **CHANGES REQUESTED:** loop back. Either (a) Phase 2 — relaunch one or more streams with a tightened brief, or (b) Phase 1 — the plan was wrong, revise it. Almost every "the synthesis is thin" failure is a Phase 1 failure (the question was decomposed badly), not a Phase 2 failure.
- **ACCEPTED:** proceed to publication.

### Publication

The synthesis is now durable. Promote where applicable, **without removing it from `research/<topic>/`**:

| Synthesis shape | Promotion |
|---|---|
| Pure briefing / comparison / survey | No promotion needed. The research folder is the deliverable. Future stories cite it from their plan.md. |
| Recommendation that crosses the load-bearing-decision bar | Apply `grill-with-docs`, then draft an ADR under `decisions/NNNN-<kebab>.md` per Phase 4 of [`development-workflow.md`](development-workflow.md). The ADR's Context section cites `research/<topic>/synthesis.md`. |
| Vendor or integration finding | Append a bullet to `integrations/<provider>/gotchas.md` linking back to `research/<topic>/`. |
| Foundational reference-level material (rare) | Add a new numbered doc under `references/<NN>-<kebab>.md`. Update the relevant section of [`index.md`](index.md). |

### Wiki updates: README, log.md, index.md (mandatory)

Same bar as Phase 4 of `development-workflow.md`. After the synthesis is accepted (and any promotion lands):

1. **Update `<topic>/README.md`** with promoted-output forward-links in the *Promoted output* section and the *Headline findings* bullets. The README was stubbed in Phase 1; this completes it. Without this update the research folder serves as a 404-prone dead-end on MkDocs.
2. **Append to [`log.md`](log.md).** One `research` entry for the cycle itself, plus one `decision` entry per ADR the synthesis produced (zero or more), plus one `ingest` entry per raw external source pulled in. Format per Phase 4 of [`development-workflow.md`](development-workflow.md).
3. **Update [`index.md`](index.md).** Add the research folder to the *Research* section. If the synthesis produced a new ADR, references doc, or gotcha update, those go into their respective sections too.
4. **Touch related pages.** Identify the existing references/ADR/integration/iteration pages the research touches and update each: new claims, flagged contradictions, back-pointers under a `## Cited by` or `## Mentioned in` section. A research synthesis that updates nothing else is a smell — sources are valuable because of the connections they create.
5. **Verify the live MkDocs serve picked up the changes.** The wiki is served by `mkdocs serve` on `127.0.0.1:8765`. Filesystem watchers occasionally miss newly-created sub-folders. After publication, hit the served URL of the new research folder and any new durable page; if either 404s, restart the server via the repo's `restart-wiki.sh` script:

   ```bash
   ./restart-wiki.sh
   ```

---

## The Loop

```
Research Question (user invokes "use research workflow")
    │
    ▼
┌─────────┐
│  PLAN   │◄──── User revises / Review sends back
│ (Opus)  │
└────┬────┘
     │ plan.md written, posted to user
     ▼
╔═══════════════════════════════╗
║  APPROVAL GATE (mandatory)    ║
║  Main agent STOPS and waits.  ║
║  No sub-agent dispatch until  ║
║  user posts explicit approval.║
╚═══════════════╤═══════════════╝
                │ user replies "approve" / "go" / equivalent
                ▼
┌─────────────────────────────┐
│      RESEARCH (fan out)     │
│  Sonnet × N parallel agents │
└────────────┬────────────────┘
             │ all streams returned
             ▼
┌─────────────────────────────┐
│   SYNTHESISE & REVIEW       │
│   (Opus, fan in)            │──── Changes requested? ──► Back to PLAN or RESEARCH
└────────────┬────────────────┘
             │ Accepted
             ▼
   research/<topic>/synthesis.md (durable)
   + optional promotion: ADR / gotcha / references doc
   + log.md entry, index.md update, related-pages updates
```

---

## Exceptions

- **Trivial lookups** — single-source questions, "what's the syntax", "is X installed" — do not warrant the cycle. Read or grep directly. The cycle is for questions worth investing N parallel sub-agents in.
- **One-stream research** — if the decomposition genuinely yields one stream, the cycle has no fan-out and degenerates to a single Opus pass. That's fine; skip Phase 2's parallelism but keep Phase 1's plan and Phase 3's synthesis discipline.
- **Time-boxed research** — when the user wants a quick sweep ("spend 10 minutes seeing what's out there"), plan and run a single fan-out batch but skip the review loopback. Flag explicitly in the synthesis that it is rapid and uncalibrated.
- **The user can override** any phase. If the user says "skip the plan" or "just give me the answer", comply — but note the deviation in the README and skip publication updates unless the user reconfirms.

---

## Anti-patterns to reject

- **Fanning out without a plan.** "Spawn five sub-agents and see what they say" is shotgun research. Each sub-agent eats budget; without a plan they overlap and miss.
- **Fanning out without explicit user approval of the plan.** A plan exists, the agent dispatches anyway in the same turn. The Approval gate above exists precisely to prevent this — the cost of pausing for one user turn is far less than the cost of N parallel sub-agents chasing the wrong decomposition. Treating Phase 1 and Phase 2 as one continuous beat is the most common form of this failure.
- **Synthesising without re-reading streams.** Treating sub-agent summaries as ground truth in the synthesis propagates any hallucination they made. Pull the citations through to primary sources.
- **Citing stream files instead of primary sources.** `<topic>/stream-3-libraries.md` is not a source — the URL it cites is. Citation transitivity is the #1 hallucination-propagation failure mode.
- **Letting a thin stream slide.** If a stream came back weak, the synthesis must flag the gap, not paper over it. Hypotheses labelled as facts pollute the wiki for years.
- **Dropping research into `iterations/`.** Research output belongs in `research/<topic>/`, not in an iteration folder. Iterations are scoped to a single story; research is reusable across stories. Iteration plans cite research; they do not contain it.
- **Skipping publication.** A research cycle that ends in `<topic>/synthesis.md` and never updates `index.md` / `log.md` / related pages is a dead-end audit trail. The wiki's compounding only happens when synthesis becomes navigable.
- **Dispatching streams sequentially when they're independent.** If five streams are independent, send all five Agent calls in one message. Sequential dispatch loses the entire reason this process exists.

---

## Principles

- **Plan before fan-out.** Decomposition is the load-bearing step. A bad decomposition multiplies cost across every sub-agent.
- **Clean context per stream.** Sonnet sub-agents run independently because that's where the parallelism, the focus, and the resistance to context bias come from. Shared state breaks all three.
- **Opus at the ends, Sonnet in the middle.** Reasoning over heterogeneous context wants Opus; throughput on focused tasks wants Sonnet. Bind models explicitly — never inherit.
- **Citations or hypotheses — never claims-without-source.** The wiki is a memory layer; ungrounded claims poison it.
- **Synthesis is more than concatenation.** If the output is a stitched-together copy of the streams, the fan-in didn't do its job. Reconcile, weigh, recommend.
- **Publish or don't bother.** Research that doesn't land in the wiki was a chat, not research. The cycle exists to compound knowledge across sessions and across stories.
