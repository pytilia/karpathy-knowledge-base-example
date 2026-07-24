---
name: catch-me-up
description: Comprehension skill — explore and explain how a codebase works without writing code. Routes the question to one of seven exploration modes (architecture, convention, feature-trace, code-semantics, testing, history, story). Use when the user says "catch me up on X", "how does X work", "trace the flow of Y", "why was Z decided", "what does this code do", "what's tested in W", or names a story like "what did story 3.4 do". Read-only — for bug hunting use `diagnose`, for feature work use `tdd`.
argument-hint: "the comprehension question (e.g. 'how does the booking flow work', 'trace what happens when a user cancels', 'why did we move to ListingSource enum', 'what did story 3.4 do')"
---

# Catch Me Up

Comprehension over generation. In a long-lived codebase, ~70% of the time goes into reading and navigating code — the AI unlock is making that fast and structured, not autocompleting more files. This skill takes a question, classifies it into one of seven exploration modes, gathers the right sources for that mode, and produces a visual, citable answer. Nothing is written; nothing is changed.

If the user invoked the skill with no argument, ask them for the question before doing anything else.

## How to run

1. **Detect available sources** (one-time per invocation — see "Source detection" below). Different repos have different substrates; what you can answer is shaped by what exists.
2. **Classify the question** into one of the seven modes (see "Mode picker"). If genuinely ambiguous, say so and run two modes as separate sections.
3. **Run the mode** per its section below — gather sources, then produce output in the specified shape.
4. **Cite everything.** `file:line` for every claim about code. Wiki path / ADR number / log-entry date for every claim about decisions. Quote sources verbatim when wording matters.
5. **Stay impartial.** Report what the code and docs say. Flag what they don't say. Never invent a rationale a doc never recorded — say "no documented rationale found in {log.md, ADRs, iteration summaries}" instead.

## Source detection (one-time per run)

Run these checks at the start of every invocation, in parallel where possible. The sources available shape what you can answer:

```bash
# Domain glossary (the project's canonical vocabulary)
ls CONTEXT.md backend/CONTEXT.md docs/CONTEXT.md src/CONTEXT.md 2>/dev/null

# Wiki — shared/global (most canonical) vs in-repo (fallback)
ls karpathy-knowledge-base-example/docs/index.md karpathy-knowledge-base-example/docs/log.md 2>/dev/null
ls karpathy-knowledge-base-example/docs/decisions/ karpathy-knowledge-base-example/docs/iterations/ karpathy-knowledge-base-example/docs/references/ 2>/dev/null
ls docs/index.md docs/decisions/ docs/adr/ adr/ 2>/dev/null

# Standards (the convention oracle)
ls karpathy-knowledge-base-example/docs/review-coding-standards.md docs/coding-standards.md CODING_STANDARDS.md 2>/dev/null

# Repo signals
ls backend/ frontend/ tests/ 2>/dev/null
```

State up front which substrates you found. If a substrate is missing, say so — e.g. "no domain glossary in this repo; falling back to code inspection." Do NOT fabricate paths or invent file names.

## Mode picker

Pick the mode from the question shape:

| If the question asks... | Mode |
|---|---|
| "how does X work", "how do these fit together", "what are the moving parts" | **1. Architecture** |
| "how do we do X here", "what's the pattern for", "what's the convention" | **2. Convention** |
| "what happens when a user does X", "trace from UI to DB", "follow the flow of" | **3. Feature-trace** |
| "what does this code do", "what does this pattern mean", "why is it written this way" | **4. Code-semantics** |
| "what's tested in X", "what fixtures exist", "what's the anchor test for Y" | **5. Testing** |
| "why was X changed", "when did Y happen", "who decided Z", "what's the history of" | **6. History** |
| "what did story <N.M> do", "what's the scope of <story>", "where did <iteration> land" | **7. Story** |

---

## Mode 1 — Architecture

**Question shape:** how a subsystem works; how modules fit together; what the moving parts are.

**Sources, in priority order:**
1. `CONTEXT.md` — the canonical domain vocabulary. Read it first; every architecture answer is grounded in terms defined here.
2. ADRs in `karpathy-knowledge-base-example/docs/decisions/` (or `docs/decisions/`, `docs/adr/`, `adr/`) — load-bearing decisions that shape the architecture.
3. Code structure — `models/`, `services/`, `providers/`, `routes/`, etc.
4. `karpathy-knowledge-base-example/docs/index.md` — entry points to topic docs.

**Produce:**

- A **one-paragraph plain-English summary** of what this subsystem does.
- An **ASCII module map** showing the boundaries. Example shape:

  ```
  ProviderRegistry ──► BaseProvider (abstract)
                         │
                         ├── NativeProvider     (models/, services/)
                         ├── NextPaxProvider    (integrations/nextpax/)
                         └── FareHarborProvider (Epic 5 — not yet built)
  ```

- A **terms table** pulled from `CONTEXT.md` with file:line and the invariants that hold:

  | Term | Source | Key invariants |
  |---|---|---|
  | `Listing` | `models/listing.py:1` | routed by `listing_source` |
  | `BaseProvider` | `providers/base.py:N` | 7 abstract methods, frozen result types |

- A **"Related ADRs"** bullet list with one-line summaries and links.
- A **"Where to look first"** pointer — the single file a new contributor should read.

---

## Mode 2 — Convention

**Question shape:** how does this project do X? What's the pattern for Y?

**Sources:**
1. `karpathy-knowledge-base-example/docs/review-coding-standards.md` (or the project's standards doc) — the codified rules, often in sections (A–Q).
2. 2–3 existing examples in the codebase that follow the pattern (find via grep).
3. The relevant `CONTEXT.md` term if the convention is domain-bound (e.g. "currency is always integer cents").

**Produce:**

- The **rule verbatim** from the standards doc, with its section reference (e.g. F.5).
- **Two or three concrete examples** from the codebase, file:line, with a short excerpt of each.
- A **"don't do" example** if the standards doc gives an anti-pattern, or if grep reveals a candidate violation worth flagging (mark `[VIOLATION CANDIDATE — verify]`; do not assume).
- A **one-line "why"** — pulled from the standards doc's rationale or a linked ADR if the rule has one.

---

## Mode 3 — Feature-trace

**Question shape:** what happens when a user does X? Trace from button-click to DB row. Follow the lifecycle of Y.

**Sources:** frontend code → API route → service / orchestrator → model + migration → any external / provider call. Follow imports and calls; do not guess at the path.

**Produce:**

A **numbered hop-by-hop trace** with file:line at every step and a one-line description per hop:

```
1. User clicks "Cancel booking"             → frontend/src/pages/BookingDetail.tsx:142
2. POST /api/v1/bookings/{id}/cancel        → backend/api/bookings.py:88
3. Authorize: booking.user_id == current_user
                                            → backend/api/bookings.py:91
4. ProviderRegistry.get(booking.listing_source).cancel_booking(...)
                                            → backend/providers/registry.py:34
5. NextPaxProvider.cancel_booking           → backend/providers/nextpax/provider.py:217
6. PATCH NextPax /bookings/{ref} status=cancelled (external)
7. BookingStatus → CANCELLED, commit        → backend/models/booking.py:N
8. SES email "Booking cancelled"            → backend/services/notification.py:N
```

After the trace, list:

- **Branches** — alternative paths (e.g. "if `start_date <= today`, returns 400 — see ADR-0003").
- **Side effects** — webhooks fired, emails sent, payments refunded, audit rows written.
- **Data shape at each layer** — request schema → service input → DB columns → response schema.

---

## Mode 4 — Code-semantics

**Question shape:** what does this code do? What does this pattern mean? Why is it written this way?

**Sources:** the code itself; any `CONTEXT.md` term that defines the symbols it uses; the relevant standards-doc rule if the code is following or violating one; inline comments / docstrings (but verify against the code — comments rot).

**Produce:**

- **Plain-language paraphrase** — line-by-line for short blocks, block-by-block for longer ones.
- For each non-obvious construct: a **callout** explaining the *idiom* (e.g. "this is the F.5 pattern — never spread `__dict__` because of silently-promoted-column risk; the explicit allow-list is intentional").
- If the code uses a domain term, **link the term back to `CONTEXT.md`** with the entry's invariants — that's almost always *why* the code is shaped this way.
- If the code appears to violate a standard: flag with `[VIOLATION CANDIDATE — verify]` and cite the rule.

---

## Mode 5 — Testing

**Question shape:** what's tested in X? What fixtures exist? What's the anchor test for Y?

**Sources:**
1. The `tests/` directory (typically mirrors the production directory).
2. Section J of the standards doc (testing rules — anchors vs regression, NEGATIVE tests, what counts as integration).
3. Any `tdd-trace.md` in `karpathy-knowledge-base-example/docs/iterations/<story>/` for stories that touched this area.
4. `conftest.py` files for fixtures.

**Produce:**

A **test inventory table**: test file, test name, **anchor** (would fail pre-change — Section J.6) vs **regression** (passes before and after), and a one-line summary of the assertion.

| File | Test | Type | Asserts |
|---|---|---|---|
| `tests/integration/test_cancel.py` | `test_cancel_past_start_date_is_400` | NEGATIVE anchor | rejects cancel after start_date |
| `tests/integration/test_cancel.py` | `test_cancel_emits_notification` | anchor | SES called with template `booking-cancelled` |

Plus:

- **Fixtures available** (from `conftest.py`s in scope): name + one line on what it provides.
- **Coverage gaps** — exception paths and edge cases the existing tests don't anchor. Be honest; do not invent a coverage %.

---

## Mode 6 — History

**Question shape:** why was X changed? When did Y happen? Who decided Z?

**Sources, in priority order — check each before falling back to the next:**
1. `karpathy-knowledge-base-example/docs/log.md` — chronological log of decisions, iterations, incidents, ingests. **Grep this first.**
2. `karpathy-knowledge-base-example/docs/decisions/` (ADRs) — durable form for load-bearing decisions.
3. `karpathy-knowledge-base-example/docs/iterations/<story>/summary.md` — per-story narrative including review iterations + "What was learned".
4. `git log --follow -p <file>` and `git blame` — last resort; raw, with no rationale recorded.

**Produce:**

A **timeline** with one row per source, newest first, each row citing the source:

```
2026-05-25  decision   GDPR account deletion lands as frontend placeholder
                       log.md → ## [2026-05-25] decision | GDPR account deletion...
                       iteration: iterations/profile-page-redesign/
2026-05-19  process    Per-slice review gates added to development-workflow.md
                       log.md → ## [2026-05-19] process-change | ...
2024-11-08  ADR-0001   Provider abstraction — single ListingSource enum routes to one of three providers
                       decisions/0001-provider-abstraction.md
```

After the timeline:

- The **"why"** in one paragraph, quoting the most authoritative source verbatim (ADR > log entry > iteration summary > commit message > nothing).
- If no documented rationale exists, **say so**: "git blame attributes the change to commit `<sha>` (<date>, <author>) with message `<msg>`; no log entry, ADR, or iteration summary references this change." Do not invent a why.

---

## Mode 7 — Story

**Question shape:** what did story <N.M> do? What's the scope of <story>? Where did <iteration> land?

**Sources:**
1. `karpathy-knowledge-base-example/docs/references/01-jira-board-structure.md` (or whatever the project's story-numbering reference is) — epic / story layout.
2. `karpathy-knowledge-base-example/docs/iterations/story-<N.M>-*/` — the iteration folder for the story.
3. Within the folder: `plan.md` (scope, slices, ACs), `summary.md` (outcomes, decisions, what's left), `code-review-final-*.md` (verdict and findings), any `tdd-trace.md`.
4. `log.md` entries cross-referencing the story (grep for `story-<N.M>` or its title).
5. Linked ADRs.

**Produce:**

A **structured story brief**:

```
## Story <N.M> — <title>

**Status:** shipped <date> / declined / planned / in flight (slice <k>/<n>)
**Iteration folder:** iterations/story-<N.M>-<kebab>
**Tier:** small / medium / large
**Branch / PR:** ...

### Scope (from plan.md)
- In: ...
- Out: ...

### Slices
1. <slice 1 name> — anchor test `tests/...::test_x`  (commit `<sha>`)
2. <slice 2 name> — ...

### Acceptance criteria
- [x] AC-1.1 — PASS (file:line)
- [ ] AC-1.2 — DEFERRED (reason)

### Decisions made
- <decision 1> — see ADR-NNNN
- <decision 2> — log entry [YYYY-MM-DD]

### Review outcomes
- code-review-final-1: APPROVED with 2 SHOULDs resolved
- ...

### What's left / follow-ups
- ...
```

If the story folder doesn't exist, say so — don't synthesise the story from log entries alone. If the folder name doesn't follow `story-<N.M>-<kebab>` exactly, search by epic prefix and offer matches.

---

## Output style (across all modes)

- **Tables for structure.** Lists of files, terms, tests, decisions render as tables — easier to scan than prose.
- **ASCII trees / diagrams for relationships.** Module maps, call flows, hierarchies. Don't draw a tree if a list says the same thing.
- **`file:line` for every claim about code.** Without the citation, the reader can't verify.
- **Wiki path for every claim about decisions** — `log.md` entry header, ADR number, or iteration summary path.
- **Quote rather than paraphrase when wording matters** (especially ADRs and standards-doc rules).
- **Be visual.** Humans recognise relationships in a diagram or table faster than they read them in prose. That's the entire point of this skill.

## What this skill does NOT do

- Write code. If the user wants the change made, hand off to `tdd` or the dev workflow.
- Debug a bug. Use `diagnose` for that.
- Refactor or improve architecture. Use `improve-codebase-architecture` for that.
- Speculate about rationale. If no doc records the "why", say so and stop.

## Anti-patterns to avoid

- "Generally, this code looks well-structured" — vague and unverifiable. Say `file:line` or say nothing.
- Inventing an ADR number, log date, or story number that doesn't exist. If the wiki doesn't have it, say "no entry found."
- Re-reading the entire wiki on every invocation. Grep targeted; read the entries that match.
- Pretending to know without checking. The wiki is the source of truth; you do not have it memorised.
- Skipping `CONTEXT.md`. Almost every architecture, convention, and code-semantics question is grounded in a domain term whose canonical definition is there. Read it first.
- Generating prose where a table or diagram would be sharper. The unlock is comprehension, and comprehension is faster when the shape matches the content.
