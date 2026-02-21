# Architecture

## Goal

Provide a deterministic, resumable workflow to migrate this repository to Effect v4 beta while enforcing Tigerstyle quality gates.

## Design Decisions

- Use Smithers JSX workflow for deterministic, durable execution.
- Use a `Ralph` loop to iterate implementation and review until approved.
- Use Codex agent with `workspace-write` sandbox to keep edits scoped to the repo.
- Keep migration guidance in a dedicated prompt file so updates are centralized.

## Trade-offs

- Smithers adds dev-time dependencies but keeps production runtime unchanged.
- A looped review can take more iterations but reduces regressions.
- Using `effect/unstable/*` modules reflects v4 beta reality; stable APIs may change.

## Alternatives Considered

- Manual migration without Smithers: faster one-off but not resumable.
- One-shot agent run without review: higher risk of regressions.

## Constraints

- Minimal dependencies.
- Type-safe changes only; no `any` or unsafe assertions without reason.
- Docs updated to reflect v4 migration guidance.
