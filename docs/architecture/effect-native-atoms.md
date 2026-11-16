# Effect-Native Atoms Pattern

## Intent

Effect atoms are the single client-state pattern in this codebase. They keep RPC dependencies,
serialization, mutations, and React bindings inside one Effect runtime without leaking
`Effect.runPromise` into components.

**Pattern header to search for:** `Pattern: Effect-native Atoms (React)`

## Boundaries

Use Effect atoms for server data, server mutations, SSR hydration, and derived views. React
`useState` is allowed only for local presentation state that does not duplicate server data.

The canonical implementation is `src/routes/-index/atoms.tsx`.

## Runtime and API service

Wrap the RPC client in one service and provide it to one route runtime:

```ts
class Api extends Context.Service<Api>()("@app/index/Api", {
  make: Effect.gen(function*() {
    const { rpc } = yield* ApiClient
    return {
      snapshot: (request: FeedRequest) => rpc.papers_snapshot({ request }),
      react: (input: ReactToPaperInput) => rpc.papers_react({ input }),
    } as const
  }),
}) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(ApiClient.layer),
  )
}

export const runtime = Atom.runtime(Api.layer)
```

Do not create a runtime per mutation or feature. Add methods to the existing API service when the
state shares the route lifecycle.

## Serializable remote state

Remote atoms return `AsyncResult` and use `serializable` when they participate in hydration:

```ts
const snapshotRemoteAtom = runtime
  .atom(Effect.gen(function*() {
    const api = yield* Api
    return yield* api.snapshot({ query: defaultQuery, cursor: null })
  }))
  .pipe(
    serializable({
      key: "@app/index/paper-feed",
      schema: Schema.toCodecJson(FeedSnapshotAsyncResultSchema),
    }),
  )
```

Serialization keys are stable identities. Changing one invalidates dehydrated state.

## Mutations

Mutations use `runtime.fn()` and update the canonical atom through the function context:

```ts
export const reactToPaperAtom = runtime.fn<ReactToPaperInput>()(
  Effect.fnUntraced(function*(input, get) {
    const api = yield* Api
    const result = yield* api.react(input)
    const current = get(dashboardSnapshotAtom)

    if (current._tag === "Success") {
      get.set(dashboardSnapshotAtom, {
        _tag: "Replace",
        value: updateReaction(current.value, result),
      })
    }

    return result
  }),
)
```

Keep non-trivial transformations in a pure helper and test them. The atom owns coordination, not
business rules.

## React usage

Components read with `useAtomValue` and obtain synchronous mutation setters with `useAtomSet`:

```ts
const snapshot = useAtomValue(dashboardSnapshotAtom)
const reactToPaper = useAtomSet(reactToPaperAtom)

const onLike = () => reactToPaper(input)
```

Handle `Initial`, `Success`, and `Failure` states explicitly. The `waiting` flag represents
revalidation while an earlier value remains available.

## Rules

- No `Effect.runPromise` in components.
- No manual fetch plus `useState` for server data.
- No duplicate atom runtimes for related state.
- Mutations update or refresh the canonical atom after success.
- Hydrated atoms use an Effect Schema codec and a stable key.
- Analytics and browser side effects remain at explicit mutation or interaction boundaries.

## Files to study

- `src/routes/-index/atoms.tsx` — runtime, remote state, mutations, and batching
- `src/routes/-index/app.tsx` — React bindings
- `src/lib/atom-hydration.tsx` — SSR hydration
- `src/api/api-client.ts` — RPC client layer

## Verification

Run `bun run typecheck`, the relevant unit or browser tests, then `bun run validate` before
committing.
