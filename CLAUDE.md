# Agent Instructions — AcademiTok

Bulgarian rigorosity: discipline, precision, rigor. 🫡🇧🇬

## What this is

**AcademiTok**: a TikTok-style full-screen swipe feed of academic papers, set like an old
newspaper. One paper per viewport, rail of reactions, feed that learns from impressions and
dwell. Product brief: `PROMPT.md`. Full requirements: `SPEC.md`. Read the spec before touching
the feed.

## Non-negotiables

- One clipping per viewport. Snap deck, no panel heights, no duplicated slides to fake infinity.
- Every impression, dwell, like, save, hide and open-source event changes the ranker.
- Rotation is a bug: no repeated paper within a session page, no topic above 2 of 10.
- Newspaper, not a card grid: serif display, hairlines, caps kickers, one accent ink.
- Metadata and open access only. Never store or serve PDFs.
- No `any`, no unjustified casts, no new dependencies without a written reason.

## Stack and patterns

TanStack Start · Effect 4 · effect-native atoms · Drizzle/PGlite · Tailwind 4 tokens · Effect RPC.

| Need                 | Read                                                            |
| -------------------- | --------------------------------------------------------------- |
| Any state            | `docs/architecture/effect-native-atoms.md` (the only pattern)   |
| UI components        | `docs/design-system/rules.md` + `src/design-system/registry.ts` |
| New feature          | `docs/guides/adding-new-features.md`                            |
| Feature architecture | `docs/architecture/effect-simple-made-easy-mapping.md`          |
| Server runtime       | `src/routes/api/$.ts`                                           |
| Database             | `docs/guides/database-pglite.md`                                |
| Commits              | `docs/guides/versioncontrol.md`                                 |

Canonical implementations are marked with `Pattern:` headers — find them with
`ffgrep "Pattern: Context.Service"` etc.

Feed-specific map: contracts `src/api/paper-schema.ts`, ranking
`src/features/papers/recommendation.ts`, events `src/features/papers/reactions.ts`, persistence
`src/db/reader-state-repository.ts`, catalog `src/lib/openalex.ts`, UI
`src/routes/-index/app.tsx` + `src/design-system/components/{FeedDeck,PaperSlide}.tsx`.

## Philosophy

- **Root cause, not symptoms.** A repeated paper is a broken feed model, not a missing `Set`.
- **Minimal dependencies.** Standard library and what is installed. Each dep is a liability.
- **Long-term over clever.** Explicit, readable, deletable.
- **Every line justifies itself.** Delete more than you add.
- **Type safety is non-negotiable.** Effect Schema at boundaries, no `any` inland.
- **Tests verify behaviour.** Ranker, ingestion and contracts need tests before UI polish.
- **Docs explain why.** Code shows how.

## Workflow

1. Isolate: never work on `master`/`main`; branch per change (`docs/guides/versioncontrol.md`).
2. Read the spec section you are implementing; check `package.json` scripts first.
3. Implement in small coherent steps, following existing patterns, tests alongside.
4. `bun run validate` — or the narrower `bun run typecheck`, `lint`, `test:coverage`, `build`.
5. Commit in logical steps with real messages.
6. Update `SPEC.md` when behaviour or architecture changes.

## Avoid

- ❌ state mixing (`useState` for server data, `Effect.runPromise` in components)
- ❌ `className` or inline styles in route/feature code — design-system only
- ❌ design-system wrappers that are just a styled `div` (see the decision framework)
- ❌ vendoring code into the repo
- ❌ giant undifferentiated commits
- ❌ documentation that restates code

## Notes

Keep `MISTAKES.md` (my errors), `DESIRES.md` (missing context/tools), `LEARNINGS.md` (env facts)
current — no duplicates, and read them before starting.

## Definition of done

Pattern satisfied · behaviour tested · docs updated where architecture shifted · history clean ·
`bun run validate` green · no `any` · one state pattern throughout.

Ask yourself: _would this pass a Bulgarian rigorosity inspection?_ If no, keep working.
