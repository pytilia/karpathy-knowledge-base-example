// Monthly friction-mining retrospective for a project.
//
// Invocation:
//   Workflow({
//     scriptPath: "karpathy-knowledge-base-example/docs/retrospectives/scripts/run-friction-retro.js",
//     args: { period_label: "2026-07" }
//   })
//
// What it does:
//   1. Discovers transcripts modified in the last 30 days at
//      ~/.claude/projects/<your-project-slug>/*.jsonl
//   2. Fans out one mining agent per transcript (parallel) extracting friction
//      patterns by category, with verbatim evidence.
//   3. Mines code-review-*.md files added/changed in iteration folders during
//      the period for recurring violation themes.
//   4. Reads the prior retro (if any) and audits current docs/memory so the
//      synthesis names "still bleeding" vs "fixed by [intervention]" vs "new".
//   5. Reads the review-verdicts.log (if present) to count
//      'APPROVED with MUST violations remaining' patterns.
//   6. Writes the report to <shared-docs>/retrospectives/<period_label>.md.
//   7. Appends a process-change entry to <shared-docs>/log.md only when the
//      retro surfaces a new theme or escalates a still-bleeding one.
//
// The output report is the input to next month's retro — comparison is
// pairwise against the most recent prior retro.

export const meta = {
  name: 'monthly-friction-retro',
  description: 'Monthly friction-mining retrospective: transcripts + code-reviews + docs/memory audit, compared against the prior month, with concrete escalation recommendations.',
  phases: [
    { title: 'Discover', detail: 'list transcripts and code-review files in the period' },
    { title: 'Mine transcripts', detail: 'one agent per transcript file for friction patterns' },
    { title: 'Mine review evidence', detail: 'one agent over the iteration folders for recurring violations' },
    { title: 'Audit docs/memory', detail: 'inventory current coverage to detect drift / find gaps' },
    { title: 'Synthesize', detail: 'cluster, compare to prior, propose escalations' },
    { title: 'Land report', detail: 'write the retro file and conditionally append to log.md' },
  ],
}

const os = require('os')
const path = require('path')

const PERIOD = (args && args.period_label) || 'unknown-period'
const PROJECT_NAME = process.env.PROJECT_NAME || 'the project'
// The dashified project path Claude Code uses to key transcripts under
// ~/.claude/projects (e.g. an absolute path like /Users/you/proj becomes
// -Users-you-proj). Override via CLAUDE_PROJECT_SLUG.
const PROJECT_SLUG = process.env.CLAUDE_PROJECT_SLUG || '<your-project-slug>'
const SHARED_DOCS = process.env.SHARED_DOCS_DIR || path.join(os.homedir(), 'karpathy-knowledge-base-example', 'docs')
const TRANSCRIPT_DIR = path.join(os.homedir(), '.claude', 'projects', PROJECT_SLUG)
const ITERATIONS_DIR = path.join(SHARED_DOCS, 'iterations')
const RETRO_DIR = path.join(SHARED_DOCS, 'retrospectives')
// Optional: absent in the starter template. Reads are guarded by an existence
// check so the verdicts-mining step is skipped when this file does not exist.
const VERDICTS_LOG = path.join(SHARED_DOCS, 'review-verdicts.log')

phase('Discover')

const discovery = await agent(
  `Discover the friction-mining inputs for retrospective period "${PERIOD}".

Return a structured payload. Steps:

1. List transcripts at ${TRANSCRIPT_DIR}/*.jsonl. For each, capture the
   filename and the file's mtime via \`stat\`. Mark a transcript as "in_period"
   if its mtime is within the last 30 days. Return all of them anyway — the
   miner sub-agents will scope by date when reading.
2. List iteration folders at ${ITERATIONS_DIR}. For each, find any
   \`code-review-*.md\` or \`summary*.md\` modified in the last 30 days
   (\`find ... -mtime -30\`). Return the folder names with the changed files.
3. Read the most recent prior retrospective if one exists. Try
   ${RETRO_DIR}/*.md sorted descending, pick the lexicographically greatest
   filename whose period_label < "${PERIOD}". Return its path and a one-paragraph
   summary of its top themes.
4. Check ${VERDICTS_LOG} exists. If it does, return the line count and the
   most recent 20 entries verbatim. If not, return "no_log_yet".

Be terse — this is plumbing for the next phase, not analysis.`,
  {
    label: 'discover:inputs',
    phase: 'Discover',
    schema: {
      type: 'object',
      required: ['transcripts', 'iteration_changes', 'prior_retro', 'verdicts_log'],
      properties: {
        transcripts: {
          type: 'array',
          items: {
            type: 'object',
            required: ['filename', 'mtime', 'in_period', 'line_count'],
            properties: {
              filename: { type: 'string' },
              mtime: { type: 'string' },
              in_period: { type: 'boolean' },
              line_count: { type: 'number' },
            },
          },
        },
        iteration_changes: {
          type: 'array',
          items: {
            type: 'object',
            required: ['folder', 'changed_files'],
            properties: {
              folder: { type: 'string' },
              changed_files: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        prior_retro: {
          type: 'object',
          required: ['exists'],
          properties: {
            exists: { type: 'boolean' },
            path: { type: 'string' },
            period_label: { type: 'string' },
            top_themes_summary: { type: 'string' },
          },
        },
        verdicts_log: {
          type: 'object',
          required: ['present'],
          properties: {
            present: { type: 'boolean' },
            line_count: { type: 'number' },
            recent_entries: { type: 'string' },
          },
        },
      },
    },
    agentType: 'general-purpose',
  }
)

const transcriptsInPeriod = discovery.transcripts.filter((t) => t.in_period && t.line_count > 100)

if (transcriptsInPeriod.length === 0) {
  log(`No in-period transcripts with substantive content found for ${PERIOD}. Writing a minimal report and exiting.`)
}

phase('Mine transcripts')

const FRICTION_SCHEMA = {
  type: 'object',
  required: ['transcript', 'friction_patterns', 'summary'],
  properties: {
    transcript: { type: 'string' },
    friction_patterns: {
      type: 'array',
      items: {
        type: 'object',
        required: ['category', 'description', 'evidence', 'severity', 'frequency'],
        properties: {
          category: {
            type: 'string',
            enum: [
              'user_correction', 'repeated_mistake', 'workflow_violation',
              'standards_miss', 'stuck_loop', 'unnecessary_question',
              'over_explanation', 'tool_misuse', 'docs_gap', 'memory_miss',
              'commit_msg_issue', 'review_dodge', 'context_loss',
              'scope_creep', 'premature_completion', 'gate_skipped',
              'dispatch_brief_drift', 'other',
            ],
          },
          description: { type: 'string' },
          evidence: { type: 'string', description: 'Verbatim quote, under 300 chars, with rough location' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          frequency: { type: 'number' },
        },
      },
    },
    summary: { type: 'string', description: 'Under 150 words' },
  },
}

const minerPrompt = (file, mtime) => `Audit the Claude Code transcript at ${TRANSCRIPT_DIR}/${file} for friction patterns within the last 30 days.

The file is JSONL (one JSON object per line). Modified ${mtime}. Use targeted greps to find friction signals — do not try to read the whole file. Strategy:

1. \`wc -l\` and sample 5 random lines to understand structure.
2. Grep for user corrections, workflow skips, standards misses, stuck patterns, premature done, gate skips, dispatch brief drift. See category enum below.
3. For each promising match, Read with offset/limit to pull the surrounding ~50 lines.

Documented preferences (search for violations):
- Plan→Code→Review→Explain workflow from ${SHARED_DOCS}/development-workflow.md
- Six gates that override auto-mode (grilling answers, plan approval, visual checkpoint, per-slice commit, PR, merge)
- Phase 1 starts with grill-with-docs + plan-pointer verification + scope guard
- Phase 2 step 1 uses dispatch-coding-subagent skill; step 2 uses dispatch-review-subagent
- Visual checkpoint for UI slices before human approval
- TDD per the tdd skill with tdd-trace.md
- L.1 (no AI attribution), L.2 (no story refs in code), L.3 (subject ≤72), F.2/F.3 (Pydantic over dict), F.8 (full names), F.9 (modern typing)
- Memory hygiene: memories are pending standards graduation
- If the project has pre-commit hooks (e.g. <project-root>/scripts/), they may block L.2/F.9

Aim for 5-15 well-evidenced patterns per transcript. Better fewer with strong evidence than many vague ones. Quote under 300 chars.`

const transcriptFindings = transcriptsInPeriod.length > 0
  ? await parallel(
      transcriptsInPeriod.map((t) => () =>
        agent(minerPrompt(t.filename, t.mtime), {
          label: `mine:${t.filename.slice(0, 8)}`,
          phase: 'Mine transcripts',
          schema: FRICTION_SCHEMA,
          agentType: 'general-purpose',
        })
      )
    )
  : []

phase('Mine review evidence')

const REVIEW_SCHEMA = {
  type: 'object',
  required: ['recurring_violations', 'verdict_log_findings', 'summary'],
  properties: {
    recurring_violations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['rule_or_pattern', 'evidence_count', 'example', 'severity', 'root_cause_hypothesis'],
        properties: {
          rule_or_pattern: { type: 'string' },
          evidence_count: { type: 'number' },
          example: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          root_cause_hypothesis: { type: 'string' },
        },
      },
    },
    verdict_log_findings: {
      type: 'object',
      required: ['approved_with_must_count', 'rule_frequency'],
      properties: {
        approved_with_must_count: { type: 'number', description: 'Count of "APPROVED" verdicts where MUST>0 in the log within the period' },
        rule_frequency: { type: 'string', description: 'Free-text breakdown of which rules show up most in CHANGES_REQUESTED entries' },
      },
    },
    summary: { type: 'string' },
  },
}

const iterationFolders = discovery.iteration_changes.map((c) => c.folder).join(', ')
const verdictsLogPresent = discovery.verdicts_log && discovery.verdicts_log.present
if (!verdictsLogPresent) {
  log(`Verdicts log not found at ${VERDICTS_LOG} — skipping the verdicts-mining step.`)
}
const verdictsInstruction = verdictsLogPresent
  ? `Also analyze ${VERDICTS_LOG}: count "APPROVED" verdicts that still had MUST>0, and the rule frequency across all entries in the period.`
  : `There is no verdicts log in this project — skip the verdict-log analysis and return 0 for approved_with_must_count with "no verdicts log" as the rule_frequency.`
const reviewFindings = iterationFolders
  ? await agent(
      `Audit code-review evidence for ${PROJECT_NAME} for the ${PERIOD} retrospective.

Iteration folders with code-review/summary files changed in the last 30 days:
${iterationFolders || 'none'}

For each, read the code-review-*.md files (and summary*.md if changed). Track which standards rules get flagged repeatedly. The standards doc is at ${SHARED_DOCS}/review-coding-standards.md.

${verdictsInstruction}

Aim for 6-12 strong recurring patterns. Look especially for:
- The same MUST violation in 3+ different iteration reviews → systemic
- Patterns where the plan said one thing but the code did another
- Test-related complaints (missing tests, J.6 labels, mocked when shouldn't be)
- Dispatch-skill standing block items that got dropped (no-commit, L.2, F.8, F.9, F.2/F.3)
- Visual / UI gating failures
- Anything where review flagged a violation but it shipped anyway`,
      {
        label: 'mine:review-evidence',
        phase: 'Mine review evidence',
        schema: REVIEW_SCHEMA,
        agentType: 'general-purpose',
      }
    )
  : { recurring_violations: [], verdict_log_findings: { approved_with_must_count: 0, rule_frequency: 'no iterations changed' }, summary: 'No iteration changes in period.' }

phase('Audit docs/memory')

const docsAudit = await agent(
  `Inventory current canonical docs and memory state so the synthesis can detect drift vs prior retros and find new gaps.

Read (skim/grep liberally):
- ${path.join(os.homedir(), '.claude', 'CLAUDE.md')} (global user instructions, including Memory hygiene section)
- The project CLAUDE.md at <project-root>/CLAUDE.md (project instructions)
- ${SHARED_DOCS}/development-workflow.md (gates, scope guard, plan-pointer verify, visual checkpoint)
- ${SHARED_DOCS}/review-coding-standards.md (section headings, especially L.1-L.4 / F.2 / F.3 / F.8 / F.9 / J.6)
- ${SHARED_DOCS}/retrospectives/README.md
- ${path.join(os.homedir(), '.claude', 'skills', 'dispatch-coding-subagent', 'SKILL.md')} (standing block)
- ${path.join(os.homedir(), '.claude', 'skills', 'dispatch-review-subagent', 'SKILL.md')} (rule-application priorities)
- If the project has pre-commit hooks (e.g. <project-root>/scripts/ and <project-root>/.husky/), inspect them for the L.1/L.2/L.3/F.9 patterns they enforce
- Every memory file at ${path.join(os.homedir(), '.claude', 'projects', PROJECT_SLUG, 'memory')}/

Return:
- existing_coverage: which topics are covered where (terse).
- documentation_gaps: topics a senior engineer SHOULD have written but you did not find, OR vague mentions Claude would still trip on.
- memory_health: count of memories, oldest one's age, any that duplicate doc content.`,
  {
    label: 'audit:docs-and-memory',
    phase: 'Audit docs/memory',
    schema: {
      type: 'object',
      required: ['existing_coverage', 'documentation_gaps', 'memory_health'],
      properties: {
        existing_coverage: {
          type: 'array',
          items: {
            type: 'object',
            required: ['topic', 'covered_in', 'notes'],
            properties: {
              topic: { type: 'string' },
              covered_in: { type: 'string' },
              notes: { type: 'string' },
            },
          },
        },
        documentation_gaps: {
          type: 'array',
          items: {
            type: 'object',
            required: ['gap', 'why_it_matters', 'suggested_location'],
            properties: {
              gap: { type: 'string' },
              why_it_matters: { type: 'string' },
              suggested_location: { type: 'string' },
            },
          },
        },
        memory_health: {
          type: 'object',
          required: ['count', 'oldest_age_days', 'duplicates'],
          properties: {
            count: { type: 'number' },
            oldest_age_days: { type: 'number' },
            duplicates: { type: 'string', description: 'Any memory that now duplicates doc content' },
          },
        },
      },
    },
    agentType: 'general-purpose',
  }
)

phase('Synthesize')

const SYNTHESIS_SCHEMA = {
  type: 'object',
  required: ['period', 'themes', 'comparison_to_prior', 'top_actions', 'log_entry'],
  properties: {
    period: { type: 'string' },
    themes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['theme', 'status', 'evidence_summary', 'root_cause', 'recommendation', 'priority'],
        properties: {
          theme: { type: 'string' },
          status: {
            type: 'string',
            enum: ['new', 'still_bleeding', 'fixed', 'partially_fixed'],
          },
          evidence_summary: { type: 'string' },
          root_cause: { type: 'string' },
          recommendation: { type: 'string', description: 'Concrete next-rung action per the escalation ladder' },
          priority: { type: 'string', enum: ['P0', 'P1', 'P2'] },
        },
      },
    },
    comparison_to_prior: {
      type: 'string',
      description: 'One paragraph naming which prior themes resolved, which are still bleeding, which were displaced',
    },
    top_actions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['action', 'why', 'ladder_rung'],
        properties: {
          action: { type: 'string' },
          why: { type: 'string' },
          ladder_rung: { type: 'number', description: '1-6 per the escalation ladder in README.md' },
        },
      },
    },
    log_entry: {
      type: 'object',
      required: ['should_append', 'entry_text'],
      properties: {
        should_append: { type: 'boolean', description: 'true only when a new theme emerged or a still-bleeding theme warrants escalation' },
        entry_text: { type: 'string', description: 'If should_append, the exact line for log.md in the format ## [YYYY-MM-DD] process-change | title' },
      },
    },
  },
}

const transcriptJson = JSON.stringify(transcriptFindings.filter(Boolean), null, 2)
const reviewJson = JSON.stringify(reviewFindings, null, 2)
const docsJson = JSON.stringify(docsAudit, null, 2)
const priorJson = JSON.stringify(discovery.prior_retro, null, 2)
const verdictsJson = JSON.stringify(discovery.verdicts_log, null, 2)

const synthesis = await agent(
  `Synthesize the ${PERIOD} friction-mining retro for the team.

INPUTS:

Transcript friction findings (this period):
${transcriptJson}

Recurring code-review violations + verdict-log findings (this period):
${reviewJson}

Current docs / memory inventory:
${docsJson}

Prior retro (most recent before this one):
${priorJson}

Recent verdicts-log entries:
${verdictsJson}

YOUR JOB:

1. Cluster the friction patterns into 4-8 THEMES.
2. For each theme, mark status:
   - "new" = wasn't in the prior retro
   - "still_bleeding" = was in the prior retro and is still here
   - "partially_fixed" = was in the prior retro, frequency dropped but not gone
   - "fixed" = was in the prior retro, gone now
3. Recommend next-rung action per the escalation ladder in
   ${SHARED_DOCS}/retrospectives/README.md. Specifically for still_bleeding themes,
   walk one rung up from whatever was tried last time.
4. comparison_to_prior: one paragraph naming which prior themes resolved
   (with the intervention that probably fixed them), which are still
   bleeding (with the next escalation), which are new.
5. top_actions: 3-5 concrete things to do this week, ranked.
6. log_entry: should_append true only if a NEW theme emerged or a still-bleeding theme
   warrants escalation. If everything is fixed/quiet, should_append false.

Be brutally honest. If interventions from prior months didn't work, say so. If
the workflow is being followed but still producing weak output, say so.

Quote evidence under 200 chars. Reference iterations / transcripts / doc
sections by name.`,
  {
    label: 'synthesize:final-report',
    phase: 'Synthesize',
    schema: SYNTHESIS_SCHEMA,
    agentType: 'general-purpose',
  }
)

phase('Land report')

const landResult = await agent(
  `Land the ${PERIOD} retrospective report on disk.

Synthesis payload:
${JSON.stringify(synthesis, null, 2)}

Steps:

1. Write the report to ${RETRO_DIR}/${PERIOD}.md. Use this format:

\`\`\`markdown
---
period: ${PERIOD}
generated: <today's date in YYYY-MM-DD>
prior_retro: <synthesis.comparison_to_prior gives you the prior period; cite it or "none">
---

# Friction-mining retrospective — ${PERIOD}

## Comparison to prior

<synthesis.comparison_to_prior verbatim>

## Themes

<for each theme: H3 with theme name, then status badge line, evidence_summary, root_cause, recommendation, priority>

## Top actions

<numbered list from synthesis.top_actions, each with action / why / ladder rung>

## Verdict-log snapshot

<the recent_entries verbatim from the discovery payload, or "no log yet">
\`\`\`

2. If synthesis.log_entry.should_append is true, append the entry_text to
   ${SHARED_DOCS}/log.md. Today's date should be in the
   YYYY-MM-DD slot.

3. Return: { report_path, log_appended: bool, themes_count }`,
  {
    label: 'land:report',
    phase: 'Land report',
    schema: {
      type: 'object',
      required: ['report_path', 'log_appended', 'themes_count'],
      properties: {
        report_path: { type: 'string' },
        log_appended: { type: 'boolean' },
        themes_count: { type: 'number' },
      },
    },
    agentType: 'general-purpose',
  }
)

return {
  period: PERIOD,
  report: landResult.report_path,
  themes: landResult.themes_count,
  log_appended: landResult.log_appended,
  comparison: synthesis.comparison_to_prior,
  top_actions: synthesis.top_actions,
}
