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

- [ ] **17. Topic mix on the desk.** SPEC §8.4 asks for Shannon topic entropy at ≥ 1.6 nats per 50
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
