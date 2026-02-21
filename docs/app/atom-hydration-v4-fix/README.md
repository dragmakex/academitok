# Atom Hydration v4 Fix

## Overview

This change repairs SSR-to-client atom hydration for the Todo route after the Effect v4 migration. It ensures client hydration consumes the server-provided atom snapshot without React hydration mismatches, and it restores safe cache updates after `Array.findFirstIndex` changed return type in Effect v4.

## Why

- React Strict Mode double-render can create atom nodes before hydration state is applied, leading to mismatched server vs client snapshots and React hydration recovery.
- Effect v4 serializable atoms require JSON-safe codecs; AsyncResult defaults are not JSON-roundtrip safe without a JSON codec.
- Effect v4 `Array.findFirstIndex` now returns `number | undefined`, so Option-based handling throws at runtime.

## Scope

- Atom hydration logic for serializable atoms.
- Todos atom cache update logic in `src/routes/-index/atoms.tsx`.
- JSON-safe encoding for hydrated AsyncResult values.

## Usage Example

```tsx
import { HydrationBoundary } from "@/lib/atom-hydration"

function AppWrapper() {
  const dehydrated = Route.useLoaderData()
  return (
    <HydrationBoundary state={[dehydrated]}>
      <App />
    </HydrationBoundary>
  )
}
```

## Key Files

- `src/lib/atom-hydration.tsx`
- `src/routes/-index/atoms.tsx`
- `src/lib/atom-utils.ts`

## Related Docs

- `docs/architecture/overview.md`
- `docs/guides/effect-v4-migration.md`
