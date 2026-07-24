## Review: Slice 2 — Search endpoint (ranked, tenant-scoped) — code-review-slice-2-2.md

**Reviewer:** code-review-agent (impartial)
**Branch:** story-2.1-full-text-search (2 commits ahead of main, slice 2 uncommitted)
**Plan:** ../../iterations/story-2.1-full-text-search/plan.md
**Standards:** ../../review-coding-standards.md (applied rigorously)
**Prior review:** [code-review-slice-2-1.md](code-review-slice-2-1.md) (round 1 — CHANGES REQUESTED)
**Diff scope:** `git diff <slice-2-round-1-tip>..HEAD` (delta only) — `app/services/search.py`, `tests/integration/test_bookmark_search.py`

> **Example iteration.** Round-2 re-review after the round-1 tenant-filter fix. Delta-only
> walk per the workflow's re-review rule.

### Acceptance Criteria
- [x] **AC1** — PASS (unchanged since round 1).
- [x] **AC2** — PASS (unchanged).
- [x] **AC3** — PASS (unchanged).
- [x] **AC4** — PASS (unchanged).
- [x] **AC5** (tenant isolation) — **PASS (now full).** Both the items query and the count query filter on `Bookmark.user_id == user_id`; a shared predicate feeds both (`search.py:22`). New regression test `test_search_total_excludes_other_users` asserts user A's `total` excludes user B's matching bookmark (`test_bookmark_search.py:131`).
- [ ] **AC6** — deferred to integration per plan; verified at final review.

### Resolution of prior review findings (re-review)
- **[MUST-1 from round 1] Count query missing `user_id` filter (`search.py:38`) — RESOLVED.** The match+tenant predicate is now built once — `predicate = (Bookmark.search_vector.op('@@')(tsquery), Bookmark.user_id == user_id)` (`search.py:22`) — and applied via `.where(*predicate)` to **both** the items query (`search.py:25`) and the count query (`search.py:29`). The two paths can no longer drift because they share one predicate tuple. Confirmed by reading the delta, not inferred from the summary.
- **[Suggestion from round 1] `ts_rank` weight coefficients as a named constant — NOT ADOPTED (non-blocking).** Left inline; acceptable — it was a CONSIDER, and the plan's tunable-weights risk notes this is a query-time change with no schema impact. Recorded, not required.

### Coding Standards Compliance (delta)

- **Section C (Security):** **PASS** — tenant isolation now uniform across both query paths; the round-1 gap is closed. This is the section that was blocking; it now passes with file:line evidence above.
- **Section H (SQLAlchemy):** PASS — single shared `where` predicate; both queries bound-parameterised.
- **Section J (Testing):** PASS — the added `test_search_total_excludes_other_users` is a genuine negative test (J.8): it seeds a cross-tenant match and asserts `total == 1` for user A. It fails against the round-1 code (returned `2`) and passes against the fix — a real anchor for the fix, confirmed in tdd-trace Red/Green.
- **Section L (Git):** PASS — fix folds into the slice-2 commit `slice 2: add ranked tenant-scoped search endpoint` (not yet committed; awaiting human gate).
- **Section M (Plan compliance):** PASS — no scope change; the fix tightens the existing service.
- Sections A, D, E, F, G, N — unchanged from round 1 (PASS); triggers did not newly fire on the delta.
- Sections B, I, K, O, P, Q — NOT TRIGGERED (unchanged).

### Code Quality
- **MUST violations (blocking):** none. Round-1 MUST-1 resolved.
- **SHOULD violations:** none.
- **Suggestions (CONSIDER):** none new.

### Security
- Section C re-walked on the delta: the tenant boundary is now enforced on every path that reads `bookmarks` in this service. No residual leakage. `q` remains a bound parameter (no SQLi). Clear.

### Test Coverage
- **Anchors that demonstrably anchor:** `test_search_total_excludes_other_users` — failed pre-fix (`total == 2`), passes post-fix (`total == 1`). Plus the original AC1–AC5 anchor.
- **Tests that pass before AND after:** the AC1–AC4 assertions and the `paginate` characterization test (regression coverage, unchanged).
- **Coverage gaps:** none at slice level. AC6 (`EXPLAIN` index usage) verified at integration.

### Behaviour changes
- `total` now reflects only the caller's matching bookmarks, correcting the round-1 leak. No other observable change.

### Verdict: APPROVED
The round-1 MUST violation is resolved: the `user_id` tenant filter is now applied to both the
items and count queries via a single shared predicate (`search.py:22`), and a dedicated
regression test (`test_search_total_excludes_other_users`) covers AC5 on the count path. Zero
MUST violations remain. Approved to proceed to the human gate.
