---
name: Example Provider — gotchas
description: TEMPLATE — distilled non-obvious behaviours and traps for an external provider. Copy per real provider.
status: reference
topic: integrations
last_reviewed: 2026-06-25
---

# Example Provider — gotchas (TEMPLATE)

> **Template.** Copy this file to `integrations/<real-provider>/gotchas.md` and fill it in as
> you learn. Delete the guidance in italics. The value of this file is the stuff the
> provider's official docs *don't* tell you — record it the moment it costs you an hour.

## At a glance
- **What it is:** _one line — what this provider does for us (e.g. "payments", "auth", "email delivery")._
- **Environments:** _sandbox vs production base URLs; how they differ in behaviour, not just host._
- **Auth:** _token type, where it's set, rotation cadence, gotchas around expiry._
- **Owner / support channel:** _who to ask, where the status page is._

## Gotchas
_One entry per hard-won lesson. Keep them concrete and dated._

### The sandbox lies about `<field>`
_Symptom → cause → what to do. Example: "The sandbox returns `status: active` for records
that production returns as `pending`. Don't assert on sandbox status in integration tests;
assert on the fields that are stable across environments." (learned 2026-06-20)_

### `<endpoint>` is not idempotent
_Example: "Re-POSTing the same request creates a duplicate rather than returning the existing
record. Guard with an idempotency key / a pre-check." (learned 2026-06-24)_

### Rate limits are per-token, not per-account
_Example: "429s are counted per API token, so parallel workers sharing a token throttle each
other. Give each worker its own token or add a shared limiter."_

## Data mapping
_How the provider's fields map onto our domain model. Note anything lossy or surprising._

| Provider field | Our field | Notes |
|---|---|---|
| `example_id` | `external_id` | Opaque string, not a UUID — store as text |

## Known-good request/response snapshots
_Link to recorded fixtures used in tests, or paste a minimal example. Keep raw API dumps in
`docs/<provider>_api/`, not here._

## Open questions / to verify
- [ ] _Anything you suspect but haven't confirmed. Promote to a gotcha once verified._
