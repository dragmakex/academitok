# TASKS — execution queue

Work top to bottom. Take the **first unchecked task only**, implement it, run
`bun run validate`, commit, then tick the box. One box per run. Never re-audit the whole
repo and never report "already implemented" — if a task is already satisfied, tick it with
the commit that satisfies it and take the next one, but never tick a box you did not verify
against code.

Source of truth for requirements: `SPEC.md`. If a task conflicts with the spec, stop and
write the conflict at the bottom instead of guessing.

---

## P1 leftover

- [x] **1. Persisted feed session state.** SPEC §16 remaining work: the cursor carries the
      session's seen ids, so a client can desynchronise from the server's idea of the session.
      Move it to a `feed_sessions` row (id, reader_id, seen paper ids, cursor, updated_at) with
      a TTL sweep. Accept: two `feed.next` calls with the same session id never repeat a paper
      even if the client passes a stale cursor; a fresh session id starts clean.
      — `41d1119`

- [x] **20. Anonymous reader cookie.** SPEC §17.1 settles `reader_id` on "anonymous cookie +
      `reader_id` in state, no login", but `src/db/reader-state-repository.ts` writes and reads the
      `reader_id` column as one module constant (`singletonId = "singleton"`, 42 uses) while the
      schema already carries `reader_id` on `impressions`, `reactions` and `feed_sessions` — so every
      visitor shares one reading history: one reader's saves, likes, hides, impressions, profile and
      feed-session seen-ids are handed to the next, the §16 session dedupe cannot tell two readers
      apart, and the desk and `/saved` show somebody else's clippings. Add one `ReaderId` Context
      service provided once per request from a first-party cookie (read via an `RpcMiddleware` beside
      the existing `RpcLogger`, name and id validation in one pure exported helper: `[A-Za-z0-9-]{8,64}`,
      everything else ignored rather than stored), have the repository replace the constant with that
      service, and have the client set the cookie from a generated id when the browser has none (no
      `document` on the server). A request with no cookie still resolves to `"singleton"` so offline
      scripts and existing tests keep their single-row behaviour. No login, no account model, no
      schema column, ranking, RPC contract or PostHog change.
      Accept: two reader ids keep separate saved sets, so a save under one is absent under the other;
      two `feed.next` calls with the same session id under different reader ids do not share seen
      papers; a request without the cookie resolves to `"singleton"` and a garbage cookie value is
      ignored instead of written; the cookie-name and id parser is unit-tested, and a repository test
      proves the two-reader separation.

- [x] **35. The 14-day seen filter and the `again` label.** SPEC §8.1 step 5 says a paper
      impressed in the last 14 days returns "only if score is in the top 3% and the pool is
      exhausted (labelled 'again')", but `buildFeedPage` in `src/features/papers/recommendation.ts`
      filters only session-seen ids, so a reader who stops at nine clippings on Monday is served
      yesterday's page on Tuesday: yesterday's papers rank on the affinity they just earned, take
      the top slots and push unseen work off the page, and nothing marks the repeat because
      `FeedItem` has no field for it. Add one pure exported `recentPaperIds` helper beside
      `buildFeedItems` over the reader's `view` reactions and an injected `now`, returning the ids
      viewed inside the 14-day window; drop those papers from the ranked candidates in
      `getPaperFeedSnapshot`; when the fresh candidates cannot fill a page of ten, refill the
      remaining slots from repeats inside the top 3% of the ranked list and mark them `again: true`
      (a new `again` boolean on `FeedItem`, carried through `buildFeedItems`); let `PaperSlide`
      print `Again` in the kicker line when it is set. No new dependency, no weight change, no RPC
      procedure, persistence or PostHog payload change, and the one-clipping-per-viewport snap is
      untouched.
      Accept: a paper viewed 3 days before the injected clock is absent from the next page while an
      unviewed paper in the same beat is present; a paper viewed 15 days before the injected clock
      ranks as fresh with `again: false`; a six-paper fresh pool on a ten-slot page is refilled with
      four repeats from the top 3% of the ranked list, each carrying `again: true`, and the slide
      renders `Again`; a repeat whose score sits outside that top 3% never fills an exhausted slot;
      the page still holds no duplicate ids and no topic above 2 of 10; the helper is unit-tested
      with an injected clock and the filter is asserted from the real `getPaperFeedSnapshot`.
      — `dbe2ecd`

## P2 — breadth

- [x] **2. `/saved` route.** SPEC §5: saved clippings as a static, filterable list, not a
      deck. Reuse the clipping component in a compact variant; no new design language. Accept:
      a saved paper appears there after a save and disappears after unsave; empty state reads
      as a broadsheet notice, not a spinner.
      — `70caa4a`
- [x] **3. `/paper/$id` permalink.** SPEC §5: canonical page per paper with the clipping
      anatomy, full metadata and a copyable citation (authors, year, title, venue, DOI or URL).
      Accept: URL renders server-side for a known id, unknown id returns the not-found notice,
      citation copies to the clipboard, and the deck's permalink control reaches it.
      — `e3d60a1`
- [x] **4. Saved-collection export (BibTeX).** SPEC §14: generate `.bib` from the saved
      set in the repository layer, one `@article` per paper, DOIs as `doi`, stable keys.
      Accept: a 3-paper fixture yields 3 parseable entries with stable keys across runs; no
      network calls.
      — `608bb76`
- [x] **5. Archival-drift metric on `feed.next`.** SPEC §17.3 keeps citation count as a quality
      signal on the condition that we measure whether the feed feels archival — there is no number
      for that today. Report the median publication year of each returned page as a property of the
      existing `feed.next` feed-health event, computed by a pure helper so it can be tested without
      PostHog. Measurement only: ranking output must not change. Accept: years 2019/2022/2024 report
      2022, even-sized pages average the two middle years, and the ranked page for a fixed seed is
      identical before and after.
      — `0cf58b2`
- [x] **6. `?` shortcut sheet.** SPEC §5.2 lists `?` as the last unbuilt row of the keyboard
      table: a sheet that names every binding so the deck is learnable without reading the spec.
      Open it on `?`, close on `?`/`Esc`, list the bindings from one shared table the key handler
      also reads so the sheet cannot drift from behaviour, and trap focus like the desk drawer.
      Accept: `?` opens and `Esc` closes the sheet; it lists every binding the handler implements
      and nothing it does not; each row's key text comes from the same source as the handler; the
      sheet is reachable and dismissable by keyboard alone with focus returning to where it left.
      — `46418df`
- [x] **10. Source politeness guard ahead of the P2 sources.** SPEC §7 requires, for every source,
      exponential backoff (1s → 8s, 3 tries), a hard 10s timeout and a circuit break of 15 minutes
      after 3 consecutive errors. `src/lib/openalex.ts` has only the timeout and a serial request
      queue, so the first arXiv/Crossref client would be written against a client with no backoff
      and no breaker — the reason §7 lists a second source before those entries unblock. Add one
      small guard module beside the catalog client holding the attempt schedule and the breaker
      state machine, with time injected so it is testable, and use it to wrap the OpenAlex request
      instead of the bare `fetch`. No new source, no dependency, no ranking, RPC contract or
      PostHog change. Accept: attempt delays double from 1s and are capped at 8s across three
      attempts; three consecutive failures open the breaker so a call inside 15 minutes fails
      without a fetch, and a single success resets the streak; an upstream failure still falls back
      to the frozen seed edition; the guard is unit-tested with injected clock and fake request.
      — `aca77a9`
- [x] **12. Map source concepts onto the beats.** SPEC §17.2 keeps the fixed nine beats only on the
      condition that source concepts are mapped onto them, but `detectTopics` reads title and
      abstract keywords alone and files every miss under `Education`, while OpenAlex already ships
      concept metadata the mapper throws away — so a quantum-mechanics paper with no beat keyword
      spends an education slot, earns education affinity and counts as education in the §8.4 topic
      mix. Add a pure `conceptTopics` helper in `src/lib/topic-beats.ts` mapping OpenAlex concept
      names onto the nine beats, and let `detectTopics` fall back to it before the `Education`
      fallback. Keyword matches keep precedence, `matchedTopics` stays as is, and no source,
      dependency, RPC contract or PostHog payload changes. Accept: text with no beat keyword but
      concepts naming "Quantum mechanics" files under `Physics`; a keyword beat plus a conflicting
      concept keeps the keyword beat; text and concepts matching nothing still reports `Education`;
      the helper and the fallback order are unit-tested.
      — `39596ac`

- [x] **14. Impression retention sweep.** SPEC §6 sets retention at 90 days for impressions and
      forever for reactions, but the only TTL in the repository is `sweepFeedSessions` — impressions
      are deleted only by the one-off `reader_state` migration, so a row per armed slide accumulates
      without bound and the 14-day seen-filter keeps walking rows nobody may read again. Add a pure
      `impressionCutoff` helper beside `feedSessionTtlMs` returning the 90-day boundary, and delete
      impressions older than it in the same sweep the feed request already runs, leaving reactions
      untouched. No ranking, RPC contract, schema or PostHog change. Accept: an impression shown 91
      days before the injected clock is gone after a sweep while one shown 89 days before survives;
      reactions of any age survive; two sweeps in a row delete nothing the second time; the cutoff
      helper is unit-tested.
      — `f284725`

- [x] **18. Serve the feed from the stored catalog pool.** SPEC §16 names this as the remaining P1
      work: "persist the OpenAlex catalog in `papers` instead of refetching per page". `savePapers`
      already writes the pool, but `resolveCatalog` in `src/features/papers/application.ts` still
      calls OpenAlex on every `feed.next` and never reads the rows back — so ten swipes are ten
      upstream requests, against §7's cached-response rule, §15's politeness rule and §11's warm p95
      budget, and the 24-hour refresh in §6 has nothing to refresh. Add a repository read of `papers`
      rows fetched within the 24-hour TTL, export a pure `poolCutoff` boundary beside
      `impressionCutoff` in `src/db/reader-state-repository.ts`, and let `resolveCatalog` rank the
      stored pool when it holds at least a page times three (`10 × 3`) papers for the requested beat,
      fetching and storing only otherwise; the frozen seed edition stays the fallback when the pool
      is empty and upstream fails. No ranking, RPC contract, schema or PostHog change. Accept: two
      `feed.next` calls inside the TTL window make one upstream request while a pool fetched two days
      before the injected clock makes a fresh one; a pool with fewer than 30 papers for the requested
      beat still refreshes; an empty pool plus a failing upstream still serves the offline edition;
      the TTL boundary helper is unit-tested.
      — `cb77936`

- [x] **23. Serve the saved-collection BibTeX.** SPEC §14 and the P2 line "saved-collection
      export (BibTeX)" are only half-built: `formatBibtex` and `getSavedBibtex` sit in
      `src/features/papers/application.ts`, but nothing calls `getSavedBibtex` — no route, no
      control — so a reader cannot obtain the `.bib` for the clippings they saved and the P2
      feature is unreachable from the app. Add one `GET /api/saved.bib` HTTP route beside
      `HealthRoute` in `src/routes/api/$.ts` that resolves the request's `ReaderId` from the cookie
      with the same `readerIdFromCookieHeader` the RPC middleware uses, runs `getSavedBibtex`, and
      answers as an attachment named `academitok-saved.bib`; add a `LinkButton`
      export control in the `/saved` header beside "Back to the edition", rendered only when the
      morgue file holds clippings. No new dependency, no route file, no RPC contract, ranking or
      PostHog change — `formatBibtex` stays as it is.
      Accept: `GET /api/saved.bib` answers with exactly the `getSavedBibtex` body and an attachment
      filename; a three-paper saved set parses as three `@article` entries with stable keys; the
      route is exported and merged into `AllRoutes`, and a request without the cookie resolves to
      the singleton reader; an empty saved set answers an empty body, never a 500; `/saved` shows
      the export control when clippings exist and hides it when the morgue file is empty; a test
      asserts the route registration, the attachment headers and the body from the real handler.
      — `1ea7eaf`

- [x] **27. Near-duplicate title collapse in the catalog.** SPEC §7's ingestion flow requires papers to
      be upserted "by DOI, dedupe by normalised title (Jaccard > 0.9)" and §13 lists "title
      near-duplicate collapse" as an ingestion test, but `dedupeByTitle` in `src/lib/openalex.ts` keys on
      `paper.title.toLowerCase()` — exact identity only — so a DOI-less preprint and its published
      version, or the same work re-served with a changed subtitle, capitalisation or punctuation, both
      land in the pool, take two of the ten page slots and pay twice into the ≤2-per-topic cap that §8.1
      sets as a zero duplicate rate. Replace the exact-key filter with one pure exported
      `collapseTitleDuplicates` helper (normalise a title to lowercase alphanumeric tokens, compare the
      two token sets by Jaccard similarity, drop a paper whose title matches an already-kept title above
      0.9) and call it where `dedupeByTitle` is called today, keeping input order and the first paper of
      each group. No new source, dependency, ranking term, RPC contract or PostHog payload change, and
      the frozen seed edition stays as it is.
      Accept: titles differing only in case and punctuation collapse to the first; two titles sharing
      more than nine tenths of their tokens collapse; unrelated titles in the same beat all survive in
      input order; titles at or below the 0.9 boundary are both kept, so one-token titles never collapse
      accidentally; the helper is unit-tested on those cases.
      — `d480596`

---

## P3 — optional

- [x] **7. Reading-time completion in the dwell event.** SPEC §16 P3 lists reading-time analytics;
      dwell is measured and `readMinutes` is shown, but the analytics event carries no estimate, so
      nobody can tell a 90-second abstract read from a 2-second bounce. Add a pure ratio helper
      (measured dwell over estimated read time, clamped to 1) and send `read_minutes` plus
      `completion` on the existing `dwell` feed-health event. Measurement only: no ranking,
      persistence or contract change beyond threading `readMinutes` to the analytics call. Accept: a
      2-minute clipping dwelled 60 s reports 0.5, an over-read reports 1, a missing or zero estimate
      reports null, and PostHog staying unconfigured changes nothing.
      — `6f3beaf`

- [x] **8. Archival-drift readout on the desk.** SPEC §4 lists `stats` on `/desk` and SPEC §17.3
      keeps citation count as a quality signal only "if we measure whether the feed feels archival" —
      `medianYear` is computed for PostHog (task 5) but no reader can see it, so the decision has no
      visible input. Show the loaded edition's archival drift in the desk drawer: median publication
      year plus how many papers predate the newest paper on the page by more than ten years. Compute
      both from one pure `archivalDrift` helper next to `medianYear`, render with the existing
      `StatCard`/`Grid` primitives. Display only: no ranking, RPC contract or PostHog payload change.
      Accept: years 2010/2016/2024 report median 2016 and 1 of 3 older than a decade (threshold taken
      from 2024, the newest on the page); a page with no years renders an em dash, never `NaN`; the
      helper is unit-tested; the ranked page for a fixed seed is unchanged.
      — `cf473fa`

- [x] **9. Shareable edition as plain text.** SPEC §16 P3 lists shareable "editions", but a deck
      page only exists inside the app, so a reader cannot hand one to a colleague. Add a pure
      `formatEdition` helper beside `formatCitation` that renders the loaded page as a broadsheet
      notice: one masthead line naming the edition and folio, then one line per clipping in page
      order with kicker, headline, first author and year, and the DOI or source URL. Add a copy
      control that writes it to the clipboard and announces success in the permalink's live-region
      pattern. No new route, no persistence, no network. Accept: a 3-paper page yields exactly one
      header line and three clipping lines in page order, each carrying its source URL; an empty
      page yields an empty string and the control stays disabled; a failed clipboard write is
      reported, never silent; the helper is unit-tested.
      — `ad6ca64`

- [x] **11. Beat-mapping coverage on `feed.next`.** SPEC §17.2 keeps the fixed nine beats on the
      condition that source papers are mapped onto them, but `detectTopics` in
      `src/lib/openalex.ts` files every paper whose title and abstract carry no beat keyword under
      `Education`, so an unmapped paper spends an education slot in the ≤2-per-topic cap, earns
      education affinity and counts as an education paper in the §8.4 topic mix — nobody can tell a
      real education paper from a fallback, and the open decision has no number to revisit it with.
      Move the beat keyword table and the keyword match into one pure exported `matchedTopics`
      helper that returns the beats that actually matched, keep `detectTopics` as that helper plus
      today's `Education` fallback, and report `unmatched_beat_count` on the existing `feed.next`
      feed-health event beside `median_year`. Measurement only: ranking output must not change.
      Accept: a page whose three papers match no beat, one beat and no beat reports 2; a page where
      every paper matches a beat reports 0; an empty page reports 0, never `NaN`; `detectTopics`
      still returns `["Education"]` for unmatched text; the helper is unit-tested; the ranked page
      for a fixed seed is identical before and after.
      — `d7e214f`

- [x] **13. Citation-age skew on `feed.next`.** SPEC §17.3 keeps citation count as a quality
      signal on the condition that we measure the archival bias it introduces; `feed.next` reports
      `median_year` (how old the page feels) but nothing reports the half of the decision the
      damping is meant to offset — whether the page's citations sit on its old clippings. Add a pure
      `citationAgeSkew` helper beside `medianYear` in `src/lib/feed-analytics.ts` that splits a page
      on its median year and returns the median citation count either side, and report both on the
      existing `feed.next` feed-health event. Measurement only: no ranking, RPC contract or
      persistence change, and the log10/3 damping stays as it is.
      Accept: years 2010/2016/2024 with citations 400/50/10 report 400 for the older clippings and
      30 for the newer ones (a clipping dated exactly the median year counts as newer); a page with
      no years reports null for both, never `NaN`; a one-paper page reports null older and its own
      citations as newer; the helper is unit-tested; the ranked page for a fixed seed
      is identical before and after.
      — `ed2ea39`

- [x] **15. Citation-age skew on the desk.** SPEC §17.3 keeps citation count as a quality signal only
      on the condition that we measure the archival bias it introduces, and the desk is where that
      decision is meant to be revisited. `archivalDrift` (task 8) is rendered there, but
      `citationAgeSkew` (task 13) stays in PostHog, so a reader sees how old the page feels and never
      which side of the page its citations sit on — the half `log10`/3 damping exists to offset. Render
      the older and newer median citation counts from the same loaded snapshot in the desk's Archival
      drift block, using the existing `StatCard`/`Grid` primitives. Display only: no helper, ranking,
      RPC contract or PostHog payload change.
      Accept: years 2010/2016/2024 with citations 400/50/10 render 400 and 30; an empty side or an
      unloaded snapshot renders an em dash, never `NaN`; no ranking output changes.
      — `667e0a0`

- [x] **16. Topic entropy on `feed.next`.** SPEC §8.4 lists Shannon topic entropy at ≥ 1.6 nats per
      50 impressions and open decision 2 keeps the fixed nine beats only until someone can tell
      whether those beats are too coarse — `feed.next` reports `median_year`,
      `unmatched_beat_count` and both citation medians, but nothing reports how evenly a page spreads
      across beats, so a page of ten near-identical topics looks the same as a well-mixed one. Add a
      pure `topicEntropy` helper beside `medianYear` in `src/lib/feed-analytics.ts` returning the
      Shannon entropy in nats of the page's primary beat per clipping, and report `topic_entropy` on
      the existing `feed.next` feed-health event beside `median_year` (ten clippings per page, so
      five consecutive page events are the §8.4 per-50-impressions window). Measurement only: no
      ranking, RPC contract, persistence or desk change, and the ≤2-per-topic cap stays as it is.
      Accept: three clippings on three distinct beats report ln 3 ≈ 1.099; ten clippings all on one
      beat report 0; an empty page reports 0, never `NaN`; the helper is unit-tested; the ranked page
      for a fixed seed is identical before and after.
      — `06d08de`

- [x] **17. Topic mix on the desk.** SPEC §8.4 asks for Shannon topic entropy at ≥ 1.6 nats per 50
      impressions and open decision 2 keeps the fixed nine beats only until someone can tell whether
      those beats are too coarse. `topicEntropy` (task 16) reports it to PostHog but no reader can see
      it, so the decision has no visible input on the same desk that already shows archival drift
      (task 8) and citation-age skew (task 15). Render the loaded page's entropy in nats plus how many
      distinct beats it spreads across, in the desk drawer, reusing `topicEntropy` and the existing
      `StatCard`/`Grid` primitives. Display only: no helper, ranking, RPC contract, persistence or
      PostHog payload change.
      Accept: a page with three clippings on three beats renders 1.10 nats and 3 beats; ten clippings
      all on one beat renders 0 and 1 beat; an unloaded snapshot renders an em dash, never `NaN`; the
      ranked page for a fixed seed is unchanged.
      — `4a5f8d9`

- [x] **19. Gazette shell metadata.** SPEC §16 P3 lists a native shell; the smallest honest slice
      is what the shell claims about the app, and `public/manifest.json` still carries the TanStack
      sample identity (`"name": "Create TanStack App Sample"`, black `theme_color`, sample-logo
      icons) that no head ever links — a reader adding the deck to a home screen gets somebody
      else's name and a gutter that fights the paper ground. Replace the manifest with the gazette
      identity (`short_name`/`name` naming AcademiTok, `start_url: "/"`, `display: "standalone"`,
      `background_color` = `--color-paper-deep`, `theme_color` = `--color-ink`), link it from the
      root route head beside a matching `theme-color` meta, and delete the sample icon entries and
      their two unused logo files until a gazette mark exists (shortcut: no install artwork yet,
      add icons when the mark is drawn). No dependency, no route, no design-system change.
      Accept: the manifest parses, carries the AcademiTok name, `start_url: "/"`,
      `display: "standalone"` and no TanStack sample text; the root head links `/manifest.json`
      with a `theme-color` equal to the manifest's; `logo192.png`/`logo512.png` are gone and nothing
      references them; a test asserts name, start URL, display, the two colours and the head link
      from the real files.
      — `6460591`

- [x] **21. Installed-shell safe areas.** SPEC §16 P3 lists a native shell and task 19 gave the
      manifest the gazette identity with `display: "standalone"`, but the root viewport meta is
      `width=device-width, initial-scale=1` with no `viewport-fit=cover`, and no component reads
      `env(safe-area-inset-*)` — so in the installed window the masthead strip slides under the
      status bar and the rail and folio under the home indicator, while the same page in a browser
      tab looks correct. The deck is deliberately edge-to-edge (§5.1), so the insets belong in the
      design-system components (`FeedDeck` and `PaperSlide`'s masthead/footer strip and rail), not
      in route or feature code. Add `viewport-fit=cover` to the viewport meta and pad those edges
      by the four insets, leaving the paper ground, the type measure and the one-clipping-per-
      viewport snap untouched. No dependency, route, ranking, RPC contract or PostHog change.
      Accept: the root head's viewport meta carries `viewport-fit=cover`; the deck and the clipping
      strip read `env(safe-area-inset-top|right|bottom|left)`; with zero insets (a browser tab) the
      deck still shows exactly one clipping with the masthead strip fully inside the viewport; a
      test asserts the meta from `rootHead()` and the inset usage from the real component files.
      — `a27f7ab`

- [x] **22. Gazette mark as the tab and install icon.** SPEC §16 P3 lists a native shell; tasks 19
      and 21 gave it the AcademiTok manifest and the safe-area insets, and task 19 left the icons
      out with the note "add icons when the mark is drawn". Nothing has been drawn, so the shell is
      nameless in the places a reader actually sees it: `rootHead()` links no icon, so the tab falls
      back to `/favicon.ico` — the TanStack sample mark still sitting in `public/` beside the two
      unreferenced sample logos (`tanstack-circle-logo.png`, `tanstack-word-logo-white.svg`) — and
      the manifest has no `icons`, so an installed deck shows a generic glyph. Draw the mark once
      as a hand-written SVG on the paper tokens (ink ground, paper serif `A`, one vermilion
      hairline), serve it from `/mark.svg` as the favicon and the single manifest icon
      (`"sizes": "any"`, `image/svg+xml`), link it from `rootHead()`, and delete the three sample
      assets. No dependency, route, design-system component, ranking, RPC contract or PostHog
      change.
      Accept: `public/mark.svg` exists and parses as SVG using only `--color-ink`/`--color-paper`/
      `--color-stamp` values; `public/manifest.json` lists that one icon with `image/svg+xml`;
      `rootHead()` links `/mark.svg`; `favicon.ico`, `tanstack-circle-logo.png` and
      `tanstack-word-logo-white.svg` are gone and nothing in `src/` references them; a test asserts
      the manifest icon and the head link from the real files, that `public/mark.svg` exists, and
      that the three sample assets do not; the shell-metadata test stops asserting `icons` is
      undefined.
      — `240bc03`

- [x] **24. Name the offline edition.** SPEC §7 promises the frozen seed file is served "with a
      visible 'offline edition' notice. Never an empty screen", and §16 P3's native shell makes
      the promise load-bearing: in an installed deck with no network the reader is handed the seed
      clippings dressed as the live edition. `resolveCatalog` in
      `src/features/papers/application.ts` swaps in `curatedPapers` on an upstream failure and
      returns the same shape either way, and neither `FeedSnapshot` nor `PaperSlide` has anywhere
      to say where a page came from. Have `resolveCatalog` report its own origin (`"pool"` for the
      stored-page branch, `"live"` for a fresh fetch, `"seed"` for the frozen fallback), add one
      `origin` field to `FeedSnapshot` — leave `FeedPage` alone so `saved.list` keeps its shape —
      carry it through `getPaperFeedSnapshot` and the next-page append in
      `src/routes/-index/atoms.tsx`, and let `PaperSlide` print `Offline Edition · No. 042` in the
      masthead strip that already prints `Evening Edition · No. 042` when the origin is `seed`. No
      new component, no design-language, ranking, PostHog or dependency change, no change to
      `FeedPage` or `saved.list`, and the one-clipping-per-viewport snap is untouched.
      Accept: an empty pool with a failing upstream reports `origin: "seed"` and the strip reads
      `Offline Edition`; a warm pool reports `"pool"` and a successful fetch `"live"`, both with the
      strip still reading `Evening Edition`; a page appended by `loadNextPaperPage` keeps the first
      page's origin; the origin and strip assertions run from the real `getPaperFeedSnapshot`
      (stubbed fetch, temp PGlite dir) and from `renderToStaticMarkup` of the component.
      — `6bbdb0d`

- [x] **25. Median dwell readout on the desk.** SPEC §8.4 sets median dwell at ≥ 8s and §16 P3
      lists reading-time analytics, but the number is unread: `dwell` carries a per-clip `dwell_ms`
      to PostHog (task 7) and `ReaderState.impressions` already holds `dwellMs`, while the desk
      drawer shows archival drift (task 8), citation skew (task 15) and topic mix (task 17) and
      never how long the reader actually stays. `FeedStats` in `src/api/paper-schema.ts` carries
      five page counts and no dwell figure. Add a pure `medianDwell` helper beside `median` in
      `src/lib/feed-analytics.ts` over the dwells with a recorded value, report it as
      `medianDwellMs` on `FeedStats` from the reader's last 50 impressions (the §8.4 window task 16
      already uses), and render it in the desk's stats block with the existing `StatCard`/`Grid`
      primitives in seconds beside its 8s target. Display only: no ranking, RPC procedure,
      persistence or PostHog payload change, and the one-clipping-per-viewport snap is untouched.
      Accept: dwells of 4s/6s/20s report 6000 ms and the desk renders `6.0 s`; an even sample
      averages the middle pair; a reader with no recorded dwell reports null and the desk renders an
      em dash, never `NaN` or `0`; the helper is unit-tested and reaches `getPaperFeedSnapshot` from
      the real `ReaderState.impressions`; the ranked page for a fixed seed is identical before and
      after.
      — `0cde77a`

- [x] **26. Median reading completion on the desk.** SPEC §16 P3 lists reading-time analytics and
      task 7 already computes a per-clip `completion` ratio (measured dwell over estimated read
      time, clamped to 1) for the PostHog `dwell` event, but nothing aggregates it: the desk shows
      median dwell beside its 8 s target (task 25) and never whether the clippings are read to the
      end, so a page of 4-second bounces and a page of abstracts read twice over look identical.
      Add a pure `medianCompletion` helper beside `medianDwell` in `src/lib/feed-analytics.ts` over
      values produced by the existing `readingCompletion` (drop clippings whose estimate is missing
      or zero, then take the median of the rest), report it as `medianCompletion` on `FeedStats`
      from the reader's last 50 dwell reactions joined to their paper's `readMinutes` in the loaded
      catalog, and render it in the desk's Reading pace block with the existing `StatCard`/`Grid`
      primitives as a percentage beside the 100% target. A clipping whose paper is not in the
      loaded catalog is dropped rather than counted as zero. Display only: no ranking, RPC
      procedure, persistence or PostHog payload change, and the one-clipping-per-viewport snap is
      untouched.
      Accept: a 2-minute clipping dwelled 60 s and a 4-minute clipping dwelled 120 s both report
      0.5 and the desk renders `50%`; an over-read reports 1 and a clipping with no estimate is
      dropped from the median, never counted as 0; a reader with no recorded completion reports null
      and the desk renders an em dash, never `NaN` or `0%`; the helper is unit-tested and reaches
      `getPaperFeedSnapshot` from real `ReaderState` dwell reactions; the ranked page for a fixed
      seed is identical before and after.
      — `37c6cf5`

- [x] **28. Hide rate and open-source rate on the desk.** SPEC §8.4 sets hide rate at ≤ 3% and
      open-source rate at ≥ 12%, and the rail records both as `hide` and `open-site` reactions the
      desk never counts: it shows archival drift (task 8), citation skew (task 15), topic mix
      (task 17), median dwell (task 25) and median completion (task 26), while the two numbers the
      feed is judged on exist only as per-event PostHog properties with no rate over the reader's
      window, so nobody can tell a page of clippings read and opened from a page of clippings
      dismissed. Add one pure `reactionRates` helper beside `medianDwell` in
      `src/lib/feed-analytics.ts` over the reaction kinds and the §8.4 window of the reader's last
      50 `view` reactions: hide rate and open-site rate, each `null` when the window holds no view.
      Report both as `hideRate`/`openSourceRate` on `FeedStats`, and render them in the desk's
      Reading pace block with the existing `StatCard`/`Grid` primitives as percentages beside
      their 3% and 12% targets. Display only: no ranking, RPC procedure, persistence or PostHog
      payload change, and the one-clipping-per-viewport snap is untouched.
      Accept: a 50-view window with 1 hide and 6 open-site reactions reports 0.02 and 0.12
      and the desk renders `2.0%` and `12%`; a reader with no view reactions reports null for both
      and the desk renders an em dash, never `NaN` or `0%`; the helper is unit-tested and its
      counts reach `getPaperFeedSnapshot` from the real `ReaderState` view/hide/open-site
      reactions; the ranked page for a fixed seed is identical before and after.
      — `3c48da4`

- [x] **29. Saves per 100 impressions on the desk.** SPEC §8.4 sets saves at ≥ 1.0 per 100
      impressions and the rail records a save as a `bookmark` reaction, but the desk's Reading pace
      block shows median dwell (task 25), median completion (task 26), hide rate and open-source
      rate (task 28) and never the number the feed is judged on for keeping value — so a window of
      clippings read and kept looks the same as a window of clippings read and discarded. Add one
      pure `savesPerHundred` helper beside `reactionRates` in `src/lib/feed-analytics.ts` over the
      same §8.4 window of the reader's last 50 `view` reactions, counting the `bookmark` reactions
      in that window and returning `null` when the window holds no view. Report it as
      `savesPerHundred` on `FeedStats`, and render it in the desk's Reading pace block with the
      existing `StatCard`/`Grid` primitives beside its 1.0 target. Display only: no ranking, RPC
      procedure, persistence or PostHog payload change, and the one-clipping-per-viewport snap is
      untouched.
      Accept: a 50-view window with 2 `bookmark` reactions reports 4 and the desk renders `4.0`; a
      window of views with no bookmark reports 0 and renders `0.0`, never an em dash; a reader with
      no view reactions reports null and the desk renders an em dash, never `NaN`; the helper is
      unit-tested and its counts reach `getPaperFeedSnapshot` from the real `ReaderState`
      view/bookmark reactions; the ranked page for a fixed seed is identical before and after.
      — `75ee75a`

- [x] **30. Undo a hide from the notice line.** SPEC §5.2 promises `h` hides with "undo via
      toast (5s)" and §10 promises a failed reaction is "never a silent divergence", but no notice
      surface exists anywhere in `src/` — `reactToPaperAtom` filters a hidden paper straight out of
      the deck and `app.tsx` jumps to the next clipping, so a mistyped `h` permanently drops the
      paper from the feed and writes a −5 topic-affinity signal with no way back, and `s` files a
      clipping with no confirmation at all. Add one `Notice` component to the design-system
      components (fixed above the bottom safe-area inset, paper ground, hairline rule, mono caps
      label, optional single action, `role="status"`) and register it in `registry.ts`; render it
      from `app.tsx` with a 5s lifetime: hiding shows `Clipped out` with an `Undo` action that
      restores the clipping at its previous index and toggles the `hide` reaction back off, saving
      shows `Filed in clippings` with no action. Wire the removal through one pure exported helper
      (`removeItemAt` returning the item and its index, plus `restoreItem` putting it back) so the
      restore is testable without a browser. No new dependency, no route, no ranking, RPC contract,
      schema or PostHog change, and the one-clipping-per-viewport snap is untouched.
      Accept: `h` removes the clipping, shows `Clipped out` and restores it at its previous index
      when `Undo` is activated by pointer or keyboard, with the `hide` reaction inactive
      afterwards; the notice disappears after 5s of inaction and the clipping stays removed; `s`
      shows `Filed in clippings` with no action; `Esc` dismisses the notice without moving deck
      focus; `removeItemAt`/`restoreItem` round-trip a three-item page and are unit-tested, and a
      test renders the notice from the real component for the label, the status role and the
      optional action.
      — `c77c005`

- [x] **31. Topic entropy over the §8.4 impression window on the desk.** SPEC §8.4 sets Shannon
      topic entropy at ≥ 1.6 nats per 50 impressions and open decision 2 keeps the fixed nine beats
      only until someone can tell whether those beats are too coarse — but the desk's Topic mix
      block (task 17) renders `topicEntropy` over the loaded page's ten clippings, the wrong window
      for a floor defined per 50 impressions, so a well-mixed page is judged against a target it
      was never measured on. Add `windowTopicEntropy` to `FeedStats` as the entropy of the reader's
      last 50 impressions (the §8.4 window `medianDwell` already uses), computed in
      `getPaperFeedSnapshot` by reusing the existing `topicEntropy` over the primary beat of each
      impression's paper from the loaded catalog, and render it in the desk's Topic mix block with
      the existing `StatCard`/`Grid` primitives beside its 1.6 nats floor. An impression whose
      paper is not in the loaded catalog is dropped rather than counted as a beat. Display only: no
      new helper, no ranking, RPC procedure, persistence or PostHog payload change, and the
      one-clipping-per-viewport snap is untouched.
      Accept: a window of three impressions on three distinct beats reports ln 3 ≈ 1.10 and a
      fifty-impression window on one beat reports 0; an impression older than the window's fifty
      does not move the figure; a reader with no impressions, or whose impression papers are absent
      from the loaded catalog, reports null and the desk renders an em dash, never `NaN` or `0`; the
      figure reaches `getPaperFeedSnapshot` from real `ReaderState.impressions`; the ranked page for
      a fixed seed is identical before and after.
      — `beeb177`

- [x] **32. Archival drift over the §8.4 impression window on the desk.** SPEC §17.3 keeps citation
      count as a quality signal on the condition that we "measure whether the feed feels archival",
      and task 31 has just shown the desk reading a window-scoped metric off the wrong window: the
      Archival drift block renders `archivalDrift` over the loaded page's ten clippings, so the
      question §17.3 actually asks — does the feed this reader receives feel archival — is answered
      one page at a time and never over what the reader has read. `getPaperFeedSnapshot` already
      builds `windowPapers` (the last 50 `view` reactions joined to the loaded catalog) for
      `windowTopicEntropy`. Reuse it to report `windowMedianYear` on `FeedStats` through the existing
      `medianYear` helper, and render it in the desk's Archival drift block with the existing
      `StatCard`/`Grid` primitives beside the page figure, its helper naming the 50-impression
      window. An impression whose paper is not in the loaded catalog is dropped rather than counted
      as a year. Display only: no new helper, no ranking, RPC procedure, persistence or PostHog
      payload change, and the one-clipping-per-viewport snap is untouched.
      Accept: a window of three impressions on 2019/2022/2024 reports 2022 and the desk renders it
      beside the loaded page's median year; an even-sized window averages the two middle years; an
      impression older than the window's fifty does not move the figure; a reader with no
      impressions, or whose impression papers are absent from the loaded catalog, reports null and
      the desk renders an em dash, never `NaN`; the figure reaches `getPaperFeedSnapshot` from real
      `ReaderState` view reactions; the ranked page for a fixed seed is identical before and after.
      — `80327d9`

- [x] **33. Duplicate rate over the §8.4 impression window on the desk.** SPEC §8.4 sets duplicate
      rate per page at exactly 0 and AGENTS.md calls rotation a bug, but nothing measures it: the
      desk shows the other six feed-health numbers while `reactionWindow` in
      `src/lib/feed-analytics.ts` counts views, hides, opens and saves from the reaction kinds alone
      and never looks at which papers they name, so a session that is served the same clipping twice
      (a stale cursor, a pool refetch, a session-dedupe miss) looks identical to a clean one. Add one
      pure `duplicateRate` helper beside `savesPerHundred` over the paper ids of the reader's last 50
      `view` reactions, the §8.4 window, returning the share of views whose paper already appeared
      earlier in that window and `null` when the window holds no view. Report it as
      `windowDuplicateRate` on `FeedStats` from the view reactions' `paperId`s in
      `getPaperFeedSnapshot` — collected from the reactions themselves, not from `windowPapers`, so a
      repeat of a paper missing from the loaded catalog still counts — and render it in the desk's
      Topic mix block with the existing `StatCard`/`Grid` primitives as a percentage beside its 0%
      target. Display only: no ranking, RPC procedure, persistence or PostHog payload change, and the
      one-clipping-per-viewport snap is untouched.
      Accept: a 50-view window whose 48 distinct papers carry 2 repeats reports 0.04 and the desk
      renders `4.0%`; a window of 50 distinct papers reports 0 and renders `0.0%`, never an em dash;
      a repeat older than the window's fifty does not move the figure; a reader with no view
      reactions reports null and the desk renders an em dash, never `NaN`; the helper is unit-tested
      and its count reaches `getPaperFeedSnapshot` from real `ReaderState` view reactions; the ranked
      page for a fixed seed is identical before and after.
      — `ab9e1f9`

- [x] **34. Cold-feed failure rate on `feed.next`.** SPEC §8.4 sets cold-feed failure at < 0.5% and
      it is the last row of the metric table nothing reports: `trackFeedPageEvent` in
      `src/lib/feed-analytics.ts` sends `item_count`, `duplicate_count`, `median_year`,
      `unmatched_beat_count`, `topic_entropy` and both citation medians, but not where the page came
      from — task 24 added `origin` to `FeedSnapshot` and `PaperSlide` prints it, while the analytics
      event still cannot tell a served pool page from the frozen seed edition, so the share of pages
      the reader never really received has no numerator. Add `origin` to the existing `feed.next`
      payload from `snapshot.origin` (`"pool"`, `"live"` or `"seed"`), so the per-page share of
      `seed` is the §8.4 rate. Measurement only: no ranking, RPC contract, schema, desk or widget
      change, and the frozen seed edition stays as it is.
      Accept: a snapshot with `origin: "seed"` sends `origin: "seed"`, and pool and live snapshots
      send their own origin; the field is sent on every page, including an empty one; the ranked page
      for a fixed seed is identical before and after; the payload is asserted from a real
      `trackFeedPageEvent` call with the PostHog client mocked, and PostHog staying unconfigured
      changes nothing.
      — `606cdc9`

- [x] **35. An edition link the reader can hand to somebody.** SPEC §16 P3 lists shareable
      "editions" and the desk's `CopyBlock` ("Share this edition", `app.tsx`) already copies
      `formatEdition`'s plain text, but text is not a link: whoever receives it cannot open the same
      ten clippings, and `feed.next` has no way to serve a named page — `getPaperFeedSnapshot`
      always ranks, so a shared list would come back as a different order on a different reader.
      Make the notice copyable _and_ openable: add a pure `formatEditionLink(papers, baseUrl)` in
      `src/features/papers/citation.ts` returning `<baseUrl>/?edition=<ids>`, ids in page order,
      empty string for an empty page; add `edition: Schema.optional(Schema.Array(Schema.String))`
      to `FeedRequest` (≤ 10 ids, `paper-schema.ts`); in `getPaperFeedSnapshot` serve a pinned page
      when the field is present — the catalog items named by the ids, in the given order, missing
      ids dropped, `nextCursor: null`, no ranking, diversity, seen-filter or session write — and
      leave every other request path untouched; read the param through `validateSearch` on `/`
      so the loader passes it into the request; and append the link to the copied text in the desk
      `CopyBlock` so the plain notice and the link travel together. No new route, no persistence
      column, no RPC procedure, no PostHog payload and no change to the ranked page for a fixed
      seed.
      Accept: `formatEditionLink` of a three-paper page renders `/?edition=<first>,<second>,<third>`
      in page order and an empty page renders `""`; a `feed.next` request with those ids returns
      exactly those papers in that order with a null cursor and works the same for a reader who has
      never seen them; an unknown id is dropped instead of failing the page, and eleven ids are
      rejected by the schema; opening `/?edition=…` for a fixed set renders the same first clipping
      as the page it was copied from; a request without `edition` ranks exactly as before, so the
      fixed-seed page is identical; the helper is unit-tested and `bun run validate` is green.
      — `4bf1b6a`

- [x] **36. A name and a description for every surface.** SPEC §16 P3's native shell and the P2
      permalink exist so a clipping can leave the deck, but no surface answers "what is this link":
      `rootHead()` in `src/routes/__root.tsx` carries one static `AcademiTok Gazette` title and no
      `description`, `src/routes/index.tsx` and `src/routes/saved.tsx` set no `head` at all, and
      `src/routes/paper/$id.tsx` sets a title only — so the deck, the morgue and a shared clipping
      all present as the same untitled gazette in the tab, in the installed window's title bar, and
      in the preview a colleague sees when the permalink is pasted into a chat. Add one pure
      `pageHead({ title, description })` helper beside `rootHead` returning the title plus
      `description`/`og:title`/`og:description` entries clamped to 160 characters on a word boundary,
      and hang it on the three surfaces: the deck (`AcademiTok — the reading deck`), the morgue
      (`Clippings · AcademiTok`) and the permalink (the paper's title and its abstract excerpt).
      Leave the root's manifest, icon, theme-colour and viewport entries untouched; no image, route,
      component, ranking, RPC contract or PostHog change.
      Accept: the helper returns a title and a long description as exactly one `title`, one
      `description`, one `og:title` and one `og:description` entry, each text clamped to 160
      characters on a word boundary; a description already inside the limit passes through unchanged
      and a missing one is omitted rather than rendered empty; the deck and morgue route options each
      carry their own title and a description, both differing from the root's; the permalink's head
      carries the paper title and its abstract excerpt; no surface falls back to the bare
      `AcademiTok Gazette` title; the helper is unit-tested and the three route heads are asserted
      from the route modules with router and server modules mocked the way `__root.test.tsx` already
      mocks them.
      — `aa4516e`

- [x] **37. A filing count on the permalink.** SPEC §16 P3 lists "multi-reader with collaborative
      signals": task 20 gave every visitor their own `reader_id`, but nothing ever reads the
      `reactions` rows across readers — the `/paper/$id` permalink prints one clipping's metadata
      and citations as if the reader were alone in the morgue, so the one collaborative fact the
      split rows can already answer (how many readers filed this clipping) is thrown away and
      multi-reader buys nothing a reader can see. Add a `savedByReaders(paperId)` read to
      `ReaderStateRepository` counting distinct `reader_id` rows in `reactions` where `paper_id`
      matches, `kind = 'bookmark'` and `active = true` — deliberately not reader-scoped — implement
      it for both the PGlite and Postgres storages, wrap it in an exported `getPaperAudience(id)` in
      `src/features/papers/application.ts`, resolve it beside the paper through a second
      `createServerFn` in the permalink route's existing `loader`, and render it as one more fact in
      `PaperPage`'s `<dl>` (`Filed by` → `3 readers`). Display only: no ranking, `ReaderState`, RPC
      procedure, schema, contract or PostHog change, no new dependency, no new component, and the
      one-clipping-per-viewport snap is untouched.
      Accept: two readers filing the same paper report 2 and the permalink renders `Filed by` with
      `2 readers`; an undone save (`active = false`) is not counted, so a reader who files and
      undoes leaves the count at 0 and the fact is omitted rather than printed as `0 readers`; the
      count is visible to a reader who never filed it, so it is not reader-scoped; an unknown
      permalink id still returns the not-found notice; the count is asserted from a real repository
      written under two `ReaderId` values, and the omitted/rendered fact from
      `renderToStaticMarkup` of the real `PaperPage`.
      — `7ff938c`

- [ ] **38. A way out of a shared edition.** SPEC §16 P3 lists shareable "editions" and task 35 made
      `/?edition=<ids>` reopen a pinned page, but that page is a dead end: the pinned branch of
      `getPaperFeedSnapshot` in `src/features/papers/application.ts` serves `nextCursor: null`, the
      deck's `navigate` clamps to the last item and `onVisible` only prefetches when a cursor exists,
      so a reader who follows a colleague's link reads ten clippings and then cannot page, cannot
      re-rank and cannot get back to the edition their own reading earned — the only exit is editing
      the URL by hand, which no control offers. Have the pinned branch report `pinned: true` on
      `FeedSnapshot` (`false` on every ranked path), carry it through `getPaperFeedSnapshot`, the
      next-page append in `src/routes/-index/atoms.tsx` and `loadNextPaperPage`, and let `PaperSlide`
      print a `Your edition` link to `/` in the masthead strip that already prints
      `Evening Edition · No. 042` when the page is pinned — the plain link drops the search param, so
      the loader ranks as usual. No new route, no new component, no ranking, RPC procedure,
      persistence, PostHog payload or `FeedPage`/`saved.list` change, no dependency, and the
      one-clipping-per-viewport snap is untouched.
      Accept: a snapshot built from a request carrying `edition` reports `pinned: true` while the
      ranked and seed paths report `false`; the pinned page's strip renders a `Your edition` link
      whose `href` is `/`, and a ranked page's strip renders no such link; a page appended by
      `loadNextPaperPage` keeps the first page's `pinned` flag; the flag and the strip assertion run
      from the real `getPaperFeedSnapshot` (stubbed catalog, temp PGlite dir) and from
      `renderToStaticMarkup` of the real `PaperSlide`.

---

## Blocked — needs a product decision

- **Additional sources (arXiv, bioRxiv, Crossref).** Each adds a fetch client, a schema
  drift surface and rate-limit etiquette. Pick which one lands first, or none.
- **LLM dek behind a flag.** Costs money per page view and adds a provider dependency;
  SPEC keeps it out of P0. Needs a written cost ceiling before it becomes a task.

## Done (P1, for the record)

Reaction/impression tables · batched impression transport · tf-idf content affinity ·
MMR diversity with topic/author caps · author and venue affinity · onboarding picks ·
`WHY THIS` from real scoring terms · PostHog feed-health events · packaging identity ·
todo template retired.
