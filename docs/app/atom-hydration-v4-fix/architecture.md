# Architecture

## Problem Boundary

The SSR pipeline renders `TodoList` on the server, while the client rehydrates using `@effect/atom-react` and serializable atoms. The registry expects serialized values to be available before atom nodes are created. Strict Mode double-render can create nodes before hydration logic runs, causing client snapshots to diverge from server snapshots.

## Design Decisions

- Use `Schema.toCodecJson` for AsyncResult serialization so JSON roundtrips decode into full AsyncResult values (with type ids).
- Hydrate serializable atoms before children render, and update existing nodes immediately when they already exist.
- Avoid Option-based handling for `Array.findFirstIndex` and use `number | undefined` semantics.

## Trade-offs

- Hydration now mutates registry state during render. This mirrors existing `setSerializable` behavior and is required to match server snapshots in Strict Mode.
- We rely on the AtomRegistry node internal `setValue` when a node already exists, because no public API updates a read-only atom value in-place.

## Alternatives Considered

- `useAtomInitialValues`: rejected because we only have serialized keys, not atom instances.
- Deferring hydration to `useEffect`: rejected because it runs after initial render, causing mismatches.
- Forcing a router-level `suppressHydrationWarning`: rejected because it masks real mismatches and does not align atom state.
