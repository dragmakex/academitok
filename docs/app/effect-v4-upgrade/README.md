# Effect v4 Upgrade Workflow

## Overview

This workflow defines a deterministic Smithers pipeline that upgrades this repository to `effect@4.0.0-beta.0` using Codex as the agent. It couples a focused upgrade prompt with a Tigerstyle review loop, so the changes are explicit, minimal, and repeatable.

## Why

- Effect v4 consolidates modules and changes service definitions (`ServiceMap.Service`), so a structured migration reduces regressions.
- Smithers makes the upgrade resumable and auditable with durable outputs.
- Tigerstyle review enforces consistency and explicitness throughout the migration.

## Usage

Run from the repo root:

```bash
bunx smithers run workflows/effect-v4-upgrade.tsx \
  --input '{"goal":"Upgrade effect to 4.0.0-beta.0"}'
```

## Requirements

- `codex` CLI available in PATH.
- `smithers-orchestrator` and `zod` installed (dev dependencies).

## Outputs

Smithers writes validated outputs to `workflows/effect-v4-upgrade.db` and captures:

- Upgrade assessment summary and targets.
- Implementation summary and test notes.
- Tigerstyle review results and remaining issues.

## Key Files

- `workflows/effect-v4-upgrade.tsx`
- `prompts/workflows/effect-v4-upgrade.md`
- `prompts/reviewers/TIGERSTYLE.md`

## Related Docs

- `docs/guides/effect-v4-migration.md`
- `docs/architecture/overview.md`
