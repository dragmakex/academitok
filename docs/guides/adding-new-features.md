# Adding New Features

Use the existing paper feature as the canonical implementation. Copy its boundaries and patterns,
not its product-specific behavior or newspaper presentation.

## Feature anatomy

A feature normally reaches these places:

- `src/api/[feature]-schema.ts` — Effect Schema contracts at the boundary
- `src/api/domain-rpc.ts` — RPC methods
- `src/features/[feature]/application.ts` — orchestration and services
- `src/features/[feature]/*.test.ts` — behavior tests
- `src/routes/api/-lib/[feature]-rpc-live.ts` — transport handlers
- `src/routes/[route]/atoms.tsx` — Effect-native client state
- `src/design-system/` — reusable UI registered in `registry.ts`
- `src/routes/[route]/` — route composition without styling

Only add a layer when the behavior needs it. Pure scoring or projection logic can remain a plain
module beside `application.ts`.

## Implementation order

1. Define request, response, and error contracts with Effect Schema.
2. Add the RPC contract in `src/api/domain-rpc.ts`.
3. Implement and test domain behavior in `src/features/`.
4. Bind handlers in `src/routes/api/-lib/` and compose their layer in `src/routes/api/$.ts`.
5. Expose server data and mutations through the route's existing atom runtime.
6. Build reusable UI in `src/design-system/`, register it, then compose it in the route.
7. Run `bun run validate`.

## Canonical source

Study the smallest matching implementation:

| Concern                    | Canonical source                         |
| -------------------------- | ---------------------------------------- |
| Contracts                  | `src/api/paper-schema.ts`                |
| RPC composition            | `src/api/domain-rpc.ts`                  |
| Application service        | `src/features/papers/application.ts`     |
| Pure ranking logic         | `src/features/papers/recommendation.ts`  |
| Server handlers            | `src/routes/api/-lib/papers-rpc-live.ts` |
| Effect atoms               | `src/routes/-index/atoms.tsx`            |
| Route composition          | `src/routes/-index/app.tsx`              |
| Design-system registration | `src/design-system/registry.ts`          |

Search for `Pattern:` headers when choosing an implementation shape.

## State rules

Server data belongs in Effect atoms. Extend the existing route runtime instead of creating one
runtime per feature:

```ts
export const saveProjectAtom = runtime.fn<SaveProjectInput>()(
  Effect.fnUntraced(function*(input, get) {
    const api = yield* Api
    const snapshot = yield* api.saveProject(input)
    get.set(projectSnapshotAtom, { _tag: "Replace", value: snapshot })
    return snapshot
  }),
)
```

Components call mutation setters synchronously through `useAtomSet`. Do not call
`Effect.runPromise` in components, and do not mirror server state in React `useState`.

## UI rules

Route and feature files compose registered design-system components. They do not add `className`,
inline styles, or one-off styled wrappers. Read `docs/design-system/rules.md` before adding UI.

## Verification

Tests should prove behavior at the narrowest useful boundary:

- pure logic tests for scoring, projections, and validation;
- application tests for orchestration and persistence behavior;
- RPC tests only when handler mapping adds behavior;
- browser tests for user-visible interaction and accessibility.

Run `bun run validate` before committing.
