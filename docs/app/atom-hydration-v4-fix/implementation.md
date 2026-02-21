# Implementation

## Hydration Logic

- `src/lib/atom-hydration.tsx` now preloads JSON-safe serialized values and eagerly updates existing atom nodes to avoid Strict Mode double-render mismatches.
- Existing node hydration uses the atom's `SerializableTypeId.decode` to restore full AsyncResult values.

## Serializable AsyncResult

- `src/routes/-index/atoms.tsx` wraps `AsyncResult.Schema` with `Schema.toCodecJson(...)` to ensure JSON roundtrips decode into AsyncResult objects (with type ids).

## Cache Update Semantics

- `src/routes/-index/atoms.tsx` replaces `Option.match` on `Array.findFirstIndex` with explicit `number | undefined` handling.

## Verification Notes

- Playwright: verified that SSR hydration does not emit hydration errors and that create/update flows render correctly.
- Curl: verified `/api/health` and `/api/todos` endpoints.
