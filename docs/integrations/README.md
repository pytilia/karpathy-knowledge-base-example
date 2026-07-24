---
name: Integrations index
description: How third-party provider knowledge is captured — one distilled gotchas.md per provider.
status: active
topic: integrations
last_reviewed: 2026-06-25
---

# Integrations

One folder per external provider you integrate with. Each folder holds a **`gotchas.md`** — a
distilled, hard-won list of the non-obvious behaviours, edge cases, and traps that the
provider's own docs don't tell you. This is where "we learned the sandbox lies about X"
lives, so the next person (or agent) doesn't re-learn it the hard way.

- Raw, immutable API references (vendor PDFs, OpenAPI dumps) go in a sibling `docs/<provider>_api/` folder — inputs, not distillations.
- The distillation (`gotchas.md`) is the durable artifact. Iteration summaries and ADRs link to it.
- A memory entry is the holding pen for a brand-new gotcha before it's characterised enough to write here.

See [`example-provider/gotchas.md`](example-provider/gotchas.md) for the template shape.
