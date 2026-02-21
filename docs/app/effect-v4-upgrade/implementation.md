# Implementation

## Workflow

- `workflows/effect-v4-upgrade.tsx` defines the Smithers workflow.
- The workflow uses `createSmithers` with Zod schemas to validate outputs.
- A `Ralph` loop gates implementation on Tigerstyle review approval.

## Prompts

- `prompts/workflows/effect-v4-upgrade.md` contains Effect v4 best practices and migration checklist.
- `prompts/reviewers/TIGERSTYLE.md` enforces explicitness and consistency in review.

## Data Storage

- Smithers stores outputs in `workflows/effect-v4-upgrade.db`.
- The database file is ignored in `.gitignore` to avoid committing run artifacts.

## Integration Points

- `docs/guides/effect-v4-migration.md` captures migration guidance for maintainers.
- The workflow is designed to be rerun as Effect beta APIs evolve.
