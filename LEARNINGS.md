- 2026-04-11: `oxlint` panics when linting files outside the repository root (`path is expected to be under the root`). Keep lint fixtures under `cwd()` for rule tests.
- 2026-05-09: `bun run build` works after `bun install`, but the current TanStack Start/Nitro server path still serves an empty renderer template in this repo while `vite dev` serves the interactive client correctly. Verify both dev and production entry behavior before depending on Start SSR here.
- 2026-05-09: The paper feed now persists reader reactions in `./data/pglite-reader-state` by default, so browser/prod checks can inherit earlier likes, saves, views, and recommendation signals across server restarts unless that directory is cleared.
- 2026-05-09: OpenAlex catalog requests are serialized and cached in-process for 24 hours per topic/order; set `OPENALEX_MAILTO` so requests enter the provider's identified polite pool.
- 2026-05-10: `bun run test:coverage` selects by path argument, so a test under `src/routes/` (e.g. `src/routes/__root.test.tsx`) never runs in `validate`; only `src/lib`, `src/api`, `src/features`, `src/routes/api/**` and top-level `src/*.test.ts` are covered.
- 2026-06-13: `TypeError: Response body object should not be disturbed or locked` (undici) crashes `vite dev` when the browser aborts a document request mid-stream — e.g. clicking a sign-out that calls `globalThis.location.assign` while RPC traffic is in flight. It is dev-only: the built Nitro server handles the same flow. Reproduce in `build` + `preview` before chasing it in source.
- 2026-06-13: A TanStack Start file route can carry server-only logic as `server: { handlers: { GET: () => Response } }`; the module is then absent from the client graph and `beforeLoad`/`loader` stay client-safe. Use it for actions that set `Set-Cookie` on a document navigation.
- 2026-06-13: `TanStackDevtools` in `src/routes/__root.tsx` was mounted behind `isClient` only, so the launcher badge shipped into the production bundle and sat on top of the deck's bottom action bar. Gate every dev-only surface on `import.meta.env.DEV && isClient`; otherwise it also poisons screenshots and every visual critique.
- 2026-06-13: A Tailwind `line-clamp-*` utility loses to a later `block` on the same element (equal specificity, source order decides), so a clamped teaser silently grows to many lines and ragged list heights follow. Drop `block` and let the clamp own the display, or make the parent `flex flex-col`.

## 2026-06-13 — a flex child centred with `justify-center` loses its head

`justify-content: center` inside a scroll container pushes overflowing content
past the _top_ edge, where it cannot be scrolled back into view. A long abstract
in the deck silently lost its first lines. `margin: auto` on the child centres
when it fits and keeps the whole block reachable when it does not.

## 2026-06-13 — X's ranking weights are ratios on probabilities, not signal counts

`xai-org/x-algorithm` (`home-mixer/params/param.rs`) publishes like 0.708,
open-link 0.2, dwell 0.05, continuous dwell 0.0075/s, click-dwell 0.385/s,
not-dwelled −0.02 and not-interested −53.07. Those multiply _predicted
probabilities_; a feed that multiplies observed signal strength can only borrow
the ordering. Also worth knowing before copying them: X lets a 30-second dwell
(0.05 + 0.225) outrank a link click (0.2), which is the opposite of what a reader
asked for here — so the ladder caps passive dwell below the price of opening the
paper and says so in the source.
A CSS `filter: blur()` on a full-bleed background div fades its own edges, so
pair it with a slight `scale(105%)`; otherwise the viewport shows a pale frame on
every side that reads as a bug.

Blur radius is a budget, not a taste: features smaller than roughly twice the
radius vanish. At 12px the drawn broadsheet became flat grey, at 4–5px the column
gutters, headline bars and halftone block survive as structure. Choose the radius
from the smallest feature you need the reader to feel.

Text columns inside a link are legal and useful: `md:columns-2` on a paragraph
inside `<a>` gives a real broadsheet measure without splitting the anchor.

Onboarding in this app is three pages of five picks and only submits on the third
page's "Print edition" button — browser automation that clicks "Next" twice and
stops sits forever on the gate.
