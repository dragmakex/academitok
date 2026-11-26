# AcademiTok

AcademiTok is a full-screen, adaptive feed for academic papers. It pairs TikTok-style navigation—one paper per viewport, swipe or keyboard controls, and a reaction rail—with the typography of a print-era broadsheet.

The feed learns from impressions, dwell time, likes, saves, hides, and source opens. It ranks metadata from open sources, enforces diversity within each page, and links readers to the original source. AcademiTok never stores or serves PDFs.

## Product documents

- [`PROMPT.md`](./PROMPT.md) — product brief and delivery constraints
- [`SPEC.md`](./SPEC.md) — product, interaction, ranking, data, and testing requirements
- [`AGENTS.md`](./AGENTS.md) — repository architecture and working rules
- [`TASKS.md`](./TASKS.md) — ordered implementation queue

## Stack

- TanStack Start and React 19
- Effect 4, Effect RPC, and Effect-native atoms
- Drizzle with PGlite for local persistence
- Tailwind CSS 4 design tokens
- Vitest and Playwright

## Where the papers come from

The catalog is **OpenAlex metadata**: title, abstract, authors, venue, year, citation count,
open-access status and the publisher/DOI landing page. Requests are cached in the local catalog pool
for 24 hours, and a frozen seed edition keeps the deck readable when the source is unavailable.
AcademiTok stores and serves metadata only — no PDFs and no full text.

The whole clipping is the outbound link. When a reader taps **Read the paper**, they land on the
publisher or DOI page and use whatever access their institution, library or the publisher already
gives them. There is no AcademiTok login: a first-party cookie keeps this browser's likes, saves and
learned topic profile local to the device.

## Local development

Requirements: [Bun](https://bun.sh) and a Chromium browser for browser tests.

```bash
bun install
cp .env.example .env
bun run dev
```

Open <http://localhost:3000>. Reader state is persisted under `data/pglite-reader-state` by default.

Set `OPENALEX_MAILTO` in `.env` to identify catalog requests to OpenAlex's polite pool. PostHog, Sentry, and OpenTelemetry settings are optional; see the guides under [`docs/guides/`](./docs/guides/).

## Verification

```bash
bun run validate
```

The validation command runs type checks, linting, formatting and documentation checks, coverage tests, browser tests, a production build, and the bundle-size check.

Useful narrower commands:

```bash
bun run test:unit
bun run test:component
bun run test:visual
bun run typecheck
bun run lint
bun run build
```

## Architecture

Start with these repository guides before changing code:

- [Effect-native atom state](./docs/architecture/effect-native-atoms.md)
- [Feature architecture mapping](./docs/architecture/effect-simple-made-easy-mapping.md)
- [Design-system rules](./docs/design-system/rules.md)
- [Adding a feature](./docs/guides/adding-new-features.md)
- [PGlite persistence](./docs/guides/database-pglite.md)
- [Testing](./docs/guides/testing.md)

The main feed contracts live in `src/api/paper-schema.ts`, ranking in `src/features/papers/recommendation.ts`, reader events in `src/features/papers/reactions.ts`, persistence in `src/db/reader-state-repository.ts`, and the feed UI in `src/routes/-index/` and `src/design-system/components/`.
