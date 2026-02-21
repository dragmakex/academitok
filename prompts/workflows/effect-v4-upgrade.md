# Effect v4 Upgrade Prompt (Tigerstyle)

Goal: upgrade this repo to `effect@4.0.0-beta.0` with precise, explicit changes and minimal dependencies.

Principles:
- Consistency: follow existing patterns; change related code together.
- Explicitness: dependencies and effects must be visible; no hidden wiring.
- Density: one idea per line; remove dead code.
- Locality: keep related logic together.
- Fail fast: prefer guards over silent fallbacks.
- Immutability: prefer `const` and pure transforms.
- Type safety: no `any`, no unsafe casts without justification.

Effect v4 best practices (from effect-smol migration):
- Replace `Effect.Service` / `Effect.Tag` / `Context.Tag` with `ServiceMap.Service`.
- Define layers explicitly with `Layer.effect` and `Layer.provide`; no `dependencies` option.
- Prefer `yield*` for service access; avoid `Service.use` except for one-liners.
- Rename `Effect.catchAll` -> `Effect.catch`, `Effect.catchAllCause` -> `Effect.catchCause`.
- Replace `@effect/rpc/*` with `effect/unstable/rpc/*`.
- Replace `@effect/platform/*` Http modules with `effect/unstable/http/*` and `effect/unstable/httpapi/*`.
- Replace `@effect-atom/*` with `effect/unstable/reactivity` + `@effect/atom-react`.
- Types no longer subtypes of `Effect`: use `Ref.get`, `Deferred.await`, `Fiber.join`, or `.asEffect()` for Yieldables.
- Prefer layer composition over repeated `Effect.provide` calls.

Checklist:
- Update `package.json` to `effect@4.0.0-beta.0` and aligned `@effect/*` packages.
- Update imports and service definitions to v4 APIs.
- Update docs to reflect v4 migration and new workflow.
- Keep changes minimal; do not add dependencies unless required.
