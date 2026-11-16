# AcademiTok — Agent Prompt

## Start here: you are executing a work queue

Open `TASKS.md` and implement **the first unchecked task**. Implement only that task.
Then `bun run validate`, commit, and tick the box. If the task is already satisfied,
tick it with the satisfying commit and take the next one.

Do not audit the repository, do not summarise what P0 already does, and never answer
"already implemented, no changes" — that answer is a loop with no exit. If every box is
checked, print `QUEUE EMPTY` and stop.

You are building **AcademiTok**: a TikTok-style scroll feed for academic papers, rendered as a
print-era broadsheet. Same interaction model as TikTok — one paper per full screen, swipe/arrow to
advance, rail of actions — but the visual language is an old newspaper: masthead, hairlines, serif
display headlines, drop caps, datelines, vermilion stamps.

## Non-negotiables

- **One paper per viewport.** No page scroll, no 78vh panel. Snap-scroll deck, exactly one clipping
  visible at rest.
- **The feed learns.** Every impression, dwell, like, save, hide and open-source event updates
  topic/author affinity with time decay and feeds the next page. No static sort, no repeating the
  same ordered list.
- **Diversity is enforced.** Dedupe near-identical papers, cap per-topic share per page (≤2 of 10),
  reserve ~15% of each page for exploration.
- **Newspaper, not "newspaper theme".** Set type like a broadsheet: measure ≈ 60ch, ragged-right
  serif body, letterspaced small caps kickers, hairline rules, one accent ink. No gradients, no
  glassmorphism, no rounded cards on glass.
- **Metadata and open access only.** Never store or serve PDFs. Link out. Respect source rate
  limits and licenses.

## Engineering constraints (this repo)

- TanStack Start + Effect 4 + Effect-native atoms + Drizzle/PGlite + Tailwind 4 tokens.
- All state through effect atoms; no `useState` for server data, no `Effect.runPromise` in components.
- UI only via `src/design-system/` components registered in `registry.ts`; no `className` or inline
  style in route/feature code (see `docs/design-system/rules.md`).
- Contracts in Effect Schema (`src/api/paper-schema.ts`), transported over the existing RPC pattern.
- No new dependencies without a written justification. System serif stack only in P0.
- Tests accompany logic. `bun run validate` must pass.

## Definition of done

One full-screen clipping per viewport; next/previous by swipe, arrow keys, and buttons; impression
and dwell tracked; ranker updated from those events; next page has no duplicates and no topic
monopolies; keyboard and screen-reader usable; `bun run validate` green.

Full requirements: `SPEC.md`. Working rules: `AGENTS.md`.
